import { FastifyInstance } from 'fastify';
import { chromium } from 'playwright';
import { authGuard } from '../lib/auth.js';
import { sendError, Errors } from '../lib/errors.js';

export async function scraperRoutes(app: FastifyInstance) {
  // POST /scraper/product - Extrair dados de uma URL de produto
  app.post('/product', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const { url } = request.body as { url: string };

      if (!url) {
        return sendError(reply, Errors.VALIDATION_ERROR([{ message: 'URL é obrigatória' }]));
      }

      console.log('[Scraper] Iniciando scraping de:', url);

      // Detectar loja pela URL
      const urlLower = url.toLowerCase();
      let store = 'unknown';
      if (urlLower.includes('mercadolivre') || urlLower.includes('mercadolibre')) {
        store = 'mercadolivre';
      } else if (urlLower.includes('magazineluiza') || urlLower.includes('magalu')) {
        store = 'magalu';
      } else if (urlLower.includes('amazon')) {
        store = 'amazon';
      } else if (urlLower.includes('gigantec')) {
        store = 'gigantec';
      } else if (urlLower.includes('awin')) {
        store = 'awin';
      } else if (urlLower.includes('shark') || urlLower.includes('ninja')) {
        store = 'shark';
      } else if (urlLower.includes('montecarlo')) {
        store = 'montecarlo';
      }

      console.log('[Scraper] Loja detectada:', store);

      // Iniciar navegador
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();

      let productData: any = {};

      try {
        // Navegar para a página
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Scraping específico por loja
        if (store === 'mercadolivre') {
          productData = await scrapeMercadoLivre(page);
        } else if (store === 'magalu') {
          productData = await scrapeMagalu(page);
        } else if (store === 'amazon') {
          productData = await scrapeAmazon(page);
        } else if (store === 'gigantec') {
          productData = await scrapeGigantec(page);
        } else if (store === 'awin') {
          productData = await scrapeAwin(page);
        } else if (store === 'shark') {
          productData = await scrapeShark(page);
        } else if (store === 'montecarlo') {
          productData = await scrapeMonteCarlo(page);
        } else {
          // Scraping genérico
          productData = await scrapeGeneric(page);
        }

        // Adicionar URL original
        productData.affiliateUrl = url;

        console.log('[Scraper] Dados extraídos:', {
          title: productData.title?.substring(0, 50),
          finalPrice: productData.finalPrice,
          originalPrice: productData.originalPrice,
          discount: productData.discount,
          hasImage: !!productData.mainImage,
        });

      } catch (error: any) {
        console.error('[Scraper] Erro ao extrair dados:', error.message);
        throw error;
      } finally {
        await browser.close();
      }

      return reply.send({
        success: true,
        data: productData,
        store,
      });

    } catch (error: any) {
      console.error('[Scraper] Erro:', error);
      return sendError(reply, error);
    }
  });
}

// ==================== SCRAPERS ESPECÍFICOS ====================

async function scrapeMercadoLivre(page: any) {
  console.log('[Scraper] Usando scraper do Mercado Livre...');

  // Título
  const title = await page.$eval('h1.ui-pdp-title', (el: any) => el.textContent?.trim())
    .catch(() => page.$eval('.ui-pdp-title', (el: any) => el.textContent?.trim()))
    .catch(() => '');

  // Preço final
  const finalPriceText = await page.$eval('.andes-money-amount__fraction', (el: any) => el.textContent)
    .catch(() => page.$eval('.price-tag-fraction', (el: any) => el.textContent))
    .catch(() => '0');

  const finalPriceCents = await page.$eval('.andes-money-amount__cents', (el: any) => el.textContent)
    .catch(() => '00');

  const finalPrice = parseFloat(`${finalPriceText}.${finalPriceCents}`.replace(/\./g, '').replace(',', '.')) || 0;

  // Preço original (se houver desconto)
  let originalPrice = finalPrice;
  let discount = 0;

  const originalPriceText = await page.$eval('.andes-money-amount--previous .andes-money-amount__fraction', (el: any) => el.textContent)
    .catch(() => null);

  if (originalPriceText) {
    const originalPriceCents = await page.$eval('.andes-money-amount--previous .andes-money-amount__cents', (el: any) => el.textContent)
      .catch(() => '00');
    originalPrice = parseFloat(`${originalPriceText}.${originalPriceCents}`.replace(/\./g, '').replace(',', '.')) || finalPrice;
    
    if (originalPrice > finalPrice) {
      discount = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
    }
  }

  // Imagem principal
  const mainImage = await page.$eval('figure.ui-pdp-gallery__figure img', (el: any) => el.src)
    .catch(() => page.$eval('.ui-pdp-image', (el: any) => el.src))
    .catch(() => '');

  // Tentar pegar mais imagens para galeria
  const images = await page.$$eval('figure img', (imgs: any[]) => 
    imgs.map(img => img.src).filter(src => src && src.startsWith('http'))
  ).catch(() => [mainImage]);

  return {
    title,
    finalPrice,
    originalPrice: originalPrice !== finalPrice ? originalPrice : null,
    discount,
    mainImage,
    images: images.slice(0, 10), // Máximo 10 imagens
  };
}

async function scrapeMagalu(page: any) {
  console.log('[Scraper] Usando scraper do Magazine Luiza...');

  const title = await page.$eval('[data-testid="heading-product-title"]', (el: any) => el.textContent?.trim())
    .catch(() => page.$eval('h1', (el: any) => el.textContent?.trim()))
    .catch(() => '');

  const finalPriceText = await page.$eval('[data-testid="price-value"]', (el: any) => el.textContent)
    .catch(() => '0');

  const finalPrice = parseFloat(finalPriceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

  const originalPriceText = await page.$eval('[data-testid="price-original"]', (el: any) => el.textContent)
    .catch(() => null);

  let originalPrice = finalPrice;
  let discount = 0;

  if (originalPriceText) {
    originalPrice = parseFloat(originalPriceText.replace(/[^\d,]/g, '').replace(',', '.')) || finalPrice;
    if (originalPrice > finalPrice) {
      discount = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
    }
  }

  const mainImage = await page.$eval('[data-testid="product-image"]', (el: any) => el.src)
    .catch(() => page.$eval('img[alt*="produto"]', (el: any) => el.src))
    .catch(() => '');

  return {
    title,
    finalPrice,
    originalPrice: originalPrice !== finalPrice ? originalPrice : null,
    discount,
    mainImage,
    images: [mainImage],
  };
}

async function scrapeAmazon(page: any) {
  console.log('[Scraper] Usando scraper da Amazon...');

  const title = await page.$eval('#productTitle', (el: any) => el.textContent?.trim())
    .catch(() => '');

  const finalPriceText = await page.$eval('.a-price .a-offscreen', (el: any) => el.textContent)
    .catch(() => '0');

  const finalPrice = parseFloat(finalPriceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

  const mainImage = await page.$eval('#landingImage', (el: any) => el.src)
    .catch(() => page.$eval('.a-dynamic-image', (el: any) => el.src))
    .catch(() => '');

  return {
    title,
    finalPrice,
    originalPrice: null,
    discount: 0,
    mainImage,
    images: [mainImage],
  };
}

async function scrapeAwin(page: any) {
  console.log('[Scraper] Usando scraper para Awin (redirecionamento)...');

  // Aguardar redirecionamento
  await page.waitForTimeout(3000);

  // Tentar detectar a loja final
  const currentUrl = page.url();
  console.log('[Scraper] URL final:', currentUrl);

  // Scraping genérico
  return scrapeGeneric(page);
}

async function scrapeShark(page: any) {
  console.log('[Scraper] Usando scraper do Shark Brasil Store...');

  // Título
  const title = await page.$eval('h1', (el: any) => el.textContent?.trim())
    .catch(() => page.$eval('[class*="product-title"]', (el: any) => el.textContent?.trim()))
    .catch(() => '');

  // Preço (o site Shark usa formato brasileiro)
  const priceText = await page.$$eval('[class*="price"]', (prices: any[]) => {
    // Pegar o primeiro preço visível (geralmente o preço final)
    for (const el of prices) {
      const text = el.textContent || '';
      if (text.includes('R$')) return text;
    }
    return '';
  }).catch(() => '0');

  const finalPrice = parseFloat(
    priceText
      .replace(/R\$/g, '')
      .replace(/\./g, '') // Remove separador de milhar
      .replace(',', '.') // Vírgula vira ponto decimal
      .trim()
  ) || 0;

  // Tentar pegar preço original (se houver)
  const originalPriceText = await page.$eval('[class*="original-price"], [class*="old-price"]', (el: any) => el.textContent)
    .catch(() => null);

  let originalPrice = finalPrice;
  let discount = 0;

  if (originalPriceText) {
    originalPrice = parseFloat(
      originalPriceText
        .replace(/R\$/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim()
    ) || finalPrice;

    if (originalPrice > finalPrice) {
      discount = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
    }
  }

  // Imagem principal
  const mainImage = await page.$eval('[class*="product-image"] img', (el: any) => el.src)
    .catch(() => page.$eval('img[alt*="Aspirador"], img[alt*="Shark"]', (el: any) => el.src))
    .catch(() => page.$$eval('img', (imgs: any[]) => {
      const productImg = imgs.find((img: any) => img.width > 300);
      return productImg?.src || '';
    }))
    .catch(() => '');

  // Tentar pegar galeria de imagens
  const images = await page.$$eval('[class*="product-image"] img, [class*="gallery"] img', (imgs: any[]) =>
    imgs.map((img: any) => img.src).filter((src: string) => src && src.startsWith('http'))
  ).catch(() => [mainImage]);

  return {
    title,
    finalPrice,
    originalPrice: originalPrice !== finalPrice ? originalPrice : null,
    discount,
    mainImage,
    images: images.slice(0, 10),
  };
}

async function scrapeGigantec(page: any) {
  console.log('[Scraper] Usando scraper do Gigantec...');

  // Título
  const title = await page.$eval('h1.page-title span', (el: any) => el.textContent?.trim())
    .catch(() => page.$eval('h1', (el: any) => el.textContent?.trim()))
    .catch(() => '');

  // Preço (formato brasileiro: R$ 1.439,90)
  const finalPriceText = await page.$$eval('[class*="price"], [data-price-type="finalPrice"]', (prices: any[]) => {
    for (const el of prices) {
      const text = el.textContent || '';
      if (text.includes('R$') && !text.toLowerCase().includes('parcelado')) {
        return text;
      }
    }
    return '';
  }).catch(() => '0');

  const finalPrice = parseFloat(
    finalPriceText
      .replace(/R\$/g, '')
      .replace(/\./g, '') // Remove separador de milhar
      .replace(',', '.') // Vírgula vira ponto decimal
      .trim()
  ) || 0;

  // Tentar pegar preço original (se houver desconto)
  const originalPriceText = await page.$eval('[class*="old-price"], [data-price-type="oldPrice"]', (el: any) => el.textContent)
    .catch(() => null);

  let originalPrice = finalPrice;
  let discount = 0;

  if (originalPriceText) {
    originalPrice = parseFloat(
      originalPriceText
        .replace(/R\$/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim()
    ) || finalPrice;

    if (originalPrice > finalPrice) {
      discount = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
    }
  }

  // Imagem principal - usar data-zoom-image ou src completo
  const mainImage = await page.$eval('.gallery-placeholder img, .product-image-photo', (el: any) => {
    // Priorizar data-zoom-image (imagem grande)
    return el.getAttribute('data-zoom-image') || el.getAttribute('src') || el.src;
  })
    .catch(() => page.$$eval('img', (imgs: any[]) => {
      // Procurar imagem do produto (maior que 300px)
      const productImg = imgs.find((img: any) => img.width > 300 && img.height > 300);
      return productImg?.getAttribute('data-zoom-image') || productImg?.getAttribute('src') || productImg?.src || '';
    }))
    .catch(() => '');

  // Tentar pegar galeria de imagens
  const images = await page.$$eval('.product-image-photo, [class*="gallery"] img', (imgs: any[]) =>
    imgs
      .map((img: any) => img.getAttribute('data-zoom-image') || img.getAttribute('src') || img.src)
      .filter((src: string) => src && src.startsWith('http'))
  ).catch(() => [mainImage]);

  return {
    title,
    finalPrice,
    originalPrice: originalPrice !== finalPrice ? originalPrice : null,
    discount,
    mainImage,
    images: images.slice(0, 10),
  };
}

async function scrapeMonteCarlo(page: any) {
  console.log('[Scraper] Usando scraper do Monte Carlo Joias...');

  // Título
  const title = await page.$eval('.product-name, h1', (el: any) => el.textContent?.trim())
    .catch(() => page.$eval('h1', (el: any) => el.textContent?.trim()))
    .catch(() => '');

  // Preço (formato brasileiro: R$ 1.439,90)
  const finalPriceText = await page.$$eval('[class*="price"]', (prices: any[]) => {
    for (const el of prices) {
      const text = el.textContent || '';
      if (text.includes('R$') && !text.toLowerCase().includes('parcelado')) {
        return text;
      }
    }
    return '';
  }).catch(() => '0');

  const finalPrice = parseFloat(
    finalPriceText
      .replace(/R\$/g, '')
      .replace(/\./g, '') // Remove separador de milhar
      .replace(',', '.') // Vírgula vira ponto decimal
      .trim()
  ) || 0;

  // Tentar pegar preço original (se houver desconto)
  const originalPriceText = await page.$eval('[class*="old-price"], [class*="price-old"]', (el: any) => el.textContent)
    .catch(() => null);

  let originalPrice = finalPrice;
  let discount = 0;

  if (originalPriceText) {
    originalPrice = parseFloat(
      originalPriceText
        .replace(/R\$/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim()
    ) || finalPrice;

    if (originalPrice > finalPrice) {
      discount = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
    }
  }

  // Imagem principal
  const mainImage = await page.$eval('.product-image-photo, .product-img img', (el: any) => {
    return el.getAttribute('src') || el.getAttribute('data-src') || el.src;
  })
    .catch(() => page.$$eval('img', (imgs: any[]) => {
      const productImg = imgs.find((img: any) => img.width > 300 && img.height > 300);
      return productImg?.getAttribute('src') || productImg?.getAttribute('data-src') || productImg?.src || '';
    }))
    .catch(() => '');

  return {
    title,
    finalPrice,
    originalPrice: originalPrice !== finalPrice ? originalPrice : null,
    discount,
    mainImage,
    images: [mainImage],
  };
}

async function scrapeGeneric(page: any) {
  console.log('[Scraper] Usando scraper genérico...');

  // Tentar selectors comuns para título
  const title = await page.$eval('h1', (el: any) => el.textContent?.trim())
    .catch(() => page.$eval('[class*="title"]', (el: any) => el.textContent?.trim()))
    .catch(() => page.$eval('[class*="produto"]', (el: any) => el.textContent?.trim()))
    .catch(() => '');

  // Tentar selectors comuns para preço
  const priceText = await page.$eval('[class*="price"]', (el: any) => el.textContent)
    .catch(() => page.$eval('[class*="valor"]', (el: any) => el.textContent))
    .catch(() => '0');

  const finalPrice = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

  // Tentar pegar imagem (usando getAttribute para evitar truncamento)
  const mainImage = await page.$eval('img[alt*="produto"], img[alt*="product"]', (el: any) => {
    return el.getAttribute('src') || el.getAttribute('data-src') || el.src;
  })
    .catch(() => page.$$eval('img', (imgs: any[]) => {
      const productImg = imgs.find((img: any) => img.width > 200 && img.height > 200);
      if (productImg) {
        return productImg.getAttribute('src') || productImg.getAttribute('data-src') || productImg.src;
      }
      return imgs[0]?.getAttribute('src') || imgs[0]?.src || '';
    }))
    .catch(() => '');

  return {
    title,
    finalPrice,
    originalPrice: null,
    discount: 0,
    mainImage,
    images: [mainImage],
  };
}
