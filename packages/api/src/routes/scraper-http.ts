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
    // Remove separador de milhar (ponto) antes de concatenar com centavos
    // Ex: "1.699" + "00" geraria "1.69900" = 1.699 errado; sem o ponto: "169900" / 100 = 1699 correto
    const cleanFinalPriceText = finalPriceText.replace(/\./g, '');
    const finalPriceStr = `${cleanFinalPriceText}${finalPriceCents.padStart(2, '0')}`;
    finalPrice = parseFloat(finalPriceStr) / 100;
  }

  // Preço original
  let originalPrice: number | null = null;
  const originalPriceText = $('.andes-money-amount--previous .andes-money-amount__fraction').first().text().trim();
  const originalPriceCents = $('.andes-money-amount--previous .andes-money-amount__cents').first().text().trim() || '00';
  
  if (originalPriceText) {
    // Remove separador de milhar (ponto) antes de concatenar com centavos
    const cleanOriginalPriceText = originalPriceText.replace(/\./g, '');
    const originalPriceStr = `${cleanOriginalPriceText}${originalPriceCents.padStart(2, '0')}`;
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

  // ── Título ────────────────────────────────────────────────────────────────
  const title =
    $('#productTitle').first().text().trim() ||
    $('h1#title span').first().text().trim() ||
    $('h1.a-size-large').first().text().trim() ||
    $('h1').first().text().trim() ||
    $('[data-feature-name="title"] span').first().text().trim() || '';

  // ── Preço final ───────────────────────────────────────────────────────────
  // Amazon tem vários formatos dependendo do produto/promoção
  const priceSelectors = [
    '.a-price[data-a-color="price"] .a-offscreen',
    '.a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#priceblock_saleprice',
    '.a-price-whole',
    '#price_inside_buybox',
    '#newBuyBoxPrice',
    '.apexPriceToPay .a-offscreen',
    '#corePrice_feature_div .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-offscreen',
    '.reinventPricePolicyMessage .a-offscreen',
  ];

  let finalPriceText = '';
  for (const sel of priceSelectors) {
    const val = $(sel).first().text().trim();
    if (val && val !== '0') { finalPriceText = val; break; }
  }

  // Limpar e converter: "R$ 1.299,90" → 1299.90
  let finalPrice = 0;
  if (finalPriceText) {
    const cleaned = finalPriceText
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');
    finalPrice = parseFloat(cleaned) || 0;
  }

  // Fallback: .a-price-whole + .a-price-fraction
  if (finalPrice === 0) {
    const whole    = $('.a-price-whole').first().text().replace(/\D/g, '');
    const fraction = $('.a-price-fraction').first().text().replace(/\D/g, '') || '00';
    if (whole) finalPrice = parseFloat(`${whole}.${fraction}`) || 0;
  }

  // ── Preço original (riscado) ──────────────────────────────────────────────
  const originalPriceSelectors = [
    '.a-price[data-a-strike="true"] .a-offscreen',
    '#priceblock_was_price',
    '.a-text-strike',
    '#listPrice',
    '[data-a-strike="true"] .a-offscreen',
    '.basisPrice .a-offscreen',
  ];

  let originalPrice: number | null = null;
  for (const sel of originalPriceSelectors) {
    const val = $(sel).first().text().trim();
    if (val) {
      const cleaned = val
        .replace(/R\$\s*/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.]/g, '');
      const parsed = parseFloat(cleaned);
      if (parsed > 0 && parsed > finalPrice) { originalPrice = parsed; break; }
    }
  }

  // ── Desconto ──────────────────────────────────────────────────────────────
  let discount = 0;
  if (originalPrice && originalPrice > finalPrice && finalPrice > 0) {
    discount = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
  } else {
    // Tenta extrair badge de desconto: "-20%"
    const badgeText = $('.a-badge-text, .savingPriceOverride, #saleprice_savings').first().text().trim();
    const pctMatch = badgeText.match(/(\d+)%/);
    if (pctMatch) discount = parseInt(pctMatch[1]);
  }

  // ── Imagem principal ──────────────────────────────────────────────────────
  const mainImage =
    $('#landingImage').first().attr('src') ||
    $('#imgBlkFront').first().attr('src') ||
    $('#main-image').first().attr('src') ||
    $('img#imgTagWrapperId img').first().attr('src') ||
    $('#imageBlock img').first().attr('src') ||
    $('.a-dynamic-image').first().attr('src') ||
    $('img[data-a-dynamic-image]').first().attr('src') || '';

  // ── Galeria ───────────────────────────────────────────────────────────────
  const images: string[] = [];
  $('img[data-a-dynamic-image], #altImages img, .imageThumbnail img').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src && src.startsWith('http') && !src.includes('sprite') && !images.includes(src)) {
      images.push(src);
    }
  });
  if (mainImage && !images.includes(mainImage)) images.unshift(mainImage);

  console.log('[Amazon HTTP] title:', title?.substring(0, 50), '| price:', finalPrice, '| orig:', originalPrice);

  return {
    title,
    finalPrice,
    originalPrice,
    discount,
    mainImage,
    images: images.slice(0, 10),
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
