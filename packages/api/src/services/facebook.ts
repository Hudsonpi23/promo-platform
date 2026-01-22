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
  return !!(META_PAGE_ID && META_PAGE_ACCESS_TOKEN);
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
