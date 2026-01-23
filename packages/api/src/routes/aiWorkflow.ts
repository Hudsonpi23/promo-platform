/**
 * 🤖 AI Workflow Routes
 * 
 * Rotas para processamento de ofertas pela IA
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authGuard } from '../lib/auth.js';
import { sendError, Errors } from '../lib/errors.js';
import { 
  processApprovedOffer, 
  processPendingOffers,
  isOpenAIConfigured,
} from '../services/ai/index.js';

// ==================== SCHEMAS ====================

const ProcessOfferSchema = z.object({
  offerId: z.string(),
});

// ==================== ROUTES ====================

export async function aiWorkflowRoutes(server: FastifyInstance) {
  // Todas as rotas requerem autenticação
  server.addHook('preHandler', authGuard);

  // ─────────────────────────────────────────────────────
  // GET /status - Status da configuração de IA
  // ─────────────────────────────────────────────────────
  server.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const configured = isOpenAIConfigured();

    return {
      configured,
      model: process.env.OPENAI_MODEL || 'gpt-4.1-2025-04-14',
      agents: ['CURADORA', 'ORQUESTRADOR', 'ANA', 'GABRIEL', 'THEO', 'LAURA'],
    };
  });

  // ─────────────────────────────────────────────────────
  // POST /process - Processa uma oferta aprovada
  // ─────────────────────────────────────────────────────
  server.post('/process', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = ProcessOfferSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, Errors.VALIDATION_ERROR);
    }

    const { offerId } = parsed.data;

    if (!isOpenAIConfigured()) {
      return sendError(reply, {
        statusCode: 503,
        code: 'AI_NOT_CONFIGURED',
        message: 'OpenAI não configurada. Defina OPENAI_API_KEY.',
      });
    }

    try {
      const result = await processApprovedOffer(offerId);

      if (!result.success) {
        return reply.status(422).send({
          success: false,
          error: result.error,
          curadora: result.curadora,
        });
      }

      return {
        success: true,
        offerId,
        jobs: result.jobs?.map(j => ({
          network: j.network,
          agentName: j.agentName,
          style: j.style,
          textPreview: j.textFinal.substring(0, 100) + '...',
        })),
        curadora: {
          priorityScore: result.curadora?.priorityScore,
          riskLevel: result.curadora?.riskLevel,
        },
      };
    } catch (error) {
      console.error('[AI Workflow] Erro no processamento:', error);
      return sendError(reply, {
        statusCode: 500,
        code: 'AI_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Erro no processamento',
      });
    }
  });

  // ─────────────────────────────────────────────────────
  // POST /process-pending - Processa todas ofertas pendentes
  // ─────────────────────────────────────────────────────
  server.post('/process-pending', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isOpenAIConfigured()) {
      return sendError(reply, {
        statusCode: 503,
        code: 'AI_NOT_CONFIGURED',
        message: 'OpenAI não configurada. Defina OPENAI_API_KEY.',
      });
    }

    try {
      const processedCount = await processPendingOffers();

      return {
        success: true,
        processedCount,
        message: processedCount > 0 
          ? `${processedCount} ofertas processadas com sucesso`
          : 'Nenhuma oferta pendente para processar',
      };
    } catch (error) {
      console.error('[AI Workflow] Erro no processamento em lote:', error);
      return sendError(reply, {
        statusCode: 500,
        code: 'AI_BATCH_ERROR',
        message: error instanceof Error ? error.message : 'Erro no processamento em lote',
      });
    }
  });
}

export default aiWorkflowRoutes;
