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
import { authGuard } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { enqueueInstagramJob, listJobs, cancelJob } from '../services/instagramQueue.js';
import { analyzeOfferForInstagram } from '../services/instagramAI.js';
import { generateCarousel } from '../services/instagramCarousel.js';
import { listConnectedAccounts, generateInstagramCaption } from '../services/postforme.js';
import { InstagramJobStatus } from '@prisma/client';

const ACCOUNT_ID = () => process.env.POSTFORME_INSTAGRAM_ACCOUNT_ID || '';

// ── Helper ─────────────────────────────────────────────────────────────────────

async function getOffer(id: string) {
  return prisma.offer.findUnique({
    where: { id },
    include: { niche: true, store: true },
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────────

export async function instagramRoutes(fastify: FastifyInstance) {

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
}
