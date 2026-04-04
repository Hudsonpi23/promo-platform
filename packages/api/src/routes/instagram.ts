/**
 * Instagram Routes
 *
 * Endpoints para o pipeline inteligente de carrosséis/reels.
 *
 * POST /api/instagram/enqueue/:offerId   → IA avalia + enfileira
 * POST /api/instagram/enqueue/batch      → Enfileira múltiplas ofertas
 * GET  /api/instagram/jobs               → Lista jobs (com filtro)
 * GET  /api/instagram/jobs/:jobId        → Detalhes de um job
 * DELETE /api/instagram/jobs/:jobId      → Cancela job pendente
 * POST /api/instagram/carousel/preview/:offerId → Preview sem publicar
 * GET  /api/instagram/accounts           → Contas Postfor.me
 * GET  /api/instagram/metrics            → Resumo de performance
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import axios from 'axios';
import { authGuard } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { enqueueInstagramJob, listJobs, cancelJob } from '../services/instagramQueue.js';
import { analyzeOfferForInstagram } from '../services/instagramAI.js';
import { generateCarousel } from '../services/instagramCarousel.js';
import { listConnectedAccounts, generateInstagramCaption, publishCarousel, publishStory } from '../services/postforme.js';
import { uploadFromBuffer } from '../services/cloudinary.js';
import { getAmazonProductByUrl } from '../services/amazonApi.js';
import { InstagramJobStatus } from '@prisma/client';
import { getMLToken } from './mlAuth.js';
import { scrapeMLPrice } from '../services/mlAffiliate.js';

const ACCOUNT_ID = () => process.env.POSTFORME_INSTAGRAM_ACCOUNT_ID || '';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getOffer(id: string) {
  return prisma.offer.findUnique({
    where: { id },
    include: { niche: true, store: true },
  });
}

function extractMLItemId(url: string): string | null {
  // Remove segmentos /p/MLB... (catalog IDs) para não confundi-los com item IDs
  const withoutCatalog = url.replace(/\/p\/MLB\d+/gi, '');
  const match = withoutCatalog.match(/MLB-?(\d+)/i);
  return match ? `MLB${match[1]}` : null;
}

function extractMLProductId(url: string): string | null {
  const match = url.match(/\/p\/(MLB\w+)/i);
  return match ? match[1] : null;
}

/** Busca ou cria Store pelo slug */
async function upsertStore(name: string, slug: string) {
  return prisma.store.upsert({
    where: { slug },
    update: {},
    create: { name, slug },
  });
}

/** Busca ou cria Niche pelo slug */
async function upsertNiche(name: string, slug: string, icon = '🛍️') {
  return prisma.niche.upsert({
    where: { slug },
    update: {},
    create: { name, slug, icon },
  });
}

/** Busca ou cria Offer pela affiliateUrl (canonicalUrl não é unique no schema) */
async function findOrCreateOffer(productData: any, storeId: string, nicheId: string) {
  const existing = await prisma.offer.findFirst({
    where: { affiliateUrl: productData.affiliateUrl },
  });
  if (existing) {
    return prisma.offer.update({
      where: { id: existing.id },
      data: {
        title: productData.title,
        finalPrice: productData.finalPrice,
        originalPrice: productData.originalPrice ?? undefined,
        discountPct: productData.discountPct ?? 0,
        imageUrl: productData.imageUrl,
        mainImage: productData.imageUrl,
        status: 'ACTIVE',
      },
    });
  }
  return prisma.offer.create({
    data: {
      title: productData.title,
      finalPrice: productData.finalPrice,
      originalPrice: productData.originalPrice ?? undefined,
      discountPct: productData.discountPct ?? 0,
      affiliateUrl: productData.affiliateUrl,
      canonicalUrl: productData.affiliateUrl,
      imageUrl: productData.imageUrl,
      mainImage: productData.imageUrl,
      nicheId,
      storeId,
      status: 'ACTIVE',
    },
  });
}

/** Busca dados de produto via URL do Mercado Livre */
async function fetchMLProduct(url: string) {
  const affiliateUrl = url; // ML: usar URL exatamente como recebida — afiliado gerado pelo portal oficial do ML
  const itemId = extractMLItemId(url);
  const catalogId = extractMLProductId(url);
  const headers: Record<string, string> = { Accept: 'application/json' };
  const tok = getMLToken();
  if (tok?.access_token) headers['Authorization'] = `Bearer ${tok.access_token}`;

  let info: any = null;

  if (catalogId) {
    // Playwright scraping = fonte de verdade para o preço (o que o usuário vê no ML)
    const scraped = await scrapeMLPrice(url);

    let catalogTitle: string | null = scraped.title;
    let thumb = '';
    let listingData: any = null;

    try {
      const [prodRes, itemsRes] = await Promise.all([
        axios.get(`https://api.mercadolibre.com/products/${catalogId}`, { timeout: 8000, headers }),
        axios.get(`https://api.mercadolibre.com/products/${catalogId}/items?limit=1`, { timeout: 8000, headers }),
      ]);
      const prod = prodRes.data;
      listingData = itemsRes.data.results?.[0];
      catalogTitle = catalogTitle || prod.name || listingData?.title;
      thumb = (prod.pictures?.[0]?.url || listingData?.thumbnail || '').replace('http://', 'https://');
    } catch {
      console.warn('[Instagram fetchMLProduct] Catálogo API falhou, usando scraping');
    }

    const price = scraped.price ?? listingData?.price ?? null;
    const origPrice = scraped.originalPrice ?? listingData?.original_price ?? null;

    if (price) {
      info = {
        title: catalogTitle || 'Produto Mercado Livre',
        finalPrice: price,
        originalPrice: origPrice,
        discountPct: origPrice && origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0,
        imageUrl: thumb,
        affiliateUrl,
        source: 'mercadolivre',
        coupon: scraped.coupon || null,
      };
    }
  }

  if (!info && itemId) {
    try {
      const res = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, { timeout: 8000, headers });
      const item = res.data;
      const price = item.price;
      const origPrice = item.original_price ?? null;
      info = {
        title: item.title,
        finalPrice: price,
        originalPrice: origPrice,
        discountPct: origPrice && origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0,
        imageUrl: (item.thumbnail || '').replace('http://', 'https://'),
        affiliateUrl,
        source: 'mercadolivre',
      };
    } catch { /* nada */ }
  }

  return info;
}

// ── Routes ─────────────────────────────────────────────────────────────────────

export async function instagramRoutes(fastify: FastifyInstance) {

  // ── POST /api/instagram/from-url ─────────────────────────────────────────────
  // Cola URL → busca produto → cria/atualiza Offer no DB → enfileira InstagramJob
  fastify.post(
    '/from-url',
    { preHandler: authGuard },
    async (req: FastifyRequest<{ Body: { url: string; accountId?: string; theme?: string } }>, reply) => {
      const { url, accountId, theme } = req.body || {};
      if (!url) return reply.status(400).send({ error: 'URL obrigatória' });

      const accountIdToUse = accountId || ACCOUNT_ID();
      if (!accountIdToUse) {
        return reply.status(400).send({ error: 'POSTFORME_INSTAGRAM_ACCOUNT_ID não configurado' });
      }

      const isAmazon = url.includes('amazon.com') || url.includes('amzn.to') || url.includes('amzn.com');
      const isML = url.includes('mercadolivre.com') || url.includes('mercadolibre.com');

      if (!isAmazon && !isML) {
        return reply.status(400).send({ error: 'Use uma URL da Amazon ou do Mercado Livre' });
      }

      let productData: any = null;

      try {
        if (isAmazon) {
          const prod = await getAmazonProductByUrl(url);
          if (prod) {
            productData = {
              title: prod.title,
              finalPrice: prod.finalPrice,
              originalPrice: (prod as any).originalPrice ?? null,
              discountPct: (prod as any).discountPct ?? 0,
              imageUrl: prod.images?.primary ?? null,
              affiliateUrl: prod.affiliateUrl ?? url,
              source: 'amazon',
            };
          }
        } else {
          productData = await fetchMLProduct(url);
        }
      } catch (err: any) {
        return reply.status(500).send({ error: `Erro ao buscar produto: ${err.message}` });
      }

      if (!productData || !productData.title) {
        return reply.status(404).send({ error: 'Produto não encontrado. Verifique a URL e tente novamente.' });
      }

      if (!productData.finalPrice || productData.finalPrice <= 0) {
        return reply.status(400).send({ error: 'Preço do produto não encontrado na URL.' });
      }

      // Garante Store e Niche no banco
      const storeName = productData.source === 'amazon' ? 'Amazon' : 'Mercado Livre';
      const storeSlug = productData.source === 'amazon' ? 'amazon' : 'mercadolivre';
      const [store, niche] = await Promise.all([
        upsertStore(storeName, storeSlug),
        upsertNiche('Geral', 'geral', '🛍️'),
      ]);

      // Cria ou atualiza Offer (deduplica por affiliateUrl)
      const offer = await findOrCreateOffer(productData, store.id, niche.id);

      // Enfileira job
      const jobId = await enqueueInstagramJob({ offerId: offer.id, accountId: accountIdToUse, triggeredBy: 'manual', carouselTheme: (theme as any) || 'dark' });

      return reply.send({
        success: true,
        jobId,
        offerId: offer.id,
        product: {
          title: productData.title,
          finalPrice: productData.finalPrice,
          originalPrice: productData.originalPrice,
          discountPct: productData.discountPct,
          imageUrl: productData.imageUrl,
          source: productData.source,
        },
      });
    },
  );

  // ── POST /api/instagram/publish-now ──────────────────────────────────────────
  // Publicação MANUAL direta. Aceita slideUrls pré-gerados para evitar duplicação.
  fastify.post(
    '/publish-now',
    { preHandler: authGuard },
    async (req: FastifyRequest<{ Body: { url: string; caption?: string; slideUrls?: string[]; accountId?: string; theme?: string; imageUrl?: string; couponCode?: string; couponType?: 'percent' | 'fixed'; couponDiscountPct?: number; couponFixedValue?: number; couponMaxSavings?: number } }>, reply) => {
      try {
        const { url, caption: customCaption, slideUrls: preGenerated, accountId, theme, imageUrl: customImageUrl, couponCode, couponType, couponDiscountPct, couponFixedValue, couponMaxSavings } = req.body || {};
        if (!url) return reply.status(400).send({ error: 'URL obrigatória' });

        const accountIdToUse = accountId || ACCOUNT_ID();
        if (!accountIdToUse) {
          return reply.status(400).send({ error: 'Conta Instagram não configurada. Configure POSTFORME_INSTAGRAM_ACCOUNT_ID no Render.' });
        }

        const isAmazon = url.includes('amazon.com') || url.includes('amzn');
        const isML = url.includes('mercadolivre.com') || url.includes('mercadolibre.com');
        if (!isAmazon && !isML) {
          return reply.status(400).send({ error: 'Use uma URL da Amazon ou do Mercado Livre' });
        }

        // 1. Buscar dados do produto
        let productData: any = null;
        if (isAmazon) {
          const prod = await getAmazonProductByUrl(url);
          if (prod) productData = {
            title: prod.title,
            finalPrice: prod.finalPrice,
            originalPrice: (prod as any).originalPrice ?? null,
            discountPct: (prod as any).discountPct ?? 0,
            imageUrl: prod.images?.primary ?? null,
            affiliateUrl: prod.affiliateUrl ?? url,
          };
        } else {
          productData = await fetchMLProduct(url);
        }

        if (!productData?.title) {
          return reply.status(404).send({ error: 'Produto não encontrado. Verifique a URL.' });
        }

        // 2. Slides: usa os pré-gerados ou gera agora
        let slideUrls: string[] = [];
        if (preGenerated && preGenerated.length >= 2) {
          slideUrls = preGenerated;
        } else {
          const carouselResult = await generateCarousel({
            title: productData.title,
            finalPrice: Number(productData.finalPrice),
            originalPrice: productData.originalPrice ? Number(productData.originalPrice) : null,
            discountPct: productData.discountPct ?? 0,
            imageUrl: customImageUrl || productData.imageUrl,
            fallbackImageUrl: customImageUrl ? productData.imageUrl : null,
            affiliateUrl: productData.affiliateUrl,
            theme: (theme as any) || 'dark',
            couponCode: couponCode || null,
            couponType: couponType ?? null,
            couponDiscountPct: couponDiscountPct ?? null,
            couponFixedValue: couponFixedValue ?? null,
            couponMaxSavings: couponMaxSavings ?? null,
          });
          if (!carouselResult.success || !carouselResult.slideUrls?.length) {
            return reply.status(500).send({ error: `Falha ao gerar slides: ${carouselResult.error || 'erro desconhecido'}` });
          }
          slideUrls = carouselResult.slideUrls;
        }

        // 3. Caption
        const caption = customCaption?.trim() || generateInstagramCaption({
          title: productData.title,
          finalPrice: Number(productData.finalPrice),
          originalPrice: productData.originalPrice ? Number(productData.originalPrice) : null,
          discountPct: productData.discountPct ?? 0,
          affiliateUrl: productData.affiliateUrl,
          couponCode: couponCode || null,
          couponType: couponType ?? null,
          couponDiscountPct: couponDiscountPct ?? null,
          couponFixedValue: couponFixedValue ?? null,
          couponMaxSavings: couponMaxSavings ?? null,
        });

        // 4. Publicar via Postfor.me — ponto crítico, sem try/catch aqui
        console.log(`[publish-now] Publicando para conta ${accountIdToUse} com ${slideUrls.length} slides`);
        const publishResult = await publishCarousel({
          caption,
          slideUrls,
          instagramAccountId: accountIdToUse,
        });

        if (!publishResult.success) {
          return reply.status(502).send({ error: `Postfor.me: ${publishResult.error || 'falha desconhecida'}` });
        }

        // ✅ POST PUBLICADO COM SUCESSO — retorna ao frontend IMEDIATAMENTE
        // O salvamento no banco é feito em background e não pode afetar a resposta.
        // Isso evita o bug: "plataforma diz erro mas post foi ao ar"
        reply.send({
          success: true,
          slideUrls,
          postId: publishResult.postId,
          caption,
        });

        // 5. Salvar no banco em background (falha silenciosa — não bloqueia o usuário)
        try {
          const [store, niche] = await Promise.all([
            upsertStore(isAmazon ? 'Amazon' : 'Mercado Livre', isAmazon ? 'amazon' : 'mercadolivre'),
            upsertNiche('Geral', 'geral', '🛍️'),
          ]);
          const offer = await findOrCreateOffer(productData, store.id, niche.id);
          await prisma.instagramJob.create({
            data: {
              offerId: offer.id,
              status: 'SUCCESS',
              format: 'CAROUSEL',
              slideUrls,
              captionUsed: caption,
              postformePostId: publishResult.postId,
              postformeStatus: publishResult.status,
              accountId: accountIdToUse,
              triggeredBy: 'manual',
              publishedAt: new Date(),
              attempts: 1,
              carouselTheme: (theme as string) || 'dark',
            },
          });
          console.log(`[publish-now] ✅ Job salvo no banco (postId: ${publishResult.postId})`);
        } catch (dbErr: any) {
          // Não propaga o erro — o post JÁ foi publicado com sucesso
          console.error('[publish-now] ⚠️  Falha ao salvar no banco (post já publicado):', dbErr.message);
        }
      } catch (err: any) {
        console.error('[publish-now] erro:', err);
        return reply.status(500).send({ error: err.message || 'Erro interno ao publicar' });
      }
    },
  );

  // ── POST /api/instagram/preview-slides ───────────────────────────────────────
  // Gera slides a partir de uma URL e retorna as imagens + caption padrão.
  // Não publica — apenas para o operador ver antes de confirmar.
  fastify.post(
    '/preview-slides',
    { preHandler: authGuard },
    async (req: FastifyRequest<{ Body: { url: string; theme?: string; imageUrl?: string; couponCode?: string; couponType?: 'percent' | 'fixed'; couponDiscountPct?: number; couponFixedValue?: number; couponMaxSavings?: number } }>, reply) => {
      const { url, theme, imageUrl: customImageUrl, couponCode, couponType, couponDiscountPct, couponFixedValue, couponMaxSavings } = req.body || {};
      if (!url) return reply.status(400).send({ error: 'URL obrigatória' });

      const isAmazon = url.includes('amazon.com') || url.includes('amzn');
      const isML = url.includes('mercadolivre.com') || url.includes('mercadolibre.com');
      if (!isAmazon && !isML) {
        return reply.status(400).send({ error: 'Use uma URL da Amazon ou do Mercado Livre' });
      }

      let productData: any = null;
      try {
        if (isAmazon) {
          const prod = await getAmazonProductByUrl(url);
          if (prod) {
            productData = {
              title: prod.title,
              finalPrice: prod.finalPrice ?? (prod as any).price,
              originalPrice: (prod as any).originalPrice ?? null,
              discountPct: (prod as any).discountPct ?? 0,
              imageUrl: prod.images?.primary ?? null,
              affiliateUrl: prod.affiliateUrl ?? url,
            };
          }
        } else {
          productData = await fetchMLProduct(url);
        }
      } catch (err: any) {
        return reply.status(500).send({ error: `Erro ao buscar produto: ${err.message}` });
      }

      if (!productData?.title) {
        return reply.status(404).send({ error: 'Produto não encontrado. Verifique a URL.' });
      }

      const carouselResult = await generateCarousel({
        title: productData.title,
        finalPrice: Number(productData.finalPrice),
        originalPrice: productData.originalPrice ? Number(productData.originalPrice) : null,
        discountPct: productData.discountPct ?? 0,
        imageUrl: customImageUrl || productData.imageUrl,
        fallbackImageUrl: customImageUrl ? productData.imageUrl : null,
        affiliateUrl: productData.affiliateUrl,
        theme: (theme as any) || 'dark',
        couponCode: couponCode || null,
        couponType: couponType ?? null,
        couponDiscountPct: couponDiscountPct ?? null,
        couponFixedValue: couponFixedValue ?? null,
        couponMaxSavings: couponMaxSavings ?? null,
      });

      if (!carouselResult.success || !carouselResult.slideUrls?.length) {
        return reply.status(500).send({ error: carouselResult.error || 'Falha ao gerar slides' });
      }

      const caption = generateInstagramCaption({
        title: productData.title,
        finalPrice: Number(productData.finalPrice),
        originalPrice: productData.originalPrice ? Number(productData.originalPrice) : null,
        discountPct: productData.discountPct ?? 0,
        affiliateUrl: productData.affiliateUrl,
        couponCode: couponCode || null,
        couponType: couponType ?? null,
        couponDiscountPct: couponDiscountPct ?? null,
        couponFixedValue: couponFixedValue ?? null,
        couponMaxSavings: couponMaxSavings ?? null,
      });

      return reply.send({
        success: true,
        slideUrls: carouselResult.slideUrls,
        caption,
        product: {
          title: productData.title,
          finalPrice: productData.finalPrice,
          originalPrice: productData.originalPrice,
          discountPct: productData.discountPct,
          imageUrl: customImageUrl || productData.imageUrl,
        },
      });
    },
  );

  // ── GET /api/instagram/accounts ─────────────────────────────────────────────
  fastify.get('/accounts', { preHandler: authGuard }, async (_req, reply) => {
    try {
      const accounts = await listConnectedAccounts();
      const instagram = accounts.filter((a: any) => a.platform === 'instagram');
      return reply.send({ accounts: instagram });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ── POST /api/instagram/enqueue/:offerId ─────────────────────────────────────
  // Enfileira uma oferta: IA avalia primeiro, depois o worker processa
  fastify.post(
    '/enqueue/:offerId',
    { preHandler: authGuard },
    async (req: FastifyRequest<{
      Params: { offerId: string };
      Body: { accountId?: string; triggeredBy?: 'manual' | 'auto' | 'manu-agent' };
    }>, reply) => {
      const { offerId } = req.params;
      const accountId = req.body?.accountId || ACCOUNT_ID();

      if (!accountId) {
        return reply.status(400).send({ error: 'POSTFORME_INSTAGRAM_ACCOUNT_ID não configurado' });
      }

      const offer = await getOffer(offerId);
      if (!offer) return reply.status(404).send({ error: 'Oferta não encontrada' });

      // Verificar se já tem job pendente/em progresso para esta oferta
      const existing = await prisma.instagramJob.findFirst({
        where: {
          offerId,
          status: { in: ['PENDING', 'SCORING', 'RENDERING', 'UPLOADING', 'PUBLISHING'] },
        },
      });

      if (existing) {
        return reply.status(409).send({
          error: 'Já existe um job ativo para esta oferta',
          jobId: existing.id,
          status: existing.status,
        });
      }

      const jobId = await enqueueInstagramJob({
        offerId,
        accountId,
        triggeredBy: req.body?.triggeredBy || 'manual',
      });

      return reply.send({
        success: true,
        jobId,
        message: 'Job enfileirado — IA irá avaliar e publicar automaticamente',
      });
    },
  );

  // ── POST /api/instagram/enqueue/batch ────────────────────────────────────────
  // Enfileira múltiplas ofertas de uma vez (para automação)
  fastify.post(
    '/enqueue/batch',
    { preHandler: authGuard },
    async (req: FastifyRequest<{
      Body: { offerIds: string[]; triggeredBy?: 'manual' | 'auto' | 'manu-agent' };
    }>, reply) => {
      const { offerIds, triggeredBy = 'auto' } = req.body;

      if (!offerIds?.length) {
        return reply.status(400).send({ error: 'offerIds é obrigatório' });
      }

      const accountId = ACCOUNT_ID();
      if (!accountId) {
        return reply.status(400).send({ error: 'POSTFORME_INSTAGRAM_ACCOUNT_ID não configurado' });
      }

      const results: Array<{ offerId: string; jobId?: string; error?: string }> = [];

      for (const offerId of offerIds.slice(0, 20)) {
        try {
          const jobId = await enqueueInstagramJob({ offerId, accountId, triggeredBy });
          results.push({ offerId, jobId });
        } catch (err: any) {
          results.push({ offerId, error: err.message });
        }
      }

      return reply.send({
        success: true,
        enqueued: results.filter(r => r.jobId).length,
        failed: results.filter(r => r.error).length,
        results,
      });
    },
  );

  // ── GET /api/instagram/jobs ──────────────────────────────────────────────────
  fastify.get(
    '/jobs',
    { preHandler: authGuard },
    async (req: FastifyRequest<{
      Querystring: { status?: InstagramJobStatus; limit?: string; offset?: string };
    }>, reply) => {
      const { status, limit, offset } = req.query;
      const result = await listJobs({
        status,
        limit: limit ? parseInt(limit) : 20,
        offset: offset ? parseInt(offset) : 0,
      });
      return reply.send(result);
    },
  );

  // ── GET /api/instagram/jobs/:jobId ───────────────────────────────────────────
  fastify.get(
    '/jobs/:jobId',
    { preHandler: authGuard },
    async (req: FastifyRequest<{ Params: { jobId: string } }>, reply) => {
      const job = await prisma.instagramJob.findUnique({
        where: { id: req.params.jobId },
        include: {
          offer: {
            select: {
              id: true, title: true, finalPrice: true, discountPct: true,
              mainImage: true, imageUrl: true, affiliateUrl: true,
            },
          },
        },
      });

      if (!job) return reply.status(404).send({ error: 'Job não encontrado' });
      return reply.send(job);
    },
  );

  // ── DELETE /api/instagram/jobs/:jobId ────────────────────────────────────────
  fastify.delete(
    '/jobs/:jobId',
    { preHandler: authGuard },
    async (req: FastifyRequest<{ Params: { jobId: string } }>, reply) => {
      const job = await prisma.instagramJob.findUnique({ where: { id: req.params.jobId } });
      if (!job) return reply.status(404).send({ error: 'Job não encontrado' });

      if (!['PENDING', 'FAILED'].includes(job.status)) {
        return reply.status(400).send({ error: `Não é possível cancelar job com status ${job.status}` });
      }

      await cancelJob(req.params.jobId);
      return reply.send({ success: true });
    },
  );

  // ── GET /api/instagram/carousel/preview/:offerId ─────────────────────────────
  // Gera preview dos slides (sem publicar) + análise da IA
  fastify.get(
    '/carousel/preview/:offerId',
    { preHandler: authGuard },
    async (req: FastifyRequest<{ Params: { offerId: string } }>, reply) => {
      const offer = await getOffer(req.params.offerId);
      if (!offer) return reply.status(404).send({ error: 'Oferta não encontrada' });

      const [aiDecision, carouselResult] = await Promise.all([
        analyzeOfferForInstagram({
          id: offer.id,
          title: offer.title,
          finalPrice: Number(offer.finalPrice),
          originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
          discountPct: offer.discountPct,
          nicheName: offer.niche?.name,
          storeName: offer.store?.name,
          imageUrl: offer.mainImage || offer.imageUrl || null,
          promoType: offer.promoType,
          urgency: offer.urgency,
          affiliateUrl: offer.affiliateUrl,
        }),
        generateCarousel({
          title: offer.title,
          finalPrice: Number(offer.finalPrice),
          originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
          discountPct: offer.discountPct,
          imageUrl: offer.mainImage || offer.imageUrl || null,
          offerId: offer.id,
        }),
      ]);

      if (!carouselResult.success) {
        return reply.status(500).send({ error: carouselResult.error });
      }

      return reply.send({
        success: true,
        slideUrls: carouselResult.slideUrls,
        ai: {
          score: aiDecision.score,
          format: aiDecision.format,
          shouldPublish: aiDecision.shouldPublish,
          reasoning: aiDecision.reasoning,
          urgencyTag: aiDecision.urgencyTag,
        },
        caption: aiDecision.caption,
        offer: {
          id: offer.id,
          title: offer.title,
          finalPrice: Number(offer.finalPrice),
          discountPct: offer.discountPct,
        },
      });
    },
  );

  // ── POST /api/instagram/carousel/preview ─────────────────────────────────────
  // Preview com dados manuais
  fastify.post(
    '/carousel/preview',
    { preHandler: authGuard },
    async (req: FastifyRequest<{
      Body: {
        title: string;
        finalPrice: number;
        originalPrice?: number;
        discountPct?: number;
        imageUrl?: string;
        offerId?: string;
      };
    }>, reply) => {
      const { title, finalPrice, originalPrice, discountPct, imageUrl, offerId } = req.body;

      if (!title || !finalPrice) {
        return reply.status(400).send({ error: 'title e finalPrice são obrigatórios' });
      }

      const [aiDecision, carouselResult] = await Promise.all([
        analyzeOfferForInstagram({ id: offerId || 'manual', title, finalPrice, originalPrice, discountPct, imageUrl }),
        generateCarousel({ title, finalPrice, originalPrice, discountPct, imageUrl, offerId }),
      ]);

      if (!carouselResult.success) {
        return reply.status(500).send({ error: carouselResult.error });
      }

      return reply.send({
        success: true,
        slideUrls: carouselResult.slideUrls,
        ai: { score: aiDecision.score, format: aiDecision.format, shouldPublish: aiDecision.shouldPublish },
        caption: aiDecision.caption,
      });
    },
  );

  // ── GET /api/instagram/metrics ───────────────────────────────────────────────
  fastify.get('/metrics', { preHandler: authGuard }, async (_req, reply) => {
    const [summary, topPosts, recent] = await Promise.all([
      // Totais
      prisma.instagramJob.aggregate({
        _count: { id: true },
        _sum: { metricViews: true, metricLikes: true, metricSaves: true },
        where: { status: 'SUCCESS' },
      }),
      // Top posts por views
      prisma.instagramJob.findMany({
        where: { status: 'SUCCESS', metricViews: { gt: 0 } },
        orderBy: { metricViews: 'desc' },
        take: 5,
        include: { offer: { select: { title: true, finalPrice: true, discountPct: true } } },
      }),
      // Jobs recentes
      prisma.instagramJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { offer: { select: { title: true, finalPrice: true } } },
      }),
    ]);

    // Status breakdown
    const statusCounts = await prisma.instagramJob.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    return reply.send({
      summary: {
        totalPublished: summary._count.id,
        totalViews: summary._sum.metricViews || 0,
        totalLikes: summary._sum.metricLikes || 0,
        totalSaves: summary._sum.metricSaves || 0,
      },
      statusBreakdown: Object.fromEntries(statusCounts.map(s => [s.status, s._count.id])),
      topPosts,
      recent,
    });
  });

  // ── POST /api/instagram/publish-story ─────────────────────────────────────────
  // Publica imagem ou vídeo como Instagram Story via Postfor.me
  // Body: multipart/form-data
  //   media     : File (imagem JPG/PNG ou vídeo MP4) — opcional se mediaUrl fornecida
  //   mediaUrl  : string — URL pública alternativa ao arquivo
  //   caption   : string (opcional)
  //   mediaType : 'image' | 'video' (opcional, auto-detectado pelo mimetype)
  fastify.post(
    '/publish-story',
    { preHandler: authGuard },
    async (request, reply) => {
      const accountId = ACCOUNT_ID();
      if (!accountId) {
        return reply.status(400).send({ error: 'Conta Instagram não configurada (POSTFORME_INSTAGRAM_ACCOUNT_ID)' });
      }

      let mediaBuffer: Buffer | null = null;
      let mediaMime = 'image/jpeg';
      let caption = '';
      let mediaUrlFromField = '';
      let mediaTypeField = '';

      try {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'media') {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) chunks.push(chunk as Buffer);
            mediaBuffer = Buffer.concat(chunks);
            mediaMime = part.mimetype || 'image/jpeg';
          } else if (part.type === 'field') {
            const val = (part as any).value as string;
            if (part.fieldname === 'caption')   caption          = val;
            if (part.fieldname === 'mediaUrl')  mediaUrlFromField = val;
            if (part.fieldname === 'mediaType') mediaTypeField    = val;
          }
        }
      } catch {
        // JSON body fallback (quando enviado sem arquivo)
        const body = request.body as any || {};
        caption          = body.caption   || '';
        mediaUrlFromField = body.mediaUrl  || '';
        mediaTypeField    = body.mediaType || '';
      }

      // Determinar tipo de mídia
      const isVideo = mediaTypeField === 'video' || mediaMime.startsWith('video/');
      const resourceType = isVideo ? 'video' : 'image';

      let publicMediaUrl = mediaUrlFromField;

      // Se recebeu arquivo, faz upload para o Cloudinary
      if (mediaBuffer && mediaBuffer.length > 0) {
        const folder = `promo-platform/stories/${resourceType}`;
        const uploadResult = await uploadFromBuffer(mediaBuffer, {
          folder,
          resourceType,
          tags: ['story', 'instagram'],
          publicId: `story_${Date.now()}`,
        });

        if (!uploadResult.success || !uploadResult.url) {
          return reply.status(500).send({ error: `Falha no upload: ${uploadResult.error}` });
        }
        publicMediaUrl = uploadResult.url;
        console.log(`[Story] Upload Cloudinary OK: ${publicMediaUrl}`);
      }

      if (!publicMediaUrl) {
        return reply.status(400).send({ error: 'Forneça um arquivo de mídia ou uma URL pública (mediaUrl)' });
      }

      // Publicar Story via Postfor.me
      const result = await publishStory({
        mediaUrl: publicMediaUrl,
        caption:  caption || undefined,
        instagramAccountId: accountId,
      });

      if (!result.success) {
        return reply.status(500).send({ error: result.error || 'Falha ao publicar Story' });
      }

      return reply.send({
        success:  true,
        postId:   result.postId,
        status:   result.status,
        mediaUrl: publicMediaUrl,
      });
    },
  );

  // ── POST /api/instagram/publish-agent ────────────────────────────────────────
  // Endpoint para agentes de IA (OpenClaw). Usa secret simples em vez de sessão.
  fastify.post(
    '/publish-agent',
    async (req: FastifyRequest<{ Body: { url: string; theme?: string; imageUrl?: string; secret: string } }>, reply) => {
      try {
        const { url, theme, imageUrl: customImageUrl, secret } = req.body || {};

        if (secret !== 'promo2026') {
          return reply.status(403).send({ error: 'Acesso negado' });
        }
        if (!url) return reply.status(400).send({ error: 'URL obrigatória' });

        const accountIdToUse = ACCOUNT_ID();
        if (!accountIdToUse) {
          return reply.status(400).send({ error: 'Conta Instagram não configurada.' });
        }

        const isAmazon = url.includes('amazon.com') || url.includes('amzn');
        const isML = url.includes('mercadolivre.com') || url.includes('mercadolibre.com');
        if (!isAmazon && !isML) {
          return reply.status(400).send({ error: 'Use uma URL da Amazon ou do Mercado Livre' });
        }

        let productData: any = null;
        if (isAmazon) {
          const prod = await getAmazonProductByUrl(url);
          if (prod) productData = {
            title: prod.title,
            finalPrice: prod.finalPrice,
            originalPrice: (prod as any).originalPrice ?? null,
            discountPct: (prod as any).discountPct ?? 0,
            imageUrl: prod.images?.primary ?? null,
            affiliateUrl: prod.affiliateUrl ?? url,
          };
        } else {
          productData = await fetchMLProduct(url);
        }

        if (!productData?.title) {
          return reply.status(404).send({ error: 'Produto não encontrado.' });
        }

        const carouselResult = await generateCarousel({
          title: productData.title,
          finalPrice: productData.finalPrice,
          originalPrice: productData.originalPrice ?? undefined,
          discountPct: productData.discountPct ?? undefined,
          imageUrl: customImageUrl || productData.imageUrl || undefined,
          affiliateUrl: productData.affiliateUrl ?? url,
          theme: (theme as any) ?? 'light',
        });

        if (!carouselResult.success || !carouselResult.slideUrls || carouselResult.slideUrls.length < 2) {
          return reply.status(500).send({ error: 'Falha ao gerar slides do carrossel' });
        }

        const caption = `${productData.title}\n\nDE R$ ${productData.originalPrice ?? productData.finalPrice} → R$ ${productData.finalPrice}\n\n🔗 Link na bio`;

        const publishResult = await publishCarousel({
          caption,
          slideUrls: carouselResult.slideUrls,
          instagramAccountId: accountIdToUse,
        });

        if (!publishResult.success) {
          return reply.status(500).send({ error: publishResult.error || 'Falha ao publicar' });
        }

        return reply.send({
          success: true,
          postId: publishResult.postId,
          message: 'Carrossel publicado com sucesso no Instagram',
        });
      } catch (err: any) {
        console.error('[publish-agent] erro:', err);
        return reply.status(500).send({ error: err.message || 'Erro interno' });
      }
    },
  );
}
