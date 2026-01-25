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
  
  // 1. Buscar produtos no catÃ¡logo
  console.log('ðŸ” Buscando produtos no catÃ¡logo ML...');
  
  const prodResp = await axios.get('https://api.mercadolibre.com/products/search', {
    params: { 
      q: 'fone bluetooth',
      site_id: 'MLB',
      limit: 10
    },
    headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
  });
  
  console.log('   Produtos encontrados:', prodResp.data.results?.length || 0);
  
  // 2. Pegar detalhes do primeiro produto
  const productId = prodResp.data.results[0].id;
  console.log('   Product ID:', productId);
  
  // Buscar detalhes do produto (para pegar um item ID)
  const productDetailResp = await axios.get(`https://api.mercadolibre.com/products/${productId}`, {
    headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
  });
  
  const productDetail = productDetailResp.data;
  console.log('   Nome:', productDetail.name);
  
  // Ver se tem buy_box_winner ou pegar de outra forma
  let itemId = null;
  let price = 0;
  let permalink = null;
  
  if (productDetail.buy_box_winner) {
    itemId = productDetail.buy_box_winner.item_id;
    price = productDetail.buy_box_winner.price;
    console.log('   Item ID (buy_box):', itemId);
  }
  
  // Se nÃ£o tem buy_box, buscar na API de items pelo product_catalog_id
  if (!itemId) {
    console.log('   Buscando item relacionado ao produto...');
    
    // Tentar pegar via API de search com product_id
    try {
      const searchResp = await axios.get(`https://api.mercadolibre.com/items`, {
        params: { 
          ids: productDetail.main_features?.[0]?.id
        },
        headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
      });
      console.log('   Items:', searchResp.data);
    } catch (e) {
      console.log('   Busca por items erro:', e.response?.status);
    }
    
    // Usar os dados do prÃ³prio catÃ¡logo
    if (productDetail.pictures && productDetail.pictures.length > 0) {
      // Criar um link direto para o catÃ¡logo
      permalink = `https://www.mercadolivre.com.br/p/${productId}`;
      price = productDetail.buy_box_winner?.price || 99.90;
    }
  } else {
    // Buscar detalhes do item
    const itemResp = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
    });
    
    permalink = itemResp.data.permalink;
    price = itemResp.data.price;
  }
  
  if (!permalink) {
    permalink = `https://www.mercadolivre.com.br/p/${productId}`;
  }
  
  console.log('\nðŸ“¦ Produto selecionado:');
  console.log('   Nome:', productDetail.name);
  console.log('   PreÃ§o: R$', price);
  console.log('   Permalink:', permalink);
  
  // 3. Gerar link de afiliado
  const affiliateUrl = `${permalink}?matt_word=${MATT_WORD}&matt_tool=${MATT_TOOL}`;
  console.log('\nðŸ”— Link de afiliado:');
  console.log('  ', affiliateUrl);
  
  // 4. Criar tweet
  const shortTitle = productDetail.name.length > 60 ? productDetail.name.substring(0, 57) + '...' : productDetail.name;
  const priceFormatted = price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  
  let tweetText = `ðŸ”¥ OFERTA!\n\n${shortTitle}\n\nðŸ’° R$ ${priceFormatted}\n\nðŸ‘‰ ${affiliateUrl}\n\n#PromoÃ§Ã£o`;
  
  if (tweetText.length > 280) {
    tweetText = `ðŸ”¥ OFERTA!\n\n${shortTitle}\n\nðŸ’° R$ ${priceFormatted}\n\n${affiliateUrl}`;
  }
  
  console.log('\nðŸ“ Tweet (' + tweetText.length + ' chars):');
  console.log(tweetText);
  
  // 5. Postar no Twitter
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
}

main().catch(err => {
  console.error('âŒ Erro:', err.response?.data || err.message);
});
