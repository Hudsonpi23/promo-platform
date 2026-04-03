/**
 * Coupon Calculator
 *
 * Suporta os dois tipos de cupom do Mercado Livre:
 *
 * TIPO 1 — Percentual (%): aplica % sobre o preço já com desconto do anúncio
 *   Fórmula: descontoReal = 1 - (1 - d1) × (1 - d2)
 *
 * TIPO 2 — Valor fixo (R$): subtrai valor diretamente do preço com desconto do anúncio
 *   Fórmula: preçoFinal = preçoComDesconto - cupomFixo
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type CouponType = 'percent' | 'fixed';

export interface CouponInput {
  /** Preço original do produto (sem nenhum desconto — usado para calcular % total e exibição) */
  originalPrice: number;
  /** Desconto do anúncio em % (ex: 30 para 30%). 0 se não houver. */
  adDiscountPct: number;
  /**
   * Preço JÁ descontado pelo anúncio (ex: preço listado no ML).
   * Quando fornecido, substitui o cálculo interno (originalPrice × (1-adDiscountPct)).
   * Use sempre que o preço após o desconto já seja conhecido com precisão.
   */
  priceBeforeCoupon?: number | null;
  /** Código do cupom (ex: "FILA10") */
  couponCode: string;
  /**
   * Tipo do cupom:
   * - 'percent': desconto em porcentagem (ex: 10%)
   * - 'fixed': desconto em valor fixo (ex: R$30)
   */
  couponType: CouponType;
  /** Desconto do cupom em % — obrigatório se couponType = 'percent' */
  couponDiscountPct?: number | null;
  /** Desconto do cupom em R$ fixo — obrigatório se couponType = 'fixed' */
  couponFixedValue?: number | null;
  /** Limite máximo de economia do cupom em R$ (só se couponType = 'percent'). Null = sem limite. */
  couponMaxSavings?: number | null;
}

export interface CouponResult {
  originalPrice: number;
  priceAfterAdDiscount: number;
  couponSavings: number;
  finalPrice: number;
  totalSavingsAmount: number;
  totalDiscountPct: number;
  /** true se o limite do cupom foi atingido e cortou a economia (só para tipo %) */
  couponWasCapped: boolean;
  couponCode: string;
  couponType: CouponType;
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
    priceBeforeCoupon,
    couponCode,
    couponType,
    couponDiscountPct,
    couponFixedValue,
    couponMaxSavings = null,
  } = input;

  // 1️⃣ Preço base para o cupom = priceBeforeCoupon (preço listado/final já com desconto).
  //    Nunca recalculamos o desconto do anúncio — o finalPrice DO SITE é o que vale.
  const d1 = adDiscountPct / 100;
  const priceAfterAdDiscount = priceBeforeCoupon != null
    ? round2(priceBeforeCoupon)
    : round2(originalPrice * (1 - d1));

  let couponSavings = 0;
  let couponWasCapped = false;

  const resolvedType: CouponType = couponType ?? 'percent';

  if (resolvedType === 'percent') {
    // 2️⃣-A Cupom %: calcula sobre o preço já reduzido (desconto composto)
    const d2 = (couponDiscountPct ?? 0) / 100;
    couponSavings = round2(priceAfterAdDiscount * d2);

    // Aplica limite máximo se existir
    if (couponMaxSavings !== null && couponSavings > couponMaxSavings) {
      couponSavings = couponMaxSavings;
      couponWasCapped = true;
    }
  } else {
    // 2️⃣-B Cupom R$ fixo: valor subtraído diretamente
    couponSavings = Math.min(round2(couponFixedValue ?? 0), priceAfterAdDiscount);
  }

  // 3️⃣ Preço final
  const finalPrice = round2(priceAfterAdDiscount - couponSavings);

  // 4️⃣ Desconto total real
  const totalSavingsAmount = round2(originalPrice - finalPrice);
  const totalDiscountPct = Math.round((totalSavingsAmount / originalPrice) * 100);

  // 5️⃣ Gera CTA e linha de slide
  let couponDesc: string;
  if (resolvedType === 'fixed') {
    couponDesc = `${formatBRL(couponFixedValue ?? 0)} de desconto`;
  } else {
    couponDesc = `${couponDiscountPct}% OFF`;
    if (couponWasCapped) couponDesc += ` (limitado a ${formatBRL(couponMaxSavings!)})`;
  }

  const cta =
    `🔥 De ${formatBRL(originalPrice)} por ${formatBRL(finalPrice)} ` +
    `(${totalDiscountPct}% OFF real com cupom)\n` +
    `🎟️ Use o cupom: ${couponCode.toUpperCase()} — ${couponDesc}`;

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
    couponType: resolvedType,
    cta,
    slideLine,
  };
}

// ── Variante simplificada (sem anúncio, só cupom %) ───────────────────────────

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
    couponType: 'percent',
    couponDiscountPct: params.couponDiscountPct,
    couponMaxSavings: params.couponMaxSavings,
  });
}
