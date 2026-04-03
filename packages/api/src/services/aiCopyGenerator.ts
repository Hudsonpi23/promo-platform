/**
 * AI Copy Generator Service — Versão Limpa (sem frases pré-feitas)
 *
 * Gera textos factuais para ofertas: título, preço, desconto e link.
 * A personalidade e frases criativas ficam a cargo dos agentes (Manu, etc.)
 * que podem customizar a copy antes de publicar.
 */

// ==================== TYPES ====================

export type PaymentMethod = 'pix' | 'avista' | 'parcelado';

export interface CopyInputData {
  title: string;
  price: number;
  oldPrice?: number | null;
  discountPct: number;
  advertiserName?: string | null;
  storeName?: string | null;
  category?: string | null;
  trackingUrl: string;
  siteUrl?: string | null;
  isFlash?: boolean;
  flashMinutes?: number;
  paymentMethod?: PaymentMethod;
  installments?: number;
  installmentValue?: number;
  phraseMode?: 'generic' | 'brand';
  couponCode?: string | null;
}

export interface GeneratedCopies {
  telegram: string;
  site: string;
  x: string;
  variations?: {
    telegram: string[];
    site: string[];
    x: string[];
  };
}

export interface CopyGeneratorOptions {
  generateVariations?: boolean;
  useAI?: boolean;
  style?: 'casual' | 'urgente' | 'informativo';
}

// ==================== CONSTANTS ====================

const CHAR_LIMITS = {
  TELEGRAM: 1024,
  SITE: 600,
  X: 280,
};

// ==================== HELPERS ====================

function formatPrice(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

function shortTitle(title: string, max: number): string {
  if (title.length <= max) return title;
  const cut = title.substring(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? cut.substring(0, lastSpace) : cut) + '...';
}

function buildPriceLine(input: CopyInputData): string {
  const priceNow = formatPrice(input.price);

  if (input.oldPrice && input.oldPrice > input.price && input.discountPct > 0) {
    const priceOld = formatPrice(input.oldPrice);
    return `DE ${priceOld} POR ${priceNow} 🔥 (-${Math.round(input.discountPct)}% OFF)`;
  }

  return `POR ${priceNow}`;
}

function buildPaymentLine(input: CopyInputData): string {
  if (input.paymentMethod === 'pix') return '💳 Preço no PIX';
  if (input.paymentMethod === 'parcelado' && input.installments) {
    const perInstallment = input.installmentValue ?? input.price / input.installments;
    return `💳 ${input.installments}x de ${formatPrice(perInstallment)} sem juros`;
  }
  return '';
}

function buildCouponLine(input: CopyInputData): string {
  if (!input.couponCode) return '';
  return `🏷️ Cupom: ${input.couponCode}`;
}

function buildFlashLine(input: CopyInputData): string {
  if (!input.isFlash) return '';
  const hours = input.flashMinutes ? Math.round(input.flashMinutes / 60) : 3;
  return `⏰ Oferta relâmpago — válida por ${hours}h`;
}

// ==================== COPY GENERATORS ====================

function generateTelegramCopy(input: CopyInputData): string {
  const titleText = shortTitle(input.title, 80).toUpperCase();
  const priceLine = buildPriceLine(input);
  const paymentLine = buildPaymentLine(input);
  const couponLine = buildCouponLine(input);
  const flashLine = buildFlashLine(input);
  const url = input.trackingUrl || '';

  const parts: string[] = [];

  parts.push(`📦 ${titleText}`);
  parts.push(priceLine);
  if (paymentLine) parts.push(paymentLine);
  if (couponLine) parts.push(couponLine);
  if (flashLine) parts.push(flashLine);
  if (input.storeName) parts.push(`🏪 ${input.storeName}`);

  let text = parts.join('\n');
  text += `\n\n${url}`;

  if (input.siteUrl) {
    text += `\n\n🌐 ${input.siteUrl}`;
  }

  return truncate(text, CHAR_LIMITS.TELEGRAM);
}

function generateSiteCopy(input: CopyInputData): string {
  const titleText = shortTitle(input.title, 100).toUpperCase();
  const priceLine = buildPriceLine(input);
  const paymentLine = buildPaymentLine(input);
  const couponLine = buildCouponLine(input);
  const flashLine = buildFlashLine(input);

  const parts: string[] = [];

  parts.push(`🔥 ${titleText}`);
  parts.push(priceLine);
  if (paymentLine) parts.push(paymentLine);
  if (couponLine) parts.push(couponLine);
  if (flashLine) parts.push(flashLine);

  return truncate(parts.join('\n'), CHAR_LIMITS.SITE);
}

function generateXCopy(input: CopyInputData): string {
  const url = input.trackingUrl || '';
  const priceNow = formatPrice(input.price);
  const titleMax = 90;

  // ── Linha de preço: destaque visual separado ──────────────────────────────
  let priceLine = '';
  if (input.oldPrice && input.oldPrice > input.price && input.discountPct > 0) {
    const discount = Math.round(input.discountPct);
    // Original riscado visualmente com seta → preço final + % de desconto
    priceLine = `💰 De ${formatPrice(input.oldPrice)} → ${priceNow} (-${discount}%)`;
  } else {
    priceLine = `💰 ${priceNow}`;
  }

  // ── Linha de forma de pagamento ───────────────────────────────────────────
  let paymentLine = '';
  if (input.paymentMethod === 'pix') {
    paymentLine = `💸 No PIX`;
  } else if (input.paymentMethod === 'parcelado' && input.installments) {
    const perInstallment = input.installmentValue ?? input.price / input.installments;
    paymentLine = `💳 ${input.installments}x de ${formatPrice(perInstallment)} sem juros`;
  }

  // ── Montar texto com cada info em sua própria linha ───────────────────────
  const parts: string[] = [];
  parts.push(`📦 ${shortTitle(input.title, titleMax)}`);
  parts.push('');                      // linha em branco após o título
  parts.push(priceLine);
  if (paymentLine) parts.push(paymentLine);
  if (input.couponCode) parts.push(`🏷️ Cupom: ${input.couponCode}`);
  parts.push('');                      // linha em branco antes da URL
  parts.push(`👉 ${url}`);

  let text = parts.join('\n');

  // ── Fallback compacto se ultrapassar o limite ─────────────────────────────
  if (text.length > CHAR_LIMITS.X) {
    const shorter = shortTitle(input.title, 55);
    const compactParts: string[] = [`📦 ${shorter}`, ''];
    compactParts.push(priceLine);
    if (paymentLine) compactParts.push(paymentLine);
    compactParts.push('');
    compactParts.push(`👉 ${url}`);
    text = compactParts.join('\n');
  }

  return truncate(text, CHAR_LIMITS.X);
}

// ==================== MAIN EXPORT ====================

export function generateCopies(
  input: CopyInputData,
  _options?: CopyGeneratorOptions
): GeneratedCopies {
  return {
    telegram: generateTelegramCopy(input),
    site: generateSiteCopy(input),
    x: generateXCopy(input),
  };
}

export function validateCopy(
  text: string,
  channel: 'TELEGRAM' | 'SITE' | 'X'
): { valid: boolean; length: number; limit: number; overflow: number } {
  const limit = CHAR_LIMITS[channel];
  const length = text.length;
  return { valid: length <= limit, length, limit, overflow: Math.max(0, length - limit) };
}

export function prepareDataForAI(input: CopyInputData): Record<string, unknown> {
  return {
    title: input.title,
    price: input.price,
    oldPrice: input.oldPrice || null,
    discountPct: Math.round(input.discountPct),
    advertiserName: input.advertiserName || null,
    category: input.category || null,
    trackingUrl: input.trackingUrl,
  };
}

export function generateAIPrompt(input: CopyInputData): string {
  const data = prepareDataForAI(input);
  return `Você é um copywriter de promoções brasileiro.

Gere textos de marketing para esta oferta:
${JSON.stringify(data, null, 2)}

REGRAS:
1. Mencionar preço atual e desconto se houver
2. NÃO inventar urgência falsa
3. Tom casual, como amigo avisando sobre promoção
4. Frase de abertura criativa e relevante ao produto

GERAR:
1. copyTelegram: ≤ 350 caracteres
2. copySite: ≤ 600 caracteres
3. copyX: ≤ 240 caracteres

Responda em JSON:
{
  "copyTelegram": "...",
  "copySite": "...",
  "copyX": "..."
}`;
}

export default {
  generateCopies,
  validateCopy,
  prepareDataForAI,
  generateAIPrompt,
  CHAR_LIMITS,
};
