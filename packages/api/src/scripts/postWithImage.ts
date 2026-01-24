/**
 * Script para postar no X COM IMAGEM
 * Implementação standalone para garantir carregamento correto das credenciais
 */

import dotenv from 'dotenv';
import crypto from 'crypto';

// Carregar variáveis de ambiente PRIMEIRO
dotenv.config();

// Credenciais (lidas após dotenv.config)
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || '';
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';

// Funções OAuth
function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(TWITTER_API_SECRET)}&${encodeURIComponent(TWITTER_ACCESS_TOKEN_SECRET)}`;

  return crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');
}

function generateOAuthHeader(method: string, url: string, extraParams: Record<string, string> = {}): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  // Combinar com parâmetros extras para assinatura
  const allParams = { ...oauthParams, ...extraParams };

  const signature = generateOAuthSignature(method, url, allParams);
  oauthParams.oauth_signature = signature;

  const headerParams = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${headerParams}`;
}

// Baixar imagem como base64
async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log('📥 Baixando imagem...');
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    console.log(`   Tamanho: ${Math.round(base64.length / 1024)} KB`);
    return base64;
  } catch (error: any) {
    console.error('❌ Erro ao baixar:', error.message);
    return null;
  }
}

// Upload de mídia
async function uploadMedia(imageUrl: string): Promise<string | null> {
  const base64Image = await downloadImageAsBase64(imageUrl);
  if (!base64Image) return null;

  try {
    console.log('📤 Fazendo upload para Twitter...');
    
    const bodyParams = { media_data: base64Image };
    const authHeader = generateOAuthHeader('POST', TWITTER_UPLOAD_URL, bodyParams);

    const formData = new URLSearchParams();
    formData.append('media_data', base64Image);

    const response = await fetch(TWITTER_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      console.error('❌ Erro no upload:', data);
      return null;
    }

    console.log('✅ Upload OK, media_id:', data.media_id_string);
    return data.media_id_string;
  } catch (error: any) {
    console.error('❌ Erro no upload:', error.message);
    return null;
  }
}

// Postar tweet
async function postTweet(text: string, mediaId?: string): Promise<{ success: boolean; tweetUrl?: string; error?: string }> {
  const url = `${TWITTER_API_BASE}/tweets`;
  const authHeader = generateOAuthHeader('POST', url);

  const tweetBody: any = { text };
  if (mediaId) {
    tweetBody.media = { media_ids: [mediaId] };
  }

  try {
    console.log('🐦 Postando tweet...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      console.error('❌ Erro:', data);
      return { success: false, error: data.detail || data.title || JSON.stringify(data) };
    }

    const tweetId = data.data?.id;
    return {
      success: true,
      tweetUrl: `https://twitter.com/manupromocao/status/${tweetId}`,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Main
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('   🖼️  POST NO X COM IMAGEM - Promo Platform');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  // Verificar credenciais
  console.log('🔑 Verificando credenciais...');
  console.log('   API_KEY:', TWITTER_API_KEY ? '✅' : '❌');
  console.log('   API_SECRET:', TWITTER_API_SECRET ? '✅' : '❌');
  console.log('   ACCESS_TOKEN:', TWITTER_ACCESS_TOKEN ? '✅' : '❌');
  console.log('   ACCESS_SECRET:', TWITTER_ACCESS_TOKEN_SECRET ? '✅' : '❌');
  console.log('');
  
  if (!TWITTER_API_KEY || !TWITTER_ACCESS_TOKEN) {
    console.log('❌ Credenciais não configuradas!');
    return;
  }
  
  // Oferta com imagem real
  const offer = {
    title: 'Echo Dot 5ª Geração Smart Speaker Amazon Alexa',
    price: 269.00,
    oldPrice: 399.00,
    discount: 33,
    store: 'Amazon',
    imageUrl: 'https://m.media-amazon.com/images/I/518cRYanpbL._AC_SL1000_.jpg',
  };
  
  const formatPrice = (p: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p);
  
  const tweetText = `🔥 ${offer.title}

💸 De ~${formatPrice(offer.oldPrice)}~
✅ Por ${formatPrice(offer.price)} (-${offer.discount}% OFF)

🛒 ${offer.store}

🔗 Confira em manupromocao.com

#Promoção #Alexa #SmartHome`;

  console.log('📝 Tweet:');
  console.log('─────────────────────────────────────────────');
  console.log(tweetText);
  console.log('─────────────────────────────────────────────');
  console.log(`📏 ${tweetText.length}/280 caracteres`);
  console.log(`🖼️  Imagem: ${offer.imageUrl.substring(0, 50)}...`);
  console.log('');
  
  // 1. Upload da imagem
  const mediaId = await uploadMedia(offer.imageUrl);
  
  // 2. Postar tweet (com ou sem imagem)
  const result = await postTweet(tweetText, mediaId || undefined);
  
  if (result.success) {
    console.log('\n🎉 SUCESSO!');
    console.log('🔗 Tweet:', result.tweetUrl);
    if (mediaId) {
      console.log('🖼️  COM IMAGEM!');
    } else {
      console.log('⚠️  Sem imagem (upload falhou)');
    }
  } else {
    console.log('\n❌ ERRO:', result.error);
  }
  
  console.log('');
}

main().catch(console.error);
