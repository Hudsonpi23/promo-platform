import { FastifyInstance } from 'fastify';
import { authGuard } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { nanoid } from 'nanoid';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import {
  scrapeMercadoLivreHTTP,
  scrapeMagaluHTTP,
  scrapeAmazonHTTP,
  scrapeGenericHTTP,
} from './scraper-http.js';
import { sendTelegramMessage, sendTelegramPhoto, isTelegramConfigured } from '../services/telegram.js';
import { postOfferToTwitter, isTwitterConfigured, postTweetWithImage } from '../services/twitter.js';
import { generateCopies } from '../services/aiCopyGenerator.js';
import { isAmazonApiConfigured, getAmazonProductByUrl } from '../services/amazonApi.js';
import { uploadFromUrl } from '../services/cloudinary.js';
import { resolveNicheFromTitle } from '../services/nicheDetector.js';
import {
  searchMLViaCookies,
  buildReadyTelegramText,
  simplifyTitle,
  createOfficialAffiliateLink,
  generateAffiliateUrl,
  scrapeMLPrice,
  type MLBrowseProduct,
} from '../services/mlAffiliate.js';

const SITE_URL = process.env.SITE_URL || 'https://www.manu-promocoes.com.br';

// ==================== ANTI-REPETIÇÃO SERVER-SIDE ====================

interface PostedProduct {
  title: string;
  affiliateUrl: string;
  timestamp: number;
}

const postedToday: PostedProduct[] = [];
let lastCleanupDate = new Date().toDateString();

function cleanupPostedToday() {
  const today = new Date().toDateString();
  if (today !== lastCleanupDate) {
    postedToday.length = 0;
    lastCleanupDate = today;
    console.log('[Burst] Limpeza diária: lista de produtos postados resetada');
  }
}

function isDuplicate(product: MLBrowseProduct): boolean {
  cleanupPostedToday();
  const titleNorm = product.title.toLowerCase().trim();
  return postedToday.some(p =>
    p.title.toLowerCase().trim() === titleNorm ||
    (product.affiliateUrl && p.affiliateUrl === product.affiliateUrl)
  );
}

function markAsPosted(product: MLBrowseProduct) {
  cleanupPostedToday();
  postedToday.push({
    title: product.title,
    affiliateUrl: product.affiliateUrl || '',
    timestamp: Date.now(),
  });
}

// ==================== FRASES DE HUMOR (SERVER-SIDE) ====================

const HUMOR: Record<string, string[]> = {
  tv: [
    'Seu vizinho vai achar que você abriu um cinema 😂🍿',
    'Prepare a pipoca porque essa TV pede maratona 🍿😎',
    'Essa TV é tão boa que até o gato vai parar pra assistir 🐱📺',
    'Cinema em casa sem precisar sair do sofá 🎬🛋️',
  ],
  monitor: [
    'Seu setup vai ficar tão bonito que dá pra chorar 😭🖥️',
    'Produtividade ou game? Com esse monitor, os dois 🎮💼',
  ],
  fone: [
    'Vizinho barulhento? Problema resolvido 😂🎧',
    'Você vai esquecer que o mundo existe 🎧✨',
    'Com esse fone, até o silêncio faz playlist 🎶😂',
    'Modo "não me perturbe" ativado automaticamente 😎🎶',
  ],
  celular: [
    'Seu celular antigo mandou dizer que aceita aposentadoria 😂📱',
    'Foto boa assim nem precisa de filtro 📸😎',
    'Bateria que dura mais que segunda-feira 🔋😂',
    'Com esse Galaxy, até as selfies do meu gato vão ficar profissionais 📸🐱',
  ],
  notebook: [
    'Leve que nem papel, potente que nem foguete 🚀💻',
    'Home office com esse notebook é outra vida 😎💻',
    'Seu notebook atual acabou de pedir demissão 😂💻',
  ],
  game: [
    'Sua vida social pode sofrer efeitos colaterais 😂🎮',
    'Avisa a família que você vai sumir por uns dias 🎮😂',
    'Inimigo vai pedir desculpa quando ver esse setup 😎🕹️',
  ],
  cadeira: [
    'Sua coluna mandou dizer: "obrigada!" 😂🪑',
    'Conforto nível "não quero mais levantar" 🪑😎',
  ],
  cozinha: [
    'Chef Manu aprova essa oferta 👨‍🍳🔥',
    'Cozinhar com esse preço é receita de felicidade 😂🍳',
    'Até quem queima água vai querer testar 😂🔥',
  ],
  esporte: [
    'Faltou motivação? Faltou era esse preço 😂💪',
    'Seu eu fitness agradece essa oferta 🏃‍♂️🔥',
  ],
  pet: [
    'Seu pet merece e seu bolso também 🐶😂',
    'Mimado com desconto é o melhor tipo de mimado 🐱💕',
  ],
  beleza: [
    'Skincare com desconto é autocuidado inteligente 💆‍♀️💰',
    'Sua pele vai agradecer e seu bolso também ✨😂',
  ],
  moda: [
    'Estilo sem gastar uma fortuna? Toma! 😎👗',
    'Moda com desconto é outfit sem culpa 💃😂',
  ],
  geral: [
    'Esse preço tá tão bom que parece bug 😂🔥',
    'Corre que daqui a pouco alguém acorda 😂⚡',
    'Promoção assim eu até acordo mais cedo 😴💰',
    'Preço bom assim dá vontade de comprar dois 😂🛒',
    'Se tá barato eu não julgo, eu compro 😂🛍️',
    'Minha carteira pediu pra eu não mostrar isso 😂💸',
    'Esse desconto deveria ser crime 🚨😂',
    'Quem disse que coisa boa não cai do céu? 😂🎁',
  ],
};

function pickHumor(title: string): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const t = title.toLowerCase();
  if (t.includes('tv') || t.includes('televisão') || t.includes('smart tv')) return pick(HUMOR.tv);
  if (t.includes('monitor')) return pick(HUMOR.monitor);
  if (t.includes('fone') || t.includes('headset') || t.includes('earphone') || t.includes('airpod') || t.includes('jbl')) return pick(HUMOR.fone);
  if (t.includes('celular') || t.includes('iphone') || t.includes('galaxy') || t.includes('smartphone')) return pick(HUMOR.celular);
  if (t.includes('notebook') || t.includes('laptop') || t.includes('macbook')) return pick(HUMOR.notebook);
  if (t.includes('playstation') || t.includes('xbox') || t.includes('nintendo') || t.includes('game')) return pick(HUMOR.game);
  if (t.includes('cadeira') || t.includes('escritório')) return pick(HUMOR.cadeira);
  if (t.includes('air fryer') || t.includes('cafeteira') || t.includes('liquidificador') || t.includes('panela') || t.includes('fogão') || t.includes('geladeira') || t.includes('microondas')) return pick(HUMOR.cozinha);
  if (t.includes('tênis') || t.includes('bicicleta') || t.includes('esteira') || t.includes('halter') || t.includes('academia')) return pick(HUMOR.esporte);
  if (t.includes('pet') || t.includes('ração') || t.includes('cachorro') || t.includes('gato') || t.includes('arranhador')) return pick(HUMOR.pet);
  if (t.includes('skincare') || t.includes('sérum') || t.includes('protetor solar') || t.includes('perfume') || t.includes('escova')) return pick(HUMOR.beleza);
  if (t.includes('camiseta') || t.includes('bermuda') || t.includes('vestido') || t.includes('calça') || t.includes('bolsa') || t.includes('legging') || t.includes('roupa')) return pick(HUMOR.moda);
  return pick(HUMOR.geral);
}

// ==================== MODO ALTERNADO (niche/query) ====================

const NICHES_ROTATION = [
  'eletronicos', 'games', 'celulares', 'informatica', 'eletrodomesticos',
  'cozinha', 'moda', 'esportes', 'beleza', 'livros',
  'relogios', 'pet', 'ferramentas', 'alimentos', 'casa',
];

const QUERIES_ROTATION = [
  'smart tv 4k', 'fone bluetooth', 'playstation 5', 'echo dot alexa',
  'smartwatch', 'teclado mecânico gamer', 'kindle', 'cadeira gamer',
  'mouse gamer', 'controle ps5', 'headset gamer', 'notebook gamer',
  'tablet samsung', 'carregador turbo', 'câmera segurança wifi',
  'bermuda masculina', 'camiseta masculina', 'tênis nike masculino',
  'vestido feminino', 'calça legging feminina', 'bolsa feminina',
  'roupa academia feminina', 'tênis corrida', 'skincare facial',
  'sérum vitamina c', 'protetor solar facial', 'perfume importado feminino',
  'escova secadora', 'air fryer', 'cafeteira expresso', 'aspirador robô',
  'jogo de panelas', 'whey protein', 'creatina', 'ração golden cachorro',
];

let burstState = {
  lastMode: 'query' as 'niche' | 'query',
  nicheIndex: 0,
  queryIndex: 0,
  burstCountToday: 0,
};

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
  app.post('/publish', async (request, reply) => {
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

        // ── 2. DADOS DO PRODUTO ─────────────────────────────────────────────
        let productData: any;

        // Amazon: usar API oficial primeiro (sem CAPTCHA)
        if (store === 'amazon' && isAmazonApiConfigured()) {
          try {
            console.log('[AutoPublish] Amazon — usando Creators API...');
            const apiProduct = await getAmazonProductByUrl(url);
            if (apiProduct && apiProduct.title && apiProduct.finalPrice > 0) {
              productData = {
                title: apiProduct.title,
                finalPrice: apiProduct.finalPrice,
                originalPrice: apiProduct.originalPrice,
                discount: apiProduct.discountPct,
                imageUrl: apiProduct.images.primary || '',
                images: [apiProduct.images.primary, ...apiProduct.images.variants].filter(Boolean),
                affiliateUrl: apiProduct.affiliateUrl,
                source: 'amazon-creators-api',
              };
              console.log(`[AutoPublish] Amazon API OK: "${apiProduct.title}" — R$ ${apiProduct.finalPrice}`);
            }
          } catch (err: any) {
            console.error('[AutoPublish] Amazon API falhou, fallback para scraping:', err.message);
          }
        }

        // Fallback: HTTP scraping (para Amazon sem API ou outras lojas)
        if (!productData || !productData.title) {
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

          if (store === 'mercadolivre') productData = await scrapeMercadoLivreHTTP($);
          else if (store === 'magalu') productData = await scrapeMagaluHTTP($);
          else if (store === 'amazon') productData = await scrapeAmazonHTTP($);
          else productData = await scrapeGenericHTTP($);
        }

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
  app.post('/scrape', async (request, reply) => {
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

      let productData: any;

      // Amazon: usar API oficial primeiro
      if (store === 'amazon' && isAmazonApiConfigured()) {
        try {
          console.log('[Scrape] Amazon — usando Creators API...');
          const apiProduct = await getAmazonProductByUrl(url);
          if (apiProduct && apiProduct.title && apiProduct.finalPrice > 0) {
            productData = {
              title: apiProduct.title,
              finalPrice: apiProduct.finalPrice,
              originalPrice: apiProduct.originalPrice,
              discount: apiProduct.discountPct,
              imageUrl: apiProduct.images.primary || '',
              images: [apiProduct.images.primary, ...apiProduct.images.variants].filter(Boolean),
              affiliateUrl: apiProduct.affiliateUrl,
              source: 'amazon-creators-api',
            };
            console.log(`[Scrape] Amazon API OK: "${apiProduct.title}"`);
          }
        } catch (err: any) {
          console.error('[Scrape] Amazon API falhou, fallback para scraping:', err.message);
        }
      }

      // Fallback: HTTP scraping
      if (!productData || !productData.title) {
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

        if (isAmazonScrape) {
          const pageText = $('body').text().toLowerCase();
          if (pageText.includes('robot check') || pageText.includes('captcha') ||
              $('form[action*="captcha"]').length > 0) {
            return reply.status(422).send({ error: 'A Amazon bloqueou o acesso automático. Tente novamente em alguns minutos.' });
          }
        }

        if (store === 'mercadolivre') productData = await scrapeMercadoLivreHTTP($);
        else if (store === 'magalu')   productData = await scrapeMagaluHTTP($);
        else if (store === 'amazon')   productData = await scrapeAmazonHTTP($);
        else                           productData = await scrapeGenericHTTP($);
      }

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

  // ==================== POST-URL — Manu escolhe o produto, servidor faz o resto ====================

  /**
   * POST /api/auto-publish/post-url
   * Manu envia a URL do produto do Mercado Livre.
   * O servidor: extrai dados, gera link afiliado, gera humor, posta no X e Telegram.
   *
   * Body: { secret, url, humor? }
   */
  app.post('/post-url', async (request, reply) => {
    const schema = z.object({
      secret: z.string(),
      url: z.string().min(1),
      humor: z.string().optional(),
    });

    try {
      const body = schema.parse(request.body);

      if (body.secret !== 'promo2026') {
        return reply.status(403).send({ success: false, error: 'Invalid secret' });
      }

      let productUrl = body.url.trim();

      console.log(`[Post-URL] Recebido: ${productUrl.substring(0, 80)}`);

      // Resolver redirecionamentos (meli.la, mercadolivre short links, etc)
      try {
        const headResp = await axios.head(productUrl, {
          maxRedirects: 5,
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        if (headResp.request?.res?.responseUrl) {
          productUrl = headResp.request.res.responseUrl;
        }
      } catch {
        try {
          const getResp = await axios.get(productUrl, {
            maxRedirects: 5,
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          });
          if (getResp.request?.res?.responseUrl) {
            productUrl = getResp.request.res.responseUrl;
          }
        } catch { /* use original url */ }
      }

      const cleanUrl = productUrl.split('?')[0];
      console.log(`[Post-URL] URL resolvida: ${cleanUrl.substring(0, 80)}`);

      // 1. Extrair dados do produto
      const detail = await scrapeMLPrice(cleanUrl);

      if (!detail.title || !detail.price) {
        return reply.status(422).send({
          success: false,
          error: 'Não foi possível extrair dados do produto. Verifique a URL.',
          url: cleanUrl,
        });
      }

      // 2. Gerar link de afiliado
      let affiliateUrl: string;
      try {
        const official = await createOfficialAffiliateLink(cleanUrl);
        affiliateUrl = official?.shortUrl || generateAffiliateUrl(cleanUrl);
      } catch {
        affiliateUrl = generateAffiliateUrl(cleanUrl);
      }

      if (!affiliateUrl || !affiliateUrl.includes('meli.la')) {
        affiliateUrl = generateAffiliateUrl(cleanUrl);
      }

      // 3. Extrair imagem do HTML
      let imageUrl = '';
      try {
        const pageResp = await axios.get(cleanUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9',
          },
        });
        const imgMatch = pageResp.data.match(/"pictures":\s*\[\s*\{"url":"([^"]+)"/);
        if (imgMatch) {
          imageUrl = imgMatch[1].replace('http://', 'https://');
        } else {
          const ogMatch = pageResp.data.match(/property="og:image"\s+content="([^"]+)"/);
          if (ogMatch) {
            imageUrl = ogMatch[1].replace('http://', 'https://');
          }
        }
      } catch { /* sem imagem */ }

      // 4. Montar couponText
      let couponText: string | null = null;
      if (detail.coupon) {
        if (detail.coupon.percentage) {
          couponText = `Cupom ${detail.coupon.percentage}% OFF`;
        } else if (detail.coupon.savings) {
          couponText = `Cupom R$${detail.coupon.savings.toFixed(0)} OFF`;
        }
      }

      // 5. Montar o produto como MLBrowseProduct
      const product: MLBrowseProduct = {
        title: detail.title,
        price: detail.price,
        originalPrice: detail.originalPrice,
        discountPercent: detail.discountPercent,
        imageUrl,
        productUrl: cleanUrl,
        freeShipping: false, // scrapeMLPrice não extrai isso
        couponText,
        pixDiscount: detail.pix?.discountPercent || null,
        pixPrice: detail.pix?.price || null,
        installmentQty: detail.installments?.quantity || null,
        installmentAmount: detail.installments?.amount || null,
        installmentNoInterest: detail.installments?.noInterest || false,
        installmentTotalPrice: detail.installments?.totalPrice || null,
        affiliateUrl,
      };

      // Anti-repetição
      if (isDuplicate(product)) {
        return reply.status(409).send({
          success: false,
          error: 'Este produto já foi postado hoje',
          title: simplifyTitle(product.title),
        });
      }

      // 6. Gerar humor
      const humor = body.humor || pickHumor(product.title);

      console.log(`[Post-URL] Postando: "${simplifyTitle(product.title)}" (${product.discountPercent}% OFF) | Humor: ${humor}`);

      // 7. Postar no X/Twitter
      let twitterResult: { success: boolean; error?: string; tweetId?: string } = { success: false, error: 'Twitter não configurado' };
      if (isTwitterConfigured()) {
        try {
          const titleShort = simplifyTitle(product.title);
          const parts: string[] = [humor, ''];
          parts.push(titleShort);

          if (product.originalPrice && product.price && product.originalPrice > product.price) {
            const pct = product.pixDiscount || product.discountPercent;
            const pixSuffix = product.pixDiscount ? ' no Pix' : '';
            parts.push(`De R$${product.originalPrice.toFixed(2)} por R$${product.price.toFixed(2)} (-${pct}%${pixSuffix})`);
          } else if (product.price) {
            parts.push(`Por R$${product.price.toFixed(2)}`);
          }

          if (product.installmentQty && product.installmentAmount) {
            const noInterest = product.installmentNoInterest ? ' sem juros' : '';
            parts.push(`ou ${product.installmentQty}x de R$${product.installmentAmount.toFixed(2)}${noInterest}`);
          }

          if (product.freeShipping) parts.push('Frete Grátis ✅');
          if (product.couponText) parts.push(`🏷️ ${product.couponText}`);

          parts.push('');
          parts.push(`👉 ${product.affiliateUrl}`);

          let tweetText = parts.join('\n');
          if (tweetText.length > 280) {
            tweetText = tweetText.substring(0, 277) + '...';
          }

          const res = imageUrl
            ? await postTweetWithImage(tweetText, imageUrl)
            : { success: false, error: 'Sem imagem' };

          twitterResult = { success: res.success, error: res.error, tweetId: (res as any).tweetId };
        } catch (e: any) {
          twitterResult = { success: false, error: e.message };
        }
      }

      // 8. Postar no Telegram
      let telegramResult: { success: boolean; error?: string; messageId?: number } = { success: false, error: 'Telegram não configurado' };
      if (isTelegramConfigured()) {
        try {
          const telegramText = buildReadyTelegramText(product, humor);
          const res = await sendTelegramPhoto(imageUrl, telegramText);
          telegramResult = { success: res.success, error: res.error, messageId: res.messageId || res.photoMessageId };
        } catch (e: any) {
          telegramResult = { success: false, error: e.message };
        }
      }

      markAsPosted(product);

      return reply.send({
        success: true,
        title: simplifyTitle(product.title),
        price: product.price,
        originalPrice: product.originalPrice,
        discountPercent: product.discountPercent,
        affiliateUrl,
        humor,
        couponText,
        twitter: twitterResult,
        telegram: telegramResult,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ success: false, error: 'Dados inválidos', details: error.errors });
      }
      console.error('[Post-URL] Erro:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ==================== BURST — Publicação automática server-side ====================

  /**
   * POST /api/auto-publish/burst
   * Endpoint único que faz tudo: busca produtos no ML, filtra duplicados,
   * posta no X e Telegram, registra anti-repetição.
   * A Manu só precisa chamar este endpoint.
   *
   * Body: { secret, mode?, niche?, query?, count? }
   * - mode: "niche" | "query" | "auto" (auto = alterna automaticamente)
   * - count: quantos produtos postar (default 2)
   */
  app.post('/burst', async (request, reply) => {
    const schema = z.object({
      secret: z.string(),
      mode: z.enum(['niche', 'query', 'auto']).default('auto'),
      niche: z.string().optional(),
      query: z.string().optional(),
      count: z.number().min(1).max(5).default(2),
    });

    try {
      const body = schema.parse(request.body);

      if (body.secret !== 'promo2026') {
        return reply.status(403).send({ success: false, error: 'Invalid secret' });
      }

      cleanupPostedToday();

      // Determinar modo e parâmetro de busca
      let searchMode: 'niche' | 'query';
      let searchNiche: string | undefined;
      let searchQuery: string | undefined;

      if (body.mode === 'auto') {
        searchMode = burstState.lastMode === 'niche' ? 'query' : 'niche';
      } else {
        searchMode = body.mode;
      }

      if (searchMode === 'niche') {
        searchNiche = body.niche || NICHES_ROTATION[burstState.nicheIndex % NICHES_ROTATION.length];
        burstState.nicheIndex = (burstState.nicheIndex + 1) % NICHES_ROTATION.length;
      } else {
        searchQuery = body.query || QUERIES_ROTATION[burstState.queryIndex % QUERIES_ROTATION.length];
        burstState.queryIndex = (burstState.queryIndex + 1) % QUERIES_ROTATION.length;
      }

      burstState.lastMode = searchMode;
      burstState.burstCountToday++;

      console.log(`[Burst] #${burstState.burstCountToday} | Modo: ${searchMode} | ${searchMode === 'niche' ? `Nicho: ${searchNiche}` : `Query: ${searchQuery}`} | Count: ${body.count}`);

      // 1. Buscar produtos
      const browseResult = await searchMLViaCookies({
        query: searchQuery,
        niche: searchNiche,
        dealsOnly: true,
        limit: 10,
      });

      if (!browseResult.success || browseResult.products.length === 0) {
        return reply.send({
          success: false,
          error: 'Nenhum produto encontrado',
          mode: searchMode,
          searchParam: searchNiche || searchQuery,
          burstNumber: burstState.burstCountToday,
        });
      }

      // 1b. Gerar links de afiliado para os produtos
      const productsWithLinks = await Promise.all(
        browseResult.products.map(async (p) => {
          if (!p.productUrl) return p;
          try {
            const official = await createOfficialAffiliateLink(p.productUrl);
            return {
              ...p,
              affiliateUrl: official?.shortUrl || generateAffiliateUrl(p.productUrl),
              officialLink: official ? { shortUrl: official.shortUrl, longUrl: official.longUrl } : null,
            };
          } catch {
            return { ...p, affiliateUrl: generateAffiliateUrl(p.productUrl) };
          }
        })
      );

      // 2. Filtrar duplicados e selecionar os melhores
      const candidates = productsWithLinks
        .filter(p => !isDuplicate(p))
        .filter(p => p.affiliateUrl && p.affiliateUrl.includes('meli.la'))
        .filter(p => p.imageUrl)
        .sort((a, b) => b.discountPercent - a.discountPercent)
        .slice(0, body.count);

      if (candidates.length === 0) {
        return reply.send({
          success: false,
          error: 'Todos os produtos já foram postados hoje (duplicados)',
          mode: searchMode,
          searchParam: searchNiche || searchQuery,
          totalFound: browseResult.products.length,
          burstNumber: burstState.burstCountToday,
        });
      }

      console.log(`[Burst] ${candidates.length} produto(s) selecionados de ${browseResult.products.length} encontrados`);

      // 3. Postar cada produto
      const results: Array<{
        title: string;
        affiliateUrl: string;
        humor: string;
        discountPercent: number;
        price: number | null;
        twitter: { success: boolean; error?: string; tweetId?: string };
        telegram: { success: boolean; error?: string; messageId?: number };
      }> = [];

      for (let i = 0; i < candidates.length; i++) {
        const product = candidates[i];
        const humor = pickHumor(product.title);

        console.log(`[Burst] Postando ${i + 1}/${candidates.length}: "${simplifyTitle(product.title)}" (${product.discountPercent}% OFF)`);

        // 3a. Postar no X/Twitter
        let twitterResult: { success: boolean; error?: string; tweetId?: string } = { success: false, error: 'Twitter não configurado' };
        if (isTwitterConfigured()) {
          try {
            const titleShort = simplifyTitle(product.title);
            const parts: string[] = [humor, ''];
            parts.push(titleShort);

            if (product.originalPrice && product.price && product.originalPrice > product.price) {
              const pct = product.pixDiscount || product.discountPercent;
              const pixSuffix = product.pixDiscount ? ' no Pix' : '';
              parts.push(`De R$${product.originalPrice.toFixed(2)} por R$${product.price.toFixed(2)} (-${pct}%${pixSuffix})`);
            } else if (product.price) {
              parts.push(`Por R$${product.price.toFixed(2)}`);
            }

            if (product.installmentQty && product.installmentAmount) {
              const noInterest = product.installmentNoInterest ? ' sem juros' : '';
              parts.push(`ou ${product.installmentQty}x de R$${product.installmentAmount.toFixed(2)}${noInterest}`);
            }

            if (product.freeShipping) parts.push('Frete Grátis ✅');
            if (product.couponText) parts.push(`🏷️ ${product.couponText}`);

            parts.push('');
            parts.push(`👉 ${product.affiliateUrl}`);

            let tweetText = parts.join('\n');
            if (tweetText.length > 280) {
              tweetText = tweetText.substring(0, 277) + '...';
            }

            const res = product.imageUrl
              ? await postTweetWithImage(tweetText, product.imageUrl)
              : { success: false, error: 'Sem imagem' };

            twitterResult = { success: res.success, error: res.error, tweetId: (res as any).tweetId };
          } catch (e: any) {
            twitterResult = { success: false, error: e.message };
          }
        }

        // 3b. Postar no Telegram
        let telegramResult: { success: boolean; error?: string; messageId?: number } = { success: false, error: 'Telegram não configurado' };
        if (isTelegramConfigured()) {
          try {
            const telegramText = buildReadyTelegramText(product, humor);
            const res = await sendTelegramPhoto(product.imageUrl, telegramText);
            telegramResult = { success: res.success, error: res.error, messageId: res.messageId || res.photoMessageId };
          } catch (e: any) {
            telegramResult = { success: false, error: e.message };
          }
        }

        markAsPosted(product);

        results.push({
          title: simplifyTitle(product.title),
          affiliateUrl: product.affiliateUrl || '',
          humor,
          discountPercent: product.discountPercent,
          price: product.price,
          twitter: twitterResult,
          telegram: telegramResult,
        });

        // Pausa entre produtos (não após o último)
        if (i < candidates.length - 1) {
          console.log(`[Burst] Aguardando 60s antes do próximo produto...`);
          await new Promise(resolve => setTimeout(resolve, 60_000));
        }
      }

      const successCount = results.filter(r => r.twitter.success || r.telegram.success).length;

      console.log(`[Burst] Rajada #${burstState.burstCountToday} concluída: ${successCount}/${results.length} produtos postados`);

      return reply.send({
        success: true,
        burstNumber: burstState.burstCountToday,
        mode: searchMode,
        searchParam: searchNiche || searchQuery,
        nextMode: searchMode === 'niche' ? 'query' : 'niche',
        nextParam: searchMode === 'niche'
          ? QUERIES_ROTATION[burstState.queryIndex % QUERIES_ROTATION.length]
          : NICHES_ROTATION[burstState.nicheIndex % NICHES_ROTATION.length],
        productsFound: browseResult.products.length,
        productsPosted: results.length,
        results,
        postedTodayTotal: postedToday.length,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ success: false, error: 'Dados inválidos', details: error.errors });
      }
      console.error('[Burst] Erro:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/auto-publish/burst/status
   * Retorna estado atual do sistema de burst (para diagnóstico)
   */
  app.get('/burst/status', async (_request, reply) => {
    cleanupPostedToday();
    return reply.send({
      success: true,
      burstState: {
        lastMode: burstState.lastMode,
        nicheIndex: burstState.nicheIndex,
        currentNiche: NICHES_ROTATION[burstState.nicheIndex % NICHES_ROTATION.length],
        queryIndex: burstState.queryIndex,
        currentQuery: QUERIES_ROTATION[burstState.queryIndex % QUERIES_ROTATION.length],
        burstCountToday: burstState.burstCountToday,
      },
      postedToday: postedToday.map(p => ({
        title: p.title,
        affiliateUrl: p.affiliateUrl,
        postedAt: new Date(p.timestamp).toISOString(),
      })),
      postedTodayCount: postedToday.length,
    });
  });
}
