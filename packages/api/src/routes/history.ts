import { FastifyInstance } from 'fastify';
import { authGuard } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { sendTelegramMessage, isTelegramConfigured } from '../services/telegram.js';
import { postOfferToTwitter } from '../services/twitter.js';
import { generateCopies } from '../services/aiCopyGenerator.js';

// ─── Tipos normalizados ──────────────────────────────────────────────────────

export interface HistoryItem {
  id: string;                           // publishedPostId ou offerId
  source: 'published_post' | 'approved_offer';
  offerId: string;
  title: string;
  price: number;
  originalPrice: number | null;
  discountPct: number;
  imageUrl: string | null;
  affiliateUrl: string;
  date: string;                         // ISO — data de publicação/aprovação
  niche: { name: string; slug: string; icon: string } | null;
  store: { name: string; slug: string } | null;
  channels: {
    site: boolean;
    telegram: boolean;
    twitter: boolean;
    facebook: boolean;
    instagram: boolean;
    whatsapp: boolean;
  };
}

// Status que indicam "oferta aprovada/postada"
const APPROVED_STATUSES = ['APPROVED', 'AI_PROCESSING', 'AI_READY', 'AI_BLOCKED'];

// ─── Rota principal ──────────────────────────────────────────────────────────

export async function historyRoutes(app: FastifyInstance) {

  /**
   * GET /api/history
   * Retorna TODOS os posts aprovados + publicados (sem limite, paginação de 50).
   * Fontes: PublishedPost + Offer[curationStatus=APPROVED]
   * Desduplicados por offerId: PublishedPost tem prioridade.
   */
  app.get('/', { preHandler: [authGuard] }, async (request, reply) => {
    const query = request.query as {
      page?: string;
      limit?: string;
      q?: string;
      from?: string;   // ISO ou 'YYYY-MM-DD' — data de início
      to?: string;     // ISO ou 'YYYY-MM-DD' — data de fim
    };

    const page  = Math.max(1, parseInt(query.page  || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50')));
    const q     = query.q?.trim() || '';
    const from  = query.from ? new Date(query.from) : undefined;
    const to    = query.to   ? new Date(query.to)   : undefined;

    // ── 1. PublishedPosts ────────────────────────────────────────────────────
    const ppWhere: any = {};
    if (q) ppWhere.title = { contains: q, mode: 'insensitive' };
    if (from || to) {
      ppWhere.publishedAt = {};
      if (from) ppWhere.publishedAt.gte = from;
      if (to)   ppWhere.publishedAt.lte = to;
    }

    const publishedPosts = await prisma.publishedPost.findMany({
      where: ppWhere,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        offerId: true,
        title: true,
        price: true,
        originalPrice: true,
        discountPct: true,
        imageUrl: true,
        affiliateUrl: true,
        publishedAt: true,
        niche: { select: { name: true, slug: true, icon: true } },
        store: { select: { name: true, slug: true } },
        offer: { select: { mainImage: true } },
      },
    });

    // Conjunto de offerIds já cobertos por PublishedPost
    const coveredOfferIds = new Set(publishedPosts.map(p => p.offerId));

    // ── 2. Approved Offers (sem PublishedPost correspondente) ────────────────
    const offerWhere: any = {
      curationStatus: { in: APPROVED_STATUSES },
      id: { notIn: Array.from(coveredOfferIds) },
    };
    if (q) offerWhere.title = { contains: q, mode: 'insensitive' };
    if (from || to) {
      offerWhere.updatedAt = {};
      if (from) offerWhere.updatedAt.gte = from;
      if (to)   offerWhere.updatedAt.lte = to;
    }

    const approvedOffers = await prisma.offer.findMany({
      where: offerWhere,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        finalPrice: true,
        originalPrice: true,
        discountPct: true,
        mainImage: true,
        imageUrl: true,
        affiliateUrl: true,
        updatedAt: true,
        niche: { select: { name: true, slug: true, icon: true } },
        store: { select: { name: true, slug: true } },
      },
    });

    // ── 3. Normalizar em HistoryItem ─────────────────────────────────────────
    const fromPublished: HistoryItem[] = publishedPosts.map(p => ({
      id: p.id,
      source: 'published_post',
      offerId: p.offerId,
      title: p.title,
      price: Number(p.price),
      originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
      discountPct: p.discountPct,
      imageUrl: p.imageUrl || p.offer?.mainImage || null,
      affiliateUrl: p.affiliateUrl,
      date: p.publishedAt.toISOString(),
      niche: p.niche,
      store: p.store,
      channels: { site: true, telegram: false, twitter: false, facebook: false, instagram: false, whatsapp: false },
    }));

    const fromApproved: HistoryItem[] = approvedOffers.map(o => ({
      id: o.id,
      source: 'approved_offer',
      offerId: o.id,
      title: o.title,
      price: Number(o.finalPrice),
      originalPrice: o.originalPrice ? Number(o.originalPrice) : null,
      discountPct: o.discountPct,
      imageUrl: o.mainImage || o.imageUrl || null,
      affiliateUrl: o.affiliateUrl,
      date: o.updatedAt.toISOString(),
      niche: o.niche,
      store: o.store,
      channels: { site: false, telegram: false, twitter: false, facebook: false, instagram: false, whatsapp: false },
    }));

    // ── 4. Merge, ordenar por data desc, paginar ──────────────────────────────
    const all = [...fromPublished, ...fromApproved].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const total = all.length;
    const skip  = (page - 1) * limit;
    const page_data = all.slice(skip, skip + limit);

    return reply.send({
      success: true,
      data: page_data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + page_data.length < total,
      },
    });
  });

  // ─── Repost Telegram ───────────────────────────────────────────────────────

  /**
   * POST /api/history/:id/repost-telegram?source=published_post|approved_offer
   */
  app.post('/:id/repost-telegram', { preHandler: [authGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { source } = request.query as { source?: string };

    if (!isTelegramConfigured()) {
      return reply.status(400).send({ success: false, error: 'Telegram não configurado' });
    }

    let title = '', price = 0, oldPrice: number | null = null, discountPct = 0,
        imageUrl: string | undefined, affiliateUrl = '', storeName: string | undefined;

    if (source === 'approved_offer') {
      const offer = await prisma.offer.findUnique({
        where: { id },
        include: { store: { select: { name: true } } },
      });
      if (!offer) return reply.status(404).send({ success: false, error: 'Oferta não encontrada' });
      title       = offer.title;
      price       = Number(offer.finalPrice);
      oldPrice    = offer.originalPrice ? Number(offer.originalPrice) : null;
      discountPct = offer.discountPct;
      imageUrl    = offer.mainImage || offer.imageUrl || undefined;
      affiliateUrl = offer.affiliateUrl;
      storeName   = offer.store?.name;
    } else {
      const post = await prisma.publishedPost.findUnique({
        where: { id },
        include: { store: { select: { name: true } } },
      });
      if (!post) return reply.status(404).send({ success: false, error: 'Post não encontrado' });
      title       = post.title;
      price       = Number(post.price);
      oldPrice    = post.originalPrice ? Number(post.originalPrice) : null;
      discountPct = post.discountPct;
      imageUrl    = post.imageUrl || undefined;
      affiliateUrl = post.affiliateUrl;
      storeName   = post.store?.name;
    }

    const copies = generateCopies({
      title, price, oldPrice, discountPct, storeName, trackingUrl: affiliateUrl,
    });

    const result = await sendTelegramMessage({ text: copies.telegram, imageUrl });

    return reply.send({ success: result.success, error: result.error, messageId: result.messageId });
  });

  // ─── Repost Twitter/X ──────────────────────────────────────────────────────

  /**
   * POST /api/history/:id/repost-twitter?source=published_post|approved_offer
   */
  app.post('/:id/repost-twitter', { preHandler: [authGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { source } = request.query as { source?: string };

    let title = '', finalPrice = 0, originalPrice: number | undefined, discount: number | undefined,
        affiliateUrl = '', storeName: string | undefined, imageUrl: string | undefined;

    if (source === 'approved_offer') {
      const offer = await prisma.offer.findUnique({
        where: { id },
        include: { store: { select: { name: true } } },
      });
      if (!offer) return reply.status(404).send({ success: false, error: 'Oferta não encontrada' });
      title         = offer.title;
      finalPrice    = Number(offer.finalPrice);
      originalPrice = offer.originalPrice ? Number(offer.originalPrice) : undefined;
      discount      = offer.discountPct || undefined;
      affiliateUrl  = offer.affiliateUrl;
      storeName     = offer.store?.name;
      imageUrl      = offer.mainImage || offer.imageUrl || undefined;
    } else {
      const post = await prisma.publishedPost.findUnique({
        where: { id },
        include: { store: { select: { name: true } } },
      });
      if (!post) return reply.status(404).send({ success: false, error: 'Post não encontrado' });
      title         = post.title;
      finalPrice    = Number(post.price);
      originalPrice = post.originalPrice ? Number(post.originalPrice) : undefined;
      discount      = post.discountPct || undefined;
      affiliateUrl  = post.affiliateUrl;
      storeName     = post.store?.name;
      imageUrl      = post.imageUrl || undefined;
    }

    const result = await postOfferToTwitter({
      title, originalPrice, finalPrice, discount, affiliateUrl, storeName, imageUrl,
    });

    return reply.send({ success: result.success, error: result.error, tweetUrl: result.tweetUrl });
  });
}
