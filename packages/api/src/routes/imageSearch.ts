import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';

const SERPAPI_KEY     = process.env.SERPAPI_KEY;
// Manter suporte ao Google Custom Search como fallback
const GOOGLE_API_KEY   = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

export async function imageSearchRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/images/search?q=titulo+do+produto
   * Busca imagens reais do Google via SerpApi (fallback: Google Custom Search)
   */
  fastify.get('/images/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { q } = request.query as { q?: string };

    if (!q || q.trim().length < 3) {
      return reply.status(400).send({ error: 'Parâmetro q obrigatório (mínimo 3 caracteres)' });
    }

    // ── Limpar query ──────────────────────────────────────────────────────────
    // 1. Remover códigos técnicos de modelo (ex: HQ24IP200, BLS-01-B, MLB123)
    // 2. Remover voltagem/tensão (127v, 220v, bivolt)
    // 3. Remover dimensões isoladas (24", 50ml, 1400w)
    // 4. Remover marcas de loja/plataforma (Mercado Livre, Amazon, etc.)
    // 5. Pegar apenas as primeiras palavras relevantes (máx 6 palavras)
    const rawTitle = q.trim();

    const cleaned = rawTitle
      .replace(/\b[A-Z]{1,4}\d{2,}[A-Z0-9\-]*\b/gi, '')   // códigos de modelo
      .replace(/\b\d+\s*(?:v|w|hz|ml|l|kg|cm|mm|gb|tb|mp|pol|"\b)/gi, '') // voltagem, watts, etc
      .replace(/\b(?:bivolt|127v|220v|full\s*hd|4k|uhd|oled|qled)\b/gi, '')
      .replace(/\b(?:mercado livre|amazon|shopee|magalu|americanas)\b/gi, '')
      .replace(/[^\w\sÀ-ú]/g, ' ')  // remover caracteres especiais
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Pegar as primeiras 6 palavras para focar no nome do produto
    const shortTitle = cleaned.split(' ').slice(0, 6).join(' ');
    const baseQuery = shortTitle.length > 8 ? shortTitle : rawTitle.split(' ').slice(0, 5).join(' ');

    // Domínios de e-commerce que costumam ter fundo branco — filtrar da busca
    const ECOMMERCE_DOMAINS = [
      'amazon.', 'mercadolivre.', 'mercadolibre.', 'shopee.',
      'magazineluiza.', 'magalu.', 'americanas.', 'submarino.',
      'casasbahia.', 'extra.com', 'pontofrio.', 'carrefour.',
      'aliexpress.', 'alibaba.', 'walmart.',
    ];

    function isEcommerce(url: string, source: string): boolean {
      return ECOMMERCE_DOMAINS.some(d => url.includes(d) || source.includes(d));
    }

    // Queries em cascata: da mais específica (lifestyle real) para a mais genérica
    const queries = [
      `${baseQuery} pessoa segurando mão usando`,
      `${baseQuery} lifestyle uso real`,
      `${baseQuery} lifestyle`,
    ];

    console.log('[ImageSearch] Query original:', rawTitle.substring(0, 60));
    console.log('[ImageSearch] Queries em cascata:', queries);

    // ── 1. SerpApi (Google Images real) ───────────────────────────────────
    if (SERPAPI_KEY) {
      const allImages: any[] = [];

      for (const searchQuery of queries) {
        if (allImages.length >= 10) break;
        try {
          const response = await axios.get('https://serpapi.com/search', {
            params: {
              engine:   'google_images',
              q:        searchQuery,
              api_key:  SERPAPI_KEY,
              hl:       'pt',
              gl:       'br',
              num:      10,
            },
            timeout: 12000,
          });

          const rawImages = response.data?.images_results ?? [];
          console.log(`[ImageSearch] SerpApi "${searchQuery}" → ${rawImages.length} resultados`);

          const mapped = rawImages
            .map((img: any) => ({
              url:       img.original,
              thumbnail: img.thumbnail,
              title:     img.title ?? '',
              source:    img.source ?? '',
              width:     img.original_width  ?? 0,
              height:    img.original_height ?? 0,
            }))
            .filter((img: any) =>
              img.url &&
              img.url.startsWith('http') &&
              !isEcommerce(img.url, img.source)
            );

          // Adicionar apenas imagens novas (sem duplicar URL)
          for (const img of mapped) {
            if (allImages.length >= 10) break;
            if (!allImages.find(e => e.url === img.url)) {
              allImages.push(img);
            }
          }
        } catch (serpErr: any) {
          console.warn(`[ImageSearch] SerpApi erro na query "${searchQuery}":`, serpErr.message);
        }
      }

      if (allImages.length > 0) {
        console.log('[ImageSearch] SerpApi total final:', allImages.length);
        return reply.send({ images: allImages, total: allImages.length, provider: 'serpapi' });
      }

      console.warn('[ImageSearch] SerpApi retornou 0 imagens após cascata, tentando fallback...');
    }

    // ── 2. Fallback: Google Custom Search ─────────────────────────────────
    if (GOOGLE_API_KEY && GOOGLE_ENGINE_ID) {
      try {
        const searchQuery = `${baseQuery} lifestyle uso real`;
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
          params: {
            key:        GOOGLE_API_KEY,
            cx:         GOOGLE_ENGINE_ID,
            q:          searchQuery,
            searchType: 'image',
            num:        10,
            imgSize:    'large',
            imgType:    'photo',
            safe:       'active',
            gl:         'br',
          },
          timeout: 10000,
        });

        const items = response.data.items ?? [];
        console.log('[ImageSearch] Google Custom Search resultados:', items.length);

        const images = items
          .map((item: any) => ({
            url:       item.link,
            thumbnail: item.image?.thumbnailLink ?? item.link,
            title:     item.title,
            source:    item.image?.contextLink ?? '',
            width:     item.image?.width  ?? 0,
            height:    item.image?.height ?? 0,
          }))
          .filter((img: any) => !isEcommerce(img.url, img.source));

        return reply.send({ images, total: images.length, provider: 'google' });
      } catch (googleErr: any) {
        console.warn('[ImageSearch] Google fallback erro:', googleErr.message);
      }
    }

    return reply.send({ images: [], total: 0 });
  });
}
