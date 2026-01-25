require('dotenv').config();
const { chromium } = require('playwright');
const axios = require('axios');
const crypto = require('crypto');

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;

function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function generateOAuthHeader(method, url) {
  const oauthParams = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: '1.0'
  };
  oauthParams.oauth_signature = generateOAuthSignature(method, url, oauthParams, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN_SECRET);
  return 'OAuth ' + Object.keys(oauthParams).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`).join(', ');
}

async function main() {
  console.log('=== GERANDO LINK DE AFILIADO VIA COMPARTILHAR ===\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Interceptar requisicoes para pegar o link de afiliado
  let affiliateLink = null;
  
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('social') || url.includes('share') || url.includes('affiliate')) {
      try {
        const text = await response.text();
        if (text.includes('mercadolivre.com.br')) {
          console.log('   [Interceptado]', url.substring(0, 80));
        }
      } catch {}
    }
  });
  
  // 1. Ir para pagina de ofertas
  console.log('1. Acessando ofertas do ML...');
  await page.goto('https://www.mercadolivre.com.br/ofertas', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  
  // 2. Scroll para carregar produtos
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1000);
  
  // 3. Encontrar um produto
  console.log('2. Procurando produto...');
  
  // Procurar por um link de produto com desconto
  const products = await page.$$eval('a[href*="MLB"]', links => {
    return links.slice(0, 5).map(a => ({
      href: a.href,
      text: a.textContent?.trim().substring(0, 50)
    }));
  });
  
  console.log('   Produtos encontrados:', products.length);
  
  if (products.length > 0) {
    // Clicar no primeiro produto
    console.log('3. Acessando produto:', products[0].href.substring(0, 60));
    await page.goto(products[0].href, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    
    // Pegar info do produto
    const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => 'Produto');
    const price = await page.$eval('.andes-money-amount__fraction', el => el.textContent).catch(() => '99');
    const image = await page.$eval('.ui-pdp-image', el => el.src).catch(() => null);
    
    console.log('   Titulo:', title?.substring(0, 50));
    console.log('   Preco: R$', price);
    
    // 4. Procurar e clicar no botao Compartilhar
    console.log('4. Procurando botao Compartilhar...');
    
    // Tentar varios seletores
    const shareSelectors = [
      'button[aria-label*="ompartilhar"]',
      'button:has-text("Compartilhar")',
      '[data-testid*="share"]',
      '.ui-pdp-action-modal button',
      'button.andes-button--quiet'
    ];
    
    let shareBtn = null;
    for (const selector of shareSelectors) {
      shareBtn = await page.$(selector);
      if (shareBtn) {
        console.log('   Encontrado com selector:', selector);
        break;
      }
    }
    
    if (shareBtn) {
      await shareBtn.click();
      await page.waitForTimeout(2000);
      
      // 5. Procurar modal de compartilhamento
      console.log('5. Procurando modal de compartilhamento...');
      
      // Tentar encontrar o link na modal
      const modalContent = await page.evaluate(() => {
        // Procurar por modais
        const modals = document.querySelectorAll('[role="dialog"], .andes-modal, .ui-pdp-share');
        for (const modal of modals) {
          const html = modal.innerHTML;
          // Procurar por links de afiliado
          const linkMatch = html.match(/https:\/\/[^"'\s]+mercadolivre[^"'\s]+/);
          if (linkMatch) {
            return linkMatch[0];
          }
        }
        
        // Procurar por input com link
        const inputs = document.querySelectorAll('input[type="text"], input[readonly]');
        for (const input of inputs) {
          if (input.value && input.value.includes('mercadolivre')) {
            return input.value;
          }
        }
        
        // Procurar por qualquer link de social
        const socialLinks = document.querySelectorAll('a[href*="social"], a[href*="share"]');
        if (socialLinks.length > 0) {
          return socialLinks[0].href;
        }
        
        return null;
      });
      
      if (modalContent) {
        affiliateLink = modalContent;
        console.log('\n=== LINK DE AFILIADO ENCONTRADO ===');
        console.log(affiliateLink);
      } else {
        // Tentar clicar em "Copiar link"
        console.log('   Procurando botao Copiar link...');
        
        const copyBtn = await page.$('button:has-text("Copiar"), [aria-label*="Copiar"]');
        if (copyBtn) {
          // Interceptar o click para pegar o link
          affiliateLink = await page.evaluate(() => {
            // Procurar por elemento com o link
            const shareContent = document.querySelector('.share-content, .andes-modal__content');
            if (shareContent) {
              const links = shareContent.querySelectorAll('a, input');
              for (const el of links) {
                const value = el.href || el.value;
                if (value && value.includes('mercadolivre')) {
                  return value;
                }
              }
            }
            return null;
          });
        }
      }
    } else {
      console.log('   Botao Compartilhar nao encontrado');
      // Usar URL atual como fallback
      affiliateLink = page.url();
    }
    
    // Se nao encontrou link de afiliado, usar URL do produto
    if (!affiliateLink) {
      affiliateLink = page.url();
      console.log('   Usando URL do produto:', affiliateLink);
    }
    
    // 6. Postar no Twitter
    if (affiliateLink && TWITTER_API_KEY) {
      console.log('\n6. Postando no Twitter...');
      
      const timestamp = new Date().toLocaleTimeString('pt-BR');
      const shortTitle = (title || 'Oferta').substring(0, 50);
      
      const tweetText = `OFERTA ML ${timestamp}

${shortTitle}

R$ ${price}

${affiliateLink}

#Promocao`;
      
      console.log('\n   Tweet:');
      console.log(tweetText);
      
      const twitterUrl = 'https://api.twitter.com/2/tweets';
      const authHeader = generateOAuthHeader('POST', twitterUrl);
      
      try {
        const tweetResp = await axios.post(twitterUrl, { text: tweetText }, {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('\n=== POSTADO COM SUCESSO! ===');
        console.log('Tweet ID:', tweetResp.data.data.id);
      } catch (err) {
        console.log('Erro Twitter:', err.response?.data);
      }
    }
  }
  
  // Manter aberto para ver
  console.log('\nNavegador aberto por 20 segundos...');
  await page.waitForTimeout(20000);
  
  await browser.close();
}

main().catch(console.error);
