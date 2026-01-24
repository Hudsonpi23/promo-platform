import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';

// Imagem local do usuÃ¡rio
const imagePath = 'C:\\Users\\Acer\\Downloads\\teste afiliado.jpg';
const affiliateUrl = 'https://www.awin1.com/cread.php?awinmid=115463&awinaffid=2739090&clickref=https%3A%2F%2Fwww.gigantec.com.br%2Fmonitor-lg-ultrafine-32-uhd-60hz-4k-4ms-dp-hdmi-32ur500k-b-awzm.html';

async function postFromLocalImage() {
  console.log('\n=== POST COM IMAGEM LOCAL ===\n');
  
  const apiKey = process.env.TWITTER_API_KEY!;
  const apiSecret = process.env.TWITTER_API_SECRET!;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN!;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET!;
  
  // 1. Ler imagem do disco
  console.log('1. Lendo imagem local...');
  const imageBuffer = fs.readFileSync(imagePath);
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
  
  // 2. Upload para Twitter
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
  console.log(`   DimensÃµes: ${uploadResponse.data.image?.w}x${uploadResponse.data.image?.h}`);
  
  // 3. Postar tweet
  console.log('\n3. Postando tweet...');
  const tweetUrl = 'https://api.twitter.com/2/tweets';
  
  const tweetBody = {
    text: `ðŸ–¥ï¸ Monitor LG UltraFine 32" UHD 4K 60Hz

âœ… ResoluÃ§Ã£o 4K
âœ… HDR10
âœ… AMD FreeSync
âœ… HDMI + DisplayPort

ðŸ’° 10% OFF no PIX!
ðŸ›’ Gigantec

ðŸ‘‰ ${affiliateUrl}

#monitor #lg #4k #oferta`,
    media: { media_ids: [mediaId] },
  };
  
  const tweetHeader = generateOAuthHeader('POST', tweetUrl);
  const tweetResponse = await axios.post(tweetUrl, tweetBody, {
    headers: { Authorization: tweetHeader, 'Content-Type': 'application/json' },
  });
  
  console.log(`\nâœ… Tweet: https://twitter.com/i/web/status/${tweetResponse.data.data.id}`);
}

postFromLocalImage().catch(e => console.error('ERRO:', e.response?.data || e.message));
