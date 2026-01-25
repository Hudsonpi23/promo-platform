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
  console.log('=== CAPTURAR LINK DE AFILIADO E POSTAR ===\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();
  
  // Interceptar clipboard
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  
  console.log('1. Acessando ML ofertas...');
  await page.goto('https://www.mercadolivre.com.br/ofertas', { 
    waitUntil: 'domcontentloaded', 
    timeout: 120000 
  });
  await page.waitForTimeout(5000);
  
  // Clicar no primeiro produto
  console.log('2. Selecionando produto...');
  const products = await page.$$('a[href*="MLB"]');
  
  if (products.length > 0) {
    await products[0].click();
    await page.waitForTimeout(5000);
    
    // Pegar info
    const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => 'Produto');
    const price = await page.$eval('.andes-money-amount__fraction', el => el.textContent).catch(() => '99');
    
    console.log('   Titulo:', title?.substring(0, 50));
    console.log('   Preco: R$', price);
    
    // Clicar em Compartilhar
    console.log('3. Clicando em Compartilhar...');
    const shareLocator = page.locator('text=Compartilhar').first();
    await shareLocator.click();
    await page.waitForTimeout(3000);
    
    // Agora clicar em "Copiar link"
    console.log('4. Clicando em Copiar link...');
    
    // Interceptar a chamada de clipboard antes de clicar
    let affiliateLink = null;
    
    await page.evaluate(() => {
      window.capturedClipboard = null;
      const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = async (text) => {
        window.capturedClipboard = text;
        console.log('Clipboard captured:', text);
        return originalWriteText(text);
      };
    });
    
    // Clicar em Copiar link
    const copyLinkBtn = page.locator('text=Copiar link').first();
    await copyLinkBtn.click();
    await page.waitForTimeout(2000);
    
    // Pegar o link capturado
    affiliateLink = await page.evaluate(() => window.capturedClipboard);
    
    // Se nao conseguiu via clipboard, tentar via input ou href
    if (!affiliateLink) {
      console.log('   Tentando capturar de outra forma...');
      
      affiliateLink = await page.evaluate(() => {
        // Procurar em inputs
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          if (inp.value && inp.value.includes('mercadolivre.com.br/social')) {
            return inp.value;
          }
        }
        
        // Procurar em links
        const links = document.querySelectorAll('a');
        for (const link of links) {
          if (link.href && link.href.includes('/social/')) {
            return link.href;
          }
        }
        
        // Procurar no HTML por URLs de social
        const html = document.body.innerHTML;
        const match = html.match(/https:\/\/www\.mercadolivre\.com\.br\/social\/[^"'\s]+/);
        return match ? match[0] : null;
      });
    }
    
    if (affiliateLink) {
      console.log('\n=== LINK DE AFILIADO CAPTURADO ===');
      console.log(affiliateLink);
      
      // Postar no Twitter
      console.log('\n5. Postando no Twitter...');
      
      const timestamp = new Date().toLocaleTimeString('pt-BR');
      const shortTitle = title.substring(0, 50);
      
      const tweetText = `OFERTA ${timestamp}

${shortTitle}

R$ ${price}

${affiliateLink.substring(0, 100)}

#Promocao`;
      
      console.log('\nTweet:');
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
        console.log('URL: https://twitter.com/i/web/status/' + tweetResp.data.data.id);
      } catch (err) {
        console.log('Erro Twitter:', err.response?.data);
      }
    } else {
      console.log('   Nao foi possivel capturar o link');
    }
  }
  
  await browser.close();
  console.log('\nFim!');
}

main().catch(err => console.error('Erro:', err.message));
