import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { publicationsFilterSchema } from '../lib/schemas.js';

// Rotas PÚBLICAS - para o site vitrine (sem autenticação)
export async function publicRoutes(app: FastifyInstance) {
  // GET /public/feed - Feed de ofertas
  app.get('/feed', async (request) => {
    const query = publicationsFilterSchema.partial().parse(request.query);
    const { limit = 20, page = 1, nicheSlug, q, sort = 'recent' } = query;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    
    if (nicheSlug) {
      const niche = await prisma.niche.findUnique({ where: { slug: nicheSlug } });
      if (niche) where.nicheId = niche.id;
    }
    
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orderBy = sort === 'discount' 
      ? { discountPct: 'desc' as const }
      : { publishedAt: 'desc' as const };

    const [items, total] = await Promise.all([
      prisma.publishedPost.findMany({
        where,
        skip,
        take: limit + 1, // +1 para saber se há mais
        orderBy,
        select: {
          id: true,
          slug: true,
          goCode: true,
          title: true,
          excerpt: true,
          price: true,
          originalPrice: true,
          discountPct: true,
          imageUrl: true,
          urgency: true,
          publishedAt: true,
          niche: { select: { name: true, slug: true, icon: true } },
          store: { select: { name: true, slug: true } },
        },
      }),
      prisma.publishedPost.count({ where }),
    ]);

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, -1) : items;

    return {
      items: data.map(item => ({
        ...item,
        price: Number(item.price),
        originalPrice: item.originalPrice ? Number(item.originalPrice) : null,
        niche: item.niche.name,
        nicheSlug: item.niche.slug,
        nicheIcon: item.niche.icon,
        store: item.store.name,
        storeSlug: item.store.slug,
      })),
      hasMore,
      total,
    };
  });

  // GET /public/posts - Alias para feed (compatibilidade)
  app.get('/posts', async (request) => {
    const query = request.query as any;
    const limit = parseInt(query.limit) || 20;
    const cursor = query.cursor;
    const sort = query.sort || 'recent';
    const niche = query.niche;

    const where: any = { isActive: true };
    if (niche) {
      where.niche = { name: { contains: niche, mode: 'insensitive' } };
    }

    const orderBy = sort === 'discount' 
      ? { discountPct: 'desc' as const }
      : { publishedAt: 'desc' as const };

    const items = await prisma.publishedPost.findMany({
      where,
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy,
      select: {
        id: true,
        slug: true,
        goCode: true,
        title: true,
        copyText: true,
        price: true,
        originalPrice: true,
        discountPct: true,
        affiliateUrl: true,
        imageUrl: true,
        urgency: true,
        publishedAt: true,
        niche: { select: { name: true, slug: true, icon: true } },
        store: { select: { name: true, slug: true } },
      },
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, -1) : items;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      items: data.map((item: any) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        copyText: item.copyText,
        price: Number(item.price),
        originalPrice: item.originalPrice ? Number(item.originalPrice) : null,
        discount: item.discountPct || 0,
        affiliateUrl: item.affiliateUrl,
        imageUrl: item.imageUrl,
        urgency: item.urgency,
        niche: item.niche?.name || 'Outros',
        nicheIcon: item.niche?.icon,
        store: item.store?.name || 'Loja',
        publishedAt: item.publishedAt,
      })),
      nextCursor,
      hasMore,
    };
  });

  // GET /public/posts/:id - Post específico
  app.get('/posts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const post = await prisma.publishedPost.findFirst({
      where: {
        OR: [{ id }, { slug: id }, { goCode: id }],
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        goCode: true,
        title: true,
        copyText: true,
        price: true,
        originalPrice: true,
        discountPct: true,
        affiliateUrl: true,
        imageUrl: true,
        urgency: true,
        publishedAt: true,
        niche: { select: { name: true, slug: true, icon: true } },
        store: { select: { name: true, slug: true } },
      },
    });

    if (!post) {
      return reply.status(404).send({ error: 'Post não encontrado' });
    }

    return {
      id: post.id,
      slug: post.slug,
      goCode: post.goCode,
      title: post.title,
      copyText: post.copyText,
      price: Number(post.price),
      originalPrice: post.originalPrice ? Number(post.originalPrice) : null,
      discount: post.discountPct || 0,
      affiliateUrl: post.affiliateUrl,
      imageUrl: post.imageUrl,
      urgency: post.urgency,
      niche: post.niche.name,
      nicheIcon: post.niche.icon,
      store: post.store.name,
      publishedAt: post.publishedAt,
    };
  });

  // POST /public/posts/:id/click - Registrar clique
  app.post('/posts/:id/click', async (request, reply) => {
    const { id } = request.params as { id: string };

    const post = await prisma.publishedPost.findFirst({
      where: {
        OR: [{ id }, { slug: id }, { goCode: id }],
      },
    });

    if (!post) {
      return reply.status(404).send({ error: 'Post não encontrado' });
    }

    // Registrar clique
    await prisma.click.create({
      data: {
        goCode: post.goCode,
        publishedPostId: post.id,
        offerId: post.offerId,
        userAgent: request.headers['user-agent'],
        referer: request.headers.referer,
      },
    });

    return { url: post.affiliateUrl };
  });

  // GET /public/niches - Listar nichos ativos
  app.get('/niches', async () => {
    const niches = await prisma.niche.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
      },
    });

    return niches;
  });

  // GET /public/niches/:slug/posts - Posts por nicho
  app.get('/niches/:slug/posts', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const query = request.query as { limit?: string };

    const niche = await prisma.niche.findUnique({
      where: { slug },
    });

    if (!niche) {
      return reply.status(404).send({ error: 'Nicho não encontrado' });
    }

    const posts = await prisma.publishedPost.findMany({
      where: {
        isActive: true,
        nicheId: niche.id,
      },
      orderBy: { publishedAt: 'desc' },
      take: parseInt(query.limit || '20'),
      select: {
        id: true,
        slug: true,
        goCode: true,
        title: true,
        copyText: true,
        price: true,
        originalPrice: true,
        discountPct: true,
        affiliateUrl: true,
        imageUrl: true,
        urgency: true,
        publishedAt: true,
        niche: { select: { name: true, slug: true, icon: true } },
        store: { select: { name: true, slug: true } },
      },
    });

    return {
      niche: {
        id: niche.id,
        name: niche.name,
        slug: niche.slug,
        icon: niche.icon,
      },
      posts: posts.map(post => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        copyText: post.copyText,
        price: Number(post.price),
        originalPrice: post.originalPrice ? Number(post.originalPrice) : null,
        discount: post.discountPct || 0,
        affiliateUrl: post.affiliateUrl,
        imageUrl: post.imageUrl,
        urgency: post.urgency,
        niche: post.niche.name,
        store: post.store.name,
        publishedAt: post.publishedAt,
      })),
    };
  });

  // GET /public/highlights - Destaques (um post por nicho)
  app.get('/highlights', async () => {
    const niches = await prisma.niche.findMany({
      where: { isActive: true },
    });

    const highlights = await Promise.all(
      niches.map(async (niche) => {
        const post = await prisma.publishedPost.findFirst({
          where: {
            isActive: true,
            nicheId: niche.id,
          },
          orderBy: { publishedAt: 'desc' },
          select: {
            id: true,
            slug: true,
            title: true,
            price: true,
            discountPct: true,
            urgency: true,
          },
        });

        if (!post) return null;

        return {
          niche: {
            id: niche.id,
            name: niche.name,
            slug: niche.slug,
            icon: niche.icon,
          },
          post: {
            id: post.id,
            slug: post.slug,
            title: post.title,
            price: Number(post.price),
            discount: post.discountPct || 0,
            urgency: post.urgency,
          },
        };
      })
    );

    return highlights.filter(Boolean);
  });

  // GET /public/oferta/:slug - Alias para posts/:id
  app.get('/oferta/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const post = await prisma.publishedPost.findFirst({
      where: {
        OR: [{ slug }, { goCode: slug }],
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        goCode: true,
        title: true,
        copyText: true,
        price: true,
        originalPrice: true,
        discountPct: true,
        affiliateUrl: true,
        imageUrl: true,
        urgency: true,
        publishedAt: true,
        niche: { select: { name: true, slug: true, icon: true } },
        store: { select: { name: true, slug: true } },
      },
    });

    if (!post) {
      return reply.status(404).send({ error: 'Oferta não encontrada' });
    }

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      copyText: post.copyText,
      price: Number(post.price),
      originalPrice: post.originalPrice ? Number(post.originalPrice) : null,
      discount: post.discountPct,
      affiliateUrl: post.affiliateUrl,
      imageUrl: post.imageUrl,
      urgency: post.urgency,
      niche: post.niche.name,
      store: post.store.name,
      publishedAt: post.publishedAt,
    };
  });
}
