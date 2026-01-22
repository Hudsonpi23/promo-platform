/**
 * 🔥 Channel Scheduler - Sistema de Filas por Canal
 * 
 * Cada canal tem sua própria fila e ritmo de publicação.
 * O scheduler roda periodicamente e processa as filas respeitando:
 * - Intervalo mínimo entre posts
 * - Horário de funcionamento
 * - Limite diário
 */

import { prisma } from '../lib/prisma.js';
import { Channel, ChannelPostStatus } from '@prisma/client';

// ==================== CONFIGURAÇÃO POR CANAL ====================

export const CHANNEL_RULES: Record<string, {
  intervalMin: number;      // Intervalo mínimo em minutos
  dailyLimit: number;       // Limite diário (0 = sem limite)
  activeHours: string;      // Horário de funcionamento
}> = {
  TELEGRAM: { intervalMin: 15, dailyLimit: 0, activeHours: '08:00-23:00' },
  WHATSAPP: { intervalMin: 180, dailyLimit: 10, activeHours: '09:00-21:00' },
  TWITTER: { intervalMin: 15, dailyLimit: 30, activeHours: '08:00-23:00' },
  INSTAGRAM: { intervalMin: 360, dailyLimit: 4, activeHours: '10:00-22:00' },
  FACEBOOK: { intervalMin: 300, dailyLimit: 6, activeHours: '09:00-21:00' },
  SITE: { intervalMin: 1, dailyLimit: 0, activeHours: '00:00-23:59' },
};

// ==================== UTILS ====================

/**
 * Calcula minutos entre duas datas
 */
function minutesBetween(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60);
}

/**
 * Verifica se estamos no horário de funcionamento
 */
function isWithinActiveHours(activeHours: string): boolean {
  const [start, end] = activeHours.split('-');
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  return currentTime >= start && currentTime <= end;
}

/**
 * Conta posts do dia para um canal
 */
async function getTodayPostCount(channel: Channel): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const count = await prisma.promotionChannel.count({
    where: {
      channel,
      status: 'POSTED',
      postedAt: {
        gte: today,
      },
    },
  });
  
  return count;
}

// ==================== PUBLISHERS ====================

/**
 * Publica no Telegram
 */
async function publishToTelegram(channelRecord: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return { success: false, error: 'Telegram não configurado' };
    }

    const text = channelRecord.copyText;
    
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

/**
 * Publica no Site
 */
async function publishToSite(channelRecord: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    const draft = await prisma.postDraft.findUnique({
      where: { id: channelRecord.draftId },
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
      return { success: false, error: 'Draft ou oferta não encontrada' };
    }

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
        copyText: channelRecord.copyText || draft.copyText,
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

/**
 * Publica no Twitter/X
 */
async function publishToTwitter(channelRecord: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    // Importar serviço de Twitter
    const { sendTweet } = await import('./twitter.js');
    
    const draft = await prisma.postDraft.findUnique({
      where: { id: channelRecord.draftId },
      include: { offer: true },
    });

    const text = channelRecord.copyText;
    const imageUrl = draft?.imageUrl || draft?.offer?.imageUrl;

    const result = await sendTweet(text, imageUrl);
    
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Router de publicação por canal
 */
async function publishToChannel(
  channel: Channel,
  channelRecord: any
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  switch (channel) {
    case 'TELEGRAM':
      return publishToTelegram(channelRecord);
    case 'SITE':
      return publishToSite(channelRecord);
    case 'TWITTER':
      return publishToTwitter(channelRecord);
    // WhatsApp, Instagram, Facebook - implementar conforme APIs disponíveis
    default:
      console.log(`[Scheduler] Canal ${channel} não implementado, marcando como publicado`);
      return { success: true, externalId: `mock_${Date.now()}` };
  }
}

// ==================== SCHEDULER PRINCIPAL ====================

/**
 * 🔥 Executa o scheduler para um canal específico
 * 
 * Lógica:
 * 1. Verifica se está no horário de funcionamento
 * 2. Verifica intervalo desde último post
 * 3. Verifica limite diário
 * 4. Pega próximo item da fila
 * 5. Publica e atualiza status
 */
export async function processChannelQueue(channel: Channel): Promise<{
  processed: boolean;
  reason?: string;
  postId?: string;
}> {
  const rule = CHANNEL_RULES[channel] || { intervalMin: 60, dailyLimit: 0, activeHours: '08:00-22:00' };

  // 1. Verificar horário de funcionamento
  if (!isWithinActiveHours(rule.activeHours)) {
    return { processed: false, reason: `Fora do horário (${rule.activeHours})` };
  }

  // 2. Verificar intervalo desde último post
  const lastPost = await prisma.promotionChannel.findFirst({
    where: { channel, status: 'POSTED' },
    orderBy: { postedAt: 'desc' },
  });

  if (lastPost && lastPost.postedAt) {
    const diffMinutes = minutesBetween(new Date(), lastPost.postedAt);
    if (diffMinutes < rule.intervalMin) {
      return { 
        processed: false, 
        reason: `Aguardando intervalo (${Math.ceil(rule.intervalMin - diffMinutes)} min restantes)` 
      };
    }
  }

  // 3. Verificar limite diário
  if (rule.dailyLimit > 0) {
    const todayCount = await getTodayPostCount(channel);
    if (todayCount >= rule.dailyLimit) {
      return { processed: false, reason: `Limite diário atingido (${todayCount}/${rule.dailyLimit})` };
    }
  }

  // 4. Pegar próximo item da fila (FIFO)
  const nextInQueue = await prisma.promotionChannel.findFirst({
    where: { channel, status: 'QUEUED' },
    orderBy: { queuedAt: 'asc' },
    include: {
      draft: {
        include: {
          offer: true,
        },
      },
    },
  });

  if (!nextInQueue) {
    return { processed: false, reason: 'Fila vazia' };
  }

  // 5. Publicar
  console.log(`[Scheduler] Publicando no ${channel}: ${nextInQueue.draft.offer.title}`);

  try {
    const result = await publishToChannel(channel, nextInQueue);

    if (result.success) {
      // Sucesso - marcar como POSTED
      await prisma.promotionChannel.update({
        where: { id: nextInQueue.id },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          externalId: result.externalId,
        },
      });

      console.log(`[Scheduler] ✅ Publicado com sucesso no ${channel}`);
      return { processed: true, postId: nextInQueue.id };
    } else {
      // Erro - marcar como ERROR
      await prisma.promotionChannel.update({
        where: { id: nextInQueue.id },
        data: {
          status: 'ERROR',
          errorReason: result.error,
        },
      });

      console.error(`[Scheduler] ❌ Erro ao publicar no ${channel}: ${result.error}`);
      return { processed: false, reason: result.error };
    }
  } catch (error: any) {
    // Erro inesperado
    await prisma.promotionChannel.update({
      where: { id: nextInQueue.id },
      data: {
        status: 'ERROR',
        errorReason: error.message,
      },
    });

    console.error(`[Scheduler] ❌ Erro inesperado no ${channel}: ${error.message}`);
    return { processed: false, reason: error.message };
  }
}

/**
 * 🔥 Executa o scheduler para TODOS os canais
 * 
 * Cada canal é processado independentemente.
 * Um canal nunca trava o outro.
 */
export async function runScheduler(): Promise<{
  results: Record<string, { processed: boolean; reason?: string; postId?: string }>;
  timestamp: string;
}> {
  console.log('[Scheduler] ========== INICIANDO CICLO ==========');
  
  const channels: Channel[] = ['TELEGRAM', 'WHATSAPP', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'SITE'];
  const results: Record<string, { processed: boolean; reason?: string; postId?: string }> = {};

  for (const channel of channels) {
    try {
      results[channel] = await processChannelQueue(channel);
      console.log(`[Scheduler] ${channel}: ${results[channel].processed ? '✅' : '⏳'} ${results[channel].reason || 'OK'}`);
    } catch (error: any) {
      results[channel] = { processed: false, reason: error.message };
      console.error(`[Scheduler] ${channel}: ❌ ${error.message}`);
    }
  }

  console.log('[Scheduler] ========== CICLO FINALIZADO ==========');

  return {
    results,
    timestamp: new Date().toISOString(),
  };
}

// ==================== FUNÇÕES DE GERENCIAMENTO ====================

/**
 * Adiciona um item à fila de um canal
 */
export async function addToQueue(draftId: string, channel: Channel, copyText: string, humorStyle: 'URUBU' | 'NEUTRO' | 'FLASH' | 'ENGRACADO' = 'URUBU'): Promise<any> {
  return prisma.promotionChannel.upsert({
    where: {
      draftId_channel: { draftId, channel },
    },
    update: {
      status: 'QUEUED',
      queuedAt: new Date(),
      copyText,
      humorStyle,
      errorReason: null,
    },
    create: {
      draftId,
      channel,
      copyText,
      humorStyle,
      status: 'QUEUED',
      queuedAt: new Date(),
    },
  });
}

/**
 * Remove um item da fila (volta para PENDING)
 */
export async function removeFromQueue(draftId: string, channel: Channel): Promise<any> {
  return prisma.promotionChannel.update({
    where: {
      draftId_channel: { draftId, channel },
    },
    data: {
      status: 'PENDING',
      queuedAt: null,
    },
  });
}

/**
 * Obtém status das filas de todos os canais
 */
export async function getQueuesStatus(): Promise<Record<string, {
  queued: number;
  postedToday: number;
  errors: number;
  lastPost?: Date;
  nextAllowedPost?: Date;
}>> {
  const channels: Channel[] = ['TELEGRAM', 'WHATSAPP', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'SITE'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result: Record<string, any> = {};

  for (const channel of channels) {
    const rule = CHANNEL_RULES[channel];

    // Contar na fila
    const queued = await prisma.promotionChannel.count({
      where: { channel, status: 'QUEUED' },
    });

    // Contar postados hoje
    const postedToday = await prisma.promotionChannel.count({
      where: {
        channel,
        status: 'POSTED',
        postedAt: { gte: today },
      },
    });

    // Contar erros de hoje
    const errors = await prisma.promotionChannel.count({
      where: {
        channel,
        status: 'ERROR',
        updatedAt: { gte: today },
      },
    });

    // Último post
    const lastPost = await prisma.promotionChannel.findFirst({
      where: { channel, status: 'POSTED' },
      orderBy: { postedAt: 'desc' },
      select: { postedAt: true },
    });

    // Calcular próximo post permitido
    let nextAllowedPost: Date | undefined;
    if (lastPost?.postedAt) {
      nextAllowedPost = new Date(lastPost.postedAt.getTime() + rule.intervalMin * 60 * 1000);
    }

    result[channel] = {
      queued,
      postedToday,
      errors,
      lastPost: lastPost?.postedAt,
      nextAllowedPost,
      intervalMin: rule.intervalMin,
      dailyLimit: rule.dailyLimit,
    };
  }

  return result;
}

/**
 * Obtém execuções do dia (posts publicados hoje)
 */
export async function getTodayExecutions(): Promise<any[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.promotionChannel.findMany({
    where: {
      status: 'POSTED',
      postedAt: { gte: today },
    },
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
    orderBy: { postedAt: 'desc' },
  });
}

/**
 * Obtém erros recentes
 */
export async function getRecentErrors(limit: number = 50): Promise<any[]> {
  return prisma.promotionChannel.findMany({
    where: {
      status: 'ERROR',
    },
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
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
}
