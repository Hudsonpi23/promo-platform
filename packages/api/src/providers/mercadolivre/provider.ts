/**
 * Provider Mercado Livre
 * 
 * Orquestra coleta, validação, criação de ofertas e drafts.
 */

import { PrismaClient, Channel } from '@prisma/client';
import { MercadoLivreClient, mlClient } from './client';
import { MLConfig, NormalizedOffer, RunMode, RunResult, MLProduct } from './types';
import { validateProduct, normalizeProduct, isDuplicate, calculateScore } from './validator';
import { generateHumanCopy } from './copyGenerator';

// ==================== DEFAULTS ====================

const DEFAULT_CONFIG: MLConfig = {
  keywords: ['iphone', 'samsung', 'notebook', 'tv 4k', 'air fryer', 'playstation', 'xbox', 'nike', 'adidas'],
  categories: ['MLB1055', 'MLB1648', 'MLB1002', 'MLB1574', 'MLB1144', 'MLB3530'],
  minDiscount: 20,
  minPrice: 50,
  maxPrice: undefined,
  conditionFilter: ['new'],
  maxItemsPerRun: 50,
  enableX: true,
  xDailyLimit: 30,
  xMinScore: 60,
  scheduleTimes: ['08:00', '11:00', '14:00', '18:00', '22:00'],
};

// ==================== BATCH ALLOCATION ====================

/**
 * Determina o batch (carga) mais apropriado para uma oferta
 * Escolhe o próximo horário disponível
 */
async function getNextBatch(prisma: PrismaClient, scheduleTimes: string[]): Promise<string | null> {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
  // Encontrar próximo horário
  let nextTime = scheduleTimes.find(t => t > currentTime);
  
  // Se não houver mais horários hoje, usar o primeiro de amanhã
  if (!nextTime) {
    nextTime = scheduleTimes[0];
  }
  
  // Buscar ou criar batch para hoje/amanhã
  const batchDate = nextTime > currentTime ? now : new Date(now.getTime() + 24 * 60 * 60 * 1000);
  batchDate.setHours(0, 0, 0, 0);
  
  let batch = await prisma.batch.findFirst({
    where: {
      date: batchDate,
      scheduledTime: nextTime,
    },
  });
  
  if (!batch) {
    batch = await prisma.batch.create({
      data: {
        date: batchDate,
        scheduledTime: nextTime,
        status: 'PENDING',
      },
    });
  }
  
  return batch.id;
}

/**
 * Conta quantos drafts com X já foram criados hoje
 */
async function countTodayXDrafts(prisma: PrismaClient): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const count = await prisma.postDraft.count({
    where: {
      createdAt: { gte: today },
      channels: { has: 'TWITTER' },
    },
  });
  
  return count;
}

// ==================== MAIN PROVIDER ====================

export class MercadoLivreProvider {
  private prisma: PrismaClient;
  private client: MercadoLivreClient;
  private config: MLConfig;

  constructor(prisma: PrismaClient, config?: Partial<MLConfig>) {
    this.prisma = prisma;
    this.client = mlClient;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Carrega configuração do banco de dados
   */
  async loadConfig(): Promise<MLConfig> {
    const dbConfig = await this.prisma.providerConfig.findUnique({
      where: { source: 'MERCADO_LIVRE' },
    });

    if (dbConfig) {
      this.config = {
        keywords: dbConfig.keywords || DEFAULT_CONFIG.keywords,
        categories: dbConfig.categories || DEFAULT_CONFIG.categories,
        minDiscount: dbConfig.minDiscount || DEFAULT_CONFIG.minDiscount,
        minPrice: Number(dbConfig.minPrice) || DEFAULT_CONFIG.minPrice,
        maxPrice: dbConfig.maxPrice ? Number(dbConfig.maxPrice) : undefined,
        conditionFilter: dbConfig.conditionFilter || DEFAULT_CONFIG.conditionFilter,
        maxItemsPerRun: dbConfig.maxItemsPerRun || DEFAULT_CONFIG.maxItemsPerRun,
        enableX: dbConfig.enableX ?? DEFAULT_CONFIG.enableX,
        xDailyLimit: dbConfig.xDailyLimit || DEFAULT_CONFIG.xDailyLimit,
        xMinScore: dbConfig.xMinScore || DEFAULT_CONFIG.xMinScore,
        scheduleTimes: dbConfig.scheduleTimes || DEFAULT_CONFIG.scheduleTimes,
      };
    }

    return this.config;
  }

  /**
   * Executa coleta de ofertas do Mercado Livre
   */
  async run(options: {
    mode: RunMode;
    keywords?: string[];
    categories?: string[];
    maxItems?: number;
  }): Promise<RunResult> {
    await this.loadConfig();
    
    const result: RunResult = {
      collected: 0,
      insertedOffers: 0,
      createdDrafts: 0,
      skipped: 0,
      errors: [],
    };

    const { mode, keywords, categories, maxItems } = options;
    const limit = maxItems || this.config.maxItemsPerRun;
    
    let products: MLProduct[] = [];

    try {
      // Coletar produtos
      if (mode === 'keywords' || mode === 'both') {
        const kws = keywords || this.config.keywords;
        for (const kw of kws) {
          const response = await this.client.searchByKeyword(kw, { limit: Math.ceil(limit / kws.length) });
          products.push(...response.results);
        }
      }

      if (mode === 'categories' || mode === 'both') {
        const cats = categories || this.config.categories;
        for (const cat of cats) {
          const response = await this.client.searchByCategory(cat, { limit: Math.ceil(limit / cats.length) });
          products.push(...response.results);
        }
      }

      // Se não houver produtos, usar mock completo (desenvolvimento)
      if (products.length === 0) {
        const mockResponse = await this.client.getAllMock(limit);
        products = mockResponse.results;
      }

      result.collected = products.length;

      // Processar cada produto
      for (const product of products) {
        try {
          await this.processProduct(product, result);
        } catch (error: any) {
          result.errors.push(`Erro no produto ${product.id}: ${error.message}`);
        }
      }

      // Atualizar lastRunAt
      await this.prisma.providerConfig.upsert({
        where: { source: 'MERCADO_LIVRE' },
        update: { lastRunAt: new Date() },
        create: {
          source: 'MERCADO_LIVRE',
          enabled: true,
          keywords: this.config.keywords,
          categories: this.config.categories,
          minDiscount: this.config.minDiscount,
          minPrice: this.config.minPrice,
          maxItemsPerRun: this.config.maxItemsPerRun,
          enableX: this.config.enableX,
          xDailyLimit: this.config.xDailyLimit,
          xMinScore: this.config.xMinScore,
          scheduleTimes: this.config.scheduleTimes,
          lastRunAt: new Date(),
        },
      });

    } catch (error: any) {
      result.errors.push(`Erro geral: ${error.message}`);
    }

    return result;
  }

  /**
   * Processa um produto individual
   */
  private async processProduct(product: MLProduct, result: RunResult): Promise<void> {
    // Validar
    const validation = validateProduct(product, this.config);
    if (!validation.valid) {
      result.skipped++;
      return;
    }

    // Normalizar
    const normalized = normalizeProduct(product);

    // Verificar duplicata
    const duplicate = await isDuplicate(
      this.prisma,
      'MERCADO_LIVRE',
      normalized.externalId,
      normalized.dedupeHash
    );
    if (duplicate) {
      result.skipped++;
      return;
    }

    // Buscar ou criar store (seller)
    let store = await this.prisma.store.findFirst({
      where: { slug: normalized.sellerName.toLowerCase().replace(/[^a-z0-9]/g, '-') },
    });
    if (!store) {
      store = await this.prisma.store.create({
        data: {
          name: normalized.sellerName,
          slug: normalized.sellerName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        },
      });
    }

    // Buscar ou criar niche
    let niche = await this.prisma.niche.findFirst({
      where: { slug: normalized.nicheSlug },
    });
    if (!niche) {
      niche = await this.prisma.niche.findFirst({
        where: { slug: 'outros' },
      });
      if (!niche) {
        niche = await this.prisma.niche.create({
          data: {
            name: 'Outros',
            slug: 'outros',
            icon: '📦',
          },
        });
      }
    }

    // Criar Offer
    const offer = await this.prisma.offer.create({
      data: {
        title: normalized.title,
        description: normalized.description,
        originalPrice: normalized.originalPrice,
        finalPrice: normalized.finalPrice,
        discountPct: normalized.discountPct,
        affiliateUrl: normalized.affiliateUrl,
        imageUrl: normalized.imageUrl,
        nicheId: niche.id,
        storeId: store.id,
        source: 'MERCADO_LIVRE',
        externalId: normalized.externalId,
        productUrl: normalized.productUrl,
        sellerId: normalized.sellerId,
        sellerName: normalized.sellerName,
        sellerReputation: normalized.sellerReputation,
        availableQuantity: normalized.availableQuantity,
        condition: normalized.condition,
        categoryId: normalized.categoryId,
        dedupeHash: normalized.dedupeHash,
        urgency: normalized.availableQuantity <= 10 ? 'ULTIMAS_UNIDADES' : 'NORMAL',
      },
    });
    result.insertedOffers++;

    // Criar PostDraft
    await this.createDraft(offer, normalized, validation.score, result);
  }

  /**
   * Cria um PostDraft para a oferta
   */
  private async createDraft(
    offer: any,
    normalized: NormalizedOffer,
    score: number,
    result: RunResult
  ): Promise<void> {
    // Determinar batch
    const batchId = await getNextBatch(this.prisma, this.config.scheduleTimes);
    if (!batchId) {
      result.errors.push(`Não foi possível determinar batch para oferta ${offer.id}`);
      return;
    }

    // Gerar link (temporário, será substituído pelo goCode)
    const link = normalized.affiliateUrl;

    // Gerar copy humana
    const copies = generateHumanCopy(normalized, link);

    // Determinar canais
    const channels: Channel[] = ['TELEGRAM', 'SITE'];
    
    // Verificar se pode adicionar X
    let requiresHumanForX = false;
    if (this.config.enableX && score >= this.config.xMinScore && normalized.imageUrl) {
      const todayXCount = await countTodayXDrafts(this.prisma);
      if (todayXCount < this.config.xDailyLimit) {
        channels.push('TWITTER');
        requiresHumanForX = true;
      }
    }

    // Determinar prioridade pelo score
    const priority = score >= 60 ? 'HIGH' : score >= 40 ? 'NORMAL' : 'LOW';

    // Criar draft
    await this.prisma.postDraft.create({
      data: {
        offerId: offer.id,
        batchId,
        copyText: copies.telegram,
        copyTextTelegram: copies.telegram,
        copyTextSite: copies.site,
        copyTextX: copies.x,
        channels,
        priority,
        score,
        imageUrl: normalized.imageUrl,
        requiresImage: channels.includes('TWITTER'),
        requiresHumanForX,
        status: 'PENDING',
      },
    });

    // Atualizar contador do batch
    await this.prisma.batch.update({
      where: { id: batchId },
      data: { pendingCount: { increment: 1 } },
    });

    result.createdDrafts++;
  }
}

// Export singleton factory
export function createMercadoLivreProvider(prisma: PrismaClient, config?: Partial<MLConfig>): MercadoLivreProvider {
  return new MercadoLivreProvider(prisma, config);
}
