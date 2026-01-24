import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';

// Imagem pÃºblica do Wikimedia (AMD Ryzen)
const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/AMD_Ryzen_7_1800X_20170311.jpg/800px-AMD_Ryzen_7_1800X_20170311.jpg';

async function test() {
  console.log('\n=== TESTE COM IMAGEM WIKIMEDIA ===\n');
  
  const apiKey = process.env.TWITTER_API_KEY!;
  const apiSecret = process.env.TWITTER_API_SECRET!;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN!;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET!;
  
  console.log('1. Baixando imagem do Wikimedia...');
  const imageResponse = await axios.get(imageUrl, { 
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const imageBuffer = Buffer.from(imageResponse.data);
  console.log(`   Tamanho: ${(imageBuffer.length/1024).toFixed(1)} KB`);
  
  const imageBase64 = imageBuffer.toString('base64');
  
  function generateOAuthSignature(method: string, url: string, params: Record<string, string>): string {
    const sortedParams = Object.keys(params).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
    const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
    const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;
    return crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
  }

  function generateOAuthHeader(method: string, url: string, additionalParams: Record<string, string> = {}): string {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: '1.0',
    };
    const allParams = { ...oauthParams, ...additionalParams };
    const signature = generateOAuthSignature(method, url, allParams);
    oauthParams.oauth_signature = signature;
    const headerString = Object.keys(oauthParams).sort().map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`).join(', ');
    return `OAuth ${headerString}`;
  }
  
  console.log('\n2. Upload para Twitter...');
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  
  const uploadParams: Record<string, string> = { media_data: imageBase64 };
  const uploadHeader = generateOAuthHeader('POST', uploadUrl, uploadParams);
  
  const uploadResponse = await axios.post(uploadUrl, `media_data=${encodeURIComponent(imageBase64)}`, {
    headers: { Authorization: uploadHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  
  const mediaId = uploadResponse.data.media_id_string;
  console.log(`   Media ID: ${mediaId}`);
  console.log(`   Tipo: ${uploadResponse.data.image?.image_type}`);
  console.log(`   Size: ${uploadResponse.data.size} bytes`);
  
  console.log('\n3. Postando tweet...');
  const tweetUrl = 'https://api.twitter.com/2/tweets';
  const tweetBody = {
    text: 'ðŸ”¥ AMD Ryzen - Teste Wikimedia ' + Date.now(),
    media: { media_ids: [mediaId] },
  };
  
  const tweetHeader = generateOAuthHeader('POST', tweetUrl);
  const tweetResponse = await axios.post(tweetUrl, tweetBody, {
    headers: { Authorization: tweetHeader, 'Content-Type': 'application/json' },
  });
  
  console.log(`\nâœ… Tweet: https://twitter.com/i/web/status/${tweetResponse.data.data.id}`);
}

test().catch(e => console.error('ERRO:', e.response?.data || e.message));
