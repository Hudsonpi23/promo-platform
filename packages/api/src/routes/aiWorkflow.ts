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
  createCompletion,
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
      return sendError(reply, Errors.VALIDATION_ERROR(parsed.error));
    }

    const { offerId } = parsed.data;

    if (!isOpenAIConfigured()) {
      return reply.status(503).send({
        error: {
          code: 'AI_NOT_CONFIGURED',
          message: 'OpenAI não configurada. Defina OPENAI_API_KEY.',
        },
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
      return reply.status(500).send({
        error: {
          code: 'AI_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Erro no processamento',
        },
      });
    }
  });

  // ─────────────────────────────────────────────────────
  // POST /generate-text - Gera texto livre usando IA
  // ─────────────────────────────────────────────────────
  server.post('/generate-text', async (request: FastifyRequest, reply: FastifyReply) => {
    const { prompt, maxTokens } = (request.body as { prompt?: string; maxTokens?: number }) || {};

    if (!prompt || prompt.trim().length < 5) {
      return reply.status(400).send({ error: 'Prompt obrigatório (mínimo 5 caracteres)' });
    }

    if (!isOpenAIConfigured()) {
      return reply.status(503).send({ error: 'OpenAI não configurada' });
    }

    try {
      const result = await createCompletion(
        [
          { role: 'system', content: 'Você é a Manu, assistente de um canal de promoções brasileiro. Crie posts criativos, com emojis, tom informal e envolvente. Responda APENAS com o texto do post, sem explicações extras.' },
          { role: 'user', content: prompt.trim() },
        ],
        {
          temperature: 0.85,
          maxTokens: maxTokens || 500,
          agent: 'TELEGRAM',
        }
      );

      return { text: result.content, tokens: result.usage.totalTokens };
    } catch (err: any) {
      console.error('[AI Generate] Erro:', err.message);
      return reply.status(500).send({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────
  // POST /process-pending - Processa todas ofertas pendentes
  // ─────────────────────────────────────────────────────
  server.post('/process-pending', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isOpenAIConfigured()) {
      return reply.status(503).send({
        error: {
          code: 'AI_NOT_CONFIGURED',
          message: 'OpenAI não configurada. Defina OPENAI_API_KEY.',
        },
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
      return reply.status(500).send({
        error: {
          code: 'AI_BATCH_ERROR',
          message: error instanceof Error ? error.message : 'Erro no processamento em lote',
        },
      });
    }
  });
}

export default aiWorkflowRoutes;
