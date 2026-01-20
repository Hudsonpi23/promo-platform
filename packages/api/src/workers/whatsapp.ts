import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../lib/prisma.js';
import { DispatchJobData } from '../lib/queue.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Formatar mensagem para WhatsApp
function formatWhatsAppMessage(post: {
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

  return `${emoji} *${post.title}*

${post.copyText}

💰 *R$ ${Number(post.price).toFixed(2)}* (-${post.discount}% OFF)

🏪 ${post.store}

👉 ${post.affiliateUrl}`;
}

// Enviar mensagem via Evolution API
async function sendToWhatsApp(message: string): Promise<{ messageId: string }> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;
  const instance = process.env.WHATSAPP_INSTANCE;
  const groupId = process.env.WHATSAPP_GROUP_ID; // ID do grupo/lista

  if (!apiUrl || !apiKey || !instance) {
    throw new Error('WhatsApp não configurado');
  }

  // Evolution API endpoint para enviar mensagem de texto
  const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({
      number: groupId,
      text: message,
    }),
  });

  const data = await response.json() as any;

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
  }

  return { messageId: data.key?.id || 'unknown' };
}

// Worker do WhatsApp
export const whatsappWorker = new Worker(
  'dispatch',
  async (job: Job<DispatchJobData>) => {
    if (job.data.channel !== 'WHATSAPP') {
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
          channel: 'WHATSAPP',
        },
      },
      update: { status: 'SENDING' },
      create: {
        postId,
        channel: 'WHATSAPP',
        status: 'SENDING',
      },
    });

    try {
      // Formatar e enviar
      const message = formatWhatsAppMessage(post);
      const result = await sendToWhatsApp(message);

      // Atualizar como SENT
      await prisma.postDelivery.update({
        where: {
          postId_channel: {
            postId,
            channel: 'WHATSAPP',
          },
        },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          externalId: result.messageId,
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

      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      // Atualizar como ERROR
      await prisma.postDelivery.update({
        where: {
          postId_channel: {
            postId,
            channel: 'WHATSAPP',
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
          errorType: 'WHATSAPP_DELIVERY_FAILED',
          message: error.message,
          details: { postId, channel: 'WHATSAPP' },
        },
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 3, // WhatsApp tem limites mais rigorosos
  }
);

whatsappWorker.on('completed', (job) => {
  console.log(`✅ WhatsApp: Job ${job.id} completado`);
});

whatsappWorker.on('failed', (job, err) => {
  console.error(`❌ WhatsApp: Job ${job?.id} falhou:`, err.message);
});
