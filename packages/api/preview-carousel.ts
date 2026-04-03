/**
 * Script de preview — gera os 4 slides do carrossel e imprime as URLs.
 * Uso: npx tsx preview-carousel.ts
 */
import 'dotenv/config';
import { configureCloudinary } from './src/services/cloudinary.js';
import { generateCarousel } from './src/services/instagramCarousel.js';

async function main() {
  configureCloudinary();
  const result = await generateCarousel({
    title: 'Tênis Masculino Renno Classic Fila',
    finalPrice: 214.90,
    originalPrice: 392.43,
    discountPct: 45,
    imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_2X_857983-MLB80058217990_102024-F.webp',
    affiliateUrl: 'https://www.mercadolivre.com.br/produto/fila-renno',
    theme: 'medium',
    offerId: 'preview-coupon',
    couponCode: 'FILA10',
    couponDiscountPct: 10,
  });

  if (!result.success) {
    console.error('❌ Falha ao gerar carrossel:', result.error);
    process.exit(1);
  }

  console.log('\n✅ Carrossel gerado com sucesso!\n');
  result.slideUrls!.forEach((url, i) => {
    console.log(`Slide ${i + 1}: ${url}`);
  });
}

main();
