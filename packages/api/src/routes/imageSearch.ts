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

    // Limpar query: remover códigos técnicos para melhor resultado
    const cleanQuery = q.trim()
      .replace(/\b[A-Z]{2,}\d{3,}[A-Z0-9]*\b/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const searchQuery = cleanQuery.length > 10 ? cleanQuery : q.trim();

    console.log('[ImageSearch] Query:', searchQuery.substring(0, 60));

    // ── 1. SerpApi (Google Images real) ───────────────────────────────────
    if (SERPAPI_KEY) {
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
        console.log('[ImageSearch] SerpApi resultados:', rawImages.length);

        const images = rawImages.slice(0, 10).map((img: any) => ({
          url:       img.original,
          thumbnail: img.thumbnail,
          title:     img.title ?? '',
          source:    img.source ?? '',
          width:     img.original_width  ?? 0,
          height:    img.original_height ?? 0,
        })).filter((img: any) => img.url && img.url.startsWith('http'));

        if (images.length > 0) {
          return reply.send({ images, total: images.length, provider: 'serpapi' });
        }

        console.warn('[ImageSearch] SerpApi retornou 0 imagens, tentando fallback...');
      } catch (serpErr: any) {
        console.warn('[ImageSearch] SerpApi erro:', serpErr.message);
      }
    }

    // ── 2. Fallback: Google Custom Search ─────────────────────────────────
    if (GOOGLE_API_KEY && GOOGLE_ENGINE_ID) {
      try {
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

        const images = items.map((item: any) => ({
          url:       item.link,
          thumbnail: item.image?.thumbnailLink ?? item.link,
          title:     item.title,
          source:    item.image?.contextLink ?? '',
          width:     item.image?.width  ?? 0,
          height:    item.image?.height ?? 0,
        }));

        return reply.send({ images, total: images.length, provider: 'google' });
      } catch (googleErr: any) {
        console.warn('[ImageSearch] Google fallback erro:', googleErr.message);
      }
    }

    return reply.send({ images: [], total: 0 });
  });
}
