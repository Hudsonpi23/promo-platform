/**
 * Rotas de integração com Facebook
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { sendError, Errors } from '../lib/errors.js';
import { 
  isFacebookConfigured, 
  postToFacebook, 
  postToFacebookWithLink,
  postToFacebookWithImage,
  generateFacebookPost 
} from '../services/facebook.js';

export async function facebookRoutes(app: FastifyInstance) {
  
  /**
   * GET /api/facebook/status
   * Verifica se Facebook está configurado
   */
  app.get('/status', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const configured = isFacebookConfigured();
    
    return reply.send({
      success: true,
      data: {
        configured,
        pageId: configured ? process.env.META_PAGE_ID : null,
      },
    });
  });

  /**
   * POST /api/facebook/post
   * Publica uma mensagem no Facebook
   */
  app.post('/post', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = z.object({
        message: z.string().min(1),
        link: z.string().url().optional(),
        imageUrl: z.string().url().optional(),
      }).parse(request.body);

      let result;

      if (body.imageUrl) {
        result = await postToFacebookWithImage(body.message, body.imageUrl);
      } else if (body.link) {
        result = await postToFacebookWithLink(body.message, body.link);
      } else {
        result = await postToFacebook(body.message);
      }

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'FACEBOOK_ERROR', message: result.error },
        });
      }

      return reply.send({
        success: true,
        message: 'Publicado no Facebook!',
        data: {
          postId: result.postId,
          postUrl: result.postUrl,
        },
      });
    } catch (error: any) {
      console.error('Erro ao publicar no Facebook:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/facebook/post-offer/:offerId
   * Publica uma oferta específica no Facebook
   */
  app.post('/post-offer/:offerId', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { offerId } = request.params as { offerId: string };

      // Buscar oferta
      const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        include: {
          store: { select: { name: true } },
          niche: { select: { name: true } },
        },
      });

      if (!offer) {
        return sendError(reply, Errors.NOT_FOUND('Oferta'));
      }

      // Gerar texto do post
      const message = generateFacebookPost({
        title: offer.title,
        originalPrice: offer.originalPrice ? Number(offer.originalPrice) : undefined,
        finalPrice: Number(offer.finalPrice),
        discountPct: offer.discountPct,
        affiliateUrl: offer.affiliateUrl,
        storeName: offer.store?.name,
      });

      // Publicar (com imagem se tiver)
      let result;
      if (offer.imageUrl) {
        result = await postToFacebookWithImage(message, offer.imageUrl);
      } else {
        result = await postToFacebookWithLink(message, offer.affiliateUrl);
      }

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'FACEBOOK_ERROR', message: result.error },
        });
      }

      return reply.send({
        success: true,
        message: 'Oferta publicada no Facebook!',
        data: {
          postId: result.postId,
          postUrl: result.postUrl,
          offer: {
            id: offer.id,
            title: offer.title,
          },
        },
      });
    } catch (error: any) {
      console.error('Erro ao publicar oferta no Facebook:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/facebook/post-draft/:draftId
   * Publica um draft no Facebook
   */
  app.post('/post-draft/:draftId', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = request.params as { draftId: string };

      // Buscar draft com oferta
      const draft = await prisma.postDraft.findUnique({
        where: { id: draftId },
        include: {
          offer: {
            include: {
              store: { select: { name: true } },
              niche: { select: { name: true } },
            },
          },
        },
      });

      if (!draft) {
        return sendError(reply, Errors.NOT_FOUND('Draft'));
      }

      const offer = draft.offer;

      // Gerar texto do post
      const message = generateFacebookPost({
        title: offer.title,
        originalPrice: offer.originalPrice ? Number(offer.originalPrice) : undefined,
        finalPrice: Number(offer.finalPrice),
        discountPct: offer.discountPct,
        affiliateUrl: offer.affiliateUrl,
        storeName: offer.store?.name,
      });

      // Publicar (com imagem se tiver)
      let result;
      if (offer.imageUrl) {
        result = await postToFacebookWithImage(message, offer.imageUrl);
      } else {
        result = await postToFacebookWithLink(message, offer.affiliateUrl);
      }

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'FACEBOOK_ERROR', message: result.error },
        });
      }

      return reply.send({
        success: true,
        message: 'Draft publicado no Facebook!',
        data: {
          postId: result.postId,
          postUrl: result.postUrl,
          draft: {
            id: draft.id,
            title: offer.title,
          },
        },
      });
    } catch (error: any) {
      console.error('Erro ao publicar draft no Facebook:', error);
      return sendError(reply, error);
    }
  });
}
