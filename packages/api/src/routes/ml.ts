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
import { HttpsProxyAgent } from 'https-proxy-agent';
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
   * GET /api/ml/public-search
   * Busca produtos no Mercado Livre usando API PÚBLICA (sem OAuth)
   * 
   * ⚠️ ARQUITETURA CORRETA:
   * - API pública ML: buscar produtos (SEM token)
   * - OAuth ML: apenas para links afiliados, tracking, identidade
   * 
   * 🚨 LIMITAÇÃO ATUAL:
   * - ML bloqueia requisições de certos IPs/regiões (erro 403)
   * - Solução: usar em ambiente com IP diferente (Render) ou scraping alternativo
   * 
   * Query params:
   * - query (required): Termo de busca
   * - limit (optional): Limite de resultados (padrão: 10, máx: 50)
   * - offset (optional): Offset para paginação (padrão: 0)
   * - category (optional): ID da categoria
   * - sort (optional): Ordenação (price_asc, price_desc, relevance)
   */
  fastify.get('/public-search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { query, limit = 10, offset = 0, category, sort } = request.query as {
      query?: string;
      limit?: number;
      offset?: number;
      category?: string;
      sort?: string;
    };

    if (!query || query.trim() === '') {
      return reply.status(400).send({
        success: false,
        error: 'Parâmetro "query" é obrigatório',
        example: '/api/ml/public-search?query=iphone',
      });
    }

    try {
      // Buscar produtos via API PÚBLICA
      const params: any = {
        q: query,
        limit: Math.min(Number(limit), 50), // Máximo 50
        offset: Number(offset),
      };

      if (category) params.category = category;
      if (sort) params.sort = sort;

      // Configurar proxy residencial (se disponível)
      const axiosConfig: any = {
        params,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 15000, // 15s timeout
      };

      // Suporte a proxy residencial (via env)
      console.log(`[DEBUG] PROXY_URL env: ${process.env.PROXY_URL ? 'EXISTE' : 'VAZIO'}`);
      
      if (process.env.PROXY_URL) {
        try {
          // Usar HttpsProxyAgent para autenticação correta
          const proxyAgent = new HttpsProxyAgent(process.env.PROXY_URL, {
            rejectUnauthorized: false, // Permite certificados self-signed do proxy
          });
          
          axiosConfig.httpsAgent = proxyAgent;
          axiosConfig.proxy = false; // Desabilitar config padrão do axios
          
          const proxyUrl = new URL(process.env.PROXY_URL);
          console.log(`🌐 Usando proxy: ${proxyUrl.hostname}:${proxyUrl.port}`);
          console.log(`[DEBUG] HttpsProxyAgent configurado`);
        } catch (proxyError: any) {
          console.error(`❌ Erro ao configurar proxy: ${proxyError.message}`);
          return reply.status(500).send({
            success: false,
            error: 'Erro ao configurar proxy',
            message: proxyError.message,
          });
        }
      } else {
        console.log(`⚠️  PROXY_URL não configurado - fazendo requisição direta (pode dar 403)`);
      }

      console.log(`[DEBUG] Fazendo requisição para ML com config:`, {
        hasProxy: !!axiosConfig.proxy,
        proxyHost: axiosConfig.proxy?.host,
        timeout: axiosConfig.timeout,
      });

      const searchResult = await axios.get('https://api.mercadolibre.com/sites/MLB/search', axiosConfig).then((res: any) => res.data);

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
          site_id: searchResult.site_id,
          api_type: 'public',
          note: 'API pública ML - não requer OAuth',
        },
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar produtos no ML (API pública):', error.message);
      console.error('[DEBUG] Error code:', error.code);
      console.error('[DEBUG] Error response status:', error.response?.status);
      console.error('[DEBUG] Error response data:', error.response?.data);
      console.error('[DEBUG] Full error:', JSON.stringify({
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
      }, null, 2));

      // Timeout
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return reply.status(504).send({
          success: false,
          error: 'Timeout',
          message: 'ML ou proxy demoraram muito para responder. Tente novamente.',
          errorCode: error.code,
        });
      }

      // Conexão recusada (proxy não acessível)
      if (error.code === 'ECONNREFUSED') {
        return reply.status(500).send({
          success: false,
          error: 'Proxy não acessível',
          message: 'Não foi possível conectar ao proxy. Verifique as credenciais e URL.',
          errorCode: error.code,
        });
      }

      // Host não encontrado (DNS)
      if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
        return reply.status(500).send({
          success: false,
          error: 'Host não encontrado',
          message: 'Não foi possível resolver o host do proxy ou ML.',
          errorCode: error.code,
        });
      }

      // Rate limit
      if (error.response?.status === 429) {
        return reply.status(429).send({
          success: false,
          error: 'Rate limit',
          message: 'Muitas requisições. Aguarde alguns segundos.',
        });
      }

      // 403 Forbidden
      if (error.response?.status === 403) {
        return reply.status(403).send({
          success: false,
          error: 'Acesso bloqueado',
          message: 'ML bloqueou a requisição. IP ou proxy detectado.',
        });
      }

      // Erro genérico
      return reply.status(500).send({
        success: false,
        error: 'Erro ao buscar produtos',
        message: error.response?.data?.message || error.message,
        errorCode: error.code,
        statusCode: error.response?.status,
        hint: 'Verifique os logs do servidor para mais detalhes.',
      });
    }
  });
}
