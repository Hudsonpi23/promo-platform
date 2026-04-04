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
import * as cheerio from 'cheerio';
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
 * Fallback: gera URL de afiliado via concatenação local.
 * AVISO: Links gerados assim NÃO são oficiais do ML e podem falhar no tracking.
 * Usar createOfficialAffiliateLink() sempre que possível.
 */
export function generateAffiliateUrl(permalink: string): string {
  let cleanUrl = permalink.split('#')[0].trim().split('?')[0];
  return `${cleanUrl}?matt_word=${AFFILIATE_TAG}&matt_tool=${AFFILIATE_TOOL}`;
}

// ==================== LINK OFICIAL DO ML (via createLink API) ====================

export interface MLOfficialLink {
  shortUrl: string;
  longUrl: string;
  text: string;
  regex: string;
  created: boolean;
}

let _mlSessionCookie = process.env.ML_SESSION_COOKIE || '';
let _mlCsrfToken = process.env.ML_CSRF_TOKEN || '';

export function getMLSession() {
  return { cookie: _mlSessionCookie, csrfToken: _mlCsrfToken };
}

export function setMLSession(cookie: string, csrfToken: string) {
  _mlSessionCookie = cookie;
  _mlCsrfToken = csrfToken;
}

export function isMLSessionConfigured(): boolean {
  return !!_mlSessionCookie && !!_mlCsrfToken;
}

function mergeCookies(oldCookieStr: string, setCookieHeaders: string[]): string {
  const cookieMap: Record<string, string> = {};

  if (oldCookieStr) {
    oldCookieStr.split(';').forEach(c => {
      const [key, ...val] = c.trim().split('=');
      if (key) cookieMap[key] = val.join('=');
    });
  }

  for (const sc of setCookieHeaders) {
    const cookiePart = sc.split(';')[0];
    const [key, ...val] = cookiePart.trim().split('=');
    if (key) cookieMap[key] = val.join('=');
  }

  return Object.keys(cookieMap).map(k => `${k}=${cookieMap[k]}`).join('; ');
}

async function refreshMLCookies(): Promise<void> {
  if (!_mlSessionCookie) return;

  try {
    const res = await fetch('https://www.mercadolivre.com.br/afiliados/linkbuilder', {
      headers: {
        'cookie': _mlSessionCookie,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      },
      redirect: 'manual',
    });

    const setCookies = res.headers.getSetCookie?.() || [];
    if (setCookies.length > 0) {
      _mlSessionCookie = mergeCookies(_mlSessionCookie, setCookies);
      console.log(`[ML-Session] Cookies refreshed (${setCookies.length} Set-Cookie headers merged)`);
    }

    const html = await res.text();
    const csrfMatch = html.match(/name="csrf[_-]?token"[^>]*value="([^"]+)"/i)
      || html.match(/"csrfToken"\s*:\s*"([^"]+)"/);
    if (csrfMatch) {
      _mlCsrfToken = csrfMatch[1];
      console.log('[ML-Session] CSRF token updated from page');
    }
  } catch (err: any) {
    console.warn('[ML-Session] Cookie refresh failed:', err.message);
  }
}

/**
 * Gera link de afiliado OFICIAL do ML via API interna createLink.
 * Retorna short_url (meli.la/...) e long_url (/social/...?ref=SIGNED).
 * Se a sessão não está configurada ou expirou, retorna null (usar fallback).
 */
export async function createOfficialAffiliateLink(productUrl: string): Promise<MLOfficialLink | null> {
  if (!isMLSessionConfigured()) {
    console.warn('[ML-Link] Sessão ML não configurada — usando fallback local');
    return null;
  }

  try {
    await refreshMLCookies();

    let cleanUrl = productUrl.split('#')[0].trim();

    // URLs de catálogo (/p/MLB...) não são aceitas pelo createLink.
    // Converter para permalink do item via API do ML.
    const catalogMatch = cleanUrl.match(/\/p\/(MLB\d+)/i);
    if (catalogMatch) {
      try {
        const itemsResp = await axios.get(
          `${ML_API_BASE}/products/${catalogMatch[1]}/items?limit=1`,
          { timeout: 8000, headers: getMLHeaders() }
        );
        const permalink = itemsResp.data.results?.[0]?.permalink;
        if (permalink) {
          console.log(`[ML-Link] Catálogo ${catalogMatch[1]} → ${permalink.substring(0, 80)}`);
          cleanUrl = permalink;
        }
      } catch (err: any) {
        console.warn(`[ML-Link] Falha ao resolver catálogo ${catalogMatch[1]}:`, err.message);
      }
    }

    const res = await fetch('https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink', {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'origin': 'https://www.mercadolivre.com.br',
        'referer': 'https://www.mercadolivre.com.br/afiliados/linkbuilder',
        'x-csrf-token': _mlCsrfToken,
        'cookie': _mlSessionCookie,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        urls: [cleanUrl],
        tag: AFFILIATE_TAG,
      }),
    });

    const setCookies = res.headers.getSetCookie?.() || [];
    if (setCookies.length > 0) {
      _mlSessionCookie = mergeCookies(_mlSessionCookie, setCookies);
    }

    if (res.status === 401 || res.status === 403) {
      console.error('[ML-Link] Sessão expirada (401/403) — necessário atualizar cookies');
      return null;
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[ML-Link] Erro ${res.status}:`, errText);
      return null;
    }

    const data = await res.json() as any;

    if (data.status === 200 && data.urls?.length > 0) {
      const link = data.urls[0];

      if (link.error_code) {
        console.warn(`[ML-Link] createLink error ${link.error_code}: ${link.message}`);
        return null;
      }

      if (link.short_url) {
        console.log(`[ML-Link] Link oficial gerado: ${link.short_url}`);
        return {
          shortUrl: link.short_url,
          longUrl: link.long_url,
          text: link.text || '',
          regex: link.regex || '',
          created: link.created,
        };
      }
    }

    console.warn('[ML-Link] Resposta inesperada:', JSON.stringify(data).substring(0, 200));
    return null;
  } catch (err: any) {
    console.error('[ML-Link] Erro ao gerar link oficial:', err.message);
    return null;
  }
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
 * Extrai preço, preço original e título da página do ML via HTTP GET + JSON-LD.
 * Funciona sem Playwright — usa a mesma URL que o usuário cola (com filtros).
 */
export interface MLScrapedCoupon {
  available: boolean;
  percentage: number | null;
  savings: number | null;
  isAutomatic: boolean;
}

export interface MLPixInfo {
  discountPercent: number;
  price: number | null;
}

export interface MLInstallmentInfo {
  quantity: number;
  amount: number;
  noInterest: boolean;
  totalPrice: number | null;
}

export interface MLScrapedPrice {
  price: number | null;
  originalPrice: number | null;
  title: string | null;
  coupon: MLScrapedCoupon | null;
  pix: MLPixInfo | null;
  installments: MLInstallmentInfo | null;
  discountPercent: number;
}

export async function scrapeMLPrice(productUrl: string): Promise<MLScrapedPrice> {
  try {
    console.log(`[ML-Price] Buscando preço de: ${productUrl.substring(0, 80)}...`);
    const resp = await axios.get(productUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      maxRedirects: 5,
    });

    const html: string = resp.data;
    let price: number | null = null;
    let originalPrice: number | null = null;
    let title: string | null = null;
    let coupon: MLScrapedCoupon | null = null;

    // 1. JSON-LD — fonte mais confiável
    const ldMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (ldMatches) {
      for (const m of ldMatches) {
        const jsonStr = m.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        try {
          const obj = JSON.parse(jsonStr);
          if (obj['@type'] === 'Product' && obj.offers?.price) {
            price = parseFloat(obj.offers.price);
            title = obj.name || null;
          }
        } catch {}
      }
    }

    // 2. Preço original (riscado) via HTML
    const origMatch = html.match(/ui-pdp-price__original-value[\s\S]*?andes-money-amount__fraction[^>]*>(\d[\d.]*)/i);
    if (origMatch) {
      originalPrice = parseFloat(origMatch[1].replace(/\./g, ''));
      const origCentsMatch = html.match(/ui-pdp-price__original-value[\s\S]*?andes-money-amount__cents[^>]*>(\d+)/i);
      if (origCentsMatch) {
        originalPrice += parseFloat(origCentsMatch[1]) / 100;
      }
    }

    // 3. Fallback: preço principal via HTML se JSON-LD falhou
    if (!price) {
      const mainMatch = html.match(/ui-pdp-price__second-line[\s\S]*?andes-money-amount__fraction[^>]*>(\d[\d.]*)/i);
      if (mainMatch) {
        price = parseFloat(mainMatch[1].replace(/\./g, ''));
      }
    }

    // 4. Extração de cupom automático via __PRELOADED_STATE__ (JSON embutido no HTML)
    // O ML inclui dados de cupom no state pré-carregado da página
    const couponJsonMatch = html.match(/"coupons":\s*\{"coupons":\s*\[([\s\S]*?)\]\}/);
    if (couponJsonMatch) {
      try {
        const couponsArray = JSON.parse(`[${couponJsonMatch[1]}]`);
        for (const c of couponsArray) {
          if (c.amount && c.amount > 0) {
            const isPercent = c.amount_type === 'percentage';
            const pct = isPercent ? c.amount : null;
            const savings = isPercent && price
              ? Math.round(price * c.amount / 100 * 100) / 100
              : (!isPercent ? c.amount : null);

            coupon = {
              available: true,
              percentage: pct,
              savings,
              isAutomatic: true,
            };
            console.log(`[ML-Price] Cupom detectado via state: ${isPercent ? `${pct}%` : `R$${c.amount}`} OFF (label: ${c.label})`);
            break;
          }
        }
      } catch {
        console.warn('[ML-Price] Falha ao parsear coupons do state');
      }
    }

    // Fallback: busca na seção coupon_summary do HTML
    if (!coupon) {
      const couponSummaryMatch = html.match(/"coupon_summary"[\s\S]*?"awareness"[\s\S]*?"label"[\s\S]*?"text":"(\d+)%\s*OFF/i);
      if (couponSummaryMatch) {
        const pct = parseInt(couponSummaryMatch[1], 10);
        coupon = {
          available: true,
          percentage: pct,
          savings: price ? Math.round(price * pct / 100 * 100) / 100 : null,
          isAutomatic: true,
        };
        console.log(`[ML-Price] Cupom detectado via coupon_summary: ${pct}% OFF`);
      }
    }

    // Fallback 2: promotions array com "X% OFF"
    if (!coupon) {
      const promoMatch = html.match(/"promotions":\s*\[[\s\S]*?"payment_method":"(\d+)%\s*OFF[^"]*"/i);
      if (promoMatch) {
        const pct = parseInt(promoMatch[1], 10);
        coupon = {
          available: true,
          percentage: pct,
          savings: price ? Math.round(price * pct / 100 * 100) / 100 : null,
          isAutomatic: true,
        };
        console.log(`[ML-Price] Cupom detectado via promotions: ${pct}% OFF`);
      }
    }

    // 5. PIX discount — "discount_label":{"text":"no Pix"..."value":31}
    let pix: MLPixInfo | null = null;
    const pixLabelMatch = html.match(/"discount_label":\{"text":"no Pix"[^}]*"value":(\d+)/);
    if (pixLabelMatch) {
      const pixPct = parseInt(pixLabelMatch[1], 10);
      pix = {
        discountPercent: pixPct,
        price: price,
      };
      console.log(`[ML-Price] PIX: ${pixPct}% OFF (preço PIX = R$${price})`);
    }

    // Fallback PIX: "31% OFF" + "no Pix" in HTML class 
    if (!pix) {
      const pixHtmlMatch = html.match(/(\d+)%\s*OFF<\/span><span[^>]*>no Pix/i);
      if (pixHtmlMatch) {
        const pixPct = parseInt(pixHtmlMatch[1], 10);
        pix = { discountPercent: pixPct, price: price };
        console.log(`[ML-Price] PIX (HTML): ${pixPct}% OFF`);
      }
    }

    // 6. Installments — 9x de R$ 53,22 sem juros
    let installments: MLInstallmentInfo | null = null;

    // From og:title meta: "R$ 479" = installment total price
    const ogPriceMatch = html.match(/<meta\s+property="og:title"[^>]*R\$\s*([\d.,]+)/i);
    const installmentTotalPrice = ogPriceMatch
      ? parseFloat(ogPriceMatch[1].replace(/\./g, '').replace(',', '.'))
      : null;

    // From HTML money-amount fractions: find installment section
    const installSectionMatch = html.match(/ui-pdp-price__subtitles[\s\S]*?(\d+)x[\s\S]*?andes-money-amount__fraction[^>]*>(\d[\d.]*)/i);
    if (installSectionMatch) {
      const qty = parseInt(installSectionMatch[1], 10);
      const amt = parseFloat(installSectionMatch[2].replace(/\./g, ''));
      const centsMatch = html.match(/ui-pdp-price__subtitles[\s\S]*?andes-money-amount__cents[^>]*>(\d+)/i);
      const fullAmt = centsMatch ? amt + parseFloat(centsMatch[1]) / 100 : amt;
      const noInterest = html.includes('sem juros');
      installments = {
        quantity: qty,
        amount: fullAmt,
        noInterest,
        totalPrice: installmentTotalPrice || Math.round(qty * fullAmt * 100) / 100,
      };
      console.log(`[ML-Price] Parcelas: ${qty}x R$${fullAmt.toFixed(2)}${noInterest ? ' sem juros' : ''}`);
    }

    // 7. Discount percentage calculation
    let discountPercent = 0;
    if (originalPrice && price && originalPrice > price) {
      discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
    }
    if (pix && pix.discountPercent > discountPercent) {
      discountPercent = pix.discountPercent;
    }

    console.log(`[ML-Price] price=${price}, originalPrice=${originalPrice}, discount=${discountPercent}%, pix=${pix ? `${pix.discountPercent}%` : 'N/A'}, installments=${installments ? `${installments.quantity}x R$${installments.amount}` : 'N/A'}, coupon=${coupon ? `${coupon.percentage}%` : 'nenhum'}`);
    return { price, originalPrice, title, coupon, pix, installments, discountPercent };
  } catch (error: any) {
    console.error('[ML-Price] Erro:', error.message);
    return { price: null, originalPrice: null, title: null, coupon: null, pix: null, installments: null, discountPercent: 0 };
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

// ==================== BUSCA VIA COOKIES (scraping autenticado) ====================

export interface MLBrowseProduct {
  title: string;
  price: number | null;
  originalPrice: number | null;
  discountPercent: number;
  imageUrl: string;
  productUrl: string;
  freeShipping: boolean;
  couponText: string | null;
  pixDiscount: number | null;
  pixPrice: number | null;
  installmentQty: number | null;
  installmentAmount: number | null;
  installmentNoInterest: boolean;
  installmentTotalPrice: number | null;
}

export interface MLBrowseResult {
  success: boolean;
  query: string;
  products: MLBrowseProduct[];
  total: number;
  source: 'cookies' | 'api_fallback';
  error?: string;
}

const ML_NICHE_CATEGORIES: Record<string, string> = {
  'eletronicos': 'MLB1000',
  'celulares': 'MLB1051',
  'informatica': 'MLB1648',
  'games': 'MLB1144',
  'eletrodomesticos': 'MLB1574',
  'moveis': 'MLB1574',
  'esportes': 'MLB1276',
  'moda': 'MLB1430',
  'beleza': 'MLB1246',
  'brinquedos': 'MLB1132',
  'bebes': 'MLB1196',
  'pet': 'MLB1071',
  'ferramentas': 'MLB1500',
  'saude': 'MLB1953',
  'construcao': 'MLB1500',
};

/**
 * Busca produtos no ML via scraping autenticado (com cookies da sessão do usuário).
 * Navega diretamente no site do ML como um browser logado, parseando o HTML.
 * Ideal quando a API oficial falha ou retorna dados incompletos.
 */
export async function searchMLViaCookies(options: {
  query?: string;
  niche?: string;
  dealsOnly?: boolean;
  limit?: number;
}): Promise<MLBrowseResult> {
  const { query, niche, dealsOnly = false, limit = 20 } = options;

  if (!isMLSessionConfigured()) {
    return { success: false, query: query || niche || '', products: [], total: 0, source: 'cookies', error: 'Sessão ML não configurada' };
  }

  try {
    await refreshMLCookies();

    let url: string;
    const searchTerm = query || niche || '';

    if (dealsOnly && !query) {
      const catId = niche ? ML_NICHE_CATEGORIES[niche.toLowerCase()] : null;
      url = catId
        ? `https://www.mercadolivre.com.br/ofertas?category=${catId}`
        : 'https://www.mercadolivre.com.br/ofertas';
    } else if (query) {
      url = `https://lista.mercadolivre.com.br/${encodeURIComponent(query)}`;
      if (dealsOnly) url += '_Desde_MercadoL%C3%ADder_NoIndex_True';
    } else if (niche && ML_NICHE_CATEGORIES[niche.toLowerCase()]) {
      url = `https://www.mercadolivre.com.br/ofertas?category=${ML_NICHE_CATEGORIES[niche.toLowerCase()]}`;
    } else {
      url = `https://lista.mercadolivre.com.br/${encodeURIComponent(niche || 'ofertas do dia')}`;
    }

    console.log(`[ML-Browse] Buscando: ${url}`);

    const resp = await fetch(url, {
      headers: {
        'cookie': _mlSessionCookie,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
    });

    if (!resp.ok) {
      return { success: false, query: searchTerm, products: [], total: 0, source: 'cookies', error: `HTTP ${resp.status}` };
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    const products: MLBrowseProduct[] = [];

    // Seletores do ML para cards de resultado de busca
    const cardSelectors = [
      'li.ui-search-layout__item',
      'li.promotion-item',
      'div.andes-card[data-testid]',
      'li[class*="search-layout"]',
      'div.poly-card',
    ];

    let cards: cheerio.Cheerio<any> | null = null;
    for (const sel of cardSelectors) {
      const found = $(sel);
      if (found.length > 0) {
        cards = found;
        console.log(`[ML-Browse] Seletor "${sel}" encontrou ${found.length} cards`);
        break;
      }
    }

    if (cards && cards.length > 0) {
      cards.slice(0, limit).each((_i, el) => {
        const card = $(el);
        const product = parseProductCard($, card);
        if (product && product.title && product.productUrl) {
          products.push(product);
        }
      });
    }

    // Fallback: tentar extrair do __PRELOADED_STATE__ JSON embutido no HTML
    if (products.length === 0) {
      const stateMatch = html.match(/__PRELOADED_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/);
      if (stateMatch) {
        try {
          const state = JSON.parse(stateMatch[1]);
          const results = state?.initialState?.results || state?.results || [];
          for (const item of results.slice(0, limit)) {
            const price = item.price?.amount || item.prices?.prices?.[0]?.amount || null;
            const origPrice = item.original_price?.amount || item.prices?.reference_prices?.[0]?.amount || null;
            const discount = origPrice && price && origPrice > price
              ? Math.round(((origPrice - price) / origPrice) * 100)
              : 0;

            products.push({
              title: item.title || '',
              price,
              originalPrice: origPrice,
              discountPercent: discount,
              imageUrl: item.thumbnail || item.pictures?.[0]?.url || '',
              productUrl: item.permalink || '',
              freeShipping: item.shipping?.free_shipping || false,
              couponText: null,
              pixDiscount: null, pixPrice: null,
              installmentQty: null, installmentAmount: null, installmentNoInterest: false, installmentTotalPrice: null,
            });
          }
          console.log(`[ML-Browse] Extraídos ${products.length} produtos do __PRELOADED_STATE__`);
        } catch {
          console.warn('[ML-Browse] Falha ao parsear __PRELOADED_STATE__');
        }
      }
    }

    // Fallback 2: regex bruto para links de produto
    if (products.length === 0) {
      const linkRegex = /href="(https:\/\/www\.mercadolivre\.com\.br\/[^"]+\/p\/MLB\d+[^"]*)"/g;
      const itemRegex = /href="(https:\/\/(?:www|produto)\.mercadolivre\.com\.br\/[^"]*MLB[- ]\d+[^"]*)"/g;
      const allLinks = new Set<string>();

      let match;
      while ((match = linkRegex.exec(html)) !== null) allLinks.add(match[1]);
      while ((match = itemRegex.exec(html)) !== null) allLinks.add(match[1]);

      for (const link of [...allLinks].slice(0, limit)) {
        products.push({
          title: decodeURIComponent(link.split('/')[3] || '').replace(/-/g, ' '),
          price: null,
          originalPrice: null,
          discountPercent: 0,
          imageUrl: '',
          productUrl: link.split('?')[0],
          freeShipping: false,
          couponText: null,
          pixDiscount: null, pixPrice: null,
          installmentQty: null, installmentAmount: null, installmentNoInterest: false, installmentTotalPrice: null,
        });
      }
      if (products.length > 0) {
        console.log(`[ML-Browse] Fallback regex: ${products.length} links extraídos`);
      }
    }

    const setCookies = resp.headers.getSetCookie?.() || [];
    if (setCookies.length > 0) {
      _mlSessionCookie = mergeCookies(_mlSessionCookie, setCookies);
    }

    console.log(`[ML-Browse] Total: ${products.length} produtos para "${searchTerm}"`);

    // Enrich top products with detailed price info (PIX, installments, real discount)
    const enrichLimit = Math.min(products.length, limit, 10);
    for (let i = 0; i < enrichLimit; i++) {
      const p = products[i];
      if (!p.productUrl || p.productUrl.includes('click1.mercadolivre.com.br')) continue;
      try {
        const detail = await scrapeMLPrice(p.productUrl);
        if (detail.price) {
          p.price = detail.price;
          p.originalPrice = detail.originalPrice;
          p.discountPercent = detail.discountPercent;
          if (detail.pix) {
            p.pixDiscount = detail.pix.discountPercent;
            p.pixPrice = detail.pix.price;
          }
          if (detail.installments) {
            p.installmentQty = detail.installments.quantity;
            p.installmentAmount = detail.installments.amount;
            p.installmentNoInterest = detail.installments.noInterest;
            p.installmentTotalPrice = detail.installments.totalPrice;
          }
          if (detail.coupon) {
            p.couponText = `Cupom ${detail.coupon.percentage}% OFF`;
          }
        }
      } catch {
        // Skip enrichment errors
      }
    }

    return {
      success: true,
      query: searchTerm,
      products,
      total: products.length,
      source: 'cookies',
    };
  } catch (err: any) {
    console.error('[ML-Browse] Erro:', err.message);
    return { success: false, query: query || niche || '', products: [], total: 0, source: 'cookies', error: err.message };
  }
}

function parseProductCard($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): MLBrowseProduct | null {
  try {
    // Prioriza links com URL real do produto (não tracking redirects)
    let productUrl = '';
    const allLinks = card.find('a[href]');
    allLinks.each((_i, a) => {
      const href = $(a).attr('href') || '';
      if (productUrl) return;
      if (
        (href.includes('mercadolivre.com.br/') || href.includes('produto.mercadolivre.com.br/'))
        && !href.includes('click1.mercadolivre.com.br')
        && !href.includes('/mclics/')
        && (href.includes('/p/MLB') || href.includes('/up/MLB') || href.match(/MLB[- ]\d+/))
      ) {
        productUrl = href.split('#')[0].split('?')[0];
      }
    });

    if (!productUrl) {
      const linkEl = card.find('a[href*="mercadolivre.com.br"]').first();
      productUrl = (linkEl.attr('href') || '').split('#')[0].split('?')[0];
    }

    const linkEl = card.find('a[href*="mercadolivre.com.br"]').first();

    const titleEl = card.find('h2, h3, [class*="title"], [class*="item__title"]').first();
    const title = titleEl.text().trim() || linkEl.attr('title') || '';

    let price: number | null = null;
    let originalPrice: number | null = null;

    const priceEl = card.find('[class*="price__fraction"], [class*="money-amount__fraction"]');
    if (priceEl.length > 0) {
      const priceText = priceEl.first().text().replace(/\./g, '').trim();
      const centsEl = card.find('[class*="money-amount__cents"]').first();
      const cents = centsEl.text().trim();
      price = parseFloat(priceText + (cents ? '.' + cents : ''));
    }

    const origEl = card.find('[class*="original-value"] [class*="fraction"], s [class*="fraction"]');
    if (origEl.length > 0) {
      const origText = origEl.first().text().replace(/\./g, '').trim();
      originalPrice = parseFloat(origText) || null;
    }

    const discount = originalPrice && price && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

    const imgEl = card.find('img[src*="mlstatic"], img[data-src*="mlstatic"]').first();
    const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';

    const freeShipping = card.text().toLowerCase().includes('frete grátis')
      || card.find('[class*="free-shipping"], [class*="shipping--free"]').length > 0;

    const couponEl = card.find('[class*="coupon"], [class*="highlight__label"]');
    const couponText = couponEl.length > 0 ? couponEl.first().text().trim() : null;

    return {
      title,
      price: isNaN(price as number) ? null : price,
      originalPrice: isNaN(originalPrice as number) ? null : originalPrice,
      discountPercent: discount,
      imageUrl: imageUrl.replace('http://', 'https://'),
      productUrl,
      freeShipping,
      couponText,
      pixDiscount: null,
      pixPrice: null,
      installmentQty: null,
      installmentAmount: null,
      installmentNoInterest: false,
      installmentTotalPrice: null,
    };
  } catch {
    return null;
  }
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
  createOfficialAffiliateLink,
  isMLSessionConfigured,
  getMLSession,
  setMLSession,
  searchMLViaCookies,
  extractProductImage,
  scrapeMLPrice,
  getHighQualityImageUrl,
  closeBrowser,
  ML_CATEGORIES,
  AFFILIATE_TAG,
};
