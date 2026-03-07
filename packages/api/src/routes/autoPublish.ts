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
import { uploadFromUrl, uploadFromBuffer } from '../services/cloudinary.js';
import { resolveNicheFromTitle } from '../services/nicheDetector.js';
import { generateFlashGif, isFlashGifAvailable } from '../services/flashGifGenerator.js';

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
}

export async function autoPublishRoutes(app: FastifyInstance) {
  /**
   * POST /api/auto-publish/publish
   * Recebe lista de URLs afiliadas, scrapa, cria oferta e posta automaticamente.
   */
  app.post('/publish', { preHandler: [authGuard] }, async (request, reply) => {
    const body = request.body as {
      urls: string[];
      postTelegram?: boolean;
      postTwitter?: boolean;
      isFlash?: boolean;
      flashMinutes?: number; // duração em minutos (ex: 180 = 3h)
    };
    const { urls, postTelegram = true, postTwitter = true, isFlash = false, flashMinutes = 180 } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return reply.status(400).send({ error: 'Forneça ao menos uma URL.' });
    }

    const validUrls = urls
      .map((u: string) => u.trim())
      .filter((u: string) => {
        try { new URL(u); return true; } catch { return false; }
      })
      .slice(0, 20);

    if (validUrls.length === 0) {
      return reply.status(400).send({ error: 'Nenhuma URL válida encontrada.' });
    }

    const results: PublishResult[] = [];

    for (const url of validUrls) {
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
        const httpResp = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
          },
          timeout: 30000,
        });

        const $ = cheerio.load(httpResp.data);
        let productData: any;

        if (store === 'mercadolivre') productData = await scrapeMercadoLivreHTTP($);
        else if (store === 'magalu') productData = await scrapeMagaluHTTP($);
        else if (store === 'amazon') productData = await scrapeAmazonHTTP($);
        else productData = await scrapeGenericHTTP($);

        if (!productData.title || productData.title.trim().length === 0) {
          result.error = 'Não foi possível extrair o título do produto.';
          results.push(result);
          continue;
        }

        if (!productData.finalPrice || productData.finalPrice <= 0) {
          result.error = 'Este tipo de anúncio (página de catálogo) requer entrada manual de preços. Use a página de Ofertas.';
          results.push(result);
          continue;
        }

        // Garantir affiliateUrl = URL original (com params de afiliado)
        productData.affiliateUrl = url;

        result.title = productData.title;
        result.finalPrice = productData.finalPrice;
        result.originalPrice = productData.originalPrice || null;

        // ── 3. CALCULAR DESCONTO ───────────────────────────────────────────
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
            affiliateUrl: url,
            imageUrl: mainImage,
            mainImage,
            images: productData.images || [],
            nicheId,
            storeId,
            urgency: isFlash ? 'HOJE' : 'NORMAL',
            promoType: isFlash ? 'RELAMPAGO' : 'NORMAL',
            expiresAt: flashExpiresAt,
            curationStatus: 'APPROVED',
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
          const discountLine = discountPct > 0
            ? `${discountPct}% de desconto!`
            : '';
          const copyText = `🔥 ${offer.title}\n\nDe R$ ${offer.originalPrice ?? offer.finalPrice} por R$ ${offer.finalPrice}${discountLine ? '\n\n' + discountLine : ''}`;

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
              affiliateUrl: url,
              imageUrl: mainImage,
              urgency: isFlash ? 'HOJE' : 'NORMAL',
              nicheId,
              storeId,
              isActive: true,
            },
          });

          result.site = true;
        } catch (siteErr: any) {
          console.warn('[AutoPublish] Falha ao publicar no site:', siteErr.message);
          result.site = false;
        }

        // ── 7. GERAR COPY COM IA ───────────────────────────────────────────
        // siteLink: usa URL do produto se goCode disponível, senão URL base
        // IMPORTANTE: sempre inclui o link do site independente do resultado
        const siteLink = goCode ? `${SITE_URL}/go/${goCode}` : SITE_URL;

        const copies = generateCopies({
          title: offer.title,
          price: Number(offer.finalPrice),
          oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
          discountPct: offer.discountPct ? Number(offer.discountPct) : 0,
          storeName: offer.store?.name,
          trackingUrl: url,
          siteUrl: siteLink,
          isFlash,
          flashMinutes,
        });

        // ── 8. POSTAR NO TELEGRAM ─────────────────────────────────────────
        if (postTelegram && isTelegramConfigured()) {
          try {
            const telegramRes = await sendTelegramMessage({
              text: copies.telegram,
              imageUrl: mainImage || undefined,
            });
            result.telegram = { success: telegramRes.success, error: telegramRes.error };
          } catch (e: any) {
            result.telegram = { success: false, error: e.message };
          }
        } else {
          result.telegram = { success: false, error: 'Telegram não configurado' };
        }

        // ── 9. POSTAR NO X (TWITTER) ──────────────────────────────────────
        if (postTwitter) {
          try {
            // Para ofertas relâmpago: gerar GIF animado com cronômetro
            let twitterImage = mainImage || undefined;
            if (isFlash && flashExpiresAt && isFlashGifAvailable()) {
              try {
                console.log('[AutoPublish] ⚡ Gerando GIF relâmpago...');
                const gifBuffer = await generateFlashGif({
                  title: offer.title,
                  finalPrice: Number(offer.finalPrice),
                  originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
                  discountPct: offer.discountPct || 0,
                  expiresAt: flashExpiresAt,
                  imageUrl: mainImage || null,
                });
                // Fazer upload do GIF para Cloudinary
                const gifUpload = await uploadFromBuffer(gifBuffer, {
                  folder: 'promo-platform/flash-gifs',
                  resourceType: 'image',
                  preserveAnimation: true,
                });
                if (gifUpload.success && gifUpload.url) {
                  twitterImage = gifUpload.url;
                  console.log('[AutoPublish] ✅ GIF relâmpago gerado:', gifUpload.url);
                }
              } catch (gifErr: any) {
                console.warn('[AutoPublish] ⚠️ Falha ao gerar GIF relâmpago, usando imagem normal:', gifErr.message);
              }
            }

            const twitterRes = await postOfferToTwitter({
              title: offer.title,
              originalPrice: offer.originalPrice ? Number(offer.originalPrice) : undefined,
              finalPrice: Number(offer.finalPrice),
              discount: offer.discountPct || undefined,
              affiliateUrl: url,
              storeName: offer.store?.name,
              imageUrl: twitterImage,
              siteUrl: siteLink,
              preGeneratedCopy: copies.x,
            });
            result.twitter = { success: twitterRes.success, error: twitterRes.error };
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
      if (validUrls.indexOf(url) < validUrls.length - 1) {
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

      const httpResp = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(httpResp.data);
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

      const discountPct = productData.discount ||
        (productData.originalPrice && productData.originalPrice > productData.finalPrice
          ? Math.round(((productData.originalPrice - productData.finalPrice) / productData.originalPrice) * 100)
          : 0);

      return reply.send({
        success: true,
        title:         productData.title,
        finalPrice:    productData.finalPrice,
        originalPrice: productData.originalPrice || null,
        discountPct,
        mainImage:     productData.mainImage || null,
        images:        productData.images || [],
        affiliateUrl:  url,
        store,
      });
    } catch (err: any) {
      console.error('[AutoPublish/scrape] Erro:', err.message);
      return reply.status(500).send({ error: `Falha ao acessar o produto: ${err.message}` });
    }
  });
}
