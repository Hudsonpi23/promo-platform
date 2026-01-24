import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';

const affiliateUrl = 'https://www.awin1.com/cread.php?awinmid=115463&awinaffid=2739090&clickref2=https%3A%2F%2Fwww.gigantec.com.br%2Fprocessador-amd-ryzen-5-8500g-am5-5-0ghz-22mb-cache-s-cooler-100-100000931box.html';

async function postLinkOnly() {
  console.log('\n=== TESTE: APENAS LINK DE AFILIADO ===\n');
  
  const apiKey = process.env.TWITTER_API_KEY!;
  const apiSecret = process.env.TWITTER_API_SECRET!;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN!;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET!;
  
  function generateOAuthSignature(method: string, url: string, params: Record<string, string>): string {
    const sortedParams = Object.keys(params).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
    const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
    const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;
    return crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
  }

  function generateOAuthHeader(method: string, url: string): string {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: '1.0',
    };
    const signature = generateOAuthSignature(method, url, oauthParams);
    oauthParams.oauth_signature = signature;
    const headerString = Object.keys(oauthParams).sort().map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`).join(', ');
    return `OAuth ${headerString}`;
  }
  
  const tweetUrl = 'https://api.twitter.com/2/tweets';
  const tweetText = `ðŸ”¥ Processador AMD Ryzen 5 8500G AM5 5.0GHz

ðŸ’° 10% OFF no PIX!

ðŸ‘‰ ${affiliateUrl}

#amd #ryzen #processador #oferta`;

  console.log('Tweet (apenas link):');
  console.log(tweetText);
  console.log('\n---\n');
  
  const tweetBody = { text: tweetText };
  
  const tweetHeader = generateOAuthHeader('POST', tweetUrl);
  const tweetResponse = await axios.post(tweetUrl, tweetBody, {
    headers: { Authorization: tweetHeader, 'Content-Type': 'application/json' },
  });
  
  console.log(`âœ… Tweet: https://twitter.com/i/web/status/${tweetResponse.data.data.id}`);
}

postLinkOnly().catch(e => console.error('ERRO:', e.response?.data || e.message));
