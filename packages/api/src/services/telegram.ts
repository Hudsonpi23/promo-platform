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
export async function sendTelegramPhoto(photoUrl: string, caption: string, chatId?: string): Promise<{ success: boolean; messageId?: number; error?: string; sentTextOnly?: boolean; photoMessageId?: number }> {
  if (!isTelegramConfigured()) {
    return { success: false, error: 'Telegram não configurado' };
  }

  // VALIDAÇÃO: Garantir que tem URL de foto válida
  if (!photoUrl || !photoUrl.trim()) {
    console.error('[Telegram] ❌ ERRO: URL da foto está vazia ou nula!');
    console.error('[Telegram] photoUrl recebido:', photoUrl);
    return { success: false, error: 'URL da foto está vazia ou nula' };
  }
  
  if (!photoUrl.startsWith('http')) {
    console.error('[Telegram] ❌ ERRO: URL da foto não começa com http!', photoUrl);
    return { success: false, error: 'URL da foto está inválida (não começa com http)' };
  }
  
  // VALIDAÇÃO: Verificar se a URL parece ser uma imagem válida
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const hasImageExtension = imageExtensions.some(ext => photoUrl.toLowerCase().includes(ext));
  const isImageUrl = hasImageExtension || photoUrl.includes('image') || photoUrl.includes('photo');
  
  if (!isImageUrl && !photoUrl.includes('http')) {
    console.warn('[Telegram] ⚠️ URL pode não ser uma imagem válida:', photoUrl.substring(0, 100));
  }
  
  console.log('[Telegram] ✅ URL da foto validada:', photoUrl.substring(0, 100));

  // VALIDAÇÃO: Garantir que tem caption
  if (!caption || caption.trim().length === 0) {
    console.error('[Telegram] ERRO: Tentando enviar foto sem caption!');
    return { success: false, error: 'Caption da foto está vazio' };
  }

  try {
    console.log('[Telegram] 📷 Enviando foto com caption');
    console.log('[Telegram] URL da foto:', photoUrl.substring(0, 100));
    console.log('[Telegram] Caption (primeiros 150 chars):', caption.substring(0, 150));
    console.log('[Telegram] Tamanho do caption:', caption.length, 'caracteres');
    
    // Telegram tem limite de 1024 caracteres para caption
    let finalCaption = caption;
    if (caption.length > 1024) {
      console.warn('[Telegram] Caption muito longo, truncando para 1024 caracteres');
      finalCaption = caption.substring(0, 1021) + '...';
    }
    
    // VALIDAÇÃO CRÍTICA: Garantir que o caption não está vazio após processamento
    if (!finalCaption || finalCaption.trim().length === 0) {
      console.error('[Telegram] ❌ ERRO CRÍTICO: Caption ficou vazio após processamento!');
      console.error('[Telegram] Caption original:', caption.substring(0, 200));
      return { success: false, error: 'Caption está vazio após processamento' };
    }
    
    // VALIDAÇÃO: Verificar se há caracteres problemáticos
    const problematicChars = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/;
    if (problematicChars.test(finalCaption)) {
      console.warn('[Telegram] ⚠️ Caption contém caracteres de controle, removendo...');
      finalCaption = finalCaption.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    }
    
    console.log('[Telegram] ✅ Caption validado e pronto para envio');
    console.log('[Telegram] Tamanho final do caption:', finalCaption.length, 'caracteres');
    console.log('[Telegram] Preview do caption completo:', finalCaption);
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    
    // IMPORTANTE: Telegram pode rejeitar caption se houver problemas
    // Vamos garantir que o caption está em formato válido
    // SEM parse_mode - texto simples (Telegram processa melhor assim)
    
    const payload = {
      chat_id: chatId || TELEGRAM_CHAT_ID,
      photo: photoUrl,
      caption: finalCaption,
      // SEM parse_mode - texto simples em MAIÚSCULAS
    };
    
    console.log('[Telegram] 📤 Payload sendo enviado (sem photo URL):', {
      chat_id: payload.chat_id,
      caption_length: payload.caption.length,
      caption_preview: payload.caption.substring(0, 100),
    });
    
    const response = await axios.post(url, payload, {
      timeout: 30000, // 30 segundos
      maxRedirects: 5,
    });

    const data = response.data as TelegramResponse;

    if (!data.ok) {
      console.error('[Telegram] ❌ Erro ao enviar foto:', data.description);
      console.error('[Telegram] Resposta completa da API:', JSON.stringify(data, null, 2));
      
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

    // VALIDAÇÃO CRÍTICA: Verificar se o caption foi realmente enviado
    const sentCaption = data.result?.caption || '';
    
    if (!sentCaption || sentCaption.trim().length === 0) {
      console.error('[Telegram] ⚠️ PROBLEMA: Foto enviada mas CAPTION ESTÁ VAZIO na resposta!');
      console.error('[Telegram] Caption que tentamos enviar:', finalCaption.substring(0, 300));
      
      // VALIDAÇÃO: Verificar se o caption que tentamos enviar tem conteúdo além do link
      const captionLines = finalCaption.split('\n').filter(line => line.trim().length > 0);
      console.log('[Telegram] Linhas do caption enviado:', captionLines.length);
      console.log('[Telegram] Primeira linha (link):', captionLines[0]?.substring(0, 80));
      console.log('[Telegram] Resto do caption:', captionLines.slice(1).join(' | ').substring(0, 200));
      
      if (captionLines.length <= 1) {
        console.error('[Telegram] ❌ ERRO CRÍTICO: O caption que tentamos enviar tinha apenas o link!');
        console.error('[Telegram] Caption completo:', JSON.stringify(finalCaption));
        // Não enviar mensagem separada se o caption já estava vazio - problema na geração
        return { 
          success: true, 
          messageId: data.result?.message_id, 
          sentTextOnly: false,
          error: 'Caption estava vazio (apenas link) - problema na geração do texto'
        };
      }
      
      // Só enviar mensagem separada se o caption tinha conteúdo mas não foi incluído
      console.log('[Telegram] 🔄 Caption tinha conteúdo mas não foi incluído, enviando mensagem separada...');
      try {
        const textResult = await sendTelegramMessage({ 
          text: finalCaption, 
          disableWebPagePreview: false 
        });
        
        if (textResult.success) {
          console.log('[Telegram] ✅ Mensagem de texto enviada como fallback!');
          return { 
            success: true, 
            messageId: textResult.messageId, 
            sentTextOnly: true,
            photoMessageId: data.result?.message_id,
            error: 'Caption não foi incluído na foto, enviado como mensagem separada'
          };
        }
      } catch (fallbackError: any) {
        console.error('[Telegram] ❌ Erro ao enviar texto separado:', fallbackError.message);
      }
    } else {
      console.log('[Telegram] ✅ Foto enviada com sucesso e caption incluído!');
      console.log('[Telegram] Message ID:', data.result?.message_id);
      console.log('[Telegram] Caption (primeiros 150 chars):', sentCaption.substring(0, 150));
      console.log('[Telegram] Tamanho do caption recebido:', sentCaption.length, 'caracteres');
    }
    
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
