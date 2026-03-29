/**
 * Twitter/X Metrics Routes — Leitura de dados via API v2
 *
 * Endpoints para extrair métricas, timeline, menções e performance do X.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authGuard } from '../lib/auth.js';
import {
  isTwitterMetricsConfigured,
  getMyProfile,
  getTweetMetrics,
  getMyTimeline,
  getMyMentions,
  searchRecentTweets,
  getPerformanceSummary,
} from '../services/twitterMetrics.js';

export async function twitterMetricsRoutes(app: FastifyInstance) {

  /**
   * GET /api/twitter-metrics/status
   */
  app.get('/status', { preHandler: [authGuard] }, async () => {
    return { configured: isTwitterMetricsConfigured() };
  });

  /**
   * GET /api/twitter-metrics/profile
   * Retorna dados do perfil @manupromocao (seguidores, tweets, etc.)
   */
  app.get('/profile', { preHandler: [authGuard] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!isTwitterMetricsConfigured()) {
      return reply.status(503).send({ error: 'Twitter API não configurada' });
    }

    try {
      const profile = await getMyProfile();
      return { success: true, profile };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * GET /api/twitter-metrics/timeline?maxResults=20&paginationToken=xxx
   * Retorna últimos tweets com métricas (views, likes, replies, retweets)
   */
  app.get('/timeline', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isTwitterMetricsConfigured()) {
      return reply.status(503).send({ error: 'Twitter API não configurada' });
    }

    const q = request.query as { maxResults?: string; paginationToken?: string; sinceId?: string };

    try {
      const result = await getMyTimeline({
        maxResults: q.maxResults ? parseInt(q.maxResults) : 20,
        paginationToken: q.paginationToken,
        sinceId: q.sinceId,
      });
      return { success: true, ...result };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * POST /api/twitter-metrics/tweets
   * Retorna métricas de tweets específicos por IDs
   */
  app.post('/tweets', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isTwitterMetricsConfigured()) {
      return reply.status(503).send({ error: 'Twitter API não configurada' });
    }

    const body = request.body as { tweetIds?: string[] };

    if (!body.tweetIds || body.tweetIds.length === 0) {
      return reply.status(400).send({ error: 'Informe ao menos 1 tweet ID' });
    }

    try {
      const tweets = await getTweetMetrics(body.tweetIds);
      return { success: true, tweets };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * GET /api/twitter-metrics/mentions?maxResults=20
   * Retorna menções ao @manupromocao
   */
  app.get('/mentions', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isTwitterMetricsConfigured()) {
      return reply.status(503).send({ error: 'Twitter API não configurada' });
    }

    const q = request.query as { maxResults?: string; paginationToken?: string; sinceId?: string };

    try {
      const result = await getMyMentions({
        maxResults: q.maxResults ? parseInt(q.maxResults) : 20,
        paginationToken: q.paginationToken,
        sinceId: q.sinceId,
      });
      return { success: true, ...result };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * GET /api/twitter-metrics/search?query=xxx&maxResults=10
   * Busca tweets recentes (últimos 7 dias)
   */
  app.get('/search', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isTwitterMetricsConfigured()) {
      return reply.status(503).send({ error: 'Twitter API não configurada' });
    }

    const q = request.query as { query?: string; maxResults?: string; paginationToken?: string };

    if (!q.query || q.query.trim().length < 2) {
      return reply.status(400).send({ error: 'Query obrigatória (mínimo 2 caracteres)' });
    }

    try {
      const result = await searchRecentTweets(q.query.trim(), {
        maxResults: q.maxResults ? parseInt(q.maxResults) : 10,
        paginationToken: q.paginationToken,
      });
      return { success: true, ...result };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * GET /api/twitter-metrics/performance?maxTweets=50
   * Resumo de performance: médias, top posts, perfil
   */
  app.get('/performance', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isTwitterMetricsConfigured()) {
      return reply.status(503).send({ error: 'Twitter API não configurada' });
    }

    const q = request.query as { maxTweets?: string };

    try {
      const summary = await getPerformanceSummary(
        q.maxTweets ? Math.min(parseInt(q.maxTweets), 100) : 50
      );
      return { success: true, ...summary };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
