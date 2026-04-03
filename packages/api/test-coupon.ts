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
console.log('  TESTE 3 — Nescafé ML real (listado R$599, cupom R$120 fixo)');
console.log('  Correto: R$599 - R$120 = R$479');
console.log('═══════════════════════════════════════════════');
const t3 = calculateWithCoupon({
  originalPrice: 974.99,
  adDiscountPct: 38,
  priceBeforeCoupon: 599,   // preço já listado no ML — cupom se aplica aqui
  couponCode: 'MANUVIP120',
  couponType: 'fixed',
  couponFixedValue: 120,
});
console.log(`Preço original:          R$ ${t3.originalPrice}`);
console.log(`Preço listado (ML):      R$ ${t3.priceAfterAdDiscount}`);
console.log(`Economia do cupom:       R$ ${t3.couponSavings}`);
console.log(`Preço final consumidor:  R$ ${t3.finalPrice}  (esperado: R$479)`);
console.log(`Desconto total real:     ${t3.totalDiscountPct}% OFF`);
console.log('\n📣 CTA gerado:');
console.log(t3.cta);
