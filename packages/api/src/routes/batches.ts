import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { batchDateSchema } from '../lib/schemas.js';
import { sendError, Errors } from '../lib/errors.js';

export async function batchesRoutes(app: FastifyInstance) {
  // GET /batches?date=YYYY-MM-DD
  app.get('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = batchDateSchema.partial().parse(request.query);
      
      // Se não passar data, usar hoje
      const dateStr = query.date || new Date().toISOString().split('T')[0];
      const date = new Date(dateStr + 'T00:00:00.000Z');

      const batches = await prisma.batch.findMany({
        where: { date },
        orderBy: { scheduledTime: 'asc' },
        include: {
          _count: {
            select: { drafts: true },
          },
        },
      });

      // Recalcular contadores
      const batchesWithCounts = await Promise.all(
        batches.map(async (batch) => {
          const counts = await prisma.postDraft.groupBy({
            by: ['status'],
            where: { batchId: batch.id },
            _count: true,
          });

          const countsMap: Record<string, number> = {};
          counts.forEach((c) => {
            countsMap[c.status] = c._count;
          });

          return {
            ...batch,
            pendingCount: countsMap['PENDING'] || 0,
            approvedCount: countsMap['APPROVED'] || 0,
            dispatchedCount: countsMap['DISPATCHED'] || 0,
            errorCount: countsMap['ERROR'] || 0,
            rejectedCount: countsMap['REJECTED'] || 0,
            totalCount: batch._count.drafts,
          };
        })
      );

      return {
        data: batchesWithCounts,
        meta: {
          date: dateStr,
          total: batches.length,
        },
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // POST /batches/generate?date=YYYY-MM-DD
  app.post('/generate', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = batchDateSchema.partial().parse(request.query);
      
      const dateStr = query.date || new Date().toISOString().split('T')[0];
      const date = new Date(dateStr + 'T00:00:00.000Z');

      // Buscar schedules ativos
      const schedules = await prisma.batchSchedule.findMany({
        where: { enabled: true },
        orderBy: { order: 'asc' },
      });

      if (schedules.length === 0) {
        // Criar schedules padrão se não existirem
        const defaultSchedules = ['08:00', '11:00', '14:00', '18:00', '22:00'];
        for (let i = 0; i < defaultSchedules.length; i++) {
          await prisma.batchSchedule.create({
            data: { time: defaultSchedules[i], enabled: true, order: i },
          });
        }
        schedules.push(...await prisma.batchSchedule.findMany({
          where: { enabled: true },
          orderBy: { order: 'asc' },
        }));
      }

      // Criar batches para cada schedule
      const batches = [];
      for (const schedule of schedules) {
        const existing = await prisma.batch.findUnique({
          where: {
            date_scheduledTime: {
              date,
              scheduledTime: schedule.time,
            },
          },
        });

        if (!existing) {
          const batch = await prisma.batch.create({
            data: {
              date,
              scheduledTime: schedule.time,
              status: 'PENDING',
            },
          });
          batches.push(batch);
        } else {
          batches.push(existing);
        }
      }

      return {
        data: batches,
        meta: {
          date: dateStr,
          created: batches.filter((b) => !b.createdAt || 
            new Date(b.createdAt).getTime() > Date.now() - 5000).length,
        },
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /batches/:id
  app.get('/:id', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const batch = await prisma.batch.findUnique({
        where: { id },
        include: {
          drafts: {
            include: {
              offer: {
                include: {
                  niche: { select: { id: true, name: true, slug: true, icon: true } },
                  store: { select: { id: true, name: true, slug: true } },
                },
              },
              deliveries: true,
            },
            orderBy: [
              { priority: 'asc' },
              { createdAt: 'desc' },
            ],
          },
        },
      });

      if (!batch) {
        return sendError(reply, Errors.NOT_FOUND('Carga'));
      }

      return { data: batch };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // POST /batches/:id/lock
  app.post('/:id/lock', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) {
        return sendError(reply, Errors.NOT_FOUND('Carga'));
      }

      if (batch.status === 'LOCKED') {
        return sendError(reply, Errors.BATCH_LOCKED);
      }

      if (batch.status === 'CLOSED') {
        return sendError(reply, Errors.BATCH_CLOSED);
      }

      const updated = await prisma.batch.update({
        where: { id },
        data: { status: 'LOCKED' },
      });

      return { data: updated };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // POST /batches/:id/close
  app.post('/:id/close', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) {
        return sendError(reply, Errors.NOT_FOUND('Carga'));
      }

      if (batch.status === 'CLOSED') {
        return sendError(reply, Errors.BATCH_CLOSED);
      }

      const updated = await prisma.batch.update({
        where: { id },
        data: { status: 'CLOSED' },
      });

      return { data: updated };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // POST /batches/:id/dispatch-approved - Disparar todos aprovados da carga
  app.post('/:id/dispatch-approved', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) {
        return sendError(reply, Errors.NOT_FOUND('Carga'));
      }

      // Buscar drafts aprovados
      const approvedDrafts = await prisma.postDraft.findMany({
        where: {
          batchId: id,
          status: 'APPROVED',
        },
      });

      // Criar deliveries para cada draft
      const results = [];
      for (const draft of approvedDrafts) {
        // Criar delivery para cada canal
        for (const channel of draft.channels) {
          await prisma.postDelivery.upsert({
            where: {
              draftId_channel: {
                draftId: draft.id,
                channel,
              },
            },
            create: {
              draftId: draft.id,
              channel,
              status: 'PENDING',
            },
            update: {
              status: 'PENDING',
              errorMessage: null,
              retries: 0,
            },
          });
        }

        // Marcar draft como DISPATCHED
        await prisma.postDraft.update({
          where: { id: draft.id },
          data: { status: 'DISPATCHED' },
        });

        results.push(draft.id);
      }

      return {
        data: {
          dispatched: results.length,
          draftIds: results,
        },
      };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });
}
