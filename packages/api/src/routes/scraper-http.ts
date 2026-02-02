// Funções HTTP de fallback para quando Playwright não funciona
import * as cheerio from 'cheerio';

export async function scrapeMercadoLivreHTTP($: cheerio.CheerioAPI) {
  console.log('[Scraper HTTP] Usando scraper HTTP do Mercado Livre...');

  // Título
  const title = $('h1.ui-pdp-title').first().text().trim() || 
                $('.ui-pdp-title').first().text().trim() || '';

  // Preço final
  let finalPrice = 0;
  const finalPriceText = $('.ui-pdp-price__second-line .andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__fraction').first().text().trim() ||
                         $('.andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__fraction').first().text().trim() || '0';
  const finalPriceCents = $('.ui-pdp-price__second-line .andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__cents').first().text().trim() ||
                          $('.andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__cents').first().text().trim() || '00';
  
  if (finalPriceText) {
    const finalPriceStr = `${finalPriceText}${finalPriceCents.padStart(2, '0')}`;
    finalPrice = parseFloat(finalPriceStr) / 100;
  }

  // Preço original
  let originalPrice: number | null = null;
  const originalPriceText = $('.andes-money-amount--previous .andes-money-amount__fraction').first().text().trim();
  const originalPriceCents = $('.andes-money-amount--previous .andes-money-amount__cents').first().text().trim() || '00';
  
  if (originalPriceText) {
    const originalPriceStr = `${originalPriceText}${originalPriceCents.padStart(2, '0')}`;
    originalPrice = parseFloat(originalPriceStr) / 100;
  }

  // Calcular desconto
  let discount = 0;
  if (originalPrice && originalPrice > finalPrice) {
    discount = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
  }

  // Imagem principal
  const mainImage = $('figure.ui-pdp-gallery__figure img').first().attr('src') ||
                    $('.ui-pdp-image').first().attr('src') ||
                    $('img[data-zoom]').first().attr('src') || '';

  // Galeria de imagens
  const images: string[] = [];
  $('figure img, .ui-pdp-gallery img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src && src.startsWith('http') && !images.includes(src)) {
      images.push(src);
    }
  });

  return {
    title,
    finalPrice,
    originalPrice: originalPrice !== finalPrice ? originalPrice : null,
    discount,
    mainImage,
    images: images.slice(0, 10),
  };
}

export async function scrapeMagaluHTTP($: cheerio.CheerioAPI) {
  console.log('[Scraper HTTP] Usando scraper HTTP do Magazine Luiza...');

  const title = $('[data-testid="heading-product-title"]').first().text().trim() ||
               $('h1').first().text().trim() || '';

  const finalPriceText = $('[data-testid="price-value"]').first().text().trim() || '0';
  const finalPrice = parseFloat(finalPriceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

  const originalPriceText = $('[data-testid="price-original"]').first().text().trim();
  let originalPrice = finalPrice;
  let discount = 0;

  if (originalPriceText) {
    originalPrice = parseFloat(originalPriceText.replace(/[^\d,]/g, '').replace(',', '.')) || finalPrice;
    if (originalPrice > finalPrice) {
      discount = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
    }
  }

  const mainImage = $('[data-testid="product-image"]').first().attr('src') ||
                    $('img[alt*="produto"]').first().attr('src') || '';

  return {
    title,
    finalPrice,
    originalPrice: originalPrice !== finalPrice ? originalPrice : null,
    discount,
    mainImage,
    images: [mainImage],
  };
}

export async function scrapeAmazonHTTP($: cheerio.CheerioAPI) {
  console.log('[Scraper HTTP] Usando scraper HTTP da Amazon...');

  const title = $('#productTitle').first().text().trim() || '';

  const finalPriceText = $('.a-price .a-offscreen').first().text().trim() || '0';
  const finalPrice = parseFloat(finalPriceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

  const mainImage = $('#landingImage').first().attr('src') ||
                    $('.a-dynamic-image').first().attr('src') || '';

  return {
    title,
    finalPrice,
    originalPrice: null,
    discount: 0,
    mainImage,
    images: [mainImage],
  };
}

export async function scrapeGenericHTTP($: cheerio.CheerioAPI) {
  console.log('[Scraper HTTP] Usando scraper HTTP genérico...');

  const title = $('h1').first().text().trim() ||
                $('[class*="title"]').first().text().trim() ||
                $('[class*="produto"]').first().text().trim() || '';

  const priceText = $('[class*="price"]').first().text().trim() ||
                    $('[class*="valor"]').first().text().trim() || '0';
  const finalPrice = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

  const mainImage = $('img[alt*="produto"], img[alt*="product"]').first().attr('src') ||
                    $('img[alt*="produto"], img[alt*="product"]').first().attr('data-src') ||
                    $('img').first().attr('src') || '';

  return {
    title,
    finalPrice,
    originalPrice: null,
    discount: 0,
    mainImage,
    images: [mainImage],
  };
}
