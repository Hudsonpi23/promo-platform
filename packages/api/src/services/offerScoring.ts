/**
 * Offer Scoring Service
 * 
 * Sistema inteligente de seleção, classificação e priorização de ofertas.
 * Usa regras determinísticas + score de atratividade para maximizar conversão.
 * 
 * Score: 0-100
 * - >= 70: Alta conversão (auto-aprovar AWIN)
 * - 50-69: Média conversão
 * - < 50: Baixa conversão (descartar)
 */

import { OfferSource } from '@prisma/client';

// ==================== TYPES ====================

export interface OfferInput {
  title: string;
  price: number;
  oldPrice?: number | null;
  discountPct?: number | null;
  advertiserName?: string | null;
  storeName?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  trackingUrl?: string | null;
  productUrl?: string | null;
  source: OfferSource;
  rawPayload?: any;
}

export interface ValidationResult {
  valid: boolean;
  errorReason?: string;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  classification: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ScoreBreakdown {
  discountPoints: number;
  pricePoints: number;
  categoryPoints: number;
  brandPoints: number;
  visualPoints: number;
  total: number;
}

export interface ProcessedOffer extends OfferInput {
  calculatedDiscountPct: number;
  score: number;
  classification: 'HIGH' | 'MEDIUM' | 'LOW';
  scoreBreakdown: ScoreBreakdown;
  isValid: boolean;
  errorReason?: string;
}

// ==================== CONSTANTS ====================

/**
 * Categorias com alta taxa de conversão
 */
const HIGH_CONVERSION_CATEGORIES = [
  'eletronicos', 'eletrônicos', 'electronics',
  'casa', 'home', 'casa e decoração',
  'cozinha', 'kitchen', 'eletrodomesticos', 'eletrodomésticos',
  'moda', 'fashion', 'roupas', 'vestuário',
  'acessorios', 'acessórios', 'accessories',
  'celulares', 'smartphones', 'phones',
  'computadores', 'notebooks', 'computers',
  'tvs', 'televisores', 'audio e video',
  'games', 'jogos', 'consoles',
  'beleza', 'beauty', 'cosmeticos',
];

/**
 * Palavras que indicam loja/marca oficial ou confiável
 */
const TRUSTED_STORE_KEYWORDS = [
  'oficial', 'official', 'store',
  'loja', 'shop',
  'mercado livre', 'mercadolivre',
  'amazon', 'magalu', 'magazine luiza',
  'casas bahia', 'ponto frio', 'extra',
  'americanas', 'submarino', 'shoptime',
  'kabum', 'pichau', 'terabyte',
  'samsung', 'apple', 'lg', 'sony', 'philips',
  'nike', 'adidas', 'puma', 'reebok',
  'mondial', 'britania', 'britânia', 'electrolux', 'brastemp',
];

// ==================== VALIDATION (ANTI-LIXO) ====================

/**
 * Valida se uma oferta passa nos filtros mínimos de qualidade
 * 
 * REJEITA se:
 * - price <= 0
 * - oldPrice < price (quando informado)
 * - discountPct < 20
 * - imageUrl ausente
 * - trackingUrl ausente
 * - price > 50.000
 * - título vazio
 */
export function validateOffer(offer: OfferInput): ValidationResult {
  // Regra 1: Preço inválido
  if (!offer.price || offer.price <= 0) {
    return { valid: false, errorReason: 'PRECO_INVALIDO: Preço deve ser maior que zero' };
  }

  // Regra 2: Preço original menor que preço final (inconsistência)
  if (offer.oldPrice && offer.oldPrice < offer.price) {
    return { valid: false, errorReason: 'PRECO_INCONSISTENTE: Preço original menor que preço final' };
  }

  // Regra 3: Preço fora da curva (muito alto)
  if (offer.price > 50000) {
    return { valid: false, errorReason: 'PRECO_ALTO: Preço acima de R$ 50.000' };
  }

  // Regra 4: Título vazio ou muito curto
  if (!offer.title || offer.title.trim().length < 5) {
    return { valid: false, errorReason: 'TITULO_INVALIDO: Título ausente ou muito curto' };
  }

  // Regra 5: Sem imagem
  if (!offer.imageUrl || offer.imageUrl.trim() === '') {
    return { valid: false, errorReason: 'SEM_IMAGEM: Imagem ausente' };
  }

  // Regra 6: Sem tracking URL (obrigatório para afiliados)
  if (!offer.trackingUrl && !offer.productUrl) {
    return { valid: false, errorReason: 'SEM_LINK: URL de tracking/produto ausente' };
  }

  // Regra 7: Desconto mínimo
  const discount = calculateDiscount(offer.price, offer.oldPrice);
  if (discount < 20) {
    return { valid: false, errorReason: `DESCONTO_BAIXO: Desconto de ${discount}% é menor que 20%` };
  }

  return { valid: true };
}

// ==================== DISCOUNT CALCULATION ====================

/**
 * Calcula desconto de forma confiável
 * 
 * Formula: ((oldPrice - price) / oldPrice) * 100
 * Arredonda para 2 casas decimais
 * 
 * NUNCA confia em desconto vindo cru da fonte!
 */
export function calculateDiscount(price: number, oldPrice?: number | null): number {
  if (!oldPrice || oldPrice <= 0 || oldPrice <= price) {
    return 0;
  }

  const discount = ((oldPrice - price) / oldPrice) * 100;
  return Math.round(discount * 100) / 100; // 2 casas decimais
}

// ==================== SCORE CALCULATION (0-100) ====================

/**
 * Calcula score de atratividade (0-100)
 * 
 * Distribuição de pontos:
 * 1. DESCONTO: máx 35 pontos
 * 2. PREÇO PSICOLÓGICO: máx 20 pontos
 * 3. CATEGORIA: máx 15 pontos
 * 4. MARCA/LOJA: máx 10 pontos
 * 5. VISUAL: máx 10 pontos
 * 
 * Extra: +10 se frete grátis (bonus)
 * 
 * Score final limitado entre 0 e 100
 */
export function calculateScore(offer: OfferInput): ScoreResult {
  const breakdown: ScoreBreakdown = {
    discountPoints: 0,
    pricePoints: 0,
    categoryPoints: 0,
    brandPoints: 0,
    visualPoints: 0,
    total: 0,
  };

  const discount = offer.discountPct || calculateDiscount(offer.price, offer.oldPrice);

  // 1) DESCONTO (máx 35 pontos)
  // >= 20% → +15
  // >= 30% → +10 (adicional)
  // >= 40% → +10 (adicional)
  // > 50% → não adiciona extra automaticamente
  if (discount >= 20) breakdown.discountPoints += 15;
  if (discount >= 30) breakdown.discountPoints += 10;
  if (discount >= 40) breakdown.discountPoints += 10;

  // 2) PREÇO PSICOLÓGICO (máx 20 pontos)
  // <= R$ 50 → +20
  // <= R$ 120 → +15
  // <= R$ 300 → +10
  if (offer.price <= 50) {
    breakdown.pricePoints = 20;
  } else if (offer.price <= 120) {
    breakdown.pricePoints = 15;
  } else if (offer.price <= 300) {
    breakdown.pricePoints = 10;
  }

  // 3) CATEGORIA (máx 15 pontos)
  const category = (offer.category || '').toLowerCase();
  const title = offer.title.toLowerCase();
  
  const isHighConversionCategory = HIGH_CONVERSION_CATEGORIES.some(cat => 
    category.includes(cat) || title.includes(cat)
  );
  
  if (isHighConversionCategory) {
    breakdown.categoryPoints = 15;
  }

  // 4) MARCA/LOJA (máx 10 pontos)
  const storeName = (offer.storeName || offer.advertiserName || '').toLowerCase();
  
  const isTrustedStore = TRUSTED_STORE_KEYWORDS.some(keyword => 
    storeName.includes(keyword) || title.includes(keyword)
  );
  
  if (isTrustedStore) {
    breakdown.brandPoints = 10;
  }

  // 5) VISUAL (máx 10 pontos)
  if (offer.imageUrl && isValidImageUrl(offer.imageUrl)) {
    breakdown.visualPoints = 10;
  }

  // Calcular total
  breakdown.total = 
    breakdown.discountPoints + 
    breakdown.pricePoints + 
    breakdown.categoryPoints + 
    breakdown.brandPoints + 
    breakdown.visualPoints;

  // Limitar entre 0 e 100
  const score = Math.max(0, Math.min(100, breakdown.total));

  // Classificação
  let classification: 'HIGH' | 'MEDIUM' | 'LOW';
  if (score >= 70) {
    classification = 'HIGH';
  } else if (score >= 50) {
    classification = 'MEDIUM';
  } else {
    classification = 'LOW';
  }

  return {
    score,
    breakdown,
    classification,
  };
}

/**
 * Verifica se URL de imagem é válida
 */
function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === '') return false;
  
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ==================== AUTO-APPROVAL ====================

/**
 * Determina se uma oferta deve ser auto-aprovada
 * 
 * Regras:
 * - source = AWIN E
 * - discountPct >= 25 E
 * - score >= 70
 * 
 * Retorna true se deve auto-aprovar
 */
export function shouldAutoApprove(
  offer: ProcessedOffer,
  options?: { requireHighScore?: boolean }
): boolean {
  const requireHighScore = options?.requireHighScore ?? true;

  // Regra 1: Fonte deve ser AWIN (não ML, que requer revisão)
  if (offer.source !== 'AWIN') {
    return false;
  }

  // Regra 2: Desconto mínimo de 25%
  if (offer.calculatedDiscountPct < 25) {
    return false;
  }

  // Regra 3: Score alto (>= 70) se requerido
  if (requireHighScore && offer.score < 70) {
    return false;
  }

  return true;
}

// ==================== MAIN PROCESSING ====================

/**
 * Processa uma oferta completa:
 * 1. Calcula desconto
 * 2. Valida
 * 3. Calcula score
 * 4. Retorna oferta processada
 */
export function processOffer(offer: OfferInput): ProcessedOffer {
  // 1. Calcular desconto
  const calculatedDiscountPct = calculateDiscount(offer.price, offer.oldPrice);

  // 2. Validar
  const validation = validateOffer({
    ...offer,
    discountPct: calculatedDiscountPct,
  });

  // Se inválido, retornar com erro
  if (!validation.valid) {
    return {
      ...offer,
      calculatedDiscountPct,
      score: 0,
      classification: 'LOW',
      scoreBreakdown: {
        discountPoints: 0,
        pricePoints: 0,
        categoryPoints: 0,
        brandPoints: 0,
        visualPoints: 0,
        total: 0,
      },
      isValid: false,
      errorReason: validation.errorReason,
    };
  }

  // 3. Calcular score
  const scoreResult = calculateScore({
    ...offer,
    discountPct: calculatedDiscountPct,
  });

  // 4. Retornar oferta processada
  return {
    ...offer,
    calculatedDiscountPct,
    score: scoreResult.score,
    classification: scoreResult.classification,
    scoreBreakdown: scoreResult.breakdown,
    isValid: true,
  };
}

/**
 * Processa lote de ofertas e filtra por score mínimo
 */
export function processBatch(
  offers: OfferInput[],
  options?: {
    minScore?: number;       // Score mínimo (default: 50)
    maxOffers?: number;      // Máximo de ofertas a retornar
    sortByScore?: boolean;   // Ordenar por score (default: true)
  }
): ProcessedOffer[] {
  const minScore = options?.minScore ?? 50;
  const maxOffers = options?.maxOffers;
  const sortByScore = options?.sortByScore ?? true;

  // Processar todas as ofertas
  const processed = offers.map(processOffer);

  // Filtrar válidas com score mínimo
  let filtered = processed.filter(o => o.isValid && o.score >= minScore);

  // Ordenar por score (maior primeiro)
  if (sortByScore) {
    filtered.sort((a, b) => b.score - a.score);
  }

  // Limitar quantidade
  if (maxOffers && filtered.length > maxOffers) {
    filtered = filtered.slice(0, maxOffers);
  }

  return filtered;
}

/**
 * Estatísticas de um lote processado
 */
export function getBatchStats(processed: ProcessedOffer[]): {
  total: number;
  valid: number;
  invalid: number;
  highConversion: number;
  mediumConversion: number;
  lowConversion: number;
  avgScore: number;
  errors: Record<string, number>;
} {
  const valid = processed.filter(p => p.isValid);
  const invalid = processed.filter(p => !p.isValid);

  const errorCounts: Record<string, number> = {};
  for (const offer of invalid) {
    const errorType = offer.errorReason?.split(':')[0] || 'UNKNOWN';
    errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
  }

  const avgScore = valid.length > 0
    ? valid.reduce((sum, o) => sum + o.score, 0) / valid.length
    : 0;

  return {
    total: processed.length,
    valid: valid.length,
    invalid: invalid.length,
    highConversion: valid.filter(o => o.classification === 'HIGH').length,
    mediumConversion: valid.filter(o => o.classification === 'MEDIUM').length,
    lowConversion: valid.filter(o => o.classification === 'LOW').length,
    avgScore: Math.round(avgScore * 10) / 10,
    errors: errorCounts,
  };
}

// ==================== EXPORTS ====================

export default {
  validateOffer,
  calculateDiscount,
  calculateScore,
  shouldAutoApprove,
  processOffer,
  processBatch,
  getBatchStats,
};
