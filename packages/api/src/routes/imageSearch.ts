import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';

const GOOGLE_API_KEY   = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

interface GoogleImageItem {
  title: string;
  link: string;
  image: {
    thumbnailLink: string;
    contextLink: string;
    width: number;
    height: number;
  };
}

export async function imageSearchRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/images/search?q=titulo+do+produto
   * Retorna até 10 imagens do Google Custom Search.
   * Prioridade B — imagens lifestyle reais.
   */
  fastify.get('/images/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { q } = request.query as { q?: string };

    if (!q || q.trim().length < 3) {
      return reply.status(400).send({ error: 'Parâmetro q obrigatório (mínimo 3 caracteres)' });
    }

    if (!GOOGLE_API_KEY || !GOOGLE_ENGINE_ID) {
      return reply.status(503).send({ error: 'Google Search API não configurada' });
    }

    try {
      // Limpar título: remover modelo/código técnico para query mais eficaz no Google
      const cleanQuery = q.trim()
        .replace(/\b[A-Z]{2,}\d{3,}[A-Z0-9]*\b/g, '') // remover códigos tipo CWB09BB, MLB123
        .replace(/\s{2,}/g, ' ')
        .trim();
      const searchQuery = cleanQuery.length > 10 ? cleanQuery : q.trim();

      console.log('[ImageSearch] Query original:', q.trim().substring(0, 60));
      console.log('[ImageSearch] Query limpa:', searchQuery.substring(0, 60));

      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key:            GOOGLE_API_KEY,
          cx:             GOOGLE_ENGINE_ID,
          q:              searchQuery,
          searchType:     'image',
          num:            10,
          imgSize:        'large',
          imgType:        'photo',
          safe:           'active',
          gl:             'br',
          // Excluir ML — fotos do ML já estão disponíveis via scraper
          siteSearch:     'mercadolivre.com.br',
          siteSearchFilter: 'e',
        },
        timeout: 10000,
      });

      console.log('[ImageSearch] Resultados Google:', response.data.items?.length ?? 0);

      const items: GoogleImageItem[] = response.data.items ?? [];

      const images = items.map(item => ({
        url:       item.link,
        thumbnail: item.image?.thumbnailLink ?? item.link,
        title:     item.title,
        source:    item.image?.contextLink ?? '',
        width:     item.image?.width  ?? 0,
        height:    item.image?.height ?? 0,
      }));

      return reply.send({ images, total: images.length });

    } catch (err: any) {
      const status = err.response?.status;

      // Cota diária esgotada (429) ou erro de autenticação (403)
      if (status === 429 || status === 403) {
        return reply.status(503).send({
          error: 'QUOTA_EXCEEDED',
          message: 'Limite diário do Google atingido. Use as fotos do anúncio.',
        });
      }

      console.error('[ImageSearch] Erro Google API:', err.message);
      return reply.status(500).send({ error: 'Erro ao buscar imagens' });
    }
  });
}
