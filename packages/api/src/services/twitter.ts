/**
 * Twitter/X API Integration Service
 * 
 * Implementa postagem automática no X (antigo Twitter)
 * usando a API v2 com OAuth 1.0a User Context
 * 
 * Suporta:
 * - Posts com texto
 * - Posts com imagem
 */

import crypto from 'crypto';
import { generateCopies } from './aiCopyGenerator.js';

// Configuração das credenciais (de variáveis de ambiente)
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || '';
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

// URLs das APIs do Twitter
const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';

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
 * Interface para resposta do upload de mídia
 */
export interface MediaUploadResponse {
  success: boolean;
  mediaId?: string;
  error?: string;
}

/**
 * Gera header OAuth para upload de mídia (API v1.1)
 * Requer parâmetros adicionais no body
 */
function generateOAuthHeaderForUpload(method: string, url: string, bodyParams: Record<string, string> = {}): string {
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

  // Combinar oauth params com body params para assinatura
  const allParams = { ...oauthParams, ...bodyParams };

  // Gerar assinatura
  const signature = generateOAuthSignature(
    method,
    url,
    allParams,
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
 * Baixa uma imagem de uma URL e retorna como base64
 */
async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log('[Twitter] Baixando imagem:', imageUrl.substring(0, 50) + '...');
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('[Twitter] Erro ao baixar imagem:', response.status);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    console.log('[Twitter] Imagem baixada, tamanho:', Math.round(base64.length / 1024), 'KB');
    return base64;
  } catch (error: any) {
    console.error('[Twitter] Erro ao baixar imagem:', error.message);
    return null;
  }
}

/**
 * 🎠 Faz upload de múltiplas imagens para o Twitter (até 4 imagens)
 * @param imageUrls - Array de URLs de imagens (1-4 imagens)
 * @returns Array de media IDs ou erro
 */
export async function uploadMultipleMedia(imageUrls: string[]): Promise<{
  success: boolean;
  mediaIds?: string[];
  error?: string;
}> {
  if (!isTwitterConfigured()) {
    return { success: false, error: 'Twitter API não configurada' };
  }

  // Validar número de imagens (1-4)
  if (imageUrls.length < 1 || imageUrls.length > 4) {
    console.error('[Twitter] Número de imagens inválido (deve ser 1-4)');
    return { success: false, error: 'Twitter suporta apenas 1-4 imagens por tweet' };
  }

  console.log(`[Twitter] Fazendo upload de ${imageUrls.length} imagens`);

  try {
    const mediaIds: string[] = [];

    // Upload de cada imagem sequencialmente
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      console.log(`[Twitter] Uploading imagem ${i + 1}/${imageUrls.length}: ${imageUrl.substring(0, 50)}...`);

      const uploadResult = await uploadMedia(imageUrl);

      if (!uploadResult.success || !uploadResult.mediaId) {
        console.error(`[Twitter] Falha ao fazer upload da imagem ${i + 1}:`, uploadResult.error);
        // Se alguma falhar, retornar erro (Twitter precisa de todas ou nenhuma)
        return {
          success: false,
          error: `Falha no upload da imagem ${i + 1}: ${uploadResult.error}`,
        };
      }

      mediaIds.push(uploadResult.mediaId);
    }

    console.log(`[Twitter] ✅ ${mediaIds.length} imagens enviadas com sucesso`);
    return { success: true, mediaIds };

  } catch (error: any) {
    console.error('[Twitter] Erro no upload de múltiplas imagens:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Faz upload de uma imagem para o Twitter
 * Retorna o media_id para usar no tweet
 */
export async function uploadMedia(imageUrl: string): Promise<MediaUploadResponse> {
  if (!isTwitterConfigured()) {
    return { success: false, error: 'Twitter API não configurada' };
  }

  // Baixar imagem
  const base64Image = await downloadImageAsBase64(imageUrl);
  if (!base64Image) {
    return { success: false, error: 'Não foi possível baixar a imagem' };
  }

  // Verificar tamanho (máx 5MB para imagens)
  const sizeInBytes = Buffer.from(base64Image, 'base64').length;
  if (sizeInBytes > 5 * 1024 * 1024) {
    return { success: false, error: 'Imagem muito grande (máx 5MB)' };
  }

  try {
    console.log('[Twitter] Fazendo upload da imagem...');
    
    // Parâmetros do upload
    const bodyParams = {
      media_data: base64Image,
    };

    // Gerar header OAuth incluindo os parâmetros do body
    const authHeader = generateOAuthHeaderForUpload('POST', TWITTER_UPLOAD_URL, bodyParams);

    // Criar form data
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

    const data = await response.json() as {
      media_id_string?: string;
      error?: string;
      errors?: Array<{ message: string }>;
    };

    if (!response.ok) {
      console.error('[Twitter] Erro no upload:', data);
      const errorMsg = data.errors?.[0]?.message || data.error || 'Erro no upload';
      return { success: false, error: errorMsg };
    }

    const mediaId = data.media_id_string;
    console.log('[Twitter] Upload bem-sucedido, media_id:', mediaId);

    return { success: true, mediaId };
  } catch (error: any) {
    console.error('[Twitter] Erro no upload:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Posta um tweet no X (com ou sem imagem)
 */
export async function postTweet(text: string, mediaId?: string): Promise<TweetResponse> {
  if (!isTwitterConfigured()) {
    return {
      success: false,
      error: 'Twitter API não configurada. Configure as variáveis de ambiente.',
    };
  }

  // LOG: Verificar texto recebido
  console.log('[Twitter] 📤 Texto recebido para postar:');
  console.log('[Twitter] Texto completo:', JSON.stringify(text));
  console.log('[Twitter] Tamanho:', text.length, 'caracteres');
  console.log('[Twitter] Primeiros 200 chars:', text.substring(0, 200));
  console.log('[Twitter] Frase de abertura:', text.split('\n')[0]);
  console.log('[Twitter] Texto tem emoji?', /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑|💎|⭐|💰|💵|🍎|🌟|💪|⚡/u.test(text));

  // Validar tamanho do tweet (máx 280 caracteres)
  // OBRIGATÓRIO: Sempre manter preço e desconto, mesmo que precise remover abertura
  if (text.length > 280) {
    console.warn('[Twitter] ⚠️ Tweet muito longo, truncando...');
    const lines = text.split('\n');
    const link = lines[lines.length - 1] || '';
    const linkPart = '\n' + link;
    
    // Tentar encontrar linha com preço (geralmente contém "De", "Por", "R$")
    const priceLine = lines.find(line => 
      line.includes('R$') || 
      line.toLowerCase().includes('de ') || 
      line.toLowerCase().includes('por ') ||
      line.includes('% OFF')
    );
    
    if (priceLine) {
      // Se tem linha de preço, manter ela + link (remover abertura se necessário)
      const priceWithLink = priceLine + linkPart;
      if (priceWithLink.length <= 280) {
        text = priceWithLink;
        console.log('[Twitter] Texto truncado mantendo preço:', text);
      } else {
        // Se ainda não couber, manter apenas preço sem link (link será adicionado depois)
        text = priceLine;
        console.log('[Twitter] Texto truncado para apenas preço:', text);
      }
    } else {
      // Fallback: truncar mantendo abertura + link (mas avisar que preço foi perdido)
      const opening = lines[0] || '';
      const maxContentLength = 280 - link.length - 3;
      const truncatedContent = opening.substring(0, Math.max(20, maxContentLength - 3)) + '...';
      text = truncatedContent + linkPart;
      console.warn('[Twitter] ⚠️ ATENÇÃO: Preço foi removido no truncamento!');
      console.log('[Twitter] Texto truncado:', text);
    }
  }

  const url = `${TWITTER_API_BASE}/tweets`;

  try {
    const authHeader = generateOAuthHeader('POST', url);

    // Construir body do tweet
    const tweetBody: { text: string; media?: { media_ids: string[] } } = { text };
    
    console.log('[Twitter] 📤 Enviando tweet com texto:', text.substring(0, 150));
    
    // Adicionar mídia se fornecida
    if (mediaId) {
      tweetBody.media = { media_ids: [mediaId] };
      console.log('[Twitter] Postando com imagem, media_id:', mediaId);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });

    const data = await response.json() as {
      data?: { id?: string };
      detail?: string;
      title?: string;
    };

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
 * Posta um tweet com imagem
 * Faz upload da imagem e depois posta o tweet
 */
export async function postTweetWithImage(text: string, imageUrl: string): Promise<TweetResponse> {
  // LOG: Verificar texto recebido
  console.log('[Twitter] 📷 postTweetWithImage - Texto recebido:');
  console.log('[Twitter] Texto completo:', JSON.stringify(text));
  console.log('[Twitter] Tamanho:', text.length, 'caracteres');
  console.log('[Twitter] Frase de abertura:', text.split('\n')[0]);
  console.log('[Twitter] Texto tem emoji?', /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑|💎|⭐|💰|💵|🍎|🌟|💪|⚡/u.test(text));
  
  // VALIDAÇÃO: Garantir que o texto não está vazio
  if (!text || text.trim().length < 5) {
    console.error('[Twitter] ❌ ERRO: Texto está vazio ou muito curto em postTweetWithImage!');
    console.error('[Twitter] Texto recebido:', JSON.stringify(text));
    return { success: false, error: 'Texto do tweet está vazio' };
  }
  
  // 1. Fazer upload da imagem
  const uploadResult = await uploadMedia(imageUrl);
  
  if (!uploadResult.success || !uploadResult.mediaId) {
    console.error('[Twitter] Falha no upload, postando sem imagem...');
    // Postar sem imagem como fallback
    return postTweet(text);
  }
  
  // 2. Postar tweet com a imagem
  console.log('[Twitter] 📤 Enviando tweet com imagem e texto:', text.substring(0, 150));
  return postTweet(text, uploadResult.mediaId);
}

/**
 * 🎠 Posta um tweet com múltiplas imagens (até 4)
 * @param text - Texto do tweet
 * @param imageUrls - Array de URLs de imagens (1-4 imagens)
 */
export async function postTweetWithMultipleImages(
  text: string,
  imageUrls: string[]
): Promise<TweetResponse> {
  // LOG: Verificar texto recebido
  console.log('[Twitter] 📷 postTweetWithMultipleImages - Texto recebido:');
  console.log('[Twitter] Texto completo:', JSON.stringify(text));
  console.log('[Twitter] Tamanho:', text.length, 'caracteres');
  console.log('[Twitter] Frase de abertura:', text.split('\n')[0]);
  console.log('[Twitter] Texto tem emoji?', /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑|💎|⭐|💰|💵|🍎|🌟|💪|⚡/u.test(text));
  
  // VALIDAÇÃO: Garantir que o texto não está vazio
  if (!text || text.trim().length < 5) {
    console.error('[Twitter] ❌ ERRO: Texto está vazio ou muito curto em postTweetWithMultipleImages!');
    console.error('[Twitter] Texto recebido:', JSON.stringify(text));
    return { success: false, error: 'Texto do tweet está vazio' };
  }
  
  // 1. Fazer upload de todas as imagens
  const uploadResult = await uploadMultipleMedia(imageUrls);
  
  if (!uploadResult.success || !uploadResult.mediaIds || uploadResult.mediaIds.length === 0) {
    console.error('[Twitter] Falha no upload de múltiplas imagens, postando com primeira imagem...');
    // Fallback: tentar apenas primeira imagem
    if (imageUrls.length > 0) {
      return postTweetWithImage(text, imageUrls[0]);
    }
    // Último fallback: postar só texto
    return postTweet(text);
  }
  
  // 2. Postar tweet com todas as imagens
  console.log(`[Twitter] Postando tweet com ${uploadResult.mediaIds.length} imagens`);
  console.log('[Twitter] 📤 Texto que será enviado:', text.substring(0, 200));
  
  try {
    const body = {
      text,
      media: {
        media_ids: uploadResult.mediaIds, // Array de media IDs
      },
    };
    
    console.log('[Twitter] 📤 Body completo do tweet:', JSON.stringify({
      text: text.substring(0, 100),
      textLength: text.length,
      mediaCount: uploadResult.mediaIds.length,
    }));

    const response = await fetch(`${TWITTER_API_BASE}/tweets`, {
      method: 'POST',
      headers: {
        'Authorization': generateOAuthHeader('POST', `${TWITTER_API_BASE}/tweets`, body),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as { data?: { id: string; text: string }; errors?: any[] };

    if (!response.ok || data.errors) {
      const errorMsg = data.errors?.[0]?.message || `HTTP ${response.status}`;
      console.error('[Twitter] Erro ao postar tweet:', errorMsg);
      return { success: false, error: errorMsg };
    }

    if (data.data?.id) {
      console.log('[Twitter] ✅ Tweet postado com sucesso (múltiplas imagens):', data.data.id);
      return {
        success: true,
        tweetId: data.data.id,
        tweetUrl: `https://twitter.com/i/web/status/${data.data.id}`,
      };
    }

    return { success: false, error: 'Resposta inesperada da API' };
  } catch (error: any) {
    console.error('[Twitter] Erro ao postar tweet com múltiplas imagens:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Gera o texto do tweet a partir de uma oferta
 * 
 * IMPORTANTE:
 * - Usa o mesmo motor de cópia (generateCopies) que Telegram/Site
 * - Garante frases sarcásticas em MAIÚSCULAS + emojis também no X
 * - Mantém limite de 280 caracteres dentro de generateXCopy
 */
export function generateTweetText(offer: {
  title: string;
  originalPrice?: number;
  finalPrice: number;
  discount?: number;
  affiliateUrl?: string;
  storeName?: string;
}): string {
  const copies = generateCopies({
    title: offer.title,
    price: offer.finalPrice,
    oldPrice: offer.originalPrice ?? null,
    discountPct: offer.discount ?? 0,
    advertiserName: offer.storeName,
    storeName: offer.storeName,
    category: undefined,
    trackingUrl: offer.affiliateUrl ?? '',
  });

  // copies.x já vem no formato correto para o X (frases sarcásticas, MAIÚSCULAS, emojis, link no final)
  return copies.x;
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
  imageUrl?: string;
  images?: string[];
}): Promise<TweetResponse> {
  const tweetText = generateTweetText(offer);
  
  // 🎠 Se tem múltiplas imagens (2-4), usar carrossel
  if (offer.images && offer.images.length >= 2) {
    console.log(`[Twitter] Postando oferta com ${offer.images.length} imagens`);
    return postTweetWithMultipleImages(tweetText, offer.images.slice(0, 4)); // Máximo 4
  }
  
  // 📷 Se tem apenas 1 imagem (imageUrl ou images[0])
  const singleImage = offer.imageUrl || (offer.images && offer.images[0]);
  if (singleImage) {
    console.log('[Twitter] Postando oferta com 1 imagem');
    return postTweetWithImage(tweetText, singleImage);
  }
  
  // 📝 Sem imagens, só texto
  console.log('[Twitter] Postando oferta sem imagens');
  return postTweet(tweetText);
}
