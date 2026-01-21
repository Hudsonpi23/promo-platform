/**
 * Serviço de integração com Telegram Bot API
 * Envia mensagens e imagens para o canal de promoções
 */

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
 */
export async function sendTelegramMessage(options: SendMessageOptions): Promise<{ success: boolean; messageId?: number; error?: string }> {
  if (!isTelegramConfigured()) {
    return { success: false, error: 'Telegram não configurado' };
  }

  try {
    // Se tem imagem, envia como foto com caption
    if (options.imageUrl) {
      return await sendTelegramPhoto(options.imageUrl, options.text);
    }

    // Senão, envia só texto
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: options.text,
        parse_mode: options.parseMode || 'HTML',
        disable_web_page_preview: options.disableWebPagePreview ?? false,
      }),
    });

    const data = await response.json() as TelegramResponse;

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
export async function sendTelegramPhoto(photoUrl: string, caption: string): Promise<{ success: boolean; messageId?: number; error?: string }> {
  if (!isTelegramConfigured()) {
    return { success: false, error: 'Telegram não configurado' };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json() as TelegramResponse;

    if (!data.ok) {
      console.error('[Telegram] Erro ao enviar foto:', data.description);
      
      // Se falhar com foto, tenta enviar só o texto
      if (data.description?.includes('wrong file identifier') || data.description?.includes('failed to get HTTP URL')) {
        console.log('[Telegram] Tentando enviar apenas texto...');
        return await sendTelegramMessage({ text: caption, disableWebPagePreview: false });
      }
      
      return { success: false, error: data.description || 'Erro desconhecido' };
    }

    console.log('[Telegram] Foto enviada com sucesso:', data.result?.message_id);
    return { success: true, messageId: data.result?.message_id };

  } catch (error: any) {
    console.error('[Telegram] Erro de conexão:', error.message);
    return { success: false, error: error.message };
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
    const response = await fetch(url);
    const data = await response.json() as TelegramResponse;

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
