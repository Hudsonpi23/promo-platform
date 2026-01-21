import { FastifyInstance } from 'fastify';
import { authGuard } from '../lib/auth.js';
import { 
  isTelegramConfigured, 
  testTelegramConnection, 
  sendTelegramMessage,
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
      return reply.status(400).send({
        success: false,
        error: 'Telegram não configurado',
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
      return reply.status(404).send({
        success: false,
        error: 'Oferta não encontrada',
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

    const result = await sendTelegramMessage({
      text,
      imageUrl: offer.imageUrl || undefined,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    };
  });
}
