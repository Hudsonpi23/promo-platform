import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';

const imageUrl = 'https://res.cloudinary.com/dmdiipxhb/image/upload/v1769278307/promo-platform/posts/f5lmegxtdnh59y2xnvw1.jpg';

async function testTwitterUpload() {
  console.log('\n=== DEBUG TWITTER UPLOAD ===\n');
  
  const apiKey = process.env.TWITTER_API_KEY!;
  const apiSecret = process.env.TWITTER_API_SECRET!;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN!;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET!;
  
  console.log('1. Baixando imagem do Cloudinary...');
  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(imageResponse.data);
  console.log(`   Tamanho: ${imageBuffer.length} bytes`);
  
  const imageBase64 = imageBuffer.toString('base64');
  console.log(`   Base64 length: ${imageBase64.length}`);
  
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
  
  console.log('\n2. Fazendo upload para Twitter...');
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  
  try {
    const uploadParams: Record<string, string> = { media_data: imageBase64 };
    const uploadHeader = generateOAuthHeader('POST', uploadUrl, uploadParams);
    
    const uploadResponse = await axios.post(uploadUrl, `media_data=${encodeURIComponent(imageBase64)}`, {
      headers: { 
        Authorization: uploadHeader, 
        'Content-Type': 'application/x-www-form-urlencoded' 
      },
    });
    
    console.log('   Upload Response:', JSON.stringify(uploadResponse.data, null, 2));
    
    const mediaId = uploadResponse.data.media_id_string;
    console.log(`\n   Media ID: ${mediaId}`);
    
    // Verificar status da mÃ­dia
    console.log('\n3. Postando tweet com imagem...');
    const tweetUrl = 'https://api.twitter.com/2/tweets';
    const tweetBody = {
      text: 'ðŸ”¥ Teste de imagem - ' + new Date().toISOString(),
      media: { media_ids: [mediaId] },
    };
    
    console.log('   Tweet body:', JSON.stringify(tweetBody, null, 2));
    
    const tweetHeader = generateOAuthHeader('POST', tweetUrl);
    const tweetResponse = await axios.post(tweetUrl, tweetBody, {
      headers: { Authorization: tweetHeader, 'Content-Type': 'application/json' },
    });
    
    console.log('\n   Tweet Response:', JSON.stringify(tweetResponse.data, null, 2));
    console.log(`\n   Tweet URL: https://twitter.com/i/web/status/${tweetResponse.data.data.id}`);
    
  } catch (error: any) {
    console.log('\n   ERRO:', error.response?.data || error.message);
  }
}

testTwitterUpload();
