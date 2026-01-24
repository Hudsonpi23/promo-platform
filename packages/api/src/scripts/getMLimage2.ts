import 'dotenv/config';
import { chromium } from 'playwright';

async function run() {
  console.log('\n========================================');
  console.log('   Buscando imagem do produto no ML');
  console.log('========================================\n');

  const browser = await chromium.launch({ headless: false }); // Mostrar navegador
  const page = await browser.newPage();
  
  console.log('Acessando pagina...');
  await page.goto('https://mercadolivre.com/sec/2MVwJMT', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });
  
  // Esperar carregar
  await page.waitForTimeout(5000);
  
  // Pegar URL atual
  const currentUrl = page.url();
  console.log('URL atual:', currentUrl);
  
  // Buscar todas as imagens com src
  const images = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img[src*="mlstatic"]');
    return Array.from(imgs).map(img => ({
      src: img.src,
      alt: img.alt || '',
    }));
  });
  
  console.log('\nImagens do mlstatic encontradas:', images.length);
  images.slice(0, 10).forEach((img, i) => {
    console.log(`${i + 1}. ${img.src.substring(0, 80)}...`);
  });
  
  // Tentar clicar em "Ir para produto"
  try {
    const btn = await page.locator('text=Ir para produto').first();
    if (await btn.isVisible()) {
      console.log('\nClicando em "Ir para produto"...');
      await btn.click();
      await page.waitForTimeout(5000);
      
      const newUrl = page.url();
      console.log('Nova URL:', newUrl);
      
      // Buscar imagem principal do produto
      const productImages = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img[src*="mlstatic"]');
        return Array.from(imgs)
          .map(img => img.src)
          .filter(src => src.includes('D_NQ_NP') || src.includes('D_Q_NP'));
      });
      
      console.log('\nImagens do produto:');
      productImages.slice(0, 5).forEach((src, i) => {
        console.log(`${i + 1}. ${src}`);
      });
    }
  } catch (e) {
    console.log('Nao encontrou botao');
  }
  
  await browser.close();
}

run().catch(e => console.log('Erro:', e.message));
