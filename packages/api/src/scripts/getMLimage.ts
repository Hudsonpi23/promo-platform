import 'dotenv/config';
import { chromium } from 'playwright';

async function run() {
  console.log('\n========================================');
  console.log('   Buscando URL real da imagem no ML');
  console.log('========================================\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Acessando pagina...');
  await page.goto('https://mercadolivre.com/sec/2MVwJMT', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  
  // Esperar carregar
  await page.waitForTimeout(3000);
  
  // Buscar todas as imagens
  const images = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    return Array.from(imgs).map(img => ({
      src: img.src,
      alt: img.alt,
      width: img.naturalWidth,
      height: img.naturalHeight,
    })).filter(img => img.src && img.width > 200);
  });
  
  console.log('\nImagens encontradas (>200px):');
  images.forEach((img, i) => {
    console.log(`\n${i + 1}. ${img.alt || 'Sem alt'}`);
    console.log(`   URL: ${img.src}`);
    console.log(`   Tamanho: ${img.width}x${img.height}`);
  });
  
  await browser.close();
}

run().catch(e => console.log('Erro:', e.message));
