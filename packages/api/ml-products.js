const axios = require('axios');
const crypto = require('crypto');

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
  
  // Buscar produtos via products/search com query
  console.log('ðŸ” Buscando produtos no catÃ¡logo ML...');
  
  try {
    const prodResp = await axios.get('https://api.mercadolibre.com/products/search', {
      params: { 
        q: 'smartwatch',
        site_id: 'MLB',
        limit: 5
      },
      headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
    });
    
    console.log('Produtos encontrados:', prodResp.data.results?.length || 0);
    
    if (prodResp.data.results && prodResp.data.results.length > 0) {
      const product = prodResp.data.results[0];
      console.log('Produto:', product.name);
      console.log('ID:', product.id);
      
      // Pegar itens desse produto
      if (product.buy_box_winner) {
        const itemId = product.buy_box_winner.item_id;
        console.log('Item ID:', itemId);
        
        // Buscar detalhes do item
        const itemResp = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, {
          headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
        });
        
        const item = itemResp.data;
        console.log('TÃ­tulo:', item.title);
        console.log('PreÃ§o: R$', item.price);
        
        // Gerar link de afiliado
        const affiliateUrl = `${item.permalink}?matt_word=${MATT_WORD}&matt_tool=${MATT_TOOL}`;
        console.log('Link afiliado:', affiliateUrl);
        
        // Postar no Twitter
        const shortTitle = item.title.length > 60 ? item.title.substring(0, 57) + '...' : item.title;
        const priceFormatted = item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        
        const tweetText = `ðŸ”¥ OFERTA!\n\n${shortTitle}\n\nðŸ’° R$ ${priceFormatted}\n\nðŸ‘‰ ${affiliateUrl}\n\n#PromoÃ§Ã£o #Smartwatch`;
        
        console.log('\nðŸ“ Tweet (' + tweetText.length + ' chars)');
        
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
  } catch (e) {
    console.log('Erro:', e.response?.status, e.response?.data);
  }
}

main().catch(err => {
  console.error('Erro:', err.response?.data || err.message);
});
