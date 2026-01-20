/**
 * Scheduler Interno
 * 
 * Executa coleta automática de ofertas a cada 10 minutos.
 * Só roda em ambiente de produção (NODE_ENV !== 'test').
 */

import { PrismaClient } from '@prisma/client';
import { MercadoLivreProvider } from '../providers/mercadolivre/provider';

const prisma = new PrismaClient();

// Intervalo em ms (10 minutos)
const INTERVAL_MS = 10 * 60 * 1000;

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Executa uma rodada de coleta
 */
async function runCollection(): Promise<void> {
  if (isRunning) {
    console.log('[Scheduler] Coleta ainda em andamento, pulando...');
    return;
  }

  isRunning = true;
  console.log(`[Scheduler] Iniciando coleta automática: ${new Date().toISOString()}`);

  try {
    // Verificar se provider está habilitado
    const config = await prisma.providerConfig.findUnique({
      where: { source: 'MERCADO_LIVRE' },
    });

    if (!config?.enabled) {
      console.log('[Scheduler] Mercado Livre desabilitado, pulando...');
      return;
    }

    // Criar provider e executar
    const provider = new MercadoLivreProvider(prisma);
    const result = await provider.run({ mode: 'both' });

    console.log('[Scheduler] Coleta finalizada:', {
      collected: result.collected,
      insertedOffers: result.insertedOffers,
      createdDrafts: result.createdDrafts,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    if (result.errors.length > 0) {
      console.warn('[Scheduler] Erros durante coleta:', result.errors.slice(0, 5));
    }

  } catch (error: any) {
    console.error('[Scheduler] Erro na coleta:', error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o scheduler
 */
export function startScheduler(): void {
  if (process.env.NODE_ENV === 'test') {
    console.log('[Scheduler] Ambiente de teste, scheduler desabilitado');
    return;
  }

  if (schedulerInterval) {
    console.log('[Scheduler] Já está rodando');
    return;
  }

  console.log('[Scheduler] Iniciando scheduler (intervalo: 10 min)');
  
  // Executar imediatamente na primeira vez
  setTimeout(runCollection, 5000); // Aguarda 5s para API inicializar

  // Agendar execuções periódicas
  schedulerInterval = setInterval(runCollection, INTERVAL_MS);
}

/**
 * Para o scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Parado');
  }
}

/**
 * Executa coleta manual (para testes)
 */
export async function runManualCollection(): Promise<any> {
  console.log('[Scheduler] Executando coleta manual...');
  
  try {
    const provider = new MercadoLivreProvider(prisma);
    const result = await provider.run({ mode: 'both' });
    return result;
  } catch (error: any) {
    console.error('[Scheduler] Erro na coleta manual:', error.message);
    throw error;
  }
}

/**
 * Obtém status do scheduler
 */
export function getSchedulerStatus(): {
  running: boolean;
  nextRunIn: number | null;
  lastRunAt: Date | null;
} {
  return {
    running: !!schedulerInterval,
    nextRunIn: schedulerInterval ? INTERVAL_MS : null,
    lastRunAt: null, // TODO: Implementar tracking
  };
}

// Auto-start se importado diretamente (não em testes)
if (process.env.AUTO_START_SCHEDULER === 'true') {
  startScheduler();
}
