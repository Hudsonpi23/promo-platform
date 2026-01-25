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
  console.log('ðŸ” Usando API do ML com token da conta MANUDASPROMOCOES...\n');
  
  // 1. Verificar usuÃ¡rio
  const userResp = await axios.get('https://api.mercadolibre.com/users/me', {
    headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
  });
  console.log('âœ… Conta:', userResp.data.nickname);
  console.log('   ID:', userResp.data.id);
  
  // 2. Buscar produtos com desconto via API
  console.log('\nðŸ” Buscando produtos com desconto...');
  
  const searchResp = await axios.get('https://api.mercadolibre.com/sites/MLB/search', {
    params: {
      q: 'celular',
      sort: 'relevance',
      limit: 20
    },
    headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
  });
  
  // Filtrar produtos com 20%+ de desconto
  const productsWithDiscount = searchResp.data.results.filter(item => {
    if (item.original_price && item.price && item.original_price > item.price) {
      const discount = ((item.original_price - item.price) / item.original_price) * 100;
      return discount >= 20;
    }
    return false;
  });
  
  console.log(`   Encontrados ${productsWithDiscount.length} produtos com 20%+ OFF`);
  
  if (productsWithDiscount.length === 0) {
    console.log('   Buscando qualquer produto...');
    // Pegar o primeiro produto disponÃ­vel
    if (searchResp.data.results.length > 0) {
      productsWithDiscount.push(searchResp.data.results[0]);
    }
  }
  
  const product = productsWithDiscount[0];
  if (!product) {
    console.log('âŒ Nenhum produto encontrado');
    return;
  }
  
  const discount = product.original_price 
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;
  
  console.log('\nðŸ“¦ Produto selecionado:');
  console.log('   TÃ­tulo:', product.title.substring(0, 60) + '...');
  console.log('   PreÃ§o: R$', product.price);
  if (product.original_price) console.log('   Original: R$', product.original_price);
  console.log('   Desconto:', discount + '%');
  console.log('   ID:', product.id);
  
  // 3. Gerar link de afiliado
  const affiliateUrl = `${product.permalink}?matt_word=${MATT_WORD}&matt_tool=${MATT_TOOL}`;
  console.log('\nðŸ”— Link de afiliado:');
  console.log('  ', affiliateUrl);
  
  // 4. Criar tweet
  const shortTitle = product.title.length > 70 ? product.title.substring(0, 67) + '...' : product.title;
  const priceFormatted = product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  
  let tweetText = `ðŸ”¥ ${discount > 0 ? discount + '% OFF!' : 'OFERTA!'}\n\n${shortTitle}\n\nðŸ’° R$ ${priceFormatted}\n\nðŸ‘‰ ${affiliateUrl}\n\n#PromoÃ§Ã£o #Ofertas`;
  
  // Verificar tamanho
  if (tweetText.length > 280) {
    const shorterTitle = product.title.substring(0, 50) + '...';
    tweetText = `ðŸ”¥ ${discount}% OFF!\n\n${shorterTitle}\n\nðŸ’° R$ ${priceFormatted}\n\n${affiliateUrl}`;
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
  
  console.log('âœ… POSTADO COM SUCESSO!');
  console.log('   Tweet ID:', tweetResp.data.data.id);
  console.log('   URL: https://twitter.com/i/web/status/' + tweetResp.data.data.id);
}

main().catch(err => {
  console.error('âŒ Erro:', err.response?.data || err.message);
});
