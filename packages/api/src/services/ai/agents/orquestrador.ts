/**
 * 🎯 AGENTE 1 — ORQUESTRADOR
 * 
 * Função:
 * - Decidir em quais redes a oferta será postada
 * - Criar POST_JOB por rede
 * - Definir estilo e prioridade de cada job
 * 
 * Entrada: OFFER + Resultado da Curadora
 * Saída: Lista de POST_JOB
 */

import { Channel } from '@prisma/client';
import { createCompletion, parseAIJson } from '../openai.js';
import type { OrquestradorInput, OrquestradorOutput, PostJobRequest } from '../types.js';

// ==================== SYSTEM PROMPT ====================

const SYSTEM_PROMPT = `Você é o ORQUESTRADOR, uma IA que decide a estratégia de distribuição de ofertas nas redes sociais.

Com base na avaliação da CURADORA, você deve:
1. Decidir QUAIS REDES vão receber o post
2. Definir o ESTILO de copy para cada rede
3. Atribuir PRIORIDADE (1-10) para cada job

REGRAS POR REDE:

📘 FACEBOOK (Agente: ANA)
- Estilos: "vitrine", "storytelling", "urgente"
- Público: 25-55 anos, famílias
- Melhor para: Casa, Eletrodomésticos, Moda, Beleza

🐦 TWITTER/X (Agente: GABRIEL)
- Estilos: "direto", "meme", "tech"
- Público: 18-35 anos, tech-savvy
- Melhor para: Games, Tech, Eletrônicos, Gadgets

✈️ TELEGRAM (Agente: THEO)
- Estilos: "informativo", "flash", "volume"
- Público: Caçadores de ofertas
- Melhor para: TUDO (alto volume)

📱 WHATSAPP (Agente: LAURA)
- Estilos: "pessoal", "exclusivo", "premium"
- Público: Leads qualificados
- Melhor para: Produtos caros, Alta conversão

📸 INSTAGRAM (compartilha com FACEBOOK)
- Estilos: "visual", "lifestyle", "trend"
- Público: 18-40 anos, visual-first
- Melhor para: Moda, Beleza, Lifestyle

🌐 SITE (SEO)
- Estilos: "completo", "seo", "detalhado"
- Público: Busca orgânica
- Melhor para: TUDO

PRIORIDADE:
- 10: Oferta excepcional, postar AGORA
- 7-9: Boa oferta, postar em breve
- 4-6: Oferta normal, pode esperar
- 1-3: Filler, só se não tiver nada melhor

RESPONDA EM JSON:
{
  "jobs": [
    { "network": "TELEGRAM", "style": "flash", "priority": 9 },
    { "network": "FACEBOOK", "style": "vitrine", "priority": 7 }
  ],
  "reasoning": "Oferta com desconto alto é ideal para Telegram..."
}`;

// ==================== MAIN FUNCTION ====================

export async function runOrquestrador(input: OrquestradorInput): Promise<OrquestradorOutput> {
  const { offer, curadoraResult } = input;

  console.log(`[Orquestrador] 🎯 Planejando distribuição para: ${offer.title.substring(0, 50)}...`);

  // Se bloqueado pela Curadora, não criar jobs
  if (curadoraResult.riskLevel === 'BLOCKED') {
    console.log('[Orquestrador] ⛔ Oferta bloqueada pela Curadora');
    return {
      jobs: [],
      reasoning: `Oferta bloqueada: ${curadoraResult.blockReason || 'Risco alto'}`,
    };
  }

  const userMessage = `Planeje a distribuição desta oferta:

DADOS DA OFERTA:
- Título: ${offer.title}
- Preço: R$ ${offer.finalPrice.toFixed(2)} (${offer.discountPct}% OFF)
- Loja: ${offer.storeName}
- Nicho: ${offer.nicheName}
- Urgência: ${offer.urgency}
- Tipo: ${offer.promoType}

AVALIAÇÃO DA CURADORA:
- Score: ${curadoraResult.priorityScore}/100
- Risco: ${curadoraResult.riskLevel}
- Redes Sugeridas: ${curadoraResult.recommendedNetworks.join(', ')}
- Observações: ${curadoraResult.reasoning}

Decida quais redes vão receber o post e com qual estilo.`;

  try {
    const result = await createCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      {
        temperature: 0.5,
        maxTokens: 600,
        responseFormat: 'json',
        agent: 'ORCHESTRATOR',
      }
    );

    const parsed = parseAIJson<{
      jobs: Array<{ network: string; style: string; priority: number }>;
      reasoning: string;
    }>(result.content);

    // Validar e normalizar jobs
    const validJobs = parsed.jobs
      .filter(job => isValidNetwork(job.network))
      .map(job => ({
        network: job.network.toUpperCase() as Channel,
        style: job.style || 'default',
        priority: Math.min(10, Math.max(1, job.priority)),
      }));

    console.log(`[Orquestrador] ✅ ${validJobs.length} jobs planejados`);

    return {
      jobs: validJobs,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error('[Orquestrador] ❌ Erro:', error);
    
    // Fallback: usar redes recomendadas pela Curadora
    return createFallbackPlan(curadoraResult);
  }
}

// ==================== HELPERS ====================

function isValidNetwork(network: string): boolean {
  const valid = ['FACEBOOK', 'TWITTER', 'TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'SITE'];
  return valid.includes(network.toUpperCase());
}

function createFallbackPlan(curadoraResult: { 
  priorityScore: number; 
  recommendedNetworks: Channel[] 
}): OrquestradorOutput {
  const priority = Math.ceil(curadoraResult.priorityScore / 10);
  
  const jobs: PostJobRequest[] = curadoraResult.recommendedNetworks.map(network => ({
    network,
    style: getDefaultStyle(network),
    priority,
  }));

  return {
    jobs,
    reasoning: 'Plano automático (fallback) baseado nas redes recomendadas pela Curadora',
  };
}

function getDefaultStyle(network: Channel): string {
  const styles: Record<Channel, string> = {
    FACEBOOK: 'vitrine',
    TWITTER: 'direto',
    TELEGRAM: 'informativo',
    WHATSAPP: 'pessoal',
    INSTAGRAM: 'visual',
    SITE: 'completo',
  };
  return styles[network] || 'default';
}

export default { runOrquestrador };
