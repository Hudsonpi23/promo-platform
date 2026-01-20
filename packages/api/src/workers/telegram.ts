import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../lib/prisma.js';
import { DispatchJobData } from '../lib/queue.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Formatar mensagem para Telegram
function formatTelegramMessage(post: {
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

👉 [VER OFERTA](${post.affiliateUrl})`;
}

// Enviar mensagem para Telegram
async function sendToTelegram(message: string): Promise<{ messageId: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  if (!botToken || !channelId) {
    throw new Error('Telegram não configurado');
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    }
  );

  const data = await response.json() as any;

  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  return { messageId: String(data.result.message_id) };
}

// Worker do Telegram
export const telegramWorker = new Worker(
  'dispatch',
  async (job: Job<DispatchJobData>) => {
    if (job.data.channel !== 'TELEGRAM') {
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
          channel: 'TELEGRAM',
        },
      },
      update: { status: 'SENDING' },
      create: {
        postId,
        channel: 'TELEGRAM',
        status: 'SENDING',
      },
    });

    try {
      // Formatar e enviar
      const message = formatTelegramMessage(post);
      const result = await sendToTelegram(message);

      // Atualizar como SENT
      await prisma.postDelivery.update({
        where: {
          postId_channel: {
            postId,
            channel: 'TELEGRAM',
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
            channel: 'TELEGRAM',
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
          errorType: 'TELEGRAM_DELIVERY_FAILED',
          message: error.message,
          details: { postId, channel: 'TELEGRAM' },
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

telegramWorker.on('completed', (job) => {
  console.log(`✅ Telegram: Job ${job.id} completado`);
});

telegramWorker.on('failed', (job, err) => {
  console.error(`❌ Telegram: Job ${job?.id} falhou:`, err.message);
});
