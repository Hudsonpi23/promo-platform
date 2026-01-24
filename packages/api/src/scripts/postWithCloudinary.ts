import 'dotenv/config';
import axios from 'axios';
import { configureCloudinary, uploadFromBuffer } from '../services/cloudinary.js';

// ==================== OFERTA ====================
const offer = {
  title: 'Câmera De Segurança Lâmpada Soquete Wifi Visão Noturna 360° Full HD',
  originalPrice: 78.95,
  finalPrice: 49.60,
  discount: 37,
  affiliateUrl: 'https://www.mercadolivre.com.br/social/dh20260120130733?matt_word=dh20260120130733&matt_tool=77551400&forceInApp=true&ref=BGa%2FimCrFn7%2FVpQQbvDIxKnvczm319Vel5sgXmVP%2Bmn2oTKpwfI1VG9zo%2BUv09YOHlkix%2BW06FJtnYfA0WdRspN%2FrZ1vak2Ol962JMevn1NG%2B4FeHN%2F75sHUVkDPpIGkk2nh7MDSVRun0xWRtEQwqrMwzbcRB0scPmU56n1l2rgqcxmSSzTexCWSCQfMKr0bwSK3bg%3D%3D',
  imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_2X_859149-MLU75480835392_042024-F.webp',
  storeName: 'Mercado Livre',
};

// ==================== GERAR TEXTOS ====================
function generateFacebookText(): string {
  return `🔥 OFERTA IMPERDÍVEL! 🔥

📷 ${offer.title}

💰 De R$ ${offer.originalPrice.toFixed(2).replace('.', ',')}
🏷️ Por apenas R$ ${offer.finalPrice.toFixed(2).replace('.', ',')}
📉 ${offer.discount}% OFF!

🛒 ${offer.storeName}

✅ Wi-Fi 360°
✅ Visão Noturna
✅ Full HD
✅ App Yoosee

👉 Compre aqui: ${offer.affiliateUrl}

#promocao #oferta #desconto #camera #seguranca #wifi #mercadolivre`;
}

function generateTweetText(): string {
  return `📷 ${offer.title}

De R$ ${offer.originalPrice.toFixed(2).replace('.', ',')} por R$ ${offer.finalPrice.toFixed(2).replace('.', ',')} (-${offer.discount}%)

🛒 ${offer.storeName}
👉 ${offer.affiliateUrl}`;
}

// ==================== BAIXAR E UPLOAD IMAGEM ====================
async function uploadImageToCloudinary(imageUrl: string): Promise<string | null> {
  console.log('\n☁️  Fazendo upload da imagem para Cloudinary...');
  
  // Configurar Cloudinary
  const configured = configureCloudinary();
  if (!configured) {
    console.log('   ❌ Cloudinary não configurado');
    return null;
  }
  
  try {
    // 1. Baixar imagem do ML
    console.log('   📥 Baixando imagem do Mercado Livre...');
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*',
      },
    });
    
    const imageBuffer = Buffer.from(response.data);
    console.log(`   ✅ Imagem baixada: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
    
    // 2. Upload para Cloudinary
    console.log('   📤 Enviando para Cloudinary...');
    const uploadResult = await uploadFromBuffer(imageBuffer, {
      folder: 'promo-platform/posts',
      tags: ['oferta', 'mercadolivre'],
      transformation: {
        format: 'jpg',
        quality: 90,  // Qualidade alta (não comprimir muito!)
        width: 1000,  // Tamanho grande
      },
    });
    
    if (uploadResult.success && uploadResult.url) {
      console.log(`   ✅ Upload concluído: ${uploadResult.url}`);
      return uploadResult.url;
    } else {
      console.log(`   ❌ Erro no upload: ${uploadResult.error}`);
      return null;
    }
  } catch (error: any) {
    console.log(`   ❌ Erro: ${error.message}`);
    return null;
  }
}

// ==================== POST FACEBOOK ====================
async function postToFacebook(pageId: string, pageToken: string, pageName: string, imageUrl: string): Promise<boolean> {
  try {
    const graphVersion = process.env.META_GRAPH_VERSION || 'v24.0';
    const text = generateFacebookText();
    
    console.log(`\n📘 Postando no Facebook: ${pageName}...`);
    
    const response = await axios.post(
      `https://graph.facebook.com/${graphVersion}/${pageId}/photos`,
      {
        url: imageUrl,
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

// ==================== POST TWITTER ====================
async function postToTwitter(imageUrl: string): Promise<boolean> {
  try {
    const crypto = await import('crypto');
    
    const apiKey = process.env.TWITTER_API_KEY!;
    const apiSecret = process.env.TWITTER_API_SECRET!;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN!;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET!;
    
    console.log(`\n🐦 Postando no Twitter/X...`);
    
    // Baixar imagem do Cloudinary (que é acessível)
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBase64 = Buffer.from(imageResponse.data).toString('base64');
    
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
    
    function generateOAuthSignature(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret: string): string {
      const sortedParams = Object.keys(params).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
      const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
      const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
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
      const signature = generateOAuthSignature(method, url, allParams, apiSecret, accessTokenSecret);
      oauthParams.oauth_signature = signature;
      const headerString = Object.keys(oauthParams).sort().map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`).join(', ');
      return `OAuth ${headerString}`;
    }
    
    const uploadParams: Record<string, string> = { media_data: imageBase64 };
    const uploadHeader = generateOAuthHeader('POST', uploadUrl, uploadParams);
    const uploadResponse = await axios.post(uploadUrl, `media_data=${encodeURIComponent(imageBase64)}`, {
      headers: { Authorization: uploadHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    
    const mediaId = uploadResponse.data.media_id_string;
    console.log(`   📷 Imagem enviada: ${mediaId}`);
    
    const tweetUrl = 'https://api.twitter.com/2/tweets';
    const tweetText = generateTweetText();
    const tweetBody = { text: tweetText, media: { media_ids: [mediaId] } };
    
    const tweetHeader = generateOAuthHeader('POST', tweetUrl);
    const tweetResponse = await axios.post(tweetUrl, tweetBody, {
      headers: { Authorization: tweetHeader, 'Content-Type': 'application/json' },
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
  console.log('   🚀 POST COM CLOUDINARY - Promo Platform');
  console.log('═══════════════════════════════════════════════════════');
  
  console.log('\n📦 Oferta:');
  console.log(`   ${offer.title}`);
  console.log(`   R$ ${offer.finalPrice.toFixed(2)} (-${offer.discount}%)`);
  
  // 1. Upload imagem para Cloudinary
  const cloudinaryUrl = await uploadImageToCloudinary(offer.imageUrl);
  
  if (!cloudinaryUrl) {
    console.log('\n❌ Não foi possível fazer upload da imagem. Abortando.');
    return;
  }
  
  console.log(`\n🖼️  URL Cloudinary: ${cloudinaryUrl}`);
  
  // 2. Postar nas plataformas
  const results = { facebook1: false, facebook2: false, twitter: false };
  
  const page1Id = process.env.META_PAGE_1_ID;
  const page1Token = process.env.META_PAGE_1_TOKEN;
  if (page1Id && page1Token) {
    results.facebook1 = await postToFacebook(page1Id, page1Token, 'Manu das Promoções', cloudinaryUrl);
  }
  
  const page2Id = process.env.META_PAGE_2_ID;
  const page2Token = process.env.META_PAGE_2_TOKEN;
  if (page2Id && page2Token) {
    results.facebook2 = await postToFacebook(page2Id, page2Token, 'Manu Promoções de Tecnologia', cloudinaryUrl);
  }
  
  if (process.env.TWITTER_API_KEY) {
    results.twitter = await postToTwitter(cloudinaryUrl);
  }
  
  // 3. Resumo
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   📊 RESUMO');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   ☁️  Cloudinary:                        ✅ OK`);
  console.log(`   📘 Facebook (Manu das Promoções):      ${results.facebook1 ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`   📘 Facebook (Manu Promoções Tech):     ${results.facebook2 ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`   🐦 Twitter/X:                          ${results.twitter ? '✅ OK' : '❌ FALHOU'}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main();
