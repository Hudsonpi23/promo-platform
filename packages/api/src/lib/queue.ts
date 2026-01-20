import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

// Conexão Redis
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Fila de disparo de posts
export const dispatchQueue = new Queue('dispatch', { connection });

// Tipos de jobs
export interface DispatchJobData {
  postId: string;
  channel: 'TELEGRAM' | 'WHATSAPP' | 'FACEBOOK' | 'SITE';
  draftId: string;
}

// Adicionar job de disparo
export async function addDispatchJob(data: DispatchJobData) {
  return dispatchQueue.add(`dispatch-${data.channel.toLowerCase()}`, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}

// Adicionar múltiplos jobs (fan-out)
export async function fanOutDispatch(postId: string, draftId: string, channels: string[]) {
  const jobs = channels.map((channel) => ({
    name: `dispatch-${channel.toLowerCase()}`,
    data: { postId, draftId, channel } as DispatchJobData,
    opts: {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 1000,
      },
    },
  }));

  return dispatchQueue.addBulk(jobs);
}
