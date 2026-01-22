/**
 * Rotas de Canais de Promoção
 * 
 * Gerencia estados independentes de publicação por canal.
 * Cada promoção (draft) pode ter múltiplos canais com status próprios.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { sendError, Errors } from '../lib/errors.js';
import { generateCopies } from '../services/aiCopyGenerator.js';

// ==================== SCHEMAS ====================

const ChannelEnum = z.enum(['TELEGRAM', 'WHATSAPP', 'FACEBOOK', 'TWITTER', 'INSTAGRAM', 'SITE']);
const ChannelStatusEnum = z.enum(['PENDING', 'QUEUED', 'POSTED', 'ERROR', 'READY_MANUAL', 'DONE_MANUAL']);
const ChannelModeEnum = z.enum(['AUTO', 'MANUAL']);

const CreateChannelSchema = z.object({
  channel: ChannelEnum,
  copyText: z.string().optional(),
  channelMode: ChannelModeEnum.optional().default('AUTO'),
  scheduledAt: z.string().datetime().optional(),
});

const UpdateChannelSchema = z.object({
  copyText: z.string().optional(),
  status: ChannelStatusEnum.optional(),
  channelMode: ChannelModeEnum.optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
});

const PublishChannelSchema = z.object({
  // Opções adicionais para publicação
  force: z.boolean().optional().default(false),
});

// ==================== DEFAULTS ====================

// Configuração padrão de automação por canal
// PENDING = automático, READY_MANUAL = precisa ação manual
const CHANNEL_DEFAULTS: Record<string, { channelMode: 'AUTO' | 'MANUAL'; status: 'PENDING' | 'READY_MANUAL' }> = {
  TELEGRAM: { channelMode: 'AUTO', status: 'PENDING' },
  WHATSAPP: { channelMode: 'AUTO', status: 'PENDING' },
  SITE: { channelMode: 'AUTO', status: 'PENDING' },
  TWITTER: { channelMode: 'MANUAL', status: 'READY_MANUAL' },
  INSTAGRAM: { channelMode: 'MANUAL', status: 'READY_MANUAL' },
  FACEBOOK: { channelMode: 'MANUAL', status: 'READY_MANUAL' },
};

// ==================== ROUTES ====================

export async function promotionChannelsRoutes(app: FastifyInstance) {
  
  /**
   * GET /api/drafts/:draftId/channels
   * Lista todos os canais de uma promoção
   */
  app.get('/:draftId/channels', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };

      const channels = await prisma.promotionChannel.findMany({
        where: { draftId },
        orderBy: { channel: 'asc' },
      });

      // Se não houver canais, retornar lista vazia com defaults
      if (channels.length === 0) {
        return reply.send({
          success: true,
          data: Object.entries(CHANNEL_DEFAULTS).map(([channel, config]) => ({
            draftId,
            channel,
            status: config.status,
            channelMode: config.channelMode,
            copyText: null,
            queuedAt: null,
            postedAt: null,
            errorReason: null,
            _isPlaceholder: true,
          })),
        });
      }

      return reply.send({
        success: true,
        data: channels,
      });
    } catch (error: any) {
      console.error('Erro ao listar canais:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/drafts/:draftId/channels/initialize
   * Inicializa todos os canais para uma promoção com configurações padrão
   */
  app.post('/:draftId/channels/initialize', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };

      // Verificar se draft existe
      const draft = await prisma.postDraft.findUnique({
        where: { id: draftId },
        include: {
          offer: {
            include: {
              niche: { select: { name: true } },
              store: { select: { name: true } },
            },
          },
        },
      });

      if (!draft) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }

      // Gerar copies para cada canal
      const copies = generateCopies({
        title: draft.offer.title,
        price: Number(draft.offer.finalPrice),
        oldPrice: draft.offer.originalPrice ? Number(draft.offer.originalPrice) : null,
        discountPct: draft.offer.discountPct || 0,
        advertiserName: draft.offer.store?.name,
        storeName: draft.offer.store?.name,
        category: draft.offer.niche?.name,
        trackingUrl: draft.offer.affiliateUrl,
      });

      // Criar canais
      const channelsToCreate = Object.entries(CHANNEL_DEFAULTS).map(([channel, config]) => {
        let copyText = '';
        
        switch (channel) {
          case 'TELEGRAM':
          case 'WHATSAPP':
            copyText = copies.telegram;
            break;
          case 'SITE':
            copyText = copies.site;
            break;
          case 'TWITTER':
          case 'INSTAGRAM':
          case 'FACEBOOK':
            copyText = copies.x;
            break;
        }

        return {
          draftId,
          channel: channel as any,
          copyText,
          status: config.status as any,
          channelMode: config.channelMode as any,
        };
      });

      // Upsert para não duplicar
      const results = await Promise.all(
        channelsToCreate.map(data =>
          prisma.promotionChannel.upsert({
            where: {
              draftId_channel: {
                draftId: data.draftId,
                channel: data.channel,
              },
            },
            update: {
              copyText: data.copyText,
              status: data.status,
              channelMode: data.channelMode,
            },
            create: data,
          })
        )
      );

      return reply.send({
        success: true,
        message: `${results.length} canais inicializados`,
        data: results,
      });
    } catch (error: any) {
      console.error('Erro ao inicializar canais:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/drafts/:draftId/channels
   * Cria ou atualiza um canal específico
   */
  app.post('/:draftId/channels', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };
      const body = CreateChannelSchema.parse(request.body);

      // Verificar se draft existe
      const draft = await prisma.postDraft.findUnique({
        where: { id: draftId },
      });

      if (!draft) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }

      // Upsert do canal
      const channel = await prisma.promotionChannel.upsert({
        where: {
          draftId_channel: {
            draftId,
            channel: body.channel,
          },
        },
        update: {
          copyText: body.copyText,
          channelMode: body.channelMode,
          queuedAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
          status: body.channelMode === 'AUTO' ? 'PENDING' : 'READY_MANUAL',
        },
        create: {
          draftId,
          channel: body.channel,
          copyText: body.copyText || '',
          channelMode: body.channelMode,
          queuedAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
          status: body.channelMode === 'AUTO' ? 'PENDING' : 'READY_MANUAL',
        },
      });

      return reply.status(201).send({
        success: true,
        data: channel,
      });
    } catch (error: any) {
      console.error('Erro ao criar canal:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * PATCH /api/drafts/:draftId/channels/:channel
   * Atualiza um canal específico
   */
  app.patch('/:draftId/channels/:channel', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId, channel } = request.params as { draftId: string; channel: string };
      const body = UpdateChannelSchema.parse(request.body);

      // Verificar se canal existe
      const existing = await prisma.promotionChannel.findUnique({
        where: {
          draftId_channel: {
            draftId,
            channel: channel as any,
          },
        },
      });

      if (!existing) {
        return sendError(reply, Errors.NOT_FOUND('Canal'));
      }

      const updated = await prisma.promotionChannel.update({
        where: {
          draftId_channel: {
            draftId,
            channel: channel as any,
          },
        },
        data: {
          ...(body.copyText !== undefined && { copyText: body.copyText }),
          ...(body.status !== undefined && { status: body.status }),
          ...(body.channelMode !== undefined && { channelMode: body.channelMode }),
          ...(body.scheduledAt !== undefined && { 
            queuedAt: body.scheduledAt ? new Date(body.scheduledAt) : null 
          }),
        },
      });

      return reply.send({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar canal:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/drafts/:draftId/channels/:channel/publish
   * Publica uma promoção em um canal específico
   */
  app.post('/:draftId/channels/:channel/publish', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId, channel } = request.params as { draftId: string; channel: string };
      const body = PublishChannelSchema.parse(request.body || {});

      // Buscar canal com draft e offer
      const promotionChannel = await prisma.promotionChannel.findUnique({
        where: {
          draftId_channel: {
            draftId,
            channel: channel as any,
          },
        },
        include: {
          draft: {
            include: {
              offer: {
                include: {
                  niche: true,
                  store: true,
                },
              },
            },
          },
        },
      });

      if (!promotionChannel) {
        return sendError(reply, Errors.NOT_FOUND('Canal'));
      }

      // Verificar se já foi publicado
      if (promotionChannel.status === 'POSTED' && !body.force) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'ALREADY_PUBLISHED',
            message: 'Este canal já foi publicado. Use force=true para republicar.',
          },
        });
      }

      // Verificar se tem copy
      if (!promotionChannel.copyText) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'NO_COPY',
            message: 'Copy não definida para este canal.',
          },
        });
      }

      let publishResult: { success: boolean; externalId?: string; error?: string } = { success: false };

      // Executar publicação baseado no canal
      try {
        switch (channel) {
          case 'TELEGRAM':
            publishResult = await publishToTelegram(promotionChannel, promotionChannel.draft);
            break;
          case 'SITE':
            publishResult = await publishToSite(promotionChannel, promotionChannel.draft);
            break;
          case 'TWITTER':
            publishResult = await publishToTwitter(promotionChannel, promotionChannel.draft);
            break;
          // WhatsApp, Instagram, Facebook - implementar conforme necessário
          default:
            publishResult = { success: true, externalId: `mock_${Date.now()}` };
        }
      } catch (publishError: any) {
        publishResult = { success: false, error: publishError.message };
      }

      // Atualizar status do canal
      const updatedChannel = await prisma.promotionChannel.update({
        where: {
          draftId_channel: {
            draftId,
            channel: channel as any,
          },
        },
        data: {
          status: publishResult.success ? 'POSTED' : 'ERROR',
          postedAt: publishResult.success ? new Date() : null,
          externalId: publishResult.externalId || null,
          errorReason: publishResult.error || null,
        },
      });

      if (!publishResult.success) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'PUBLISH_ERROR',
            message: publishResult.error || 'Erro ao publicar',
          },
          data: updatedChannel,
        });
      }

      return reply.send({
        success: true,
        message: `Publicado com sucesso no ${channel}`,
        data: updatedChannel,
      });
    } catch (error: any) {
      console.error('Erro ao publicar:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/drafts/:draftId/channels/publish-all
   * Publica em todos os canais com autoPublish=true
   */
  app.post('/:draftId/channels/publish-all', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };

      // Buscar todos os canais com channelMode AUTO
      const channels = await prisma.promotionChannel.findMany({
        where: {
          draftId,
          channelMode: 'AUTO',
          status: { in: ['PENDING', 'QUEUED', 'READY_MANUAL'] },
        },
        include: {
          draft: {
            include: {
              offer: {
                include: {
                  niche: true,
                  store: true,
                },
              },
            },
          },
        },
      });

      const results = [];

      for (const ch of channels) {
        let success = false;
        let error = '';

        try {
          switch (ch.channel) {
            case 'TELEGRAM':
              const tgResult = await publishToTelegram(ch, ch.draft);
              success = tgResult.success;
              error = tgResult.error || '';
              break;
            case 'SITE':
              const siteResult = await publishToSite(ch, ch.draft);
              success = siteResult.success;
              error = siteResult.error || '';
              break;
            default:
              success = true;
          }
        } catch (e: any) {
          error = e.message;
        }

        // Atualizar status
        const updated = await prisma.promotionChannel.update({
          where: {
            draftId_channel: {
              draftId,
              channel: ch.channel,
            },
          },
          data: {
            status: success ? 'POSTED' : 'ERROR',
            postedAt: success ? new Date() : null,
            errorReason: error || null,
          },
        });

        results.push({ channel: ch.channel, success, error });
      }

      return reply.send({
        success: true,
        message: `Processados ${results.length} canais`,
        data: results,
      });
    } catch (error: any) {
      console.error('Erro ao publicar todos:', error);
      return sendError(reply, error);
    }
  });

  /**
   * GET /api/drafts/:draftId/channels/status
   * Retorna resumo de status de todos os canais
   */
  app.get('/:draftId/channels/status', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };

      const channels = await prisma.promotionChannel.findMany({
        where: { draftId },
        select: {
          channel: true,
          status: true,
          channelMode: true,
          postedAt: true,
          errorReason: true,
        },
      });

      // Montar resumo
      const summary = {
        total: channels.length,
        posted: channels.filter(c => c.status === 'POSTED').length,
        queued: channels.filter(c => c.status === 'QUEUED').length,
        readyManual: channels.filter(c => c.status === 'READY_MANUAL').length,
        doneManual: channels.filter(c => c.status === 'DONE_MANUAL').length,
        error: channels.filter(c => c.status === 'ERROR').length,
        pending: channels.filter(c => c.status === 'PENDING').length,
        channels,
      };

      return reply.send({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      console.error('Erro ao obter status:', error);
      return sendError(reply, error);
    }
  });
}

// ==================== FUNÇÕES DE PUBLICAÇÃO ====================

async function publishToTelegram(
  channel: any,
  draft: any
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return { success: false, error: 'Telegram não configurado' };
    }

    const text = channel.copyText || draft.copyText;
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const result = await response.json() as any;

    if (result.ok) {
      return { success: true, externalId: String(result.result.message_id) };
    } else {
      return { success: false, error: result.description || 'Erro ao enviar para Telegram' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function publishToSite(
  channel: any,
  draft: any
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const offer = draft.offer;
    
    // Gerar slug e goCode
    const slug = offer.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
    
    const goCode = `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;

    // Criar PublishedPost
    const published = await prisma.publishedPost.create({
      data: {
        offerId: offer.id,
        slug: `${slug}-${goCode}`,
        goCode,
        title: offer.title,
        copyText: channel.copyText || draft.copyText,
        price: offer.finalPrice,
        originalPrice: offer.originalPrice,
        discountPct: offer.discountPct || 0,
        affiliateUrl: offer.affiliateUrl,
        imageUrl: offer.imageUrl,
        urgency: offer.urgency || 'NORMAL',
        nicheId: offer.nicheId,
        storeId: offer.storeId,
        isActive: true,
      },
    });

    return { success: true, externalId: published.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function publishToTwitter(
  channel: any,
  draft: any
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    // Importar serviço de Twitter
    const { postTweet } = await import('../services/twitter.js');
    
    const text = channel.copyText || draft.copyTextX || draft.copyText;

    const result = await postTweet(text);
    
    return { 
      success: result.success, 
      externalId: result.tweetId, 
      error: result.error 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
