import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../lib/prisma.js';
import { DispatchJobData } from '../lib/queue.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Worker do Site (marca como visível no site público)
export const siteWorker = new Worker(
  'dispatch',
  async (job: Job<DispatchJobData>) => {
    if (job.data.channel !== 'SITE') {
      return { skipped: true };
    }

    const { postId, draftId } = job.data;

    // Buscar o post publicado
    const post = await prisma.postPublished.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new Error(`Post ${postId} não encontrado`);
    }

    // Atualizar status para SENDING
    await prisma.postDelivery.upsert({
      where: {
        postId_channel: {
          postId,
          channel: 'SITE',
        },
      },
      update: { status: 'SENDING' },
      create: {
        postId,
        channel: 'SITE',
        status: 'SENDING',
      },
    });

    try {
      // Marcar como visível no site
      await prisma.postPublished.update({
        where: { id: postId },
        data: { isVisibleOnSite: true },
      });

      // Atualizar como SENT
      await prisma.postDelivery.update({
        where: {
          postId_channel: {
            postId,
            channel: 'SITE',
          },
        },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      // Atualizar contador da batch
      const draft = await prisma.postDraft.findUnique({
        where: { id: draftId },
      });
      
      if (draft) {
        await prisma.batch.update({
          where: { id: draft.batchId },
          data: { dispatchedCount: { increment: 1 } },
        });
      }

      return { success: true };
    } catch (error: any) {
      // Atualizar como ERROR
      await prisma.postDelivery.update({
        where: {
          postId_channel: {
            postId,
            channel: 'SITE',
          },
        },
        data: {
          status: 'ERROR',
          error: error.message,
        },
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 10,
  }
);

siteWorker.on('completed', (job) => {
  console.log(`✅ Site: Job ${job.id} completado`);
});

siteWorker.on('failed', (job, err) => {
  console.error(`❌ Site: Job ${job?.id} falhou:`, err.message);
});
