const axios = require('axios');
const crypto = require('crypto');
const { chromium } = require('playwright');

// Token vÃ¡lido da conta MANUDASPROMOCOES
const ML_TOKEN = 'APP_USR-6822621568324751-012421-caec448f01234a16b876ec5d23eb1f7e-666498852';
const MATT_TOOL = '77551400';
const MATT_WORD = 'ManuPromo';

// Twitter
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
  
  // 1. Usar Playwright para extrair MLB ID de um produto
  console.log('ðŸ” Abrindo ML para extrair produto...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Ir para um produto especÃ­fico de smartwatch popular
  await page.goto('https://www.mercadolivre.com.br/ofertas', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  // Pegar todos os links da pÃ¡gina
  const pageContent = await page.content();
  
  // Extrair MLB IDs via regex do HTML
  const mlbMatches = pageContent.match(/MLB[\-]?\d{8,12}/gi);
  const uniqueIds = [...new Set(mlbMatches || [])].map(id => id.replace('-', ''));
  
  console.log('   IDs encontrados:', uniqueIds.slice(0, 5).join(', '));
  
  await browser.close();
  
  if (uniqueIds.length === 0) {
    console.log('âŒ Nenhum produto encontrado');
    return;
  }
  
  // 2. Tentar buscar cada ID na API
  for (const itemId of uniqueIds.slice(0, 10)) {
    try {
      console.log('\nðŸ“¦ Testando:', itemId);
      
      const itemResp = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
      });
      
      const product = itemResp.data;
      console.log('   âœ… Encontrado:', product.title.substring(0, 50));
      console.log('   PreÃ§o: R$', product.price);
      
      // Gerar link de afiliado
      const affiliateUrl = `${product.permalink}?matt_word=${MATT_WORD}&matt_tool=${MATT_TOOL}`;
      console.log('\nðŸ”— Link de afiliado:');
      console.log('  ', affiliateUrl);
      
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
      console.log('   URL: https://twitter.com/i/web/status/' + tweetResp.data.data.id);
      
      break;
      
    } catch (e) {
      console.log('   âŒ Erro:', e.response?.status || e.message);
    }
  }
}

main().catch(err => {
  console.error('âŒ Erro geral:', err.response?.data || err.message);
});
