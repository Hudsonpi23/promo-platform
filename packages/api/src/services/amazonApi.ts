/**
 * Amazon Creators API Service
 *
 * Integra com a Amazon Creators API (substitui PA-API 5.0) para:
 * - Buscar produtos por keyword
 * - Obter dados de produto por ASIN
 * - Obter imagens, preços, ofertas e links de afiliado
 *
 * Autenticação: Login with Amazon (LwA) OAuth 2.0 — credenciais v3.x
 */

import {
  ApiClient,
  GetItemsRequestContent,
  GetItemsResource,
  SearchItemsRequestContent,
  SearchItemsResource,
  SortBy,
  TypedDefaultApi,
} from 'amazon-creators-api';

// ==================== CONFIG ====================

const CREDENTIAL_ID = process.env.AMAZON_CREDENTIAL_ID || '';
const CREDENTIAL_SECRET = process.env.AMAZON_CREDENTIAL_SECRET || '';
const CREDENTIAL_VERSION = process.env.AMAZON_CREDENTIAL_VERSION || '3.1';
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || 'manudaspromoc-20';
const MARKETPLACE = process.env.AMAZON_MARKETPLACE || 'www.amazon.com.br';

// ==================== TYPES ====================

export interface AmazonProduct {
  asin: string;
  title: string;
  url: string;
  affiliateUrl: string;
  finalPrice: number;
  originalPrice: number | null;
  discountPct: number;
  currency: string;
  availability: string;
  condition: string;
  merchantName: string;
  images: {
    primary: string | null;
    variants: string[];
  };
  features: string[];
  rating: number | null;
  totalReviews: number | null;
  category: string | null;
}

export interface AmazonSearchResult {
  products: AmazonProduct[];
  totalResults: number;
  searchUrl: string;
}

// ==================== HELPERS ====================

export function isAmazonApiConfigured(): boolean {
  return !!(CREDENTIAL_ID && CREDENTIAL_SECRET);
}

function createApiClient(): TypedDefaultApi {
  const apiClient = new ApiClient();
  apiClient.credentialId = CREDENTIAL_ID;
  apiClient.credentialSecret = CREDENTIAL_SECRET;
  apiClient.version = CREDENTIAL_VERSION;
  return new TypedDefaultApi(apiClient);
}

function extractPrice(listing: any): { finalPrice: number; originalPrice: number | null; currency: string } {
  let finalPrice = 0;
  let originalPrice: number | null = null;
  let currency = 'BRL';

  try {
    const price = listing?.price;
    if (price) {
      if (price.amount != null) {
        finalPrice = parseFloat(price.amount);
      } else if (price.displayAmount) {
        const cleaned = price.displayAmount
          .replace(/R\$\s*/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
          .replace(/[^\d.]/g, '');
        finalPrice = parseFloat(cleaned) || 0;
      }
      if (price.currency) currency = price.currency;
    }

    const savingBasis = listing?.price?.savingBasis;
    if (savingBasis) {
      if (savingBasis.amount != null) {
        originalPrice = parseFloat(savingBasis.amount);
      } else if (savingBasis.displayAmount) {
        const cleaned = savingBasis.displayAmount
          .replace(/R\$\s*/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
          .replace(/[^\d.]/g, '');
        originalPrice = parseFloat(cleaned) || 0;
      }
    }
  } catch {
    // fallback
  }

  return { finalPrice, originalPrice, currency };
}

function parseProduct(item: any): AmazonProduct | null {
  try {
    const asin = item.asin || '';
    const title = item.itemInfo?.title?.displayValue || '';
    const detailUrl = item.detailPageURL || `https://www.amazon.com.br/dp/${asin}?tag=${PARTNER_TAG}`;

    // Images
    let primaryImage: string | null = null;
    const variantImages: string[] = [];

    if (item.images?.primary?.large?.url) {
      primaryImage = item.images.primary.large.url;
    } else if (item.images?.primary?.medium?.url) {
      primaryImage = item.images.primary.medium.url;
    }

    if (item.images?.variants) {
      for (const v of item.images.variants) {
        const url = v.large?.url || v.medium?.url;
        if (url) variantImages.push(url);
      }
    }

    // Price from OffersV2
    let finalPrice = 0;
    let originalPrice: number | null = null;
    let currency = 'BRL';
    let availability = '';
    let condition = 'New';
    let merchantName = '';

    const listings = item.offersV2?.listings;
    if (listings && listings.length > 0) {
      const listing = listings[0];
      const priceData = extractPrice(listing);
      finalPrice = priceData.finalPrice;
      originalPrice = priceData.originalPrice;
      currency = priceData.currency;

      availability = listing.availability?.message || '';
      condition = listing.condition?.value || 'New';
      merchantName = listing.merchantInfo?.name || '';
    }

    const discountPct = (originalPrice && originalPrice > finalPrice && finalPrice > 0)
      ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
      : 0;

    // Features
    const features: string[] = [];
    if (item.itemInfo?.features?.displayValues) {
      features.push(...item.itemInfo.features.displayValues);
    }

    // Rating
    const rating = item.customerReviews?.starRating?.value ?? null;
    const totalReviews = item.customerReviews?.count ?? null;

    // Category
    const category = item.browseNodeInfo?.browseNodes?.[0]?.displayName || null;

    if (!title && !asin) return null;

    return {
      asin,
      title,
      url: `https://www.amazon.com.br/dp/${asin}`,
      affiliateUrl: detailUrl,
      finalPrice,
      originalPrice,
      discountPct,
      currency,
      availability,
      condition,
      merchantName,
      images: { primary: primaryImage, variants: variantImages },
      features,
      rating,
      totalReviews,
      category,
    };
  } catch (err: any) {
    console.error('[Amazon API] Erro ao parsear produto:', err.message);
    return null;
  }
}

// ==================== RESOURCES ====================

const ITEM_RESOURCES = [
  'images.primary.large',
  'images.primary.medium',
  'images.variants.large',
  'images.variants.medium',
  'itemInfo.title',
  'itemInfo.features',
  'itemInfo.productInfo',
  'itemInfo.byLineInfo',
  'offersV2.listings.price',
  'offersV2.listings.availability',
  'offersV2.listings.condition',
  'offersV2.listings.merchantInfo',
  'customerReviews.starRating',
  'customerReviews.count',
  'browseNodeInfo.browseNodes.displayName',
];

const SEARCH_RESOURCES = [
  'images.primary.large',
  'images.primary.medium',
  'images.variants.large',
  'itemInfo.title',
  'itemInfo.features',
  'offersV2.listings.price',
  'offersV2.listings.availability',
  'offersV2.listings.condition',
  'offersV2.listings.merchantInfo',
  'customerReviews.starRating',
  'customerReviews.count',
  'browseNodeInfo.browseNodes.displayName',
];

// ==================== PUBLIC API ====================

/**
 * Busca produtos na Amazon por ASIN(s)
 */
export async function getAmazonItems(asins: string[]): Promise<AmazonProduct[]> {
  if (!isAmazonApiConfigured()) {
    throw new Error('Amazon API não configurada');
  }

  if (asins.length === 0 || asins.length > 10) {
    throw new Error('Informe entre 1 e 10 ASINs');
  }

  console.log(`[Amazon API] GetItems: ${asins.join(', ')}`);

  const api = createApiClient();
  const request = new GetItemsRequestContent(PARTNER_TAG, asins);
  request.resources = ITEM_RESOURCES.map(r => GetItemsResource.constructFromObject(r));

  try {
    const response = await api.getItems(MARKETPLACE, request);
    const items = (response as any)?.itemsResult?.items || [];
    const products = items.map(parseProduct).filter(Boolean) as AmazonProduct[];

    console.log(`[Amazon API] GetItems retornou ${products.length} produto(s)`);
    return products;
  } catch (err: any) {
    console.error('[Amazon API] Erro GetItems:', err.message || JSON.stringify(err));
    throw new Error(`Amazon API GetItems falhou: ${err.message || 'erro desconhecido'}`);
  }
}

/**
 * Busca produtos na Amazon por keyword
 */
export async function searchAmazonProducts(
  keywords: string,
  options?: {
    sortBy?: 'Price:LowToHigh' | 'Price:HighToLow' | 'AvgCustomerReviews' | 'Featured' | 'NewestArrivals';
    minPrice?: number;
    maxPrice?: number;
    category?: string;
    itemCount?: number;
    itemPage?: number;
  }
): Promise<AmazonSearchResult> {
  if (!isAmazonApiConfigured()) {
    throw new Error('Amazon API não configurada');
  }

  console.log(`[Amazon API] SearchItems: "${keywords}"`);

  const api = createApiClient();
  const request = new SearchItemsRequestContent();
  request.partnerTag = PARTNER_TAG;
  request.keywords = keywords;
  request.resources = SEARCH_RESOURCES.map(r => SearchItemsResource.constructFromObject(r));

  if (options?.sortBy) request.sortBy = SortBy.constructFromObject(options.sortBy);
  if (options?.minPrice) request.minPrice = options.minPrice * 100;
  if (options?.maxPrice) request.maxPrice = options.maxPrice * 100;
  if (options?.itemCount) request.itemCount = Math.min(options.itemCount, 10);
  if (options?.itemPage) request.itemPage = options.itemPage;

  try {
    const response = await api.searchItems(MARKETPLACE, request);
    const result = (response as any)?.searchResult;
    const items = result?.items || [];
    const products = items.map(parseProduct).filter(Boolean) as AmazonProduct[];
    const totalResults = result?.totalResultCount || products.length;
    const searchUrl = result?.searchURL || `https://www.amazon.com.br/s?k=${encodeURIComponent(keywords)}&tag=${PARTNER_TAG}`;

    console.log(`[Amazon API] SearchItems retornou ${products.length} de ${totalResults} produto(s)`);
    return { products, totalResults, searchUrl };
  } catch (err: any) {
    console.error('[Amazon API] Erro SearchItems:', err.message || JSON.stringify(err));
    throw new Error(`Amazon API SearchItems falhou: ${err.message || 'erro desconhecido'}`);
  }
}

/**
 * Extrai o ASIN de uma URL da Amazon
 */
export function extractAsinFromUrl(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/exec\/obidos\/asin\/([A-Z0-9]{10})/i,
    /\/o\/ASIN\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Busca um produto da Amazon a partir da URL (extrai ASIN e consulta a API)
 */
export async function getAmazonProductByUrl(url: string): Promise<AmazonProduct | null> {
  const asin = extractAsinFromUrl(url);
  if (!asin) {
    console.error('[Amazon API] ASIN não encontrado na URL:', url);
    return null;
  }

  const products = await getAmazonItems([asin]);
  return products[0] || null;
}
