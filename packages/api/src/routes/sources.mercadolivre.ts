/**
 * Rotas do Provider Mercado Livre
 * 
 * POST /api/sources/mercadolivre/run - Executa coleta
 * GET /api/sources/mercadolivre/config - Obtém configuração
 * PUT /api/sources/mercadolivre/config - Atualiza configuração
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { createMercadoLivreProvider, RunMode } from '../providers/mercadolivre';

const prisma = new PrismaClient();

// ==================== SCHEMAS ====================

const RunBodySchema = z.object({
  // 🔥 'deals' é o modo RECOMENDADO - busca apenas da página de Ofertas do Dia
  mode: z.enum(['deals', 'keywords', 'categories', 'both']).default('deals'),
  keywords: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  maxItems: z.number().min(1).max(500).optional(),
  maxPages: z.number().min(1).max(20).optional(),  // Para modo 'deals'
  // 🔥 NOVO: Opções do sistema de scoring
  useNewScoring: z.boolean().optional().default(true),  // Usar novo sistema por padrão
  minScore: z.number().min(0).max(100).optional(),      // Score mínimo (default: 50)
  autoApprove: z.boolean().optional(),                   // Auto-aprovar (default: true)
});

const ConfigUpdateSchema = z.object({
  keywords: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  minDiscount: z.number().min(0).max(100).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional().nullable(),
  conditionFilter: z.array(z.string()).optional(),
  maxItemsPerRun: z.number().min(1).max(200).optional(),
  enableX: z.boolean().optional(),
  xDailyLimit: z.number().min(0).optional(),
  xMinScore: z.number().min(0).max(100).optional(),
  scheduleTimes: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

// ==================== ROUTES ====================

export async function mercadoLivreRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/sources/mercadolivre/run
   * Executa coleta de ofertas do Mercado Livre
   * 
   * 🔥 NOVO: Usa sistema de scoring inteligente por padrão
   */
  fastify.post('/run', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = RunBodySchema.parse(request.body);
      
      const provider = createMercadoLivreProvider(prisma);
      
      console.log(`[ML Route] Executando coleta no modo: ${body.mode}, useNewScoring: ${body.useNewScoring}`);
      
      let result;
      
      // 🔥 NOVO: Usar sistema de scoring se habilitado (default: true)
      if (body.useNewScoring) {
        console.log('[ML Route] 🔥 Usando NOVO sistema de scoring');
        result = await provider.runWithNewScoring({
          mode: body.mode as RunMode,
          maxPages: body.maxPages,
          maxItems: body.maxItems,
          minScore: body.minScore,
          autoApprove: body.autoApprove,
        });
      } else {
        // Sistema legado
        result = await provider.run({
          mode: body.mode as RunMode,
          keywords: body.keywords,
          categories: body.categories,
          maxItems: body.maxItems,
          maxPages: body.maxPages,
        });
      }
      
      return reply.send({
        success: true,
        data: result,
        message: `Coleta finalizada: ${result.insertedOffers} ofertas, ${result.createdDrafts} drafts`,
      });
    } catch (error: any) {
      console.error('Erro ao executar coleta ML:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Erro ao executar coleta',
      });
    }
  });

  /**
   * GET /api/sources/mercadolivre/config
   * Obtém configuração atual do provider
   */
  fastify.get('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      let config = await prisma.providerConfig.findUnique({
        where: { source: 'MERCADO_LIVRE' },
      });

      // Se não existir, criar com defaults
      if (!config) {
        config = await prisma.providerConfig.create({
          data: {
            source: 'MERCADO_LIVRE',
            enabled: true,
            keywords: ['iphone', 'samsung', 'notebook', 'tv 4k', 'air fryer'],
            categories: ['MLB1055', 'MLB1648', 'MLB1002', 'MLB1574', 'MLB1144'],
            minDiscount: 20,
            minPrice: 50,
            conditionFilter: ['new'],
            maxItemsPerRun: 50,
            enableX: true,
            xDailyLimit: 30,
            xMinScore: 60,
            scheduleTimes: ['08:00', '11:00', '14:00', '18:00', '22:00'],
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          ...config,
          minPrice: Number(config.minPrice),
          maxPrice: config.maxPrice ? Number(config.maxPrice) : null,
        },
      });
    } catch (error: any) {
      console.error('Erro ao obter config ML:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Erro ao obter configuração',
      });
    }
  });

  /**
   * PUT /api/sources/mercadolivre/config
   * Atualiza configuração do provider
   */
  fastify.put('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = ConfigUpdateSchema.parse(request.body);
      
      const config = await prisma.providerConfig.upsert({
        where: { source: 'MERCADO_LIVRE' },
        update: {
          ...(body.keywords && { keywords: body.keywords }),
          ...(body.categories && { categories: body.categories }),
          ...(body.minDiscount !== undefined && { minDiscount: body.minDiscount }),
          ...(body.minPrice !== undefined && { minPrice: body.minPrice }),
          ...(body.maxPrice !== undefined && { maxPrice: body.maxPrice }),
          ...(body.conditionFilter && { conditionFilter: body.conditionFilter }),
          ...(body.maxItemsPerRun !== undefined && { maxItemsPerRun: body.maxItemsPerRun }),
          ...(body.enableX !== undefined && { enableX: body.enableX }),
          ...(body.xDailyLimit !== undefined && { xDailyLimit: body.xDailyLimit }),
          ...(body.xMinScore !== undefined && { xMinScore: body.xMinScore }),
          ...(body.scheduleTimes && { scheduleTimes: body.scheduleTimes }),
          ...(body.enabled !== undefined && { enabled: body.enabled }),
          updatedAt: new Date(),
        },
        create: {
          source: 'MERCADO_LIVRE',
          enabled: body.enabled ?? true,
          keywords: body.keywords || ['iphone', 'samsung', 'notebook'],
          categories: body.categories || ['MLB1055', 'MLB1648'],
          minDiscount: body.minDiscount || 20,
          minPrice: body.minPrice || 50,
          maxPrice: body.maxPrice ?? undefined,
          conditionFilter: body.conditionFilter || ['new'],
          maxItemsPerRun: body.maxItemsPerRun || 50,
          enableX: body.enableX ?? true,
          xDailyLimit: body.xDailyLimit || 30,
          xMinScore: body.xMinScore || 60,
          scheduleTimes: body.scheduleTimes || ['08:00', '11:00', '14:00', '18:00', '22:00'],
        },
      });

      return reply.send({
        success: true,
        data: {
          ...config,
          minPrice: Number(config.minPrice),
          maxPrice: config.maxPrice ? Number(config.maxPrice) : null,
        },
        message: 'Configuração atualizada com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao atualizar config ML:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Erro ao atualizar configuração',
      });
    }
  });

  /**
   * GET /api/sources/mercadolivre/stats
   * Estatísticas do provider
   */
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalOffers, todayOffers, todayDrafts, todayXDrafts] = await Promise.all([
        prisma.offer.count({ where: { source: 'MERCADO_LIVRE' } }),
        prisma.offer.count({ where: { source: 'MERCADO_LIVRE', createdAt: { gte: today } } }),
        prisma.postDraft.count({ 
          where: { 
            offer: { source: 'MERCADO_LIVRE' },
            createdAt: { gte: today }
          } 
        }),
        prisma.postDraft.count({
          where: {
            offer: { source: 'MERCADO_LIVRE' },
            channels: { has: 'TWITTER' },
            createdAt: { gte: today }
          }
        }),
      ]);

      const config = await prisma.providerConfig.findUnique({
        where: { source: 'MERCADO_LIVRE' },
      });

      // 🔥 NOVO: Estatísticas por score
      const [highScore, mediumScore, lowScore] = await Promise.all([
        prisma.postDraft.count({ 
          where: { 
            offer: { source: 'MERCADO_LIVRE' },
            score: { gte: 70 }
          } 
        }),
        prisma.postDraft.count({ 
          where: { 
            offer: { source: 'MERCADO_LIVRE' },
            score: { gte: 50, lt: 70 }
          } 
        }),
        prisma.postDraft.count({ 
          where: { 
            offer: { source: 'MERCADO_LIVRE' },
            score: { lt: 50 }
          } 
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          totalOffers,
          todayOffers,
          todayDrafts,
          todayXDrafts,
          xDailyLimit: config?.xDailyLimit || 30,
          xRemaining: Math.max(0, (config?.xDailyLimit || 30) - todayXDrafts),
          lastRunAt: config?.lastRunAt,
          enabled: config?.enabled ?? true,
          // 🔥 NOVO: Score stats
          scoring: {
            high: highScore,      // >= 70 (alta conversão)
            medium: mediumScore,  // 50-69 (média conversão)
            low: lowScore,        // < 50 (baixa conversão)
          },
        },
      });
    } catch (error: any) {
      console.error('Erro ao obter stats ML:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Erro ao obter estatísticas',
      });
    }
  });

  /**
   * 🔥 NOVO: POST /api/sources/mercadolivre/score
   * Calcula score de uma oferta sem criar
   */
  fastify.post('/score', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { calculateScore, validateOffer, calculateDiscount } = await import('../services/offerScoring.js');
      
      const body = z.object({
        title: z.string(),
        price: z.number().positive(),
        oldPrice: z.number().positive().optional(),
        category: z.string().optional(),
        storeName: z.string().optional(),
        imageUrl: z.string().optional(),
        trackingUrl: z.string().optional(),
      }).parse(request.body);

      const offerInput = {
        title: body.title,
        price: body.price,
        oldPrice: body.oldPrice,
        discountPct: calculateDiscount(body.price, body.oldPrice),
        category: body.category,
        storeName: body.storeName,
        imageUrl: body.imageUrl,
        trackingUrl: body.trackingUrl || 'https://example.com',
        productUrl: body.trackingUrl || 'https://example.com',
        source: 'MERCADO_LIVRE' as const,
      };

      const validation = validateOffer(offerInput);
      const scoreResult = calculateScore(offerInput);

      return reply.send({
        success: true,
        data: {
          valid: validation.valid,
          errorReason: validation.errorReason,
          score: scoreResult.score,
          classification: scoreResult.classification,
          breakdown: scoreResult.breakdown,
          discount: offerInput.discountPct,
        },
      });
    } catch (error: any) {
      console.error('Erro ao calcular score:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Erro ao calcular score',
      });
    }
  });
}
