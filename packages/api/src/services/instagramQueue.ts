/**
 * Instagram Job Queue
 *
 * Fila assíncrona persistida no PostgreSQL (via Prisma).
 * Não depende de Redis — funciona direto no Render.
 *
 * Fluxo:
 *   enqueue()  → cria InstagramJob com status PENDING
 *   worker     → polling a cada 10s, processa jobs PENDING / com retry
 *   markXxx()  → atualiza status em cada etapa do pipeline
 */

import { prisma } from '../lib/prisma.js';
import { InstagramJobStatus, InstagramFormat } from '@prisma/client';

// ── Enqueue ────────────────────────────────────────────────────────────────────

export interface EnqueueOptions {
  offerId: string;
  triggeredBy?: 'manual' | 'auto' | 'manu-agent';
  accountId?: string;
  format?: InstagramFormat;
  maxAttempts?: number;
}

export async function enqueueInstagramJob(opts: EnqueueOptions): Promise<string> {
  const job = await prisma.instagramJob.create({
    data: {
      offerId: opts.offerId,
      triggeredBy: opts.triggeredBy || 'manual',
      accountId: opts.accountId || process.env.POSTFORME_INSTAGRAM_ACCOUNT_ID || '',
      format: opts.format || 'CAROUSEL',
      maxAttempts: opts.maxAttempts || 3,
      status: 'PENDING',
    },
  });

  console.log(`[Queue] ✅ Job enfileirado: ${job.id} (oferta ${opts.offerId})`);
  return job.id;
}

// ── Claim next pending job ─────────────────────────────────────────────────────

export async function claimNextJob() {
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const job = await tx.instagramJob.findFirst({
      where: {
        status: 'PENDING',
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      include: {
        offer: {
          include: {
            niche: true,
            store: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!job) return null;

    await tx.instagramJob.update({
      where: { id: job.id },
      data: {
        status: 'SCORING',
        attempts: { increment: 1 },
        lastAttemptAt: now,
      },
    });

    return job;
  });
}

// ── Status transitions ────────────────────────────────────────────────────────

export async function markScored(
  jobId: string,
  data: {
    aiScore: number;
    aiReasoning: string;
    aiChosenFormat: InstagramFormat;
    aiCaption: string;
  },
) {
  await prisma.instagramJob.update({
    where: { id: jobId },
    data: {
      status: 'RENDERING',
      aiScore: data.aiScore,
      aiReasoning: data.aiReasoning,
      aiChosenFormat: data.aiChosenFormat,
      aiCaption: data.aiCaption,
      format: data.aiChosenFormat,
    },
  });
}

export async function markRendering(jobId: string) {
  await prisma.instagramJob.update({
    where: { id: jobId },
    data: { status: 'RENDERING' },
  });
}

export async function markUploading(jobId: string, slideUrls: string[]) {
  await prisma.instagramJob.update({
    where: { id: jobId },
    data: { status: 'UPLOADING', slideUrls },
  });
}

export async function markPublishing(jobId: string, captionUsed: string) {
  await prisma.instagramJob.update({
    where: { id: jobId },
    data: { status: 'PUBLISHING', captionUsed },
  });
}

export async function markSuccess(
  jobId: string,
  data: {
    postformePostId: string;
    postformeStatus: string;
    instagramPostId?: string;
    instagramUrl?: string;
  },
) {
  await prisma.instagramJob.update({
    where: { id: jobId },
    data: {
      status: 'SUCCESS',
      publishedAt: new Date(),
      postformePostId: data.postformePostId,
      postformeStatus: data.postformeStatus,
      instagramPostId: data.instagramPostId,
      instagramUrl: data.instagramUrl,
      errorMessage: null,
      nextRetryAt: null,
    },
  });
}

export async function markFailed(
  jobId: string,
  errorMessage: string,
  job?: { attempts: number; maxAttempts: number },
) {
  const attempts = job?.attempts ?? 1;
  const maxAttempts = job?.maxAttempts ?? 3;
  const canRetry = attempts < maxAttempts;

  let nextRetryAt: Date | null = null;
  if (canRetry) {
    // Backoff exponencial: 1min → 5min → 15min
    const delayMinutes = Math.pow(4, attempts - 1);
    nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  await prisma.instagramJob.update({
    where: { id: jobId },
    data: {
      status: canRetry ? 'PENDING' : 'FAILED',
      errorMessage,
      nextRetryAt,
    },
  });

  console.log(
    canRetry
      ? `[Queue] ♻️  Job ${jobId} falhou — retry em ${Math.pow(4, attempts - 1)} min (tentativa ${attempts}/${maxAttempts})`
      : `[Queue] ❌ Job ${jobId} falhou definitivamente após ${attempts} tentativas`,
  );
}

export async function cancelJob(jobId: string) {
  await prisma.instagramJob.update({
    where: { id: jobId },
    data: { status: 'CANCELLED' },
  });
}

// ── List jobs (para a página admin) ──────────────────────────────────────────

export async function listJobs(opts: {
  status?: InstagramJobStatus;
  limit?: number;
  offset?: number;
}) {
  const [jobs, total] = await Promise.all([
    prisma.instagramJob.findMany({
      where: opts.status ? { status: opts.status } : {},
      include: {
        offer: {
          select: {
            id: true,
            title: true,
            finalPrice: true,
            discountPct: true,
            mainImage: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit || 20,
      skip: opts.offset || 0,
    }),
    prisma.instagramJob.count({
      where: opts.status ? { status: opts.status } : {},
    }),
  ]);

  return { jobs, total };
}

// ── Metrics update (chamado pelo worker periódico) ────────────────────────────

export async function updateJobMetrics(
  jobId: string,
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    saves?: number;
    reach?: number;
  },
) {
  await prisma.instagramJob.update({
    where: { id: jobId },
    data: {
      metricViews: metrics.views ?? 0,
      metricLikes: metrics.likes ?? 0,
      metricComments: metrics.comments ?? 0,
      metricSaves: metrics.saves ?? 0,
      metricReach: metrics.reach ?? 0,
      metricsUpdatedAt: new Date(),
    },
  });
}
