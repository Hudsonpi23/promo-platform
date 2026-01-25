const axios = require('axios');
const crypto = require('crypto');

const TWITTER_API_KEY = 'acBLzFYKSv6CGr2GNbPdA1Q8J';
const TWITTER_API_SECRET = 'FMhZAUJGrSoycaFvYIE8rmIF7wS65tDqI7EpFMIgd1xEGigWSV';
const TWITTER_ACCESS_TOKEN = '2013613059290378240-IZ2KyuNn6wuduFATWDWYZV3Wpn57aj';
const TWITTER_ACCESS_TOKEN_SECRET = 'Cp24Cad5OsKpbElFpiX6FpURuGujFHj7W4tMldL3V8o46';

// Verificar credenciais com endpoint de verificaÃ§Ã£o
async function verifyCredentials() {
  const url = 'https://api.twitter.com/2/users/me';
  
  const oauthParams = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: '1.0'
  };
  
  const sortedParams = Object.keys(oauthParams).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`).join('&');
  const baseString = `GET&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(TWITTER_API_SECRET)}&${encodeURIComponent(TWITTER_ACCESS_TOKEN_SECRET)}`;
  oauthParams.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  
  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`).join(', ');
  
  console.log('Verificando credenciais do Twitter...');
  
  try {
    const response = await axios.get(url, {
      headers: { 'Authorization': authHeader }
    });
    console.log('âœ… Credenciais OK!');
    console.log('   UsuÃ¡rio:', response.data.data.username);
    console.log('   ID:', response.data.data.id);
    return true;
  } catch (err) {
    console.log('âŒ Erro:', err.response?.status, err.response?.data);
    return false;
  }
}

verifyCredentials();
