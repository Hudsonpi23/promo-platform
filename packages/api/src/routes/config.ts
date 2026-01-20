import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authGuard, adminGuard } from '../lib/auth.js';
import { updateConfigSchema, batchScheduleSchema } from '../lib/schemas.js';
import { sendError, Errors } from '../lib/errors.js';

export async function configRoutes(app: FastifyInstance) {
  // GET /config
  app.get('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      let config = await prisma.config.findUnique({
        where: { id: 'singleton' },
      });

      // Criar config padrão se não existir
      if (!config) {
        config = await prisma.config.create({
          data: { id: 'singleton' },
        });
      }

      return { data: config };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // PUT /config
  app.put('/', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const body = updateConfigSchema.parse(request.body);

      const config = await prisma.config.upsert({
        where: { id: 'singleton' },
        update: body,
        create: { id: 'singleton', ...body },
      });

      return { data: config };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /config/cargas - Listar schedules de carga
  app.get('/cargas', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const schedules = await prisma.batchSchedule.findMany({
        orderBy: { order: 'asc' },
      });

      return { data: schedules };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // PUT /config/cargas - Atualizar schedules
  app.put('/cargas', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const schedules = batchScheduleSchema.parse(request.body);

      // Deletar schedules antigos e criar novos
      await prisma.$transaction(async (tx) => {
        await tx.batchSchedule.deleteMany();
        
        for (const schedule of schedules) {
          await tx.batchSchedule.create({
            data: schedule as any,
          });
        }
      });

      const updated = await prisma.batchSchedule.findMany({
        orderBy: { order: 'asc' },
      });

      return { data: updated };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });
}
