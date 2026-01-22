/**
 * Channel Scheduler Worker
 * 
 * Executa o scheduler de canais periodicamente.
 * Processa filas de publicação por canal (Telegram, X, Site, etc).
 */

import { runScheduler, runBurstScheduler } from '../services/channelScheduler.js';

// Intervalo em ms (1 minuto)
const INTERVAL_MS = 60 * 1000;

// Intervalo do burst check (5 minutos)
const BURST_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let schedulerInterval: NodeJS.Timeout | null = null;
let burstCheckInterval: NodeJS.Timeout | null = null;
let isRunning = false;

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
