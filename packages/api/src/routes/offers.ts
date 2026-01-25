import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authGuard, adminGuard } from '../lib/auth.js';
import { createOfferSchema, updateOfferSchema, offersFilterSchema } from '../lib/schemas.js';
import { sendError, Errors } from '../lib/errors.js';
import { processOffer, calculateScore } from '../services/offerScoring.js';
import { generateCopies } from '../services/aiCopyGenerator.js';

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

      // 🤖 v2.0: Extrair campos de IA do body
      const bodyWithAI = body as typeof body & {
        mainImage?: string;
        images?: string[];
        curationStatus?: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED';
      };

      // Garantir que imageUrl tenha valor (mainImage ou imageUrl do body)
      const finalImageUrl = bodyWithAI.mainImage || body.imageUrl;

      const offer = await prisma.offer.create({
        data: {
          title: body.title,
          description: body.description,
          originalPrice: body.originalPrice,
          finalPrice: body.finalPrice,
          discountPct,
          affiliateUrl: body.affiliateUrl || '',
          imageUrl: finalImageUrl,  // 🔥 FIX: Usar mainImage se imageUrl não fornecido
          nicheId,
          storeId,
          urgency: body.urgency || 'NORMAL',
          expiresAt: body.expiresAt,
          // 🤖 v2.0: Novos campos
          mainImage: finalImageUrl,  // 🔥 FIX: Ambos devem ter o mesmo valor
          images: bodyWithAI.images || [],
          curationStatus: bodyWithAI.curationStatus || 'DRAFT',
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

  // PATCH /offers/:id - Atualização parcial de oferta
  app.patch('/:id', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        title?: string;
        originalPrice?: number;
        finalPrice?: number;
        discountPct?: number;
        description?: string;
        affiliateUrl?: string;
        imageUrl?: string;
        // 🤖 v2.0: Novos campos
        mainImage?: string;
        images?: string[];
        curationStatus?: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'AI_PROCESSING' | 'AI_READY' | 'AI_BLOCKED';
      };

      // Verificar se oferta existe
      const existingOffer = await prisma.offer.findUnique({ where: { id } });
      if (!existingOffer) {
        return sendError(reply, Errors.NOT_FOUND('Oferta'));
      }

      // Construir objeto de atualização apenas com campos fornecidos
      const updateData: any = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.originalPrice !== undefined) updateData.originalPrice = body.originalPrice;
      if (body.finalPrice !== undefined) updateData.finalPrice = body.finalPrice;
      if (body.discountPct !== undefined) updateData.discountPct = body.discountPct;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.affiliateUrl !== undefined) updateData.affiliateUrl = body.affiliateUrl;
      
      // 🔥 FIX: Sincronizar imageUrl e mainImage
      if (body.imageUrl !== undefined || body.mainImage !== undefined) {
        const finalImage = body.mainImage || body.imageUrl;
        updateData.imageUrl = finalImage;
        updateData.mainImage = finalImage;
      }
      
      // 🤖 v2.0: Novos campos
      if (body.images !== undefined) updateData.images = body.images;
      if (body.curationStatus !== undefined) updateData.curationStatus = body.curationStatus;

      const offer = await prisma.offer.update({
        where: { id },
        data: updateData,
        include: {
          niche: { select: { id: true, name: true, slug: true, icon: true } },
          store: { select: { id: true, name: true, slug: true } },
        },
      });

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
        useNewCopyEngine?: boolean;  // 🔥 NOVO: usar novo engine de copy
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

      // 🔥 NOVO: Calcular score da oferta
      const scoreResult = calculateScore({
        title: offer.title,
        price: Number(offer.finalPrice),
        oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
        discountPct: offer.discountPct,
        category: offer.niche?.name,
        storeName: offer.store?.name,
        imageUrl: offer.imageUrl,
        trackingUrl: offer.affiliateUrl,
        productUrl: offer.affiliateUrl,
        source: offer.source,
      });

      // 🔥 NOVO: Gerar copy usando novo engine
      let copyText = body.copyText;
      let copyTextTelegram: string | undefined;
      let copyTextSite: string | undefined;
      let copyTextX: string | undefined;

      if (!copyText || body.useNewCopyEngine) {
        // Usar novo copy engine
        const copies = generateCopies({
          title: offer.title,
          price: Number(offer.finalPrice),
          oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
          discountPct: offer.discountPct || 0,
          advertiserName: offer.store?.name,
          storeName: offer.store?.name,
          category: offer.niche?.name,
          trackingUrl: offer.affiliateUrl,
        });

        copyText = copies.telegram;
        copyTextTelegram = copies.telegram;
        copyTextSite = copies.site;
        copyTextX = copies.x;
      } else {
        // Usar copy fornecida ou gerar com engine legado
        if (!copyText) {
          const formatPrice = (price: number) =>
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
          
          const originalPrice = offer.originalPrice ? formatPrice(Number(offer.originalPrice)) : null;
          const finalPrice = formatPrice(Number(offer.finalPrice));
          const discount = offer.discountPct ? `${offer.discountPct}%` : null;

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
      }

      // Definir canais (com tipo correto)
      const defaultChannels: ('TELEGRAM' | 'WHATSAPP' | 'FACEBOOK' | 'TWITTER' | 'SITE')[] = ['TELEGRAM', 'SITE'];
      let channels = (body.channels as typeof defaultChannels) || defaultChannels;

      // 🔥 NOVO: Se score alto e tem imagem, sugerir X
      const shouldAddX = scoreResult.score >= 60 && offer.imageUrl && !channels.includes('TWITTER');
      
      // Determinar prioridade pelo score se não fornecida
      const priority = body.priority || 
        (scoreResult.classification === 'HIGH' ? 'HIGH' : 
         scoreResult.classification === 'MEDIUM' ? 'NORMAL' : 'LOW');

      // Criar o draft
      const draft = await prisma.postDraft.create({
        data: {
          offerId: offer.id,
          batchId,
          copyText,
          copyTextTelegram,
          copyTextSite,
          copyTextX,
          channels,
          priority,
          status: 'PENDING',
          score: scoreResult.score,  // 🔥 NOVO: salvar score
          imageUrl: offer.imageUrl,
          requiresImage: channels.includes('TWITTER'),
          requiresHumanForX: channels.includes('TWITTER'),
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
        data: {
          ...draft,
          scoring: {
            score: scoreResult.score,
            classification: scoreResult.classification,
            breakdown: scoreResult.breakdown,
            suggestX: shouldAddX,
          },
        },
      });
    } catch (error: any) {
      console.error('Erro ao criar draft:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Erro ao criar draft',
      });
    }
  });

  // ==================== 🔥 NOVO: CALCULAR SCORE DE OFERTA ====================
  // POST /offers/:id/score
  app.post('/:id/score', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const offer = await prisma.offer.findUnique({
        where: { id },
        include: {
          niche: { select: { name: true } },
          store: { select: { name: true } },
        },
      });

      if (!offer) {
        return sendError(reply, Errors.NOT_FOUND('Oferta'));
      }

      // Calcular score
      const scoreResult = calculateScore({
        title: offer.title,
        price: Number(offer.finalPrice),
        oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
        discountPct: offer.discountPct,
        category: offer.niche?.name,
        storeName: offer.store?.name,
        imageUrl: offer.imageUrl,
        trackingUrl: offer.affiliateUrl,
        productUrl: offer.affiliateUrl,
        source: offer.source,
      });

      // Atualizar drafts pendentes com novo score
      const updatedDrafts = await prisma.postDraft.updateMany({
        where: {
          offerId: id,
          status: 'PENDING',
        },
        data: {
          score: scoreResult.score,
        },
      });

      return {
        success: true,
        data: {
          offerId: id,
          score: scoreResult.score,
          classification: scoreResult.classification,
          breakdown: scoreResult.breakdown,
          draftsUpdated: updatedDrafts.count,
        },
      };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // ==================== 🔥 NOVO: GERAR COPY PARA OFERTA ====================
  // POST /offers/:id/generate-copy
  app.post('/:id/generate-copy', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        generateVariations?: boolean;
      };

      const offer = await prisma.offer.findUnique({
        where: { id },
        include: {
          niche: { select: { name: true } },
          store: { select: { name: true } },
        },
      });

      if (!offer) {
        return sendError(reply, Errors.NOT_FOUND('Oferta'));
      }

      // Gerar copies
      const copies = generateCopies({
        title: offer.title,
        price: Number(offer.finalPrice),
        oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
        discountPct: offer.discountPct || 0,
        advertiserName: offer.store?.name,
        storeName: offer.store?.name,
        category: offer.niche?.name,
        trackingUrl: offer.affiliateUrl,
      }, {
        generateVariations: body.generateVariations,
      });

      return {
        success: true,
        data: {
          offerId: id,
          copies: {
            telegram: copies.telegram,
            site: copies.site,
            x: copies.x,
          },
          variations: copies.variations,
          charCounts: {
            telegram: copies.telegram.length,
            site: copies.site.length,
            x: copies.x.length,
          },
        },
      };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });
}
