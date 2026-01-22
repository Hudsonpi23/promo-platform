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
      
      const copy = generateUruboCopy(body);
      
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
      
      const copies = generateAllChannelsCopy(body);
      
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
}
