import 'dotenv/config';
import axios from 'axios';

// ==================== CONFIGURAÇÃO DA OFERTA ====================
const offer = {
  title: 'Echo Dot 5ª Geração Smart Speaker Amazon Alexa',
  originalPrice: 399.00,
  finalPrice: 269.00,
  discount: 33,
  affiliateUrl: 'https://manupromocao.com/oferta/echo-dot-5-alexa',
  imageUrl: 'https://m.media-amazon.com/images/I/518cRYanpbL._AC_SL1000_.jpg',
  storeName: 'Amazon',
};

// ==================== FUNÇÕES DE POST ====================

// Gerar texto para Facebook
function generateFacebookText(): string {
  return `🔥 OFERTA IMPERDÍVEL! 🔥

${offer.title}

💰 De R$ ${offer.originalPrice.toFixed(2)}
🏷️ Por apenas R$ ${offer.finalPrice.toFixed(2)}
📉 ${offer.discount}% OFF!

🛒 ${offer.storeName}

👉 Aproveite: ${offer.affiliateUrl}

#promocao #oferta #desconto #amazon #echodot #alexa`;
}

// Gerar texto para Twitter (mais curto)
function generateTweetText(): string {
  return `🔥 ${offer.title}

De R$ ${offer.originalPrice.toFixed(2)} por R$ ${offer.finalPrice.toFixed(2)} (-${offer.discount}%)

🛒 ${offer.storeName}
👉 ${offer.affiliateUrl}`;
}

// Post no Facebook com imagem
async function postToFacebook(pageId: string, pageToken: string, pageName: string): Promise<boolean> {
  try {
    const graphVersion = process.env.META_GRAPH_VERSION || 'v24.0';
    const text = generateFacebookText();
    
    console.log(`\n📘 Postando no Facebook: ${pageName}...`);
    
    const response = await axios.post(
      `https://graph.facebook.com/${graphVersion}/${pageId}/photos`,
      {
        url: offer.imageUrl,
        caption: text,
        access_token: pageToken,
      }
    );
    
    console.log(`   ✅ Sucesso! Post ID: ${response.data.id || response.data.post_id}`);
    return true;
  } catch (error: any) {
    console.log(`   ❌ Erro: ${error.response?.data?.error?.message || error.message}`);
    return false;
  }
}

// Post no Twitter com imagem
async function postToTwitter(): Promise<boolean> {
  try {
    const crypto = await import('crypto');
    
    const apiKey = process.env.TWITTER_API_KEY!;
    const apiSecret = process.env.TWITTER_API_SECRET!;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN!;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET!;
    
    console.log(`\n🐦 Postando no Twitter/X...`);
    
    // 1. Baixar imagem
    const imageResponse = await axios.get(offer.imageUrl, { responseType: 'arraybuffer' });
    const imageBase64 = Buffer.from(imageResponse.data).toString('base64');
    
    // 2. Upload da imagem
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
    const uploadParams: Record<string, string> = {
      media_data: imageBase64,
    };
    
    function generateOAuthSignature(
      method: string,
      url: string,
      params: Record<string, string>,
      consumerSecret: string,
      tokenSecret: string
    ): string {
      const sortedParams = Object.keys(params)
        .sort()
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');

      const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
      const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

      return crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
    }

    function generateOAuthHeader(
      method: string,
      url: string,
      additionalParams: Record<string, string> = {}
    ): string {
      const oauthParams: Record<string, string> = {
        oauth_consumer_key: apiKey,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: accessToken,
        oauth_version: '1.0',
      };

      const allParams = { ...oauthParams, ...additionalParams };
      const signature = generateOAuthSignature(method, url, allParams, apiSecret, accessTokenSecret);
      oauthParams.oauth_signature = signature;

      const headerString = Object.keys(oauthParams)
        .sort()
        .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
        .join(', ');

      return `OAuth ${headerString}`;
    }
    
    // Upload media
    const uploadHeader = generateOAuthHeader('POST', uploadUrl, uploadParams);
    const uploadResponse = await axios.post(uploadUrl, `media_data=${encodeURIComponent(imageBase64)}`, {
      headers: {
        Authorization: uploadHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    const mediaId = uploadResponse.data.media_id_string;
    console.log(`   📷 Imagem enviada: ${mediaId}`);
    
    // 3. Postar tweet com imagem
    const tweetUrl = 'https://api.twitter.com/2/tweets';
    const tweetText = generateTweetText();
    const tweetBody = {
      text: tweetText,
      media: { media_ids: [mediaId] },
    };
    
    const tweetHeader = generateOAuthHeader('POST', tweetUrl);
    const tweetResponse = await axios.post(tweetUrl, tweetBody, {
      headers: {
        Authorization: tweetHeader,
        'Content-Type': 'application/json',
      },
    });
    
    const tweetId = tweetResponse.data.data.id;
    console.log(`   ✅ Sucesso! Tweet: https://twitter.com/i/web/status/${tweetId}`);
    return true;
  } catch (error: any) {
    console.log(`   ❌ Erro: ${error.response?.data?.detail || error.response?.data?.errors?.[0]?.message || error.message}`);
    return false;
  }
}

// ==================== MAIN ====================
async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   🚀 POST EM TODAS AS PLATAFORMAS - Promo Platform');
  console.log('═══════════════════════════════════════════════════════');
  
  console.log('\n📦 Oferta:');
  console.log(`   ${offer.title}`);
  console.log(`   R$ ${offer.finalPrice.toFixed(2)} (-${offer.discount}%)`);
  console.log(`   🖼️  ${offer.imageUrl}`);
  
  const results = {
    facebook1: false,
    facebook2: false,
    twitter: false,
  };
  
  // Post no Facebook - Página 1 (Manu das Promoções)
  const page1Id = process.env.META_PAGE_1_ID;
  const page1Token = process.env.META_PAGE_1_TOKEN;
  if (page1Id && page1Token) {
    results.facebook1 = await postToFacebook(page1Id, page1Token, 'Manu das Promoções');
  } else {
    console.log('\n📘 Facebook Página 1: ❌ Credenciais não configuradas');
  }
  
  // Post no Facebook - Página 2 (Manu Promoções de Tecnologia)
  const page2Id = process.env.META_PAGE_2_ID;
  const page2Token = process.env.META_PAGE_2_TOKEN;
  if (page2Id && page2Token) {
    results.facebook2 = await postToFacebook(page2Id, page2Token, 'Manu Promoções de Tecnologia');
  } else {
    console.log('\n📘 Facebook Página 2: ❌ Credenciais não configuradas');
  }
  
  // Post no Twitter
  if (process.env.TWITTER_API_KEY) {
    results.twitter = await postToTwitter();
  } else {
    console.log('\n🐦 Twitter: ❌ Credenciais não configuradas');
  }
  
  // Resumo
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   📊 RESUMO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   📘 Facebook (Manu das Promoções):      ${results.facebook1 ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`   📘 Facebook (Manu Promoções Tech):     ${results.facebook2 ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`   🐦 Twitter/X:                          ${results.twitter ? '✅ OK' : '❌ FALHOU'}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main();
