/**
 * 🔥 Rotas de Operação Manual (Copy/Paste)
 * 
 * Para canais que não têm API de publicação automática:
 * - Facebook (grupos, páginas)
 * - Instagram
 * - WhatsApp (broadcast manual)
 * 
 * O operador:
 * 1. Vê a lista de posts READY_MANUAL
 * 2. Copia o texto + link
 * 3. Cola na rede social manualmente
 * 4. Marca como DONE_MANUAL
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { sendError, Errors } from '../lib/errors.js';
import { generateUruboCopy } from '../services/uruboCopyGenerator.js';
import { resolveFinalUrl } from '../services/linkResolver.js';

// ==================== SCHEMAS ====================

const MarkDoneSchema = z.object({
  notes: z.string().optional(),
});

const EditCopySchema = z.object({
  editedCopyText: z.string().min(10),
});

const ReportErrorSchema = z.object({
  reason: z.string().min(5),
});

const AddToManualQueueSchema = z.object({
  draftId: z.string(),
  channel: z.enum(['FACEBOOK', 'INSTAGRAM', 'WHATSAPP']),
  humorStyle: z.enum(['URUBU', 'NEUTRO', 'FLASH', 'ENGRACADO']).optional().default('URUBU'),
});

// ==================== HELPERS ====================

/**
 * Canais que operam em modo manual
 */
const MANUAL_CHANNELS = ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP'];

/**
 * Verifica se um canal é manual
 */
function isManualChannel(channel: string): boolean {
  return MANUAL_CHANNELS.includes(channel.toUpperCase());
}

// ==================== ROUTES ====================

export async function manualRoutes(app: FastifyInstance) {
  
  /**
   * GET /api/manual/queue
   * Lista posts prontos para copy/paste
   * 
   * Query params:
   * - channel: FACEBOOK | INSTAGRAM | WHATSAPP (opcional)
   */
  app.get('/queue', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { channel } = request.query as { channel?: string };
      
      const where: any = {
        channelMode: 'MANUAL',
        status: 'READY_MANUAL',
      };
      
      if (channel) {
        where.channel = channel.toUpperCase();
      }
      
      const items = await prisma.promotionChannel.findMany({
        where,
        include: {
          draft: {
            include: {
              offer: {
                include: {
                  store: { select: { name: true, logoUrl: true } },
                  niche: { select: { name: true, icon: true } },
                },
              },
            },
          },
        },
        orderBy: { queuedAt: 'asc' },
      });

      // Formatar para a UI
      const formatted = items.map(item => ({
        id: item.id,
        channel: item.channel,
        status: item.status,
        queuedAt: item.queuedAt,
        
        // Dados da promoção
        offer: {
          id: item.draft.offer.id,
          title: item.draft.offer.title,
          price: Number(item.draft.offer.finalPrice),
          oldPrice: item.draft.offer.originalPrice ? Number(item.draft.offer.originalPrice) : null,
          discountPct: item.draft.offer.discountPct,
          imageUrl: item.draft.offer.imageUrl,
          store: item.draft.offer.store,
          niche: item.draft.offer.niche,
          promoType: item.draft.offer.promoType,
          couponCode: item.draft.offer.couponCode,
        },
        
        // Copy para copiar
        copyText: item.editedCopyText || item.copyText,
        originalCopyText: item.copyText,
        wasEdited: !!item.editedCopyText,
        
        // Links
        finalUrl: item.finalUrl,
        goUrl: item.goUrl,
        
        // Estilo
        humorStyle: item.humorStyle,
      }));
      
      return reply.send({
        success: true,
        data: formatted,
        count: formatted.length,
      });
    } catch (error: any) {
      console.error('Erro ao listar fila manual:', error);
      return sendError(reply, error);
    }
  });

  /**
   * GET /api/manual/queue/stats
   * Estatísticas da fila manual por canal
   */
  app.get('/queue/stats', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await Promise.all(
        MANUAL_CHANNELS.map(async (channel) => {
          const ready = await prisma.promotionChannel.count({
            where: {
              channel: channel as any,
              channelMode: 'MANUAL',
              status: 'READY_MANUAL',
            },
          });
          
          const doneToday = await prisma.promotionChannel.count({
            where: {
              channel: channel as any,
              channelMode: 'MANUAL',
              status: 'DONE_MANUAL',
              manualDoneAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          });
          
          const errors = await prisma.promotionChannel.count({
            where: {
              channel: channel as any,
              channelMode: 'MANUAL',
              status: 'ERROR',
            },
          });
          
          return {
            channel,
            ready,
            doneToday,
            errors,
          };
        })
      );
      
      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Erro ao obter stats:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/manual/queue
   * Adiciona um item à fila manual
   */
  app.post('/queue', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = AddToManualQueueSchema.parse(request.body);
      
      if (!isManualChannel(body.channel)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_CHANNEL', message: 'Canal não é manual. Use FACEBOOK, INSTAGRAM ou WHATSAPP.' },
        });
      }
      
      // Buscar draft
      const draft = await prisma.postDraft.findUnique({
        where: { id: body.draftId },
        include: {
          offer: {
            include: { store: true },
          },
        },
      });
      
      if (!draft) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }
      
      // Resolver link
      const resolved = await resolveFinalUrl({
        offerId: draft.offerId,
        channel: body.channel as any,
      });
      
      if (resolved.error && resolved.needsManualUrl) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NEEDS_AFFILIATE_LINK', message: resolved.error },
        });
      }
      
      // Gerar copy
      const copy = generateUruboCopy({
        title: draft.offer.title,
        price: Number(draft.offer.finalPrice),
        oldPrice: draft.offer.originalPrice ? Number(draft.offer.originalPrice) : undefined,
        discountPct: draft.offer.discountPct,
        channel: body.channel,
        humorStyle: body.humorStyle,
        trackingUrl: resolved.goUrl || resolved.finalUrl,
        storeName: draft.offer.store?.name,
        promoType: draft.offer.promoType,
        couponCode: draft.offer.couponCode || undefined,
      });
      
      // Criar ou atualizar PromotionChannel
      const result = await prisma.promotionChannel.upsert({
        where: {
          draftId_channel: {
            draftId: body.draftId,
            channel: body.channel as any,
          },
        },
        update: {
          channelMode: 'MANUAL',
          status: 'READY_MANUAL',
          copyText: copy.text,
          humorStyle: body.humorStyle as any,
          finalUrl: resolved.finalUrl,
          goUrl: resolved.goUrl,
          queuedAt: new Date(),
          errorReason: null,
        },
        create: {
          draftId: body.draftId,
          channel: body.channel as any,
          channelMode: 'MANUAL',
          status: 'READY_MANUAL',
          copyText: copy.text,
          humorStyle: body.humorStyle as any,
          finalUrl: resolved.finalUrl,
          goUrl: resolved.goUrl,
          queuedAt: new Date(),
        },
      });
      
      return reply.status(201).send({
        success: true,
        message: `Adicionado à fila manual do ${body.channel}`,
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao adicionar à fila manual:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/manual/mark-done/:id
   * Marca um post como concluído (operador postou manualmente)
   */
  app.post('/mark-done/:id', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = MarkDoneSchema.parse(request.body || {});
      const user = (request as any).user;
      
      const item = await prisma.promotionChannel.findUnique({
        where: { id },
      });
      
      if (!item) {
        return sendError(reply, Errors.NOT_FOUND('Item'));
      }
      
      if (item.status !== 'READY_MANUAL') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_STATUS', message: 'Item não está pronto para marcação' },
        });
      }
      
      const result = await prisma.promotionChannel.update({
        where: { id },
        data: {
          status: 'DONE_MANUAL',
          manualDoneAt: new Date(),
          manualDoneById: user?.id,
          metadata: body.notes ? { notes: body.notes } : undefined,
        },
      });
      
      return reply.send({
        success: true,
        message: 'Marcado como postado!',
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao marcar como feito:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/manual/edit/:id
   * Edita o texto de um post antes de copiar
   */
  app.post('/edit/:id', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = EditCopySchema.parse(request.body);
      
      const item = await prisma.promotionChannel.findUnique({
        where: { id },
      });
      
      if (!item) {
        return sendError(reply, Errors.NOT_FOUND('Item'));
      }
      
      if (item.status !== 'READY_MANUAL') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_STATUS', message: 'Só é possível editar itens READY_MANUAL' },
        });
      }
      
      const result = await prisma.promotionChannel.update({
        where: { id },
        data: {
          editedCopyText: body.editedCopyText,
        },
      });
      
      return reply.send({
        success: true,
        message: 'Texto atualizado',
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao editar:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/manual/report-error/:id
   * Reporta um erro em um post manual
   */
  app.post('/report-error/:id', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = ReportErrorSchema.parse(request.body);
      
      const item = await prisma.promotionChannel.findUnique({
        where: { id },
      });
      
      if (!item) {
        return sendError(reply, Errors.NOT_FOUND('Item'));
      }
      
      const result = await prisma.promotionChannel.update({
        where: { id },
        data: {
          status: 'ERROR',
          errorReason: body.reason,
        },
      });
      
      return reply.send({
        success: true,
        message: 'Erro reportado',
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao reportar:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/manual/reset/:id
   * Reseta um item para READY_MANUAL (ex: após erro)
   */
  app.post('/reset/:id', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const item = await prisma.promotionChannel.findUnique({
        where: { id },
      });
      
      if (!item) {
        return sendError(reply, Errors.NOT_FOUND('Item'));
      }
      
      if (item.channelMode !== 'MANUAL') {
        return reply.status(400).send({
          success: false,
          error: { code: 'NOT_MANUAL', message: 'Este item não é de canal manual' },
        });
      }
      
      const result = await prisma.promotionChannel.update({
        where: { id },
        data: {
          status: 'READY_MANUAL',
          errorReason: null,
          manualDoneAt: null,
          manualDoneById: null,
        },
      });
      
      return reply.send({
        success: true,
        message: 'Item resetado para fila manual',
        data: result,
      });
    } catch (error: any) {
      console.error('Erro ao resetar:', error);
      return sendError(reply, error);
    }
  });

  /**
   * GET /api/manual/done-today
   * Lista posts manuais concluídos hoje
   */
  app.get('/done-today', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { channel } = request.query as { channel?: string };
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const where: any = {
        channelMode: 'MANUAL',
        status: 'DONE_MANUAL',
        manualDoneAt: { gte: today },
      };
      
      if (channel) {
        where.channel = channel.toUpperCase();
      }
      
      const items = await prisma.promotionChannel.findMany({
        where,
        include: {
          draft: {
            include: {
              offer: {
                include: {
                  store: { select: { name: true } },
                  niche: { select: { name: true, icon: true } },
                },
              },
            },
          },
        },
        orderBy: { manualDoneAt: 'desc' },
      });
      
      return reply.send({
        success: true,
        data: items,
        count: items.length,
      });
    } catch (error: any) {
      console.error('Erro ao listar concluídos:', error);
      return sendError(reply, error);
    }
  });

  /**
   * GET /api/manual/item/:id
   * Detalhes de um item específico
   */
  app.get('/item/:id', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const item = await prisma.promotionChannel.findUnique({
        where: { id },
        include: {
          draft: {
            include: {
              offer: {
                include: {
                  store: true,
                  niche: true,
                  affiliateProgram: true,
                },
              },
            },
          },
        },
      });
      
      if (!item) {
        return sendError(reply, Errors.NOT_FOUND('Item'));
      }
      
      return reply.send({
        success: true,
        data: item,
      });
    } catch (error: any) {
      console.error('Erro ao buscar item:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/manual/regenerate-copy/:id
   * Regenera a copy de um item (com novo estilo ou mesma configuração)
   */
  app.post('/regenerate-copy/:id', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z.object({
        humorStyle: z.enum(['URUBU', 'NEUTRO', 'FLASH', 'ENGRACADO']).optional(),
      }).parse(request.body || {});
      
      const item = await prisma.promotionChannel.findUnique({
        where: { id },
        include: {
          draft: {
            include: {
              offer: {
                include: { store: true },
              },
            },
          },
        },
      });
      
      if (!item) {
        return sendError(reply, Errors.NOT_FOUND('Item'));
      }
      
      const humorStyle = body.humorStyle || item.humorStyle || 'URUBU';
      
      // Regenerar copy
      const copy = generateUruboCopy({
        title: item.draft.offer.title,
        price: Number(item.draft.offer.finalPrice),
        oldPrice: item.draft.offer.originalPrice ? Number(item.draft.offer.originalPrice) : undefined,
        discountPct: item.draft.offer.discountPct,
        channel: item.channel,
        humorStyle: humorStyle as any,
        trackingUrl: item.goUrl || item.finalUrl || '',
        storeName: item.draft.offer.store?.name,
        promoType: item.draft.offer.promoType,
        couponCode: item.draft.offer.couponCode || undefined,
      });
      
      const result = await prisma.promotionChannel.update({
        where: { id },
        data: {
          copyText: copy.text,
          humorStyle: humorStyle as any,
          editedCopyText: null, // Limpa edição anterior
        },
      });
      
      return reply.send({
        success: true,
        message: 'Copy regenerada',
        data: {
          ...result,
          newCopyText: copy.text,
          charCount: copy.charCount,
        },
      });
    } catch (error: any) {
      console.error('Erro ao regenerar copy:', error);
      return sendError(reply, error);
    }
  });
}
