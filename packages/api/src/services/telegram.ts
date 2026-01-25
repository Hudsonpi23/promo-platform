/**
 * Serviço de integração com Telegram Bot API
 * Envia mensagens e imagens para o canal de promoções
 */

import axios from 'axios';

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

  try {
    // Se tem imagem, envia como foto com caption
    if (options.imageUrl) {
      return await sendTelegramPhoto(options.imageUrl, options.text);
    }

    // Senão, envia só texto usando axios
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: options.text,
      parse_mode: options.parseMode || 'HTML',
      disable_web_page_preview: options.disableWebPagePreview ?? false,
    }, {
      timeout: 15000,
    });

    const data = response.data as TelegramResponse;

    if (!data.ok) {
      console.error('[Telegram] Erro ao enviar mensagem:', data.description);
      return { success: false, error: data.description || 'Erro desconhecido' };
    }

    console.log('[Telegram] Mensagem enviada com sucesso:', data.result?.message_id);
    return { success: true, messageId: data.result?.message_id };

  } catch (error: any) {
    console.error('[Telegram] Erro de conexão:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envia foto com caption para o canal
 */
export async function sendTelegramPhoto(photoUrl: string, caption: string): Promise<{ success: boolean; messageId?: number; error?: string; sentTextOnly?: boolean }> {
  if (!isTelegramConfigured()) {
    return { success: false, error: 'Telegram não configurado' };
  }

  try {
    console.log('[Telegram] Tentando enviar foto:', photoUrl.substring(0, 80));
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    
    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      photo: photoUrl,
      caption: caption,
      parse_mode: 'HTML',
    }, {
      timeout: 15000,
    });

    const data = response.data as TelegramResponse;

    if (!data.ok) {
      console.error('[Telegram] Erro ao enviar foto:', data.description);
      
      // SEMPRE tentar enviar só texto se foto falhar
      console.log('[Telegram] Foto falhou, enviando apenas texto...');
      const textResult = await sendTelegramMessage({ text: caption, disableWebPagePreview: false });
      
      // Retornar SUCESSO se conseguiu enviar o texto
      return {
        success: textResult.success,
        messageId: textResult.messageId,
        sentTextOnly: true,
        error: textResult.success ? undefined : textResult.error,
      };
    }

    console.log('[Telegram] Foto enviada com sucesso:', data.result?.message_id);
    return { success: true, messageId: data.result?.message_id, sentTextOnly: false };

  } catch (error: any) {
    console.error('[Telegram] Erro ao enviar foto:', error.response?.data || error.message);
    
    // Se der erro de rede ou API, tentar enviar só texto
    console.log('[Telegram] Erro capturado, tentando enviar apenas texto...');
    
    try {
      const textResult = await sendTelegramMessage({ text: caption, disableWebPagePreview: false });
      
      // Retornar SUCESSO se conseguiu enviar o texto
      return {
        success: textResult.success,
        messageId: textResult.messageId,
        sentTextOnly: true,
        error: textResult.success ? undefined : textResult.error,
      };
    } catch (fallbackError: any) {
      console.error('[Telegram] Falha total:', fallbackError.message);
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
    const media = images.map((imageUrl, index) => ({
      type: 'photo',
      media: imageUrl,
      ...(index === 0 && { caption, parse_mode: 'HTML' }), // Caption apenas na primeira
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
  const openers = [
    'Achei isso agora pouco 👀',
    'Olha esse preço!',
    'Fazia tempo que eu não via assim',
    'Pra quem tava esperando baixar...',
    'Vale a pena dar uma olhada',
  ];
  const opener = openers[Math.floor(Math.random() * openers.length)];

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
