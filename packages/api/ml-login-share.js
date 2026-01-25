require('dotenv').config();
const { chromium } = require('playwright');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const ML_EMAIL = 'declanhygor@gmail.com';
const ML_PASSWORD = '23091830Da*';

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
  console.log('=== ML AFILIADO - LOGIN E COMPARTILHAR ===\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // 1. Verificar se temos cookies salvos
  const cookiesPath = './ml-cookies.json';
  if (fs.existsSync(cookiesPath)) {
    console.log('1. Carregando cookies salvos...');
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
    await context.addCookies(cookies);
  }
  
  // 2. Ir para ML e verificar se esta logado
  console.log('2. Acessando ML...');
  await page.goto('https://www.mercadolivre.com.br', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  
  // Verificar se esta logado
  const isLoggedIn = await page.evaluate(() => {
    const userMenu = document.querySelector('[data-testid="user-menu"], .nav-header-user');
    return userMenu !== null;
  });
  
  if (!isLoggedIn) {
    console.log('3. Fazendo login...');
    
    // Ir para login
    await page.goto('https://www.mercadolivre.com.br/login', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    
    // Preencher email
    const emailInput = await page.$('input[name="user_id"], input[type="email"]');
    if (emailInput) {
      await emailInput.fill(ML_EMAIL);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }
    
    // Preencher senha
    const passwordInput = await page.$('input[name="password"], input[type="password"]');
    if (passwordInput) {
      await passwordInput.fill(ML_PASSWORD);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);
    }
    
    // Salvar cookies
    const cookies = await context.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log('   Cookies salvos!');
  } else {
    console.log('3. Ja esta logado!');
  }
  
  // 4. Ir para pagina de ofertas
  console.log('4. Acessando ofertas...');
  await page.goto('https://www.mercadolivre.com.br/ofertas', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  // 5. Clicar em um produto
  console.log('5. Selecionando produto...');
  const productLink = await page.$('a[href*="MLB"]');
  if (productLink) {
    const href = await productLink.getAttribute('href');
    await page.goto(href, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
  }
  
  // Pegar info do produto
  const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => 'Produto');
  const price = await page.$eval('.andes-money-amount__fraction', el => el.textContent).catch(() => '99');
  
  console.log('   Titulo:', title?.substring(0, 50));
  console.log('   Preco: R$', price);
  
  // 6. Clicar em Compartilhar
  console.log('6. Procurando botao Compartilhar...');
  
  // Scroll para ver o botao
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(1000);
  
  // Procurar pelo texto "Compartilhar"
  const shareBtn = await page.locator('text=Compartilhar').first();
  if (await shareBtn.isVisible()) {
    console.log('   Clicando em Compartilhar...');
    await shareBtn.click();
    await page.waitForTimeout(3000);
    
    // 7. Procurar "Copiar link" na modal
    console.log('7. Procurando Copiar link...');
    
    // Tirar screenshot para debug
    await page.screenshot({ path: 'ml-share-modal.png' });
    console.log('   Screenshot salvo: ml-share-modal.png');
    
    // Procurar botao Copiar link
    const copyLinkBtn = await page.locator('text=Copiar link').first();
    if (await copyLinkBtn.isVisible()) {
      console.log('   Clicando em Copiar link...');
      
      // Antes de clicar, interceptar o clipboard
      await page.evaluate(() => {
        window.copiedLink = null;
        const originalWriteText = navigator.clipboard.writeText;
        navigator.clipboard.writeText = async (text) => {
          window.copiedLink = text;
          return originalWriteText.call(navigator.clipboard, text);
        };
      });
      
      await copyLinkBtn.click();
      await page.waitForTimeout(2000);
      
      // Pegar o link copiado
      const affiliateLink = await page.evaluate(() => window.copiedLink);
      
      if (affiliateLink) {
        console.log('\n=== LINK DE AFILIADO CORRETO ===');
        console.log(affiliateLink);
        
        // 8. Postar no Twitter
        console.log('\n8. Postando no Twitter...');
        
        const timestamp = new Date().toLocaleTimeString('pt-BR');
        const shortTitle = (title || 'Oferta').substring(0, 50);
        
        const tweetText = `OFERTA ${timestamp}

${shortTitle}

R$ ${price}

${affiliateLink}

#Promocao #ML`;
        
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
      } else {
        console.log('   Link nao capturado');
      }
    }
  } else {
    console.log('   Botao Compartilhar nao encontrado');
  }
  
  // Manter aberto
  console.log('\nNavegador aberto por 60 segundos (voce pode completar o 2FA se necessario)...');
  await page.waitForTimeout(60000);
  
  await browser.close();
}

main().catch(console.error);
