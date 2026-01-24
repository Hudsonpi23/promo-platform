import { chromium } from 'playwright';

async function main() {
  console.log('🔍 Iniciando busca de oferta no ML...');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'pt-BR'
  });
  
  const page = await context.newPage();
  
  try {
    // Busca direta por termo popular
    const termo = 'fone bluetooth';
    const url = `https://lista.mercadolivre.com.br/${encodeURIComponent(termo)}`;
    console.log('📄 Acessando:', url);
    
    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    
    // Espera elementos carregarem
    await page.waitForTimeout(5000);
    
    const titulo = await page.title();
    console.log('📄 Página:', titulo);
    
    // Salva screenshot para debug
    await page.screenshot({ path: 'debug-ml.png', fullPage: false });
    console.log('📸 Screenshot salvo: debug-ml.png');
    
    // Tenta múltiplos seletores
    let links = [];
    
    // Seletor 1: Links diretos de produtos (não tracking)
    links = await page.$$eval('a', (els) => {
      return els
        .filter(el => {
          const href = el.getAttribute('href') || '';
          const text = el.textContent || '';
          // Filtra apenas links diretos de produtos (com MLB no path, não no tracking)
          return (href.includes('/p/MLB') || href.includes('produto.mercadolivre')) && 
                 !href.includes('click1.mercadolivre') &&
                 !href.includes('categorias') && 
                 text.trim().length > 10;
        })
        .slice(0, 20)
        .map(el => ({
          titulo: el.textContent?.trim().substring(0, 100).replace(/\s+/g, ' '),
          link: el.getAttribute('href')
        }));
    });
    
    console.log(`🔗 Links de produtos: ${links.length}`);
    
    // Se não encontrou links diretos, tenta os de busca
    if (links.length === 0) {
      links = await page.$$eval('.ui-search-result__content-wrapper a', (els) => {
        return els
          .slice(0, 15)
          .map(el => ({
            titulo: el.textContent?.trim().substring(0, 100).replace(/\s+/g, ' '),
            link: el.getAttribute('href')
          }))
          .filter(l => l.link && !l.link.includes('click1'));
      });
      console.log(`🔗 Links de busca: ${links.length}`);
    }
    
    console.log(`\n📦 ${links.length} produtos encontrados\n`);
    
    if (links.length > 0) {
      // Mostra os 5 primeiros
      links.slice(0, 5).forEach((p, i) => {
        console.log(`${i+1}. ${p.titulo}`);
      });
      
      // Escolhe um aleatório
      const escolhido = links[Math.floor(Math.random() * links.length)];
      
      console.log('\n' + '='.repeat(60));
      console.log('🎯 OFERTA ALEATÓRIA ESCOLHIDA:');
      console.log('='.repeat(60));
      console.log(`📦 ${escolhido.titulo}`);
      console.log(`🔗 ${escolhido.link}`);
    } else {
      console.log('❌ Nenhum produto encontrado');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await browser.close();
  }
}

main();
