/**
 * Cliente Mercado Livre
 * 
 * Atualmente usa mock data para desenvolvimento.
 * Estruturado para plugar a API real do ML quando disponível.
 */

import { MLProduct, MLSearchResponse } from './types';

// ==================== MOCK DATA ====================

const MOCK_PRODUCTS: MLProduct[] = [
  // Eletrônicos
  {
    id: 'MLB1234567890',
    title: 'iPhone 14 Pro Max 256GB Roxo Profundo',
    price: 5999,
    original_price: 8999,
    currency_id: 'BRL',
    available_quantity: 15,
    sold_quantity: 234,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/iphone-14-pro-max',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_iphone14.jpg',
    category_id: 'MLB1055',
    seller: {
      id: 123456,
      nickname: 'TECHSTORE_OFICIAL',
      reputation: { level_id: '5_green', power_seller_status: 'platinum' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB1234567891',
    title: 'Samsung Galaxy S24 Ultra 512GB Titanium Black',
    price: 4799,
    original_price: 7499,
    currency_id: 'BRL',
    available_quantity: 8,
    sold_quantity: 156,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/samsung-s24-ultra',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_samsung_s24.jpg',
    category_id: 'MLB1055',
    seller: {
      id: 234567,
      nickname: 'SAMSUNG_STORE',
      reputation: { level_id: '5_green', power_seller_status: 'platinum' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB1234567892',
    title: 'Notebook Dell Inspiron 15 i7 16GB RAM 512GB SSD',
    price: 3299,
    original_price: 4999,
    currency_id: 'BRL',
    available_quantity: 12,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/dell-inspiron-15',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_dell_notebook.jpg',
    category_id: 'MLB1648',
    seller: {
      id: 345678,
      nickname: 'DELL_OFICIAL',
      reputation: { level_id: '5_green' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB1234567893',
    title: 'Smart TV LG 55" 4K OLED C3 120Hz Gaming',
    price: 4199,
    original_price: 6999,
    currency_id: 'BRL',
    available_quantity: 5,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/lg-oled-c3',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_lg_oled.jpg',
    category_id: 'MLB1002',
    seller: {
      id: 456789,
      nickname: 'LG_STORE',
      reputation: { level_id: '5_green', power_seller_status: 'gold' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB1234567894',
    title: 'AirPods Pro 2ª Geração com Estojo MagSafe',
    price: 1499,
    original_price: 2399,
    currency_id: 'BRL',
    available_quantity: 45,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/airpods-pro-2',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_airpods.jpg',
    category_id: 'MLB1055',
    seller: {
      id: 567890,
      nickname: 'APPLE_RESELLER',
      reputation: { level_id: '5_green' }
    },
    shipping: { free_shipping: true }
  },
  // Moda
  {
    id: 'MLB2234567890',
    title: 'Tênis Nike Air Max 90 Essential Masculino',
    price: 449,
    original_price: 799,
    currency_id: 'BRL',
    available_quantity: 23,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/nike-air-max-90',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_nike_airmax.jpg',
    category_id: 'MLB3530',
    seller: {
      id: 678901,
      nickname: 'NIKE_OFICIAL',
      reputation: { level_id: '5_green', power_seller_status: 'platinum' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB2234567891',
    title: 'Tênis Adidas Ultraboost 23 Running',
    price: 599,
    original_price: 999,
    currency_id: 'BRL',
    available_quantity: 18,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/adidas-ultraboost',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_adidas_ub.jpg',
    category_id: 'MLB3530',
    seller: {
      id: 789012,
      nickname: 'ADIDAS_STORE',
      reputation: { level_id: '5_green' }
    },
    shipping: { free_shipping: true }
  },
  // Casa
  {
    id: 'MLB3234567890',
    title: 'Air Fryer Philips Walita 4.1L Digital XXL',
    price: 349,
    original_price: 699,
    currency_id: 'BRL',
    available_quantity: 67,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/philips-airfryer',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_airfryer.jpg',
    category_id: 'MLB1574',
    seller: {
      id: 890123,
      nickname: 'PHILIPS_OFICIAL',
      reputation: { level_id: '5_green', power_seller_status: 'platinum' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB3234567891',
    title: 'Robô Aspirador iRobot Roomba i7+ Mapeamento',
    price: 2999,
    original_price: 4999,
    currency_id: 'BRL',
    available_quantity: 9,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/irobot-roomba-i7',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_roomba.jpg',
    category_id: 'MLB1574',
    seller: {
      id: 901234,
      nickname: 'IROBOT_BRASIL',
      reputation: { level_id: '5_green' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB3234567892',
    title: 'Cafeteira Nespresso Vertuo Next Preta',
    price: 599,
    original_price: 999,
    currency_id: 'BRL',
    available_quantity: 34,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/nespresso-vertuo',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_nespresso.jpg',
    category_id: 'MLB1574',
    seller: {
      id: 111234,
      nickname: 'NESPRESSO_BR',
      reputation: { level_id: '5_green', power_seller_status: 'gold' }
    },
    shipping: { free_shipping: true }
  },
  // Games
  {
    id: 'MLB4234567890',
    title: 'PlayStation 5 Slim Digital Edition 1TB',
    price: 3199,
    original_price: 4499,
    currency_id: 'BRL',
    available_quantity: 7,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/ps5-slim-digital',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_ps5_slim.jpg',
    category_id: 'MLB1144',
    seller: {
      id: 121234,
      nickname: 'PLAYSTATION_BR',
      reputation: { level_id: '5_green', power_seller_status: 'platinum' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB4234567891',
    title: 'Xbox Series X 1TB + Game Pass Ultimate 3 Meses',
    price: 3499,
    original_price: 4999,
    currency_id: 'BRL',
    available_quantity: 11,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/xbox-series-x',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_xbox_x.jpg',
    category_id: 'MLB1144',
    seller: {
      id: 131234,
      nickname: 'MICROSOFT_STORE',
      reputation: { level_id: '5_green' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB4234567892',
    title: 'Nintendo Switch OLED Branco 64GB',
    price: 2199,
    original_price: 2999,
    currency_id: 'BRL',
    available_quantity: 19,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/switch-oled',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_switch_oled.jpg',
    category_id: 'MLB1144',
    seller: {
      id: 141234,
      nickname: 'NINTENDO_OFICIAL',
      reputation: { level_id: '5_green', power_seller_status: 'gold' }
    },
    shipping: { free_shipping: true }
  },
  // Beleza
  {
    id: 'MLB5234567890',
    title: 'Dyson Airwrap Complete Styler Multi-uso',
    price: 2999,
    original_price: 4299,
    currency_id: 'BRL',
    available_quantity: 6,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/dyson-airwrap',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_dyson_airwrap.jpg',
    category_id: 'MLB1246',
    seller: {
      id: 151234,
      nickname: 'DYSON_BRASIL',
      reputation: { level_id: '5_green', power_seller_status: 'platinum' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB5234567891',
    title: 'Kit Maquiagem MAC Completo 15 Peças Profissional',
    price: 399,
    original_price: 799,
    currency_id: 'BRL',
    available_quantity: 42,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/kit-mac-completo',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_mac_kit.jpg',
    category_id: 'MLB1246',
    seller: {
      id: 161234,
      nickname: 'MAC_COSMETICS',
      reputation: { level_id: '5_green' }
    },
    shipping: { free_shipping: true }
  },
  // Esportes
  {
    id: 'MLB6234567890',
    title: 'Esteira Elétrica Movement R5 16km/h Dobrável',
    price: 1999,
    original_price: 3499,
    currency_id: 'BRL',
    available_quantity: 14,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/esteira-movement',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_esteira.jpg',
    category_id: 'MLB1276',
    seller: {
      id: 171234,
      nickname: 'MOVEMENT_FITNESS',
      reputation: { level_id: '5_green', power_seller_status: 'gold' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB6234567891',
    title: 'Bicicleta Ergométrica Spinning Profissional',
    price: 1299,
    original_price: 2199,
    currency_id: 'BRL',
    available_quantity: 21,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/spinning-pro',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_spinning.jpg',
    category_id: 'MLB1276',
    seller: {
      id: 181234,
      nickname: 'FITNESS_STORE',
      reputation: { level_id: '4_light_green' }
    },
    shipping: { free_shipping: true }
  },
  // Mercado (Supermercado)
  {
    id: 'MLB7234567890',
    title: 'Whey Protein Isolado 2kg Growth Supplements',
    price: 189,
    original_price: 299,
    currency_id: 'BRL',
    available_quantity: 156,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/whey-growth',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_whey.jpg',
    category_id: 'MLB1196',
    seller: {
      id: 191234,
      nickname: 'GROWTH_OFICIAL',
      reputation: { level_id: '5_green', power_seller_status: 'platinum' }
    },
    shipping: { free_shipping: true }
  },
  {
    id: 'MLB7234567891',
    title: 'Kit 12 Cervejas Importadas Premium Europeias',
    price: 149,
    original_price: 249,
    currency_id: 'BRL',
    available_quantity: 89,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/kit-cervejas',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_cervejas.jpg',
    category_id: 'MLB1196',
    seller: {
      id: 201234,
      nickname: 'BEBIDAS_PREMIUM',
      reputation: { level_id: '5_green' }
    },
    shipping: { free_shipping: false }
  },
  {
    id: 'MLB7234567892',
    title: 'Cafeteira Tramontina Inox by Breville Express',
    price: 899,
    original_price: 1499,
    currency_id: 'BRL',
    available_quantity: 27,
    condition: 'new',
    permalink: 'https://www.mercadolivre.com.br/tramontina-express',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_tramontina.jpg',
    category_id: 'MLB1574',
    seller: {
      id: 211234,
      nickname: 'TRAMONTINA_STORE',
      reputation: { level_id: '5_green', power_seller_status: 'gold' }
    },
    shipping: { free_shipping: true }
  }
];

// ==================== CLIENT ====================

export class MercadoLivreClient {
  private baseUrl = 'https://api.mercadolibre.com';
  private accessToken?: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken;
  }

  /**
   * Busca produtos por palavra-chave
   * (MOCK: retorna dados fake filtrados)
   */
  async searchByKeyword(
    keyword: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<MLSearchResponse> {
    // TODO: Implementar chamada real à API do ML
    // const url = `${this.baseUrl}/sites/MLB/search?q=${encodeURIComponent(keyword)}&limit=${limit}`;
    
    // MOCK: Filtrar produtos pelo título
    const filtered = MOCK_PRODUCTS.filter(p => 
      p.title.toLowerCase().includes(keyword.toLowerCase())
    );
    
    return {
      results: filtered.slice(0, options.limit || 10),
      paging: {
        total: filtered.length,
        offset: options.offset || 0,
        limit: options.limit || 10
      }
    };
  }

  /**
   * Busca produtos por categoria
   * (MOCK: retorna dados fake filtrados)
   */
  async searchByCategory(
    categoryId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<MLSearchResponse> {
    // TODO: Implementar chamada real à API do ML
    // const url = `${this.baseUrl}/sites/MLB/search?category=${categoryId}&limit=${limit}`;
    
    // MOCK: Filtrar por categoria
    const filtered = MOCK_PRODUCTS.filter(p => p.category_id === categoryId);
    
    return {
      results: filtered.slice(0, options.limit || 10),
      paging: {
        total: filtered.length,
        offset: options.offset || 0,
        limit: options.limit || 10
      }
    };
  }

  /**
   * Busca todos os produtos mock (para desenvolvimento)
   */
  async getAllMock(limit: number = 20): Promise<MLSearchResponse> {
    return {
      results: MOCK_PRODUCTS.slice(0, limit),
      paging: {
        total: MOCK_PRODUCTS.length,
        offset: 0,
        limit
      }
    };
  }

  /**
   * Obtém detalhes de um produto específico
   */
  async getProduct(productId: string): Promise<MLProduct | null> {
    // TODO: Implementar chamada real à API do ML
    // const url = `${this.baseUrl}/items/${productId}`;
    
    return MOCK_PRODUCTS.find(p => p.id === productId) || null;
  }
}

// Exportar instância singleton
export const mlClient = new MercadoLivreClient();
