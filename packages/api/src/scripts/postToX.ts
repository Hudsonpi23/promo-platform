/**
 * Script simples para postar no X (Twitter)
 * Testa a integração com a API do Twitter
 */

import crypto from 'crypto';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || '';
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

/**
 * Gera assinatura OAuth 1.0a
 */
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

/**
 * Gera header OAuth
 */
function generateOAuthHeader(method: string, url: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(method, url, oauthParams);
  oauthParams.oauth_signature = signature;

  const headerParams = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${headerParams}`;
}

/**
 * Posta no Twitter
 */
async function postToTwitter(text: string): Promise<{ success: boolean; tweetUrl?: string; error?: string }> {
  console.log('🔑 Verificando credenciais...');
  console.log('   API_KEY:', TWITTER_API_KEY ? '✅ Configurada' : '❌ Não configurada');
  console.log('   API_SECRET:', TWITTER_API_SECRET ? '✅ Configurada' : '❌ Não configurada');
  console.log('   ACCESS_TOKEN:', TWITTER_ACCESS_TOKEN ? '✅ Configurado' : '❌ Não configurado');
  console.log('   ACCESS_SECRET:', TWITTER_ACCESS_TOKEN_SECRET ? '✅ Configurado' : '❌ Não configurado');
  
  if (!TWITTER_API_KEY || !TWITTER_ACCESS_TOKEN) {
    return { success: false, error: 'Credenciais do Twitter não configuradas no .env' };
  }
  
  console.log('\n🐦 Postando no Twitter/X...');
  
  const url = 'https://api.twitter.com/2/tweets';
  
  try {
    const authHeader = generateOAuthHeader('POST', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    
    const data = await response.json() as any;
    
    if (!response.ok) {
      console.error('❌ Erro Twitter:', JSON.stringify(data, null, 2));
      return { success: false, error: data.detail || data.title || JSON.stringify(data) };
    }
    
    const tweetId = data.data?.id;
    const tweetUrl = `https://twitter.com/manupromocao/status/${tweetId}`;
    
    return { success: true, tweetUrl };
    
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Main
 */
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('   🐦 POST NO X (TWITTER) - Promo Platform');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  // Oferta real para postar
  const offer = {
    title: 'Fone de Ouvido Bluetooth JBL Tune 520BT',
    price: 199.90,
    oldPrice: 349.90,
    discount: 43,
    store: 'Amazon',
  };
  
  // Formatar preço
  const formatPrice = (p: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p);
  
  // Gerar texto do tweet
  const tweetText = `🔥 ${offer.title}

💸 De ~${formatPrice(offer.oldPrice)}~
✅ Por ${formatPrice(offer.price)} (-${offer.discount}% OFF)

🛒 ${offer.store}

🔗 Confira em manupromocao.com

#Promoção #Oferta #Desconto`;

  console.log('📝 Tweet a ser postado:');
  console.log('─────────────────────────────────────────────');
  console.log(tweetText);
  console.log('─────────────────────────────────────────────');
  console.log(`📏 ${tweetText.length}/280 caracteres\n`);
  
  // Postar
  const result = await postToTwitter(tweetText);
  
  if (result.success) {
    console.log('\n🎉 SUCESSO!');
    console.log('🔗 Tweet:', result.tweetUrl);
  } else {
    console.log('\n❌ ERRO:', result.error);
  }
  
  console.log('');
}

main().catch(console.error);
