import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { clicksFilterSchema, statsFilterSchema } from '../lib/schemas.js';
import { sendError, Errors } from '../lib/errors.js';

// Hash do IP para privacidade
function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

export async function trackingRoutes(app: FastifyInstance) {
  // GET /go/:code - Redirect com tracking
  app.get('/:code', async (request, reply) => {
    try {
      const { code } = request.params as { code: string };
      const query = request.query as {
        utm_source?: string;
        utm_medium?: string;
        utm_campaign?: string;
        channel?: string;
      };

      // Buscar publicação pelo goCode
      const publication = await prisma.publishedPost.findUnique({
        where: { goCode: code },
      });

      if (!publication || !publication.isActive) {
        // Redirecionar para home se não encontrar
        return reply.redirect(302, process.env.SITE_BASE_URL || '/');
      }

      // Registrar clique
      await prisma.click.create({
        data: {
          goCode: code,
          publishedPostId: publication.id,
          offerId: publication.offerId,
          channel: query.channel as any || null,
          utmSource: query.utm_source || null,
          utmMedium: query.utm_medium || null,
          utmCampaign: query.utm_campaign || null,
          userAgent: request.headers['user-agent'] || null,
          ipHash: hashIp(request.ip),
          referer: request.headers.referer || null,
        },
      });

      // Montar URL de destino com UTMs
      const config = await prisma.config.findUnique({ where: { id: 'singleton' } });
      let destinationUrl = publication.affiliateUrl;

      // Adicionar UTMs à URL
      const url = new URL(destinationUrl);
      url.searchParams.set('utm_source', query.utm_source || config?.defaultUtmSource || 'maxofertas');
      url.searchParams.set('utm_medium', query.utm_medium || config?.defaultUtmMedium || 'site');
      if (query.utm_campaign) {
        url.searchParams.set('utm_campaign', query.utm_campaign);
      }

      // Redirect 302
      return reply.redirect(302, url.toString());
    } catch (error: any) {
      console.error('Erro no tracking:', error);
      return reply.redirect(302, process.env.SITE_BASE_URL || '/');
    }
  });
}

export async function statsRoutes(app: FastifyInstance) {
  // GET /clicks - Listar cliques (admin)
  app.get('/clicks', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = clicksFilterSchema.parse(request.query);
      const { page, limit, dateFrom, dateTo, channel, nicheId, storeId, goCode } = query;
      const skip = (page - 1) * limit;

      const where: any = {};
      
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom + 'T00:00:00.000Z');
        if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
      }
      
      if (channel) where.channel = channel;
      if (goCode) where.goCode = goCode;
      
      if (nicheId) {
        where.publishedPost = { nicheId };
      }
      
      if (storeId) {
        where.publishedPost = { ...where.publishedPost, storeId };
      }

      const [clicks, total] = await Promise.all([
        prisma.click.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            publishedPost: {
              select: {
                id: true,
                title: true,
                slug: true,
                niche: { select: { name: true } },
                store: { select: { name: true } },
              },
            },
          },
        }),
        prisma.click.count({ where }),
      ]);

      return {
        data: clicks,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /stats/overview
  app.get('/overview', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = statsFilterSchema.parse(request.query);
      
      const dateStr = query.date || new Date().toISOString().split('T')[0];
      const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
      const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

      const [
        totalOffers,
        activeOffers,
        totalDrafts,
        pendingDrafts,
        approvedDrafts,
        dispatchedDrafts,
        totalPublications,
        activePublications,
        todayClicks,
        totalClicks,
      ] = await Promise.all([
        prisma.offer.count(),
        prisma.offer.count({ where: { status: 'ACTIVE' } }),
        prisma.postDraft.count(),
        prisma.postDraft.count({ where: { status: 'PENDING' } }),
        prisma.postDraft.count({ where: { status: 'APPROVED' } }),
        prisma.postDraft.count({ where: { status: 'DISPATCHED' } }),
        prisma.publishedPost.count(),
        prisma.publishedPost.count({ where: { isActive: true } }),
        prisma.click.count({
          where: {
            createdAt: { gte: startOfDay, lte: endOfDay },
          },
        }),
        prisma.click.count(),
      ]);

      return {
        data: {
          date: dateStr,
          offers: {
            total: totalOffers,
            active: activeOffers,
          },
          drafts: {
            total: totalDrafts,
            pending: pendingDrafts,
            approved: approvedDrafts,
            dispatched: dispatchedDrafts,
          },
          publications: {
            total: totalPublications,
            active: activePublications,
          },
          clicks: {
            today: todayClicks,
            total: totalClicks,
          },
        },
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /stats/by-channel
  app.get('/by-channel', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = statsFilterSchema.parse(request.query);
      
      const where: any = {};
      if (query.dateFrom || query.dateTo) {
        where.createdAt = {};
        if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom + 'T00:00:00.000Z');
        if (query.dateTo) where.createdAt.lte = new Date(query.dateTo + 'T23:59:59.999Z');
      } else if (query.date) {
        where.createdAt = {
          gte: new Date(query.date + 'T00:00:00.000Z'),
          lte: new Date(query.date + 'T23:59:59.999Z'),
        };
      }

      const stats = await prisma.click.groupBy({
        by: ['channel'],
        where,
        _count: true,
      });

      return {
        data: stats.map((s) => ({
          channel: s.channel || 'DIRECT',
          clicks: s._count,
        })),
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /stats/by-niche
  app.get('/by-niche', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = statsFilterSchema.parse(request.query);
      
      const where: any = {
        publishedPostId: { not: null },
      };
      
      if (query.date) {
        where.createdAt = {
          gte: new Date(query.date + 'T00:00:00.000Z'),
          lte: new Date(query.date + 'T23:59:59.999Z'),
        };
      }

      const clicks = await prisma.click.findMany({
        where,
        include: {
          publishedPost: {
            include: { niche: { select: { id: true, name: true, slug: true } } },
          },
        },
      });

      // Agrupar por nicho
      const byNiche: Record<string, { niche: any; clicks: number }> = {};
      for (const click of clicks) {
        if (click.publishedPost?.niche) {
          const key = click.publishedPost.niche.id;
          if (!byNiche[key]) {
            byNiche[key] = { niche: click.publishedPost.niche, clicks: 0 };
          }
          byNiche[key].clicks++;
        }
      }

      return {
        data: Object.values(byNiche).sort((a, b) => b.clicks - a.clicks),
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /stats/by-store
  app.get('/by-store', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = statsFilterSchema.parse(request.query);
      
      const where: any = {
        publishedPostId: { not: null },
      };
      
      if (query.date) {
        where.createdAt = {
          gte: new Date(query.date + 'T00:00:00.000Z'),
          lte: new Date(query.date + 'T23:59:59.999Z'),
        };
      }

      const clicks = await prisma.click.findMany({
        where,
        include: {
          publishedPost: {
            include: { store: { select: { id: true, name: true, slug: true } } },
          },
        },
      });

      // Agrupar por loja
      const byStore: Record<string, { store: any; clicks: number }> = {};
      for (const click of clicks) {
        if (click.publishedPost?.store) {
          const key = click.publishedPost.store.id;
          if (!byStore[key]) {
            byStore[key] = { store: click.publishedPost.store, clicks: 0 };
          }
          byStore[key].clicks++;
        }
      }

      return {
        data: Object.values(byStore).sort((a, b) => b.clicks - a.clicks),
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });
}
