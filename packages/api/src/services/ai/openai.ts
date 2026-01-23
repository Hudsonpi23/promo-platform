/**
 * 🤖 OpenAI Service - Base para todos os agentes de IA
 * 
 * TODOS os agentes usam:
 * - MESMA API KEY (OPENAI_API_KEY)
 * - MESMO MODELO (GPT-4.1)
 * - PROMPTS DIFERENTES
 */

// ==================== TYPES ====================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  temperature?: number;       // 0.0 - 2.0 (default: 0.7)
  maxTokens?: number;         // Máximo de tokens na resposta
  responseFormat?: 'text' | 'json';
  model?: string;             // Modelo específico (default: gpt-4.1)
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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// 🤖 v2.0: Modelos por agente
export const OPENAI_MODELS = {
  ORCHESTRATOR: process.env.OPENAI_MODEL_ORCHESTRATOR || 'gpt-4.1',
  FACEBOOK: process.env.OPENAI_MODEL_FACEBOOK || 'gpt-4.1',
  INSTAGRAM: process.env.OPENAI_MODEL_INSTAGRAM || 'gpt-4.1',
  X: process.env.OPENAI_MODEL_X || 'gpt-4.1',
  TELEGRAM: process.env.OPENAI_MODEL_TELEGRAM || 'gpt-4.1',
  WHATSAPP: process.env.OPENAI_MODEL_WHATSAPP || 'gpt-4.1',
  DEFAULT: 'gpt-4.1',
};

// 🤖 v2.0: Configurações de tokens e temperatura
export const OPENAI_CONFIG = {
  MAX_TOKENS_ORCHESTRATOR: parseInt(process.env.OPENAI_MAX_TOKENS_ORCHESTRATOR || '4096'),
  MAX_TOKENS_POST: parseInt(process.env.OPENAI_MAX_TOKENS_POST || '2048'),
  TEMPERATURE_CREATIVE: parseFloat(process.env.OPENAI_TEMPERATURE_CREATIVE || '0.85'),
  TEMPERATURE_NEUTRAL: parseFloat(process.env.OPENAI_TEMPERATURE_NEUTRAL || '0.6'),
};

// ==================== HELPERS ====================

export function isOpenAIConfigured(): boolean {
  return Boolean(OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-'));
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
    throw new Error('OpenAI não configurada. Defina OPENAI_API_KEY no ambiente.');
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

  console.log(`[OpenAI] Chamando modelo ${selectedModel} com ${messages.length} mensagens...`);

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[OpenAI] Erro ${response.status}: ${errorText}`);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
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
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
    model: data.model,
  };

  console.log(`[OpenAI] ✅ Resposta recebida (${result.usage.totalTokens} tokens)`);

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
