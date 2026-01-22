/**
 * Rotas do Channel Scheduler
 * 
 * Gerencia o sistema de filas por canal.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { sendError, Errors } from '../lib/errors.js';
import {
  runScheduler,
  processChannelQueue,
  addToQueue,
  removeFromQueue,
  getQueuesStatus,
  getTodayExecutions,
  getRecentErrors,
  CHANNEL_RULES,
  runBurstScheduler,
  initializeChannelConfigs,
  approveWhatsAppPost,
  getPendingWhatsAppApprovals,
  canRepost,
} from '../services/channelScheduler.js';
import { generateUruboCopy, generateAllChannelsCopy } from '../services/uruboCopyGenerator.js';

// ==================== SCHEMAS ====================

const AddToQueueSchema = z.object({
  draftId: z.string(),
  channel: z.enum(['TELEGRAM', 'WHATSAPP', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'SITE']),
  copyText: z.string().optional(),
  humorStyle: z.enum(['URUBU', 'NEUTRO', 'FLASH', 'ENGRACADO']).optional().default('URUBU'),
});

const GenerateCopySchema = z.object({
  title: z.string(),
  price: z.number(),
  oldPrice: z.number().optional(),
  discountPct: z.number().optional(),
  channel: z.enum(['TELEGRAM', 'WHATSAPP', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'SITE']),
  humorStyle: z.enum(['URUBU', 'NEUTRO', 'FLASH', 'ENGRACADO']).optional().default('URUBU'),
  trackingUrl: z.string(),
  storeName: z.string().optional(),
});

// ==================== ROUTES ====================

export async function schedulerRoutes(app: FastifyInstance) {
  
  /**
   * POST /api/scheduler/run
   * Executa o scheduler manualmente (processa todas as filas)
   */
  app.post('/run', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('[API] Executando scheduler manualmente...');
      const result = await runScheduler();
      
      return reply.send({
        success: true,
        message: 'Scheduler executado',
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao executar scheduler:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/scheduler/run/:channel
   * Executa o scheduler para um canal específico
   */
  app.post('/run/:channel', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { channel } = request.params as { channel: string };
      const channelUpper = channel.toUpperCase() as any;
      
      console.log(`[API] Executando scheduler para ${channelUpper}...`);
      const result = await processChannelQueue(channelUpper);
      
      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao executar scheduler:', error);
      return sendError(reply, error);
    }
  });

  /**
   * GET /api/scheduler/status
   * Retorna status de todas as filas
   */
  app.get('/status', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await getQueuesStatus();
      
      return reply.send({
        success: true,
        data: status,
      });
    } catch (error: any) {
      console.error('Erro ao obter status:', error);
      return sendError(reply, error);
    }
  });

  /**
   * GET /api/scheduler/rules
   * Retorna as regras de cada canal
   */
  app.get('/rules', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: CHANNEL_RULES,
    });
  });

  /**
   * POST /api/scheduler/queue
   * Adiciona um item à fila
   */
  app.post('/queue', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = AddToQueueSchema.parse(request.body);
      
      // Buscar draft para gerar copy se não fornecida
      let copyText = body.copyText;
      
      if (!copyText) {
        const draft = await prisma.postDraft.findUnique({
          where: { id: body.draftId },
          include: { offer: { include: { store: true } } },
        });
        
        if (!draft) {
          return sendError(reply, Errors.NOT_FOUND('Draft'));
        }
        
        // Gerar copy no estilo Urubu
        const generated = generateUruboCopy({
          title: draft.offer.title,
          price: Number(draft.offer.finalPrice),
          oldPrice: draft.offer.originalPrice ? Number(draft.offer.originalPrice) : undefined,
          discountPct: draft.offer.discountPct,
          channel: body.channel,
          humorStyle: body.humorStyle,
          trackingUrl: draft.offer.affiliateUrl,
          storeName: draft.offer.store?.name,
        });
        
        copyText = generated.text;
      }
      
      const result = await addToQueue(body.draftId, body.channel as any, copyText, body.humorStyle as any);
      
      return reply.status(201).send({
        success: true,
        message: `Adicionado à fila do ${body.channel}`,
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao adicionar à fila:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * DELETE /api/scheduler/queue/:draftId/:channel
   * Remove um item da fila
   */
  app.delete('/queue/:draftId/:channel', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId, channel } = request.params as { draftId: string; channel: string };
      
      const result = await removeFromQueue(draftId, channel.toUpperCase() as any);
      
      return reply.send({
        success: true,
        message: 'Removido da fila',
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao remover da fila:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/scheduler/queue-all/:draftId
   * Adiciona um draft a TODAS as filas de uma vez
   */
  app.post('/queue-all/:draftId', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };
      const body = z.object({
        humorStyle: z.enum(['URUBU', 'NEUTRO', 'FLASH', 'ENGRACADO']).optional().default('URUBU'),
        channels: z.array(z.enum(['TELEGRAM', 'WHATSAPP', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'SITE'])).optional(),
      }).parse(request.body || {});
      
      // Buscar draft
      const draft = await prisma.postDraft.findUnique({
        where: { id: draftId },
        include: { offer: { include: { store: true } } },
      });
      
      if (!draft) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }
      
      // Gerar copy para todos os canais
      const copies = generateAllChannelsCopy({
        title: draft.offer.title,
        price: Number(draft.offer.finalPrice),
        oldPrice: draft.offer.originalPrice ? Number(draft.offer.originalPrice) : undefined,
        discountPct: draft.offer.discountPct,
        humorStyle: body.humorStyle,
        trackingUrl: draft.offer.affiliateUrl,
        storeName: draft.offer.store?.name,
      });
      
      // Adicionar às filas
      const channels = body.channels || ['TELEGRAM', 'WHATSAPP', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'SITE'];
      const results = [];
      
      for (const channel of channels) {
        const copy = copies[channel];
        const result = await addToQueue(draftId, channel as any, copy.text, body.humorStyle as any);
        results.push({ channel, queuedAt: result.queuedAt, charCount: copy.charCount });
      }
      
      return reply.status(201).send({
        success: true,
        message: `Adicionado a ${results.length} filas`,
        data: results,
      });
    } catch (error: any) {
      console.error('Erro ao adicionar às filas:', error);
      return sendError(reply, error);
    }
  });

  /**
   * GET /api/scheduler/executions
   * Retorna execuções do dia (posts publicados hoje)
   */
  app.get('/executions', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const executions = await getTodayExecutions();
      
      return reply.send({
        success: true,
        data: executions,
        count: executions.length,
      });
    } catch (error: any) {
      console.error('Erro ao obter execuções:', error);
      return sendError(reply, error);
    }
  });

  /**
   * GET /api/scheduler/errors
   * Retorna erros recentes
   */
  app.get('/errors', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limit } = request.query as { limit?: string };
      const errors = await getRecentErrors(parseInt(limit || '50'));
      
      return reply.send({
        success: true,
        data: errors,
        count: errors.length,
      });
    } catch (error: any) {
      console.error('Erro ao obter erros:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/scheduler/errors/:id/retry
   * Reprocessa um erro (coloca de volta na fila)
   */
  app.post('/errors/:id/retry', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const channelRecord = await prisma.promotionChannel.findUnique({
        where: { id },
      });
      
      if (!channelRecord) {
        return sendError(reply, Errors.NOT_FOUND('Canal'));
      }
      
      if (channelRecord.status !== 'ERROR') {
        return reply.status(400).send({
          success: false,
          error: { code: 'NOT_ERROR', message: 'Este registro não está em estado de erro' },
        });
      }
      
      // Colocar de volta na fila
      const result = await prisma.promotionChannel.update({
        where: { id },
        data: {
          status: 'QUEUED',
          queuedAt: new Date(),
          errorReason: null,
        },
      });
      
      return reply.send({
        success: true,
        message: 'Colocado de volta na fila',
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao reprocessar:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/scheduler/generate-copy
   * Gera copy no estilo Urubu (preview)
   */
  app.post('/generate-copy', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = GenerateCopySchema.parse(request.body);
      
      const copy = generateUruboCopy({
        title: body.title,
        price: body.price,
        oldPrice: body.oldPrice,
        discountPct: body.discountPct,
        channel: body.channel,
        humorStyle: body.humorStyle,
        trackingUrl: body.trackingUrl,
        storeName: body.storeName,
      });
      
      return reply.send({
        success: true,
        data: copy,
      });
    } catch (error: any) {
      console.error('Erro ao gerar copy:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/scheduler/generate-all-copies
   * Gera copy para todos os canais de uma vez
   */
  app.post('/generate-all-copies', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = z.object({
        title: z.string(),
        price: z.number(),
        oldPrice: z.number().optional(),
        discountPct: z.number().optional(),
        humorStyle: z.enum(['URUBU', 'NEUTRO', 'FLASH', 'ENGRACADO']).optional().default('URUBU'),
        trackingUrl: z.string(),
        storeName: z.string().optional(),
      }).parse(request.body);
      
      const copies = generateAllChannelsCopy({
        title: body.title,
        price: body.price,
        oldPrice: body.oldPrice,
        discountPct: body.discountPct,
        humorStyle: body.humorStyle,
        trackingUrl: body.trackingUrl,
        storeName: body.storeName,
      });
      
      return reply.send({
        success: true,
        data: copies,
      });
    } catch (error: any) {
      console.error('Erro ao gerar copies:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // ==================== 🔥 BURST MODE ====================

  /**
   * POST /api/scheduler/burst/:channel
   * Executa burst mode para Telegram ou Site
   */
  app.post('/burst/:channel', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { channel } = request.params as { channel: string };
      const channelUpper = channel.toUpperCase() as 'TELEGRAM' | 'SITE';
      
      if (channelUpper !== 'TELEGRAM' && channelUpper !== 'SITE') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_CHANNEL', message: 'Burst mode só está disponível para TELEGRAM e SITE' },
        });
      }
      
      const body = z.object({
        maxPosts: z.number().min(1).max(50).optional().default(10),
      }).parse(request.body || {});
      
      console.log(`[API] ⚡ Executando burst para ${channelUpper} (max: ${body.maxPosts})...`);
      const result = await runBurstScheduler(channelUpper, body.maxPosts);
      
      return reply.send({
        success: true,
        message: `Burst finalizado: ${result.processed} publicados, ${result.errors} erros`,
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao executar burst:', error);
      return sendError(reply, error);
    }
  });

  // ==================== 🔥 WHATSAPP APPROVAL ====================

  /**
   * GET /api/scheduler/whatsapp/pending
   * Lista posts de WhatsApp aguardando aprovação
   */
  app.get('/whatsapp/pending', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pending = await getPendingWhatsAppApprovals();
      
      return reply.send({
        success: true,
        data: pending,
        count: pending.length,
      });
    } catch (error: any) {
      console.error('Erro ao listar pendentes WhatsApp:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/scheduler/whatsapp/approve/:id
   * Aprova um post de WhatsApp
   */
  app.post('/whatsapp/approve/:id', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = (request as any).user;
      
      const result = await approveWhatsAppPost(id, user?.id || 'system');
      
      return reply.send({
        success: true,
        message: 'Post aprovado para publicação',
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao aprovar WhatsApp:', error);
      return sendError(reply, error);
    }
  });

  // ==================== 🔥 ANTI-REPETIÇÃO ====================

  /**
   * POST /api/scheduler/check-repost
   * Verifica se um post pode ser republicado
   */
  app.post('/check-repost', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = z.object({
        offerId: z.string(),
        channel: z.enum(['TELEGRAM', 'WHATSAPP', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'SITE']),
        humorStyle: z.enum(['URUBU', 'NEUTRO', 'FLASH', 'ENGRACADO']).optional().default('URUBU'),
        cooldownHours: z.number().optional(),
      }).parse(request.body);
      
      // Pegar cooldown do canal se não fornecido
      const defaultCooldowns: Record<string, number> = {
        TELEGRAM: 6,
        WHATSAPP: 24,
        TWITTER: 24,
        INSTAGRAM: 48,
        FACEBOOK: 24,
        SITE: 6,
      };
      
      const cooldownHours = body.cooldownHours || defaultCooldowns[body.channel] || 6;
      
      const result = await canRepost(body.offerId, body.channel as any, body.humorStyle, cooldownHours);
      
      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao verificar repost:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // ==================== 🔥 CONFIGURAÇÃO ====================

  /**
   * GET /api/scheduler/config
   * Retorna configuração de todos os canais
   */
  app.get('/config', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const configs = await prisma.channelConfig.findMany({
        orderBy: { channel: 'asc' },
      });
      
      return reply.send({
        success: true,
        data: configs,
        defaults: CHANNEL_RULES,
      });
    } catch (error: any) {
      console.error('Erro ao obter configurações:', error);
      return sendError(reply, error);
    }
  });

  /**
   * PUT /api/scheduler/config/:channel
   * Atualiza configuração de um canal
   */
  app.put('/config/:channel', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { channel } = request.params as { channel: string };
      const channelUpper = channel.toUpperCase() as any;
      
      const body = z.object({
        intervalMinutes: z.number().min(1).optional(),
        dailyLimit: z.number().min(0).optional(),
        activeHours: z.string().optional(),
        automationLevel: z.enum(['TOTAL', 'MANUAL_APPROVAL', 'HUMAN_ONLY']).optional(),
        repostCooldownHours: z.number().min(1).optional(),
        burstCooldownSecs: z.number().min(10).optional(),
        burstSchedule: z.array(z.object({
          hour: z.number().min(0).max(23),
          posts: z.number().min(1),
        })).optional(),
        isEnabled: z.boolean().optional(),
      }).parse(request.body);
      
      const result = await prisma.channelConfig.upsert({
        where: { channel: channelUpper },
        update: body,
        create: {
          channel: channelUpper,
          ...body,
        },
      });
      
      return reply.send({
        success: true,
        message: `Configuração do ${channelUpper} atualizada`,
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar configuração:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/scheduler/init-configs
   * Inicializa configurações padrão de todos os canais
   */
  app.post('/init-configs', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await initializeChannelConfigs();
      
      const configs = await prisma.channelConfig.findMany({
        orderBy: { channel: 'asc' },
      });
      
      return reply.send({
        success: true,
        message: 'Configurações inicializadas',
        data: configs,
      });
    } catch (error: any) {
      console.error('Erro ao inicializar configurações:', error);
      return sendError(reply, error);
    }
  });
}
