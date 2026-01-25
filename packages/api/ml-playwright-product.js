const axios = require('axios');
const crypto = require('crypto');
const { chromium } = require('playwright');

const ML_TOKEN = 'APP_USR-6822621568324751-012421-caec448f01234a16b876ec5d23eb1f7e-666498852';
const MATT_TOOL = '77551400';
const MATT_WORD = 'ManuPromo';

const TWITTER_API_KEY = 'acBLzFYKSv6CGr2GNbPdA1Q8J';
const TWITTER_API_SECRET = 'FMhZAUJGrSoycaFvYIE8rmIF7wS65tDqI7EpFMIgd1xEGigWSV';
const TWITTER_ACCESS_TOKEN = '2013613059290378240-IZ2KyuNn6wuduFATWDWYZV3Wpn57aj';
const TWITTER_ACCESS_TOKEN_SECRET = 'Cp24Cad5OsKpbElFpiX6FpURuGujFHj7W4tMldL3V8o46';

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
  console.log('ðŸ” Conta: MANUDASPROMOCOES\n');
  
  // Ir direto para um produto conhecido via Playwright
  console.log('ðŸ” Buscando produto via Playwright...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Ir para busca de smartwatch
  await page.goto('https://lista.mercadolivre.com.br/fone-bluetooth', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  // Clicar no primeiro resultado
  const firstProductLink = await page.$('a[href*="/p/MLB"]');
  
  if (firstProductLink) {
    const href = await firstProductLink.getAttribute('href');
    console.log('   Link encontrado:', href);
    
    // Ir para a pÃ¡gina do produto
    await page.goto(href, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    // Extrair dados da pÃ¡gina
    const url = page.url();
    console.log('   URL:', url);
    
    // Extrair MLB ID da URL
    const mlbMatch = url.match(/MLB[\-]?(\d+)/i);
    if (mlbMatch) {
      const itemId = 'MLB' + mlbMatch[1];
      console.log('   Item ID:', itemId);
      
      // Extrair tÃ­tulo e preÃ§o da pÃ¡gina
      const title = await page.$eval('h1', el => el.textContent?.trim()).catch(() => null);
      const price = await page.$eval('.andes-money-amount__fraction', el => el.textContent?.trim()).catch(() => null);
      
      console.log('   TÃ­tulo:', title?.substring(0, 50));
      console.log('   PreÃ§o: R$', price);
      
      await browser.close();
      
      // Tentar buscar via API
      console.log('\nðŸ“¦ Buscando via API ML...');
      
      try {
        const itemResp = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, {
          headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
        });
        
        const product = itemResp.data;
        
        // Gerar link de afiliado
        const affiliateUrl = `${product.permalink}?matt_word=${MATT_WORD}&matt_tool=${MATT_TOOL}`;
        console.log('ðŸ”— Link de afiliado:', affiliateUrl);
        
        // Criar tweet
        const shortTitle = product.title.length > 60 ? product.title.substring(0, 57) + '...' : product.title;
        const priceFormatted = product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        
        let tweetText = `ðŸ”¥ OFERTA!\n\n${shortTitle}\n\nðŸ’° R$ ${priceFormatted}\n\nðŸ‘‰ ${affiliateUrl}\n\n#PromoÃ§Ã£o`;
        
        if (tweetText.length > 280) {
          tweetText = `ðŸ”¥ OFERTA!\n\n${shortTitle}\n\nðŸ’° R$ ${priceFormatted}\n\n${affiliateUrl}`;
        }
        
        console.log('\nðŸ“ Tweet (' + tweetText.length + ' chars):');
        console.log(tweetText);
        
        // Postar no Twitter
        console.log('\nðŸ¦ Postando no Twitter...');
        
        const twitterUrl = 'https://api.twitter.com/2/tweets';
        const authHeader = generateOAuthHeader('POST', twitterUrl);
        
        const tweetResp = await axios.post(twitterUrl, { text: tweetText }, {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('\nâœ… POSTADO COM SUCESSO!');
        console.log('   Tweet ID:', tweetResp.data.data.id);
        
      } catch (e) {
        console.log('âŒ Erro API:', e.response?.status, e.response?.data?.message);
        
        // Se a API falhar, usar os dados do Playwright
        if (title && price) {
          const affiliateUrl = `${url}?matt_word=${MATT_WORD}&matt_tool=${MATT_TOOL}`;
          const shortTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
          
          let tweetText = `ðŸ”¥ OFERTA!\n\n${shortTitle}\n\nðŸ’° R$ ${price}\n\nðŸ‘‰ ${affiliateUrl}\n\n#PromoÃ§Ã£o`;
          
          console.log('\nðŸ“ Tweet (via Playwright):');
          console.log(tweetText);
          
          // Postar
          const twitterUrl = 'https://api.twitter.com/2/tweets';
          const authHeader = generateOAuthHeader('POST', twitterUrl);
          
          const tweetResp = await axios.post(twitterUrl, { text: tweetText }, {
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('\nâœ… POSTADO COM SUCESSO!');
          console.log('   Tweet ID:', tweetResp.data.data.id);
        }
      }
      
      return;
    }
  }
  
  await browser.close();
  console.log('âŒ Nenhum produto encontrado');
}

main().catch(err => {
  console.error('âŒ Erro:', err.response?.data || err.message);
});
