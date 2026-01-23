/**
 * 🎨 AGENTES 2-5 — COPYWRITERS POR REDE
 * 
 * Cada agente tem personalidade e estilo próprio:
 * - ANA (Facebook): Vitrine, escaneável, valoriza imagem
 * - GABRIEL (X/Twitter): Curto, direto, sem parecer robô
 * - THEO (Telegram): Direto, alto volume, zero emoção
 * - LAURA (WhatsApp): Conversacional, alta conversão
 */

import { Channel } from '@prisma/client';
import { createCompletion, parseAIJson } from '../openai.js';
import type { CopywriterInput, CopywriterOutput } from '../types.js';

// ==================== AGENT CONFIGS ====================

const AGENTS: Record<string, {
  name: string;
  networks: Channel[];
  systemPrompt: string;
  maxChars: number;
}> = {
  
  // ─────────────────────────────────────────────────────
  // AGENTE 2 — ANA (FACEBOOK + INSTAGRAM)
  // ─────────────────────────────────────────────────────
  ANA: {
    name: 'ANA',
    networks: ['FACEBOOK', 'INSTAGRAM'],
    maxChars: 500,
    systemPrompt: `Você é a ANA, copywriter especialista em Facebook e Instagram.

Sua personalidade:
- Tom de vitrine elegante
- Texto escaneável (fácil de ler rápido)
- Valoriza a IMAGEM como protagonista
- Fala como uma amiga que achou uma promoção boa

REGRAS:
1. Máximo 500 caracteres
2. Use quebras de linha para escaneabilidade
3. Destaque o PREÇO e o DESCONTO
4. NÃO use muitos emojis (máximo 2-3)
5. NÃO pareça um vendedor desesperado
6. O link vai ser adicionado depois, NÃO inclua

ESTILOS:
- "vitrine": Apresentação limpa, foco no produto
- "urgente": Criar senso de urgência real
- "storytelling": Contar uma mini-história

RESPONDA EM JSON:
{
  "textFinal": "texto da copy aqui",
  "reasoning": "porque escolhi este approach",
  "emoji": "🛍️"
}`,
  },

  // ─────────────────────────────────────────────────────
  // AGENTE 3 — GABRIEL (X/TWITTER)
  // ─────────────────────────────────────────────────────
  GABRIEL: {
    name: 'GABRIEL',
    networks: ['TWITTER'],
    maxChars: 240,
    systemPrompt: `Você é o GABRIEL, copywriter especialista em X (Twitter).

Sua personalidade:
- Direto ao ponto
- Tom casual, como um amigo
- Alta rotatividade de estilos
- NUNCA parecer um robô ou spam

REGRAS:
1. Máximo 240 caracteres (OBRIGATÓRIO - X tem limite)
2. O link vai ser adicionado depois (reserve ~25 chars)
3. Use APENAS 1 emoji (ou nenhum)
4. NÃO use hashtags demais (máximo 1)
5. NÃO comece com "🔥" ou "⚡" (clichê de robô)
6. Varie o estilo entre posts

ESTILOS:
- "direto": Preço + desconto + ponto final
- "meme": Referência a meme atual
- "tech": Linguagem de quem entende do produto

RESPONDA EM JSON:
{
  "textFinal": "texto da copy aqui",
  "reasoning": "porque escolhi este approach",
  "hashtags": ["#promo"]
}`,
  },

  // ─────────────────────────────────────────────────────
  // AGENTE 4 — THEO (TELEGRAM)
  // ─────────────────────────────────────────────────────
  THEO: {
    name: 'THEO',
    networks: ['TELEGRAM'],
    maxChars: 350,
    systemPrompt: `Você é o THEO, copywriter especialista em Telegram.

Sua personalidade:
- Ultra direto
- Zero emoção desnecessária
- Foco em INFORMAÇÃO
- Alto volume = consistência

REGRAS:
1. Máximo 350 caracteres
2. Formato padrão:
   [Título curto]
   De R$X por R$Y (-XX%)
   [1 linha extra se necessário]
3. O link vai ser adicionado depois
4. Máximo 1 emoji (pode ser nenhum)
5. NÃO use linguagem de vendedor
6. SEJA CONSISTENTE no formato

ESTILOS:
- "informativo": Dados puros, sem firulas
- "flash": Urgência real (só quando faz sentido)
- "volume": Template padrão para alto volume

RESPONDA EM JSON:
{
  "textFinal": "texto da copy aqui",
  "reasoning": "porque escolhi este approach"
}`,
  },

  // ─────────────────────────────────────────────────────
  // AGENTE 5 — LAURA (WHATSAPP)
  // ─────────────────────────────────────────────────────
  LAURA: {
    name: 'LAURA',
    networks: ['WHATSAPP'],
    maxChars: 400,
    systemPrompt: `Você é a LAURA, copywriter especialista em WhatsApp.

Sua personalidade:
- Conversacional e pessoal
- Como uma amiga mandando mensagem
- Foco em CONVERSÃO (poucos posts, mas certeiros)
- Premium feel - só manda o que vale a pena

REGRAS:
1. Máximo 400 caracteres
2. Tom de mensagem pessoal, NÃO de broadcast
3. Use o nome do produto naturalmente
4. O link vai ser adicionado depois
5. Máximo 2 emojis
6. Pode usar quebras de linha como em chat

ESTILOS:
- "pessoal": Como se fosse mensagem individual
- "exclusivo": Sensação de acesso VIP
- "premium": Para produtos caros

RESPONDA EM JSON:
{
  "textFinal": "texto da copy aqui",
  "reasoning": "porque escolhi este approach",
  "emoji": "💬"
}`,
  },
};

// ==================== SITE AGENT (EXTRA) ====================

const SITE_AGENT = {
  name: 'SITE',
  maxChars: 800,
  systemPrompt: `Você é um copywriter especialista em conteúdo para SITE (SEO).

REGRAS:
1. Máximo 800 caracteres
2. Texto completo e informativo
3. Inclua detalhes do produto
4. Mencione a loja
5. O link vai ser adicionado depois
6. Tom profissional mas acessível

RESPONDA EM JSON:
{
  "textFinal": "texto da copy aqui",
  "reasoning": "abordagem SEO-friendly"
}`,
};

// ==================== MAIN FUNCTION ====================

export async function runCopywriter(input: CopywriterInput): Promise<CopywriterOutput> {
  const { offer, style, network } = input;

  // Encontrar agente correto
  const agent = findAgentForNetwork(network);
  
  console.log(`[${agent.name}] ✍️ Gerando copy (${style}) para ${network}...`);

  const userMessage = `Gere uma copy estilo "${style}" para esta oferta:

DADOS:
- Produto: ${offer.title}
- Preço Original: R$ ${offer.originalPrice.toFixed(2)}
- Preço Final: R$ ${offer.finalPrice.toFixed(2)}
- Desconto: ${offer.discountPct}%
- Loja: ${offer.storeName}
- Categoria: ${offer.nicheName}
${offer.couponCode ? `- Cupom: ${offer.couponCode}` : ''}
${offer.urgency !== 'NORMAL' ? `- Urgência: ${offer.urgency}` : ''}

Lembre-se: máximo ${agent.maxChars} caracteres. O link será adicionado depois.`;

  try {
    // 🤖 v2.0: Mapear rede para agente
    const agentType = network === 'FACEBOOK' || network === 'INSTAGRAM' ? 'FACEBOOK' :
                      network === 'TWITTER' ? 'X' :
                      network === 'TELEGRAM' ? 'TELEGRAM' :
                      network === 'WHATSAPP' ? 'WHATSAPP' : 'TELEGRAM';

    const result = await createCompletion(
      [
        { role: 'system', content: agent.systemPrompt },
        { role: 'user', content: userMessage },
      ],
      {
        temperature: 0.8, // Mais criativo para copies
        maxTokens: 400,
        responseFormat: 'json',
        agent: agentType,
      }
    );

    const parsed = parseAIJson<{
      textFinal: string;
      reasoning: string;
      hashtags?: string[];
      emoji?: string;
    }>(result.content);

    // Validar tamanho
    let text = parsed.textFinal;
    if (text.length > agent.maxChars) {
      text = text.substring(0, agent.maxChars - 3) + '...';
    }

    console.log(`[${agent.name}] ✅ Copy gerada (${text.length} chars)`);

    return {
      textFinal: text,
      reasoning: parsed.reasoning,
      hashtags: parsed.hashtags,
      emoji: parsed.emoji,
    };
  } catch (error) {
    console.error(`[${agent.name}] ❌ Erro:`, error);
    
    // Fallback: copy básica
    return createFallbackCopy(offer, network, agent.maxChars);
  }
}

// ==================== HELPERS ====================

function findAgentForNetwork(network: Channel): typeof SITE_AGENT {
  if (network === 'SITE') {
    return SITE_AGENT;
  }

  for (const agent of Object.values(AGENTS)) {
    if (agent.networks.includes(network)) {
      return agent;
    }
  }

  // Fallback para THEO (Telegram) que é mais genérico
  return AGENTS.THEO;
}

function createFallbackCopy(
  offer: { title: string; finalPrice: number; discountPct: number; storeName: string },
  network: Channel,
  maxChars: number
): CopywriterOutput {
  const price = `R$ ${offer.finalPrice.toFixed(2)}`;
  const discount = `${offer.discountPct}% OFF`;
  
  let text = `${offer.title}\n${price} (${discount})\nNa ${offer.storeName}`;
  
  if (text.length > maxChars) {
    const shortTitle = offer.title.substring(0, 50) + '...';
    text = `${shortTitle}\n${price} (${discount})`;
  }

  return {
    textFinal: text,
    reasoning: `Fallback automático para ${network}`,
  };
}

// ==================== BATCH FUNCTION ====================

/**
 * Gera copies para múltiplas redes em paralelo
 */
export async function runCopywriterBatch(
  offer: CopywriterInput['offer'],
  jobs: Array<{ network: Channel; style: string }>
): Promise<Map<Channel, CopywriterOutput>> {
  const results = new Map<Channel, CopywriterOutput>();

  // Executar em paralelo
  const promises = jobs.map(async (job) => {
    const output = await runCopywriter({
      offer,
      network: job.network,
      style: job.style,
    });
    return { network: job.network, output };
  });

  const settled = await Promise.allSettled(promises);

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.set(result.value.network, result.value.output);
    }
  }

  return results;
}

export default { runCopywriter, runCopywriterBatch };
