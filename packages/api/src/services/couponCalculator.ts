/**
 * Coupon Calculator
 *
 * Calcula desconto real composto (anúncio + cupom) seguindo a lógica
 * exata do Mercado Livre: descontos são aplicados em cascata, nunca somados.
 *
 * Fórmula: descontoReal = 1 - (1 - d1) × (1 - d2)
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CouponInput {
  /** Preço original do produto (sem nenhum desconto) */
  originalPrice: number;
  /** Desconto do anúncio em % (ex: 30 para 30%). 0 se não houver. */
  adDiscountPct: number;
  /** Código do cupom (ex: "FILA10") */
  couponCode: string;
  /** Desconto do cupom em % (ex: 10 para 10%) */
  couponDiscountPct: number;
  /** Limite máximo de economia do cupom em R$ (ex: 50 para "até R$50"). Null = sem limite. */
  couponMaxSavings?: number | null;
}

export interface CouponResult {
  originalPrice: number;
  priceAfterAdDiscount: number;
  couponSavings: number;
  finalPrice: number;
  totalSavingsAmount: number;
  totalDiscountPct: number;
  /** true se o limite do cupom foi atingido e cortou a economia */
  couponWasCapped: boolean;
  couponCode: string;
  /** CTA pronto para usar no carrossel/caption */
  cta: string;
  /** Linha resumida para o slide */
  slideLine: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ── Main function ──────────────────────────────────────────────────────────────

export function calculateWithCoupon(input: CouponInput): CouponResult {
  const {
    originalPrice,
    adDiscountPct,
    couponCode,
    couponDiscountPct,
    couponMaxSavings = null,
  } = input;

  // 1️⃣ Aplica desconto do anúncio sobre o preço original
  const d1 = adDiscountPct / 100;
  const priceAfterAdDiscount = round2(originalPrice * (1 - d1));

  // 2️⃣ Calcula economia bruta do cupom sobre o preço já reduzido
  const d2 = couponDiscountPct / 100;
  let couponSavings = round2(priceAfterAdDiscount * d2);

  // 3️⃣ Aplica limite do cupom (se existir)
  let couponWasCapped = false;
  if (couponMaxSavings !== null && couponSavings > couponMaxSavings) {
    couponSavings = couponMaxSavings;
    couponWasCapped = true;
  }

  // 4️⃣ Preço final
  const finalPrice = round2(priceAfterAdDiscount - couponSavings);

  // 5️⃣ Desconto total real (composto)
  const totalSavingsAmount = round2(originalPrice - finalPrice);
  const totalDiscountPct = Math.round((totalSavingsAmount / originalPrice) * 100);

  // 6️⃣ Gera CTA e linha de slide
  const capNote = couponWasCapped
    ? ` (cupom limitado a ${formatBRL(couponMaxSavings!)})`
    : '';

  const cta =
    `🔥 De ${formatBRL(originalPrice)} por ${formatBRL(finalPrice)} ` +
    `(${totalDiscountPct}% OFF real com cupom)\n` +
    `🎟️ Use o cupom: ${couponCode.toUpperCase()}${capNote}`;

  const slideLine =
    `${formatBRL(originalPrice)} → ${formatBRL(finalPrice)} | ${totalDiscountPct}% OFF`;

  return {
    originalPrice,
    priceAfterAdDiscount,
    couponSavings,
    finalPrice,
    totalSavingsAmount,
    totalDiscountPct,
    couponWasCapped,
    couponCode: couponCode.toUpperCase(),
    cta,
    slideLine,
  };
}

// ── Variante simplificada (sem anúncio, só cupom) ─────────────────────────────

export function calculateCouponOnly(params: {
  currentPrice: number;
  couponCode: string;
  couponDiscountPct: number;
  couponMaxSavings?: number | null;
}): CouponResult {
  return calculateWithCoupon({
    originalPrice: params.currentPrice,
    adDiscountPct: 0,
    couponCode: params.couponCode,
    couponDiscountPct: params.couponDiscountPct,
    couponMaxSavings: params.couponMaxSavings,
  });
}
