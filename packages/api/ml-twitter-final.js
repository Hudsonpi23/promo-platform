require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const ML_TOKEN = 'APP_USR-6822621568324751-012421-caec448f01234a16b876ec5d23eb1f7e-666498852';
const MATT_TOOL = '77551400';
const MATT_WORD = 'ManuPromo';

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
  console.log('Conta ML: MANUDASPROMOCOES');
  console.log('Twitter credenciais:', TWITTER_API_KEY ? 'OK' : 'FALHA');
  
  // 1. Buscar produtos no catalogo ML
  console.log('\nBuscando produtos no catalogo ML...');
  
  const prodResp = await axios.get('https://api.mercadolibre.com/products/search', {
    params: { 
      q: 'smartwatch',
      site_id: 'MLB',
      limit: 5
    },
    headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
  });
  
  const product = prodResp.data.results[0];
  console.log('Produto:', product.name.substring(0, 50));
  
  // 2. Gerar link de afiliado
  const permalink = `https://www.mercadolivre.com.br/p/${product.id}`;
  const affiliateUrl = `${permalink}?matt_word=${MATT_WORD}&matt_tool=${MATT_TOOL}`;
  
  // 3. Criar tweet unico (com timestamp para evitar duplicacao)
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  const shortTitle = product.name.length > 50 ? product.name.substring(0, 47) + '...' : product.name;
  
  const tweetText = `OFERTA ${timestamp}

${shortTitle}

Link afiliado MANUDASPROMOCOES:
${affiliateUrl}

#Promocao #ML`;
  
  console.log('\nTweet (' + tweetText.length + ' chars):');
  console.log(tweetText);
  
  // 4. Postar no Twitter
  console.log('\nPostando no Twitter...');
  
  const twitterUrl = 'https://api.twitter.com/2/tweets';
  const authHeader = generateOAuthHeader('POST', twitterUrl);
  
  const tweetResp = await axios.post(twitterUrl, { text: tweetText }, {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('\nPOSTADO COM SUCESSO!');
  console.log('Tweet ID:', tweetResp.data.data.id);
  console.log('URL: https://twitter.com/i/web/status/' + tweetResp.data.data.id);
}

main().catch(err => {
  console.error('Erro:', err.response?.data || err.message);
});
