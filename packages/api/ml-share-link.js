require('dotenv').config();
const { chromium } = require('playwright');
const axios = require('axios');
const crypto = require('crypto');

const ML_TOKEN = 'APP_USR-6822621568324751-012421-caec448f01234a16b876ec5d23eb1f7e-666498852';

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
  console.log('=== GERANDO LINK DE AFILIADO CORRETO ===\n');
  
  // 1. Abrir navegador
  console.log('1. Abrindo navegador...');
  const browser = await chromium.launch({ headless: false }); // Visivel para debug
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // 2. Ir para pagina de afiliados do ML
  console.log('2. Acessando pagina de ofertas do ML...');
  await page.goto('https://www.mercadolivre.com.br/ofertas', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  // 3. Encontrar um produto com botao "Compartilhar"
  console.log('3. Procurando produtos com Compartilhar...');
  
  // Procurar por botoes de compartilhar
  const shareButtons = await page.$$('button:has-text("Compartilhar"), [data-testid="share-button"], .share-button');
  console.log('   Botoes encontrados:', shareButtons.length);
  
  if (shareButtons.length === 0) {
    // Tentar clicar em um produto primeiro
    console.log('   Clicando em um produto...');
    const productLink = await page.$('a[href*="MLB"]');
    if (productLink) {
      await productLink.click();
      await page.waitForTimeout(3000);
      
      // Agora procurar o botao Compartilhar na pagina do produto
      console.log('   Procurando botao Compartilhar na pagina do produto...');
      
      // Pegar titulo e preco
      const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => 'Produto');
      const price = await page.$eval('.andes-money-amount__fraction', el => el.textContent).catch(() => '0');
      
      console.log('   Titulo:', title?.substring(0, 50));
      console.log('   Preco: R$', price);
      
      // Procurar botao de compartilhar
      const shareBtn = await page.$('button[aria-label*="Compartilhar"], button:has-text("Compartilhar"), [data-testid="action-share"]');
      
      if (shareBtn) {
        console.log('4. Clicando em Compartilhar...');
        await shareBtn.click();
        await page.waitForTimeout(2000);
        
        // Procurar opcao "Copiar link"
        console.log('5. Procurando opcao Copiar link...');
        const copyLinkBtn = await page.$('button:has-text("Copiar link"), [data-testid="copy-link"]');
        
        if (copyLinkBtn) {
          // Interceptar a area de transferencia
          const clipboardText = await page.evaluate(async () => {
            // Esperar o botao e clicar
            const btn = document.querySelector('button:has-text("Copiar link")');
            if (btn) btn.click();
            
            // Tentar ler da area de transferencia
            try {
              return await navigator.clipboard.readText();
            } catch {
              return null;
            }
          });
          
          if (clipboardText) {
            console.log('\n=== LINK DE AFILIADO CORRETO ===');
            console.log(clipboardText);
          }
        }
      } else {
        console.log('   Botao Compartilhar nao encontrado');
        
        // Pegar a URL atual e mostrar
        const currentUrl = page.url();
        console.log('   URL atual:', currentUrl);
      }
    }
  }
  
  // Manter o navegador aberto por 30 segundos para voce ver
  console.log('\nNavegador aberto por 30 segundos para visualizacao...');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

main().catch(err => {
  console.error('Erro:', err.message);
});
