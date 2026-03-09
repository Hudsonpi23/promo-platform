import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authGuard, adminGuard } from '../lib/auth.js';
import { createOfferSchema, updateOfferSchema, offersFilterSchema } from '../lib/schemas.js';
import { sendError, Errors } from '../lib/errors.js';
import { processOffer, calculateScore } from '../services/offerScoring.js';
import { generateCopies } from '../services/aiCopyGenerator.js';
import { detectNicheSlug as detectNicheSlugShared, resolveNicheFromTitle } from '../services/nicheDetector.js';

// ── Mapeamento de palavras-chave → slug de nicho ──────────────────────────────
// Ordem importa: os nichos mais específicos devem vir ANTES dos genéricos
const NICHE_KEYWORDS: Record<string, string[]> = {
  livros: [
    'livro', 'book', 'harry potter', 'romance', 'novel', 'coleção', 'saga',
    'literatura', 'editora', 'edição', 'bíblia', 'poesia', 'conto', 'devocional',
    'almanaque', 'enciclopédia', 'mangá', 'hq', 'quadrinho', 'rowling',
    'tolkien', 'autobiografia', 'biografia', 'autoajuda', 'espiritismo',
  ],
  games: [
    'game', 'jogo', 'videogame', 'console', 'playstation', 'xbox', 'nintendo',
    'controle gamer', 'joystick', 'gamer', 'ps4', 'ps5', 'switch', 'gaming',
    'headset gamer', 'cadeira gamer', 'rgb gamer', 'pc gamer',
  ],
  esportes: [
    'futebol', 'chuteira', 'bola de futebol', 'uniforme esportivo',
    'academia', 'musculação', 'haltere', 'anilha', 'barra de treino',
    'corrida', 'tênis esportivo', 'natação', 'óculos de natação',
    'bike', 'bicicleta', 'patins', 'skate',
    'fitness', 'treino', 'suplemento esportivo', 'whey', 'creatina',
  ],
  beleza: [
    'maquiagem', 'batom', 'perfume', 'colônia', 'desodorante',
    'shampoo', 'condicionador', 'máscara capilar', 'escova', 'babyliss',
    'skincare', 'hidratante', 'protetor solar', 'sérum', 'base', 'blush',
    'esmalte', 'removedor de esmalte', 'unhas', 'depilação',
    'creme para o rosto', 'tônico facial', 'kit de maquiagem',
  ],
  casa: [
    'quadro', 'quadros', 'decorativo', 'decoração', 'decorativos',
    'cama', 'colchão', 'travesseiro', 'cobertor', 'lençol', 'edredom',
    'sofá', 'poltrona', 'mesa de jantar', 'mesa de escritório',
    'cadeira', 'armário', 'guarda-roupa', 'estante', 'prateleira',
    'geladeira', 'fogão', 'micro-ondas', 'forno elétrico',
    'cafeteira', 'liquidificador', 'batedeira', 'air fryer', 'fritadeira',
    'panela', 'frigideira', 'chaleira', 'jarra', 'garrafa termica',
    'garrafa térmica', 'copo térmico', 'pote', 'vasilha',
    'vassoura', 'rodo', 'mop', 'tapete', 'capacho',
    'luminária', 'abajur', 'espelho', 'porta-retrato',
    'organizador', 'cabide', 'cesto', 'caixa organizadora',
    'ventilador', 'climatizador', 'ar condicionado',
  ],
  moda: [
    'camiseta', 'camisa', 'calça', 'bermuda', 'short', 'vestido', 'saia',
    'blusa', 'regata', 'moletom', 'jaqueta', 'casaco', 'sobretudo',
    'meias', 'meia', 'cueca', 'sutiã', 'calcinha', 'boxer', 'pijama',
    'sapato', 'sandália', 'chinelo', 'tênis casual', 'bota', 'sapatilha',
    'bolsa', 'mochila', 'carteira', 'cinto', 'óculos de sol',
    'roupa infantil', 'roupa feminina', 'roupa masculina', 'roupa bebê',
    'conjunto', 'kit pares meias', 'kit meias',
  ],
  mercado: [
    'alimento', 'comida', 'bebida', 'café solúvel', 'leite condensado',
    'suco', 'óleo de cozinha', 'arroz', 'feijão', 'macarrão',
    'biscoito', 'snack', 'vitamina', 'proteína em pó',
    'tempero', 'molho', 'conserva', 'enlatado',
  ],
  eletronicos: [
    'celular', 'smartphone', 'iphone', 'notebook', 'computador',
    'tv ', 'televisão', 'smart tv', 'tablet', 'ipad',
    'fone de ouvido', 'headphone', 'earphone', 'câmera', 'câmera fotográfica',
    'impressora', 'monitor', 'teclado', 'mouse', 'hd externo', 'ssd',
    'processador', 'placa de vídeo', 'roteador', 'carregador', 'pendrive',
    'smartwatch', 'relógio inteligente', 'caixa de som', 'soundbar',
    'projetor', 'drone', 'leitor de cartão',
  ],
};

/** Detecta o slug do nicho mais adequado a partir do título do produto */
function detectNicheSlug(title: string): string | null {
  return detectNicheSlugShared(title);
}

async function resolveNicheIdFromTitle(title: string): Promise<string | null> {
  return resolveNicheFromTitle(title);
}

export async function offersRoutes(app: FastifyInstance) {
  // GET /offers - Listar ofertas com filtros
  app.get('/', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const query = offersFilterSchema.parse(request.query);
      const { page, limit, nicheId, storeId, status, curationStatus, minDiscount, q, dateFrom, dateTo } = query;
      const skip = (page - 1) * limit;

      const where: any = {};
      
      if (nicheId) where.nicheId = nicheId;
      if (storeId) where.storeId = storeId;
      if (curationStatus) where.curationStatus = curationStatus;
      if (status) where.status = status;
      else where.status = { not: 'ARCHIVED' }; // 🗑️ Não mostrar ofertas arquivadas por padrão
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
              _count: { select: { drafts: true, offerPublications: true } },
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
        if (!niche) nicheId = null;
      }

      // Se nicheId não definido, detectar automaticamente pelo título
      if (!nicheId && body.title) {
        nicheId = await resolveNicheIdFromTitle(body.title);
      } else if (!nicheId) {
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
          // Novas lojas afiliadas do usuário
          'stanley1913': 'stanley-br',
          'lg.com': 'lg-br',
          'intimissimi.com.br': 'intimissimi-br',
          'arno.com.br': 'arno-br',
          'mizuno.com.br': 'mizuno-br',
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
      if (error?.message?.includes('connect') || error?.message?.includes('Connection') || !process.env.DATABASE_URL) {
        return reply.status(503).send({ error: { code: 'DB_CONNECTION', message: 'Banco de dados indisponível. Configure DATABASE_URL no Render.' } });
      }
      console.error('[POST /offers] Erro:', error?.message, error?.code);
      return sendError(reply, error);
    }
  });

  /**
   * GET /api/offers/debug/list
   * Lista as últimas ofertas para facilitar encontrar o ID
   * DEVE estar ANTES de /:id para ser capturada corretamente
   */
  app.get('/debug/list', async (request, reply) => {
    try {
      const offers = await prisma.offer.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          finalPrice: true,
          originalPrice: true,
          discountPct: true,
        },
      });

      return reply.send({
        success: true,
        data: offers.map(offer => ({
          id: offer.id,
          title: offer.title.substring(0, 60),
          price: offer.finalPrice,
          discount: offer.discountPct,
          debugUrl: `http://localhost:3001/api/offers/${offer.id}/debug-telegram-text`,
        })),
        message: 'Acesse uma das URLs acima para ver o texto gerado para Telegram',
      });
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // GET /offers/niches - Listar nichos para filtros
  app.get('/niches', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const niches = await prisma.niche.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          icon: true,
        },
        orderBy: { name: 'asc' },
      });

      return { data: niches };
    } catch (error: any) {
      console.error('[Offers/niches] Erro:', error?.message || error);
      if (error?.code === 'P2021') {
        return reply.status(500).send({
          error: {
            code: 'DB_TABLE_MISSING',
            message: 'Tabela Niche não existe. Execute: npx prisma migrate deploy',
          },
        });
      }
      if (error?.message?.includes('connect') || error?.message?.includes('Connection')) {
        return reply.status(503).send({
          error: {
            code: 'DB_CONNECTION',
            message: 'Banco de dados indisponível. Verifique DATABASE_URL.',
          },
        });
      }
      return sendError(reply, error);
    }
  });

  // GET /offers/stores - Listar lojas para filtros
  app.get('/stores', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const stores = await prisma.store.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: { name: 'asc' },
      });

      return { data: stores };
    } catch (error: any) {
      console.error('[Offers/stores] Erro:', error?.message || error);
      if (error?.code === 'P2021') {
        return reply.status(500).send({
          error: {
            code: 'DB_TABLE_MISSING',
            message: 'Tabela Store não existe. Execute: npx prisma migrate deploy',
          },
        });
      }
      if (error?.message?.includes('connect') || error?.message?.includes('Connection')) {
        return reply.status(503).send({
          error: {
            code: 'DB_CONNECTION',
            message: 'Banco de dados indisponível. Verifique DATABASE_URL.',
          },
        });
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
        copyTextTelegram?: string;
        copyTextSite?: string;
        copyTextX?: string;
        batchId?: string;
        channels?: string[];
        priority?: 'HIGH' | 'NORMAL' | 'LOW';
        useNewCopyEngine?: boolean;  // 🔥 NOVO: usar novo engine de copy
        createManual?: boolean; // 🔥 NOVO: flag para indicar que é post manual
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
        discountPct: offer.discountPct ? Number(offer.discountPct) : null,
        category: offer.niche?.name,
        storeName: offer.store?.name,
        imageUrl: offer.imageUrl,
        trackingUrl: offer.affiliateUrl,
        productUrl: offer.affiliateUrl,
        source: offer.source,
      });

      // 🔥 OBRIGATÓRIO: Sempre usar novo copy engine com frases personalizadas e emojis
      // O sistema SEMPRE gera frases personalizadas quando disponíveis
      let copyText: string;
      let copyTextTelegram: string;
      let copyTextSite: string;
      let copyTextX: string;

      // SEMPRE usar novo copy engine (frases personalizadas são obrigatórias)
      const copies = generateCopies({
        title: offer.title,
        price: Number(offer.finalPrice),
        oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
        discountPct: offer.discountPct ? Number(offer.discountPct) : 0,
        advertiserName: offer.store?.name,
        storeName: offer.store?.name,
        category: offer.niche?.name,
        trackingUrl: offer.affiliateUrl,
      });

      copyText = copies.telegram;
      copyTextTelegram = copies.telegram;
      copyTextSite = copies.site;
      copyTextX = copies.x;

      // Se copyText foi fornecido manualmente, usar apenas para copyText genérico
      // Mas copyTextTelegram, copyTextSite e copyTextX SEMPRE usam frases personalizadas
      if (body.copyText && !body.useNewCopyEngine) {
        copyText = body.copyText;
        // Mas ainda gerar as cópias específicas por canal com frases personalizadas
        copyTextTelegram = copies.telegram;
        copyTextSite = copies.site;
        copyTextX = copies.x;
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
          status: 'PENDING', // Post manual sempre PENDING
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
        discountPct: offer.discountPct ? Number(offer.discountPct) : null,
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
        discountPct: offer.discountPct ? Number(offer.discountPct) : 0,
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

  /**
   * GET /api/offers/:offerId/debug-telegram-text
   * Endpoint de debug para verificar o texto que será gerado para Telegram
   * Mais fácil de usar: só precisa do ID da oferta (não do draft)
   * SEM autenticação para facilitar debug
   */
  app.get('/:offerId/debug-telegram-text', async (request, reply) => {
    try {
      const { offerId } = request.params as { offerId: string };
      
      const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        include: {
          niche: true,
          store: true,
        },
      });
      
      if (!offer) {
        return reply.status(404).send({
          success: false,
          error: 'Oferta não encontrada',
        });
      }
      
      // Gerar o texto exatamente como seria gerado para publicação
      const { generateCopies } = await import('../services/aiCopyGenerator.js');
      const copies = generateCopies({
        title: offer.title,
        price: Number(offer.finalPrice),
        oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
        discountPct: offer.discountPct ? Number(offer.discountPct) : 0,
        advertiserName: offer.store?.name,
        storeName: offer.store?.name,
        category: offer.niche?.name,
        trackingUrl: offer.affiliateUrl,
      });
      
      const text = copies.telegram;
      
      // LOG CRÍTICO: Verificar o que foi gerado
      console.log('[Debug] Texto gerado pelo generateCopies:');
      console.log('[Debug] Texto completo:', JSON.stringify(text));
      console.log('[Debug] Tamanho:', text.length);
      console.log('[Debug] Linhas:', text.split('\n').length);
      console.log('[Debug] Linhas não vazias:', text.split('\n').filter(l => l.trim().length > 0).length);
      
      // Análise detalhada do texto
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      const hasOnlyLink = lines.length <= 1 || text.trim() === offer.affiliateUrl;
      
      // Se tiver apenas o link, tentar gerar novamente com fallback forçado
      if (hasOnlyLink) {
        console.error('[Debug] ❌ Texto contém apenas o link! Forçando geração com fallback...');
        
        // Gerar novamente com seed diferente
        const copies2 = generateCopies({
          title: offer.title,
          price: Number(offer.finalPrice),
          oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
          discountPct: offer.discountPct || 0,
          advertiserName: offer.store?.name,
          storeName: offer.store?.name,
          category: offer.niche?.name,
          trackingUrl: offer.affiliateUrl,
        });
        
        const text2 = copies2.telegram;
        console.log('[Debug] Texto gerado na segunda tentativa:', JSON.stringify(text2));
        
        // Se ainda tiver apenas link, usar fallback manual
        const lines2 = text2.split('\n').filter(line => line.trim().length > 0);
        if (lines2.length <= 1 || text2.trim() === offer.affiliateUrl) {
          console.error('[Debug] ❌❌ Segunda tentativa também falhou! Usando fallback manual...');
          const formatPrice = (price: number) =>
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
          
          const fallbackText = `${offer.affiliateUrl.toLowerCase()}\n\nACHADO NÃO É ROUBADO 🔥\n\n${offer.title.toUpperCase().substring(0, 50)}\nPOR ${formatPrice(Number(offer.finalPrice)).toUpperCase()}`;
          return reply.send({
            success: true,
            data: {
              offer: {
                id: offer.id,
                title: offer.title,
                finalPrice: Number(offer.finalPrice),
                originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
                discountPct: offer.discountPct ? Number(offer.discountPct) : null,
                affiliateUrl: offer.affiliateUrl,
              },
              generatedText: {
                text: fallbackText,
                textLength: fallbackText.length,
                lines: fallbackText.split('\n'),
                nonEmptyLines: fallbackText.split('\n').filter(l => l.trim().length > 0).length,
                firstLine: fallbackText.split('\n')[0],
                restOfText: fallbackText.split('\n').slice(1).join('\n'),
                hasOnlyLink: false,
                analysis: {
                  hasLink: true,
                  hasOpening: true,
                  hasPrice: true,
                  hasTitle: true,
                  hasEmoji: true,
                },
                rawText: JSON.stringify(fallbackText),
                warning: '⚠️ Texto original tinha apenas link, usando fallback manual',
                originalText: text,
              },
            },
          });
        }
        
        // Usar segunda tentativa se funcionou
        return reply.send({
          success: true,
          data: {
            offer: {
              id: offer.id,
              title: offer.title,
              finalPrice: Number(offer.finalPrice),
              originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
              discountPct: offer.discountPct ? Number(offer.discountPct) : null,
              affiliateUrl: offer.affiliateUrl,
            },
            generatedText: {
              text: text2,
              textLength: text2.length,
              lines: text2.split('\n'),
              nonEmptyLines: text2.split('\n').filter(l => l.trim().length > 0).length,
              firstLine: text2.split('\n')[0],
              restOfText: text2.split('\n').slice(1).join('\n'),
              hasOnlyLink: lines2.length <= 1,
              analysis: {
                hasLink: text2.includes(offer.affiliateUrl),
                hasOpening: lines2.length > 1 && !lines2[1].startsWith('http'),
                hasPrice: text2.includes('R$') || text2.includes('POR') || text2.includes('DE') || text2.includes('SAIU'),
                hasTitle: text2.includes(offer.title.toUpperCase().substring(0, 20)),
                hasEmoji: /[🔥⭐💎👀]/.test(text2),
              },
              rawText: JSON.stringify(text2),
              warning: lines2.length <= 1 ? '⚠️ ATENÇÃO: Texto contém apenas o link!' : null,
              originalText: text,
            },
          },
        });
      }
      
      return reply.send({
        success: true,
        data: {
            offer: {
              id: offer.id,
              title: offer.title,
              finalPrice: Number(offer.finalPrice),
              originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
              discountPct: offer.discountPct ? Number(offer.discountPct) : null,
              affiliateUrl: offer.affiliateUrl,
            },
          generatedText: {
            text,
            textLength: text.length,
            lines: text.split('\n'),
            nonEmptyLines: lines.length,
            firstLine: lines[0] || '',
            restOfText: lines.slice(1).join('\n'),
            hasOnlyLink,
            analysis: {
              hasLink: text.includes(offer.affiliateUrl),
              hasOpening: lines.length > 1 && !lines[1].startsWith('http'),
              hasPrice: text.includes('R$') || text.includes('POR') || text.includes('DE') || text.includes('SAIU'),
              hasTitle: text.includes(offer.title.toUpperCase().substring(0, 20)),
              hasEmoji: /[🔥⭐💎👀]/.test(text),
            },
            rawText: JSON.stringify(text),
          },
          warning: hasOnlyLink ? '⚠️ ATENÇÃO: Texto contém apenas o link! Isso pode fazer o Telegram não mostrar o texto.' : null,
        },
      });
    } catch (error: any) {
      console.error('[Debug] Erro ao gerar texto de debug:', error);
      return sendError(reply, error);
    }
  });

  // POST /offers/fix-niches — Corrige o nicho de TODAS as Offer + PublishedPost baseado no título
  app.post('/fix-niches', { preHandler: [authGuard] }, async (_request, reply) => {
    try {
      const allNiches = await prisma.niche.findMany({ where: { isActive: true } });
      let updatedOffers = 0;
      let updatedPosts = 0;
      let skipped = 0;

      // 1. Corrigir tabela Offer
      const offers = await prisma.offer.findMany({ select: { id: true, title: true } });
      for (const offer of offers) {
        const slug = detectNicheSlug(offer.title);
        if (!slug) { skipped++; continue; }
        const matched = allNiches.find(n => n.slug === slug);
        if (!matched) { skipped++; continue; }
        await prisma.offer.update({ where: { id: offer.id }, data: { nicheId: matched.id } });
        updatedOffers++;
      }

      // 2. Corrigir tabela PublishedPost (que alimenta o site público)
      const posts = await prisma.publishedPost.findMany({ select: { id: true, title: true } });
      for (const post of posts) {
        const slug = detectNicheSlug(post.title);
        if (!slug) continue;
        const matched = allNiches.find(n => n.slug === slug);
        if (!matched) continue;
        await prisma.publishedPost.update({ where: { id: post.id }, data: { nicheId: matched.id } });
        updatedPosts++;
      }

      return reply.send({
        success: true,
        updatedOffers,
        updatedPosts,
        skipped,
        message: `✅ ${updatedOffers} Offers + ${updatedPosts} PublishedPosts corrigidos`,
      });
    } catch (error: any) {
      console.error('[fix-niches] Erro:', error);
      return sendError(reply, error);
    }
  });
}
