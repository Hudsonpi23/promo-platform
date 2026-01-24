/**
 * Script de Teste - Playwright + Twitter/X
 * 
 * Este script:
 * 1. Usa Playwright para buscar uma oferta real do ML
 * 2. Gera um copy atrativo
 * 3. Posta no Twitter/X
 */

import { chromium } from 'playwright';
import crypto from 'crypto';

// Credenciais do Twitter (serão lidas do ambiente)
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || '';
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

interface Offer {
  title: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  imageUrl: string;
  productUrl: string;
}

/**
 * Busca uma oferta do ML usando Playwright
 */
async function scrapeOneOffer(): Promise<Offer | null> {
  console.log('🤖 Iniciando Playwright...');
  
  const browser = await chromium.launch({ 
    headless: false, // Visível para debug
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  
  const page = await context.newPage();
  
  // Remover sinais de automação
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  
  try {
    console.log('🌐 Acessando Mercado Livre Ofertas...');
    
    await page.goto('https://www.mercadolivre.com.br/ofertas', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    
    // Aguardar página carregar
    console.log('⏳ Aguardando página carregar...');
    await page.waitForTimeout(8000);
    
    // Scroll para carregar conteúdo dinâmico
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(2000);
    
    // Tirar screenshot para debug
    await page.screenshot({ path: 'ml-debug.png' });
    console.log('📸 Screenshot salvo em ml-debug.png');
    
    // Debug: contar elementos encontrados
    const debug = await page.evaluate(() => {
      return {
        polyCards: document.querySelectorAll('.poly-card').length,
        promotionItems: document.querySelectorAll('.promotion-item').length,
        andesCards: document.querySelectorAll('.andes-card').length,
        allImages: document.querySelectorAll('img').length,
        allLinks: document.querySelectorAll('a').length,
        title: document.title,
        url: window.location.href,
      };
    });
    
    console.log('🔍 Debug - Elementos encontrados:');
    console.log('   Título página:', debug.title);
    console.log('   URL:', debug.url);
    console.log('   poly-card:', debug.polyCards);
    console.log('   promotion-item:', debug.promotionItems);
    console.log('   andes-card:', debug.andesCards);
    console.log('   Imagens:', debug.allImages);
    console.log('   Links:', debug.allLinks);
    
    console.log('📦 Extraindo oferta...');
    
    // Extrair primeira oferta com desconto bom
    const offer = await page.evaluate(() => {
      // Tentar múltiplos seletores (ML muda layout frequentemente)
      const selectors = [
        '.poly-card',
        '.promotion-item', 
        '.andes-card',
        '[data-testid="item"]',
        '.ui-search-layout__item',
        'li.promotion-item',
        'section.poly-card',
        'article',
      ];
      
      let cards: Element[] = [];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          cards = Array.from(found);
          break;
        }
      }
      
      // Se não encontrou por seletores, tentar links de produtos
      if (cards.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="mercadolivre.com.br"]');
        cards = Array.from(allLinks).map(l => l.closest('div, li, article, section') || l).filter(Boolean) as Element[];
      }
      
      for (const card of cards) {
        try {
          // Título - múltiplos seletores
          let title = '';
          const titleSelectors = ['h2', 'h3', '.poly-component__title', '.promotion-item__title', 'p.promotion-item__title', '[class*="title"]'];
          for (const sel of titleSelectors) {
            const el = card.querySelector(sel);
            if (el?.textContent && el.textContent.trim().length > 10) {
              title = el.textContent.trim();
              break;
            }
          }
          
          if (!title || title.length < 10) continue;
          
          // Preço atual
          let price = 0;
          const priceSelectors = ['.andes-money-amount__fraction', '[class*="price"] span', '.promotion-item__price', '[class*="Price"]'];
          for (const sel of priceSelectors) {
            const el = card.querySelector(sel);
            if (el?.textContent) {
              const num = parseInt(el.textContent.replace(/\D/g, ''));
              if (num > 0) {
                price = num;
                break;
              }
            }
          }
          
          if (price < 30) continue;
          
          // Desconto
          let discount: number | undefined;
          const discountEl = card.querySelector('[class*="discount"], .andes-tag__label');
          if (discountEl?.textContent) {
            const num = parseInt(discountEl.textContent.replace(/\D/g, ''));
            if (num > 0 && num <= 90) discount = num;
          }
          
          // Imagem
          let imageUrl = '';
          const imgEl = card.querySelector('img');
          if (imgEl) {
            imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy') || '';
          }
          
          // Link
          let productUrl = '';
          const linkEl = card.querySelector('a') as HTMLAnchorElement;
          if (linkEl?.href) {
            productUrl = linkEl.href;
          }
          
          // Retornar se tem dados mínimos
          if (title && price > 30) {
            return {
              title: title.substring(0, 150),
              price,
              oldPrice: undefined,
              discount,
              imageUrl: imageUrl || 'https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/5.21.22/mercadolibre/logo__large_plus.png',
              productUrl: productUrl || 'https://www.mercadolivre.com.br/ofertas',
            };
          }
        } catch (e) {
          continue;
        }
      }
      
      return null;
    });
    
    await browser.close();
    
    if (offer) {
      console.log('✅ Oferta encontrada:', offer.title.substring(0, 50) + '...');
    }
    
    return offer;
    
  } catch (error: any) {
    console.error('❌ Erro no scraping:', error.message);
    await browser.close();
    return null;
  }
}

/**
 * Gera assinatura OAuth 1.0a
 */
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(TWITTER_API_SECRET)}&${encodeURIComponent(TWITTER_ACCESS_TOKEN_SECRET)}`;

  return crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');
}

/**
 * Gera header OAuth
 */
function generateOAuthHeader(method: string, url: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(method, url, oauthParams);
  oauthParams.oauth_signature = signature;

  const headerParams = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${headerParams}`;
}

/**
 * Posta no Twitter
 */
async function postToTwitter(text: string): Promise<{ success: boolean; tweetUrl?: string; error?: string }> {
  if (!TWITTER_API_KEY || !TWITTER_ACCESS_TOKEN) {
    return { success: false, error: 'Credenciais do Twitter não configuradas' };
  }
  
  console.log('🐦 Postando no Twitter/X...');
  
  const url = 'https://api.twitter.com/2/tweets';
  
  try {
    const authHeader = generateOAuthHeader('POST', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    
    const data = await response.json() as any;
    
    if (!response.ok) {
      console.error('❌ Erro Twitter:', data);
      return { success: false, error: data.detail || data.title || 'Erro ao postar' };
    }
    
    const tweetId = data.data?.id;
    const tweetUrl = `https://twitter.com/manupromocao/status/${tweetId}`;
    
    console.log('✅ Tweet postado:', tweetUrl);
    
    return { success: true, tweetUrl };
    
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Gera copy do tweet
 */
function generateTweetCopy(offer: Offer): string {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
  
  // Emojis variados para chamar atenção
  const emojis = ['🔥', '💥', '⚡', '🚨', '💰', '🎯'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  
  let text = `${emoji} ${offer.title}\n\n`;
  
  if (offer.oldPrice && offer.oldPrice > offer.price) {
    text += `💸 De ~${formatPrice(offer.oldPrice)}~\n`;
    text += `✅ Por ${formatPrice(offer.price)}`;
    if (offer.discount) {
      text += ` (-${offer.discount}% OFF)`;
    }
  } else {
    text += `💰 Por apenas ${formatPrice(offer.price)}`;
  }
  
  text += '\n\n';
  text += `🛒 Mercado Livre\n`;
  text += `\n🔗 Link na bio ou acesse manupromocao.com`;
  
  // Truncar se necessário
  if (text.length > 280) {
    const titleMaxLen = 280 - (text.length - offer.title.length) - 3;
    const shortTitle = offer.title.substring(0, titleMaxLen) + '...';
    text = text.replace(offer.title, shortTitle);
  }
  
  return text;
}

/**
 * Main - Executa o teste
 */
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('   🧪 TESTE: Playwright + Twitter/X');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  // 1. Buscar oferta com Playwright
  const offer = await scrapeOneOffer();
  
  if (!offer) {
    console.log('❌ Não foi possível extrair oferta do ML');
    process.exit(1);
  }
  
  console.log('');
  console.log('📋 Oferta extraída:');
  console.log('   Título:', offer.title.substring(0, 60) + '...');
  console.log('   Preço:', offer.price);
  if (offer.oldPrice) console.log('   Preço antigo:', offer.oldPrice);
  if (offer.discount) console.log('   Desconto:', offer.discount + '%');
  console.log('   Imagem:', offer.imageUrl.substring(0, 50) + '...');
  console.log('');
  
  // 2. Gerar copy do tweet
  const tweetText = generateTweetCopy(offer);
  
  console.log('📝 Tweet a ser postado:');
  console.log('─────────────────────────────────────────────');
  console.log(tweetText);
  console.log('─────────────────────────────────────────────');
  console.log(`📏 ${tweetText.length}/280 caracteres`);
  console.log('');
  
  // 3. Postar no Twitter
  const result = await postToTwitter(tweetText);
  
  if (result.success) {
    console.log('');
    console.log('🎉 SUCESSO!');
    console.log('🔗 Tweet:', result.tweetUrl);
    console.log('');
  } else {
    console.log('');
    console.log('❌ ERRO:', result.error);
    console.log('');
  }
}

// Executar
main().catch(console.error);
