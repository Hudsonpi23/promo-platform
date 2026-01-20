import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authGuard, adminGuard } from '../lib/auth.js';
import { createStoreSchema, updateStoreSchema, paginationSchema } from '../lib/schemas.js';
import { sendError, Errors } from '../lib/errors.js';
import { z } from 'zod';

export async function storesRoutes(app: FastifyInstance) {
  // GET /stores - Listar lojas
  app.get('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = paginationSchema.extend({
        q: z.string().optional(),
        isActive: z.coerce.boolean().optional(),
      }).parse(request.query);

      const { page, limit, q, isActive } = query;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ];
      }
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [stores, total] = await Promise.all([
        prisma.store.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { offers: true } },
          },
        }),
        prisma.store.count({ where }),
      ]);

      return {
        data: stores,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // POST /stores
  app.post('/', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const body = createStoreSchema.parse(request.body);

      const existing = await prisma.store.findUnique({
        where: { slug: body.slug },
      });

      if (existing) {
        return sendError(reply, Errors.ALREADY_EXISTS('Loja com este slug'));
      }

      const store = await prisma.store.create({
        data: body as any,
      });

      return reply.status(201).send({ data: store });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /stores/:id
  app.get('/:id', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const store = await prisma.store.findUnique({
        where: { id },
        include: {
          _count: { select: { offers: true } },
        },
      });

      if (!store) {
        return sendError(reply, Errors.NOT_FOUND('Loja'));
      }

      return { data: store };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // PUT /stores/:id
  app.put('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = updateStoreSchema.parse(request.body);

      const existing = await prisma.store.findUnique({ where: { id } });
      if (!existing) {
        return sendError(reply, Errors.NOT_FOUND('Loja'));
      }

      if (body.slug && body.slug !== existing.slug) {
        const slugExists = await prisma.store.findUnique({
          where: { slug: body.slug },
        });
        if (slugExists) {
          return sendError(reply, Errors.ALREADY_EXISTS('Loja com este slug'));
        }
      }

      const store = await prisma.store.update({
        where: { id },
        data: body,
      });

      return { data: store };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // DELETE /stores/:id (soft delete)
  app.delete('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const existing = await prisma.store.findUnique({ where: { id } });
      if (!existing) {
        return sendError(reply, Errors.NOT_FOUND('Loja'));
      }

      await prisma.store.update({
        where: { id },
        data: { isActive: false },
      });

      return reply.status(204).send();
    } catch (error: any) {
      return sendError(reply, error);
    }
  });
}
