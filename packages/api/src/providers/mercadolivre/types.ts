/**
 * Tipos do Provider Mercado Livre
 */

export interface MLProduct {
  id: string;
  title: string;
  price: number;
  original_price?: number;
  currency_id: string;
  available_quantity: number;
  sold_quantity?: number;
  condition: 'new' | 'used';
  permalink: string;
  thumbnail: string;
  pictures?: { url: string }[];
  category_id: string;
  seller: {
    id: number;
    nickname: string;
    reputation?: {
      level_id: string;
      power_seller_status?: string;
    };
  };
  shipping?: {
    free_shipping: boolean;
  };
  attributes?: Array<{
    id: string;
    name: string;
    value_name: string;
  }>;
}

export interface MLSearchResponse {
  results: MLProduct[];
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
}

export interface MLConfig {
  keywords: string[];
  categories: string[];
  minDiscount: number;
  minPrice: number;
  maxPrice?: number;
  conditionFilter: string[];
  maxItemsPerRun: number;
  enableX: boolean;
  xDailyLimit: number;
  xMinScore: number;
  scheduleTimes: string[];
  
  // 🔥 Configurações específicas para página de Ofertas do Dia
  useDealsPageOnly?: boolean;  // Se true, busca APENAS da página /ofertas
  dealsMaxPages?: number;      // Máximo de páginas a buscar (1 página = 57 produtos)
  dealsItemsPerPage?: number;  // Itens por página (padrão 57)
}

export interface NormalizedOffer {
  externalId: string;
  title: string;
  description?: string;
  originalPrice: number;
  finalPrice: number;
  discountPct: number;
  productUrl: string;
  affiliateUrl: string;
  imageUrl?: string;
  sellerId: string;
  sellerName: string;
  sellerReputation?: string;
  availableQuantity: number;
  condition: string;
  categoryId: string;
  categoryPath?: string;
  nicheSlug: string;
  dedupeHash: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  score: number;
}

export interface RunResult {
  collected: number;
  insertedOffers: number;
  createdDrafts: number;
  skipped: number;
  errors: string[];
}

// Modos de execução do provider
// - 'deals': 🔥 RECOMENDADO! Busca APENAS da página de Ofertas do Dia (evita bloqueios)
// - 'keywords': Busca por palavras-chave (pode causar bloqueios se excessivo)
// - 'categories': Busca por categorias
// - 'both': Busca por keywords E categories
export type RunMode = 'deals' | 'keywords' | 'categories' | 'both';
