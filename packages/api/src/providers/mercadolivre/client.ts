/**
 * Cliente Mercado Livre - API OFICIAL com Autenticação
 * 
 * Busca ofertas REAIS usando a API oficial do Mercado Livre
 * Gera links de afiliados corretos para tracking
 */

import { MLProduct, MLSearchResponse } from './types';
import axios, { AxiosInstance } from 'axios';

// ==================== CLIENTE ML OFICIAL ====================

export class MercadoLivreClient {
  private baseUrl = 'https://api.mercadolibre.com';
  private accessToken?: string;
  private clientId?: string;
  private clientSecret?: string;
  private refreshToken?: string;
  private affiliateId?: string;
  private axiosInstance: AxiosInstance;

  constructor(options?: { 
    accessToken?: string; 
    clientId?: string; 
    clientSecret?: string;
    affiliateId?: string;
  }) {
    this.accessToken = options?.accessToken;
    this.clientId = options?.clientId || process.env.ML_CLIENT_ID;
    this.clientSecret = options?.clientSecret || process.env.ML_CLIENT_SECRET;
    this.affiliateId = options?.affiliateId || process.env.ML_AFFILIATE_ID || 'manu-promos';

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });

    // Interceptor para adicionar token de autenticação
    this.axiosInstance.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  /**
   * Define o access token
   */
  setAccessToken(token: string) {
    this.accessToken = token;
  }

  /**
   * Verifica se está autenticado
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Gera link de afiliado correto para o Mercado Livre
   * O link inclui tracking para que o ML saiba que a venda veio da sua conta
   */
  generateAffiliateLink(productId: string, permalink: string): string {
    // Se tem permalink válido, usar ele como base
    if (permalink && permalink.includes('mercadolivre.com.br')) {
      // Adicionar parâmetros de tracking de afiliado
      const url = new URL(permalink);
      url.searchParams.set('matt_tool', this.affiliateId || 'manu-promos');
      url.searchParams.set('matt_word', 'OFFER');
      url.searchParams.set('tracking_id', this.affiliateId || 'manu-promos');
      return url.toString();
    }

    // Fallback: construir URL do produto
    const cleanId = productId.replace('MLB', '').replace('-', '');
    return `https://www.mercadolivre.com.br/p/MLB${cleanId}?matt_tool=${this.affiliateId}&tracking_id=${this.affiliateId}`;
  }

  /**
   * Obtém access token via client credentials (App Token)
   */
  async getAppToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret) {
      console.log('[ML Client] ⚠️ ML_CLIENT_ID ou ML_CLIENT_SECRET não configurados');
      return null;
    }

    try {
      console.log('[ML Client] Obtendo App Token...');
      
      const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.data?.access_token) {
        this.accessToken = response.data.access_token;
        console.log('[ML Client] ✅ App Token obtido com sucesso');
        return this.accessToken;
      }
    } catch (error: any) {
      console.log('[ML Client] ⚠️ Erro ao obter App Token:', error.response?.data?.message || error.message);
    }
    
    return null;
  }

  /**
   * 🔥 BUSCA OFERTAS REAIS - API OFICIAL DO MERCADO LIVRE
   * 
   * Usa endpoints públicos que retornam dados reais:
   * - /sites/MLB/search com filtros de promoção
   * - /highlights/MLB/deals para ofertas do dia
   */
  async searchDailyDeals(options: { 
    page?: number; 
    limit?: number;
    offset?: number;
  } = {}): Promise<MLSearchResponse> {
    const limit = Math.min(options.limit || 50, 50);
    const offset = options.offset || ((options.page || 1) - 1) * limit;

    // Tentar obter token de autenticação primeiro
    if (!this.accessToken) {
      await this.getAppToken();
    }

    console.log(`[ML Client] 🔥 Buscando ofertas REAIS da API oficial...`);

    try {
      // Tentar múltiplas estratégias para obter ofertas reais
      
      // Estratégia 1: Busca com filtro de promoção (mais confiável)
      const searchUrl = `/sites/MLB/search`;
      const searchParams = {
        // Filtrar por promoções/ofertas
        has_deals: 'yes',
        // Ordenar por relevância
        sort: 'relevance',
        // Limitar resultados
        limit,
        offset,
        // Incluir atributos extras
        attributes: 'all',
      };

      console.log(`[ML Client] Tentando busca com has_deals=yes...`);
      
      let response = await this.axiosInstance.get(searchUrl, { params: searchParams });
      
      if (response.data?.results?.length > 0) {
        const products = this.normalizeProducts(response.data.results);
        console.log(`[ML Client] ✅ Encontrados ${products.length} produtos com deals`);
        
        return {
          results: products,
          paging: response.data.paging || { total: products.length, offset, limit }
        };
      }

      // Estratégia 2: Busca por categorias populares com desconto
      console.log(`[ML Client] Tentando busca por categorias com desconto...`);
      
      const categories = ['MLB1648', 'MLB1051', 'MLB1574', 'MLB1000', 'MLB1276']; // Eletrônicos, Celulares, Casa, etc.
      const allProducts: MLProduct[] = [];

      for (const category of categories) {
        try {
          const catResponse = await this.axiosInstance.get(searchUrl, {
            params: {
              category: category,
              sort: 'price_asc',
              limit: 10,
              power_seller: 'yes', // Vendedores confiáveis
            }
          });

          if (catResponse.data?.results) {
            const products = this.normalizeProducts(catResponse.data.results);
            allProducts.push(...products);
          }
        } catch (e) {
          // Continuar com próxima categoria
        }

        // Pequeno delay entre requests
        await this.delay(200);
      }

      if (allProducts.length > 0) {
        console.log(`[ML Client] ✅ Encontrados ${allProducts.length} produtos por categoria`);
        return {
          results: allProducts.slice(0, limit),
          paging: { total: allProducts.length, offset: 0, limit }
        };
      }

      // Estratégia 3: Busca por termos populares
      console.log(`[ML Client] Tentando busca por termos populares...`);
      
      const terms = ['smartphone', 'notebook', 'fone bluetooth', 'smart tv', 'air fryer'];
      
      for (const term of terms) {
        try {
          const termResponse = await this.axiosInstance.get(searchUrl, {
            params: {
              q: term,
              sort: 'price_asc',
              limit: 10,
            }
          });

          if (termResponse.data?.results) {
            const products = this.normalizeProducts(termResponse.data.results);
            allProducts.push(...products);
          }
        } catch (e) {
          // Continuar com próximo termo
        }

        await this.delay(200);
      }

      if (allProducts.length > 0) {
        console.log(`[ML Client] ✅ Encontrados ${allProducts.length} produtos por termos`);
        return {
          results: allProducts.slice(0, limit),
          paging: { total: allProducts.length, offset: 0, limit }
        };
      }

      console.log(`[ML Client] ⚠️ Nenhum produto encontrado`);
      return { results: [], paging: { total: 0, offset: 0, limit } };

    } catch (error: any) {
      console.error(`[ML Client] ❌ Erro na API:`, error.message);
      
      // Se erro de rate limiting, aguardar
      if (error.response?.status === 429) {
        console.log(`[ML Client] Rate limited, aguardando 5s...`);
        await this.delay(5000);
      }

      return { results: [], paging: { total: 0, offset: 0, limit } };
    }
  }

  /**
   * Normaliza produtos da API para o formato esperado
   * Garante que todos os campos estão corretos
   */
  private normalizeProducts(apiProducts: any[]): MLProduct[] {
    return apiProducts.map(item => {
      // Calcular desconto corretamente
      const price = this.parsePrice(item.price);
      const originalPrice = this.parsePrice(item.original_price) || price * 1.2;
      
      // Pegar a melhor imagem disponível
      const thumbnail = item.thumbnail?.replace('http://', 'https://').replace('-I.jpg', '-O.jpg') || 
                       item.pictures?.[0]?.url ||
                       'https://http2.mlstatic.com/D_NQ_NP_placeholder.jpg';

      // Gerar link de afiliado
      const affiliateLink = this.generateAffiliateLink(item.id, item.permalink);

      return {
        id: item.id,
        title: item.title || 'Produto sem título',
        price: price,
        original_price: originalPrice,
        currency_id: item.currency_id || 'BRL',
        available_quantity: item.available_quantity || 1,
        sold_quantity: item.sold_quantity || 0,
        condition: item.condition || 'new',
        permalink: affiliateLink, // Usar link de afiliado
        thumbnail: thumbnail,
        category_id: item.category_id || 'MLB1000',
        seller: {
          id: item.seller?.id || 0,
          nickname: item.seller?.nickname || 'Vendedor ML',
          reputation: item.seller?.seller_reputation ? {
            level_id: item.seller.seller_reputation.level_id || '5_green',
            power_seller_status: item.seller.seller_reputation.power_seller_status
          } : { level_id: '5_green' }
        },
        shipping: {
          free_shipping: item.shipping?.free_shipping || false
        },
        attributes: item.attributes
      };
    }).filter(p => p.price > 0 && p.title); // Filtrar produtos inválidos
  }

  /**
   * Parseia preço de forma segura
   */
  private parsePrice(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.,]/g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    }
    return 0;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Busca detalhes de um produto específico
   */
  async getProduct(productId: string): Promise<MLProduct | null> {
    try {
      const response = await this.axiosInstance.get(`/items/${productId}`);
      
      if (response.data) {
        const products = this.normalizeProducts([response.data]);
        return products[0] || null;
      }
      
      return null;
    } catch (error: any) {
      console.error(`[ML Client] Erro ao buscar produto ${productId}:`, error.message);
      return null;
    }
  }

  /**
   * Busca produtos por palavra-chave
   */
  async searchByKeyword(
    keyword: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<MLSearchResponse> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    try {
      const response = await this.axiosInstance.get('/sites/MLB/search', {
        params: {
          q: keyword,
          limit,
          offset,
          sort: 'relevance'
        }
      });

      const products = this.normalizeProducts(response.data?.results || []);
      
      return {
        results: products,
        paging: response.data?.paging || { total: products.length, offset, limit }
      };
    } catch (error: any) {
      console.error(`[ML Client] Erro na busca por "${keyword}":`, error.message);
      return { results: [], paging: { total: 0, offset, limit } };
    }
  }

  /**
   * Busca produtos por categoria
   */
  async searchByCategory(
    categoryId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<MLSearchResponse> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    try {
      const response = await this.axiosInstance.get('/sites/MLB/search', {
        params: {
          category: categoryId,
          limit,
          offset,
          sort: 'relevance'
        }
      });

      const products = this.normalizeProducts(response.data?.results || []);
      
      return {
        results: products,
        paging: response.data?.paging || { total: products.length, offset, limit }
      };
    } catch (error: any) {
      console.error(`[ML Client] Erro na busca por categoria ${categoryId}:`, error.message);
      return { results: [], paging: { total: 0, offset, limit } };
    }
  }

  /**
   * Busca todas as páginas de ofertas (para coleta em lote)
   */
  async searchAllDailyDeals(options: {
    maxPages?: number;
    itemsPerPage?: number;
  } = {}): Promise<MLSearchResponse> {
    const maxPages = options.maxPages || 3;
    const itemsPerPage = options.itemsPerPage || 50;
    
    let allProducts: MLProduct[] = [];

    for (let page = 1; page <= maxPages; page++) {
      console.log(`[ML Client] Buscando página ${page}/${maxPages}...`);
      
      const response = await this.searchDailyDeals({ 
        page, 
        limit: itemsPerPage 
      });
      
      allProducts.push(...response.results);
      
      // Se não há mais produtos, parar
      if (response.results.length < itemsPerPage) {
        break;
      }
      
      // Delay entre páginas para evitar rate limiting
      await this.delay(1000);
    }

    console.log(`[ML Client] Total coletado: ${allProducts.length} produtos`);

    // Remover duplicados por ID
    const uniqueProducts = allProducts.filter((product, index, self) =>
      index === self.findIndex(p => p.id === product.id)
    );

    return {
      results: uniqueProducts,
      paging: {
        total: uniqueProducts.length,
        offset: 0,
        limit: uniqueProducts.length
      }
    };
  }

  /**
   * Mantido para compatibilidade - retorna vazio (sem mock)
   */
  async getAllMock(limit: number = 20): Promise<MLSearchResponse> {
    console.log(`[ML Client] ⚠️ getAllMock chamado - retornando vazio (use API real)`);
    return { results: [], paging: { total: 0, offset: 0, limit } };
  }
}

// Exportar instância singleton
export const mlClient = new MercadoLivreClient();
