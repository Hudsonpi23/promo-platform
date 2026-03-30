/**
 * Instagram Worker
 *
 * Polling a cada 10s — processa jobs da fila InstagramJob.
 *
 * Pipeline por job:
 *   PENDING → SCORING → RENDERING → UPLOADING → PUBLISHING → SUCCESS
 *                                                          ↘ FAILED (retry)
 */

import { analyzeOfferForInstagram, OfferDataForAI } from '../services/instagramAI.js';
import { generateCarousel } from '../services/instagramCarousel.js';
import { publishCarousel, getPostStatus } from '../services/postforme.js';
import {
  claimNextJob,
  markScored,
  markUploading,
  markPublishing,
  markSuccess,
  markFailed,
  updateJobMetrics,
} from '../services/instagramQueue.js';
import { prisma } from '../lib/prisma.js';

const POLL_INTERVAL_MS    = 10_000;  // 10 segundos
const METRICS_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

let isProcessing = false;
let workerInterval: NodeJS.Timeout | null = null;
let metricsInterval: NodeJS.Timeout | null = null;

// ── Start / Stop ────────────────────────────────────────────────────────────────

export function startInstagramWorker() {
  if (workerInterval) return;

  console.log('[IG Worker] 🚀 Iniciando — polling a cada 10s');

  workerInterval = setInterval(processNextJob, POLL_INTERVAL_MS);

  // Métricas: busca analytics do Postfor.me a cada hora
  metricsInterval = setInterval(refreshMetrics, METRICS_INTERVAL_MS);

  // Primeira rodada imediata
  processNextJob();
}

export function stopInstagramWorker() {
  if (workerInterval) { clearInterval(workerInterval); workerInterval = null; }
  if (metricsInterval) { clearInterval(metricsInterval); metricsInterval = null; }
  console.log('[IG Worker] ⏹️  Parado');
}

// ── Core processor ─────────────────────────────────────────────────────────────

async function processNextJob() {
  if (isProcessing) return; // Evita concorrência
  isProcessing = true;

  let jobId: string | null = null;
  let jobAttempts = 1;
  let jobMaxAttempts = 3;

  try {
    // 1. Claim próximo job da fila
    const claimed = await claimNextJob();
    if (!claimed) { isProcessing = false; return; }

    jobId = claimed.id;
    jobAttempts = claimed.attempts + 1;
    jobMaxAttempts = claimed.maxAttempts;
    const offer = claimed.offer;
    const accountId = claimed.accountId || process.env.POSTFORME_INSTAGRAM_ACCOUNT_ID || '';

    console.log(`\n[IG Worker] ▶ Processando job ${jobId} | Oferta: ${offer.title.slice(0, 50)}`);

    // ── Etapa 1: IA avalia a oferta ──────────────────────────────────────────
    const offerForAI: OfferDataForAI = {
      id: offer.id,
      title: offer.title,
      finalPrice: Number(offer.finalPrice),
      originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
      discountPct: offer.discountPct,
      nicheName: offer.niche?.name,
      storeName: offer.store?.name,
      imageUrl: offer.mainImage || offer.imageUrl || null,
      promoType: offer.promoType,
      urgency: offer.urgency,
      affiliateUrl: offer.affiliateUrl,
    };

    console.log(`[IG Worker] 🧠 IA avaliando oferta...`);
    const aiDecision = await analyzeOfferForInstagram(offerForAI);

    // Score muito baixo — cancelar sem retry
    if (!aiDecision.shouldPublish) {
      await prisma.instagramJob.update({
        where: { id: jobId },
        data: {
          status: 'CANCELLED',
          aiScore: aiDecision.score,
          aiReasoning: aiDecision.reasoning,
          errorMessage: `Score ${aiDecision.score}/100 — abaixo do mínimo (40). Não publicar no Instagram.`,
        },
      });
      console.log(`[IG Worker] ⛔ Job ${jobId} cancelado — score baixo (${aiDecision.score})`);
      isProcessing = false;
      return;
    }

    await markScored(jobId, {
      aiScore: aiDecision.score,
      aiReasoning: aiDecision.reasoning,
      aiChosenFormat: aiDecision.format,
      aiCaption: aiDecision.caption,
    });

    console.log(`[IG Worker] ✅ Score: ${aiDecision.score} | Formato: ${aiDecision.format}`);

    // ── Etapa 2: Gerar slides (CAROUSEL) ou vídeo (REEL) ───────────────────────
    console.log(`[IG Worker] 🎨 Gerando ${aiDecision.format}...`);

    let slideUrls: string[];

    if (aiDecision.format === 'CAROUSEL') {
      const carouselResult = await generateCarousel({
        title: offer.title,
        finalPrice: Number(offer.finalPrice),
        originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
        discountPct: offer.discountPct,
        imageUrl: offer.mainImage || offer.imageUrl || null,
        offerId: offer.id,
        theme: (job.carouselTheme as any) || 'dark',
      });

      if (!carouselResult.success || !carouselResult.slideUrls) {
        throw new Error(`Falha ao gerar slides: ${carouselResult.error}`);
      }
      slideUrls = carouselResult.slideUrls;
    } else {
      // REEL — Por enquanto usa carousel como fallback (Remotion em breve)
      console.log(`[IG Worker] ⚠️  REEL ainda não implementado — usando CAROUSEL como fallback`);
      const carouselResult = await generateCarousel({
        title: offer.title,
        finalPrice: Number(offer.finalPrice),
        originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
        discountPct: offer.discountPct,
        imageUrl: offer.mainImage || offer.imageUrl || null,
        offerId: offer.id,
        theme: (job.carouselTheme as any) || 'dark',
      });

      if (!carouselResult.success || !carouselResult.slideUrls) {
        throw new Error(`Falha ao gerar slides: ${carouselResult.error}`);
      }
      slideUrls = carouselResult.slideUrls;
    }

    await markUploading(jobId, slideUrls);
    console.log(`[IG Worker] ☁️  ${slideUrls.length} slides no Cloudinary`);

    // ── Etapa 3: Publicar via Postfor.me ─────────────────────────────────────
    if (!accountId) {
      throw new Error('POSTFORME_INSTAGRAM_ACCOUNT_ID não configurado');
    }

    await markPublishing(jobId, aiDecision.caption);
    console.log(`[IG Worker] 📡 Publicando via Postfor.me...`);

    const publishResult = await publishCarousel({
      caption: aiDecision.caption,
      slideUrls,
      instagramAccountId: accountId,
      offerId: offer.id,
    });

    if (!publishResult.success) {
      throw new Error(`Postfor.me falhou: ${publishResult.error}`);
    }

    // ── Etapa 4: Sucesso ─────────────────────────────────────────────────────
    await markSuccess(jobId, {
      postformePostId: publishResult.postId!,
      postformeStatus: publishResult.status || 'pending',
    });

    // Registrar na tabela OfferPublication
    await prisma.offerPublication.create({
      data: {
        offerId: offer.id,
        channel: 'INSTAGRAM',
        externalId: publishResult.postId,
      },
    });

    console.log(`[IG Worker] 🎉 Job ${jobId} publicado! Post ID: ${publishResult.postId}\n`);

  } catch (err: any) {
    const errorMsg = err.message || 'Erro desconhecido';
    console.error(`[IG Worker] ❌ Job ${jobId} falhou:`, errorMsg);

    if (jobId) {
      await markFailed(jobId, errorMsg, {
        attempts: jobAttempts,
        maxAttempts: jobMaxAttempts,
      });
    }
  } finally {
    isProcessing = false;
  }
}

// ── Metrics refresher ──────────────────────────────────────────────────────────

async function refreshMetrics() {
  try {
    // Buscar posts publicados com Postfor.me ID que ainda não tem métricas recentes
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const jobs = await prisma.instagramJob.findMany({
      where: {
        status: 'SUCCESS',
        postformePostId: { not: null },
        OR: [
          { metricsUpdatedAt: null },
          { metricsUpdatedAt: { lt: oneHourAgo } },
        ],
      },
      take: 10,
      orderBy: { publishedAt: 'desc' },
    });

    for (const job of jobs) {
      try {
        const status = await getPostStatus(job.postformePostId!);
        if (!status) continue;

        // O Postfor.me pode retornar analytics no futuro
        // Por ora, apenas atualiza o status
        await updateJobMetrics(job.id, {
          views: 0,
          likes: 0,
          comments: 0,
          saves: 0,
          reach: 0,
        });
      } catch {
        // Silencioso — métricas são opcionais
      }
    }

    if (jobs.length > 0) {
      console.log(`[IG Worker] 📊 Métricas atualizadas para ${jobs.length} post(s)`);
    }
  } catch (err: any) {
    console.warn('[IG Worker] Erro ao atualizar métricas:', err.message);
  }
}
