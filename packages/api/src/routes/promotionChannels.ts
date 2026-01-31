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
import axios from 'axios';
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
   * GET /api/drafts/:draftId/channels/debug-text
   * Endpoint de debug para verificar o texto que será gerado para Telegram
   * 
   * Como usar:
   * 1. Pegue o ID do draft da URL ou do console do navegador
   * 2. Acesse: http://localhost:3001/api/drafts/[ID]/channels/debug-text
   * 3. Ou use: GET /api/offers/[offerId]/debug-telegram-text (mais fácil)
   */
  app.get('/:draftId/channels/debug-text', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };
      
      const draft = await prisma.postDraft.findUnique({
        where: { id: draftId },
        include: {
          offer: {
            include: {
              niche: true,
              store: true,
            },
          },
        },
      });
      
      if (!draft || !draft.offer) {
        return reply.status(404).send({
          success: false,
          error: 'Draft ou offer não encontrado',
        });
      }
      
      // Gerar o texto exatamente como seria gerado para publicação
      const { generateCopies } = await import('../services/aiCopyGenerator.js');
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
      
      const text = copies.telegram;
      
      // Análise do texto
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      const hasOnlyLink = lines.length <= 1;
      
      return reply.send({
        success: true,
        data: {
          text,
          textLength: text.length,
          lines: text.split('\n'),
          nonEmptyLines: lines.length,
          firstLine: lines[0] || '',
          restOfText: lines.slice(1).join('\n'),
          hasOnlyLink,
          analysis: {
            hasLink: text.includes(draft.offer.affiliateUrl),
            hasOpening: lines.length > 1 && !lines[1].startsWith('http'),
            hasPrice: text.includes('R$') || text.includes('POR') || text.includes('DE'),
            hasTitle: text.includes(draft.offer.title.toUpperCase().substring(0, 20)),
          },
          rawText: JSON.stringify(text),
        },
      });
    } catch (error: any) {
      console.error('[Debug] Erro ao gerar texto de debug:', error);
      return sendError(reply, error);
    }
  });
  
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
    // OBRIGATÓRIO: SEMPRE regenerar copy usando sistema de frases personalizadas
    // Isso garante que drafts antigos também usem as novas frases sarcásticas
    const { generateCopies } = await import('../services/aiCopyGenerator.js');
    const { sendTelegramMessage, sendTelegramPhoto } = await import('../services/telegram.js');
    
    let text: string | null = null;
    
    if (draft.offer) {
      // SEMPRE gerar usando sistema de frases personalizadas (frases sarcásticas em MAIÚSCULAS)
      // O formato já vem correto: frase → preço com emoji → título → link
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
      text = copies.telegram; // Já está no formato correto e em MAIÚSCULAS
      
      // LOG: Verificar se o texto foi gerado corretamente
      console.log('[publishToTelegram] ✅ Texto gerado com sucesso');
      console.log('[publishToTelegram] Tamanho do texto:', text.length, 'caracteres');
      console.log('[publishToTelegram] Primeiros 200 chars:', text.substring(0, 200));
    } else {
      console.error('[publishToTelegram] ❌ ERRO: draft.offer não encontrado!');
    }
    
    // Fallback apenas se não conseguir gerar
    if (!text || text.trim().length < 10) {
      console.warn('[publishToTelegram] ⚠️ Texto muito curto ou vazio, usando fallback');
      console.warn('[publishToTelegram] Copy vazio, usando fallback');
      const formatPrice = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
      
      // Link PRIMEIRO (garante preview do Telegram) - sempre em minúsculas
      const affiliateUrl = (draft.offer?.affiliateUrl || '').toLowerCase();
      let fallbackText = `${affiliateUrl}\n\nACHADO NÃO É ROUBADO\n`;
      if (draft.offer?.originalPrice && draft.offer?.discountPct) {
        fallbackText += `SAIU DE ${formatPrice(draft.offer.originalPrice).toUpperCase()} PRA ${formatPrice(draft.offer.finalPrice).toUpperCase()}`;
        if (draft.offer.discountPct >= 20) {
          fallbackText += ' 🔥';
        }
        fallbackText += ` (-${Math.round(draft.offer.discountPct)}% OFF)`;
      } else {
        fallbackText += `POR ${formatPrice(draft.offer.finalPrice).toUpperCase()}`;
      }
      fallbackText += `\n\n${(draft.offer?.title || 'PRODUTO').toUpperCase()}`;
      text = fallbackText;
    }
    
    // VALIDAÇÃO: Garantir que tem texto
    if (!text || text.trim().length === 0) {
      console.error('[publishToTelegram] ❌ ERRO CRÍTICO: Texto do post está completamente vazio!');
      return { success: false, error: 'Texto do post está vazio' };
    }
    
    // LOG FINAL: Confirmar texto antes de enviar
    console.log('[publishToTelegram] 📤 Preparando envio final:');
    console.log('[publishToTelegram] Texto final COMPLETO:', JSON.stringify(text));
    console.log('[publishToTelegram] Tamanho final do texto:', text.length, 'caracteres');
    console.log('[publishToTelegram] Linhas do texto:', text.split('\n').length);
    console.log('[publishToTelegram] Primeira linha (link):', text.split('\n')[0]?.substring(0, 80));
    console.log('[publishToTelegram] Resto do texto:', text.split('\n').slice(1).join('\n').substring(0, 300));
    
    // VALIDAÇÃO CRÍTICA: Garantir que há conteúdo além do link
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    console.log('[publishToTelegram] Linhas não vazias:', lines.length);
    console.log('[publishToTelegram] Todas as linhas:', lines.map(l => l.substring(0, 50)));
    
    // VALIDAÇÃO ABSOLUTA: Se tiver apenas link, FORÇAR conteúdo
    if (lines.length <= 1 || text.trim() === draft.offer?.affiliateUrl) {
      console.error('[publishToTelegram] ❌❌❌ ERRO CRÍTICO: Texto contém apenas o link!');
      console.error('[publishToTelegram] Texto atual:', JSON.stringify(text));
      console.error('[publishToTelegram] AffiliateUrl:', draft.offer?.affiliateUrl);
      
      // Forçar adição de conteúdo mínimo - GARANTIR QUE SEMPRE TENHA TEXTO
      const formatPrice = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
      
      const link = (draft.offer?.affiliateUrl || '').toLowerCase();
      const title = (draft.offer?.title || 'PRODUTO').toUpperCase().substring(0, 50);
      const price = formatPrice(draft.offer?.finalPrice || 0).toUpperCase();
      const originalPrice = draft.offer?.originalPrice ? formatPrice(draft.offer.originalPrice).toUpperCase() : null;
      const discountPct = draft.offer?.discountPct || 0;
      
      // Construir texto garantido com TODOS os elementos
      let guaranteedText = `${link}\n\n`;
      guaranteedText += `ACHADO NÃO É ROUBADO 🔥\n\n`;
      
      if (originalPrice && discountPct > 0) {
        guaranteedText += `SAIU DE ${originalPrice} PRA ${price}`;
        if (discountPct >= 20) {
          guaranteedText += ' 🔥';
        }
        guaranteedText += ` (-${Math.round(discountPct)}% OFF)`;
      } else {
        guaranteedText += `POR ${price}`;
      }
      
      guaranteedText += `\n\n${title}`;
      
      text = guaranteedText;
      console.log('[publishToTelegram] ✅✅✅ Texto FORÇADO com conteúdo garantido:');
      console.log('[publishToTelegram] Novo texto:', JSON.stringify(text));
      console.log('[publishToTelegram] Novo tamanho:', text.length);
      console.log('[publishToTelegram] Novas linhas não vazias:', text.split('\n').filter(l => l.trim().length > 0).length);
    }
    
    // VALIDAÇÃO FINAL ABSOLUTA: Se ainda tiver apenas link, adicionar conteúdo mínimo
    const finalLines = text.split('\n').filter(line => line.trim().length > 0);
    if (finalLines.length <= 1 || text.trim() === draft.offer?.affiliateUrl) {
      console.error('[publishToTelegram] ❌❌❌ ERRO EXTREMO: Ainda apenas link após correção!');
      // Último recurso: adicionar texto mínimo
      const link = (draft.offer?.affiliateUrl || '').toLowerCase();
      text = `${link}\n\nACHADO NÃO É ROUBADO 🔥`;
      console.log('[publishToTelegram] ✅✅✅ Texto MÍNIMO forçado:', JSON.stringify(text));
    }
    
    // Obter imagem do offer - IMPORTANTE: garantir que a imagem seja enviada
    const offer = draft.offer;
    const images = (offer as any)?.images || [];
    let mainImage = (offer as any)?.mainImage || offer?.imageUrl;
    
    console.log('[publishToTelegram] Verificando imagens disponíveis:');
    console.log('  - mainImage:', mainImage ? mainImage.substring(0, 120) : 'NÃO ENCONTRADA');
    console.log('  - images array:', images.length, 'imagens');
    console.log('  - offer.imageUrl:', offer?.imageUrl ? offer.imageUrl.substring(0, 120) : 'NÃO ENCONTRADA');
    
    // FALLBACK EXTRA: se não houver imagem nem na galeria nem em mainImage,
    // tentar resolver via meta og:image da PÁGINA DO PRODUTO
    // OBS: para links da AWIN (cread.php), precisamos extrair a URL final (?u= ou ?ued=)
    if (!mainImage && (!images || images.length === 0) && offer?.affiliateUrl) {
      try {
        let imagePageUrl = offer.affiliateUrl;

        // Se for link da Awin, extrair a URL real do produto (param u / ued)
        if (imagePageUrl.includes('awin1.com/cread.php')) {
          try {
            const urlObj = new URL(imagePageUrl);
            const uParam = urlObj.searchParams.get('u') || urlObj.searchParams.get('ued') || urlObj.searchParams.get('url');
            if (uParam) {
              imagePageUrl = decodeURIComponent(uParam);
              console.log('[publishToTelegram] Detectado link AWIN, URL final do produto:', imagePageUrl);
            } else {
              console.warn('[publishToTelegram] Link AWIN sem parâmetro de URL final, usando URL original mesmo.');
            }
          } catch (parseErr: any) {
            console.warn('[publishToTelegram] Erro ao parsear URL AWIN:', parseErr.message);
          }
        }

        console.log('[publishToTelegram] Nenhuma imagem local, buscando OG image em:', imagePageUrl);
        const resp = await axios.get(imagePageUrl, { timeout: 15000 });
        const html = String(resp.data || '');
        
        // Procurar meta og:image
        const ogMatch =
          html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        
        if (ogMatch && ogMatch[1]) {
          mainImage = ogMatch[1];
          console.log('[publishToTelegram] OG image encontrada:', mainImage.substring(0, 120));
        } else {
          // Fallback: primeira <img src="http...">
          const imgMatch = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
          if (imgMatch && imgMatch[1]) {
            mainImage = imgMatch[1];
            console.log('[publishToTelegram] Primeira IMG encontrada como fallback:', mainImage.substring(0, 120));
          } else {
            console.warn('[publishToTelegram] Nenhuma imagem encontrada via OG/image tag no HTML do link');
          }
        }
      } catch (resolveErr: any) {
        console.error('[publishToTelegram] Erro ao tentar resolver imagem via OG image:', resolveErr.message);
      }
    }
    
    let result;
    
    // SEMPRE enviar apenas UMA imagem (a primeira disponível)
    // Removido sistema de carrossel - sempre foto única
    if (mainImage || images.length > 0 || offer?.imageUrl) {
      const imageToSend = mainImage || images[0] || offer?.imageUrl;
      
      if (!imageToSend) {
        console.error('[publishToTelegram] ERRO: Tentando enviar foto mas imageToSend está vazio!');
        // Fallback: enviar só texto
        result = await sendTelegramMessage({ text, disableWebPagePreview: false });
      } else {
        console.log('[publishToTelegram] 📷 Enviando foto única (com fallback OG se necessário):', imageToSend.substring(0, 120));
        result = await sendTelegramPhoto(imageToSend, text);
      }
    } else {
      // Sem imagens mesmo após fallback, enviar só texto
      console.warn('[publishToTelegram] ⚠️ Nenhuma imagem encontrada (nem após fallback), enviando apenas texto');
      result = await sendTelegramMessage({ text, disableWebPagePreview: false });
    }
    
    if (result.success) {
      return { success: true, externalId: String(result.messageId) };
    } else {
      return { success: false, error: result.error || 'Erro ao enviar para Telegram' };
    }
  } catch (error: any) {
    console.error('[publishToTelegram] Erro:', error);
    return { success: false, error: error.message || 'Erro desconhecido' };
  }
}

async function publishToSite(
  channel: any,
  draft: any
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const offer = draft.offer;
    
    // OBRIGATÓRIO: SEMPRE regenerar copy usando sistema de frases personalizadas
    // Isso garante que drafts antigos também usem as novas frases sarcásticas
    const { generateCopies } = await import('../services/aiCopyGenerator.js');
    let copyTextForSite: string | null = null;
    
    if (offer) {
      // SEMPRE gerar usando sistema de frases personalizadas (frases sarcásticas em MAIÚSCULAS)
      const copies = generateCopies({
        title: offer.title,
        price: Number(offer.finalPrice),
        oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
        discountPct: offer.discountPct || 0,
        advertiserName: offer.store?.name,
        storeName: offer.store?.name,
        category: offer.niche?.name,
        trackingUrl: offer.affiliateUrl,
      });
      copyTextForSite = copies.site; // Site usa copyTextSite (já está em MAIÚSCULAS)
    }
    
    // Fallback apenas se não conseguir gerar
    if (!copyTextForSite) {
      copyTextForSite = channel.copyText || (draft as any).copyTextSite || draft.copyText;
    }
    
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
        // OBRIGATÓRIO: Usar copyTextSite regenerado (com frases personalizadas em MAIÚSCULAS)
        copyText: copyTextForSite || channel.copyText || (draft as any).copyTextSite || draft.copyText,
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
    const { generateCopies } = await import('../services/aiCopyGenerator.js');
    
    // OBRIGATÓRIO: SEMPRE regenerar copy usando sistema de frases personalizadas
    // Isso garante que drafts antigos também usem as novas frases sarcásticas
    let text: string | null = null;
    
    if (draft.offer) {
      // SEMPRE gerar usando sistema de frases personalizadas (frases sarcásticas em MAIÚSCULAS)
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
      text = copies.x; // X/Twitter usa copyTextX (já está em MAIÚSCULAS)
      
      // LOG: Verificar se o texto foi gerado corretamente
      console.log('[publishToTwitter] ✅ Texto gerado com sucesso');
      console.log('[publishToTwitter] Tamanho do texto:', text.length, 'caracteres');
      console.log('[publishToTwitter] Primeiros 200 chars:', text.substring(0, 200));
      console.log('[publishToTwitter] Frase de abertura:', text.split('\n')[0]);
      console.log('[publishToTwitter] Texto tem emoji?', /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑|💎|⭐|💰|💵|🍎|🌟|💪|⚡/u.test(text));
    }
    
    // Fallback apenas se não conseguir gerar
    if (!text) {
      console.warn('[publishToTwitter] ⚠️ Texto não gerado, usando fallback');
      text = channel.copyText || (draft as any).copyTextX || draft.copyText;
    }
    
    // VALIDAÇÃO: Garantir que o texto tem conteúdo
    if (!text || text.trim().length < 10) {
      console.error('[publishToTwitter] ❌ Texto está vazio ou muito curto!');
      // Forçar geração novamente
      if (draft.offer) {
        const { generateCopies } = await import('../services/aiCopyGenerator.js');
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
        text = copies.x;
        console.log('[publishToTwitter] ✅ Texto regenerado:', text.substring(0, 200));
      }
    }
    
    // Garantir que está em MAIÚSCULAS (exceto link e emojis)
    // NOTA: toUpperCase() preserva emojis automaticamente
    if (text) {
      const lines = text.split('\n');
      const linkLine = lines[lines.length - 1];
      const content = lines.slice(0, -1).join('\n');
      // Converter para maiúsculas apenas o conteúdo (não o link)
      if (linkLine && (linkLine.startsWith('http') || linkLine.includes('👉'))) {
        text = content.toUpperCase() + '\n' + linkLine;
      } else {
        text = text.toUpperCase();
      }
      
      console.log('[publishToTwitter] 📤 Texto final antes de enviar:', text.substring(0, 200));
    }

    // Verificar se há imagens para enviar
    const offer = draft.offer;
    const images = (offer as any)?.images || [];
    const mainImage = (offer as any)?.mainImage || offer?.imageUrl;
    
    console.log('[publishToTwitter] Verificando imagens disponíveis:');
    console.log('  - mainImage:', mainImage ? mainImage.substring(0, 80) : 'NÃO ENCONTRADA');
    console.log('  - images array:', images.length, 'imagens');
    
    let result;
    
    // VALIDAÇÃO CRÍTICA: Garantir que o texto não está vazio antes de enviar
    if (!text || text.trim().length < 5) {
      console.error('[publishToTwitter] ❌❌❌ ERRO CRÍTICO: Texto está vazio antes de enviar!');
      console.error('[publishToTwitter] Texto atual:', JSON.stringify(text));
      // Forçar geração novamente
      if (draft.offer) {
        const { generateCopies } = await import('../services/aiCopyGenerator.js');
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
        text = copies.x;
        console.log('[publishToTwitter] ✅✅✅ Texto regenerado:', text.substring(0, 200));
      }
    }
    
    // Se tem múltiplas imagens (2-4), enviar como carrossel
    if (images.length >= 2 && images.length <= 4) {
      console.log('[publishToTwitter] 📷 Enviando tweet com', images.length, 'imagens (carrossel)');
      console.log('[publishToTwitter] 📤 Texto que será enviado:', text.substring(0, 200));
      const { postTweetWithMultipleImages } = await import('../services/twitter.js');
      result = await postTweetWithMultipleImages(text, images.slice(0, 4));
    }
    // Se tem 1 imagem, enviar com imagem única
    else if (mainImage || images.length === 1) {
      const imageToSend = mainImage || images[0];
      console.log('[publishToTwitter] 📷 Enviando tweet com 1 imagem:', imageToSend.substring(0, 80));
      console.log('[publishToTwitter] 📤 Texto que será enviado:', text.substring(0, 200));
      const { postTweetWithImage } = await import('../services/twitter.js');
      result = await postTweetWithImage(text, imageToSend);
    }
    // Sem imagens, enviar só texto
    else {
      console.log('[publishToTwitter] 📝 Enviando tweet sem imagens');
      console.log('[publishToTwitter] 📤 Texto que será enviado:', text.substring(0, 200));
      result = await postTweet(text);
    }
    
    return { 
      success: result.success, 
      externalId: result.tweetId, 
      error: result.error 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
