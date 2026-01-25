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
  console.log('ðŸ” Verificando conta MANUDASPROMOCOES...\n');
  
  // 1. Verificar usuÃ¡rio
  const userResp = await axios.get('https://api.mercadolibre.com/users/me', {
    headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
  });
  console.log('âœ… Conta:', userResp.data.nickname);
  
  // 2. Buscar trends/destaques do ML Brasil
  console.log('\nðŸ” Buscando destaques do ML...');
  
  const trendsResp = await axios.get('https://api.mercadolibre.com/trends/MLB', {
    headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
  });
  
  console.log('   TendÃªncias encontradas:', trendsResp.data.length);
  
  if (trendsResp.data.length > 0) {
    // Pegar a primeira tendÃªncia e buscar o primeiro item
    const trend = trendsResp.data[0];
    console.log('   Trend:', trend.keyword);
    
    // Buscar itens dessa tendÃªncia
    const searchUrl = trend.url;
    console.log('   URL:', searchUrl);
  }
  
  // 3. Tentar buscar categorias populares
  console.log('\nðŸ“‚ Buscando categorias...');
  const catResp = await axios.get('https://api.mercadolibre.com/sites/MLB/categories');
  console.log('   Categorias:', catResp.data.slice(0, 3).map(c => c.name).join(', '));
  
  // 4. Pegar highlights de uma categoria
  const categoryId = 'MLB1051'; // Celulares
  console.log('\nðŸ“± Buscando highlights de celulares...');
  
  const highlightsResp = await axios.get(`https://api.mercadolibre.com/highlights/MLB/category/${categoryId}`, {
    headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
  });
  
  console.log('   Highlights:', highlightsResp.data);
}

main().catch(err => {
  console.error('âŒ Erro:', err.response?.status, err.response?.data || err.message);
});
