/**
 * Rotas de Teste e Validação - Mercado Livre
 * 
 * Endpoints para validar a integração OAuth:
 * - GET /api/ml/connection - Status da conexão
 * - GET /api/ml/me - Dados do usuário ML (teste de vida)
 * - GET /api/ml/search - Buscar produtos
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { getMlConnection, mlApiRequest } from '../lib/mercadolivre';

export async function mlRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/ml/connection
   * Retorna status da conexão sem expor tokens
   */
  fastify.get('/connection', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const connection = await getMlConnection();

      if (!connection) {
        return reply.status(200).send({
          connected: false,
          message: 'Nenhuma conta do Mercado Livre conectada',
        });
      }

      // Verificar se token está próximo de expirar
      const now = new Date();
      const expiresIn = Math.floor((connection.expiresAt.getTime() - now.getTime()) / 1000);
      const isExpiringSoon = expiresIn < 300; // Menos de 5 minutos

      return reply.status(200).send({
        connected: true,
        mlUserId: connection.mlUserId,
        mlNickname: connection.mlNickname,
        mlEmail: connection.mlEmail,
        isActive: connection.isActive,
        expiresAt: connection.expiresAt,
        expiresIn, // segundos até expirar
        isExpiringSoon,
        lastUsedAt: connection.lastUsedAt,
        lastRefreshAt: connection.lastRefreshAt,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
        // NUNCA retornar: accessToken, refreshToken
      });
    } catch (error: any) {
      console.error('Erro ao buscar conexão ML:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro ao buscar status da conexão',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/ml/me
   * Teste de vida - Busca dados do usuário no Mercado Livre
   * Valida que o token funciona e renova automaticamente se necessário
   */
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const connection = await getMlConnection();

      if (!connection) {
        return reply.status(400).send({
          success: false,
          error: 'Mercado Livre não conectado',
          message: 'Execute o fluxo OAuth primeiro: /api/auth/mercadolivre/login',
        });
      }

      // Faz request autenticado (renova token automaticamente se necessário)
      const userData = await mlApiRequest('/users/me');

      return reply.status(200).send({
        success: true,
        data: {
          id: userData.id,
          nickname: userData.nickname,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          country_id: userData.country_id,
          site_id: userData.site_id,
          permalink: userData.permalink,
          seller_reputation: userData.seller_reputation,
          buyer_reputation: userData.buyer_reputation,
        },
        _meta: {
          mlUserId: connection.mlUserId,
          tokenExpiresAt: connection.expiresAt,
        },
      });
    } catch (error: any) {
      console.error('Erro ao buscar /users/me do ML:', error);

      if (error.message.includes('não conectado')) {
        return reply.status(400).send({
          success: false,
          error: 'Não conectado',
          message: error.message,
        });
      }

      if (error.message.includes('Falha ao renovar token')) {
        return reply.status(401).send({
          success: false,
          error: 'Token inválido',
          message: 'Falha ao renovar token. Reconecte a conta.',
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Erro ao buscar dados do usuário',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/ml/search
   * Busca produtos no Mercado Livre usando o token válido
   * 
   * Query params:
   * - query (required): Termo de busca
   * - limit (optional): Limite de resultados (padrão: 10, máx: 50)
   * - offset (optional): Offset para paginação (padrão: 0)
   */
  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { query, limit = 10, offset = 0 } = request.query as {
      query?: string;
      limit?: number;
      offset?: number;
    };

    if (!query || query.trim() === '') {
      return reply.status(400).send({
        success: false,
        error: 'Parâmetro "query" é obrigatório',
        example: '/api/ml/search?query=iphone',
      });
    }

    try {
      // Verificar se tem conexão
      const connection = await getMlConnection();

      if (!connection) {
        return reply.status(400).send({
          success: false,
          error: 'Mercado Livre não conectado',
          message: 'Execute o fluxo OAuth primeiro: /api/auth/mercadolivre/login',
        });
      }

      // Buscar produtos usando token (ML exige autenticação para algumas buscas)
      const searchResult = await mlApiRequest('/sites/MLB/search', {
        params: {
          q: query,
          limit: Math.min(Number(limit), 50), // Máximo 50
          offset: Number(offset),
        },
      });

      // Normalizar resposta
      const items = (searchResult.results || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        original_price: item.original_price,
        currency_id: item.currency_id,
        available_quantity: item.available_quantity,
        sold_quantity: item.sold_quantity,
        condition: item.condition,
        thumbnail: item.thumbnail,
        permalink: item.permalink,
        seller: {
          id: item.seller?.id,
          nickname: item.seller?.nickname,
        },
        shipping: {
          free_shipping: item.shipping?.free_shipping,
        },
      }));

      return reply.status(200).send({
        success: true,
        query,
        total: searchResult.paging?.total || 0,
        limit: searchResult.paging?.limit || limit,
        offset: searchResult.paging?.offset || offset,
        items,
        _meta: {
          mlUserId: connection.mlUserId,
          site_id: searchResult.site_id,
        },
      });
    } catch (error: any) {
      console.error('Erro ao buscar produtos no ML:', error);

      if (error.message.includes('não conectado')) {
        return reply.status(400).send({
          success: false,
          error: 'Não conectado',
          message: error.message,
        });
      }

      if (error.message.includes('Falha ao renovar token')) {
        return reply.status(401).send({
          success: false,
          error: 'Token inválido',
          message: 'Falha ao renovar token. Reconecte a conta.',
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Erro ao buscar produtos',
        message: error.message,
      });
    }
  });
}
