import { FastifyInstance } from 'fastify';
import { authGuard } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { nanoid } from 'nanoid';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  scrapeMercadoLivreHTTP,
  scrapeMagaluHTTP,
  scrapeAmazonHTTP,
  scrapeGenericHTTP,
} from './scraper-http.js';
import { sendTelegramMessage, isTelegramConfigured } from '../services/telegram.js';
import { postOfferToTwitter } from '../services/twitter.js';
import { generateCopies } from '../services/aiCopyGenerator.js';
import { uploadFromUrl } from '../services/cloudinary.js';
import { resolveNicheFromTitle } from '../services/nicheDetector.js';

const SITE_URL = process.env.SITE_URL || 'https://www.manu-promocoes.com.br';

interface PublishResult {
  url: string;
  status: 'success' | 'partial' | 'error';
  title?: string;
  finalPrice?: number;
  originalPrice?: number;
  discountPct?: number;
  image?: string;
  offerId?: string;
  telegram?: { success: boolean; error?: string };
  twitter?: { success: boolean; error?: string };
  site: boolean;
  error?: string;
  paymentMethod?: string;
}

interface LinkGroup {
  urls: string[];
  paymentMethod?: 'avista' | 'pix';
  couponCode?: string;
}

export async function autoPublishRoutes(app: FastifyInstance) {
  /**
   * POST /api/auto-publish/publish
   * Recebe grupos de URLs (cada grupo com paymentMethod e couponCode próprios).
   * Também aceita o formato legado { urls, couponCode } para compatibilidade.
   */
  app.post('/publish', { preHandler: [authGuard] }, async (request, reply) => {
    const body = request.body as {
      // Novo formato: grupos com tipo de pagamento
      groups?: LinkGroup[];
      // Formato legado
      urls?: string[];
      couponCode?: string;
      // Opções globais
      postTelegram?: boolean;
      postTwitter?: boolean;
      isFlash?: boolean;
      flashMinutes?: number;
    };

    const { postTelegram = true, postTwitter = true, isFlash = false, flashMinutes = 180 } = body;

    // Normalizar para array de grupos
    let groups: LinkGroup[] = [];
    if (body.groups && Array.isArray(body.groups) && body.groups.length > 0) {
      groups = body.groups;
    } else if (body.urls && Array.isArray(body.urls) && body.urls.length > 0) {
      // Compatibilidade com formato legado
      groups = [{ urls: body.urls, paymentMethod: 'avista', couponCode: body.couponCode }];
    }

    if (groups.length === 0) {
      return reply.status(400).send({ error: 'Forneça ao menos uma URL.' });
    }

    // Expandir grupos em lista plana de { url, paymentMethod, couponCode }
    // Limite global de 20 URLs no total
    const allItems: { url: string; paymentMethod: 'avista' | 'pix'; couponCode?: string }[] = [];
    for (const group of groups) {
      const pm = group.paymentMethod ?? 'avista';
      const cc = group.couponCode?.trim() || undefined;
      for (const raw of (group.urls ?? [])) {
        const u = raw.trim();
        try { new URL(u); } catch { continue; }
        if (allItems.length >= 20) break;
        allItems.push({ url: u, paymentMethod: pm, couponCode: cc });
      }
      if (allItems.length >= 20) break;
    }

    if (allItems.length === 0) {
      return reply.status(400).send({ error: 'Nenhuma URL válida encontrada.' });
    }

    const results: PublishResult[] = [];

    for (const { url, paymentMethod, couponCode } of allItems) {
      const result: PublishResult = { url, status: 'error', site: false };

      try {
        console.log(`[AutoPublish] Processando: ${url.substring(0, 80)}`);

        // ── 1. DETECTAR LOJA ───────────────────────────────────────────────
        const urlLower = url.toLowerCase();
        let store = 'unknown';
        if (urlLower.includes('mercadolivre') || urlLower.includes('mercadolibre')) store = 'mercadolivre';
        else if (urlLower.includes('magazineluiza') || urlLower.includes('magalu')) store = 'magalu';
        else if (urlLower.includes('amazon')) store = 'amazon';

        // ── 2. SCRAPING ────────────────────────────────────────────────────
        const isAmazon = store === 'amazon';
        const httpResp = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...(isAmazon && {
              'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': '"Windows"',
              'sec-fetch-dest': 'document',
              'sec-fetch-mode': 'navigate',
              'sec-fetch-site': 'none',
              'upgrade-insecure-requests': '1',
            }),
          },
          timeout: 30000,
        });

        const $ = cheerio.load(httpResp.data);

        // Detectar página de CAPTCHA da Amazon
        if (store === 'amazon') {
          const pageText = $('body').text().toLowerCase();
          const isCaptcha = pageText.includes('robot check') ||
                            pageText.includes('captcha') ||
                            pageText.includes('enter the characters') ||
                            $('form[action*="captcha"]').length > 0 ||
                            $('input[name="amzn-r"]').length > 0;
          if (isCaptcha) {
            result.error = 'A Amazon bloqueou o acesso automático. Cole o link na página de Ofertas ou tente novamente em alguns minutos.';
            results.push(result);
            continue;
          }
        }

        let productData: any;

        if (store === 'mercadolivre') productData = await scrapeMercadoLivreHTTP($);
        else if (store === 'magalu') productData = await scrapeMagaluHTTP($);
        else if (store === 'amazon') productData = await scrapeAmazonHTTP($);
        else productData = await scrapeGenericHTTP($);

        if (!productData.title || productData.title.trim().length === 0) {
          result.error = store === 'amazon'
            ? 'Amazon bloqueou a leitura do produto. Tente novamente em alguns minutos ou use a página de Ofertas.'
            : 'Não foi possível extrair o título do produto.';
          results.push(result);
          continue;
        }

        if (!productData.finalPrice || productData.finalPrice <= 0) {
          result.error = 'Este tipo de anúncio (página de catálogo) requer entrada manual de preços. Use a página de Ofertas.';
          results.push(result);
          continue;
        }

        // Converter link Amazon em link de afiliado automaticamente
        let finalUrl = url;
        if (store === 'amazon') {
          try {
            const amazonUrl = new URL(url);
            amazonUrl.searchParams.set('tag', 'manudaspromoc-20');
            // Remover parâmetros de rastreamento desnecessários, manter só o essencial
            const cleanUrl = new URL(`https://www.amazon.com.br${amazonUrl.pathname}`);
            cleanUrl.searchParams.set('tag', 'manudaspromoc-20');
            finalUrl = cleanUrl.toString();
          } catch {
            // Se falhar a limpeza, adiciona o tag na URL original
            finalUrl = url.includes('?')
              ? `${url}&tag=manudaspromoc-20`
              : `${url}?tag=manudaspromoc-20`;
          }
        }

        // Garantir affiliateUrl = URL de afiliado
        productData.affiliateUrl = finalUrl;

        result.title = productData.title;
        result.finalPrice = productData.finalPrice;

        // ── 3. VALIDAR E CALCULAR DESCONTO ───────────────────────────────
        // Descartar preço original se o desconto parecer inflado (>75% ou ratio >5x)
        if (productData.originalPrice && productData.finalPrice > 0) {
          const ratio = productData.originalPrice / productData.finalPrice;
          const rawDiscount = Math.round(((productData.originalPrice - productData.finalPrice) / productData.originalPrice) * 100);
          if (ratio > 5 || rawDiscount > 75) {
            console.log(`[AutoPublish] Desconto suspeito descartado: R$${productData.originalPrice} → R$${productData.finalPrice} (${rawDiscount}% OFF)`);
            productData.originalPrice = null;
            productData.discount = 0;
          }
        }

        result.originalPrice = productData.originalPrice || null;

        const discountPct = productData.discount ||
          (productData.originalPrice && productData.originalPrice > productData.finalPrice
            ? Math.round(((productData.originalPrice - productData.finalPrice) / productData.originalPrice) * 100)
            : 0);
        result.discountPct = discountPct;

        // ── 4. DETECTAR LOJA E NICHO NO BANCO ─────────────────────────────
        let storeId: string | null = null;
        const storeSlugMap: Record<string, string> = {
          mercadolivre: 'mercadolivre',
          magalu: 'magalu',
          amazon: 'amazon',
        };
        if (store !== 'unknown') {
          const dbStore = await prisma.store.findFirst({
            where: { slug: storeSlugMap[store] || store, isActive: true },
          });
          storeId = dbStore?.id || null;
        }
        if (!storeId) {
          const firstStore = await prisma.store.findFirst({ where: { isActive: true } });
          storeId = firstStore?.id || null;
        }

        const nicheId = await resolveNicheFromTitle(productData.title || '');

        if (!storeId || !nicheId) {
          result.error = 'Configuração necessária: verifique se existem Lojas e Nichos cadastrados.';
          results.push(result);
          continue;
        }

        // ── 5. UPLOAD IMAGEM PARA CLOUDINARY ──────────────────────────────
        let mainImage = productData.mainImage || '';
        if (mainImage && !mainImage.includes('res.cloudinary.com')) {
          try {
            const up = await uploadFromUrl(mainImage, { folder: 'promo-platform/offers/auto' });
            if (up.success && up.url) mainImage = up.url;
          } catch (_e) { /* manter URL original */ }
        }
        result.image = mainImage;

        // ── 6. CRIAR OFERTA NO BANCO ───────────────────────────────────────
        const flashExpiresAt = isFlash
          ? new Date(Date.now() + flashMinutes * 60 * 1000)
          : null;

        const offer = await prisma.offer.create({
          data: {
            title: productData.title,
            finalPrice: productData.finalPrice,
            originalPrice: productData.originalPrice || null,
            discountPct,
            affiliateUrl: finalUrl,
            imageUrl: mainImage,
            mainImage,
            images: productData.images || [],
            nicheId,
            storeId,
            urgency: isFlash ? 'HOJE' : 'NORMAL',
            promoType: isFlash ? 'RELAMPAGO' : 'NORMAL',
            expiresAt: flashExpiresAt,
            curationStatus: 'APPROVED',
            couponCode: couponCode || null,
          },
          include: { store: { select: { name: true } } },
        });

        result.offerId = offer.id;

        // ── 7. PUBLICAR NO SITE (criar PublishedPost) ─────────────────────
        let goCode = '';
        try {
          // Gerar slug único
          const baseSlug = offer.title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 60);

          let slug = baseSlug;
          let suffix = 0;
          while (await prisma.publishedPost.findUnique({ where: { slug } })) {
            suffix++;
            slug = `${baseSlug}-${suffix}`;
          }

          goCode = nanoid(8);
          const discountLine = discountPct > 0 ? `${discountPct}% de desconto!` : '';
          const couponLine = couponCode ? `\n\n🏷️ Cupom: ${couponCode}` : '';
          const copyText = `🔥 ${offer.title}\n\nDe R$ ${offer.originalPrice ?? offer.finalPrice} por R$ ${offer.finalPrice}${discountLine ? '\n\n' + discountLine : ''}${couponLine}`;

          await prisma.publishedPost.create({
            data: {
              offerId: offer.id,
              slug,
              goCode,
              title: offer.title,
              excerpt: offer.title,
              copyText,
              price: offer.finalPrice,
              originalPrice: offer.originalPrice,
              discountPct: offer.discountPct,
              affiliateUrl: finalUrl,
              imageUrl: mainImage,
              urgency: isFlash ? 'HOJE' : 'NORMAL',
              nicheId,
              storeId,
              isActive: true,
            },
          });

          result.site = true;

          // Registrar no histórico para as métricas (canal SITE)
          try {
            await prisma.postHistory.create({
              data: {
                offerId: offer.id,
                channel: 'SITE',
                humorStyle: 'NEUTRO',
                uniqueHash: `manual-SITE-${offer.id}-${Date.now()}`,
                copyText: offer.title,
                externalId: slug,
              },
            });
          } catch (_e) { /* não bloquear o fluxo */ }
        } catch (siteErr: any) {
          console.warn('[AutoPublish] Falha ao publicar no site:', siteErr.message);
          result.site = false;
        }

        // ── 7. GERAR COPY COM IA ───────────────────────────────────────────
        const siteLink = goCode ? `${SITE_URL}/go/${goCode}` : SITE_URL;

        result.paymentMethod = paymentMethod;

        const copies = generateCopies({
          title: offer.title,
          price: Number(offer.finalPrice),
          oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
          discountPct: offer.discountPct ? Number(offer.discountPct) : 0,
          storeName: offer.store?.name,
          trackingUrl: finalUrl,
          siteUrl: siteLink,
          isFlash,
          flashMinutes,
          paymentMethod,
          couponCode: couponCode || undefined,
        });

        // ── 8. POSTAR NO TELEGRAM ─────────────────────────────────────────
        if (postTelegram && isTelegramConfigured()) {
          try {
            const telegramRes = await sendTelegramMessage({
              text: copies.telegram,
              imageUrl: mainImage || undefined,
            });
            result.telegram = { success: telegramRes.success, error: telegramRes.error };

            // Registrar no histórico para as métricas (canal TELEGRAM)
            if (telegramRes.success) {
              try {
                await prisma.postHistory.create({
                  data: {
                    offerId: offer.id,
                    channel: 'TELEGRAM',
                    humorStyle: 'NEUTRO',
                    uniqueHash: `manual-TELEGRAM-${offer.id}-${Date.now()}`,
                    copyText: copies.telegram,
                    externalId: (telegramRes as any).messageId ? String((telegramRes as any).messageId) : null,
                  },
                });
              } catch (_e) { /* não bloquear o fluxo */ }
            }
          } catch (e: any) {
            result.telegram = { success: false, error: e.message };
          }
        } else {
          result.telegram = { success: false, error: 'Telegram não configurado' };
        }

        // ── 9. POSTAR NO X (TWITTER) ──────────────────────────────────────
        if (postTwitter) {
          try {
            const twitterRes = await postOfferToTwitter({
              title: offer.title,
              originalPrice: offer.originalPrice ? Number(offer.originalPrice) : undefined,
              finalPrice: Number(offer.finalPrice),
              discount: offer.discountPct || undefined,
              affiliateUrl: finalUrl,
              storeName: offer.store?.name,
              imageUrl: mainImage || undefined,
              siteUrl: siteLink,
              preGeneratedCopy: copies.x,
            });
            result.twitter = { success: twitterRes.success, error: twitterRes.error };

            // Registrar no histórico para as métricas (canal TWITTER)
            if (twitterRes.success) {
              try {
                await prisma.postHistory.create({
                  data: {
                    offerId: offer.id,
                    channel: 'TWITTER',
                    humorStyle: 'NEUTRO',
                    uniqueHash: `manual-TWITTER-${offer.id}-${Date.now()}`,
                    copyText: copies.x,
                    externalId: (twitterRes as any).tweetId || null,
                  },
                });
              } catch (_e) { /* não bloquear o fluxo */ }
            }
          } catch (e: any) {
            result.twitter = { success: false, error: e.message };
          }
        }

        result.status = 'success';
        console.log(`[AutoPublish] ✅ Publicado: ${offer.title.substring(0, 50)}`);
      } catch (e: any) {
        result.error = e.message;
        console.error(`[AutoPublish] ❌ Erro em ${url.substring(0, 60)}:`, e.message);
      }

      results.push(result);

      // Pausa entre URLs para evitar rate limiting
      if (allItems.indexOf(allItems.find(i => i.url === url)!) < allItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    return reply.send({
      success: true,
      total: results.length,
      successCount,
      errorCount: results.length - successCount,
      results,
    });
  });

  /**
   * POST /api/auto-publish/scrape
   * Raspa os dados de um produto a partir de uma URL afiliada (sem publicar nada).
   * Usado pela página de Vídeos para obter título, preço e imagem do produto.
   */
  app.post('/scrape', { preHandler: [authGuard] }, async (request, reply) => {
    const { url } = request.body as { url?: string };

    if (!url || !url.trim()) {
      return reply.status(400).send({ error: 'URL é obrigatória.' });
    }

    try {
      new URL(url);
    } catch {
      return reply.status(400).send({ error: 'URL inválida.' });
    }

    try {
      const urlLower = url.toLowerCase();
      let store = 'unknown';
      if (urlLower.includes('mercadolivre') || urlLower.includes('mercadolibre')) store = 'mercadolivre';
      else if (urlLower.includes('magazineluiza') || urlLower.includes('magalu')) store = 'magalu';
      else if (urlLower.includes('amazon')) store = 'amazon';

      const isAmazonScrape = store === 'amazon';
      const httpResp = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          ...(isAmazonScrape && {
            'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'upgrade-insecure-requests': '1',
          }),
        },
        timeout: 30000,
      });

      const $ = cheerio.load(httpResp.data);

      // Detectar CAPTCHA da Amazon
      if (isAmazonScrape) {
        const pageText = $('body').text().toLowerCase();
        if (pageText.includes('robot check') || pageText.includes('captcha') ||
            $('form[action*="captcha"]').length > 0) {
          return reply.status(422).send({ error: 'A Amazon bloqueou o acesso automático. Tente novamente em alguns minutos.' });
        }
      }

      let productData: any;

      if (store === 'mercadolivre') productData = await scrapeMercadoLivreHTTP($);
      else if (store === 'magalu')   productData = await scrapeMagaluHTTP($);
      else if (store === 'amazon')   productData = await scrapeAmazonHTTP($);
      else                           productData = await scrapeGenericHTTP($);

      if (!productData.title?.trim()) {
        return reply.status(422).send({ error: 'Não foi possível extrair o título do produto.' });
      }
      if (!productData.finalPrice || productData.finalPrice <= 0) {
        return reply.status(422).send({ error: 'Não foi possível extrair o preço do produto.' });
      }

      // Validar desconto suspeito (>75% ou ratio >5x = provavelmente inflado)
      if (productData.originalPrice && productData.finalPrice > 0) {
        const ratio = productData.originalPrice / productData.finalPrice;
        const rawDiscount = Math.round(((productData.originalPrice - productData.finalPrice) / productData.originalPrice) * 100);
        if (ratio > 5 || rawDiscount > 75) {
          productData.originalPrice = null;
          productData.discount = 0;
        }
      }

      const discountPct = productData.discount ||
        (productData.originalPrice && productData.originalPrice > productData.finalPrice
          ? Math.round(((productData.originalPrice - productData.finalPrice) / productData.originalPrice) * 100)
          : 0);

      // Converter link Amazon em link de afiliado
      let scrapedAffiliateUrl = url;
      if (store === 'amazon') {
        try {
          const amazonUrl = new URL(url);
          const cleanUrl = new URL(`https://www.amazon.com.br${amazonUrl.pathname}`);
          cleanUrl.searchParams.set('tag', 'manudaspromoc-20');
          scrapedAffiliateUrl = cleanUrl.toString();
        } catch {
          scrapedAffiliateUrl = url.includes('?')
            ? `${url}&tag=manudaspromoc-20`
            : `${url}?tag=manudaspromoc-20`;
        }
      }

      return reply.send({
        success: true,
        title:         productData.title,
        finalPrice:    productData.finalPrice,
        originalPrice: productData.originalPrice || null,
        discountPct,
        mainImage:     productData.mainImage || null,
        images:        productData.images || [],
        affiliateUrl:  scrapedAffiliateUrl,
        store,
      });
    } catch (err: any) {
      console.error('[AutoPublish/scrape] Erro:', err.message);
      return reply.status(500).send({ error: `Falha ao acessar o produto: ${err.message}` });
    }
  });
}
