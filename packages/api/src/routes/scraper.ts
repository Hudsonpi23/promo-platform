import { FastifyInstance } from 'fastify';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { authGuard } from '../lib/auth.js';
import { sendError, Errors } from '../lib/errors.js';
import { scrapeMercadoLivreHTTP, scrapeMagaluHTTP, scrapeAmazonHTTP, scrapeGenericHTTP } from './scraper-http.js';

export async function scraperRoutes(app: FastifyInstance) {
  // POST /scraper/product - Extrair dados de uma URL de produto
  app.post('/product', { preHandler: [authGuard] }, async (request, reply) => {
    let browser: any = null;
    
    try {
      const { url } = request.body as { url: string };

      if (!url) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'URL é obrigatória',
          },
        });
      }

      // Validar se é uma URL válida
      try {
        new URL(url);
      } catch {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_URL',
            message: 'URL inválida. Por favor, forneça uma URL completa (ex: https://...)',
          },
        });
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

      // Detectar se é URL social/compartilhamento do ML
      const isMlSocialUrl = store === 'mercadolivre' && (
        urlLower.includes('/social/') ||
        urlLower.includes('/s/') ||
        urlLower.includes('mlgo.to')
      );
      let resolvedUrl = url;

      let productData: any = {};

      // Tentar usar Playwright primeiro, se falhar usar Cheerio (HTTP)
      let usePlaywright = true;
      
      try {
        // Iniciar navegador
        browser = await chromium.launch({ 
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
          ], // Argumentos necessários para ambientes como Render
        });

        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();

        console.log('[Scraper] Usando Playwright...');

        // Para URLs sociais do ML: buscar HTML via axios, extrair link do produto com Cheerio
        if (isMlSocialUrl) {
          console.log('[Scraper ML Social] Buscando página social via HTTP...');

          // Remover forceInApp=true que causa redirecionamento para o app
          const cleanSocialUrl = url.replace(/[?&]forceInApp=true/g, '').replace(/&&/g, '&');

          let productLink: string | null = null;

          try {
            const socialRes = await axios.get(cleanSocialUrl, {
              timeout: 15000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9',
              },
            });

            const $social = cheerio.load(socialRes.data);

            // Tentar encontrar links de produto ML (padrão /p/MLB ou /MLB)
            const EXCLUDED = ['/social/', '/perfil/', '/categorias', '/ofertas', '/cupons', '/assinaturas', 'mercadolivre.com.br/#'];
            $social('a[href]').each((_: any, el: any) => {
              if (productLink) return;
              const href: string = $social(el).attr('href') || '';
              const fullHref = href.startsWith('http') ? href : `https://www.mercadolivre.com.br${href}`;
              const isExcluded = EXCLUDED.some(e => fullHref.includes(e));
              if (
                fullHref.includes('mercadolivre.com.br') &&
                !isExcluded &&
                fullHref.length > 50
              ) {
                productLink = fullHref;
              }
            });

            console.log('[Scraper ML Social] Link encontrado via HTTP:', productLink?.substring(0, 100) ?? 'nenhum');
          } catch (httpErr: any) {
            console.warn('[Scraper ML Social] Falha HTTP, tentando Playwright...', httpErr.message);
          }

          // Fallback: Playwright para abrir a página social
          if (!productLink) {
            console.log('[Scraper ML Social] Tentando via Playwright...');
            await page.goto(cleanSocialUrl, { waitUntil: 'load', timeout: 40000 });
            await page.waitForTimeout(5000);

            const allLinks: string[] = await page.$$eval('a[href]', (els: any[]) =>
              els.map((el: any) => el.href).filter((h: string) => h && h.startsWith('http'))
            ).catch(() => []);

            const EXCLUDED_PW = ['/social/', '/perfil/', '/categorias', '/ofertas', '/cupons', '/assinaturas'];
            productLink = allLinks.find((href: string) =>
              href.includes('mercadolivre.com.br') &&
              !EXCLUDED_PW.some(e => href.includes(e)) &&
              href.length > 50
            ) || null;

            console.log('[Scraper ML Social] Links encontrados via Playwright:', allLinks.length, '| produto:', productLink?.substring(0, 80) ?? 'nenhum');
          }

          if (!productLink) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'SOCIAL_LINK_NOT_FOUND',
                message: 'Não foi possível encontrar o link do produto nesta página. Use a URL direta do produto.',
              },
            });
          }

          resolvedUrl = productLink;
          await page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000);

        } else {
          await page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000);
        }

        // Verificar se a página carregou corretamente
        const pageTitle = await page.title().catch(() => '');
        console.log('[Scraper] Título da página:', pageTitle.substring(0, 100));

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

        // Fechar navegador
        if (browser) {
          await browser.close();
          browser = null;
        }

      } catch (playwrightError: any) {
        console.warn('[Scraper] Playwright falhou, tentando com Cheerio (HTTP):', playwrightError.message);
        usePlaywright = false;
        
        // Fechar navegador se ainda estiver aberto
        if (browser) {
          try {
            await browser.close();
          } catch (e) {
            // Ignorar erro ao fechar
          }
          browser = null;
        }

        // Fallback: usar Cheerio (HTTP scraping)
        try {
          console.log('[Scraper] Usando Cheerio (HTTP scraping)...');
          const isAmazon = store === 'amazon';
          const response = await axios.get(resolvedUrl, {
            headers: {
              'User-Agent': isAmazon
                ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
              'Accept-Encoding': 'gzip, deflate, br',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
              ...(isAmazon && {
                'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'upgrade-insecure-requests': '1',
              }),
            },
            timeout: 30000,
          });

          const $ = cheerio.load(response.data);

          // Scraping específico por loja usando Cheerio
          if (store === 'mercadolivre') {
            productData = await scrapeMercadoLivreHTTP($);
          } else if (store === 'magalu') {
            productData = await scrapeMagaluHTTP($);
          } else if (store === 'amazon') {
            productData = await scrapeAmazonHTTP($);
          } else {
            // Scraping genérico
            productData = await scrapeGenericHTTP($);
          }
        } catch (httpError: any) {
          console.error('[Scraper] Erro no scraping HTTP:', httpError.message);
          throw new Error(`Falha no scraping: ${httpError.message}`);
        }
      }

      try {

        // Validar se conseguiu extrair dados mínimos
        if (!productData.title || productData.title.trim().length === 0) {
          throw new Error('Não foi possível extrair o título do produto. A página pode não ser uma página de produto válida.');
        }

        if (!productData.finalPrice || productData.finalPrice <= 0) {
          throw new Error('Não foi possível extrair o preço do produto.');
        }

        // URL afiliada: para URLs sociais usar resolvedUrl (link do produto com matt_word/matt_tool)
        // Para URLs diretas usar a URL original
        productData.affiliateUrl = productData.affiliateUrl || resolvedUrl || url;

        // Converter link Amazon em link de afiliado automaticamente
        if (store === 'amazon' && productData.affiliateUrl) {
          try {
            const amazonUrl = new URL(productData.affiliateUrl);
            const cleanUrl = new URL(`https://www.amazon.com.br${amazonUrl.pathname}`);
            cleanUrl.searchParams.set('tag', 'manudaspromoc-20');
            productData.affiliateUrl = cleanUrl.toString();
          } catch {
            const base = productData.affiliateUrl;
            productData.affiliateUrl = base.includes('?')
              ? `${base}&tag=manudaspromoc-20`
              : `${base}?tag=manudaspromoc-20`;
          }
        }

        console.log('[Scraper] Dados extraídos:', {
          title: productData.title?.substring(0, 50),
          finalPrice: productData.finalPrice,
          originalPrice: productData.originalPrice,
          discount: productData.discount,
          hasImage: !!productData.mainImage,
        });

      } catch (scrapingError: any) {
        console.error('[Scraper] Erro ao extrair dados:', scrapingError.message);
        console.error('[Scraper] Stack:', scrapingError.stack);
        
        return reply.status(400).send({
          success: false,
          error: {
            code: 'SCRAPING_ERROR',
            message: 'Erro ao extrair dados do produto',
            details: scrapingError.message,
            suggestion: 'Verifique se a URL é uma página de produto válida e tente novamente.',
          },
        });
      } finally {
        if (browser) {
          try {
            await browser.close();
          } catch (closeError) {
            console.error('[Scraper] Erro ao fechar navegador:', closeError);
          }
        }
      }

      return reply.send({
        success: true,
        data: productData,
        store,
      });

    } catch (error: any) {
      console.error('[Scraper] Erro geral:', error);
      console.error('[Scraper] Stack:', error.stack);
      
      // Garantir que o navegador seja fechado mesmo em caso de erro
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('[Scraper] Erro ao fechar navegador:', closeError);
        }
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao processar scraping',
          details: error.message,
        },
      });
    }
  });
}

// ==================== SCRAPERS ESPECÍFICOS ====================

/**
 * Scraper para páginas sociais/compartilhamento do ML
 * Ex: mercadolivre.com.br/social/dh20260120130733?matt_word=...
 * A URL social JÁ contém os cookies de rastreamento do afiliado.
 */
async function scrapeMercadoLivreSocial(page: any, originalSocialUrl: string) {
  console.log('[Scraper] Usando scraper de página social do Mercado Livre...');

  // Aguardar o card do produto carregar
  await page.waitForTimeout(2000);

  // Título — tentar vários seletores usados nas páginas sociais do ML
  const title = await page.$eval('h1', (el: any) => el.textContent?.trim())
    .catch(() => page.$eval('[class*="title"]', (el: any) => el.textContent?.trim()))
    .catch(() => page.$eval('[class*="product-title"]', (el: any) => el.textContent?.trim()))
    .catch(() => page.title().then((t: string) => t.replace('| Mercado Livre', '').trim()))
    .catch(() => '');

  // Preços — coletar todos os valores monetários e classificar
  let finalPrice = 0;
  let originalPrice: number | null = null;

  try {
    // Preço riscado (original)
    const origFraction = await page.$eval(
      '.andes-money-amount--previous .andes-money-amount__fraction',
      (el: any) => el.textContent?.replace(/\D/g, '') || ''
    ).catch(() => '');
    const origCents = await page.$eval(
      '.andes-money-amount--previous .andes-money-amount__cents',
      (el: any) => el.textContent?.replace(/\D/g, '').padStart(2, '0') || '00'
    ).catch(() => '00');

    if (origFraction) {
      originalPrice = parseFloat(`${origFraction}.${origCents}`);
    }

    // Preço final (não riscado)
    const finalFraction = await page.$eval(
      '.andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__fraction',
      (el: any) => el.textContent?.replace(/\D/g, '') || ''
    ).catch(() => '');
    const finalCents = await page.$eval(
      '.andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__cents',
      (el: any) => el.textContent?.replace(/\D/g, '').padStart(2, '0') || '00'
    ).catch(() => '00');

    if (finalFraction) {
      finalPrice = parseFloat(`${finalFraction}.${finalCents}`);
    }
  } catch (e) {
    console.warn('[Scraper ML Social] Erro ao extrair preços:', e);
  }

  // Desconto
  let discount = 0;
  if (originalPrice && originalPrice > finalPrice && finalPrice > 0) {
    discount = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
  }

  // Imagem principal
  const mainImage = await page.$eval('img[src*="mlstatic"]', (el: any) => el.src)
    .catch(() => page.$eval('figure img', (el: any) => el.src))
    .catch(() => page.$eval('img[src^="https"]', (el: any) => el.src))
    .catch(() => '');

  // Imagens adicionais
  const images = await page.$$eval('img[src]', (imgs: any[]) =>
    imgs.map((el: any) => el.src as string)
      .filter((src: string) => src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon') && src.length > 30)
  ).catch(() => [mainImage]);

  // Link do botão "Ir para o produto" — URL do produto com parâmetros de rastreamento
  const productLink = await page.$eval(
    'a[href*="mercadolivre"]:not([href*="/social/"])',
    (el: any) => el.href
  ).catch(() => null);

  console.log('[Scraper ML Social] Dados extraídos:', { title: title?.substring(0,50), finalPrice, originalPrice, discount });

  return {
    title,
    finalPrice,
    originalPrice: (originalPrice && originalPrice !== finalPrice) ? originalPrice : null,
    discount,
    mainImage,
    images: (images as string[]).slice(0, 10),
    // URL afiliada: preferir o link direto do produto (tem parâmetros matt_*), senão usar social
    affiliateUrl: productLink || originalSocialUrl,
  };
}

async function scrapeMercadoLivre(page: any) {
  console.log('[Scraper] Usando scraper do Mercado Livre...');

  // Título
  const title = await page.$eval('h1.ui-pdp-title', (el: any) => el.textContent?.trim())
    .catch(() => page.$eval('.ui-pdp-title', (el: any) => el.textContent?.trim()))
    .catch(() => '');

  // Preço original (riscado, se houver desconto) - pegar primeiro
  let originalPrice: number | null = null;
  try {
    const originalPriceText = await page.$eval('.andes-money-amount--previous .andes-money-amount__fraction', (el: any) => el.textContent);
    const originalPriceCents = await page.$eval('.andes-money-amount--previous .andes-money-amount__cents', (el: any) => el.textContent).catch(() => '00');
    if (originalPriceText) {
      // Corrigir parsing: juntar parte inteira e centavos corretamente
      // Ex: "54" + "90" = "5490" centavos = 54.90 reais
      const originalPriceStr = `${originalPriceText}${originalPriceCents.padStart(2, '0')}`;
      originalPrice = parseFloat(originalPriceStr) / 100; // Converter centavos para reais
    }
  } catch (e) {
    // Não tem preço original (sem desconto)
  }

  // Preço final (preço atual, não riscado) - pegar do container principal
  // Usar seletor que exclui o preço riscado
  let finalPrice = 0;
  try {
    // Tentar pegar do container de preço principal (sem a classe --previous)
    const finalPriceText = await page.$eval('.ui-pdp-price__second-line .andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__fraction', 
      (el: any) => el.textContent)
      .catch(() => page.$eval('.ui-pdp-price .andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__fraction', 
        (el: any) => el.textContent))
      .catch(() => page.$eval('.andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__fraction', 
        (el: any) => el.textContent))
      .catch(() => page.$eval('.andes-money-amount__fraction', (el: any) => el.textContent))
      .catch(() => '0');

    const finalPriceCents = await page.$eval('.ui-pdp-price__second-line .andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__cents', 
      (el: any) => el.textContent)
      .catch(() => page.$eval('.ui-pdp-price .andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__cents', 
        (el: any) => el.textContent))
      .catch(() => page.$eval('.andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__cents', 
        (el: any) => el.textContent))
      .catch(() => page.$eval('.andes-money-amount__cents', (el: any) => el.textContent))
      .catch(() => '00');

    // Corrigir parsing: juntar parte inteira e centavos corretamente
    // Ex: "36" + "90" = "3690" centavos = 36.90 reais
    const finalPriceStr = `${finalPriceText}${finalPriceCents.padStart(2, '0')}`;
    finalPrice = parseFloat(finalPriceStr) / 100; // Converter centavos para reais
  } catch (e) {
    console.error('[Scraper ML] Erro ao pegar preço final:', e);
  }

  // Calcular desconto
  let discount = 0;
  if (originalPrice && originalPrice > finalPrice) {
    discount = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
  }

  console.log('[Scraper ML] Preços extraídos:', { originalPrice, finalPrice, discount });

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
  const urlLower = currentUrl.toLowerCase();
  console.log('[Scraper] URL final:', currentUrl);

  // IMPORTANTE: manter comportamento do Mercado Livre como está
  if (urlLower.includes('mercadolivre') || urlLower.includes('mercadolibre')) {
    console.log('[Scraper Awin] Detectado Mercado Livre após redirecionamento');
    return scrapeMercadoLivre(page);
  }

  // Suporte específico para Gigantec BR via Awin
  if (urlLower.includes('gigantec.com.br')) {
    console.log('[Scraper Awin] Detectado Gigantec após redirecionamento');
    return scrapeGigantec(page);
  }

  // Outras lojas (Magalu, Amazon, etc.) podem ser tratadas aqui no futuro
  // Por enquanto, usar scraper genérico
  console.log('[Scraper Awin] Loja não reconhecida, usando scraper genérico');
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
    // Para evitar confusão e garantir consistência nas publicações (especialmente no Telegram),
    // salvamos apenas a IMAGEM PRINCIPAL como galeria. Outras imagens da página da Gigantec
    // não são necessárias neste fluxo.
    images: [mainImage],
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
