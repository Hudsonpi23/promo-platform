/**
 * 🔥 Channel Scheduler - Sistema de Filas por Canal
 * 
 * Cada canal tem sua própria fila e ritmo de publicação.
 * O scheduler roda periodicamente e processa as filas respeitando:
 * - Intervalo mínimo entre posts
 * - Horário de funcionamento
 * - Limite diário
 * - Anti-repetição (hash + cooldown)
 * - Burst mode (Telegram/Site)
 * - Aprovação manual (WhatsApp)
 */

import { prisma } from '../lib/prisma.js';
import { Channel, ChannelPostStatus, AutomationLevel } from '@prisma/client';
import crypto from 'crypto';

// ==================== CONFIGURAÇÃO PADRÃO POR CANAL ====================

export const DEFAULT_CHANNEL_RULES: Record<string, {
  intervalMin: number;
  dailyLimit: number;
  activeHours: string;
  automationLevel: 'TOTAL' | 'MANUAL_APPROVAL' | 'HUMAN_ONLY';
  repostCooldownHours: number;
  burstCooldownSecs: number;
}> = {
  TELEGRAM: { 
    intervalMin: 3, 
    dailyLimit: 0, 
    activeHours: '07:00-23:00',
    automationLevel: 'TOTAL',
    repostCooldownHours: 6,
    burstCooldownSecs: 60,
  },
  SITE: { 
    intervalMin: 1, 
    dailyLimit: 0, 
    activeHours: '00:00-23:59',
    automationLevel: 'TOTAL',
    repostCooldownHours: 6,
    burstCooldownSecs: 60,
  },
  TWITTER: { 
    intervalMin: 15, 
    dailyLimit: 50, 
    activeHours: '08:00-23:00',
    automationLevel: 'TOTAL',
    repostCooldownHours: 24,
    burstCooldownSecs: 120,
  },
  WHATSAPP: { 
    intervalMin: 180, 
    dailyLimit: 10, 
    activeHours: '09:00-21:00',
    automationLevel: 'MANUAL_APPROVAL',
    repostCooldownHours: 24,
    burstCooldownSecs: 0,
  },
  INSTAGRAM: { 
    intervalMin: 360, 
    dailyLimit: 4, 
    activeHours: '10:00-22:00',
    automationLevel: 'HUMAN_ONLY',
    repostCooldownHours: 48,
    burstCooldownSecs: 0,
  },
  FACEBOOK: { 
    intervalMin: 30, 
    dailyLimit: 10, 
    activeHours: '09:00-21:00',
    automationLevel: 'HUMAN_ONLY',
    repostCooldownHours: 24,
    burstCooldownSecs: 0,
  },
};

// Alias para compatibilidade
export const CHANNEL_RULES = DEFAULT_CHANNEL_RULES;

// ==================== UTILS ====================

/**
 * Calcula minutos entre duas datas
 */
function minutesBetween(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60);
}

/**
 * Calcula segundos entre duas datas
 */
function secondsBetween(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime()) / 1000;
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

// ==================== 🔥 ANTI-REPETIÇÃO ====================

/**
 * Gera hash único para detecção de duplicados
 * Hash = offerId + channel + humorStyle
 */
export function generatePostHash(offerId: string, channel: Channel, humorStyle: string): string {
  const input = `${offerId}:${channel}:${humorStyle}`;
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
}

/**
 * Verifica se um post pode ser republicado
 * Retorna true se pode, false se ainda está em cooldown
 */
export async function canRepost(
  offerId: string, 
  channel: Channel, 
  humorStyle: string,
  cooldownHours: number
): Promise<{ allowed: boolean; reason?: string; lastPostedAt?: Date }> {
  const hash = generatePostHash(offerId, channel, humorStyle);
  
  // Verificar no histórico
  const existing = await prisma.postHistory.findUnique({
    where: { uniqueHash: hash },
  });
  
  if (!existing) {
    return { allowed: true };
  }
  
  // Verificar cooldown
  const hoursSinceLastPost = minutesBetween(new Date(), existing.postedAt) / 60;
  
  if (hoursSinceLastPost < cooldownHours) {
    return { 
      allowed: false, 
      reason: `Repost bloqueado: postado há ${hoursSinceLastPost.toFixed(1)}h (cooldown: ${cooldownHours}h)`,
      lastPostedAt: existing.postedAt,
    };
  }
  
  return { allowed: true };
}

/**
 * Registra um post no histórico de anti-repetição
 */
export async function recordPostHistory(
  offerId: string,
  channel: Channel,
  humorStyle: string,
  copyText: string,
  externalId?: string
): Promise<void> {
  const hash = generatePostHash(offerId, channel, humorStyle);
  
  await prisma.postHistory.upsert({
    where: { uniqueHash: hash },
    update: {
      postedAt: new Date(),
      copyText,
      externalId,
    },
    create: {
      uniqueHash: hash,
      offerId,
      channel,
      humorStyle: humorStyle as any,
      copyText,
      externalId,
      postedAt: new Date(),
    },
  });
}

// ==================== 🔥 BURST MODE (Telegram/Site) ====================

interface BurstSlot {
  hour: number;
  posts: number;
}

/**
 * Carrega configuração do canal do banco (ou usa padrão)
 */
async function getChannelConfig(channel: Channel) {
  const dbConfig = await prisma.channelConfig.findUnique({
    where: { channel },
  });
  
  const defaults = DEFAULT_CHANNEL_RULES[channel] || DEFAULT_CHANNEL_RULES.TELEGRAM;
  
  return {
    intervalMinutes: dbConfig?.intervalMinutes ?? defaults.intervalMin,
    dailyLimit: dbConfig?.dailyLimit ?? defaults.dailyLimit,
    activeHours: dbConfig?.activeHours ?? defaults.activeHours,
    automationLevel: dbConfig?.automationLevel ?? defaults.automationLevel,
    repostCooldownHours: dbConfig?.repostCooldownHours ?? defaults.repostCooldownHours,
    burstCooldownSecs: dbConfig?.burstCooldownSecs ?? defaults.burstCooldownSecs,
    burstSchedule: (dbConfig?.burstSchedule as unknown) as BurstSlot[] | null,
    isEnabled: dbConfig?.isEnabled ?? true,
  };
}

/**
 * Verifica se estamos em horário de burst e quantos posts podemos fazer
 */
function getBurstAllowance(burstSchedule: BurstSlot[] | null): number {
  if (!burstSchedule || !Array.isArray(burstSchedule)) {
    return 0;
  }
  
  const currentHour = new Date().getHours();
  
  for (const slot of burstSchedule) {
    if (slot.hour === currentHour) {
      return slot.posts;
    }
  }
  
  return 0;
}

/**
 * Conta quantos posts foram feitos na última hora
 */
async function getLastHourPostCount(channel: Channel): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  return prisma.promotionChannel.count({
    where: {
      channel,
      status: 'POSTED',
      postedAt: { gte: oneHourAgo },
    },
  });
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
    const { postTweet } = await import('./twitter.js');
    
    const text = channelRecord.copyText;

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

/**
 * Publica no Facebook
 */
async function publishToFacebook(channelRecord: any): Promise<{ success: boolean; externalId?: string; error?: string }> {
  try {
    // Importar serviço de Facebook
    const { postToFacebook, postToFacebookWithImage } = await import('./facebook.js');
    
    const draft = await prisma.postDraft.findUnique({
      where: { id: channelRecord.draftId },
      include: { offer: true },
    });

    if (!draft || !draft.offer) {
      return { success: false, error: 'Draft ou oferta não encontrada' };
    }

    const text = channelRecord.copyText || draft.copyText;
    const imageUrl = draft.offer.imageUrl;

    let result;
    if (imageUrl) {
      result = await postToFacebookWithImage(text, imageUrl);
    } else {
      result = await postToFacebook(text);
    }
    
    return { 
      success: result.success, 
      externalId: result.postId, 
      error: result.error 
    };
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
    case 'FACEBOOK':
      return publishToFacebook(channelRecord);
    // WhatsApp, Instagram - implementar conforme APIs disponíveis
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
 * 1. Verifica se canal está habilitado
 * 2. Verifica nível de automação (HUMAN_ONLY não processa)
 * 3. Verifica horário de funcionamento
 * 4. Verifica intervalo/burst cooldown
 * 5. Verifica limite diário
 * 6. Pega próximo item da fila
 * 7. Verifica anti-repetição
 * 8. Verifica aprovação (WhatsApp)
 * 9. Publica e registra histórico
 */
export async function processChannelQueue(channel: Channel): Promise<{
  processed: boolean;
  reason?: string;
  postId?: string;
  burst?: boolean;
}> {
  // Carregar configuração do banco ou usar padrão
  const config = await getChannelConfig(channel);

  // 1. Verificar se canal está habilitado
  if (!config.isEnabled) {
    return { processed: false, reason: 'Canal desabilitado' };
  }

  // 2. Verificar nível de automação
  if (config.automationLevel === 'HUMAN_ONLY') {
    return { processed: false, reason: 'Canal requer operador humano' };
  }

  // 3. Verificar horário de funcionamento
  if (!isWithinActiveHours(config.activeHours || '08:00-22:00')) {
    return { processed: false, reason: `Fora do horário (${config.activeHours})` };
  }

  // 4. Verificar intervalo desde último post
  const lastPost = await prisma.promotionChannel.findFirst({
    where: { channel, status: 'POSTED' },
    orderBy: { postedAt: 'desc' },
  });

  let isBurstMode = false;
  
  if (lastPost && lastPost.postedAt) {
    // Verificar se estamos em burst mode (Telegram/Site)
    const burstAllowance = getBurstAllowance(config.burstSchedule);
    
    if (burstAllowance > 0 && (channel === 'TELEGRAM' || channel === 'SITE')) {
      // Modo burst: verificar cooldown em segundos
      const diffSeconds = secondsBetween(new Date(), lastPost.postedAt);
      const lastHourPosts = await getLastHourPostCount(channel);
      
      if (lastHourPosts >= burstAllowance) {
        return { 
          processed: false, 
          reason: `Burst: limite da hora atingido (${lastHourPosts}/${burstAllowance})` 
        };
      }
      
      if (diffSeconds < config.burstCooldownSecs) {
        return { 
          processed: false, 
          reason: `Burst: aguardando cooldown (${Math.ceil(config.burstCooldownSecs - diffSeconds)}s restantes)` 
        };
      }
      
      isBurstMode = true;
    } else {
      // Modo normal: verificar intervalo em minutos
      const diffMinutes = minutesBetween(new Date(), lastPost.postedAt);
      if (diffMinutes < config.intervalMinutes) {
        return { 
          processed: false, 
          reason: `Aguardando intervalo (${Math.ceil(config.intervalMinutes - diffMinutes)} min restantes)` 
        };
      }
    }
  }

  // 5. Verificar limite diário
  if (config.dailyLimit > 0) {
    const todayCount = await getTodayPostCount(channel);
    if (todayCount >= config.dailyLimit) {
      return { processed: false, reason: `Limite diário atingido (${todayCount}/${config.dailyLimit})` };
    }
  }

  // 6. Pegar próximo item da fila (FIFO)
  // Para MANUAL_APPROVAL (WhatsApp), só pegar aprovados
  const whereClause: any = { channel, status: 'QUEUED' };
  
  if (config.automationLevel === 'MANUAL_APPROVAL') {
    whereClause.requiresApproval = false; // Já foi aprovado (ou não requer)
  }
  
  const nextInQueue = await prisma.promotionChannel.findFirst({
    where: whereClause,
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

  // 7. Verificar anti-repetição
  const offerId = nextInQueue.draft.offerId;
  const humorStyle = nextInQueue.humorStyle || 'URUBU';
  
  const repostCheck = await canRepost(offerId, channel, humorStyle, config.repostCooldownHours);
  
  if (!repostCheck.allowed) {
    console.log(`[Scheduler] ${channel}: Anti-repetição bloqueou post`);
    
    // Marcar como erro para evitar loop infinito
    await prisma.promotionChannel.update({
      where: { id: nextInQueue.id },
      data: {
        status: 'ERROR',
        errorReason: repostCheck.reason,
      },
    });
    
    return { processed: false, reason: repostCheck.reason };
  }

  // 8. Verificar aprovação para WhatsApp
  if (config.automationLevel === 'MANUAL_APPROVAL' && nextInQueue.requiresApproval) {
    return { processed: false, reason: 'Aguardando aprovação manual' };
  }

  // 9. Publicar
  console.log(`[Scheduler] ${isBurstMode ? '⚡ BURST' : '📤'} Publicando no ${channel}: ${nextInQueue.draft.offer.title}`);

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
      
      // Registrar no histórico de anti-repetição
      await recordPostHistory(
        offerId,
        channel,
        humorStyle,
        nextInQueue.copyText || '',
        result.externalId
      );

      console.log(`[Scheduler] ✅ Publicado com sucesso no ${channel}${isBurstMode ? ' (BURST)' : ''}`);
      return { processed: true, postId: nextInQueue.id, burst: isBurstMode };
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

/**
 * 🔥 BURST SCHEDULER - Processa múltiplos posts em modo burst
 * 
 * Roda em loop até atingir o limite do burst ou esvaziar a fila.
 * Usado para Telegram e Site em horários de pico.
 */
export async function runBurstScheduler(channel: 'TELEGRAM' | 'SITE', maxPosts: number = 10): Promise<{
  processed: number;
  errors: number;
  results: Array<{ postId?: string; error?: string }>;
}> {
  console.log(`[BurstScheduler] ⚡ Iniciando burst para ${channel} (max: ${maxPosts})`);
  
  const results: Array<{ postId?: string; error?: string }> = [];
  let processed = 0;
  let errors = 0;
  
  for (let i = 0; i < maxPosts; i++) {
    const result = await processChannelQueue(channel);
    
    if (result.processed) {
      processed++;
      results.push({ postId: result.postId });
      console.log(`[BurstScheduler] ⚡ ${channel} [${i + 1}/${maxPosts}]: Publicado`);
    } else {
      if (result.reason?.includes('Fila vazia')) {
        console.log(`[BurstScheduler] ⚡ ${channel}: Fila esgotada após ${processed} posts`);
        break;
      }
      
      if (result.reason?.includes('cooldown') || result.reason?.includes('limite')) {
        console.log(`[BurstScheduler] ⚡ ${channel}: ${result.reason}`);
        break;
      }
      
      errors++;
      results.push({ error: result.reason });
    }
    
    // Pequena pausa entre posts do burst (500ms)
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`[BurstScheduler] ⚡ ${channel}: Finalizado (${processed} publicados, ${errors} erros)`);
  
  return { processed, errors, results };
}

/**
 * 🔥 Inicializa configurações padrão de canais no banco
 */
export async function initializeChannelConfigs(): Promise<void> {
  console.log('[Config] Inicializando configurações de canais...');
  
  for (const [channelName, defaults] of Object.entries(DEFAULT_CHANNEL_RULES)) {
    const channel = channelName as Channel;
    
    await prisma.channelConfig.upsert({
      where: { channel },
      update: {}, // Não sobrescreve se já existe
      create: {
        channel,
        automationLevel: defaults.automationLevel,
        intervalMinutes: defaults.intervalMin,
        burstCooldownSecs: defaults.burstCooldownSecs,
        dailyLimit: defaults.dailyLimit,
        activeHours: defaults.activeHours,
        repostCooldownHours: defaults.repostCooldownHours,
        isEnabled: true,
      },
    });
  }
  
  console.log('[Config] ✅ Configurações de canais inicializadas');
}

// ==================== FUNÇÕES DE GERENCIAMENTO ====================

/**
 * Adiciona um item à fila de um canal
 */
export async function addToQueue(
  draftId: string, 
  channel: Channel, 
  copyText: string, 
  humorStyle: 'URUBU' | 'NEUTRO' | 'FLASH' | 'ENGRACADO' = 'URUBU'
): Promise<any> {
  // Buscar oferta para gerar hash
  const draft = await prisma.postDraft.findUnique({
    where: { id: draftId },
    select: { offerId: true },
  });
  
  // Verificar se WhatsApp precisa de aprovação
  const config = await getChannelConfig(channel);
  const requiresApproval = config.automationLevel === 'MANUAL_APPROVAL';
  
  // Gerar hash de anti-repetição
  const uniqueHash = draft?.offerId 
    ? generatePostHash(draft.offerId, channel, humorStyle)
    : null;
  
  return prisma.promotionChannel.upsert({
    where: {
      draftId_channel: { draftId, channel },
    },
    update: {
      status: 'QUEUED',
      queuedAt: new Date(),
      copyText,
      humorStyle,
      uniqueHash,
      requiresApproval,
      approvedAt: null,
      errorReason: null,
    },
    create: {
      draftId,
      channel,
      copyText,
      humorStyle,
      uniqueHash,
      requiresApproval,
      status: 'QUEUED',
      queuedAt: new Date(),
    },
  });
}

/**
 * 🔥 Aprova um post de WhatsApp para publicação
 */
export async function approveWhatsAppPost(promotionChannelId: string, userId: string): Promise<any> {
  return prisma.promotionChannel.update({
    where: { id: promotionChannelId },
    data: {
      requiresApproval: false,
      approvedAt: new Date(),
      approvedById: userId,
    },
  });
}

/**
 * 🔥 Lista posts de WhatsApp aguardando aprovação
 */
export async function getPendingWhatsAppApprovals(): Promise<any[]> {
  return prisma.promotionChannel.findMany({
    where: {
      channel: 'WHATSAPP',
      status: 'QUEUED',
      requiresApproval: true,
    },
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
