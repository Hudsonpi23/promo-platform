/**
 * Mercado Livre Scraper - Usando Playwright
 * 
 * Busca ofertas do Mercado Livre simulando navegação real
 * Microsoft Playwright - https://playwright.dev
 */

import { chromium, Browser, Page } from 'playwright';

export interface ScrapedOffer {
  title: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  imageUrl: string;
  productUrl: string;
  storeName?: string;
}

export interface ScraperResult {
  success: boolean;
  offers: ScrapedOffer[];
  error?: string;
  scrapedAt: Date;
}

/**
 * Scraper do Mercado Livre usando Playwright
 */
export class MercadoLivreScraper {
  private browser: Browser | null = null;
  
  /**
   * Inicializa o navegador
   */
  async init(): Promise<void> {
    console.log('[Scraper] Iniciando navegador Chromium...');
    this.browser = await chromium.launch({
      headless: true, // Invisível (sem janela)
    });
    console.log('[Scraper] Navegador iniciado!');
  }
  
  /**
   * Fecha o navegador
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[Scraper] Navegador fechado.');
    }
  }
  
  /**
   * Busca ofertas na página de ofertas do ML
   */
  async scrapeOffers(maxOffers: number = 10): Promise<ScraperResult> {
    if (!this.browser) {
      await this.init();
    }
    
    const page = await this.browser!.newPage();
    
    try {
      console.log('[Scraper] Acessando página de ofertas do ML...');
      
      // Configurar user agent para parecer navegador real
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      });
      
      // Acessar página de ofertas
      await page.goto('https://www.mercadolivre.com.br/ofertas', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      
      console.log('[Scraper] Página carregada, aguardando elementos...');
      
      // Aguardar lista de produtos carregar
      await page.waitForSelector('.promotion-item', { timeout: 10000 }).catch(() => {
        console.log('[Scraper] Seletor .promotion-item não encontrado, tentando alternativo...');
      });
      
      // Extrair ofertas
      const offers = await page.evaluate((max) => {
        const items: any[] = [];
        
        // Tentar múltiplos seletores (ML muda frequentemente)
        const selectors = [
          '.promotion-item',
          '.andes-card',
          '[data-testid="promotion-item"]',
          '.ui-search-result',
          '.poly-card',
        ];
        
        let elements: NodeListOf<Element> | null = null;
        
        for (const selector of selectors) {
          const found = document.querySelectorAll(selector);
          if (found.length > 0) {
            elements = found;
            break;
          }
        }
        
        if (!elements || elements.length === 0) {
          return items;
        }
        
        elements.forEach((el, index) => {
          if (index >= max) return;
          
          try {
            // Extrair título
            const titleEl = el.querySelector('.promotion-item__title, .ui-search-item__title, .poly-component__title, h2, h3');
            const title = titleEl?.textContent?.trim() || '';
            
            // Extrair preço atual
            const priceEl = el.querySelector('.andes-money-amount__fraction, .price__fraction, .promotion-item__price');
            const priceText = priceEl?.textContent?.replace(/\D/g, '') || '0';
            const price = parseInt(priceText) || 0;
            
            // Extrair preço antigo
            const oldPriceEl = el.querySelector('.andes-money-amount--previous .andes-money-amount__fraction, .promotion-item__oldprice');
            const oldPriceText = oldPriceEl?.textContent?.replace(/\D/g, '') || '0';
            const oldPrice = parseInt(oldPriceText) || 0;
            
            // Extrair desconto
            const discountEl = el.querySelector('.promotion-item__discount-text, .andes-tag__label, .ui-search-price__discount');
            const discountText = discountEl?.textContent?.replace(/\D/g, '') || '0';
            const discount = parseInt(discountText) || 0;
            
            // Extrair imagem
            const imgEl = el.querySelector('img');
            const imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';
            
            // Extrair link
            const linkEl = el.querySelector('a');
            const productUrl = linkEl?.getAttribute('href') || '';
            
            if (title && price > 0 && imageUrl) {
              items.push({
                title,
                price,
                oldPrice: oldPrice > price ? oldPrice : undefined,
                discount: discount > 0 ? discount : undefined,
                imageUrl: imageUrl.replace(/\-I\.webp$/, '-O.webp'), // Pegar imagem maior
                productUrl,
              });
            }
          } catch (e) {
            // Ignorar erros de extração individual
          }
        });
        
        return items;
      }, maxOffers);
      
      console.log(`[Scraper] Extraídas ${offers.length} ofertas`);
      
      await page.close();
      
      return {
        success: true,
        offers,
        scrapedAt: new Date(),
      };
      
    } catch (error: any) {
      console.error('[Scraper] Erro:', error.message);
      await page.close();
      
      return {
        success: false,
        offers: [],
        error: error.message,
        scrapedAt: new Date(),
      };
    }
  }
  
  /**
   * Busca ofertas por termo de pesquisa
   */
  async searchOffers(query: string, maxOffers: number = 10): Promise<ScraperResult> {
    if (!this.browser) {
      await this.init();
    }
    
    const page = await this.browser!.newPage();
    
    try {
      console.log(`[Scraper] Buscando: "${query}"...`);
      
      // Acessar página de busca
      const searchUrl = `https://lista.mercadolivre.com.br/${encodeURIComponent(query)}`;
      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      
      // Aguardar resultados
      await page.waitForSelector('.ui-search-result, .poly-card', { timeout: 10000 }).catch(() => {});
      
      // Extrair ofertas
      const offers = await page.evaluate((max) => {
        const items: any[] = [];
        const elements = document.querySelectorAll('.ui-search-result, .poly-card');
        
        elements.forEach((el, index) => {
          if (index >= max) return;
          
          try {
            const titleEl = el.querySelector('.ui-search-item__title, .poly-component__title');
            const title = titleEl?.textContent?.trim() || '';
            
            const priceEl = el.querySelector('.andes-money-amount__fraction');
            const priceText = priceEl?.textContent?.replace(/\D/g, '') || '0';
            const price = parseInt(priceText) || 0;
            
            const oldPriceEl = el.querySelector('.andes-money-amount--previous .andes-money-amount__fraction');
            const oldPriceText = oldPriceEl?.textContent?.replace(/\D/g, '') || '0';
            const oldPrice = parseInt(oldPriceText) || 0;
            
            const discountEl = el.querySelector('.ui-search-price__discount, .andes-tag__label');
            const discountText = discountEl?.textContent?.replace(/\D/g, '') || '0';
            const discount = parseInt(discountText) || 0;
            
            const imgEl = el.querySelector('img');
            const imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';
            
            const linkEl = el.querySelector('a');
            const productUrl = linkEl?.getAttribute('href') || '';
            
            if (title && price > 0) {
              items.push({
                title,
                price,
                oldPrice: oldPrice > price ? oldPrice : undefined,
                discount: discount > 0 ? discount : undefined,
                imageUrl,
                productUrl,
              });
            }
          } catch (e) {}
        });
        
        return items;
      }, maxOffers);
      
      console.log(`[Scraper] Encontradas ${offers.length} ofertas para "${query}"`);
      
      await page.close();
      
      return {
        success: true,
        offers,
        scrapedAt: new Date(),
      };
      
    } catch (error: any) {
      console.error('[Scraper] Erro:', error.message);
      await page.close();
      
      return {
        success: false,
        offers: [],
        error: error.message,
        scrapedAt: new Date(),
      };
    }
  }
}

/**
 * Instância singleton do scraper
 */
let scraperInstance: MercadoLivreScraper | null = null;

export async function getScraper(): Promise<MercadoLivreScraper> {
  if (!scraperInstance) {
    scraperInstance = new MercadoLivreScraper();
    await scraperInstance.init();
  }
  return scraperInstance;
}

export async function closeScraper(): Promise<void> {
  if (scraperInstance) {
    await scraperInstance.close();
    scraperInstance = null;
  }
}
