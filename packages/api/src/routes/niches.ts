import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authGuard, adminGuard } from '../lib/auth.js';
import { createNicheSchema, updateNicheSchema, paginationSchema } from '../lib/schemas.js';
import { sendError, Errors } from '../lib/errors.js';
import { z } from 'zod';

export async function nichesRoutes(app: FastifyInstance) {
  // GET /niches - Listar nichos com paginação e busca
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

      const [niches, total] = await Promise.all([
        prisma.niche.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { offers: true } },
          },
        }),
        prisma.niche.count({ where }),
      ]);

      return {
        data: niches,
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

  // POST /niches - Criar nicho
  app.post('/', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const body = createNicheSchema.parse(request.body);

      // Verificar se slug já existe
      const existing = await prisma.niche.findUnique({
        where: { slug: body.slug },
      });

      if (existing) {
        return sendError(reply, Errors.ALREADY_EXISTS('Nicho com este slug'));
      }

      const niche = await prisma.niche.create({
        data: body as any,
      });

      return reply.status(201).send({ data: niche });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /niches/:id
  app.get('/:id', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const niche = await prisma.niche.findUnique({
        where: { id },
        include: {
          _count: { select: { offers: true } },
        },
      });

      if (!niche) {
        return sendError(reply, Errors.NOT_FOUND('Nicho'));
      }

      return { data: niche };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // PUT /niches/:id
  app.put('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = updateNicheSchema.parse(request.body);

      // Verificar se existe
      const existing = await prisma.niche.findUnique({ where: { id } });
      if (!existing) {
        return sendError(reply, Errors.NOT_FOUND('Nicho'));
      }

      // Verificar slug único
      if (body.slug && body.slug !== existing.slug) {
        const slugExists = await prisma.niche.findUnique({
          where: { slug: body.slug },
        });
        if (slugExists) {
          return sendError(reply, Errors.ALREADY_EXISTS('Nicho com este slug'));
        }
      }

      const niche = await prisma.niche.update({
        where: { id },
        data: body,
      });

      return { data: niche };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // DELETE /niches/:id (soft delete)
  app.delete('/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const existing = await prisma.niche.findUnique({ where: { id } });
      if (!existing) {
        return sendError(reply, Errors.NOT_FOUND('Nicho'));
      }

      // Soft delete - marca como inativo
      await prisma.niche.update({
        where: { id },
        data: { isActive: false },
      });

      return reply.status(204).send();
    } catch (error: any) {
      return sendError(reply, error);
    }
  });
}
