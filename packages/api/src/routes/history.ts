import { FastifyInstance } from 'fastify';
import { authGuard } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { sendTelegramMessage, isTelegramConfigured } from '../services/telegram.js';
import { postOfferToTwitter } from '../services/twitter.js';
import { generateCopies } from '../services/aiCopyGenerator.js';

export async function historyRoutes(app: FastifyInstance) {

  // ── GET /api/history ───────────────────────────────────────────────────────
  // Lê direto de PublishedPost — criado automaticamente pelo Auto Publicar.
  // Sem queries duplas, sem lógica complexa.
  app.get('/', { preHandler: [authGuard] }, async (request, reply) => {
    const q = request.query as { page?: string; limit?: string; q?: string; from?: string; to?: string };

    const page  = Math.max(1, parseInt(q.page  || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || '50')));
    const skip  = (page - 1) * limit;
    const search = q.q?.trim() || '';
    const from  = q.from ? new Date(q.from) : undefined;
    const to    = q.to   ? new Date(q.to)   : undefined;

    const where: any = {};
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (from || to) {
      where.publishedAt = {};
      if (from) where.publishedAt.gte = from;
      if (to)   where.publishedAt.lte = to;
    }

    const [posts, total] = await Promise.all([
      prisma.publishedPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          price: true,
          originalPrice: true,
          discountPct: true,
          imageUrl: true,
          affiliateUrl: true,
          publishedAt: true,
          niche: { select: { name: true, slug: true, icon: true } },
          store: { select: { name: true, slug: true } },
        },
      }),
      prisma.publishedPost.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + posts.length < total,
      },
    });
  });

  // ── POST /api/history/:id/repost-telegram ─────────────────────────────────
  app.post('/:id/repost-telegram', { preHandler: [authGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!isTelegramConfigured()) {
      return reply.status(400).send({ success: false, error: 'Telegram não configurado' });
    }

    const post = await prisma.publishedPost.findUnique({
      where: { id },
      include: { store: { select: { name: true } } },
    });

    if (!post) return reply.status(404).send({ success: false, error: 'Post não encontrado' });

    const copies = generateCopies({
      title: post.title,
      price: Number(post.price),
      oldPrice: post.originalPrice ? Number(post.originalPrice) : null,
      discountPct: post.discountPct || 0,
      storeName: post.store?.name,
      trackingUrl: post.affiliateUrl,
    });

    const result = await sendTelegramMessage({ text: copies.telegram, imageUrl: post.imageUrl || undefined });
    return reply.send({ success: result.success, error: result.error });
  });

  // ── POST /api/history/:id/repost-twitter ──────────────────────────────────
  app.post('/:id/repost-twitter', { preHandler: [authGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const post = await prisma.publishedPost.findUnique({
      where: { id },
      include: { store: { select: { name: true } } },
    });

    if (!post) return reply.status(404).send({ success: false, error: 'Post não encontrado' });

    const result = await postOfferToTwitter({
      title: post.title,
      originalPrice: post.originalPrice ? Number(post.originalPrice) : undefined,
      finalPrice: Number(post.price),
      discount: post.discountPct || undefined,
      affiliateUrl: post.affiliateUrl,
      storeName: post.store?.name,
      imageUrl: post.imageUrl || undefined,
    });

    return reply.send({ success: result.success, error: result.error, tweetUrl: result.tweetUrl });
  });
}
