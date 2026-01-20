import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../lib/prisma.js';
import { DispatchJobData } from '../lib/queue.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Formatar post para Facebook
function formatFacebookPost(post: {
  title: string;
  copyText: string;
  price: any;
  discount: number;
  urgency: string;
  store: string;
  affiliateUrl: string;
}): string {
  const urgencyEmoji: Record<string, string> = {
    HOJE: '🔥',
    ULTIMAS_UNIDADES: '⚡',
    LIMITADO: '⏰',
    NORMAL: '💰',
  };

  const emoji = urgencyEmoji[post.urgency] || '💰';

  return `${emoji} ${post.title}

${post.copyText}

💰 R$ ${Number(post.price).toFixed(2)} (-${post.discount}% OFF)

🏪 ${post.store}

👉 Ver oferta: ${post.affiliateUrl}

#promocao #desconto #oferta #${post.store.toLowerCase().replace(/\s+/g, '')}`;
}

// Publicar no Facebook via Graph API
async function postToFacebook(message: string): Promise<{ postId: string }> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    throw new Error('Facebook não configurado');
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        access_token: accessToken,
      }),
    }
  );

  const data = await response.json() as any;

  if (data.error) {
    throw new Error(`Facebook API error: ${data.error.message}`);
  }

  return { postId: data.id };
}

// Worker do Facebook
export const facebookWorker = new Worker(
  'dispatch',
  async (job: Job<DispatchJobData>) => {
    if (job.data.channel !== 'FACEBOOK') {
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
          channel: 'FACEBOOK',
        },
      },
      update: { status: 'SENDING' },
      create: {
        postId,
        channel: 'FACEBOOK',
        status: 'SENDING',
      },
    });

    try {
      // Formatar e publicar
      const message = formatFacebookPost(post);
      const result = await postToFacebook(message);

      // Atualizar como SENT
      await prisma.postDelivery.update({
        where: {
          postId_channel: {
            postId,
            channel: 'FACEBOOK',
          },
        },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          externalId: result.postId,
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

      return { success: true, postId: result.postId };
    } catch (error: any) {
      // Atualizar como ERROR
      await prisma.postDelivery.update({
        where: {
          postId_channel: {
            postId,
            channel: 'FACEBOOK',
          },
        },
        data: {
          status: 'ERROR',
          error: error.message,
          retries: { increment: 1 },
        },
      });

      // Criar log de erro
      await prisma.errorLog.create({
        data: {
          draftId,
          errorType: 'FACEBOOK_DELIVERY_FAILED',
          message: error.message,
          details: { postId, channel: 'FACEBOOK' },
        },
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

facebookWorker.on('completed', (job) => {
  console.log(`✅ Facebook: Job ${job.id} completado`);
});

facebookWorker.on('failed', (job, err) => {
  console.error(`❌ Facebook: Job ${job?.id} falhou:`, err.message);
});
