/**
 * Teste do calculador de cupom
 * Uso: npx tsx test-coupon.ts
 */
import { calculateWithCoupon, calculateCouponOnly } from './src/services/couponCalculator.js';

console.log('═══════════════════════════════════════════════');
console.log('  TESTE 1 — Anúncio 30% + Cupom 10% (sem limite)');
console.log('═══════════════════════════════════════════════');
const t1 = calculateWithCoupon({
  originalPrice: 1000,
  adDiscountPct: 30,
  couponCode: 'FILA10',
  couponDiscountPct: 10,
});
console.log(`Preço original:        R$ ${t1.originalPrice}`);
console.log(`Após desconto anúncio: R$ ${t1.priceAfterAdDiscount}`);
console.log(`Economia do cupom:     R$ ${t1.couponSavings}`);
console.log(`Preço final:           R$ ${t1.finalPrice}`);
console.log(`Desconto total real:   ${t1.totalDiscountPct}% OFF`);
console.log(`Cupom limitado?        ${t1.couponWasCapped ? 'SIM' : 'NÃO'}`);
console.log('\n📣 CTA gerado:');
console.log(t1.cta);

console.log('\n═══════════════════════════════════════════════');
console.log('  TESTE 2 — Mesmo caso mas cupom limitado a R$50');
console.log('═══════════════════════════════════════════════');
const t2 = calculateWithCoupon({
  originalPrice: 1000,
  adDiscountPct: 30,
  couponCode: 'FILA10',
  couponDiscountPct: 10,
  couponMaxSavings: 50,
});
console.log(`Economia real do cupom: R$ ${t2.couponSavings} (limitado a R$50)`);
console.log(`Preço final:            R$ ${t2.finalPrice}`);
console.log(`Desconto total real:    ${t2.totalDiscountPct}% OFF`);
console.log(`Cupom limitado?         ${t2.couponWasCapped ? 'SIM ⚠️' : 'NÃO'}`);
console.log('\n📣 CTA gerado:');
console.log(t2.cta);

console.log('\n═══════════════════════════════════════════════');
console.log('  TESTE 3 — Tênis Fila real (anúncio 45% + cupom 10%)');
console.log('═══════════════════════════════════════════════');
const t3 = calculateWithCoupon({
  originalPrice: 392.43,
  adDiscountPct: 45,
  couponCode: 'FILA10',
  couponDiscountPct: 10,
});
console.log(`Preço original:        ${t3.originalPrice}`);
console.log(`Após desconto anúncio: R$ ${t3.priceAfterAdDiscount}`);
console.log(`Economia do cupom:     R$ ${t3.couponSavings}`);
console.log(`Preço final:           R$ ${t3.finalPrice}`);
console.log(`Desconto total real:   ${t3.totalDiscountPct}% OFF`);
console.log('\n📣 CTA gerado:');
console.log(t3.cta);
console.log('\n📊 Linha de slide:');
console.log(t3.slideLine);
