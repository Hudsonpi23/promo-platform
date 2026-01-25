import { FastifyInstance } from 'fastify';
import { authGuard } from '../lib/auth.js';
import { 
  isTelegramConfigured, 
  testTelegramConnection, 
  sendTelegramMessage,
  sendTelegramMediaGroup,
  formatTelegramPost 
} from '../services/telegram.js';
import { prisma } from '../lib/prisma.js';

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
  app.post('/test', { preHandler: [authGuard] }, async (request, reply) => {
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
  app.post('/post-offer/:offerId', { preHandler: [authGuard] }, async (request, reply) => {
    const { offerId } = request.params as { offerId: string };

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

    // Formatar e enviar
    const text = formatTelegramPost({
      title: offer.title,
      originalPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
      finalPrice: Number(offer.finalPrice),
      discountPct: offer.discountPct,
      affiliateUrl: offer.affiliateUrl,
      storeName: offer.store?.name,
    });

    // 🎠 Verificar se tem galeria de imagens (carrossel)
    const images = (offer as any).images || [];
    const mainImage = (offer as any).mainImage || offer.imageUrl;
    
    console.log(`  - Imagens na galeria: ${images.length}`);
    console.log('  - URL imagem principal:', mainImage?.substring(0, 80) || 'SEM IMAGEM');

    let result;
    
    // Se tem 2+ imagens na galeria, enviar como carrossel
    if (images.length >= 2) {
      console.log('[Telegram] 🎠 Enviando como carrossel (media group)');
      result = await sendTelegramMediaGroup(images, text);
    } 
    // Se tem apenas 1 imagem (principal ou galeria), enviar foto normal
    else if (mainImage || images.length === 1) {
      const imageToSend = mainImage || images[0];
      console.log('[Telegram] 📷 Enviando foto única');
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

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      sentTextOnly: (result as any).sentTextOnly || false,
      message: (result as any).sentTextOnly 
        ? '⚠️ Enviado apenas texto (imagens falharam)' 
        : result.success 
          ? images.length >= 2 
            ? `✅ Enviado carrossel com ${images.length} imagens` 
            : '✅ Enviado com foto' 
          : undefined,
      debug: {
        hadImages: images.length > 0 || !!mainImage,
        imageCount: images.length,
        isCarousel: images.length >= 2,
      },
    };
  });
}
