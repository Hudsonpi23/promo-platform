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
  console.log('=== TESTE SIMPLES - ACESSAR ML ===\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('1. Acessando ML...');
  await page.goto('https://www.mercadolivre.com.br/ofertas', { 
    waitUntil: 'domcontentloaded', 
    timeout: 120000 
  });
  
  console.log('   Pagina carregada!');
  await page.waitForTimeout(5000);
  
  // Tirar screenshot
  await page.screenshot({ path: 'ml-ofertas-screenshot.png' });
  console.log('   Screenshot salvo: ml-ofertas-screenshot.png');
  
  // Pegar URL atual
  const currentUrl = page.url();
  console.log('   URL:', currentUrl);
  
  // Ver se tem produtos
  const products = await page.$$('a[href*="MLB"]');
  console.log('   Produtos encontrados:', products.length);
  
  if (products.length > 0) {
    // Clicar no primeiro
    console.log('\n2. Clicando no primeiro produto...');
    await products[0].click();
    await page.waitForTimeout(5000);
    
    // Tirar screenshot do produto
    await page.screenshot({ path: 'ml-produto-screenshot.png' });
    console.log('   Screenshot salvo: ml-produto-screenshot.png');
    
    // Pegar info
    const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => null);
    const price = await page.$eval('.andes-money-amount__fraction', el => el.textContent).catch(() => null);
    
    console.log('   Titulo:', title?.substring(0, 50) || 'N/A');
    console.log('   Preco: R$', price || 'N/A');
    
    // Ver se tem botao Compartilhar
    console.log('\n3. Procurando botao Compartilhar...');
    
    const pageContent = await page.content();
    const hasCompartilhar = pageContent.includes('Compartilhar');
    console.log('   Texto "Compartilhar" na pagina:', hasCompartilhar);
    
    // Procurar por qualquer botao
    const buttons = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(t => t));
    console.log('   Botoes encontrados:', buttons.slice(0, 10).join(', '));
    
    if (hasCompartilhar) {
      // Tentar clicar
      const shareLocator = page.locator('text=Compartilhar').first();
      if (await shareLocator.count() > 0) {
        console.log('\n4. Clicando em Compartilhar...');
        await shareLocator.click();
        await page.waitForTimeout(3000);
        
        // Screenshot da modal
        await page.screenshot({ path: 'ml-modal-screenshot.png' });
        console.log('   Screenshot da modal salvo');
        
        // Ver conteudo da modal
        const modalContent = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"], .andes-modal');
          return modal ? modal.innerHTML.substring(0, 500) : null;
        });
        
        if (modalContent) {
          console.log('   Modal encontrada!');
          
          // Procurar Copiar link
          const copyLink = page.locator('text=Copiar link').first();
          if (await copyLink.count() > 0) {
            console.log('   Encontrado "Copiar link"');
          }
        }
      }
    }
  }
  
  console.log('\nNavegador aberto por 30 segundos...');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

main().catch(err => console.error('Erro:', err.message));
