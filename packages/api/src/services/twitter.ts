/**
 * Twitter/X API Integration Service
 * 
 * Implementa postagem automática no X (antigo Twitter)
 * usando a API v2 com OAuth 1.0a User Context
 */

import crypto from 'crypto';

// Configuração das credenciais (de variáveis de ambiente)
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || '';
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

// URL base da API do Twitter v2
const TWITTER_API_BASE = 'https://api.twitter.com/2';

/**
 * Verifica se as credenciais do Twitter estão configuradas
 */
export function isTwitterConfigured(): boolean {
  return !!(
    TWITTER_API_KEY &&
    TWITTER_API_SECRET &&
    TWITTER_ACCESS_TOKEN &&
    TWITTER_ACCESS_TOKEN_SECRET
  );
}

/**
 * Gera assinatura OAuth 1.0a para autenticação no Twitter
 */
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  // Ordenar parâmetros alfabeticamente
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // Criar signature base string
  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  // Criar signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Gerar HMAC-SHA1 signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');

  return signature;
}

/**
 * Gera nonce aleatório para OAuth
 */
function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Gera header de autorização OAuth 1.0a
 */
function generateOAuthHeader(method: string, url: string, body?: Record<string, any>): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  // Parâmetros OAuth base
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  // Gerar assinatura
  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    TWITTER_API_SECRET,
    TWITTER_ACCESS_TOKEN_SECRET
  );

  oauthParams.oauth_signature = signature;

  // Construir header
  const headerParams = Object.keys(oauthParams)
    .sort()
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${headerParams}`;
}

/**
 * Interface para resposta do tweet
 */
export interface TweetResponse {
  success: boolean;
  tweetId?: string;
  tweetUrl?: string;
  error?: string;
}

/**
 * Posta um tweet no X
 */
export async function postTweet(text: string): Promise<TweetResponse> {
  if (!isTwitterConfigured()) {
    return {
      success: false,
      error: 'Twitter API não configurada. Configure as variáveis de ambiente.',
    };
  }

  // Validar tamanho do tweet (máx 280 caracteres)
  if (text.length > 280) {
    return {
      success: false,
      error: `Tweet muito longo (${text.length}/280 caracteres)`,
    };
  }

  const url = `${TWITTER_API_BASE}/tweets`;

  try {
    const authHeader = generateOAuthHeader('POST', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Twitter] Erro ao postar:', data);
      return {
        success: false,
        error: data.detail || data.title || 'Erro ao postar no Twitter',
      };
    }

    const tweetId = data.data?.id;
    
    console.log('[Twitter] Tweet postado com sucesso:', tweetId);

    return {
      success: true,
      tweetId,
      tweetUrl: tweetId ? `https://twitter.com/manupromocao/status/${tweetId}` : undefined,
    };
  } catch (error: any) {
    console.error('[Twitter] Erro de rede:', error);
    return {
      success: false,
      error: error.message || 'Erro de conexão com Twitter',
    };
  }
}

/**
 * Gera o texto do tweet a partir de uma oferta
 */
export function generateTweetText(offer: {
  title: string;
  originalPrice?: number;
  finalPrice: number;
  discount?: number;
  affiliateUrl?: string;
  storeName?: string;
}): string {
  const { title, originalPrice, finalPrice, discount, affiliateUrl, storeName } = offer;

  // Formatar preços
  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  // Construir texto do tweet
  let text = '';

  // Título curto (máx 100 chars)
  const shortTitle = title.length > 100 ? title.substring(0, 97) + '...' : title;
  text += `🔥 ${shortTitle}\n\n`;

  // Preços
  if (originalPrice && originalPrice > finalPrice) {
    text += `De ${formatPrice(originalPrice)} por ${formatPrice(finalPrice)}`;
    if (discount) {
      text += ` (-${discount}%)`;
    }
  } else {
    text += `Por apenas ${formatPrice(finalPrice)}`;
  }
  text += '\n\n';

  // Loja
  if (storeName) {
    text += `📦 ${storeName}\n`;
  }

  // Link
  if (affiliateUrl) {
    text += `\n👉 ${affiliateUrl}`;
  }

  // Hashtags (se couber)
  const hashtags = '\n\n#Promoção #Oferta';
  if (text.length + hashtags.length <= 280) {
    text += hashtags;
  }

  // Truncar se ainda for muito longo
  if (text.length > 280) {
    text = text.substring(0, 277) + '...';
  }

  return text;
}

/**
 * Posta uma oferta no Twitter
 */
export async function postOfferToTwitter(offer: {
  title: string;
  originalPrice?: number;
  finalPrice: number;
  discount?: number;
  affiliateUrl?: string;
  storeName?: string;
}): Promise<TweetResponse> {
  const tweetText = generateTweetText(offer);
  return postTweet(tweetText);
}
