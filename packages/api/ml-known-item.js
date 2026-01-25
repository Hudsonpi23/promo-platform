const axios = require('axios');
const crypto = require('crypto');

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
  
  // Buscar tendÃªncias do ML
  console.log('ðŸ” Buscando tendÃªncias do ML...');
  const trendsResp = await axios.get('https://api.mercadolibre.com/trends/MLB', {
    headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
  });
  
  // Pegar a keyword da primeira tendÃªncia
  const trend = trendsResp.data[0];
  console.log('   Trend:', trend.keyword);
  
  // Agora fazer uma busca com essa keyword
  // A busca estÃ¡ bloqueada, entÃ£o vou usar a API de items pelo seller
  
  // Tentar via API de seller
  console.log('\nðŸ“¦ Buscando items via API de seller...');
  
  // Usar o prÃ³prio user_id para ver se tem items
  const userId = 666498852;
  
  try {
    const itemsResp = await axios.get(`https://api.mercadolibre.com/users/${userId}/items/search`, {
      headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
    });
    console.log('   Items do usuÃ¡rio:', itemsResp.data);
  } catch (e) {
    console.log('   Erro ao buscar items do usuÃ¡rio:', e.response?.status);
  }
  
  // Tentar via visited items
  console.log('\nðŸ“¦ Tentando visited items...');
  try {
    const visitedResp = await axios.get(`https://api.mercadolibre.com/users/${userId}/bookmarks`, {
      headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
    });
    console.log('   Bookmarks:', visitedResp.data);
  } catch (e) {
    console.log('   Erro:', e.response?.status, e.response?.data?.message);
  }
  
  // Usar ID conhecido de um produto popular
  console.log('\nðŸ“¦ Usando produto conhecido...');
  
  // Vou usar um produto popular - Moto G
  const testIds = ['MLB2844656704', 'MLB3589875174', 'MLB4025538674'];
  
  for (const itemId of testIds) {
    try {
      const itemResp = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
      });
      
      const product = itemResp.data;
      console.log('   âœ… Encontrado:', product.title.substring(0, 50));
      console.log('   PreÃ§o: R$', product.price);
      console.log('   ID:', product.id);
      
      // Gerar link de afiliado
      const affiliateUrl = `${product.permalink}?matt_word=${MATT_WORD}&matt_tool=${MATT_TOOL}`;
      console.log('\nðŸ”— Link de afiliado MANUDASPROMOCOES:');
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
      console.log('   Item', itemId, 'nÃ£o encontrado:', e.response?.status);
    }
  }
}

main().catch(err => {
  console.error('âŒ Erro:', err.response?.data || err.message);
});
