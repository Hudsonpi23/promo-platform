/**
 * Mercado Livre Affiliate Service
 * 
 * Sistema automatizado para:
 * 1. Buscar ofertas na API do ML
 * 2. Filtrar por desconto mínimo
 * 3. Gerar links de afiliado
 * 4. Extrair imagens reais com Playwright
 * 5. Postar nas redes sociais
 */

import axios from 'axios';
import { chromium, Browser, Page } from 'playwright';
import { getMLToken } from '../routes/mlAuth.js';

// ==================== CONFIGURAÇÕES ====================

const ML_API_BASE = 'https://api.mercadolibre.com';
const ML_SITE_ID = 'MLB'; // Brasil

// Tag de afiliado do parceiro
export const AFFILIATE_TAG = 'dh20260120130733';
export const AFFILIATE_TOOL = '77551400';

// ==================== TIPOS ====================

export interface MLProduct {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  discount_percentage: number;
  thumbnail: string;
  permalink: string;
  affiliate_url: string;
  condition: string;
  sold_quantity: number;
  available_quantity: number;
  shipping_free: boolean;
  seller: {
    id: number;
    nickname: string;
  };
  category_id: string;
}

export interface SearchOptions {
  query?: string;
  category?: string;
  minDiscount?: number;
  maxPrice?: number;
  minPrice?: number;
  limit?: number;
  offset?: number;
  sort?: 'price_asc' | 'price_desc' | 'relevance';
}

export interface SearchResult {
  success: boolean;
  products: MLProduct[];
  total: number;
  error?: string;
}

// ==================== API DO MERCADO LIVRE ====================

/**
 * Headers padrão para chamadas à API do ML (com Bearer token quando disponível)
 */
function getMLHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  const mlToken = getMLToken();
  if (mlToken?.access_token) {
    headers['Authorization'] = `Bearer ${mlToken.access_token}`;
  }
  return headers;
}

/**
 * Busca produtos na API do Mercado Livre.
 * Tenta primeiro o endpoint /sites/MLB/search.
 * Se retornar 403 (API restrita), usa fallback via /highlights + /products.
 */
export async function searchProducts(options: SearchOptions = {}): Promise<SearchResult> {
  const result = await searchProductsDirect(options);
  if (result.success) return result;

  if (result.error?.includes('403')) {
    console.log('[ML API] Busca direta bloqueada (403) — usando fallback via highlights');
    return searchProductsViaHighlights(options);
  }

  return result;
}

async function searchProductsDirect(options: SearchOptions): Promise<SearchResult> {
  try {
    const {
      query = '', category, minDiscount = 0, maxPrice, minPrice,
      limit = 50, offset = 0, sort = 'relevance',
    } = options;

    let url = `${ML_API_BASE}/sites/${ML_SITE_ID}/search?`;
    if (query) url += `q=${encodeURIComponent(query)}&`;
    if (category) url += `category=${category}&`;
    if (maxPrice) url += `price=*-${maxPrice}&`;
    if (minPrice) url += `price=${minPrice}-*&`;
    // Quando há keyword, o ML ignora o q= se discount= estiver presente.
    // Filtramos por desconto no JS (linha abaixo) em vez da URL.
    if (minDiscount > 0 && !query) url += `discount=${minDiscount}-100&`;
    url += `limit=${limit}&offset=${offset}&sort=${sort}`;

    console.log(`[ML API] Busca direta: ${url}`);

    const response = await axios.get(url, { timeout: 15000, headers: getMLHeaders() });
    const { results, paging } = response.data;

    // Com keyword específica, retorna todos os resultados relevantes sem filtrar por desconto
    // (muitos produtos têm desconto real mas sem original_price preenchido na API)
    const products: MLProduct[] = results
      .map((item: any) => mapMLItem(item))
      .filter((p: MLProduct) => {
        if (!query) return p.discount_percentage >= minDiscount;
        
        // Se houver query, priorizamos a categoria de calçados/tênis se a palavra 'tênis' estiver presente
        const isFootwear = p.category_id?.includes('MLB1276') || p.category_id?.includes('MLB1430') || p.title.toLowerCase().includes('tênis');
        if (query.toLowerCase().includes('tênis') && !isFootwear) return false;
        
        return true;
      });

    console.log(`[ML API] Encontrados: ${products.length} produtos${query ? ` para "${query}"` : ` com >= ${minDiscount}% desconto`}`);
    return { success: true, products, total: paging?.total || products.length };
  } catch (error: any) {
    console.error('[ML API] Erro busca direta:', error.message);
    return { success: false, products: [], total: 0, error: error.message };
  }
}

/**
 * Fallback: busca via /highlights (best sellers por categoria) + /products/{id}/items
 */
async function searchProductsViaHighlights(options: SearchOptions): Promise<SearchResult> {
  try {
    const { category, minDiscount = 0, limit = 10 } = options;
    const headers = getMLHeaders();

    const categoriesToSearch = category
      ? [category]
      : Object.values(ML_CATEGORIES);
    const uniqueCategories = [...new Set(categoriesToSearch)];

    console.log(`[ML Highlights] Buscando best sellers em ${uniqueCategories.length} categorias`);

    const allProducts: MLProduct[] = [];

    for (const catId of uniqueCategories) {
      try {
        const hlResp = await axios.get(
          `${ML_API_BASE}/highlights/${ML_SITE_ID}/category/${catId}`,
          { timeout: 10000, headers }
        );

        const productIds = (hlResp.data.content || [])
          .filter((c: any) => c.type === 'PRODUCT')
          .slice(0, 5)
          .map((c: any) => c.id);

        for (const pid of productIds) {
          try {
            const [prodResp, itemsResp] = await Promise.all([
              axios.get(`${ML_API_BASE}/products/${pid}`, { timeout: 8000, headers }),
              axios.get(`${ML_API_BASE}/products/${pid}/items?limit=1`, { timeout: 8000, headers }),
            ]);

            const product = prodResp.data;
            const listing = itemsResp.data.results?.[0];
            if (!listing) continue;

            const originalPrice = listing.original_price || listing.price;
            const currentPrice = listing.price;
            const discount = originalPrice > currentPrice
              ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
              : 0;

            const mainPicture = product.pictures?.[0]?.url
              || product.main_features?.[0]?.pictures?.[0]?.url
              || '';

            allProducts.push({
              id: listing.item_id,
              title: product.name || `Produto ${pid}`,
              price: currentPrice,
              original_price: listing.original_price,
              discount_percentage: discount,
              thumbnail: mainPicture.replace('http://', 'https://'),
              permalink: `https://www.mercadolivre.com.br/p/${pid}`,
              affiliate_url: generateAffiliateUrl(`https://www.mercadolivre.com.br/p/${pid}`),
              condition: listing.condition || 'new',
              sold_quantity: 0,
              available_quantity: 0,
              shipping_free: listing.shipping?.free_shipping || false,
              seller: { id: listing.seller_id || 0, nickname: '' },
              category_id: listing.category_id || catId,
            });
          } catch {
            // Skip individual product errors
          }
        }
      } catch {
        // Skip category errors
      }
    }

    const filtered = allProducts
      .filter(p => p.discount_percentage >= minDiscount)
      .sort((a, b) => b.discount_percentage - a.discount_percentage)
      .slice(0, limit);

    console.log(`[ML Highlights] Encontrados: ${allProducts.length} total, ${filtered.length} com >= ${minDiscount}% desconto`);

    return {
      success: true,
      products: filtered,
      total: filtered.length,
    };
  } catch (error: any) {
    console.error('[ML Highlights] Erro:', error.message);
    return { success: false, products: [], total: 0, error: error.message };
  }
}

function mapMLItem(item: any): MLProduct {
  const originalPrice = item.original_price || item.price;
  const currentPrice = item.price;
  const discount = originalPrice > currentPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : 0;

  return {
    id: item.id,
    title: item.title,
    price: currentPrice,
    original_price: item.original_price,
    discount_percentage: discount,
    thumbnail: item.thumbnail?.replace('http://', 'https://') || '',
    permalink: item.permalink,
    affiliate_url: generateAffiliateUrl(item.permalink),
    condition: item.condition,
    sold_quantity: item.sold_quantity || 0,
    available_quantity: item.available_quantity || 0,
    shipping_free: item.shipping?.free_shipping || false,
    seller: {
      id: item.seller?.id || 0,
      nickname: item.seller?.nickname || '',
    },
    category_id: item.category_id || '',
  };
}

/**
 * Busca produtos em oferta (promoções)
 */
export async function searchDeals(options: SearchOptions = {}): Promise<SearchResult> {
  return searchProducts({
    ...options,
    minDiscount: options.minDiscount || 20,
    sort: 'relevance',
  });
}

/**
 * Busca por categoria específica
 */
export async function searchByCategory(
  categoryId: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  return searchProducts({
    ...options,
    category: categoryId,
  });
}

// ==================== GERAÇÃO DE LINKS DE AFILIADO ====================

/**
 * Gera URL de afiliado a partir do permalink
 * Formato OFICIAL do Mercado Livre: matt_word + matt_tool
 */
export function generateAffiliateUrl(permalink: string): string {
  const separator = permalink.includes('?') ? '&' : '?';
  return `${permalink}${separator}matt_word=${AFFILIATE_TAG}&matt_tool=${AFFILIATE_TOOL}`;
}

/**
 * Gera URL curta de afiliado (formato /sec/)
 * Nota: Este formato requer geração via painel, aqui usamos o formato longo
 */
export function generateShortAffiliateUrl(itemId: string): string {
  // Para URLs curtas /sec/, precisaríamos do Playwright
  // Por agora, retornamos URL longa com tracking
  return `https://www.mercadolivre.com.br/p/${itemId}?matt_word=${AFFILIATE_TAG}&matt_tool=${AFFILIATE_TOOL}`;
}

// ==================== EXTRAÇÃO DE IMAGEM COM PLAYWRIGHT ====================

let browser: Browser | null = null;

/**
 * Inicializa o navegador Playwright
 */
async function initBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

/**
 * Fecha o navegador
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Extrai a URL real da imagem do produto via Playwright
 */
export async function extractProductImage(productUrl: string): Promise<string | null> {
  let page: Page | null = null;
  
  try {
    const b = await initBrowser();
    page = await b.newPage();
    
    // Configura viewport e user agent
    await page.setViewportSize({ width: 1280, height: 720 });
    
    console.log(`[Playwright] Acessando: ${productUrl}`);
    
    await page.goto(productUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    
    // Espera carregar
    await page.waitForTimeout(2000);
    
    // Seletores comuns para imagem principal do ML
    const selectors = [
      'img.ui-pdp-image.ui-pdp-gallery__figure__image',
      'img[data-zoom]',
      'figure.ui-pdp-gallery__figure img',
      '.ui-pdp-gallery img[src*="mlstatic"]',
      'img[src*="D_NQ_NP"]',
      'img[src*="mlstatic.com"]',
    ];
    
    // Tenta cada seletor
    for (const selector of selectors) {
      try {
        const img = await page.locator(selector).first();
        const src = await img.getAttribute('src', { timeout: 1000 });
        if (src && src.includes('mlstatic')) {
          console.log(`[Playwright] Imagem encontrada: ${src.substring(0, 60)}...`);
          return src;
        }
      } catch {
        // Seletor não encontrado, continua para o próximo
      }
    }
    
    // Fallback: busca todas as imagens do mlstatic
    try {
      const allImages = await page.locator('img[src*="mlstatic"]').all();
      for (const img of allImages) {
        const src = await img.getAttribute('src');
        if (src && (src.includes('D_NQ_NP') || src.includes('-F.'))) {
          console.log(`[Playwright] Imagem encontrada (fallback): ${src.substring(0, 60)}...`);
          return src;
        }
      }
    } catch {
      // Nenhuma imagem encontrada
    }
    
    console.log('[Playwright] Imagem não encontrada');
    return null;
  } catch (error: any) {
    console.error('[Playwright] Erro:', error.message);
    return null;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Extrai imagem de alta qualidade (formato 2X)
 */
export function getHighQualityImageUrl(thumbnailUrl: string): string {
  // Converte thumbnail para imagem de alta qualidade
  // Formato ML: D_NQ_NP_[ID]-[CODIGO]-[SUFIXO]
  // -I = thumbnail pequeno
  // -O = médio
  // -F = grande
  // 2X = alta resolução
  
  let url = thumbnailUrl
    .replace('http://', 'https://')
    .replace('-I.jpg', '-F.webp')
    .replace('-O.jpg', '-F.webp')
    .replace('D_Q_NP_', 'D_NQ_NP_2X_');
  
  // Se não tem 2X, adiciona
  if (!url.includes('2X') && url.includes('D_NQ_NP_')) {
    url = url.replace('D_NQ_NP_', 'D_NQ_NP_2X_');
  }
  
  return url;
}

// ==================== CATEGORIAS POPULARES ====================

export const ML_CATEGORIES = {
  ELETRONICOS: 'MLB1000', // Eletrônicos, Áudio e Vídeo
  CELULARES: 'MLB1051', // Celulares e Telefones
  INFORMATICA: 'MLB1648', // Informática
  GAMES: 'MLB1144', // Games
  ELETRODOMESTICOS: 'MLB1574', // Eletrodomésticos
  CASA_MOVEIS: 'MLB1574', // Casa e Móveis
  ESPORTES: 'MLB1276', // Esportes e Fitness
  MODA: 'MLB1430', // Moda
  BELEZA: 'MLB1246', // Beleza e Cuidado Pessoal
  BRINQUEDOS: 'MLB1132', // Brinquedos
};

// ==================== EXPORTAÇÕES ====================

export default {
  searchProducts,
  searchDeals,
  searchByCategory,
  generateAffiliateUrl,
  extractProductImage,
  getHighQualityImageUrl,
  closeBrowser,
  ML_CATEGORIES,
  AFFILIATE_TAG,
};
