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
  
  // Buscar um produto via deals endpoint
  console.log('ðŸ” Buscando ofertas via API de deals...');
  
  try {
    const dealsResp = await axios.get('https://api.mercadolibre.com/sites/MLB/deals/search', {
      params: { limit: 10 },
      headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
    });
    console.log('Deals:', dealsResp.data);
  } catch (e) {
    console.log('Deals erro:', e.response?.status);
  }
  
  // Tentar com highlights
  console.log('\nðŸ” Buscando highlights...');
  try {
    const highlightsResp = await axios.get('https://api.mercadolibre.com/highlights/MLB', {
      headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
    });
    console.log('Highlights:', JSON.stringify(highlightsResp.data).substring(0, 500));
  } catch (e) {
    console.log('Highlights erro:', e.response?.status);
  }
  
  // Tentar com products (catalog)
  console.log('\nðŸ” Buscando via products/search...');
  try {
    const prodResp = await axios.get('https://api.mercadolibre.com/products/search', {
      params: { 
        status: 'active',
        site_id: 'MLB',
        limit: 5
      },
      headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
    });
    console.log('Products:', JSON.stringify(prodResp.data).substring(0, 500));
  } catch (e) {
    console.log('Products erro:', e.response?.status, e.response?.data?.message);
  }
}

main().catch(err => {
  console.error('Erro:', err.response?.data || err.message);
});
