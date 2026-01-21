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

      // Calcular desconto automaticamente se não fornecido
      let discountPct = body.discountPct;
      if (discountPct === undefined || discountPct === null) {
        if (body.originalPrice && body.finalPrice && body.originalPrice > body.finalPrice) {
          discountPct = Math.round(((body.originalPrice - body.finalPrice) / body.originalPrice) * 100);
        } else {
          discountPct = 0;
        }
      }

      // Se nicheId fornecido, verificar se existe
      let nicheId = body.nicheId;
      if (nicheId) {
        const niche = await prisma.niche.findUnique({ where: { id: nicheId } });
        if (!niche) {
          // Se não existe, pegar o primeiro nicho disponível
          const firstNiche = await prisma.niche.findFirst({ where: { isActive: true } });
          nicheId = firstNiche?.id || null;
        }
      } else {
        // Se não fornecido, pegar o primeiro nicho
        const firstNiche = await prisma.niche.findFirst({ where: { isActive: true } });
        nicheId = firstNiche?.id || null;
      }

      // Se storeId fornecido, verificar se existe
      let storeId = body.storeId;
      if (storeId) {
        const store = await prisma.store.findUnique({ where: { id: storeId } });
        if (!store) {
          storeId = null;
        }
      }
      
      // Se não tem storeId, tentar detectar pelo link afiliado
      if (!storeId && body.affiliateUrl) {
        const url = body.affiliateUrl.toLowerCase();
        
        // Mapa de domínios para slugs de lojas
        const storeMap: Record<string, string> = {
          'mercadolivre': 'mercadolivre',
          'mercadolibre': 'mercadolivre',
          'amazon': 'amazon',
          'magazineluiza': 'magalu',
          'magalu': 'magalu',
          'casasbahia': 'casasbahia',
          'shopee': 'shopee',
          'aliexpress': 'aliexpress',
          'americanas': 'americanas',
          'kabum': 'kabum',
        };
        
        // Detectar loja pelo domínio
        for (const [domain, slug] of Object.entries(storeMap)) {
          if (url.includes(domain)) {
            const detectedStore = await prisma.store.findFirst({ 
              where: { slug, isActive: true } 
            });
            if (detectedStore) {
              storeId = detectedStore.id;
              break;
            }
          }
        }
      }
      
      // Se ainda não tem, pegar a primeira loja
      if (!storeId) {
        const firstStore = await prisma.store.findFirst({ where: { isActive: true } });
        storeId = firstStore?.id || null;
      }

      // Validar que temos nicho e loja
      if (!nicheId || !storeId) {
        return reply.status(400).send({
          error: {
            code: 'SETUP_REQUIRED',
            message: 'Nicho e Loja são necessários. Execute /setup primeiro.',
          },
        });
      }

      const offer = await prisma.offer.create({
        data: {
          title: body.title,
          description: body.description,
          originalPrice: body.originalPrice,
          finalPrice: body.finalPrice,
          discountPct,
          affiliateUrl: body.affiliateUrl || '',
          imageUrl: body.imageUrl,
          nicheId,
          storeId,
          urgency: body.urgency || 'NORMAL',
          expiresAt: body.expiresAt,
        },
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

  // ==================== CRIAR DRAFT A PARTIR DE OFERTA ====================
  // POST /offers/:id/create-draft
  app.post('/:id/create-draft', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        copyText?: string;
        batchId?: string;
        channels?: string[];
        priority?: 'HIGH' | 'NORMAL' | 'LOW';
      };

      // Buscar oferta
      const offer = await prisma.offer.findUnique({
        where: { id },
        include: {
          niche: { select: { name: true, icon: true } },
          store: { select: { name: true } },
        },
      });

      if (!offer) {
        return sendError(reply, Errors.NOT_FOUND('Oferta'));
      }

      // Buscar ou criar batch (carga) para hoje
      let batchId = body.batchId;
      
      if (!batchId) {
        // Pegar a próxima carga disponível do dia
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Buscar batch existente para hoje
        let batch = await prisma.batch.findFirst({
          where: {
            date: today,
            status: 'PENDING',
          },
          orderBy: { scheduledTime: 'asc' },
        });

        // Se não existe, criar um novo batch
        if (!batch) {
          // Buscar schedule padrão (ex: 14:00)
          const schedule = await prisma.batchSchedule.findFirst({
            where: { enabled: true },
            orderBy: { order: 'asc' },
          });

          const scheduledTime = schedule?.time || '14:00';

          batch = await prisma.batch.create({
            data: {
              date: today,
              scheduledTime,
              status: 'PENDING',
            },
          });
        }

        batchId = batch.id;
      }

      // Gerar copy text se não fornecido
      const formatPrice = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

      let copyText = body.copyText;
      if (!copyText) {
        const originalPrice = offer.originalPrice ? formatPrice(Number(offer.originalPrice)) : null;
        const finalPrice = formatPrice(Number(offer.finalPrice));
        const discount = offer.discountPct ? `${offer.discountPct}%` : null;

        // Copy estilo Manu
        const openers = [
          'Achei isso agora pouco 👀',
          'Olha esse preço!',
          'Fazia tempo que não via assim',
          'Pra quem tava esperando baixar...',
          'Vale a pena dar uma olhada',
        ];
        const opener = openers[Math.floor(Math.random() * openers.length)];

        copyText = `${opener}\n\n${offer.title}\n\n`;
        if (originalPrice && discount) {
          copyText += `De ${originalPrice} por ${finalPrice} (-${discount})\n\n`;
        } else {
          copyText += `Por apenas ${finalPrice}\n\n`;
        }
        if (offer.store?.name) {
          copyText += `📦 ${offer.store.name}\n`;
        }
        if (offer.affiliateUrl) {
          copyText += `\n👉 ${offer.affiliateUrl}`;
        }
      }

      // Definir canais (com tipo correto)
      const defaultChannels: ('TELEGRAM' | 'WHATSAPP' | 'FACEBOOK' | 'TWITTER' | 'SITE')[] = ['TELEGRAM', 'SITE'];
      const channels = (body.channels as typeof defaultChannels) || defaultChannels;

      // Criar o draft
      const draft = await prisma.postDraft.create({
        data: {
          offerId: offer.id,
          batchId,
          copyText,
          channels,
          priority: body.priority || 'NORMAL',
          status: 'PENDING',
        },
        include: {
          offer: {
            include: {
              niche: { select: { id: true, name: true, slug: true, icon: true } },
              store: { select: { id: true, name: true, slug: true } },
            },
          },
          batch: {
            select: { id: true, scheduledTime: true, status: true },
          },
        },
      });

      // Atualizar contadores do batch
      await prisma.batch.update({
        where: { id: batchId },
        data: {
          pendingCount: { increment: 1 },
        },
      });

      return reply.status(201).send({
        success: true,
        message: 'Post criado com sucesso! Ele está pendente de aprovação.',
        data: draft,
      });
    } catch (error: any) {
      console.error('Erro ao criar draft:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Erro ao criar draft',
      });
    }
  });
}
