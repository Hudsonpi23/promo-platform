/**
 * Validador e Calculador de Score - Mercado Livre
 * 
 * Aplica regras de negócio para filtrar e pontuar ofertas.
 */

import { MLProduct, MLConfig, ValidationResult, NormalizedOffer } from './types';
import crypto from 'crypto';

// ==================== CATEGORY MAPPING ====================

const CATEGORY_TO_NICHE: Record<string, string> = {
  'MLB1055': 'eletronicos',  // Celulares
  'MLB1648': 'eletronicos',  // Computadores
  'MLB1002': 'eletronicos',  // TVs
  'MLB3530': 'moda',         // Tênis
  'MLB1574': 'casa',         // Eletrodomésticos
  'MLB1144': 'games',        // Games
  'MLB1246': 'beleza',       // Beleza
  'MLB1276': 'esportes',     // Esportes
  'MLB1196': 'mercado',      // Alimentos e Bebidas
};

// ==================== VALIDATION ====================

/**
 * Valida se um produto do ML passa nos filtros
 */
export function validateProduct(
  product: MLProduct,
  config: MLConfig
): ValidationResult {
  const { minDiscount, minPrice, maxPrice, conditionFilter } = config;
  
  // Calcular desconto
  const originalPrice = product.original_price || product.price;
  const discount = originalPrice > product.price 
    ? Math.round(((originalPrice - product.price) / originalPrice) * 100)
    : 0;
  
  // Regra 1: Desconto mínimo
  if (discount < minDiscount) {
    return {
      valid: false,
      reason: `Desconto insuficiente: ${discount}% < ${minDiscount}%`,
      score: 0
    };
  }
  
  // Regra 2: Preço mínimo
  if (product.price < minPrice) {
    return {
      valid: false,
      reason: `Preço abaixo do mínimo: R$ ${product.price} < R$ ${minPrice}`,
      score: 0
    };
  }
  
  // Regra 3: Preço máximo (se configurado)
  if (maxPrice && product.price > maxPrice) {
    return {
      valid: false,
      reason: `Preço acima do máximo: R$ ${product.price} > R$ ${maxPrice}`,
      score: 0
    };
  }
  
  // Regra 4: Condição (novo/usado)
  if (!conditionFilter.includes(product.condition)) {
    return {
      valid: false,
      reason: `Condição não permitida: ${product.condition}`,
      score: 0
    };
  }
  
  // Regra 5: Estoque
  if (product.available_quantity <= 0) {
    return {
      valid: false,
      reason: 'Produto sem estoque',
      score: 0
    };
  }
  
  // Calcular score
  const score = calculateScore(product, discount);
  
  return { valid: true, score };
}

/**
 * Calcula score de 0-100 baseado nas regras de negócio
 */
export function calculateScore(product: MLProduct, discount: number): number {
  let score = 0;
  
  // Desconto (+10 a +40)
  if (discount >= 40) {
    score += 40;
  } else if (discount >= 25) {
    score += 20;
  } else if (discount >= 20) {
    score += 10;
  }
  
  // Estoque baixo (+10)
  if (product.available_quantity > 0 && product.available_quantity <= 10) {
    score += 10;
  }
  
  // Reputação do vendedor (+10)
  const rep = product.seller?.reputation?.level_id;
  if (rep === '5_green' || product.seller?.reputation?.power_seller_status) {
    score += 10;
  }
  
  // Frete grátis (+5)
  if (product.shipping?.free_shipping) {
    score += 5;
  }
  
  // Vendas (+5 se > 100)
  if (product.sold_quantity && product.sold_quantity > 100) {
    score += 5;
  }
  
  // Penalidade: sem imagem (-15)
  if (!product.thumbnail && (!product.pictures || product.pictures.length === 0)) {
    score -= 15;
  }
  
  // Limitar entre 0 e 100
  return Math.max(0, Math.min(100, score));
}

// ==================== NORMALIZATION ====================

/**
 * Normaliza produto do ML para formato padrão Offer
 */
export function normalizeProduct(product: MLProduct): NormalizedOffer {
  const originalPrice = product.original_price || product.price;
  const discount = originalPrice > product.price 
    ? Math.round(((originalPrice - product.price) / originalPrice) * 100)
    : 0;
  
  // Melhor imagem disponível
  const imageUrl = product.pictures?.[0]?.url || product.thumbnail || undefined;
  
  // Determinar nicho pela categoria
  const nicheSlug = CATEGORY_TO_NICHE[product.category_id] || 'outros';
  
  // Gerar hash para deduplicação
  const dedupeHash = generateDedupeHash(product.title, product.price, product.seller.nickname);
  
  return {
    externalId: product.id,
    title: product.title,
    description: undefined, // ML não retorna descrição na busca
    originalPrice,
    finalPrice: product.price,
    discountPct: discount,
    productUrl: product.permalink,
    affiliateUrl: product.permalink, // TODO: Gerar link afiliado real
    imageUrl,
    sellerId: String(product.seller.id),
    sellerName: product.seller.nickname,
    sellerReputation: product.seller.reputation?.level_id,
    availableQuantity: product.available_quantity,
    condition: product.condition,
    categoryId: product.category_id,
    nicheSlug,
    dedupeHash
  };
}

/**
 * Gera hash para deduplicação (title + price + seller)
 */
export function generateDedupeHash(title: string, price: number, seller: string): string {
  const normalized = `${title.toLowerCase().trim()}|${price}|${seller.toLowerCase()}`;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * Verifica se oferta já existe (por externalId ou dedupeHash)
 */
export async function isDuplicate(
  prisma: any,
  source: string,
  externalId: string,
  dedupeHash: string
): Promise<boolean> {
  // Verificar por externalId
  const byExternalId = await prisma.offer.findFirst({
    where: {
      source,
      externalId
    }
  });
  
  if (byExternalId) return true;
  
  // Verificar por dedupeHash nas últimas 24h
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  const byHash = await prisma.offer.findFirst({
    where: {
      dedupeHash,
      createdAt: {
        gte: oneDayAgo
      }
    }
  });
  
  return !!byHash;
}
