/**
 * Rotas do Auto Promoter (Fastify)
 * 
 * API para executar postagem automática de ofertas do ML
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { runAutoPromoter, postSingleProduct } from '../services/autoPromoter';
import { searchDeals, ML_CATEGORIES } from '../services/mlAffiliate';

export async function autoPromoterRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // ==================== STATUS ====================

  /**
   * GET /status - Verifica configuração
   */
  fastify.get('/status', async (_request, reply) => {
    const config = {
      telegram: {
        configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        botToken: process.env.TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Faltando',
        chatId: process.env.TELEGRAM_CHAT_ID ? '✅ Configurado' : '❌ Faltando',
      },
      facebook: {
        page1: {
          name: 'Manu Das Promoções',
          configured: !!(process.env.FB_PAGE_ID_1 || process.env.META_PAGE_ID),
          pageId: (process.env.FB_PAGE_ID_1 || process.env.META_PAGE_ID || 'Não configurado').substring(0, 10) + '...',
        },
        page2: {
          name: 'Manu Promoções de Tecnologia',
          configured: !!process.env.FB_PAGE_ID_2,
          pageId: process.env.FB_PAGE_ID_2 ? process.env.FB_PAGE_ID_2.substring(0, 10) + '...' : 'Não configurado',
        },
      },
      twitter: {
        configured: !!(
          process.env.TWITTER_API_KEY &&
          process.env.TWITTER_API_SECRET &&
          process.env.TWITTER_ACCESS_TOKEN &&
          process.env.TWITTER_ACCESS_TOKEN_SECRET
        ),
      },
      cloudinary: {
        configured: !!(
          process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET
        ),
      },
    };

    return reply.send({
      success: true,
      message: '🚀 Auto Promoter - Sistema de Postagem Automática',
      config,
      categories: Object.keys(ML_CATEGORIES),
      endpoints: {
        status: 'GET /api/auto-promoter/status',
        search: 'GET /api/auto-promoter/search?q=...&minDiscount=20',
        run: 'POST /api/auto-promoter/run',
        postSingle: 'POST /api/auto-promoter/post-single',
      },
    });
  });

  // ==================== BUSCA ====================

  /**
   * GET /search - Busca ofertas sem postar
   */
  fastify.get('/search', async (request, reply) => {
    const { q, category, minDiscount, limit } = request.query as {
      q?: string;
      category?: string;
      minDiscount?: string;
      limit?: string;
    };

    console.log(`[AutoPromoter] Buscando: q=${q || '*'}, category=${category || 'todas'}, minDiscount=${minDiscount || 20}%`);

    const result = await searchDeals({
      query: q || '',
      category,
      minDiscount: parseInt(minDiscount || '20'),
      limit: parseInt(limit || '10'),
    });

    return reply.send({
      success: result.success,
      total: result.total,
      products: result.products.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        original_price: p.original_price,
        discount: p.discount_percentage,
        thumbnail: p.thumbnail,
        affiliate_url: p.affiliate_url,
        shipping_free: p.shipping_free,
        permalink: p.permalink,
      })),
      error: result.error,
    });
  });

  // ==================== EXECUÇÃO AUTOMÁTICA ====================

  /**
   * POST /run - Executa o fluxo completo: busca + posta
   */
  fastify.post('/run', async (request, reply) => {
    try {
      const body = (request.body as any) || {};

      const options = {
        query: body.query,
        category: body.category,
        minDiscount: body.minDiscount || 20,
        maxProducts: body.maxProducts || 3,
        postToTelegram: body.postToTelegram !== false,
        postToFacebook: body.postToFacebook !== false,
        postToTwitter: body.postToTwitter !== false,
        delayBetweenPosts: body.delayBetweenPosts || 5000,
      };

      console.log('[AutoPromoter] 🚀 Iniciando execução automática:', options);

      const results = await runAutoPromoter(options);

      // Resume dos resultados
      const summary = {
        totalProducts: results.length,
        telegram: { success: 0, failed: 0 },
        facebook: { success: 0, failed: 0 },
        twitter: { success: 0, failed: 0 },
      };

      for (const result of results) {
        for (const post of result.posts) {
          if (post.platform === 'telegram') {
            post.success ? summary.telegram.success++ : summary.telegram.failed++;
          } else if (post.platform.startsWith('facebook')) {
            post.success ? summary.facebook.success++ : summary.facebook.failed++;
          } else if (post.platform === 'twitter') {
            post.success ? summary.twitter.success++ : summary.twitter.failed++;
          }
        }
      }

      return reply.send({
        success: true,
        message: `✅ Processados ${results.length} produtos`,
        summary,
        results: results.map(r => ({
          product: {
            id: r.product.id,
            title: r.product.title,
            price: r.product.price,
            discount: r.product.discount_percentage,
          },
          imageUrl: r.cloudinaryUrl,
          posts: r.posts,
          timestamp: r.timestamp,
        })),
      });
    } catch (error: any) {
      console.error('[AutoPromoter] ❌ Erro:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // ==================== POST ÚNICO ====================

  /**
   * POST /post-single - Posta um produto específico
   */
  fastify.post('/post-single', async (request, reply) => {
    try {
      const body = (request.body as any) || {};

      if (!body.affiliateUrl) {
        return reply.status(400).send({
          success: false,
          error: 'affiliateUrl é obrigatório',
        });
      }

      console.log('[AutoPromoter] 📤 Postando produto único:', body.affiliateUrl);

      const result = await postSingleProduct(body.affiliateUrl, body.imageUrl, {
        postToTelegram: body.postToTelegram !== false,
        postToFacebook: body.postToFacebook !== false,
        postToTwitter: body.postToTwitter !== false,
      });

      return reply.send({
        success: true,
        result: {
          imageUrl: result.cloudinaryUrl,
          posts: result.posts,
          timestamp: result.timestamp,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // ==================== CATEGORIAS ====================

  /**
   * GET /categories - Lista categorias do ML
   */
  fastify.get('/categories', async (_request, reply) => {
    return reply.send({
      success: true,
      categories: ML_CATEGORIES,
    });
  });
}
