import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { createPublicationSchema, publicationsFilterSchema } from '../lib/schemas.js';
import { sendError, Errors } from '../lib/errors.js';

// Gerar slug a partir do título
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

export async function publicationsRoutes(app: FastifyInstance) {
  // GET /publications - Listar publicações
  app.get('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = publicationsFilterSchema.parse(request.query);
      const { page, limit, nicheSlug, storeSlug, q, sort, isActive } = query;
      const skip = (page - 1) * limit;

      const where: any = {};
      
      if (nicheSlug) {
        const niche = await prisma.niche.findUnique({ where: { slug: nicheSlug } });
        if (niche) where.nicheId = niche.id;
      }
      
      if (storeSlug) {
        const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
        if (store) where.storeId = store.id;
      }
      
      if (q) {
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { excerpt: { contains: q, mode: 'insensitive' } },
        ];
      }
      
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const orderBy = sort === 'discount' 
        ? { discountPct: 'desc' as const }
        : { publishedAt: 'desc' as const };

      const [publications, total] = await Promise.all([
        prisma.publishedPost.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            niche: { select: { id: true, name: true, slug: true, icon: true } },
            store: { select: { id: true, name: true, slug: true } },
            _count: { select: { clicks: true } },
          },
        }),
        prisma.publishedPost.count({ where }),
      ]);

      return {
        data: publications,
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

  // POST /publications - Criar publicação a partir de uma oferta
  app.post('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const body = createPublicationSchema.parse(request.body);

      // Buscar oferta
      const offer = await prisma.offer.findUnique({
        where: { id: body.offerId },
        include: {
          niche: true,
          store: true,
        },
      });

      if (!offer) {
        return sendError(reply, Errors.NOT_FOUND('Oferta'));
      }

      // Gerar slug único
      let slug = generateSlug(body.title || offer.title);
      let slugSuffix = 0;
      while (await prisma.publishedPost.findUnique({ where: { slug } })) {
        slugSuffix++;
        slug = `${generateSlug(body.title || offer.title)}-${slugSuffix}`;
      }

      // Gerar goCode único
      const goCode = nanoid(8);

      const publication = await prisma.publishedPost.create({
        data: {
          offerId: offer.id,
          slug,
          goCode,
          title: body.title || offer.title,
          excerpt: body.excerpt || offer.description,
          copyText: body.copyText || `🔥 ${offer.title}\n\nDe R$ ${offer.originalPrice} por R$ ${offer.finalPrice}\n\n${offer.discountPct}% de desconto!`,
          price: offer.finalPrice,
          originalPrice: offer.originalPrice,
          discountPct: offer.discountPct,
          affiliateUrl: offer.affiliateUrl,
          imageUrl: offer.imageUrl,
          urgency: offer.urgency,
          nicheId: offer.nicheId,
          storeId: offer.storeId,
          isActive: true,
        },
        include: {
          niche: { select: { id: true, name: true, slug: true, icon: true } },
          store: { select: { id: true, name: true, slug: true } },
        },
      });

      return reply.status(201).send({ data: publication });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /publications/:slug
  app.get('/:slug', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { slug } = request.params as { slug: string };

      const publication = await prisma.publishedPost.findUnique({
        where: { slug },
        include: {
          niche: true,
          store: true,
          offer: true,
          _count: { select: { clicks: true } },
        },
      });

      if (!publication) {
        return sendError(reply, Errors.NOT_FOUND('Publicação'));
      }

      return { data: publication };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // POST /publications/:id/unpublish
  app.post('/:id/unpublish', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const publication = await prisma.publishedPost.findUnique({ where: { id } });

      if (!publication) {
        return sendError(reply, Errors.NOT_FOUND('Publicação'));
      }

      const updated = await prisma.publishedPost.update({
        where: { id },
        data: { isActive: false },
        include: {
          niche: { select: { id: true, name: true, slug: true } },
          store: { select: { id: true, name: true, slug: true } },
        },
      });

      return { data: updated };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });
}
