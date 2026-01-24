/**
 * Auto Promoter Service
 * 
 * Sistema automatizado para postar ofertas do ML nas redes sociais:
 * - Busca ofertas com desconto
 * - Extrai imagem real com Playwright
 * - Faz upload no Cloudinary
 * - Posta em: Telegram, Facebook (2 páginas), Twitter/X
 */

import { searchDeals, MLProduct, extractProductImage, getHighQualityImageUrl, closeBrowser, AFFILIATE_TAG, AFFILIATE_TOOL } from './mlAffiliate';
import { postTweet, postTweetWithImage } from './twitter';
import { postToPages } from './facebook';
import { sendTelegramMessage } from './telegram';
import { uploadFromUrl, uploadFromBuffer } from './cloudinary';
import axios from 'axios';
import { chromium, Browser } from 'playwright';

// ==================== CONVERSÃO DE LINK DE AFILIADO ====================

/**
 * Converte uma URL normal do Mercado Livre para link de afiliado
 * Adiciona os parâmetros matt_tool e matt_word
 */
export function convertToAffiliateUrl(url: string): string {
  // Se já é um link de afiliado (formato /sec/), retorna como está
  if (url.includes('/sec/') || url.includes('matt_tool=') || url.includes('matt_word=')) {
    console.log('[Affiliate] URL já é link de afiliado');
    return url;
  }
  
  // Se é uma URL do Mercado Livre, adiciona parâmetros de afiliado
  // ORDEM CORRETA: matt_word PRIMEIRO, matt_tool DEPOIS
  if (url.includes('mercadolivre.com.br') || url.includes('mercadolibre.com')) {
    const separator = url.includes('?') ? '&' : '?';
    const affiliateUrl = `${url}${separator}matt_word=${AFFILIATE_TAG}&matt_tool=${AFFILIATE_TOOL}`;
    console.log('[Affiliate] ✅ Convertido para link de afiliado');
    console.log('[Affiliate] Tag:', AFFILIATE_TAG);
    return affiliateUrl;
  }
  
  // Se não é URL do ML, retorna como está
  return url;
}

// ==================== TIPOS ====================

export interface PostResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

export interface AutoPostResult {
  product: MLProduct;
  imageUrl: string | null;
  cloudinaryUrl: string | null;
  posts: PostResult[];
  timestamp: Date;
}

export interface AutoPromoterOptions {
  minDiscount?: number;
  maxProducts?: number;
  postToTelegram?: boolean;
  postToFacebook?: boolean;
  postToTwitter?: boolean;
  delayBetweenPosts?: number; // ms
  query?: string;
  category?: string;
}

// ==================== GERAÇÃO DE TEXTO ====================

/**
 * Gera texto promocional para a oferta
 */
function generatePromoText(product: MLProduct): string {
  const { title, price, original_price, discount_percentage, shipping_free } = product;
  
  const priceFormatted = price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const originalFormatted = original_price 
    ? original_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null;
  
  const emoji = getEmojiForDiscount(discount_percentage);
  const shipping = shipping_free ? '🚚 FRETE GRÁTIS!' : '';
  
  let text = `${emoji} ${discount_percentage}% OFF!\n\n`;
  text += `📦 ${title}\n\n`;
  
  if (originalFormatted) {
    text += `❌ De: ${originalFormatted}\n`;
  }
  text += `✅ Por: ${priceFormatted}\n\n`;
  
  if (shipping) {
    text += `${shipping}\n\n`;
  }
  
  text += `🛒 Compre aqui: ${product.affiliate_url}`;
  
  return text;
}

/**
 * Encurta URL do Mercado Livre para usar só o ID do produto
 * ORDEM CORRETA: matt_word primeiro, matt_tool depois
 */
function shortenMLUrl(url: string): string {
  // Extrai MLB ID para criar URL mais curta
  const mlbMatch = url.match(/(MLB-?\d+)/i);
  if (mlbMatch) {
    const mlbId = mlbMatch[1].replace('-', '');
    // ORDEM CORRETA: matt_word PRIMEIRO, matt_tool DEPOIS
    return `https://produto.mercadolivre.com.br/${mlbId}?matt_word=${AFFILIATE_TAG}&matt_tool=${AFFILIATE_TOOL}`;
  }
  return url;
}

/**
 * Gera texto curto para Twitter (280 caracteres)
 */
function generateTweetText(product: MLProduct): string {
  const { title, price, discount_percentage, affiliate_url } = product;
  
  const priceFormatted = price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const emoji = getEmojiForDiscount(discount_percentage);
  
  // URL curta
  const shortUrl = shortenMLUrl(affiliate_url);
  
  // Encurta o título baseado no espaço restante
  // Formato: emoji OFF + título + preço + URL = ~100 chars fixos
  const fixedLength = emoji.length + 10 + priceFormatted.length + shortUrl.length + 10;
  const maxTitleLength = Math.min(280 - fixedLength, 60);
  const shortTitle = title.length > maxTitleLength 
    ? title.substring(0, maxTitleLength - 3) + '...'
    : title;
  
  return `${emoji} ${discount_percentage}% OFF!\n${shortTitle}\n${priceFormatted}\n🛒 ${shortUrl}`;
}

/**
 * Retorna emoji baseado no desconto
 */
function getEmojiForDiscount(discount: number): string {
  if (discount >= 50) return '🔥🔥🔥';
  if (discount >= 40) return '🔥🔥';
  if (discount >= 30) return '🔥';
  if (discount >= 20) return '⚡';
  return '💰';
}

// ==================== EXTRAÇÃO DE DADOS DO PRODUTO ====================

let browser: Browser | null = null;

async function initBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
  }
  return browser;
}

/**
 * Extrai dados do produto do Mercado Livre via Playwright
 */
async function extractProductData(productUrl: string): Promise<MLProduct | null> {
  console.log('[Scraper] Extraindo dados do produto:', productUrl);
  
  const b = await initBrowser();
  const context = await b.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'pt-BR'
  });
  
  const page = await context.newPage();
  
  try {
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Extrai título
    let titulo = '';
    try {
      titulo = await page.locator('h1.ui-pdp-title').first().textContent() || '';
      if (!titulo) {
        titulo = await page.locator('h1').first().textContent() || '';
      }
    } catch { }
    titulo = titulo.trim();
    console.log('[Scraper] Título:', titulo.substring(0, 50));
    
    // Extrai preço atual
    let preco = 0;
    try {
      const precoText = await page.locator('.andes-money-amount__fraction').first().textContent();
      if (precoText) {
        preco = parseFloat(precoText.replace(/\./g, '').replace(',', '.'));
      }
    } catch { }
    console.log('[Scraper] Preço:', preco);
    
    // Extrai preço original (se houver desconto)
    let precoOriginal: number | null = null;
    try {
      const originalText = await page.locator('.ui-pdp-price__original-value .andes-money-amount__fraction').first().textContent();
      if (originalText) {
        precoOriginal = parseFloat(originalText.replace(/\./g, '').replace(',', '.'));
      }
    } catch { }
    
    // Calcula desconto
    let desconto = 0;
    if (precoOriginal && precoOriginal > preco) {
      desconto = Math.round(((precoOriginal - preco) / precoOriginal) * 100);
    }
    console.log('[Scraper] Desconto:', desconto + '%');
    
    // Extrai imagem
    let imagem = '';
    try {
      // Tenta pegar imagem principal
      const imgEl = await page.locator('figure.ui-pdp-gallery__figure img').first();
      imagem = await imgEl.getAttribute('src') || '';
      
      if (!imagem || imagem.includes('placeholder')) {
        const imgs = await page.locator('img[src*="mlstatic"]').all();
        for (const img of imgs) {
          const src = await img.getAttribute('src');
          if (src && src.includes('D_NQ_NP') && !src.includes('-I.')) {
            imagem = src;
            break;
          }
        }
      }
    } catch { }
    
    // Converte para alta qualidade
    if (imagem) {
      imagem = imagem.replace('http://', 'https://').replace('-I.', '-F.').replace('-O.', '-F.');
    }
    console.log('[Scraper] Imagem:', imagem ? imagem.substring(0, 60) + '...' : 'Não encontrada');
    
    // Verifica frete grátis
    let freteGratis = false;
    try {
      const freteText = await page.locator('.ui-pdp-color--GREEN').first().textContent();
      freteGratis = freteText?.toLowerCase().includes('grátis') || false;
    } catch { }
    
    await context.close();
    
    if (!titulo) {
      console.log('[Scraper] ❌ Não foi possível extrair dados do produto');
      return null;
    }
    
    return {
      id: 'scraped',
      title: titulo,
      price: preco,
      original_price: precoOriginal,
      discount_percentage: desconto,
      thumbnail: imagem,
      permalink: productUrl,
      affiliate_url: productUrl,
      condition: 'new',
      sold_quantity: 0,
      available_quantity: 1,
      shipping_free: freteGratis,
      seller: { id: 0, nickname: '' },
      category_id: '',
    };
    
  } catch (error: any) {
    console.error('[Scraper] Erro:', error.message);
    await context.close();
    return null;
  }
}

// ==================== UPLOAD DE IMAGEM ====================

/**
 * Baixa imagem e faz upload para Cloudinary
 */
async function uploadImageToCloudinary(imageUrl: string): Promise<string | null> {
  try {
    console.log('[Upload] Baixando imagem:', imageUrl.substring(0, 60));
    
    // Baixa a imagem
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const buffer = Buffer.from(response.data);
    console.log(`[Upload] Imagem baixada: ${(buffer.length / 1024).toFixed(1)} KB`);
    
    // Upload para Cloudinary
    const result = await uploadFromBuffer(buffer, {
      folder: 'promo-platform/ml',
      transformation: {
        width: 1200,
        height: 1200,
        crop: 'limit',
        quality: 90,
        format: 'jpg',
      },
    });
    
    if (result.success && result.url) {
      console.log('[Upload] Cloudinary URL:', result.url);
      return result.url;
    }
    
    return null;
  } catch (error: any) {
    console.error('[Upload] Erro:', error.message);
    return null;
  }
}

// ==================== POSTAGEM ====================

/**
 * Posta em todas as plataformas
 */
async function postToAllPlatforms(
  product: MLProduct,
  imageUrl: string | null,
  options: AutoPromoterOptions
): Promise<PostResult[]> {
  const results: PostResult[] = [];
  
  const promoText = generatePromoText(product);
  const tweetText = generateTweetText(product);
  
  // 1. Telegram
  if (options.postToTelegram !== false) {
    try {
      console.log('[Post] Enviando para Telegram...');
      const telegramResult = await sendTelegramMessage(promoText, imageUrl || undefined);
      results.push({
        platform: 'telegram',
        success: telegramResult.success,
        postId: telegramResult.messageId?.toString(),
        error: telegramResult.error,
      });
    } catch (error: any) {
      results.push({
        platform: 'telegram',
        success: false,
        error: error.message,
      });
    }
  }
  
  // 2. Facebook (2 páginas)
  if (options.postToFacebook !== false) {
    try {
      console.log('[Post] Enviando para Facebook...');
      const fbResults = await postToPages(promoText, imageUrl || undefined);
      
      for (const [pageId, result] of Object.entries(fbResults)) {
        results.push({
          platform: `facebook-${pageId}`,
          success: result.success,
          postId: result.postId,
          error: result.error,
        });
      }
    } catch (error: any) {
      results.push({
        platform: 'facebook',
        success: false,
        error: error.message,
      });
    }
  }
  
  // 3. Twitter/X
  if (options.postToTwitter !== false) {
    try {
      console.log('[Post] Enviando para Twitter...');
      // Usa postTweetWithImage se há imagem, senão só postTweet
      const twitterResult = imageUrl 
        ? await postTweetWithImage(tweetText, imageUrl)
        : await postTweet(tweetText);
      results.push({
        platform: 'twitter',
        success: twitterResult.success,
        postId: twitterResult.tweetId,
        error: twitterResult.error,
      });
    } catch (error: any) {
      results.push({
        platform: 'twitter',
        success: false,
        error: error.message,
      });
    }
  }
  
  return results;
}

// ==================== FLUXO PRINCIPAL ====================

/**
 * Busca ofertas e posta automaticamente
 */
export async function runAutoPromoter(options: AutoPromoterOptions = {}): Promise<AutoPostResult[]> {
  const {
    minDiscount = 20,
    maxProducts = 5,
    delayBetweenPosts = 5000,
    query,
    category,
  } = options;
  
  console.log('='.repeat(60));
  console.log('[AutoPromoter] Iniciando busca de ofertas...');
  console.log(`[AutoPromoter] Desconto mínimo: ${minDiscount}%`);
  console.log(`[AutoPromoter] Máximo de produtos: ${maxProducts}`);
  console.log('='.repeat(60));
  
  const results: AutoPostResult[] = [];
  
  try {
    // 1. Busca ofertas
    const searchResult = await searchDeals({
      query,
      category,
      minDiscount,
      limit: maxProducts * 2, // Busca mais para ter margem
    });
    
    if (!searchResult.success || searchResult.products.length === 0) {
      console.log('[AutoPromoter] Nenhuma oferta encontrada');
      return results;
    }
    
    console.log(`[AutoPromoter] ${searchResult.products.length} ofertas encontradas`);
    
    // 2. Processa cada produto
    const productsToPost = searchResult.products.slice(0, maxProducts);
    
    for (let i = 0; i < productsToPost.length; i++) {
      const product = productsToPost[i];
      
      console.log('\n' + '-'.repeat(50));
      console.log(`[AutoPromoter] Processando ${i + 1}/${productsToPost.length}: ${product.title.substring(0, 50)}...`);
      console.log(`[AutoPromoter] Desconto: ${product.discount_percentage}% | Preço: R$ ${product.price}`);
      
      // 3. Extrai imagem de alta qualidade
      let imageUrl: string | null = getHighQualityImageUrl(product.thumbnail);
      let cloudinaryUrl: string | null = null;
      
      // Tenta extrair imagem via Playwright se necessário
      if (!imageUrl || imageUrl.includes('-I.')) {
        console.log('[AutoPromoter] Extraindo imagem com Playwright...');
        const extractedImage = await extractProductImage(product.permalink);
        if (extractedImage) {
          imageUrl = extractedImage;
        }
      }
      
      // 4. Upload para Cloudinary
      if (imageUrl) {
        cloudinaryUrl = await uploadImageToCloudinary(imageUrl);
      }
      
      // 5. Posta nas redes
      const postResults = await postToAllPlatforms(product, cloudinaryUrl, options);
      
      // 6. Registra resultado
      results.push({
        product,
        imageUrl,
        cloudinaryUrl,
        posts: postResults,
        timestamp: new Date(),
      });
      
      // Log dos resultados
      for (const post of postResults) {
        const status = post.success ? '✅' : '❌';
        console.log(`  ${status} ${post.platform}: ${post.success ? post.postId : post.error}`);
      }
      
      // Delay entre posts
      if (i < productsToPost.length - 1 && delayBetweenPosts > 0) {
        console.log(`[AutoPromoter] Aguardando ${delayBetweenPosts / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenPosts));
      }
    }
    
    // Fecha navegador
    await closeBrowser();
    
  } catch (error: any) {
    console.error('[AutoPromoter] Erro:', error.message);
    await closeBrowser();
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`[AutoPromoter] Finalizado! ${results.length} produtos processados`);
  console.log('='.repeat(60));
  
  return results;
}

/**
 * Posta um produto específico (por URL ou ID)
 */
export async function postSingleProduct(
  inputUrl: string,
  imageUrl?: string,
  options: Omit<AutoPromoterOptions, 'query' | 'category' | 'maxProducts'> = {}
): Promise<AutoPostResult> {
  console.log('[AutoPromoter] Postando produto único...');
  console.log('[AutoPromoter] URL original:', inputUrl);
  
  // 🔥 CONVERTE AUTOMATICAMENTE PARA LINK DE AFILIADO
  const affiliateUrl = convertToAffiliateUrl(inputUrl);
  console.log('[AutoPromoter] URL de afiliado:', affiliateUrl);
  
  // Tenta extrair dados reais do produto via Playwright
  let product: MLProduct | null = null;
  
  // Usa a URL original para scraping (sem parâmetros de afiliado)
  const scrapingUrl = inputUrl.split('?')[0]; // Remove query params para scraping
  
  if (inputUrl.includes('mercadolivre.com.br') || inputUrl.includes('mercadolivre.com/sec')) {
    console.log('[AutoPromoter] Extraindo dados do produto...');
    product = await extractProductData(scrapingUrl);
  }
  
  // Se não conseguiu extrair, usa dados manuais
  if (!product) {
    console.log('[AutoPromoter] Usando dados manuais...');
    product = {
      id: 'manual',
      title: 'Oferta Especial',
      price: 0,
      original_price: null,
      discount_percentage: 0,
      thumbnail: imageUrl || '',
      permalink: affiliateUrl,
      affiliate_url: affiliateUrl,
      condition: 'new',
      sold_quantity: 0,
      available_quantity: 1,
      shipping_free: false,
      seller: { id: 0, nickname: '' },
      category_id: '',
    };
  }
  
  // Usa a URL do produto como affiliate_url
  product.affiliate_url = affiliateUrl;
  
  // Upload imagem para Cloudinary
  let cloudinaryUrl: string | null = null;
  const imgToUpload = imageUrl || product.thumbnail;
  
  if (imgToUpload) {
    console.log('[AutoPromoter] Fazendo upload da imagem...');
    cloudinaryUrl = await uploadImageToCloudinary(imgToUpload);
  }
  
  // Posta nas redes
  const postResults = await postToAllPlatforms(product, cloudinaryUrl, options);
  
  // Fecha o navegador
  if (browser) {
    await browser.close();
    browser = null;
  }
  
  return {
    product,
    imageUrl: imgToUpload || null,
    cloudinaryUrl,
    posts: postResults,
    timestamp: new Date(),
  };
}

// ==================== EXPORTAÇÕES ====================

export default {
  runAutoPromoter,
  postSingleProduct,
  convertToAffiliateUrl,
};
