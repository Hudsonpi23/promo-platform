/**
 * Serviço de integração com Telegram Bot API
 * Envia mensagens e imagens para o canal de promoções
 */

import axios from 'axios';
import FormData from 'form-data';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
}

interface SendMessageOptions {
  text: string;
  imageUrl?: string;
  chatId?: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
}

/**
 * Verifica se o Telegram está configurado
 */
export function isTelegramConfigured(): boolean {
  return !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
}

/**
 * Envia mensagem de texto para o canal
 * @param textOrOptions - Texto da mensagem ou objeto com opções
 * @param imageUrl - URL da imagem (opcional, se textOrOptions for string)
 */
export async function sendTelegramMessage(
  textOrOptions: string | SendMessageOptions,
  imageUrl?: string
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  // Normaliza para objeto de opções
  const options: SendMessageOptions = typeof textOrOptions === 'string'
    ? { text: textOrOptions, imageUrl }
    : textOrOptions;
  if (!isTelegramConfigured()) {
    return { success: false, error: 'Telegram não configurado' };
  }

  // VALIDAÇÃO: Garantir que tem texto
  if (!options.text || options.text.trim().length === 0) {
    console.error('[Telegram] ERRO: Tentando enviar mensagem sem texto!');
    return { success: false, error: 'Texto da mensagem está vazio' };
  }

  try {
    // Se tem imagem, envia como foto com caption
    if (options.imageUrl) {
      console.log('[Telegram] Enviando foto com caption. Tamanho do caption:', options.text.length);
      return await sendTelegramPhoto(options.imageUrl, options.text, options.chatId);
    }

    // Senão, envia só texto usando axios
    // SEM parse_mode - texto simples em MAIÚSCULAS com emojis
    
    // VALIDAÇÃO CRÍTICA: Garantir que o texto não está vazio
    if (!options.text || options.text.trim().length === 0) {
      console.error('[Telegram] ❌ ERRO CRÍTICO: Tentando enviar mensagem de texto vazia!');
      return { success: false, error: 'Texto da mensagem está vazio' };
    }
    
    // VALIDAÇÃO: Garantir que há conteúdo além do link
    const textLines = options.text.split('\n').filter(line => line.trim().length > 0);
    if (textLines.length <= 1) {
      console.error('[Telegram] ❌ ERRO: Texto contém apenas o link!');
      console.error('[Telegram] Texto recebido:', JSON.stringify(options.text));
      // Não retornar erro, mas avisar - o texto será enviado mesmo assim
      console.warn('[Telegram] ⚠️ Enviando mesmo assim, mas pode não aparecer no Telegram');
    }
    
    console.log('[Telegram] 📤 Enviando mensagem de texto:');
    console.log('[Telegram] Tamanho do texto:', options.text.length, 'caracteres');
    console.log('[Telegram] Linhas não vazias:', textLines.length);
    console.log('[Telegram] Primeira linha (link):', textLines[0]?.substring(0, 80));
    console.log('[Telegram] Resto do texto:', textLines.slice(1).join('\n').substring(0, 300));
    console.log('[Telegram] Texto COMPLETO:', JSON.stringify(options.text));
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await axios.post(url, {
      chat_id: options.chatId || TELEGRAM_CHAT_ID,
      text: options.text,
      // SEM parse_mode - texto simples
      disable_web_page_preview: options.disableWebPagePreview ?? false,
    }, {
      timeout: 30000, // 30 segundos
      maxRedirects: 5,
    });

    const data = response.data as TelegramResponse;

    if (!data.ok) {
      console.error('[Telegram] ❌ Erro ao enviar mensagem:', data.description);
      console.error('[Telegram] Resposta completa:', JSON.stringify(data, null, 2));
      return { success: false, error: data.description || 'Erro desconhecido' };
    }

    // VALIDAÇÃO: Verificar se o texto foi realmente enviado
    const sentText = data.result?.text || '';
    if (!sentText || sentText.trim().length === 0) {
      console.error('[Telegram] ⚠️ PROBLEMA: Mensagem enviada mas texto está vazio na resposta!');
      console.error('[Telegram] Resposta da API:', JSON.stringify(data.result, null, 2));
    } else {
      console.log('[Telegram] ✅ Mensagem enviada com sucesso!');
      console.log('[Telegram] Message ID:', data.result?.message_id);
      console.log('[Telegram] Texto enviado (primeiros 150 chars):', sentText.substring(0, 150));
    }
    
    return { success: true, messageId: data.result?.message_id };

  } catch (error: any) {
    console.error('[Telegram] Erro de conexão:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envia foto com caption para o canal
 */
async function downloadImageBuffer(imageUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    console.log('[Telegram] 📥 Baixando imagem:', imageUrl.substring(0, 100));
    const resp = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://www.mercadolivre.com.br/',
      },
    });
    const contentType = resp.headers['content-type'] || 'image/jpeg';
    console.log('[Telegram] ✅ Imagem baixada:', resp.data.length, 'bytes, tipo:', contentType);
    return { buffer: Buffer.from(resp.data), contentType };
  } catch (err: any) {
    console.error('[Telegram] ❌ Falha ao baixar imagem:', err.message);
    return null;
  }
}

export async function sendTelegramPhoto(photoUrl: string, caption: string, chatId?: string): Promise<{ success: boolean; messageId?: number; error?: string; sentTextOnly?: boolean; photoMessageId?: number }> {
  if (!isTelegramConfigured()) {
    return { success: false, error: 'Telegram não configurado' };
  }

  if (!photoUrl || !photoUrl.trim() || !photoUrl.startsWith('http')) {
    console.error('[Telegram] ❌ URL da foto inválida:', photoUrl);
    return { success: false, error: 'URL da foto inválida' };
  }

  if (!caption || caption.trim().length === 0) {
    console.error('[Telegram] ❌ Caption vazio!');
    return { success: false, error: 'Caption da foto está vazio' };
  }

  let finalCaption = caption;
  if (caption.length > 1024) {
    finalCaption = caption.substring(0, 1021) + '...';
  }
  finalCaption = finalCaption.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  const targetChatId = chatId || TELEGRAM_CHAT_ID;

  try {
    // Estratégia: baixar a imagem no servidor e enviar como upload multipart
    const img = await downloadImageBuffer(photoUrl);

    if (img) {
      const ext = photoUrl.includes('.webp') ? 'webp' : photoUrl.includes('.png') ? 'png' : 'jpg';
      const form = new FormData();
      form.append('chat_id', targetChatId!);
      form.append('caption', finalCaption);
      form.append('photo', img.buffer, { filename: `product.${ext}`, contentType: img.contentType });

      console.log('[Telegram] 📤 Enviando foto via upload multipart...');
      const response = await axios.post(apiUrl, form, {
        headers: form.getHeaders(),
        timeout: 30000,
      });

      const data = response.data as TelegramResponse;
      if (data.ok) {
        console.log('[Telegram] ✅ Foto enviada com sucesso via upload! ID:', data.result?.message_id);
        return { success: true, messageId: data.result?.message_id, sentTextOnly: false };
      }
      console.error('[Telegram] ❌ Upload falhou:', data.description);
    }

    // Fallback 1: tentar enviar pela URL diretamente
    console.log('[Telegram] 🔄 Tentando enviar foto por URL direta...');
    const urlResp = await axios.post(apiUrl, {
      chat_id: targetChatId,
      photo: photoUrl,
      caption: finalCaption,
    }, { timeout: 30000 });

    const urlData = urlResp.data as TelegramResponse;
    if (urlData.ok) {
      console.log('[Telegram] ✅ Foto enviada por URL! ID:', urlData.result?.message_id);
      return { success: true, messageId: urlData.result?.message_id, sentTextOnly: false };
    }
    console.error('[Telegram] ❌ URL direta falhou:', urlData.description);

    // Fallback 2: enviar só texto
    console.log('[Telegram] 🔄 Enviando apenas texto como fallback...');
    const textResult = await sendTelegramMessage({ text: caption, disableWebPagePreview: false });
    return {
      success: textResult.success,
      messageId: textResult.messageId,
      sentTextOnly: true,
      error: textResult.success ? undefined : textResult.error,
    };

  } catch (error: any) {
    console.error('[Telegram] ❌ Erro ao enviar foto:', error.response?.data || error.message);

    try {
      const textResult = await sendTelegramMessage({ text: caption, disableWebPagePreview: false });
      return {
        success: textResult.success,
        messageId: textResult.messageId,
        sentTextOnly: true,
        error: textResult.success ? undefined : textResult.error,
      };
    } catch (fallbackError: any) {
      console.error('[Telegram] ❌ Falha total:', fallbackError.message);
      return {
        success: false,
        error: `Foto e texto falharam: ${error.response?.data?.description || error.message}`,
        sentTextOnly: false,
      };
    }
  }
}

/**
 * 🎠 Envia carrossel de imagens (media group) para o canal
 * @param images - Array de URLs de imagens (2-10 imagens)
 * @param caption - Texto do post (apenas na primeira imagem)
 */
export async function sendTelegramMediaGroup(
  images: string[],
  caption: string
): Promise<{ success: boolean; messageId?: number; error?: string; sentTextOnly?: boolean }> {
  if (!isTelegramConfigured()) {
    return { success: false, error: 'Telegram não configurado' };
  }

  // Validar número de imagens (2-10)
  if (images.length < 2 || images.length > 10) {
    console.error('[Telegram] Media group precisa ter entre 2 e 10 imagens');
    return { success: false, error: 'Media group precisa ter entre 2 e 10 imagens' };
  }

  try {
    console.log(`[Telegram] Tentando enviar media group com ${images.length} imagens`);
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`;
    
    // Montar array de media (primeira imagem com caption, resto sem)
    // SEM parse_mode - texto simples em MAIÚSCULAS com emojis
    const media = images.map((imageUrl, index) => ({
      type: 'photo',
      media: imageUrl,
      ...(index === 0 && { caption }), // Caption apenas na primeira (sem parse_mode)
    }));
    
    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      media,
    }, {
      timeout: 20000, // Mais tempo para múltiplas imagens
    });

    const data = response.data as TelegramResponse;

    if (!data.ok) {
      console.error('[Telegram] Erro ao enviar media group:', data.description);
      
      // Fallback: enviar primeira imagem com caption
      console.log('[Telegram] Media group falhou, tentando enviar primeira imagem...');
      return await sendTelegramPhoto(images[0], caption);
    }

    const messageId = data.result?.[0]?.message_id; // ID da primeira mensagem do grupo
    console.log('[Telegram] Media group enviado com sucesso:', messageId);
    return { success: true, messageId, sentTextOnly: false };

  } catch (error: any) {
    console.error('[Telegram] Erro ao enviar media group:', error.response?.data || error.message);
    
    // Fallback: tentar enviar só a primeira imagem
    console.log('[Telegram] Erro capturado, tentando enviar primeira imagem...');
    return await sendTelegramPhoto(images[0], caption);
  }
}

/**
 * Formata o texto da promoção para o Telegram
 */
export function formatTelegramPost(offer: {
  title: string;
  originalPrice?: number | null;
  finalPrice: number;
  discountPct?: number | null;
  affiliateUrl: string;
  storeName?: string;
  copyText?: string;
}): string {
  // Se já tem copyText formatado, usar ele
  if (offer.copyText) {
    // Adicionar link no final se não tiver
    if (!offer.copyText.includes('http')) {
      return `${offer.copyText}\n\n👉 ${offer.affiliateUrl}`;
    }
    return offer.copyText;
  }

  // Formatar preços
  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  // Montar texto no estilo "Manu"
  // 💎 Detectar se é JOIA (Monte Carlo, etc)
  const isJewelry = offer.storeName?.toLowerCase().includes('joia') || 
                    offer.storeName?.toLowerCase().includes('monte carlo') ||
                    offer.title?.toLowerCase().includes('brinco') ||
                    offer.title?.toLowerCase().includes('anel') ||
                    offer.title?.toLowerCase().includes('colar') ||
                    offer.title?.toLowerCase().includes('pulseira');

  let opener;
  
  if (isJewelry) {
    // 💎 Frases especiais para JOIAS
    const jewelryOpeners = [
      'Que presente lindo! 💎',
      'Com essa joia você vai arrasar! ✨',
      'Presente perfeito para impressionar! 💍',
      'Olha que charme! 💎',
      'Elegância que cabe no bolso! ✨',
      'Luxo acessível! 💍',
      'Presente que vai encantar! 💎',
    ];
    opener = jewelryOpeners[Math.floor(Math.random() * jewelryOpeners.length)];
  } else {
    // 🛒 Frases genéricas para outros produtos
    const openers = [
      'Achei isso agora pouco 👀',
      'Olha esse preço!',
      'Fazia tempo que eu não via assim',
      'Pra quem tava esperando baixar...',
      'Vale a pena dar uma olhada',
    ];
    opener = openers[Math.floor(Math.random() * openers.length)];
  }

  let text = `${opener}\n\n`;
  text += `<b>${offer.title}</b>\n\n`;

  if (offer.originalPrice && offer.discountPct) {
    text += `De <s>${formatPrice(offer.originalPrice)}</s> por <b>${formatPrice(offer.finalPrice)}</b>`;
    text += ` (-${offer.discountPct}%)\n\n`;
  } else {
    text += `Por apenas <b>${formatPrice(offer.finalPrice)}</b>\n\n`;
  }

  if (offer.storeName) {
    text += `📦 ${offer.storeName}\n\n`;
  }

  text += `👉 ${offer.affiliateUrl}`;

  return text;
}

/**
 * Testa a conexão com o bot do Telegram
 */
export async function testTelegramConnection(): Promise<{ success: boolean; botName?: string; error?: string }> {
  if (!isTelegramConfigured()) {
    return { success: false, error: 'Telegram não configurado' };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data as TelegramResponse;

    if (!data.ok) {
      return { success: false, error: data.description || 'Erro ao conectar' };
    }

    return { 
      success: true, 
      botName: data.result?.username || data.result?.first_name 
    };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
