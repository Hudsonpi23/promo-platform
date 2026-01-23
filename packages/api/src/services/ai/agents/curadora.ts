/**
 * 🧠 AGENTE 0 — CURADORA
 * 
 * Função:
 * - Avaliar qualidade da oferta
 * - Calcular score de prioridade
 * - Identificar risco
 * - Sugerir redes recomendadas
 * 
 * Entrada: OFFER
 * Saída: priority_score, risk_level, recommended_networks
 */

import { Channel, RiskLevel } from '@prisma/client';
import { createCompletion, parseAIJson } from '../openai.js';
import type { OfferForAI, CuradoraInput, CuradoraOutput } from '../types.js';

// ==================== SYSTEM PROMPT ====================

const SYSTEM_PROMPT = `Você é a CURADORA, uma IA especialista em avaliar ofertas para marketing de afiliados no Brasil.

Sua função é:
1. Avaliar a QUALIDADE da oferta (título, preço, desconto, imagem)
2. Calcular um SCORE DE PRIORIDADE (0-100)
3. Identificar RISCOS (preço suspeito, desconto irreal, etc)
4. Recomendar REDES SOCIAIS adequadas

CRITÉRIOS DE AVALIAÇÃO:

📊 SCORE (0-100):
- Desconto real > 50%: +30 pontos
- Desconto 30-50%: +20 pontos
- Desconto 20-30%: +10 pontos
- Preço original coerente: +15 pontos
- Título claro e atrativo: +15 pontos
- Produto de marca conhecida: +20 pontos
- Urgência legítima: +10 pontos
- Cupom disponível: +10 pontos

⚠️ RISCO:
- LOW: Oferta normal, sem problemas
- MEDIUM: Algo parece estranho, mas pode ser legítimo
- HIGH: Desconto muito alto ou dados inconsistentes
- BLOCKED: Claramente falso ou perigoso (scam, phishing)

🌐 REDES RECOMENDADAS:
- FACEBOOK: Produtos visuais, casa, moda (público 25-55)
- TWITTER: Tech, games, eletrônicos (público jovem)
- TELEGRAM: Alto volume, qualquer produto
- WHATSAPP: Conversão alta, produtos premium
- INSTAGRAM: Visual, moda, beleza, lifestyle
- SITE: Tudo (SEO)

RESPONDA SEMPRE EM JSON:
{
  "priorityScore": 85,
  "riskLevel": "LOW",
  "recommendedNetworks": ["FACEBOOK", "TELEGRAM", "SITE"],
  "reasoning": "Desconto de 45% em produto Apple é excelente...",
  "suggestions": ["Destacar economia em reais"]
}

Se BLOCKED, adicione "blockReason".`;

// ==================== MAIN FUNCTION ====================

export async function runCuradora(input: CuradoraInput): Promise<CuradoraOutput> {
  const { offer } = input;

  console.log(`[Curadora] 🧠 Avaliando oferta: ${offer.title.substring(0, 50)}...`);

  const userMessage = `Avalie esta oferta:

DADOS DA OFERTA:
- Título: ${offer.title}
- Descrição: ${offer.description || 'Não informada'}
- Preço Original: R$ ${offer.originalPrice.toFixed(2)}
- Preço Final: R$ ${offer.finalPrice.toFixed(2)}
- Desconto: ${offer.discountPct}%
- Loja: ${offer.storeName}
- Nicho: ${offer.nicheName}
- Urgência: ${offer.urgency}
- Tipo: ${offer.promoType}
- Cupom: ${offer.couponCode || 'Nenhum'}
- Imagem Principal: ${offer.mainImage ? 'Sim' : 'Não'}
- Galeria: ${offer.images.length} imagens`;

  try {
    const result = await createCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      {
        temperature: 0.3, // Mais determinístico para avaliação
        maxTokens: 500,
        responseFormat: 'json',
        agent: 'ORCHESTRATOR', // Curadora usa modelo do Orquestrador
      }
    );

    const parsed = parseAIJson<{
      priorityScore: number;
      riskLevel: string;
      recommendedNetworks: string[];
      reasoning: string;
      blockReason?: string;
      suggestions?: string[];
    }>(result.content);

    // Validar e normalizar
    const output: CuradoraOutput = {
      priorityScore: Math.min(100, Math.max(0, parsed.priorityScore)),
      riskLevel: validateRiskLevel(parsed.riskLevel),
      recommendedNetworks: validateNetworks(parsed.recommendedNetworks),
      reasoning: parsed.reasoning,
      blockReason: parsed.blockReason,
      suggestions: parsed.suggestions,
    };

    console.log(`[Curadora] ✅ Score: ${output.priorityScore}, Risco: ${output.riskLevel}`);

    return output;
  } catch (error) {
    console.error('[Curadora] ❌ Erro:', error);
    
    // Fallback: avaliação básica
    return createFallbackEvaluation(offer);
  }
}

// ==================== HELPERS ====================

function validateRiskLevel(level: string): RiskLevel {
  const valid: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'BLOCKED'];
  const upper = level.toUpperCase() as RiskLevel;
  return valid.includes(upper) ? upper : 'MEDIUM';
}

function validateNetworks(networks: string[]): Channel[] {
  const valid: Channel[] = ['FACEBOOK', 'TWITTER', 'TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'SITE'];
  return networks
    .map(n => n.toUpperCase() as Channel)
    .filter(n => valid.includes(n));
}

function createFallbackEvaluation(offer: OfferForAI): CuradoraOutput {
  // Avaliação básica sem IA
  let score = 50;
  
  if (offer.discountPct >= 50) score += 25;
  else if (offer.discountPct >= 30) score += 15;
  else if (offer.discountPct >= 20) score += 10;

  if (offer.mainImage) score += 10;
  if (offer.couponCode) score += 5;

  const riskLevel: RiskLevel = offer.discountPct > 80 ? 'HIGH' : 'LOW';

  return {
    priorityScore: Math.min(100, score),
    riskLevel,
    recommendedNetworks: ['TELEGRAM', 'FACEBOOK', 'SITE'],
    reasoning: 'Avaliação automática (fallback) - IA não disponível',
  };
}

export default { runCuradora };
