import { FastifyInstance } from 'fastify';
import { authGuard } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
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
    const body = request.body as { urls: string[]; postTelegram?: boolean; postTwitter?: boolean };
    const { urls, postTelegram = true, postTwitter = true } = body;

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

        const firstNiche = await prisma.niche.findFirst({ where: { isActive: true } });
        const nicheId = firstNiche?.id || null;

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
            urgency: 'NORMAL',
            curationStatus: 'APPROVED',
          },
          include: { store: { select: { name: true } } },
        });

        result.offerId = offer.id;
        result.site = true;

        // ── 7. GERAR COPY COM IA ───────────────────────────────────────────
        const copies = generateCopies({
          title: offer.title,
          price: Number(offer.finalPrice),
          oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
          discountPct: offer.discountPct ? Number(offer.discountPct) : 0,
          storeName: offer.store?.name,
          trackingUrl: url,
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
            const twitterRes = await postOfferToTwitter({
              title: offer.title,
              originalPrice: offer.originalPrice ? Number(offer.originalPrice) : undefined,
              finalPrice: Number(offer.finalPrice),
              discount: offer.discountPct || undefined,
              affiliateUrl: url,
              storeName: offer.store?.name,
              imageUrl: mainImage || undefined,
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
}
