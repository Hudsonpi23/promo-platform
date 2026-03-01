// Funções HTTP de fallback para quando Playwright não funciona
import * as cheerio from 'cheerio';
import axios from 'axios';

// ── ML API pública ────────────────────────────────────────────────────────────
// api.mercadolibre.com retorna price/original_price já calculados corretamente,
// incluindo o preço Pix. Muito mais confiável do que parsear o HTML.

/**
 * Extrai o ID do item ML ou produto de uma URL.
 * Suporta todos os formatos do ML:
 *   - produto.mercadolivre.com.br/MLB-4087123643-...  → item MLB4087123643
 *   - mercadolivre.com.br/.../MLB3234567890           → item MLB3234567890
 *   - mercadolivre.com.br/.../p/MLB47885              → product MLB47885
 */
function extractMlId(url: string): { type: 'item' | 'product'; id: string } | null {
  // Produto: /p/MLB47885 (5-8 dígitos)
  const productMatch = url.match(/\/p\/(MLB\d+)/i);
  if (productMatch) return { type: 'product', id: productMatch[1].toUpperCase() };

  // Item com traço: /MLB-4087123643- (formato produto.mercadolivre.com.br)
  const itemDashMatch = url.match(/\/MLB-(\d{7,})/i);
  if (itemDashMatch) return { type: 'item', id: `MLB${itemDashMatch[1]}` };

  // Item sem traço: /MLB3234567890 (9+ dígitos)
  const itemMatch = url.match(/\/(MLB\d{9,})/i);
  if (itemMatch) return { type: 'item', id: itemMatch[1].toUpperCase() };

  return null;
}

/**
 * Busca preços diretamente na API pública do Mercado Livre.
 * Tenta item API → product search → retorna null se falhar.
 */
async function fetchMlPricesFromAPI(url: string, htmlItemId?: string): Promise<{
  finalPrice: number;
  originalPrice: number | null;
  title: string;
  mainImage: string;
} | null> {
  const mlId = extractMlId(url);
  const headers = { 'User-Agent': 'Mozilla/5.0' };

  // Tentar item direto (URL de item ou ID extraído do HTML)
  const itemId = (mlId?.type === 'item' ? mlId.id : null) || htmlItemId;
  if (itemId) {
    try {
      const resp = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, { headers, timeout: 8000 });
      const d = resp.data;
      if (d.price > 0) {
        console.log(`[ML API] Item ${itemId}: price=${d.price} original_price=${d.original_price}`);
        return {
          finalPrice: d.price,
          originalPrice: d.original_price || null,
          title: d.title || '',
          mainImage: (d.thumbnail || '').replace('-I.jpg', '-O.jpg').replace('-I.webp', '-O.webp'),
        };
      }
    } catch (e: any) {
      console.warn('[ML API] Falha na items API:', e.message);
    }
  }

  // Produto: buscar via múltiplas estratégias (catálogo ML)
  if (mlId?.type === 'product') {
    const catalogId = mlId.id; // ex: MLB44603836

    // ── Estratégia A: Search API por catalog_product_id ───────────────────
    // Busca exatamente os itens deste produto de catálogo — mais preciso que slug.
    try {
      const searchResp = await axios.get(
        `https://api.mercadolibre.com/sites/MLB/search?catalog_product_id=${catalogId}&limit=10`,
        { headers, timeout: 10000 }
      );
      const results: any[] = searchResp.data?.results || [];
      const valid = results.filter((r: any) => r.price > 0);
      if (valid.length > 0) {
        const withDiscount = valid.filter((r: any) => r.original_price && r.original_price > r.price);
        const best = (withDiscount.length > 0 ? withDiscount : valid)
          .sort((a: any, b: any) => a.price - b.price)[0];
        console.log(`[ML API] ✅ Search catalog_product_id ${catalogId}: ${valid.length} resultados, melhor=${best.price} orig=${best.original_price}`);
        return {
          finalPrice: best.price,
          originalPrice: (best.original_price > best.price) ? best.original_price : null,
          title: best.title || '',
          mainImage: (best.thumbnail || '').replace('-I.jpg', '-O.jpg').replace('-I.webp', '-O.webp'),
        };
      }
    } catch (e: any) {
      console.warn('[ML API] Search catalog_product_id falhou:', e.message);
    }

    // ── Estratégia B: catalog_products API direta ──────────────────────────
    try {
      const cpResp = await axios.get(
        `https://api.mercadolibre.com/catalog_products/${catalogId}`,
        { headers, timeout: 8000 }
      );
      const cp = cpResp.data;
      if (cp?.buy_box_winner?.item_id) {
        // Temos o item vencedor do buy box — buscar preço via items API
        const winnerId = cp.buy_box_winner.item_id;
        console.log(`[ML API] catalog_products buy_box_winner: ${winnerId}`);
        const itemResp = await axios.get(`https://api.mercadolibre.com/items/${winnerId}`, { headers, timeout: 8000 });
        const d = itemResp.data;
        if (d?.price > 0) {
          return {
            finalPrice: d.price,
            originalPrice: d.original_price && d.original_price > d.price ? d.original_price : null,
            title: d.title || cp.name || '',
            mainImage: (d.thumbnail || '').replace('-I.jpg', '-O.jpg').replace('-I.webp', '-O.webp'),
          };
        }
      }
    } catch (e: any) {
      console.warn('[ML API] catalog_products API falhou:', e.message);
    }

    // ── Estratégia C: lista.mercadolivre.com.br/{slug} ────────────────────
    // Página server-rendered com IDs de itens reais no HTML.
    try {
      const urlObj = new URL(url);
      const slug = urlObj.pathname.split('/').filter(Boolean)[0] || '';
      // Tentar primeiro com o catalogId (mais específico), depois com o slug
      const listingUrls = [
        slug && slug.length > 5 ? `https://lista.mercadolivre.com.br/${slug}` : null,
      ].filter(Boolean) as string[];

      for (const listingUrl of listingUrls) {
        try {
          console.log('[ML API] Buscando IDs via lista:', listingUrl);
          const listResp = await axios.get(listingUrl, { headers, timeout: 12000 });
          const listHtml: string = listResp.data || '';

          // Extrair IDs únicos de itens MLB (7+ dígitos) do HTML da listagem
          const rawIds = listHtml.match(/MLB\d{7,}/gi) || [];
          // Filtrar IDs que parecem de ITENS (9+ dígitos), não de catálogos (7-8 dígitos)
          const itemIds = [...new Set(
            rawIds.filter(id => id.replace(/MLB/i, '').length >= 9)
                  .map((id: string) => id.toUpperCase())
          )].slice(0, 8);
          console.log('[ML API] IDs de itens encontrados na listagem:', itemIds);

          if (itemIds.length > 0) {
            const itemResults = await Promise.allSettled(
              itemIds.map((id: string) =>
                axios.get(`https://api.mercadolibre.com/items/${id}`, { headers, timeout: 6000 })
                  .then((r: any) => r.data)
              )
            );

            const validItems: Array<{price: number; original_price: number; id: string; title: string; thumbnail: string}> = [];
            for (const result of itemResults) {
              if (result.status === 'fulfilled') {
                const d = result.value;
                if (d?.price > 0) validItems.push(d);
              }
            }

            console.log('[ML API] Itens válidos:', validItems.map(d => `${d.id}:${d.price}/${d.original_price}`));

            if (validItems.length > 0) {
              // Preferir item com desconto; se vários, pegar o de preço mais próximo da mediana
              // (evita pegar item aleatório muito barato ou muito caro)
              const withDiscount = validItems.filter(d => d.original_price && d.original_price > d.price);
              const candidates = withDiscount.length > 0 ? withDiscount : validItems;
              candidates.sort((a, b) => a.price - b.price);
              // Pegar o do meio (mediana) para evitar outliers
              const medIdx = Math.floor(candidates.length / 2);
              const best = candidates.length === 1 ? candidates[0] : candidates[medIdx];

              return {
                finalPrice: best.price,
                originalPrice: best.original_price && best.original_price > best.price ? best.original_price : null,
                title: best.title || '',
                mainImage: (best.thumbnail || '').replace('-I.jpg', '-O.jpg').replace('-I.webp', '-O.webp'),
              };
            }
          }
        } catch (innerE: any) {
          console.warn(`[ML API] Falha em ${listingUrl}:`, innerE.message);
        }
      }
    } catch (e: any) {
      console.warn('[ML API] Falha na estratégia lista.mercadolivre.com.br:', e.message);
    }

    // ── Estratégia D: products/{id}/items (geralmente 403, mas tentamos) ──
    try {
      const resp = await axios.get(
        `https://api.mercadolibre.com/products/${catalogId}/items?limit=1`,
        { headers, timeout: 8000 }
      );
      const results = resp.data?.results || resp.data;
      const first = Array.isArray(results) ? results[0] : null;
      if (first?.id) return fetchMlPricesFromAPI(url, first.id);
    } catch (_e) { /* ignorar */ }
  }

  return null;
}

export async function scrapeMercadoLivreHTTP($: cheerio.CheerioAPI, originalUrl?: string) {
  console.log('[Scraper HTTP] Usando scraper HTTP do Mercado Livre...');

  // ── BLOQUEIO: páginas de catálogo /p/ não têm preços no HTML estático ────
  // Os preços são 100% carregados por JavaScript. Tentar parsear o HTML dessas
  // páginas resulta em preços completamente errados vindos do bundle JS.
  // Retornar finalPrice=0 faz o sistema mostrar erro ao usuário (correto).
  const mlIdFromUrl = extractMlId(originalUrl || '');
  if (mlIdFromUrl?.type === 'product') {
    console.log('[ML HTTP] BLOQUEADO: página de catálogo /p/ sem preços no HTML. Playwright necessário.');
    // Tenta apenas a API — se falhar, retorna vazio (sem lixo do HTML)
    const rawHtml = $.html();
    const htmlIdMatch = rawHtml.match(/"item_id"\s*:\s*"(MLB\d{7,})"/i) ||
                        rawHtml.match(/data-item-id="(MLB\d{7,})"/i);
    const htmlItemId = htmlIdMatch ? htmlIdMatch[1].toUpperCase() : undefined;
    // Tenta extrair item IDs do __NEXT_DATA__ inline no HTML da página de catálogo
    // (Next.js embute o estado inicial da página no script __NEXT_DATA__)
    let nextDataItemId: string | undefined;
    try {
      const nextDataMatch = rawHtml.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]{50,}?)<\/script>/i);
      if (nextDataMatch) {
        // Buscar IDs de itens (9+ dígitos) dentro do JSON do __NEXT_DATA__
        const idsInJson = nextDataMatch[1].match(/MLB\d{9,}/gi) || [];
        if (idsInJson.length > 0) {
          nextDataItemId = idsInJson[0].toUpperCase();
          console.log('[ML HTTP] __NEXT_DATA__ item IDs encontrados:', idsInJson.slice(0, 3));
        }
      }
    } catch (_e) { /* ignorar */ }

    const apiData = await fetchMlPricesFromAPI(originalUrl!, nextDataItemId || htmlItemId);
    if (apiData && apiData.finalPrice > 0) {
      const discount = apiData.originalPrice && apiData.originalPrice > apiData.finalPrice
        ? Math.round(((apiData.originalPrice - apiData.finalPrice) / apiData.originalPrice) * 100)
        : 0;
      const title = $('h1.ui-pdp-title').first().text().trim() ||
                    $('.ui-pdp-title').first().text().trim() || apiData.title;
      const mainImageFromHtml = $('figure.ui-pdp-gallery__figure img').first().attr('src') ||
                                 $('.ui-pdp-image').first().attr('src') || apiData.mainImage;
      return {
        title,
        finalPrice: apiData.finalPrice,
        originalPrice: apiData.originalPrice,
        discount,
        mainImage: mainImageFromHtml,
        images: [mainImageFromHtml],
      };
    }
    // API falhou → extrai título e imagem do HTML estático e retorna dados parciais.
    // O HTML de catálogo tem meta tags mesmo sem JS (título, og:image).
    const rawHtmlForMeta = $.html();
    const decodeHtmlEntities = (str: string) =>
      str.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
         .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

    const rawMetaTitle =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="title"]').attr('content') ||
      $('title').first().text().trim() ||
      rawHtmlForMeta.match(/<title[^>]*>([^<]{10,})<\/title>/i)?.[1]?.trim() ||
      '';
    // Remove sufixos indesejados: "| Mercado Livre", "- R$ X.XXX", etc.
    const metaTitle = decodeHtmlEntities(rawMetaTitle)
      .replace(/\s*[-|]\s*R\$\s*[\d.,]+\s*$/i, '')  // remove "- R$ 3.339" no fim
      .replace(/\s*\|\s*Mercado\s*(Livre|Liber[oó])\s*$/i, '')  // remove "| Mercado Livre"
      .trim();
    const metaImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="image"]').attr('content') ||
      '';
    console.log('[ML HTTP] Dados parciais via meta:', { metaTitle: metaTitle?.substring(0, 50), metaImage: !!metaImage });
    return {
      title: metaTitle,
      finalPrice: 0,
      originalPrice: null,
      discount: 0,
      mainImage: metaImage,
      images: metaImage ? [metaImage] : [],
      partialData: true,  // sinaliza que preços precisam ser inseridos manualmente
    };
  }

  // Título (do HTML — sempre disponível mesmo sem JS)
  const title = $('h1.ui-pdp-title').first().text().trim() ||
                $('.ui-pdp-title').first().text().trim() || '';

  const rawHtml = $.html();

  // ── Estratégia 1: API pública do ML ─────────────────────────────────────
  // Busca pelo ID do item "Comprar agora" no HTML — esse link aponta para o
  // item da "Melhor preço", que é exatamente o que queremos.
  if (originalUrl) {
    // Prioridade 1: link do botão "Comprar" (produto → item correto)
    const buyHref = $('a[href*="MLB"][class*="buy"], a[href*="MLB"][class*="action"]').first().attr('href') ||
                    $('a.ui-pdp-action-modal__target').first().attr('href') ||
                    $('a[href*="/MLB"][href*="mercadolivre"]').first().attr('href') || '';
    const buyIdMatch = buyHref.match(/\/(MLB\d{9,})/i) || buyHref.match(/\/MLB-(\d{9,})/i);
    const buyItemId = buyIdMatch
      ? (buyIdMatch[0].includes('-') ? `MLB${buyIdMatch[1]}` : buyIdMatch[1]).toUpperCase()
      : undefined;

    // Prioridade 2: item ID embutido no HTML (JSON/data-attribute)
    const htmlIdMatch =
      rawHtml.match(/"item_id"\s*:\s*"(MLB\d{7,})"/i) ||
      rawHtml.match(/data-item-id="(MLB\d{7,})"/i) ||
      rawHtml.match(/"itemId"\s*:\s*"(MLB\d{7,})"/i) ||
      rawHtml.match(/"id"\s*:\s*"(MLB\d{9,})"/i) ||
      rawHtml.match(/["'](MLB\d{9,})["']/i);
    const htmlItemId = htmlIdMatch ? htmlIdMatch[1].toUpperCase() : undefined;

    console.log('[ML HTTP] URL:', originalUrl, '| mlId:', extractMlId(originalUrl), '| buyItemId:', buyItemId, '| htmlItemId:', htmlItemId);

    const apiData = await fetchMlPricesFromAPI(originalUrl, buyItemId || htmlItemId);
    if (apiData && apiData.finalPrice > 0) {
      const discount = apiData.originalPrice && apiData.originalPrice > apiData.finalPrice
        ? Math.round(((apiData.originalPrice - apiData.finalPrice) / apiData.originalPrice) * 100)
        : 0;

      const mainImageFromHtml = $('figure.ui-pdp-gallery__figure img').first().attr('src') ||
                                 $('.ui-pdp-image').first().attr('src') || apiData.mainImage;

      const images: string[] = [];
      $('figure img, .ui-pdp-gallery img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src && src.startsWith('http') && !images.includes(src)) images.push(src);
      });

      return {
        title: title || apiData.title,
        finalPrice: apiData.finalPrice,
        originalPrice: apiData.originalPrice,
        discount,
        mainImage: mainImageFromHtml,
        images: images.length ? images.slice(0, 10) : [mainImageFromHtml],
      };
    }
  }

  // ── Estratégia 2: Regex no HTML bruto (procura preço Pix e riscado) ──────
  // Funciona mesmo sem JS — o preço Pix e o riscado são renderizados server-side.
  console.log('[Scraper HTTP ML] API falhou, tentando extração por regex...');
  let finalPrice = 0;
  let originalPrice: number | null = null;

  // Helper: extrai valor de fração ML (ex: "2.969", "69") + centavos ("10", "90")
  const parseMlFrac = (frac: string, cts: string) => {
    const cleanF = frac.replace(/\./g, '');   // remove separador de milhar
    const cleanC = (cts || '00').replace(/\D/g, '').padStart(2, '0').slice(0, 2);
    return parseFloat(`${cleanF}.${cleanC}`) || 0;
  };

  // ── 2a: Preço Pix (preço final) ─────────────────────────────────────────
  // A página de produto pode ter MÚLTIPLAS seções com "OFF no Pix"
  // (ex: Loja Oficial Samsung E Melhor Preço). Coletamos TODOS e pegamos o MENOR.
  const pixPrices: number[] = [];
  for (const pixMatch of rawHtml.matchAll(/OFF no Pix/gi)) {
    const idx = pixMatch.index ?? 0;
    const ctx = rawHtml.slice(Math.max(0, idx - 600), idx);
    const fracs = [...ctx.matchAll(/andes-money-amount__fraction[^>]*>([\d.]+)<\/span>/gi)];
    if (fracs.length > 0) {
      const lastFrac = fracs[fracs.length - 1][1];
      const centsMatches = [...ctx.matchAll(/andes-money-amount__cents[^>]*>(\d{1,2})<\/span>/gi)];
      const lastCents = centsMatches.length > 0 ? centsMatches[centsMatches.length - 1][1] : '00';
      const v = parseMlFrac(lastFrac, lastCents);
      if (v > 0) pixPrices.push(v);
    }
  }
  if (pixPrices.length > 0) {
    // Menor preço Pix = "Melhor preço" (não a loja oficial mais cara)
    finalPrice = Math.min(...pixPrices);
    console.log('[ML HTTP] Todos preços Pix encontrados:', pixPrices, '-> usando menor:', finalPrice);
  }

  // ── 2b: Preço riscado / original ─────────────────────────────────────────
  // Pode haver múltiplos riscados (ex: R$3.499 Samsung + R$3.299 Melhor Preço).
  // Pega o MENOR riscado — que é o do "Melhor preço".
  const prevPrices: number[] = [];
  for (const prevMatch of rawHtml.matchAll(
    /andes-money-amount--previous[\s\S]{0,300}?andes-money-amount__fraction[^>]*>([\d.]+)<\/span>(?:[\s\S]{0,100}?andes-money-amount__cents[^>]*>(\d{1,2})<\/span>)?/gi
  )) {
    const v = parseMlFrac(prevMatch[1], prevMatch[2] || '00');
    if (v > 0) prevPrices.push(v);
  }
  if (prevPrices.length > 0) {
    originalPrice = Math.min(...prevPrices);
    console.log('[ML HTTP] Todos preços riscados encontrados:', prevPrices, '-> usando menor:', originalPrice);
  }

  // ── 2c: Fallback CSS seletores ────────────────────────────────────────────
  if (finalPrice === 0) {
    const prevEl = $('.andes-money-amount--previous').first();
    if (prevEl.length) {
      const frac = prevEl.find('.andes-money-amount__fraction').first().text().trim();
      const cts  = prevEl.find('.andes-money-amount__cents').first().text().trim() || '00';
      originalPrice = parseMlFrac(frac, cts) || null;
    }

    for (const sel of ['.ui-pdp-price__main-price', '.ui-pdp-price__second-line', '.ui-pdp-price', '.poly-price__current']) {
      if (finalPrice > 0) break;
      $(sel).first().find('.andes-money-amount:not(.andes-money-amount--previous)').each((_: number, el: any) => {
        if (finalPrice > 0) return false;
        const frac = $(el).find('.andes-money-amount__fraction').first().text().trim();
        const cts  = $(el).find('.andes-money-amount__cents').first().text().trim() || '00';
        const val  = parseMlFrac(frac, cts);
        if (val > 0 && val !== originalPrice && (!originalPrice || val >= originalPrice * 0.5)) {
          finalPrice = val;
        }
      });
    }
  }

  // Se só temos o preço Pix mas não o riscado, o riscado é o final sem desconto.
  // Tenta extrair o primeiro precio na página que seja >= finalPrice
  if (finalPrice > 0 && !originalPrice) {
    const allFracs = [...rawHtml.matchAll(/andes-money-amount__fraction[^>]*>([\d.]+)<\/span>(?:[^<]*(?:<[^>]*>)*[^<]*andes-money-amount__cents[^>]*>(\d{1,2})<\/span>)?/gi)];
    for (const m of allFracs) {
      const v = parseMlFrac(m[1], m[2] || '00');
      if (v > finalPrice) { originalPrice = v; break; }
    }
  }

  const discount = originalPrice && originalPrice > finalPrice && finalPrice > 0
    ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
    : 0;

  const mainImage = $('figure.ui-pdp-gallery__figure img').first().attr('src') ||
                    $('.ui-pdp-image').first().attr('src') ||
                    $('img[data-zoom]').first().attr('src') || '';

  const images: string[] = [];
  $('figure img, .ui-pdp-gallery img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src && src.startsWith('http') && !images.includes(src)) images.push(src);
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
