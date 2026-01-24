/**
 * Script para buscar ofertas aleatórias no Mercado Livre
 */

import { chromium } from 'playwright';

interface Oferta {
  titulo: string;
  preco: string;
  precoOriginal: string;
  desconto: string;
  link: string;
  imagem: string;
}

async function buscarOfertasML(): Promise<Oferta[]> {
  console.log('🔍 [ML] Iniciando busca de ofertas...');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Simula navegador real
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  });
  
  try {
    // Acessa página de ofertas do ML
    console.log('📄 [ML] Acessando página de ofertas...');
    await page.goto('https://www.mercadolivre.com.br/ofertas#nav-header', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // Espera conteúdo carregar
    await page.waitForTimeout(5000);
    
    // Scroll para carregar mais produtos
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(2000);
    
    // Debug: mostra título da página
    const titulo = await page.title();
    console.log(`📄 [ML] Título da página: ${titulo}`);
    
    // Busca cards de produtos
    const ofertas: Oferta[] = [];
    
    // Tenta vários seletores
    let cards = await page.locator('li.promotion-item').all();
    console.log(`📦 [ML] promotion-item: ${cards.length}`);
    
    if (cards.length === 0) {
      cards = await page.locator('[class*="poly-card"]').all();
      console.log(`📦 [ML] poly-card: ${cards.length}`);
    }
    
    if (cards.length === 0) {
      cards = await page.locator('[class*="ui-search-result"]').all();
      console.log(`📦 [ML] ui-search-result: ${cards.length}`);
    }
    
    // Se não encontrou cards, tenta links diretos
    if (cards.length === 0) {
      // Busca qualquer link com MLB no href
      const links = await page.locator('a[href*="MLB"]').all();
      console.log(`🔗 [ML] Links MLB: ${links.length}`);
      
      for (let i = 0; i < Math.min(20, links.length); i++) {
        const link = links[i];
        const href = await link.getAttribute('href');
        const texto = await link.textContent();
        
        if (href && href.includes('MLB') && !href.includes('categorias') && !href.includes('ofertas')) {
          ofertas.push({
            titulo: texto?.trim().substring(0, 100) || 'Produto ML',
            preco: '',
            precoOriginal: '',
            desconto: '',
            link: href.startsWith('http') ? href : `https://www.mercadolivre.com.br${href}`,
            imagem: ''
          });
        }
      }
    } else {
      // Extrai dados dos cards
      for (let i = 0; i < Math.min(10, cards.length); i++) {
        try {
          const card = cards[i];
          
          // Título
          const tituloEl = await card.locator('.promotion-item__title, .poly-card__title, h2').first();
          const titulo = await tituloEl.textContent().catch(() => '');
          
          // Preço
          const precoEl = await card.locator('.promotion-item__price, .andes-money-amount__fraction').first();
          const preco = await precoEl.textContent().catch(() => '');
          
          // Link
          const linkEl = await card.locator('a').first();
          const link = await linkEl.getAttribute('href').catch(() => '');
          
          // Imagem
          const imgEl = await card.locator('img').first();
          const imagem = await imgEl.getAttribute('src').catch(() => '');
          
          if (link) {
            ofertas.push({
              titulo: titulo?.trim() || 'Produto',
              preco: preco?.trim() || '',
              precoOriginal: '',
              desconto: '',
              link: link,
              imagem: imagem || ''
            });
          }
        } catch (e) {
          // Ignora erros em cards individuais
        }
      }
    }
    
    return ofertas;
    
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    const ofertas = await buscarOfertasML();
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 OFERTAS ENCONTRADAS:');
    console.log('='.repeat(60));
    
    if (ofertas.length === 0) {
      console.log('❌ Nenhuma oferta encontrada');
      return;
    }
    
    ofertas.slice(0, 5).forEach((o, i) => {
      console.log(`\n${i + 1}. ${o.titulo}`);
      if (o.preco) console.log(`   💰 R$ ${o.preco}`);
      console.log(`   🔗 ${o.link.substring(0, 80)}...`);
    });
    
    // Escolhe uma aleatória
    const escolhida = ofertas[Math.floor(Math.random() * ofertas.length)];
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 OFERTA ESCOLHIDA ALEATORIAMENTE:');
    console.log('='.repeat(60));
    console.log(`📦 ${escolhida.titulo}`);
    if (escolhida.preco) console.log(`💰 R$ ${escolhida.preco}`);
    console.log(`🔗 ${escolhida.link}`);
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  }
}

main();
