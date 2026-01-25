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
  console.log('=== CAPTURAR LINK VIA REDE ===\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Interceptar todas as requisicoes
  let capturedLink = null;
  
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('social') || url.includes('share') || url.includes('affiliate') || url.includes('deep_link')) {
      console.log('[REDE] Resposta:', url.substring(0, 80));
      try {
        const body = await response.text();
        if (body.includes('mercadolivre.com.br/social')) {
          const match = body.match(/https:\/\/www\.mercadolivre\.com\.br\/social\/[^"'\s<>\\]+/);
          if (match) {
            capturedLink = match[0];
            console.log('[REDE] LINK CAPTURADO:', capturedLink);
          }
        }
      } catch {}
    }
  });
  
  console.log('1. Acessando ML ofertas...');
  await page.goto('https://www.mercadolivre.com.br/ofertas', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  const productLinks = await page.$$eval('a[href*="MLB"]', links => links.slice(0, 5).map(a => a.href));
  console.log('2. Produtos encontrados:', productLinks.length);
  
  if (productLinks.length === 0) {
    await browser.close();
    return;
  }
  
  console.log('3. Acessando produto...');
  await page.goto(productLinks[0], { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => 'Produto');
  const price = await page.$eval('.andes-money-amount__fraction', el => el.textContent).catch(() => '99');
  
  console.log('   Titulo:', title?.substring(0, 50));
  console.log('   Preco: R$', price);
  
  // Clicar em Compartilhar
  console.log('4. Clicando em Compartilhar...');
  try {
    await page.locator('button:has-text("Compartilhar")').first().click({ timeout: 5000 });
    await page.waitForTimeout(3000);
    
    // Clicar em Copiar link
    console.log('5. Clicando em Copiar link...');
    const copyBtn = page.locator('text=Copiar link').first();
    if (await copyBtn.count() > 0) {
      await copyBtn.click({ timeout: 5000 });
      await page.waitForTimeout(3000);
      
      console.log('   Aguardando captura do link...');
    }
  } catch (err) {
    console.log('   Erro:', err.message);
  }
  
  // Verificar se capturou
  if (capturedLink) {
    console.log('\n=== LINK DE AFILIADO CAPTURADO ===');
    console.log(capturedLink);
    
    // Postar no Twitter
    console.log('\n6. Postando no Twitter...');
    
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const shortTitle = title.substring(0, 45);
    
    const tweetText = `OFERTA ${timestamp}

${shortTitle}

R$ ${price}

${capturedLink}

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
    } catch (err) {
      console.log('Erro Twitter:', err.response?.data);
    }
  } else {
    console.log('\n[!] Link nao foi capturado via rede');
    console.log('    Pode ser necessario fazer LOGIN no ML');
  }
  
  console.log('\nNavegador aberto por 30 segundos...');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

main().catch(console.error);
