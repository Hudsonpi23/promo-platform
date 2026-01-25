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
  console.log('=== CAPTURAR LINK DE AFILIADO ===\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('1. Acessando ML ofertas...');
  await page.goto('https://www.mercadolivre.com.br/ofertas', { 
    waitUntil: 'domcontentloaded', 
    timeout: 120000 
  });
  await page.waitForTimeout(5000);
  
  console.log('   URL:', page.url());
  
  // Pegar links
  const productLinks = await page.$$eval('a[href*="MLB"]', links => 
    links.slice(0, 5).map(a => a.href)
  );
  console.log('2. Produtos encontrados:', productLinks.length);
  
  if (productLinks.length === 0) {
    console.log('   Nenhum produto encontrado!');
    await browser.close();
    return;
  }
  
  // Ir para o primeiro produto
  console.log('3. Acessando:', productLinks[0].substring(0, 60));
  await page.goto(productLinks[0], { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  // Pegar info
  const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => 'Produto ML');
  const price = await page.$eval('.andes-money-amount__fraction', el => el.textContent).catch(() => '99');
  
  console.log('   Titulo:', title?.substring(0, 50));
  console.log('   Preco: R$', price);
  
  // Verificar se tem Compartilhar
  const html = await page.content();
  console.log('4. Tem "Compartilhar":', html.includes('Compartilhar'));
  
  // Clicar em Compartilhar
  try {
    const shareBtn = page.locator('button:has-text("Compartilhar")').first();
    console.log('   Clicando em Compartilhar...');
    await shareBtn.click({ timeout: 5000 });
    await page.waitForTimeout(3000);
    console.log('   Modal aberta!');
    
    // Procurar link na modal
    const modalHtml = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      return modal ? modal.innerHTML : document.body.innerHTML;
    });
    
    // Extrair link de social
    const socialLinkMatch = modalHtml.match(/https:\/\/www\.mercadolivre\.com\.br\/social\/[^"'\s<>]+/);
    
    if (socialLinkMatch) {
      const affiliateLink = socialLinkMatch[0];
      console.log('\n=== LINK DE AFILIADO ===');
      console.log(affiliateLink);
      
      // Postar no Twitter
      console.log('\n5. Postando no Twitter...');
      
      const timestamp = new Date().toLocaleTimeString('pt-BR');
      const shortTitle = title.substring(0, 45);
      
      const tweetText = `OFERTA ${timestamp}

${shortTitle}

R$ ${price}

${affiliateLink}

#Promocao`;
      
      console.log('\nTweet (' + tweetText.length + ' chars):');
      console.log(tweetText);
      
      if (tweetText.length > 280) {
        console.log('\n[!] Tweet muito longo, encurtando...');
      }
      
      const twitterUrl = 'https://api.twitter.com/2/tweets';
      const authHeader = generateOAuthHeader('POST', twitterUrl);
      
      const tweetResp = await axios.post(twitterUrl, { text: tweetText }, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('\n=== POSTADO COM SUCESSO! ===');
      console.log('Tweet ID:', tweetResp.data.data.id);
      console.log('URL: https://twitter.com/i/web/status/' + tweetResp.data.data.id);
    } else {
      console.log('   Link de social nao encontrado na modal');
      
      // Tentar clicar em Copiar link
      const copyBtn = page.locator('text=Copiar link').first();
      if (await copyBtn.count() > 0) {
        console.log('   Encontrou botao Copiar link');
      }
    }
  } catch (err) {
    console.log('   Erro ao clicar em Compartilhar:', err.message);
  }
  
  console.log('\nNavegador aberto por 30 segundos...');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

main().catch(err => console.error('Erro geral:', err.message));
