/**
 * 🔥 Rotas para Frases Personalizadas
 * 
 * Quando um usuário digita uma frase manualmente, ela é salva aqui
 * para ser reutilizada em futuras gerações de copy
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { sendError, Errors } from '../lib/errors.js';

// ==================== SCHEMAS ====================

const SavePhrasesSchema = z.object({
  draftId: z.string().optional(),
  phrases: z.object({
    copyText: z.string().optional(),
    copyTextTelegram: z.string().optional(),
    copyTextSite: z.string().optional(),
    copyTextX: z.string().optional(),
  }),
  productTitle: z.string().optional(),
  category: z.string().optional(),
});

// ==================== HELPERS ====================

/**
 * Extrai palavras-chave do título do produto
 */
function extractKeywords(title: string): string[] {
  const keywords: string[] = [];
  const lowerTitle = title.toLowerCase();
  
  // Palavras-chave comuns de produtos
  const commonKeywords = [
    'tv', 'televisão', 'televisor',
    'celular', 'smartphone', 'iphone',
    'notebook', 'laptop', 'computador',
    'perfume', 'fragrância',
    'fone', 'headphone', 'headset',
    'geladeira', 'refrigerador',
    'fritadeira', 'air fryer',
    'cafeteira', 'café',
    'tênis', 'sapato', 'calçado',
    'camiseta', 'camisa', 'roupa',
    'console', 'videogame', 'playstation', 'xbox',
  ];
  
  for (const keyword of commonKeywords) {
    if (lowerTitle.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  
  return keywords;
}

// ==================== ROUTES ====================

export async function customPhrasesRoutes(app: FastifyInstance) {
  
  /**
   * POST /api/custom-phrases/save
   * Salva frases personalizadas criadas pelo usuário
   */
  app.post('/save', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user) {
        return sendError(reply, Errors.UNAUTHORIZED);
      }

      const body = SavePhrasesSchema.parse(request.body);
      
      const phrases = body.phrases;
      const productTitle = body.productTitle || '';
      const category = body.category || '';
      
      // Extrair palavras-chave do título
      const keywords = productTitle ? extractKeywords(productTitle) : [];
      
      // Salvar cada frase não vazia
      const savedPhrases = [];
      
      if (phrases.copyText && phrases.copyText.trim()) {
        const phrase = await prisma.customPhrase.create({
          data: {
            phrase: phrases.copyText.trim(),
            productKeyword: keywords[0] || null,
            category: category || null,
            channel: null, // Genérico
            createdById: user.id,
            usageCount: 0,
            isActive: true,
          },
        });
        savedPhrases.push(phrase);
      }
      
      if (phrases.copyTextTelegram && phrases.copyTextTelegram.trim()) {
        const phrase = await prisma.customPhrase.create({
          data: {
            phrase: phrases.copyTextTelegram.trim(),
            productKeyword: keywords[0] || null,
            category: category || null,
            channel: 'TELEGRAM',
            createdById: user.id,
            usageCount: 0,
            isActive: true,
          },
        });
        savedPhrases.push(phrase);
      }
      
      if (phrases.copyTextSite && phrases.copyTextSite.trim()) {
        const phrase = await prisma.customPhrase.create({
          data: {
            phrase: phrases.copyTextSite.trim(),
            productKeyword: keywords[0] || null,
            category: category || null,
            channel: 'SITE',
            createdById: user.id,
            usageCount: 0,
            isActive: true,
          },
        });
        savedPhrases.push(phrase);
      }
      
      if (phrases.copyTextX && phrases.copyTextX.trim()) {
        const phrase = await prisma.customPhrase.create({
          data: {
            phrase: phrases.copyTextX.trim(),
            productKeyword: keywords[0] || null,
            category: category || null,
            channel: 'TWITTER',
            createdById: user.id,
            usageCount: 0,
            isActive: true,
          },
        });
        savedPhrases.push(phrase);
      }
      
      return reply.send({
        success: true,
        data: {
          saved: savedPhrases.length,
          phrases: savedPhrases,
        },
      });
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  /**
   * GET /api/custom-phrases
   * Lista frases personalizadas
   */
  app.get('/', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { productKeyword, category, channel } = request.query as {
        productKeyword?: string;
        category?: string;
        channel?: string;
      };
      
      const where: any = {
        isActive: true,
      };
      
      if (productKeyword) {
        where.productKeyword = productKeyword;
      }
      
      if (category) {
        where.category = category;
      }
      
      if (channel) {
        where.channel = channel;
      }
      
      const phrases = await prisma.customPhrase.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: {
          usageCount: 'desc',
        },
        take: 100,
      });
      
      return reply.send({
        success: true,
        data: phrases,
      });
    } catch (error: any) {
      return sendError(reply, error);
    }
  });
}
