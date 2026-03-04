/**
 * Offer Processor Service
 * 
 * Serviço principal de processamento de ofertas.
 * Integra: coleta → validação → scoring → copy → draft → auto-aprovação
 * 
 * Este é o ponto central do pipeline de ofertas.
 */

import { PrismaClient, OfferSource, Channel, DraftStatus, OfferStatus } from '@prisma/client';
import { 
  processOffer, 
  ProcessedOffer, 
  shouldAutoApprove,
  getBatchStats,
} from './offerScoring';
import { generateCopies, CopyInputData } from './aiCopyGenerator';
import crypto from 'crypto';

// ==================== TYPES ====================

export interface RawOfferData {
  // Identificação
  externalId: string;
  source: OfferSource;
  
  // Dados básicos
  title: string;
  description?: string;
  price: number;
  oldPrice?: number;
  
  // URLs
  productUrl?: string;
  trackingUrl: string;
  imageUrl?: string;
  
  // Vendedor/Loja
  sellerId?: string;
  sellerName?: string;
  advertiserName?: string;
  
  // Categoria
  categoryId?: string;
  categoryName?: string;
  
  // Extra
  condition?: string;
  availableQuantity?: number;
  currency?: string;
  country?: string;
  rawPayload?: any;
}

export interface ProcessingResult {
  // Contadores
  total: number;
  processed: number;
  validated: number;
  offersCreated: number;
  draftsCreated: number;
  autoApproved: number;
  rejected: number;
  duplicates: number;
  errors: string[];
  
  // Stats
  avgScore: number;
  highConversion: number;
  mediumConversion: number;
  lowConversion: number;
  
  // IDs criados
  offerIds: string[];
  draftIds: string[];
}

export interface ProcessingOptions {
  minScore?: number;           // Score mínimo (default: 50)
  autoApprove?: boolean;       // Habilitar auto-aprovação (default: true)
  generateCopies?: boolean;    // Gerar copies (default: true)
  skipDuplicates?: boolean;    // Pular duplicatas (default: true)
  batchScheduleTimes?: string[]; // Horários de batch
  enableX?: boolean;           // Habilitar Twitter/X
  xDailyLimit?: number;        // Limite diário de posts X
  xMinScore?: number;          // Score mínimo para X
}

const DEFAULT_OPTIONS: ProcessingOptions = {
  minScore: 50,
  autoApprove: true,
  generateCopies: true,
  skipDuplicates: true,
  batchScheduleTimes: ['08:00', '11:00', '14:00', '18:00', '22:00'],
  enableX: true,
  xDailyLimit: 30,
  xMinScore: 60,
};

// ==================== HELPERS ====================

/**
 * Gera hash para deduplicação
 */
function generateDedupeHash(title: string, price: number, seller: string): string {
  const normalized = `${title.toLowerCase().trim()}|${price}|${seller.toLowerCase()}`;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * Determina o próximo batch disponível
 */
async function getNextBatch(
  prisma: PrismaClient,
  scheduleTimes: string[]
): Promise<string | null> {
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
  
  return prisma.postDraft.count({
    where: {
      createdAt: { gte: today },
      channels: { has: 'TWITTER' },
    },
  });
}

/**
 * Verifica se oferta é duplicada
 */
async function isDuplicate(
  prisma: PrismaClient,
  source: OfferSource,
  externalId: string,
  dedupeHash: string
): Promise<boolean> {
  // Verificar por externalId
  const byExternalId = await prisma.offer.findFirst({
    where: { source, externalId },
  });
  
  if (byExternalId) return true;
  
  // Verificar por dedupeHash nas últimas 24h
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  const byHash = await prisma.offer.findFirst({
    where: {
      dedupeHash,
      createdAt: { gte: oneDayAgo },
    },
  });
  
  return !!byHash;
}

/**
 * Busca ou cria Store
 */
async function getOrCreateStore(
  prisma: PrismaClient,
  name: string
): Promise<string> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  
  let store = await prisma.store.findFirst({
    where: { slug },
  });
  
  if (!store) {
    store = await prisma.store.create({
      data: { name, slug },
    });
  }
  
  return store.id;
}

/**
 * Busca ou cria Niche baseado na categoria
 */
async function getOrCreateNiche(
  prisma: PrismaClient,
  categoryName?: string
): Promise<string> {
  // Mapping de categoria para nicho
  const categoryToNiche: Record<string, string> = {
    // Eletrônicos
    'eletronicos': 'eletronicos', 'eletrônicos': 'eletronicos',
    'celulares': 'eletronicos', 'smartphones': 'eletronicos',
    'computadores': 'eletronicos', 'informatica': 'eletronicos',
    'informática': 'eletronicos', 'tvs': 'eletronicos',
    'televisores': 'eletronicos', 'audio': 'eletronicos',
    'áudio': 'eletronicos', 'cameras': 'eletronicos',
    'câmeras': 'eletronicos', 'wearables': 'eletronicos',
    // Casa
    'casa': 'casa', 'cozinha': 'casa', 'moveis': 'casa',
    'móveis': 'casa', 'decoracao': 'casa', 'decoração': 'casa',
    'limpeza': 'casa', 'eletrodomesticos': 'casa', 'eletrodomésticos': 'casa',
    'utilidades domesticas': 'casa', 'utilidades domésticas': 'casa',
    // Moda
    'moda': 'moda', 'roupas': 'moda', 'vestuário': 'moda',
    'vestuario': 'moda', 'calcados': 'moda', 'calçados': 'moda',
    'tenis': 'moda', 'tênis': 'moda', 'sapatos': 'moda',
    'bolsas': 'moda', 'acessorios moda': 'moda',
    // Games
    'games': 'games', 'jogos': 'games', 'videogames': 'games',
    'consoles': 'games', 'gamer': 'games',
    // Beleza
    'beleza': 'beleza', 'cosmeticos': 'beleza', 'cosméticos': 'beleza',
    'perfumaria': 'beleza', 'cabelo': 'beleza', 'maquiagem': 'beleza',
    'cuidados pessoais': 'beleza', 'higiene': 'beleza',
    // Esportes
    'esportes': 'esportes', 'fitness': 'esportes', 'academia': 'esportes',
    'suplementos': 'esportes', 'ciclismo': 'esportes', 'natacao': 'esportes',
    // Livros
    'livros': 'livros', 'books': 'livros', 'literatura': 'livros',
    'educacao': 'livros', 'educação': 'livros',
    // Papelaria
    'papelaria': 'papelaria', 'escritorio': 'papelaria', 'escritório': 'papelaria',
    'escolar': 'papelaria', 'material escolar': 'papelaria',
    'material de escritorio': 'papelaria',
    // Brinquedos
    'brinquedos': 'brinquedos', 'toys': 'brinquedos', 'infantil': 'brinquedos',
    'brincar': 'brinquedos',
    // Pets
    'pets': 'pets', 'animais': 'pets', 'pet shop': 'pets',
    'cachorro': 'pets', 'gato': 'pets',
    // Saúde
    'saude': 'saude', 'saúde': 'saude', 'farmacia': 'saude',
    'farmácia': 'saude', 'suplementos vitamínicos': 'saude',
    'medicamentos': 'saude', 'bem-estar': 'saude',
    // Bebê
    'bebe': 'bebe', 'bebê': 'bebe', 'crianca': 'bebe',
    'criança': 'bebe', 'maternidade': 'bebe',
    // Automotivo
    'automotivo': 'automotivo', 'autopeças': 'automotivo',
    'autopecas': 'automotivo', 'carros': 'automotivo',
    'motos': 'automotivo', 'pneus': 'automotivo',
    // Ferramentas
    'ferramentas': 'ferramentas', 'construcao': 'ferramentas',
    'construção': 'ferramentas', 'jardim': 'ferramentas',
    'jardinagem': 'ferramentas', 'reforma': 'ferramentas',
    // Acessórios
    'acessorios': 'acessorios', 'acessórios': 'acessorios',
    'presentes': 'acessorios', 'gifts': 'acessorios',
    'chaveiros': 'acessorios', 'bijuterias': 'acessorios',
    // Viagem
    'viagem': 'viagem', 'travel': 'viagem', 'turismo': 'viagem',
    'camping': 'viagem', 'malas': 'viagem',
    // Mercado
    'mercado': 'mercado', 'alimentos': 'mercado', 'bebidas': 'mercado',
    'supermercado': 'mercado', 'hortifruti': 'mercado',
  };
  
  const key = (categoryName || '').toLowerCase();
  let nicheSlug = 'outros';
  
  for (const [cat, niche] of Object.entries(categoryToNiche)) {
    if (key.includes(cat)) {
      nicheSlug = niche;
      break;
    }
  }
  
  let niche = await prisma.niche.findFirst({
    where: { slug: nicheSlug },
  });
  
  if (!niche) {
    niche = await prisma.niche.create({
      data: {
        name: nicheSlug.charAt(0).toUpperCase() + nicheSlug.slice(1),
        slug: nicheSlug,
        icon: '📦',
      },
    });
  }
  
  return niche.id;
}

// ==================== MAIN PROCESSOR ====================

/**
 * Processa um lote de ofertas brutas
 * 
 * Pipeline:
 * 1. Validação anti-lixo
 * 2. Cálculo de desconto
 * 3. Cálculo de score
 * 4. Filtro por score mínimo (< 50 = descartar)
 * 5. Verificação de duplicatas
 * 6. Criação de Offer
 * 7. Geração de copy
 * 8. Criação de Draft
 * 9. Auto-aprovação (se elegível)
 */
export async function processOfferBatch(
  prisma: PrismaClient,
  rawOffers: RawOfferData[],
  options?: ProcessingOptions
): Promise<ProcessingResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const result: ProcessingResult = {
    total: rawOffers.length,
    processed: 0,
    validated: 0,
    offersCreated: 0,
    draftsCreated: 0,
    autoApproved: 0,
    rejected: 0,
    duplicates: 0,
    errors: [],
    avgScore: 0,
    highConversion: 0,
    mediumConversion: 0,
    lowConversion: 0,
    offerIds: [],
    draftIds: [],
  };
  
  console.log(`[Offer Processor] Iniciando processamento de ${rawOffers.length} ofertas...`);
  
  // Pré-carregar contagem de X para o dia
  let todayXCount = 0;
  if (opts.enableX) {
    todayXCount = await countTodayXDrafts(prisma);
  }
  
  const validScores: number[] = [];
  
  for (const raw of rawOffers) {
    try {
      result.processed++;
      
      // 1. Converter para formato de scoring
      const offerInput = {
        title: raw.title,
        price: raw.price,
        oldPrice: raw.oldPrice,
        discountPct: null, // Será calculado
        advertiserName: raw.advertiserName || raw.sellerName,
        storeName: raw.sellerName || raw.advertiserName,
        category: raw.categoryName,
        imageUrl: raw.imageUrl,
        trackingUrl: raw.trackingUrl,
        productUrl: raw.productUrl,
        source: raw.source,
        rawPayload: raw.rawPayload,
      };
      
      // 2. Processar (validação + scoring)
      const processed = processOffer(offerInput);
      
      // 3. Verificar validação
      if (!processed.isValid) {
        result.rejected++;
        console.log(`[Offer Processor] Rejeitada: ${raw.title.substring(0, 40)}... - ${processed.errorReason}`);
        continue;
      }
      
      // 4. Verificar score mínimo
      if (processed.score < (opts.minScore || 50)) {
        result.rejected++;
        console.log(`[Offer Processor] Score baixo (${processed.score}): ${raw.title.substring(0, 40)}...`);
        continue;
      }
      
      result.validated++;
      validScores.push(processed.score);
      
      // Classificar
      if (processed.classification === 'HIGH') result.highConversion++;
      else if (processed.classification === 'MEDIUM') result.mediumConversion++;
      else result.lowConversion++;
      
      // 5. Verificar duplicata
      if (opts.skipDuplicates) {
        const dedupeHash = generateDedupeHash(
          raw.title,
          raw.price,
          raw.sellerName || raw.advertiserName || 'unknown'
        );
        
        const duplicate = await isDuplicate(
          prisma,
          raw.source,
          raw.externalId,
          dedupeHash
        );
        
        if (duplicate) {
          result.duplicates++;
          console.log(`[Offer Processor] Duplicata: ${raw.title.substring(0, 40)}...`);
          continue;
        }
      }
      
      // 6. Buscar/criar Store e Niche
      const storeId = await getOrCreateStore(
        prisma,
        raw.sellerName || raw.advertiserName || 'Loja'
      );
      
      const nicheId = await getOrCreateNiche(prisma, raw.categoryName);
      
      // 7. Criar Offer
      const offer = await prisma.offer.create({
        data: {
          title: raw.title,
          description: raw.description,
          originalPrice: raw.oldPrice || raw.price,
          finalPrice: raw.price,
          discountPct: processed.calculatedDiscountPct,
          affiliateUrl: raw.trackingUrl,
          imageUrl: raw.imageUrl,
          nicheId,
          storeId,
          source: raw.source,
          externalId: raw.externalId,
          productUrl: raw.productUrl,
          sellerId: raw.sellerId,
          sellerName: raw.sellerName,
          availableQuantity: raw.availableQuantity,
          condition: raw.condition,
          categoryId: raw.categoryId,
          dedupeHash: generateDedupeHash(
            raw.title,
            raw.price,
            raw.sellerName || raw.advertiserName || 'unknown'
          ),
          // @ts-ignore - rawPayload existe após migration
          rawPayload: raw.rawPayload || undefined,
          currency: raw.currency || 'BRL',
          country: raw.country || 'BR',
          urgency: raw.availableQuantity && raw.availableQuantity <= 10 
            ? 'ULTIMAS_UNIDADES' 
            : 'NORMAL',
          status: 'ACTIVE',
        },
      });
      
      result.offersCreated++;
      result.offerIds.push(offer.id);
      
      // 8. Gerar copy
      let copies = {
        telegram: '',
        site: '',
        x: '',
      };
      
      if (opts.generateCopies) {
        const copyInput: CopyInputData = {
          title: raw.title,
          price: raw.price,
          oldPrice: raw.oldPrice,
          discountPct: processed.calculatedDiscountPct,
          advertiserName: raw.advertiserName,
          storeName: raw.sellerName,
          category: raw.categoryName,
          trackingUrl: raw.trackingUrl,
        };
        
        copies = generateCopies(copyInput);
      }
      
      // 9. Determinar batch
      const batchId = await getNextBatch(prisma, opts.batchScheduleTimes || DEFAULT_OPTIONS.batchScheduleTimes!);
      
      if (!batchId) {
        result.errors.push(`Não foi possível determinar batch para oferta ${offer.id}`);
        continue;
      }
      
      // 10. Determinar canais
      const channels: Channel[] = ['TELEGRAM', 'SITE'];
      let requiresHumanForX = false;
      
      if (
        opts.enableX && 
        processed.score >= (opts.xMinScore || 60) && 
        raw.imageUrl &&
        todayXCount < (opts.xDailyLimit || 30)
      ) {
        channels.push('TWITTER');
        requiresHumanForX = true;
        todayXCount++;
      }
      
      // 11. Determinar status inicial
      let initialStatus: DraftStatus = 'PENDING';
      
      if (opts.autoApprove && shouldAutoApprove(processed)) {
        initialStatus = 'APPROVED';
        result.autoApproved++;
      }
      
      // 12. Criar Draft
      const draft = await prisma.postDraft.create({
        data: {
          offerId: offer.id,
          batchId,
          copyText: copies.telegram || `${raw.title}\n${raw.price}`,
          copyTextTelegram: copies.telegram,
          copyTextSite: copies.site,
          copyTextX: copies.x,
          channels,
          priority: processed.classification === 'HIGH' ? 'HIGH' : 
                   processed.classification === 'MEDIUM' ? 'NORMAL' : 'LOW',
          score: processed.score,
          imageUrl: raw.imageUrl,
          requiresImage: channels.includes('TWITTER'),
          requiresHumanForX,
          status: initialStatus,
          approvedAt: initialStatus === 'APPROVED' ? new Date() : null,
        },
      });
      
      result.draftsCreated++;
      result.draftIds.push(draft.id);
      
      // Atualizar contador do batch
      await prisma.batch.update({
        where: { id: batchId },
        data: { 
          pendingCount: initialStatus === 'PENDING' ? { increment: 1 } : undefined,
          approvedCount: initialStatus === 'APPROVED' ? { increment: 1 } : undefined,
        },
      });
      
      console.log(`[Offer Processor] ✓ Criada: ${raw.title.substring(0, 40)}... (Score: ${processed.score}, ${processed.classification})`);
      
    } catch (error: any) {
      result.errors.push(`Erro em ${raw.externalId}: ${error.message}`);
      console.error(`[Offer Processor] Erro: ${error.message}`);
    }
  }
  
  // Calcular média de score
  if (validScores.length > 0) {
    result.avgScore = Math.round(
      validScores.reduce((a, b) => a + b, 0) / validScores.length * 10
    ) / 10;
  }
  
  console.log(`[Offer Processor] Concluído:
    - Total: ${result.total}
    - Validadas: ${result.validated}
    - Ofertas criadas: ${result.offersCreated}
    - Drafts criados: ${result.draftsCreated}
    - Auto-aprovadas: ${result.autoApproved}
    - Rejeitadas: ${result.rejected}
    - Duplicatas: ${result.duplicates}
    - Score médio: ${result.avgScore}
    - Alta conversão: ${result.highConversion}
    - Média conversão: ${result.mediumConversion}
    - Baixa conversão: ${result.lowConversion}
  `);
  
  return result;
}

/**
 * Reprocessa ofertas existentes (atualiza scores)
 */
export async function reprocessExistingOffers(
  prisma: PrismaClient,
  options?: { 
    onlyActive?: boolean;
    limit?: number;
  }
): Promise<{
  total: number;
  updated: number;
  errors: string[];
}> {
  const result = {
    total: 0,
    updated: 0,
    errors: [] as string[],
  };
  
  const where = options?.onlyActive ? { status: 'ACTIVE' as OfferStatus } : {};
  
  const offers = await prisma.offer.findMany({
    where,
    take: options?.limit,
    include: {
      store: true,
      niche: true,
    },
  });
  
  result.total = offers.length;
  
  for (const offer of offers) {
    try {
      const processed = processOffer({
        title: offer.title,
        price: Number(offer.finalPrice),
        oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
        discountPct: offer.discountPct,
        storeName: offer.store.name,
        category: offer.niche.name,
        imageUrl: offer.imageUrl,
        trackingUrl: offer.affiliateUrl,
        productUrl: offer.productUrl,
        source: offer.source,
      });
      
      // Atualizar drafts pendentes com novo score
      await prisma.postDraft.updateMany({
        where: {
          offerId: offer.id,
          status: 'PENDING',
        },
        data: {
          score: processed.score,
        },
      });
      
      result.updated++;
      
    } catch (error: any) {
      result.errors.push(`Erro em ${offer.id}: ${error.message}`);
    }
  }
  
  return result;
}

// ==================== EXPORTS ====================

export default {
  processOfferBatch,
  reprocessExistingOffers,
};
