import { FastifyInstance } from 'fastify';
import { authGuard } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { sendTelegramMessage, isTelegramConfigured } from '../services/telegram.js';
import { postOfferToTwitter } from '../services/twitter.js';
import { generateCopies } from '../services/aiCopyGenerator.js';

// Fonte única e confiável: Offer com curationStatus APPROVED (ou superior).
// O auto-publish SEMPRE cria o Offer antes de qualquer outra coisa —
// nunca fica preso em try-catch silencioso.
const HISTORY_STATUSES = ['APPROVED', 'AI_PROCESSING', 'AI_READY', 'AI_BLOCKED'];

export async function historyRoutes(app: FastifyInstance) {

  // GET /api/history
  app.get('/', { preHandler: [authGuard] }, async (request, reply) => {
    const q = request.query as {
      page?: string; limit?: string; q?: string; from?: string; to?: string;
    };

    const page   = Math.max(1, parseInt(q.page  || '1'));
    const limit  = Math.min(100, Math.max(1, parseInt(q.limit || '50')));
    const skip   = (page - 1) * limit;
    const search = q.q?.trim() || '';
    const from   = q.from ? new Date(q.from) : undefined;
    const to     = q.to   ? new Date(q.to)   : undefined;

    const where: any = { curationStatus: { in: HISTORY_STATUSES } };
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to)   where.createdAt.lte = to;
    }

    const [offers, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          finalPrice: true,
          originalPrice: true,
          discountPct: true,
          mainImage: true,
          imageUrl: true,
          affiliateUrl: true,
          createdAt: true,
          niche: { select: { name: true, slug: true, icon: true } },
          store: { select: { name: true, slug: true } },
        },
      }),
      prisma.offer.count({ where }),
    ]);

    // Normaliza para o formato esperado pelo frontend
    const data = offers.map(o => ({
      id:            o.id,
      title:         o.title,
      price:         Number(o.finalPrice),
      originalPrice: o.originalPrice ? Number(o.originalPrice) : null,
      discountPct:   o.discountPct,
      imageUrl:      o.mainImage || o.imageUrl || null,
      affiliateUrl:  o.affiliateUrl,
      publishedAt:   o.createdAt.toISOString(),
      niche:         o.niche,
      store:         o.store,
    }));

    return reply.send({
      success: true,
      data,
      pagination: { page, limit, total, hasMore: skip + data.length < total },
    });
  });

  // POST /api/history/:id/repost-telegram
  app.post('/:id/repost-telegram', { preHandler: [authGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!isTelegramConfigured()) {
      return reply.status(400).send({ success: false, error: 'Telegram não configurado' });
    }

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { store: { select: { name: true } } },
    });
    if (!offer) return reply.status(404).send({ success: false, error: 'Post não encontrado' });

    const copies = generateCopies({
      title:      offer.title,
      price:      Number(offer.finalPrice),
      oldPrice:   offer.originalPrice ? Number(offer.originalPrice) : null,
      discountPct: offer.discountPct || 0,
      storeName:  offer.store?.name,
      trackingUrl: offer.affiliateUrl,
    });

    const result = await sendTelegramMessage({
      text:     copies.telegram,
      imageUrl: (offer as any).mainImage || offer.imageUrl || undefined,
    });
    return reply.send({ success: result.success, error: result.error });
  });

  // POST /api/history/:id/repost-twitter
  app.post('/:id/repost-twitter', { preHandler: [authGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { store: { select: { name: true } } },
    });
    if (!offer) return reply.status(404).send({ success: false, error: 'Post não encontrado' });

    const result = await postOfferToTwitter({
      title:         offer.title,
      originalPrice: offer.originalPrice ? Number(offer.originalPrice) : undefined,
      finalPrice:    Number(offer.finalPrice),
      discount:      offer.discountPct || undefined,
      affiliateUrl:  offer.affiliateUrl,
      storeName:     offer.store?.name,
      imageUrl:      (offer as any).mainImage || offer.imageUrl || undefined,
    });
    return reply.send({ success: result.success, error: result.error, tweetUrl: result.tweetUrl });
  });
}
