/**
 * Serviço de integração com Meta Graph API (Facebook)
 * Publica posts na página do Facebook
 */

const META_PAGE_ID = process.env.META_PAGE_ID;
const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';

const META_API_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface FacebookPostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

/**
 * Verifica se o Facebook está configurado
 */
export function isFacebookConfigured(): boolean {
  const isConfigured = !!(META_PAGE_ID && META_PAGE_ACCESS_TOKEN);
  
  // Log detalhado para debug
  console.log('[Facebook] Verificando configuração:');
  console.log('  - META_PAGE_ID:', META_PAGE_ID ? `${META_PAGE_ID.substring(0, 10)}...` : 'VAZIO');
  console.log('  - META_PAGE_ACCESS_TOKEN:', META_PAGE_ACCESS_TOKEN ? 'CONFIGURADO' : 'VAZIO');
  console.log('  - Configurado:', isConfigured);
  
  return isConfigured;
}

/**
 * Publica um post de texto na página do Facebook
 */
export async function postToFacebook(message: string): Promise<FacebookPostResult> {
  if (!isFacebookConfigured()) {
    return { success: false, error: 'Facebook não configurado. Configure META_PAGE_ID e META_PAGE_ACCESS_TOKEN.' };
  }

  try {
    const url = `${META_API_BASE}/${META_PAGE_ID}/feed`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        access_token: META_PAGE_ACCESS_TOKEN,
      }),
    });

    const data = await response.json() as any;

    if (data.error) {
      console.error('[Facebook] Erro na API:', data.error);
      return { 
        success: false, 
        error: data.error.message || 'Erro ao publicar no Facebook' 
      };
    }

    if (data.id) {
      const postId = data.id;
      const postUrl = `https://facebook.com/${postId}`;
      
      console.log('[Facebook] Post publicado com sucesso:', postId);
      return { success: true, postId, postUrl };
    }

    return { success: false, error: 'Resposta inesperada da API' };

  } catch (error: any) {
    console.error('[Facebook] Erro de rede:', error);
    return { success: false, error: error.message || 'Erro de conexão com Facebook' };
  }
}

/**
 * Publica um post com link na página do Facebook
 */
export async function postToFacebookWithLink(
  message: string, 
  link: string
): Promise<FacebookPostResult> {
  if (!isFacebookConfigured()) {
    return { success: false, error: 'Facebook não configurado' };
  }

  try {
    const url = `${META_API_BASE}/${META_PAGE_ID}/feed`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        link,
        access_token: META_PAGE_ACCESS_TOKEN,
      }),
    });

    const data = await response.json() as any;

    if (data.error) {
      console.error('[Facebook] Erro na API:', data.error);
      return { 
        success: false, 
        error: data.error.message || 'Erro ao publicar no Facebook' 
      };
    }

    if (data.id) {
      const postId = data.id;
      const postUrl = `https://facebook.com/${postId}`;
      
      console.log('[Facebook] Post com link publicado:', postId);
      return { success: true, postId, postUrl };
    }

    return { success: false, error: 'Resposta inesperada da API' };

  } catch (error: any) {
    console.error('[Facebook] Erro de rede:', error);
    return { success: false, error: error.message || 'Erro de conexão com Facebook' };
  }
}

/**
 * Publica um post com imagem na página do Facebook
 */
export async function postToFacebookWithImage(
  message: string, 
  imageUrl: string
): Promise<FacebookPostResult> {
  if (!isFacebookConfigured()) {
    return { success: false, error: 'Facebook não configurado' };
  }

  try {
    const url = `${META_API_BASE}/${META_PAGE_ID}/photos`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        url: imageUrl,
        access_token: META_PAGE_ACCESS_TOKEN,
      }),
    });

    const data = await response.json() as any;

    if (data.error) {
      console.error('[Facebook] Erro na API:', data.error);
      return { 
        success: false, 
        error: data.error.message || 'Erro ao publicar foto no Facebook' 
      };
    }

    if (data.id || data.post_id) {
      const postId = data.post_id || data.id;
      const postUrl = `https://facebook.com/${postId}`;
      
      console.log('[Facebook] Foto publicada:', postId);
      return { success: true, postId, postUrl };
    }

    return { success: false, error: 'Resposta inesperada da API' };

  } catch (error: any) {
    console.error('[Facebook] Erro de rede:', error);
    return { success: false, error: error.message || 'Erro de conexão com Facebook' };
  }
}

// ==================== MULTI-PAGE SUPPORT ====================

// IDs e Tokens das duas páginas do Facebook
const FACEBOOK_PAGES = [
  {
    name: 'Manu Das Promoções',
    pageId: process.env.META_PAGE_1_ID || process.env.FB_PAGE_ID_1 || process.env.META_PAGE_ID,
    accessToken: process.env.META_PAGE_1_TOKEN || process.env.FB_PAGE_TOKEN_1 || process.env.META_PAGE_ACCESS_TOKEN,
  },
  {
    name: 'Manu Promoções de Tecnologia',
    pageId: process.env.META_PAGE_2_ID || process.env.FB_PAGE_ID_2,
    accessToken: process.env.META_PAGE_2_TOKEN || process.env.FB_PAGE_TOKEN_2,
  },
].filter(p => p.pageId && p.accessToken);

/**
 * Posta em múltiplas páginas do Facebook
 */
export async function postToPages(
  message: string,
  imageUrl?: string
): Promise<Record<string, { success: boolean; postId?: string; error?: string }>> {
  const results: Record<string, { success: boolean; postId?: string; error?: string }> = {};

  if (FACEBOOK_PAGES.length === 0) {
    console.warn('[Facebook] Nenhuma página configurada');
    return { default: { success: false, error: 'Nenhuma página configurada' } };
  }

  for (const page of FACEBOOK_PAGES) {
    console.log(`[Facebook] Postando em: ${page.name}`);
    
    try {
      const url = imageUrl
        ? `${META_API_BASE}/${page.pageId}/photos`
        : `${META_API_BASE}/${page.pageId}/feed`;

      const body: any = {
        message,
        access_token: page.accessToken,
      };

      if (imageUrl) {
        body.url = imageUrl;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json() as any;

      if (data.error) {
        console.error(`[Facebook] Erro em ${page.name}:`, data.error);
        results[page.pageId!] = {
          success: false,
          error: data.error.message,
        };
      } else if (data.id || data.post_id) {
        const postId = data.post_id || data.id;
        console.log(`[Facebook] ✅ ${page.name}: ${postId}`);
        results[page.pageId!] = {
          success: true,
          postId,
        };
      } else {
        results[page.pageId!] = {
          success: false,
          error: 'Resposta inesperada',
        };
      }
    } catch (error: any) {
      results[page.pageId!] = {
        success: false,
        error: error.message,
      };
    }
  }

  return results;
}

/**
 * Gera texto para post do Facebook a partir de uma oferta
 */
export function generateFacebookPost(offer: {
  title: string;
  originalPrice?: number;
  finalPrice: number;
  discountPct?: number;
  affiliateUrl: string;
  storeName?: string;
}): string {
  const { title, originalPrice, finalPrice, discountPct, affiliateUrl, storeName } = offer;

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  let text = `🔥 ${title}\n\n`;

  if (originalPrice && originalPrice > finalPrice) {
    text += `De ${formatPrice(originalPrice)} por ${formatPrice(finalPrice)}`;
    if (discountPct && discountPct > 0) {
      text += ` (-${discountPct}% OFF!)`;
    }
    text += '\n\n';
  } else {
    text += `Por apenas ${formatPrice(finalPrice)}\n\n`;
  }

  if (storeName) {
    text += `📦 ${storeName}\n\n`;
  }

  text += `👉 Aproveite: ${affiliateUrl}`;

  return text;
}
