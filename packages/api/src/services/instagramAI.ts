/**
 * Instagram AI Layer
 *
 * Camada de inteligência que decide:
 *  1. Score da oferta para Instagram (0-100)
 *  2. Formato ideal: CAROUSEL vs REEL
 *  3. Caption criativa (copywriter Ana)
 *
 * Usa a Curadora existente + copywriter Ana.
 */

import { createCompletion, parseAIJson } from './ai/openai.js';
import { generateInstagramCaption } from './postforme.js';
import { InstagramFormat } from '@prisma/client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OfferDataForAI {
  id: string;
  title: string;
  finalPrice: number;
  originalPrice?: number | null;
  discountPct?: number | null;
  nicheName?: string;
  storeName?: string;
  imageUrl?: string | null;
  promoType?: string;
  urgency?: string;
  affiliateUrl?: string;
  installments?: number | null;
  installmentValue?: number | null;
  paymentMethod?: 'pix' | 'parcelado' | 'normal' | null;
}

export interface InstagramAIDecision {
  score: number;                    // 0–100
  format: InstagramFormat;          // CAROUSEL | REEL
  caption: string;                  // Caption para o post
  reasoning: string;                // Por que esse score/formato
  shouldPublish: boolean;           // Score >= 40 = publicar
  urgencyTag?: string;              // "RELÂMPAGO", "HOJE" etc.
}

// ── System Prompt da IA Instagram ─────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é a ANA, especialista em Instagram para o canal "Manu das Promoções".

Sua função é:
1. Avaliar o SCORE da oferta para Instagram (0-100)
2. Escolher o FORMATO ideal: CAROUSEL (imagens) ou REEL (vídeo curto animado)
3. Gerar uma CAPTION criativa e com personalidade brasileira

REGRAS DE SCORE:
- Desconto >= 50%: +35 pontos
- Desconto 30-49%: +20 pontos
- Desconto 20-29%: +10 pontos
- Tem imagem boa: +15 pontos
- Produto visual (moda/beleza/casa/games): +10 pontos
- Urgência/relâmpago: +10 pontos
- Produto de marca conhecida: +10 pontos
- Pagamento PIX ou parcelamento: +5 pontos

REGRAS DE FORMATO:
- REEL: Score >= 70 E (urgência alta OU produto muito visual OU desconto >= 50%)
- CAROUSEL: todos os outros casos (score >= 40)
- Se score < 40: não publicar no Instagram

REGRAS DA CAPTION:
- Máximo 2.200 caracteres
- Tom: animado, brasileiro, com personalidade
- Incluir: nome do produto, preço, desconto, link na bio
- Hashtags relevantes por nicho
- Emojis moderados (não exagerar)
- NUNCA usar preço falso ou desconto inventado

RESPONDA SOMENTE EM JSON:
{
  "score": 82,
  "format": "REEL",
  "caption": "...",
  "reasoning": "...",
  "shouldPublish": true,
  "urgencyTag": "RELÂMPAGO"
}`;

// ── Main Function ──────────────────────────────────────────────────────────────

export async function analyzeOfferForInstagram(
  offer: OfferDataForAI,
): Promise<InstagramAIDecision> {
  const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: v % 1 !== 0 ? 2 : 0 });

  const userMessage = `Analise esta oferta para o Instagram:

PRODUTO: ${offer.title}
LOJA: ${offer.storeName || 'N/A'}
NICHO: ${offer.nicheName || 'N/A'}
PREÇO FINAL: ${fmtBRL(offer.finalPrice)}
PREÇO ORIGINAL: ${offer.originalPrice ? fmtBRL(offer.originalPrice) : 'N/A'}
DESCONTO: ${offer.discountPct || 0}%
TEM IMAGEM: ${offer.imageUrl ? 'Sim' : 'Não'}
URGÊNCIA: ${offer.urgency || 'NORMAL'}
TIPO: ${offer.promoType || 'NORMAL'}
PAGAMENTO: ${
    offer.paymentMethod === 'pix'
      ? 'PIX'
      : offer.paymentMethod === 'parcelado' && offer.installments
      ? `${offer.installments}x de ${fmtBRL(offer.installmentValue ?? offer.finalPrice / offer.installments)}`
      : 'À vista'
  }

URL AFILIADO: ${offer.affiliateUrl || 'N/A'}`;

  try {
    const result = await createCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      {
        temperature: 0.5,
        maxTokens: 800,
        responseFormat: 'json',
        agent: 'INSTAGRAM',
      },
    );

    const parsed = parseAIJson<{
      score: number;
      format: string;
      caption: string;
      reasoning: string;
      shouldPublish: boolean;
      urgencyTag?: string;
    }>(result.content);

    const format = normalizeFormat(parsed.format);

    console.log(
      `[InstagramAI] ✅ Score: ${parsed.score} | Formato: ${format} | Publicar: ${parsed.shouldPublish}`,
    );

    return {
      score: Math.min(100, Math.max(0, parsed.score)),
      format,
      caption: parsed.caption,
      reasoning: parsed.reasoning,
      shouldPublish: parsed.shouldPublish && parsed.score >= 40,
      urgencyTag: parsed.urgencyTag,
    };
  } catch (err: any) {
    console.warn('[InstagramAI] IA indisponível, usando fallback:', err.message);
    return fallbackDecision(offer);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeFormat(raw: string): InstagramFormat {
  const up = (raw || '').toUpperCase();
  if (up === 'REEL') return 'REEL';
  if (up === 'STORY') return 'STORY';
  return 'CAROUSEL';
}

function fallbackDecision(offer: OfferDataForAI): InstagramAIDecision {
  const disc = offer.discountPct || 0;
  let score = 40;
  if (disc >= 50) score += 35;
  else if (disc >= 30) score += 20;
  else if (disc >= 20) score += 10;
  if (offer.imageUrl) score += 15;

  const format: InstagramFormat = score >= 70 && disc >= 50 ? 'REEL' : 'CAROUSEL';

  const caption = generateInstagramCaption({
    title: offer.title,
    finalPrice: offer.finalPrice,
    originalPrice: offer.originalPrice,
    discountPct: offer.discountPct,
    installments: offer.installments,
    installmentValue: offer.installmentValue,
    paymentMethod: offer.paymentMethod,
    affiliateUrl: offer.affiliateUrl,
    nicheName: offer.nicheName,
  });

  return {
    score,
    format,
    caption,
    reasoning: 'Avaliação automática (fallback — IA indisponível)',
    shouldPublish: score >= 40,
  };
}
