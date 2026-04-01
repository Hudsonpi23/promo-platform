/**
 * 🤖 AI Service via OpenRouter — Gemini Flash (custo-eficiente)
 *
 * Usa OpenRouter como gateway unificado para todos os modelos.
 * Troca o modelo por qualquer outro disponível no OpenRouter sem mudar código.
 *
 * Variável de ambiente necessária no Render:
 *   OPENROUTER_API_KEY=sk-or-v1-...
 */

// ==================== TYPES ====================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  model?: string;
  agent?: 'ORCHESTRATOR' | 'FACEBOOK' | 'INSTAGRAM' | 'X' | 'TELEGRAM' | 'WHATSAPP';
}

export interface AICompletionResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

// ==================== CONFIG ====================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AI_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Modelos por agente — todos via OpenRouter
// gemini-2.0-flash: rápido e barato (~$0.10/M tokens input)
// gemini-2.5-pro-preview-03-25: mais capaz, para tarefas complexas
// Usando google/gemini-2.5-flash para todos os agentes — modelo único, barato e eficiente
export const OPENAI_MODELS = {
  ORCHESTRATOR: process.env.OPENAI_MODEL_ORCHESTRATOR || 'google/gemini-2.5-flash',
  FACEBOOK:     process.env.OPENAI_MODEL_FACEBOOK     || 'google/gemini-2.5-flash',
  INSTAGRAM:    process.env.OPENAI_MODEL_INSTAGRAM    || 'google/gemini-2.5-flash',
  X:            process.env.OPENAI_MODEL_X            || 'google/gemini-2.5-flash',
  TELEGRAM:     process.env.OPENAI_MODEL_TELEGRAM     || 'google/gemini-2.5-flash',
  WHATSAPP:     process.env.OPENAI_MODEL_WHATSAPP     || 'google/gemini-2.5-flash',
  DEFAULT:      'google/gemini-2.5-flash',
};

export const OPENAI_CONFIG = {
  MAX_TOKENS_ORCHESTRATOR: parseInt(process.env.OPENAI_MAX_TOKENS_ORCHESTRATOR || '4096'),
  MAX_TOKENS_POST: parseInt(process.env.OPENAI_MAX_TOKENS_POST || '2048'),
  TEMPERATURE_CREATIVE: parseFloat(process.env.OPENAI_TEMPERATURE_CREATIVE || '0.85'),
  TEMPERATURE_NEUTRAL: parseFloat(process.env.OPENAI_TEMPERATURE_NEUTRAL || '0.6'),
};

// ==================== HELPERS ====================

export function isOpenAIConfigured(): boolean {
  return Boolean(OPENROUTER_API_KEY && OPENROUTER_API_KEY.startsWith('sk-or-'));
}

// ==================== MAIN FUNCTION ====================

/**
 * Executa uma completion na OpenAI
 * 
 * @param messages - Array de mensagens (system, user, assistant)
 * @param options - Configurações opcionais
 * @returns Resultado da completion
 */
export async function createCompletion(
  messages: AIMessage[],
  options: AICompletionOptions = {}
): Promise<AICompletionResult> {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenRouter não configurado. Defina OPENROUTER_API_KEY no Render.');
  }

  const {
    temperature = OPENAI_CONFIG.TEMPERATURE_NEUTRAL,
    maxTokens = OPENAI_CONFIG.MAX_TOKENS_POST,
    responseFormat = 'text',
    model,
    agent,
  } = options;

  // 🤖 v2.0: Selecionar modelo baseado no agente
  const selectedModel = model || (agent ? OPENAI_MODELS[agent] : OPENAI_MODELS.DEFAULT);

  const body: Record<string, unknown> = {
    model: selectedModel,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  // JSON mode para respostas estruturadas
  if (responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  console.log(`[AI] Chamando ${selectedModel} via OpenRouter (${messages.length} msgs)...`);

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://promo-platform.vercel.app',
      'X-Title': 'Manu das Promoções',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AI] Erro ${response.status}: ${errorText}`);
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    model: string;
  };

  const result: AICompletionResult = {
    content: data.choices[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    model: data.model,
  };

  console.log(`[AI] ✅ Resposta recebida (${result.usage.totalTokens} tokens) — modelo: ${result.model}`);

  return result;
}

/**
 * Parse JSON seguro da resposta da IA
 */
export function parseAIJson<T>(content: string): T {
  try {
    // Tentar parse direto
    return JSON.parse(content);
  } catch {
    // Tentar extrair JSON de markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error(`Falha ao parsear JSON da IA: ${content.substring(0, 200)}`);
  }
}

export default {
  isOpenAIConfigured,
  createCompletion,
  parseAIJson,
};
