import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authGuard, adminGuard } from '../lib/auth.js';
import { createOfferSchema, updateOfferSchema, offersFilterSchema } from '../lib/schemas.js';
import { sendError, Errors } from '../lib/errors.js';

export async function offersRoutes(app: FastifyInstance) {
  // GET /offers - Listar ofertas com filtros
  app.get('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = offersFilterSchema.parse(request.query);
      const { page, limit, nicheId, storeId, status, minDiscount, q, dateFrom, dateTo } = query;
      const skip = (page - 1) * limit;

      const where: any = {};
      
      if (nicheId) where.nicheId = nicheId;
      if (storeId) where.storeId = storeId;
      if (status) where.status = status;
      if (minDiscount) where.discountPct = { gte: minDiscount };
      if (q) {
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ];
      }
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = dateFrom;
        if (dateTo) where.createdAt.lte = dateTo;
      }

      const [offers, total] = await Promise.all([
        prisma.offer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            niche: { select: { id: true, name: true, slug: true, icon: true } },
            store: { select: { id: true, name: true, slug: true } },
            _count: { select: { drafts: true } },
          },
        }),
        prisma.offer.count({ where }),
      ]);

      return {
        data: offers,
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

  // POST /offers - Criar oferta
  app.post('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const body = createOfferSchema.parse(request.body);

      // Verificar se nicho existe
      const niche = await prisma.niche.findUnique({ where: { id: body.nicheId } });
      if (!niche) {
        return sendError(reply, Errors.NOT_FOUND('Nicho'));
      }

      // Verificar se loja existe
      const store = await prisma.store.findUnique({ where: { id: body.storeId } });
      if (!store) {
        return sendError(reply, Errors.NOT_FOUND('Loja'));
      }

      const offer = await prisma.offer.create({
        data: body as any,
        include: {
          niche: { select: { id: true, name: true, slug: true, icon: true } },
          store: { select: { id: true, name: true, slug: true } },
        },
      });

      return reply.status(201).send({ data: offer });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /offers/:id
  app.get('/:id', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const offer = await prisma.offer.findUnique({
        where: { id },
        include: {
          niche: { select: { id: true, name: true, slug: true, icon: true } },
          store: { select: { id: true, name: true, slug: true } },
          drafts: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true, createdAt: true },
          },
        },
      });

      if (!offer) {
        return sendError(reply, Errors.NOT_FOUND('Oferta'));
      }

      return { data: offer };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // PUT /offers/:id
  app.put('/:id', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = updateOfferSchema.parse(request.body);

      const existing = await prisma.offer.findUnique({ where: { id } });
      if (!existing) {
        return sendError(reply, Errors.NOT_FOUND('Oferta'));
      }

      // Verificar nicho se for atualizado
      if (body.nicheId) {
        const niche = await prisma.niche.findUnique({ where: { id: body.nicheId } });
        if (!niche) {
          return sendError(reply, Errors.NOT_FOUND('Nicho'));
        }
      }

      // Verificar loja se for atualizada
      if (body.storeId) {
        const store = await prisma.store.findUnique({ where: { id: body.storeId } });
        if (!store) {
          return sendError(reply, Errors.NOT_FOUND('Loja'));
        }
      }

      const offer = await prisma.offer.update({
        where: { id },
        data: body,
        include: {
          niche: { select: { id: true, name: true, slug: true, icon: true } },
          store: { select: { id: true, name: true, slug: true } },
        },
      });

      return { data: offer };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // DELETE /offers/:id (soft delete - archive)
  app.delete('/:id', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const existing = await prisma.offer.findUnique({ where: { id } });
      if (!existing) {
        return sendError(reply, Errors.NOT_FOUND('Oferta'));
      }

      await prisma.offer.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });

      return reply.status(204).send();
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // POST /offers/:id/archive
  app.post('/:id/archive', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const existing = await prisma.offer.findUnique({ where: { id } });
      if (!existing) {
        return sendError(reply, Errors.NOT_FOUND('Oferta'));
      }

      const offer = await prisma.offer.update({
        where: { id },
        data: { status: 'ARCHIVED' },
        include: {
          niche: { select: { id: true, name: true, slug: true } },
          store: { select: { id: true, name: true, slug: true } },
        },
      });

      return { data: offer };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });
}
