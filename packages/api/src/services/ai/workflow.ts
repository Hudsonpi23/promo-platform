/**
 * 🔄 AI Workflow Service
 * 
 * Executa o fluxo completo de IA:
 * 
 * Operador aprova oferta
 * ↓
 * IA Curadora avalia
 * ↓
 * IA Orquestradora decide
 * ↓
 * IA por rede gera POST_JOB
 * ↓
 * POST_JOB entra no Scheduler
 */

import { PrismaClient, Channel } from '@prisma/client';
import { runCuradora } from './agents/curadora.js';
import { runOrquestrador } from './agents/orquestrador.js';
import { runCopywriterBatch } from './agents/copywriters.js';
import type { OfferForAI, AIWorkflowResult } from './types.js';

const prisma = new PrismaClient();

// ==================== MAIN WORKFLOW ====================

/**
 * Processa uma oferta aprovada pelo operador
 * 
 * @param offerId - ID da oferta aprovada
 * @returns Resultado do workflow
 */
export async function processApprovedOffer(offerId: string): Promise<AIWorkflowResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[AI Workflow] 🚀 Iniciando processamento da oferta: ${offerId}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // 1. Buscar oferta com relacionamentos
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        store: true,
        niche: true,
      },
    });

    if (!offer) {
      throw new Error(`Oferta não encontrada: ${offerId}`);
    }

    // 2. Verificar se tem imagem (OBRIGATÓRIO)
    if (!offer.mainImage) {
      throw new Error('Oferta sem imagem principal. Imagem é OBRIGATÓRIA.');
    }

    // 3. Verificar status de curadoria
    if (offer.curationStatus !== 'APPROVED') {
      throw new Error(`Oferta não está aprovada. Status atual: ${offer.curationStatus}`);
    }

    // 4. Atualizar status para processando
    await prisma.offer.update({
      where: { id: offerId },
      data: { curationStatus: 'AI_PROCESSING' },
    });

    // 5. Preparar dados para IA
    const offerForAI: OfferForAI = {
      id: offer.id,
      title: offer.title,
      description: offer.description,
      originalPrice: Number(offer.originalPrice),
      finalPrice: Number(offer.finalPrice),
      discountPct: offer.discountPct,
      mainImage: offer.mainImage,
      images: offer.images,
      storeName: offer.store.name,
      nicheName: offer.niche.name,
      urgency: offer.urgency,
      promoType: offer.promoType,
      couponCode: offer.couponCode,
      affiliateUrl: offer.affiliateUrl,
    };

    console.log(`[AI Workflow] 📦 Oferta preparada: ${offerForAI.title.substring(0, 50)}...`);

    // ─────────────────────────────────────────────────────
    // ETAPA 1: CURADORA
    // ─────────────────────────────────────────────────────
    console.log('\n[AI Workflow] 🧠 Etapa 1: CURADORA');
    const curadoraResult = await runCuradora({ offer: offerForAI });

    // Se bloqueado, parar aqui
    if (curadoraResult.riskLevel === 'BLOCKED') {
      await prisma.offer.update({
        where: { id: offerId },
        data: {
          curationStatus: 'AI_BLOCKED',
          aiPriorityScore: curadoraResult.priorityScore,
          aiRiskLevel: curadoraResult.riskLevel,
          aiBlockReason: curadoraResult.blockReason,
          aiProcessedAt: new Date(),
        },
      });

      return {
        success: false,
        offer: offerForAI,
        curadora: curadoraResult,
        error: `Bloqueado pela Curadora: ${curadoraResult.blockReason}`,
      };
    }

    // ─────────────────────────────────────────────────────
    // ETAPA 2: ORQUESTRADOR
    // ─────────────────────────────────────────────────────
    console.log('\n[AI Workflow] 🎯 Etapa 2: ORQUESTRADOR');
    const orquestradorResult = await runOrquestrador({
      offer: offerForAI,
      curadoraResult,
    });

    if (orquestradorResult.jobs.length === 0) {
      await prisma.offer.update({
        where: { id: offerId },
        data: {
          curationStatus: 'AI_BLOCKED',
          aiPriorityScore: curadoraResult.priorityScore,
          aiRiskLevel: curadoraResult.riskLevel,
          aiBlockReason: 'Nenhuma rede selecionada pelo Orquestrador',
          aiProcessedAt: new Date(),
        },
      });

      return {
        success: false,
        offer: offerForAI,
        curadora: curadoraResult,
        orquestrador: orquestradorResult,
        error: 'Nenhuma rede selecionada pelo Orquestrador',
      };
    }

    // ─────────────────────────────────────────────────────
    // ETAPA 3: COPYWRITERS
    // ─────────────────────────────────────────────────────
    console.log('\n[AI Workflow] ✍️ Etapa 3: COPYWRITERS');
    const copyResults = await runCopywriterBatch(
      offerForAI,
      orquestradorResult.jobs.map(j => ({ network: j.network, style: j.style }))
    );

    // ─────────────────────────────────────────────────────
    // ETAPA 4: CRIAR POST_JOBS
    // ─────────────────────────────────────────────────────
    console.log('\n[AI Workflow] 📝 Etapa 4: Criando POST_JOBs');

    const jobs: AIWorkflowResult['jobs'] = [];

    for (const jobRequest of orquestradorResult.jobs) {
      const copyOutput = copyResults.get(jobRequest.network);
      
      if (!copyOutput) {
        console.log(`[AI Workflow] ⚠️ Copy não gerada para ${jobRequest.network}`);
        continue;
      }

      // Determinar nome do agente
      const agentName = getAgentName(jobRequest.network);

      // Criar PostJob no banco
      const postJob = await prisma.postJob.upsert({
        where: {
          offerId_network: {
            offerId: offer.id,
            network: jobRequest.network,
          },
        },
        create: {
          offerId: offer.id,
          network: jobRequest.network,
          textFinal: copyOutput.textFinal,
          imageUsed: offer.mainImage,
          agentName,
          agentStyle: jobRequest.style,
          status: 'PENDING',
          aiMetadata: {
            priorityScore: curadoraResult.priorityScore,
            jobPriority: jobRequest.priority,
            reasoning: copyOutput.reasoning,
          },
        },
        update: {
          textFinal: copyOutput.textFinal,
          imageUsed: offer.mainImage,
          agentName,
          agentStyle: jobRequest.style,
          status: 'PENDING',
          aiMetadata: {
            priorityScore: curadoraResult.priorityScore,
            jobPriority: jobRequest.priority,
            reasoning: copyOutput.reasoning,
          },
          updatedAt: new Date(),
        },
      });

      jobs.push({
        network: jobRequest.network,
        textFinal: copyOutput.textFinal,
        imageUsed: offer.mainImage,
        agentName,
        style: jobRequest.style,
      });

      console.log(`[AI Workflow] ✅ PostJob criado: ${jobRequest.network} (${agentName})`);
    }

    // ─────────────────────────────────────────────────────
    // ETAPA 5: ATUALIZAR OFFER
    // ─────────────────────────────────────────────────────
    await prisma.offer.update({
      where: { id: offerId },
      data: {
        curationStatus: 'AI_READY',
        aiPriorityScore: curadoraResult.priorityScore,
        aiRiskLevel: curadoraResult.riskLevel,
        aiRecommendedNetworks: curadoraResult.recommendedNetworks,
        aiProcessedAt: new Date(),
      },
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[AI Workflow] ✅ CONCLUÍDO - ${jobs.length} jobs criados`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: true,
      offer: offerForAI,
      curadora: curadoraResult,
      orquestrador: orquestradorResult,
      jobs,
    };

  } catch (error) {
    console.error('[AI Workflow] ❌ ERRO:', error);

    // Reverter status para APPROVED para retry
    await prisma.offer.update({
      where: { id: offerId },
      data: { curationStatus: 'APPROVED' },
    }).catch(() => {});

    return {
      success: false,
      offer: { id: offerId } as OfferForAI,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

// ==================== HELPERS ====================

function getAgentName(network: Channel): string {
  const agents: Record<Channel, string> = {
    FACEBOOK: 'ANA',
    INSTAGRAM: 'ANA',
    TWITTER: 'GABRIEL',
    TELEGRAM: 'THEO',
    WHATSAPP: 'LAURA',
    SITE: 'SITE',
  };
  return agents[network] || 'UNKNOWN';
}

// ==================== BATCH PROCESSING ====================

/**
 * Processa múltiplas ofertas aprovadas
 */
export async function processApprovedOffersBatch(
  offerIds: string[]
): Promise<Map<string, AIWorkflowResult>> {
  const results = new Map<string, AIWorkflowResult>();

  for (const offerId of offerIds) {
    const result = await processApprovedOffer(offerId);
    results.set(offerId, result);
    
    // Pequeno delay entre ofertas para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Busca e processa ofertas pendentes de IA
 */
export async function processPendingOffers(): Promise<number> {
  const pendingOffers = await prisma.offer.findMany({
    where: {
      curationStatus: 'APPROVED',
      mainImage: { not: null },
    },
    select: { id: true },
    take: 10, // Processar em lotes de 10
  });

  if (pendingOffers.length === 0) {
    console.log('[AI Workflow] Nenhuma oferta pendente para processar');
    return 0;
  }

  console.log(`[AI Workflow] Processando ${pendingOffers.length} ofertas pendentes...`);

  let successCount = 0;
  for (const offer of pendingOffers) {
    const result = await processApprovedOffer(offer.id);
    if (result.success) successCount++;
  }

  return successCount;
}

export default {
  processApprovedOffer,
  processApprovedOffersBatch,
  processPendingOffers,
};
