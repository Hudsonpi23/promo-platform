import { FastifyInstance } from 'fastify';
import { authGuard } from '../lib/auth.js';
import { 
  isTelegramConfigured, 
  testTelegramConnection, 
  sendTelegramMessage,
  formatTelegramPost 
} from '../services/telegram.js';
import { uploadFromUrl } from '../services/cloudinary.js';
import { prisma } from '../lib/prisma.js';
import { nanoid } from 'nanoid';

export async function telegramRoutes(app: FastifyInstance) {
  /**
   * GET /api/telegram/status
   * Verifica se o Telegram está configurado
   */
  app.get('/status', async () => {
    const configured = isTelegramConfigured();
    
    if (!configured) {
      return { 
        configured: false,
        message: 'Telegram não configurado. Configure TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID.' 
      };
    }

    // Testar conexão
    const test = await testTelegramConnection();
    
    return {
      configured: true,
      connected: test.success,
      botName: test.botName,
      error: test.error,
    };
  });

  /**
   * POST /api/telegram/test
   * Envia mensagem de teste para o canal
   */
  app.post('/test', async (request, reply) => {
    if (!isTelegramConfigured()) {
      return reply.status(400).send({
        success: false,
        error: 'Telegram não configurado',
      });
    }

    const result = await sendTelegramMessage({
      text: '✅ <b>Teste de conexão!</b>\n\nSe você está vendo esta mensagem, o bot está funcionando corretamente! 🎉\n\n<i>Manu das Promoções</i>',
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  });

  /**
   * POST /api/telegram/post-offer/:offerId
   * Envia uma oferta específica para o Telegram
   */
  app.post('/post-offer/:offerId', async (request, reply) => {
    const { offerId } = request.params as { offerId: string };
    const body = (request.body as { paymentMethod?: string; installments?: number; installmentValue?: number; phraseMode?: string }) || {};
    const paymentMethod    = (body.paymentMethod || 'avista') as 'pix' | 'avista' | 'parcelado';
    const installments     = body.installments ?? 12;
    const installmentValue = body.installmentValue ?? undefined;
    const phraseMode       = (body.phraseMode === 'generic' || body.phraseMode === 'brand') ? body.phraseMode : undefined;

    if (!isTelegramConfigured()) {
      console.error('[Telegram] Telegram não configurado - verifique TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID');
      return reply.status(400).send({
        success: false,
        error: 'Telegram não configurado. Configure TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env',
      });
    }

    // Buscar oferta
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        store: { select: { name: true } },
      },
    });

    if (!offer) {
      console.error('[Telegram] Oferta não encontrada:', offerId);
      return reply.status(404).send({
        success: false,
        error: 'Oferta não encontrada',
      });
    }

    // Log detalhado para debug
    console.log('[Telegram] Preparando envio:');
    console.log('  - Título:', offer.title?.substring(0, 50));
    console.log('  - imageUrl:', offer.imageUrl || 'VAZIO');
    console.log('  - mainImage:', (offer as any).mainImage || 'VAZIO');
    console.log('  - affiliateUrl:', offer.affiliateUrl?.substring(0, 50) || 'VAZIO');
    console.log('  - finalPrice:', offer.finalPrice);
    console.log('  - originalPrice:', offer.originalPrice);

    // Validar campos obrigatórios
    if (!offer.title || !offer.finalPrice || !offer.affiliateUrl) {
      console.error('[Telegram] Campos obrigatórios faltando:', {
        hasTitle: !!offer.title,
        hasFinalPrice: !!offer.finalPrice,
        hasAffiliateUrl: !!offer.affiliateUrl,
      });
      return reply.status(400).send({
        success: false,
        error: 'Oferta incompleta: faltam campos obrigatórios (título, preço ou link)',
      });
    }

    // OBRIGATÓRIO: Gerar copy usando frases personalizadas em MAIÚSCULAS
    const { generateCopies } = await import('../services/aiCopyGenerator.js');
    const copies = generateCopies({
      title: offer.title,
      price: Number(offer.finalPrice),
      oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
      discountPct: offer.discountPct ? Number(offer.discountPct) : 0,
      advertiserName: offer.store?.name,
      storeName: offer.store?.name,
      category: null,
      trackingUrl: offer.affiliateUrl,
      paymentMethod,
      installments,
      installmentValue,
      phraseMode,
      couponCode: (offer as any).couponCode || undefined,
    });
    
    // Usar copyTextTelegram (já está em MAIÚSCULAS)
    let text = copies.telegram;
    
    // VALIDAÇÃO: Se o texto estiver vazio ou muito curto, gerar fallback
    if (!text || text.trim().length < 10) {
      console.warn('[Telegram] Copy gerado está vazio ou muito curto, gerando fallback...');
      const formatPrice = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
      
      // Link PRIMEIRO (garante preview do Telegram) - sempre em minúsculas
      const normalizedUrl = (offer.affiliateUrl || '').toLowerCase();
      let fallbackText = `${normalizedUrl}\n\n`;
      fallbackText += 'ACHADO NÃO É ROUBADO 🔥\n\n';
      fallbackText += `${offer.title.toUpperCase()}\n\n`;
      
      if (offer.originalPrice && offer.discountPct) {
        const originalPriceNumber = Number(offer.originalPrice);
        const finalPriceNumber = Number(offer.finalPrice);
        const discountNumber = Number(offer.discountPct);

        fallbackText += `DE ${formatPrice(originalPriceNumber).toUpperCase()} POR ${formatPrice(finalPriceNumber).toUpperCase()}`;
        fallbackText += ` (-${Math.round(discountNumber)}% OFF)`;
        if (discountNumber >= 20) {
          fallbackText += ' 🔥';
        }
      } else {
        fallbackText += `POR ${formatPrice(Number(offer.finalPrice)).toUpperCase()}`;
      }
      
      text = fallbackText;
    }
    
    console.log('[Telegram] Texto gerado:', text.substring(0, 100) + '...');
    console.log('[Telegram] Tamanho do texto:', text.length, 'caracteres');

    // 🎠 Verificar se tem galeria de imagens (carrossel)
    const images = (offer as any).images || [];
    let mainImage = (offer as any).mainImage || offer.imageUrl;
    
    console.log(`  - Imagens na galeria: ${images.length}`);
    console.log('  - URL imagem principal (ANTES Cloudinary):', mainImage?.substring(0, 120) || 'SEM IMAGEM');

    // 💾 Se a imagem principal NÃO for Cloudinary, subir para Cloudinary
    // Isso evita bloqueios/hotlink em hosts externos (como alguns sites de loja)
    if (mainImage && !mainImage.includes('res.cloudinary.com')) {
      try {
        console.log('[Telegram] 🌩️ Uploadando imagem para Cloudinary para uso no Telegram...');
        const uploadResult = await uploadFromUrl(mainImage, {
          folder: 'promo-platform/offers/telegram',
        });

        if (uploadResult.success && uploadResult.url) {
          console.log('[Telegram] ✅ Imagem subida para Cloudinary:', uploadResult.url.substring(0, 120));
          mainImage = uploadResult.url;
        } else {
          console.warn('[Telegram] ⚠️ Falha ao subir imagem para Cloudinary, usando URL original:', uploadResult.error);
        }
      } catch (cloudErr: any) {
        console.error('[Telegram] ❌ Erro ao subir imagem para Cloudinary:', cloudErr.message);
      }
    }

    console.log('  - URL imagem principal (DEPOIS Cloudinary):', mainImage?.substring(0, 120) || 'SEM IMAGEM');

    let result;
    
    // SEMPRE enviar apenas UMA imagem (a primeira disponível)
    // Removido sistema de carrossel - sempre foto única
    if (mainImage || images.length > 0) {
      const imageToSend = mainImage || images[0];
      console.log('[Telegram] 📷 Enviando foto única com URL:', imageToSend.substring(0, 120));
      result = await sendTelegramMessage({
        text,
        imageUrl: imageToSend,
      });
    }
    // Sem imagens, enviar só texto
    else {
      console.log('[Telegram] 📝 Enviando apenas texto (sem imagens)');
      result = await sendTelegramMessage({
        text,
      });
    }

    // Registrar publicação para contagem nos cards e métricas
    if (result.success) {
      try {
        await prisma.postHistory.create({
          data: {
            offerId,
            channel: 'TELEGRAM',
            humorStyle: 'NEUTRO',
            uniqueHash: `manual-TELEGRAM-${offerId}-${Date.now()}`,
            copyText: offer.title,
            externalId: result.messageId ? String(result.messageId) : null,
          },
        });
      } catch (e) {
        console.error('[PostHistory/Telegram] Erro ao registrar publicação:', e);
      }

      // Nota: PublishedPost é exclusivo para o site (evita duplicatas na vitrine)
    }

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      sentTextOnly: (result as any).sentTextOnly || false,
      message: (result as any).sentTextOnly 
        ? '⚠️ Enviado apenas texto (imagens falharam)' 
        : result.success 
          ? '✅ Enviado com foto' 
          : undefined,
      debug: {
        hadImages: images.length > 0 || !!mainImage,
        imageCount: images.length,
        isCarousel: false, // Carrossel removido
      },
    };
  });

  /**
   * POST /api/telegram/message
   * Envia mensagem de texto livre para o canal Telegram
   */
  app.post('/message', async (request, reply) => {
    if (!isTelegramConfigured()) {
      return reply.status(400).send({ success: false, error: 'Telegram não configurado' });
    }

    const { text, imageUrl, chatId } = (request.body as { text?: string; imageUrl?: string; chatId?: string }) || {};
    if (!text || text.trim().length < 3) {
      return reply.status(400).send({ success: false, error: 'Texto obrigatório' });
    }

    const result = await sendTelegramMessage({ 
      text: text.trim(), 
      imageUrl: imageUrl?.trim() || undefined,
      chatId: chatId?.trim() || undefined
    });
    return { success: result.success, messageId: result.messageId, error: result.error };
  });

  /**
   * POST /api/telegram/poll
   * Envia enquete nativa do Telegram (botões clicáveis, não texto)
   */
  app.post('/poll', async (request, reply) => {
    if (!isTelegramConfigured()) {
      return reply.status(400).send({ success: false, error: 'Telegram não configurado' });
    }

    const { question, options, isAnonymous, allowsMultipleAnswers } = request.body as {
      question?: string;
      options?: string[];
      isAnonymous?: boolean;
      allowsMultipleAnswers?: boolean;
    };

    if (!question || question.trim().length < 3) {
      return reply.status(400).send({ success: false, error: 'Pergunta obrigatória (mínimo 3 caracteres)' });
    }

    const validOptions = (options || []).filter(o => o.trim().length > 0);
    if (validOptions.length < 2 || validOptions.length > 10) {
      return reply.status(400).send({ success: false, error: 'Mínimo 2, máximo 10 opções' });
    }

    try {
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPoll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          question: question.trim(),
          options: validOptions.map(o => o.trim()),
          is_anonymous: isAnonymous ?? true,
          allows_multiple_answers: allowsMultipleAnswers ?? false,
        }),
      });

      const data = await res.json() as any;

      if (data.ok) {
        return { success: true, messageId: data.result?.message_id, pollId: data.result?.poll?.id };
      } else {
        return reply.status(400).send({ success: false, error: data.description || 'Erro ao enviar enquete' });
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
