import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { isTwitterConfigured, postOfferToTwitter, postTweet, generateTweetText } from '../services/twitter.js';
import { z } from 'zod';

export async function twitterRoutes(app: FastifyInstance) {
  /**
   * GET /api/twitter/status
   * Verifica se a API do Twitter está configurada
   */
  app.get('/status', { preHandler: [authGuard] }, async (request, reply) => {
    const configured = isTwitterConfigured();
    
    return {
      configured,
      message: configured 
        ? 'Twitter API configurada e pronta para uso'
        : 'Twitter API não configurada. Configure as variáveis de ambiente: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET',
    };
  });

  /**
   * GET /api/twitter/status-public
   * Verifica status (sem auth) - temporário para testes
   */
  app.get('/status-public', async (request, reply) => {
    const configured = isTwitterConfigured();
    return { configured };
  });

  /**
   * POST /api/twitter/test-post
   * Rota de teste SEM autenticação - REMOVER APÓS TESTES
   */
  app.post('/test-post', async (request, reply) => {
    const schema = z.object({
      text: z.string().min(1).max(280),
      secret: z.string(), // Segredo simples para evitar abusos
    });

    try {
      const { text, secret } = schema.parse(request.body);
      
      // Validação simples - troque por algo mais seguro se necessário
      if (secret !== 'promo2026') {
        return reply.status(403).send({ success: false, error: 'Invalid secret' });
      }
      
      const result = await postTweet(text);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      return {
        success: true,
        tweetId: result.tweetId,
        tweetUrl: result.tweetUrl,
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: 'Dados inválidos',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  /**
   * POST /api/twitter/post
   * Posta um texto personalizado no Twitter
   */
  app.post('/post', { preHandler: [authGuard] }, async (request, reply) => {
    const schema = z.object({
      text: z.string().min(1).max(280),
    });

    try {
      const { text } = schema.parse(request.body);
      
      const result = await postTweet(text);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      return {
        success: true,
        tweetId: result.tweetId,
        tweetUrl: result.tweetUrl,
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: 'Texto inválido',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  /**
   * POST /api/twitter/post-offer/:offerId
   * Posta uma oferta específica no Twitter
   */
  app.post('/post-offer/:offerId', { preHandler: [authGuard] }, async (request, reply) => {
    const { offerId } = request.params as { offerId: string };

    // Buscar oferta
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        niche: { select: { name: true } },
        store: { select: { name: true } },
      },
    });

    if (!offer) {
      return reply.status(404).send({
        success: false,
        error: 'Oferta não encontrada',
      });
    }

    // Postar no Twitter
    const images = (offer as any).images || [];
    const mainImage = offer.imageUrl;
    
    console.log(`[Twitter] Preparando post: galeria=${images.length}, principal=${mainImage ? 'sim' : 'não'}`);
    
    const result = await postOfferToTwitter({
      title: offer.title,
      originalPrice: offer.originalPrice ? Number(offer.originalPrice) : undefined,
      finalPrice: Number(offer.finalPrice),
      discount: offer.discountPct || undefined,
      affiliateUrl: offer.affiliateUrl || undefined,
      storeName: offer.store?.name,
      imageUrl: mainImage || undefined,
      images: images.length > 0 ? images : undefined,
    });

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    // Registrar o post (opcional: criar registro de publicação)
    // await prisma.publishedPost.create({ ... });

    return {
      success: true,
      tweetId: result.tweetId,
      tweetUrl: result.tweetUrl,
      message: 'Oferta postada no Twitter com sucesso!',
    };
  });

  /**
   * POST /api/twitter/post-draft/:draftId
   * Posta um draft aprovado no Twitter
   */
  app.post('/post-draft/:draftId', { preHandler: [authGuard] }, async (request, reply) => {
    const { draftId } = request.params as { draftId: string };

    // Buscar draft
    const draft = await prisma.postDraft.findUnique({
      where: { id: draftId },
      include: {
        offer: {
          include: {
            niche: { select: { name: true } },
            store: { select: { name: true } },
          },
        },
      },
    });

    if (!draft) {
      return reply.status(404).send({
        success: false,
        error: 'Draft não encontrado',
      });
    }

    // Usar copyTextX se existir, senão gerar do offer
    let tweetText = (draft as any).copyTextX;
    
    if (!tweetText && draft.offer) {
      tweetText = generateTweetText({
        title: draft.offer.title,
        originalPrice: draft.offer.originalPrice ? Number(draft.offer.originalPrice) : undefined,
        finalPrice: Number(draft.offer.finalPrice),
        discount: draft.offer.discountPct || undefined,
        affiliateUrl: draft.offer.affiliateUrl || undefined,
        storeName: draft.offer.store?.name,
      });
    }

    if (!tweetText) {
      return reply.status(400).send({
        success: false,
        error: 'Não foi possível gerar texto para o tweet',
      });
    }

    // Postar no Twitter
    const result = await postTweet(tweetText);

    if (!result.success) {
      // Atualizar status do draft para erro
      await prisma.postDraft.update({
        where: { id: draftId },
        data: { status: 'ERROR' },
      });

      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    // Registrar delivery bem-sucedida
    await prisma.postDelivery.create({
      data: {
        draftId,
        channel: 'TWITTER',
        status: 'SENT',
        sentAt: new Date(),
        externalId: result.tweetId,
        payload: {
          tweetUrl: result.tweetUrl,
          text: tweetText,
        },
      },
    });

    return {
      success: true,
      tweetId: result.tweetId,
      tweetUrl: result.tweetUrl,
      message: 'Draft postado no Twitter com sucesso!',
    };
  });

  /**
   * GET /api/twitter/preview/:offerId
   * Visualiza como ficará o tweet de uma oferta
   */
  app.get('/preview/:offerId', { preHandler: [authGuard] }, async (request, reply) => {
    const { offerId } = request.params as { offerId: string };

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

    // Gerar preview do tweet
    const tweetText = generateTweetText({
      title: offer.title,
      originalPrice: offer.originalPrice ? Number(offer.originalPrice) : undefined,
      finalPrice: Number(offer.finalPrice),
      discount: offer.discountPct || undefined,
      affiliateUrl: offer.affiliateUrl || undefined,
      storeName: offer.store?.name,
    });

    return {
      success: true,
      preview: tweetText,
      length: tweetText.length,
      maxLength: 280,
      isValid: tweetText.length <= 280,
    };
  });
}
