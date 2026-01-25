/**
 * Serviço de integração com Meta Graph API (Facebook)
 * Publica posts na página do Facebook
 */

// Suporte para múltiplas páginas - configuração centralizada
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';
const META_API_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// IDs e Tokens das páginas do Facebook (suporte legacy e novo formato)
const FACEBOOK_PAGES = [
  {
    name: 'Manu Das Promoções',
    pageId: process.env.META_PAGE_1_ID || process.env.META_PAGE_ID,
    accessToken: process.env.META_PAGE_1_TOKEN || process.env.META_PAGE_ACCESS_TOKEN,
  },
  {
    name: 'Manu Promoções de Tecnologia',
    pageId: process.env.META_PAGE_2_ID,
    accessToken: process.env.META_PAGE_2_TOKEN || process.env.META_PAGE_2_ACCESS_TOKEN,
  },
].filter(p => p.pageId && p.accessToken);

// Página padrão (primeira configurada)
const DEFAULT_PAGE = FACEBOOK_PAGES[0];
const META_PAGE_ID = DEFAULT_PAGE?.pageId;
const META_PAGE_ACCESS_TOKEN = DEFAULT_PAGE?.accessToken;

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
  const isConfigured = FACEBOOK_PAGES.length > 0;
  
  // Log detalhado para debug
  console.log('[Facebook] Verificando configuração:');
  console.log(`  - Páginas configuradas: ${FACEBOOK_PAGES.length}`);
  FACEBOOK_PAGES.forEach((page, idx) => {
    console.log(`  - Página ${idx + 1}: ${page.name} (ID: ${page.pageId?.substring(0, 10)}...)`);
  });
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

/**
 * 🎠 Publica um carrossel de imagens na página do Facebook
 * @param message - Texto do post
 * @param images - Array de URLs de imagens (2-10 imagens)
 */
export async function postToFacebookCarousel(
  message: string,
  images: string[]
): Promise<FacebookPostResult> {
  if (!isFacebookConfigured()) {
    return { success: false, error: 'Facebook não configurado' };
  }

  // Validar número de imagens (2-10)
  if (images.length < 2 || images.length > 10) {
    console.error('[Facebook] Carrossel precisa ter entre 2 e 10 imagens');
    return { success: false, error: 'Carrossel precisa ter entre 2 e 10 imagens' };
  }

  try {
    console.log(`[Facebook] Criando carrossel com ${images.length} imagens`);
    
    // Passo 1: Upload de cada imagem sem publicar (published=false)
    const photoIds: string[] = [];
    
    for (const imageUrl of images) {
      const uploadUrl = `${META_API_BASE}/${META_PAGE_ID}/photos`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: imageUrl,
          published: false, // Não publicar ainda
          access_token: META_PAGE_ACCESS_TOKEN,
        }),
      });

      const uploadData = await uploadResponse.json() as any;

      if (uploadData.error || !uploadData.id) {
        console.error('[Facebook] Erro ao fazer upload de imagem:', uploadData.error);
        // Fallback: usar primeira imagem apenas
        return await postToFacebookWithImage(message, images[0]);
      }

      photoIds.push(uploadData.id);
      console.log(`[Facebook] Imagem ${photoIds.length}/${images.length} uploaded: ${uploadData.id}`);
    }

    // Passo 2: Criar post com as imagens em carrossel
    const feedUrl = `${META_API_BASE}/${META_PAGE_ID}/feed`;
    
    const attachedMedia = photoIds.map(id => ({ media_fbid: id }));
    
    const postResponse = await fetch(feedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        attached_media: attachedMedia,
        access_token: META_PAGE_ACCESS_TOKEN,
      }),
    });

    const postData = await postResponse.json() as any;

    if (postData.error) {
      console.error('[Facebook] Erro ao criar post com carrossel:', postData.error);
      return { 
        success: false, 
        error: postData.error.message || 'Erro ao criar carrossel no Facebook' 
      };
    }

    if (postData.id) {
      const postId = postData.id;
      const postUrl = `https://facebook.com/${postId}`;
      
      console.log('[Facebook] Carrossel publicado com sucesso:', postId);
      return { success: true, postId, postUrl };
    }

    return { success: false, error: 'Resposta inesperada da API' };

  } catch (error: any) {
    console.error('[Facebook] Erro ao criar carrossel:', error);
    // Fallback: tentar publicar primeira imagem apenas
    return await postToFacebookWithImage(message, images[0]);
  }
}

// ==================== MULTI-PAGE SUPPORT ====================

/**
 * Posta em múltiplas páginas do Facebook
 * Suporta: texto, imagem única ou carrossel (2-10 imagens)
 */
export async function postToPages(
  message: string,
  imageUrl?: string,
  images?: string[]
): Promise<Record<string, { success: boolean; postId?: string; error?: string }>> {
  const results: Record<string, { success: boolean; postId?: string; error?: string }> = {};

  if (FACEBOOK_PAGES.length === 0) {
    console.warn('[Facebook] Nenhuma página configurada');
    return { default: { success: false, error: 'Nenhuma página configurada' } };
  }

  // Determinar se é carrossel (2+ imagens)
  const allImages = images && images.length >= 2 ? images : (imageUrl ? [imageUrl] : []);
  const isCarousel = allImages.length >= 2;

  for (const page of FACEBOOK_PAGES) {
    console.log(`[Facebook] Postando em: ${page.name} ${isCarousel ? `(carrossel com ${allImages.length} imagens)` : ''}`);
    
    try {
      // 🎠 Se é carrossel (2+ imagens)
      if (isCarousel) {
        // Passo 1: Upload de cada imagem sem publicar
        const photoIds: string[] = [];
        
        for (const img of allImages) {
          const uploadUrl = `${META_API_BASE}/${page.pageId}/photos`;
          
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: img,
              published: false,
              access_token: page.accessToken,
            }),
          });

          const uploadData = await uploadResponse.json() as any;

          if (uploadData.error || !uploadData.id) {
            console.error(`[Facebook] Erro ao fazer upload de imagem em ${page.name}:`, uploadData.error);
            throw new Error(uploadData.error?.message || 'Erro no upload');
          }

          photoIds.push(uploadData.id);
        }

        // Passo 2: Criar post com carrossel
        const feedUrl = `${META_API_BASE}/${page.pageId}/feed`;
        const attachedMedia = photoIds.map(id => ({ media_fbid: id }));
        
        const postResponse = await fetch(feedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            attached_media: attachedMedia,
            access_token: page.accessToken,
          }),
        });

        const postData = await postResponse.json() as any;

        if (postData.error) {
          throw new Error(postData.error.message || 'Erro ao criar carrossel');
        }

        if (postData.id) {
          console.log(`[Facebook] ✅ ${page.name}: carrossel ${postData.id}`);
          results[page.pageId!] = {
            success: true,
            postId: postData.id,
          };
        } else {
          throw new Error('Resposta inesperada');
        }
      }
      // 📷 Se é imagem única
      else if (allImages.length === 1) {
        const url = `${META_API_BASE}/${page.pageId}/photos`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            url: allImages[0],
            access_token: page.accessToken,
          }),
        });

        const data = await response.json() as any;

        if (data.error) {
          throw new Error(data.error.message);
        } else if (data.id || data.post_id) {
          const postId = data.post_id || data.id;
          console.log(`[Facebook] ✅ ${page.name}: ${postId}`);
          results[page.pageId!] = {
            success: true,
            postId,
          };
        } else {
          throw new Error('Resposta inesperada');
        }
      }
      // 📝 Se é só texto
      else {
        const url = `${META_API_BASE}/${page.pageId}/feed`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            access_token: page.accessToken,
          }),
        });

        const data = await response.json() as any;

        if (data.error) {
          throw new Error(data.error.message);
        } else if (data.id) {
          console.log(`[Facebook] ✅ ${page.name}: ${data.id}`);
          results[page.pageId!] = {
            success: true,
            postId: data.id,
          };
        } else {
          throw new Error('Resposta inesperada');
        }
      }
    } catch (error: any) {
      console.error(`[Facebook] Erro em ${page.name}:`, error.message);
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
