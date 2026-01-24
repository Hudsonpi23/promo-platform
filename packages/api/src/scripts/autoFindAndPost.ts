/**
 * Script para buscar automaticamente ofertas no Mercado Livre e postar
 * 
 * Fluxo:
 * 1. Abre o navegador (Playwright)
 * 2. Acessa página de ofertas do ML
 * 3. Extrai produto com desconto mínimo
 * 4. Converte para link de afiliado
 * 5. Posta no Twitter/X
 */

import { chromium } from 'playwright';

// Configurações de afiliado
const AFFILIATE_TAG = 'dh20260120130733';
const AFFILIATE_TOOL = '77551400';

interface ProductOffer {
  title: string;
  price: number;
  originalPrice: number | null;
  discount: number;
  imageUrl: string;
  productUrl: string;
  affiliateUrl: string;
}

/**
 * Busca ofertas no Mercado Livre com desconto mínimo
 */
async function findOfferWithDiscount(minDiscount: number = 20): Promise<ProductOffer | null> {
  console.log(`\n🔍 Buscando produto com ${minDiscount}%+ de desconto no Mercado Livre...\n`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    // Acessa página de ofertas do Mercado Livre
    console.log('🌐 Abrindo página de ofertas do Mercado Livre...');
    await page.goto('https://www.mercadolivre.com.br/ofertas', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    // Tira screenshot para debug
    await page.screenshot({ path: 'ml-ofertas.png' });
    console.log('📸 Screenshot salvo: ml-ofertas.png');
    
    // Busca cards de produtos
    console.log('🔎 Procurando produtos com desconto...');
    
    // Tenta diferentes seletores
    const selectors = [
      '.promotion-item',
      '.andes-card',
      '[data-testid="result-item"]',
      '.ui-search-result',
      '.poly-card',
      'li.promotion-item',
      'a[href*="/MLB"]'
    ];
    
    let products: any[] = [];
    
    for (const selector of selectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`✅ Encontrados ${elements.length} elementos com seletor: ${selector}`);
        
        for (let i = 0; i < Math.min(elements.length, 20); i++) {
          try {
            const el = elements[i];
            
            // Tenta extrair informações
            const href = await el.getAttribute('href') || '';
            const text = await el.textContent() || '';
            
            // Procura por desconto no texto (ex: "33% OFF", "20% OFF") - só 2 dígitos
            const discountMatch = text.match(/(\d{1,2})%\s*(OFF|off|de desconto)/i);
            
            if (discountMatch) {
              const discount = parseInt(discountMatch[1]);
              
              // Ignora descontos irreais (mais de 90%)
              if (discount >= minDiscount && discount <= 90) {
                // Procura link do produto
                let productUrl = href;
                
                if (!productUrl.includes('/MLB') && !productUrl.includes('/p/')) {
                  const link = await el.locator('a[href*="/MLB"], a[href*="/p/"]').first();
                  productUrl = await link.getAttribute('href') || '';
                }
                
                if (productUrl) {
                  // Garante URL completa
                  if (!productUrl.startsWith('http')) {
                    productUrl = 'https://www.mercadolivre.com.br' + productUrl;
                  }
                  
                  products.push({
                    discount,
                    productUrl,
                    text: text.substring(0, 200)
                  });
                  
                  console.log(`  📦 Produto ${discount}% OFF: ${productUrl.substring(0, 80)}...`);
                }
              }
            }
          } catch (e) {
            // Ignora erros em elementos individuais
          }
        }
        
        if (products.length > 0) break;
      }
    }
    
    // Se não encontrou com seletores, tenta buscar links diretamente
    if (products.length === 0) {
      console.log('🔄 Tentando busca alternativa por links...');
      
      const allLinks = await page.locator('a[href*="mercadolivre.com.br"]').all();
      
      for (const link of allLinks.slice(0, 50)) {
        try {
          const href = await link.getAttribute('href') || '';
          const text = await link.textContent() || '';
          const parent = link.locator('..');
          const parentText = await parent.textContent() || '';
          
          const discountMatch = (text + parentText).match(/(\d{1,2})%\s*(OFF|off|de desconto)/i);
          
          if (discountMatch && (href.includes('/MLB') || href.includes('/p/'))) {
            const discount = parseInt(discountMatch[1]);
            
            // Ignora descontos irreais
            if (discount >= minDiscount && discount <= 90) {
              products.push({
                discount,
                productUrl: href,
                text: text.substring(0, 200)
              });
              
              console.log(`  📦 Produto ${discount}% OFF encontrado!`);
              break;
            }
          }
        } catch (e) {
          // Ignora
        }
      }
    }
    
    if (products.length === 0) {
      console.log('❌ Nenhum produto com desconto mínimo encontrado');
      console.log('🔄 Tentando página de ofertas do dia...');
      
      // Tenta outra página
      await page.goto('https://www.mercadolivre.com.br/ofertas#nav-header', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'ml-ofertas-2.png' });
      
      return null;
    }
    
    // Pega o produto com maior desconto
    const bestProduct = products.sort((a, b) => b.discount - a.discount)[0];
    console.log(`\n🏆 Melhor oferta: ${bestProduct.discount}% OFF`);
    console.log(`🔗 URL: ${bestProduct.productUrl}`);
    
    // Agora acessa a página do produto para extrair detalhes
    console.log('\n📄 Acessando página do produto para extrair detalhes...');
    await page.goto(bestProduct.productUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'ml-produto.png' });
    
    // Extrai título
    let title = '';
    const titleSelectors = ['h1.ui-pdp-title', '.ui-pdp-title', 'h1'];
    for (const sel of titleSelectors) {
      try {
        title = await page.locator(sel).first().textContent() || '';
        if (title) break;
      } catch (e) {}
    }
    
    // Extrai preço
    let price = 0;
    const priceSelectors = [
      '.andes-money-amount__fraction',
      '.ui-pdp-price__second-line .andes-money-amount__fraction',
      '[data-testid="price-part"]'
    ];
    for (const sel of priceSelectors) {
      try {
        const priceText = await page.locator(sel).first().textContent() || '';
        price = parseInt(priceText.replace(/\D/g, ''));
        if (price > 0) break;
      } catch (e) {}
    }
    
    // Extrai imagem
    let imageUrl = '';
    const imgSelectors = [
      'img.ui-pdp-image',
      '.ui-pdp-gallery__figure img',
      'img[data-zoom]',
      '.ui-pdp-gallery img'
    ];
    for (const sel of imgSelectors) {
      try {
        imageUrl = await page.locator(sel).first().getAttribute('src') || '';
        if (imageUrl && imageUrl.startsWith('http')) break;
      } catch (e) {}
    }
    
    // Calcula preço original
    const originalPrice = Math.round(price / (1 - bestProduct.discount / 100));
    
    // Gera link de afiliado - extrai só o ID do produto para URL mais curta
    let baseUrl = bestProduct.productUrl.split('?')[0].split('#')[0];
    
    // Extrai MLB ID para criar URL curta
    const mlbMatch = baseUrl.match(/(MLB-?\d+)/i);
    if (mlbMatch) {
      baseUrl = `https://produto.mercadolivre.com.br/${mlbMatch[1]}`;
    }
    
    // ORDEM CORRETA: matt_word PRIMEIRO, matt_tool DEPOIS
    const affiliateUrl = `${baseUrl}?matt_word=${AFFILIATE_TAG}&matt_tool=${AFFILIATE_TOOL}`;
    
    const offer: ProductOffer = {
      title: title || 'Oferta Especial',
      price,
      originalPrice,
      discount: bestProduct.discount,
      imageUrl,
      productUrl: bestProduct.productUrl,
      affiliateUrl
    };
    
    console.log('\n✅ Produto extraído com sucesso!');
    console.log(`   📦 Título: ${offer.title}`);
    console.log(`   💰 Preço: R$ ${offer.price}`);
    console.log(`   🏷️ Desconto: ${offer.discount}%`);
    console.log(`   🔗 Link afiliado: ${offer.affiliateUrl.substring(0, 80)}...`);
    
    return offer;
    
  } finally {
    await browser.close();
  }
}

/**
 * Executa o fluxo completo
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   🚀 AUTO FIND & POST - Mercado Livre → Twitter');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Tag de Afiliado: ${AFFILIATE_TAG}`);
  console.log(`   Tool ID: ${AFFILIATE_TOOL}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // 1. Busca oferta com 20%+ de desconto
  const offer = await findOfferWithDiscount(20);
  
  if (!offer) {
    console.log('\n❌ Não foi possível encontrar uma oferta. Tentando busca direta...\n');
    return;
  }
  
  // 2. Prepara texto para Twitter (máx 280 caracteres)
  // Encurta título se necessário
  const maxTitleLen = 60;
  const shortTitle = offer.title.length > maxTitleLen 
    ? offer.title.substring(0, maxTitleLen) + '...' 
    : offer.title;
  
  const tweetText = `🔥 ${offer.discount}% OFF!\n${shortTitle}\nR$ ${offer.price}\n🛒 ${offer.affiliateUrl}`;
  
  console.log('\n📝 Tweet a ser postado:');
  console.log('─────────────────────────────────────────');
  console.log(tweetText);
  console.log('─────────────────────────────────────────');
  
  // 3. Faz POST para a API
  console.log('\n📤 Enviando para API...');
  
  const response = await fetch('http://localhost:3001/api/auto-promoter/post-single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      affiliateUrl: offer.productUrl,
      postToTelegram: false,
      postToFacebook: false,
      postToTwitter: true
    })
  });
  
  const result = await response.json();
  console.log('\n✅ Resultado:', JSON.stringify(result, null, 2));
}

// Executa
main().catch(console.error);
