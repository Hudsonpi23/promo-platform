/**
 * Amazon Creators API Routes
 *
 * Endpoints para buscar produtos e dados da Amazon via API oficial.
 * Substitui o web scraping (sujeito a CAPTCHA) por dados confiáveis.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authGuard } from '../lib/auth.js';
import {
  isAmazonApiConfigured,
  searchAmazonProducts,
  getAmazonItems,
  getAmazonProductByUrl,
  extractAsinFromUrl,
} from '../services/amazonApi.js';

export async function amazonRoutes(app: FastifyInstance) {

  /**
   * GET /api/amazon/status
   * Verifica se a Amazon API está configurada
   */
  app.get('/status', { preHandler: [authGuard] }, async () => {
    return {
      configured: isAmazonApiConfigured(),
      partnerTag: process.env.AMAZON_PARTNER_TAG || null,
      marketplace: process.env.AMAZON_MARKETPLACE || null,
    };
  });

  /**
   * GET /api/amazon/test
   * Testa credenciais e busca com keyword simples para diagnóstico
   */
  app.get('/test', { preHandler: [authGuard] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!isAmazonApiConfigured()) {
      return reply.status(503).send({ error: 'Amazon API não configurada', configured: false });
    }
    try {
      const result = await searchAmazonProducts('fone bluetooth', { itemCount: 1 });
      return {
        success: true,
        configured: true,
        credentialVersion: process.env.AMAZON_CREDENTIAL_VERSION || '3.1',
        marketplace: process.env.AMAZON_MARKETPLACE || 'www.amazon.com.br',
        partnerTag: process.env.AMAZON_PARTNER_TAG || null,
        testSearchResults: result.products.length,
        firstProduct: result.products[0] ? {
          title: result.products[0].title,
          price: result.products[0].finalPrice,
          asin: result.products[0].asin,
        } : null,
      };
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message,
        credentialVersion: process.env.AMAZON_CREDENTIAL_VERSION || '3.1',
        marketplace: process.env.AMAZON_MARKETPLACE || 'www.amazon.com.br',
        hint: err.message.includes('401') ? 'Credenciais inválidas ou expiradas'
          : err.message.includes('403') ? 'Acesso negado — verifique permissões do Creators API'
          : err.message.includes('429') ? 'Rate limit — aguarde e tente novamente'
          : 'Verifique as variáveis AMAZON_CREDENTIAL_ID, AMAZON_CREDENTIAL_SECRET e AMAZON_CREDENTIAL_VERSION',
      });
    }
  });

  /**
   * POST /api/amazon/search
   * Busca produtos por keyword
   */
  app.post('/search', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAmazonApiConfigured()) {
      return reply.status(503).send({ error: 'Amazon API não configurada' });
    }

    const body = request.body as {
      keywords?: string;
      sortBy?: string;
      minPrice?: number;
      maxPrice?: number;
      category?: string;
      itemCount?: number;
      itemPage?: number;
    };

    if (!body.keywords || body.keywords.trim().length < 2) {
      return reply.status(400).send({ error: 'Keywords obrigatórias (mínimo 2 caracteres)' });
    }

    try {
      const result = await searchAmazonProducts(body.keywords.trim(), {
        sortBy: body.sortBy as any,
        minPrice: body.minPrice,
        maxPrice: body.maxPrice,
        category: body.category,
        itemCount: body.itemCount,
        itemPage: body.itemPage,
      });

      return {
        success: true,
        ...result,
      };
    } catch (err: any) {
      console.error('[Amazon Route] Erro search:', err.message);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * POST /api/amazon/get-items
   * Busca produtos por ASIN(s)
   */
  app.post('/get-items', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAmazonApiConfigured()) {
      return reply.status(503).send({ error: 'Amazon API não configurada' });
    }

    const body = request.body as { asins?: string[] };

    if (!body.asins || body.asins.length === 0) {
      return reply.status(400).send({ error: 'Informe ao menos 1 ASIN' });
    }

    if (body.asins.length > 10) {
      return reply.status(400).send({ error: 'Máximo 10 ASINs por request' });
    }

    try {
      const products = await getAmazonItems(body.asins);
      return { success: true, products };
    } catch (err: any) {
      console.error('[Amazon Route] Erro get-items:', err.message);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * POST /api/amazon/product-from-url
   * Extrai ASIN de uma URL da Amazon e retorna dados completos via API
   */
  app.post('/product-from-url', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAmazonApiConfigured()) {
      return reply.status(503).send({ error: 'Amazon API não configurada' });
    }

    const body = request.body as { url?: string };

    if (!body.url || !body.url.includes('amazon')) {
      return reply.status(400).send({ error: 'URL da Amazon obrigatória' });
    }

    const asin = extractAsinFromUrl(body.url);
    if (!asin) {
      return reply.status(400).send({ error: 'ASIN não encontrado na URL' });
    }

    try {
      const product = await getAmazonProductByUrl(body.url);
      if (!product) {
        return reply.status(404).send({ error: 'Produto não encontrado na Amazon' });
      }
      return { success: true, product };
    } catch (err: any) {
      console.error('[Amazon Route] Erro product-from-url:', err.message);
      return reply.status(500).send({ error: err.message });
    }
  });
}
