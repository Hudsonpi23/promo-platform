// Funções HTTP de fallback para quando Playwright não funciona
import * as cheerio from 'cheerio';

/** Converte fração + centavos do ML em número float.
 *  Remove o ponto separador de milhar antes de montar a string.
 *  Ex: fraction="2.969", cents="10" → "296910" / 100 = 2969.10
 */
function parseMlFraction(fraction: string, cents: string): number {
  if (!fraction) return 0;
  const cleanFraction = fraction.replace(/\./g, '');
  const cleanCents = (cents || '00').replace(/\D/g, '').padStart(2, '0').slice(0, 2);
  return parseFloat(`${cleanFraction}${cleanCents}`) / 100;
}

export async function scrapeMercadoLivreHTTP($: cheerio.CheerioAPI) {
  console.log('[Scraper HTTP] Usando scraper HTTP do Mercado Livre...');

  // Título
  const title = $('h1.ui-pdp-title').first().text().trim() || 
                $('.ui-pdp-title').first().text().trim() || '';

  let finalPrice = 0;
  let originalPrice: number | null = null;

  // ── Preço original (riscado / tachado) ───────────────────────────────────
  // Sempre buscar o tachado ANTES para ter referência ao filtrar o preço final
  // O ML usa andes-money-amount--previous para o preço original riscado
  const prevEl = $('.andes-money-amount--previous').first();
  if (prevEl.length) {
    const fraction = prevEl.find('.andes-money-amount__fraction').first().text().trim();
    const cents    = prevEl.find('.andes-money-amount__cents').first().text().trim() || '00';
    const val = parseMlFraction(fraction, cents);
    if (val > 0) originalPrice = val;
  }

  // ── Preço final (com desconto — Pix ou promoção) ─────────────────────────
  // NUNCA usar JSON-LD do ML: nas páginas /p/ ele traz preço agregado de
  // múltiplos vendedores (ex: lowPrice:3339) e não o preço com desconto Pix.
  //
  // Estratégia: percorrer os containers de preço em ordem de especificidade,
  // pegando o primeiro valor que seja:
  //   a) maior que zero
  //   b) diferente do preço original (não é o riscado)
  //   c) plausível como preço final (≥ 50% do original, para descartar parcelas)
  const priceContainerSelectors = [
    // Container específico do preço principal (mais confiável)
    '.ui-pdp-price__main-price',
    '.ui-pdp-price__second-line',
    '.ui-pdp-price',
  ];

  for (const containerSel of priceContainerSelectors) {
    if (finalPrice > 0) break;
    const container = $(containerSel).first();
    if (!container.length) continue;

    // Dentro do container, pegar todos os blocos de preço que NÃO sejam riscados
    container.find('.andes-money-amount:not(.andes-money-amount--previous)').each((_: number, el: any) => {
      if (finalPrice > 0) return false; // já achou, parar
      const fraction = $(el).find('.andes-money-amount__fraction').first().text().trim();
      const cents    = $(el).find('.andes-money-amount__cents').first().text().trim() || '00';
      const val = parseMlFraction(fraction, cents);
      // Ignorar zero, igual ao original, e parcelas (< 50% do original)
      const isValidFinal = val > 0
        && val !== originalPrice
        && (!originalPrice || val >= originalPrice * 0.5);
      if (isValidFinal) finalPrice = val;
    });
  }

  // ── Fallback: qualquer .andes-money-amount não riscado da página ──────────
  if (finalPrice === 0) {
    $('.andes-money-amount:not(.andes-money-amount--previous)').each((_: number, el: any) => {
      if (finalPrice > 0) return false;
      const fraction = $(el).find('.andes-money-amount__fraction').first().text().trim();
      const cents    = $(el).find('.andes-money-amount__cents').first().text().trim() || '00';
      const val = parseMlFraction(fraction, cents);
      const isValidFinal = val > 0
        && val !== originalPrice
        && (!originalPrice || val >= originalPrice * 0.5);
      if (isValidFinal) finalPrice = val;
    });
  }

  // ── Calcular desconto ─────────────────────────────────────────────────────
  let discount = 0;
  if (originalPrice && originalPrice > finalPrice && finalPrice > 0) {
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
