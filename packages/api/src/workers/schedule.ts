/**
 * Channel Scheduler Worker
 * 
 * Executa o scheduler de canais periodicamente.
 * Processa filas de publicação por canal (Telegram, X, Site, etc).
 */

import { runScheduler, runBurstScheduler } from '../services/channelScheduler.js';
import { prisma } from '../lib/prisma.js';

// Intervalo em ms (1 minuto)
const INTERVAL_MS = 60 * 1000;

// Intervalo do burst check (5 minutos)
const BURST_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Intervalo da limpeza de posts expirados (24 horas)
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

let schedulerInterval: NodeJS.Timeout | null = null;
let burstCheckInterval: NodeJS.Timeout | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Desativa (soft-delete) posts publicados há mais de 8 dias
 */
async function deleteExpiredPosts(): Promise<void> {
  const eightDaysAgo = new Date();
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

  try {
    const result = await prisma.publishedPost.updateMany({
      where: {
        isActive: true,
        publishedAt: { lt: eightDaysAgo },
      },
      data: { isActive: false },
    });

    if (result.count > 0) {
      console.log(`[Worker] 🗑️  ${result.count} post(s) expirado(s) desativado(s) (>8 dias)`);
    }
  } catch (error: any) {
    console.error('[Worker] Erro ao limpar posts expirados:', error.message);
  }
}

/**
 * Executa uma rodada do scheduler
 */
async function runSchedulerCycle(): Promise<void> {
  if (isRunning) {
    console.log('[Worker] Scheduler ainda em andamento, pulando...');
    return;
  }

  isRunning = true;
  
  try {
    const result = await runScheduler();
    
    // Log resumido
    const processed = Object.values(result.results).filter(r => r.processed).length;
    if (processed > 0) {
      console.log(`[Worker] Scheduler: ${processed} posts publicados`);
    }
    
  } catch (error: any) {
    console.error('[Worker] Erro no scheduler:', error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Verifica se deve executar burst (horários de pico)
 */
async function checkBurstSchedule(): Promise<void> {
  const hour = new Date().getHours();
  
  // Horários de pico para burst: 8h, 12h, 18h, 21h
  const burstHours = [8, 12, 18, 21];
  
  if (!burstHours.includes(hour)) {
    return;
  }
  
  console.log(`[Worker] ⚡ Horário de burst detectado (${hour}h)`);
  
  try {
    // Burst para Telegram
    const telegramResult = await runBurstScheduler('TELEGRAM', 10);
    if (telegramResult.processed > 0) {
      console.log(`[Worker] ⚡ Telegram burst: ${telegramResult.processed} posts`);
    }
    
    // Burst para Site
    const siteResult = await runBurstScheduler('SITE', 10);
    if (siteResult.processed > 0) {
      console.log(`[Worker] ⚡ Site burst: ${siteResult.processed} posts`);
    }
  } catch (error: any) {
    console.error('[Worker] Erro no burst:', error.message);
  }
}

/**
 * Inicia o scheduler worker
 */
export function startScheduler(): void {
  if (process.env.NODE_ENV === 'test') {
    console.log('[Worker] Ambiente de teste, scheduler desabilitado');
    return;
  }

  if (schedulerInterval) {
    console.log('[Worker] Scheduler já está rodando');
    return;
  }

  console.log('[Worker] Iniciando Channel Scheduler (intervalo: 1 min)');
  
  // Executar imediatamente
  setTimeout(runSchedulerCycle, 5000);

  // Agendar execuções periódicas
  schedulerInterval = setInterval(runSchedulerCycle, INTERVAL_MS);
  
  // Agendar verificação de burst
  burstCheckInterval = setInterval(checkBurstSchedule, BURST_CHECK_INTERVAL_MS);

  // Limpeza de posts expirados: executar na inicialização e a cada 24h
  setTimeout(deleteExpiredPosts, 10000);
  cleanupInterval = setInterval(deleteExpiredPosts, CLEANUP_INTERVAL_MS);
  console.log('[Worker] 🗑️  Limpeza automática de posts (>30 dias): ATIVA (a cada 24h)');
}

/**
 * Para o scheduler worker
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  
  if (burstCheckInterval) {
    clearInterval(burstCheckInterval);
    burstCheckInterval = null;
  }

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  
  console.log('[Worker] Scheduler parado');
}

/**
 * Obtém status do scheduler
 */
export function getSchedulerStatus(): {
  running: boolean;
  intervalMs: number;
} {
  return {
    running: !!schedulerInterval,
    intervalMs: INTERVAL_MS,
  };
}

// Auto-start se configurado
if (process.env.AUTO_START_SCHEDULER === 'true') {
  startScheduler();
}
