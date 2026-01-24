import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';

// Imagem da Amazon do Ryzen
const imageUrl = 'https://m.media-amazon.com/images/I/51f2hkWjYyL._AC_SL1000_.jpg';

async function test() {
  console.log('\n=== TESTE RYZEN AMAZON ===\n');
  
  const apiKey = process.env.TWITTER_API_KEY!;
  const apiSecret = process.env.TWITTER_API_SECRET!;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN!;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET!;
  
  console.log('1. Baixando imagem da Amazon (Ryzen)...');
  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
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
  
  console.log('\n3. Postando tweet com link Awin...');
  const tweetUrl = 'https://api.twitter.com/2/tweets';
  
  const affiliateUrl = 'https://www.awin1.com/cread.php?awinmid=115463&awinaffid=2739090&clickref2=https%3A%2F%2Fwww.gigantec.com.br%2Fprocessador-amd-ryzen-5-8500g-am5-5-0ghz-22mb-cache-s-cooler-100-100000931box.html';
  
  const tweetBody = {
    text: `ðŸ”¥ Processador AMD Ryzen 5 8500G AM5 5.0GHz

ðŸ’° 10% OFF no PIX!
ðŸ›’ Gigantec

ðŸ‘‰ ${affiliateUrl}`,
    media: { media_ids: [mediaId] },
  };
  
  const tweetHeader = generateOAuthHeader('POST', tweetUrl);
  const tweetResponse = await axios.post(tweetUrl, tweetBody, {
    headers: { Authorization: tweetHeader, 'Content-Type': 'application/json' },
  });
  
  console.log(`\nâœ… Tweet: https://twitter.com/i/web/status/${tweetResponse.data.data.id}`);
}

test().catch(e => console.error('ERRO:', e.response?.data || e.message));
