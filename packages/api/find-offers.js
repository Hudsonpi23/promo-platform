const { chromium } = require('playwright');
const axios = require('axios');

async function main() {
  console.log('ðŸ” Abrindo pÃ¡gina de ofertas do ML...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.mercadolivre.com.br/ofertas', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  // Pegar links de produtos
  const productLinks = await page.evaluate(() => {
    const links = [];
    const items = document.querySelectorAll('a[href*="MLB"]');
    
    items.forEach(a => {
      const href = a.href;
      if (href.includes('mercadolivre.com.br') && href.includes('MLB')) {
        // Verificar se tem desconto
        const parent = a.closest('.promotion-item, .andes-card, li');
        if (parent) {
          const discountEl = parent.querySelector('[class*="discount"]');
          if (discountEl) {
            const text = discountEl.textContent || '';
            const match = text.match(/(\d+)%/);
            if (match && parseInt(match[1]) >= 20) {
              links.push({
                url: href,
                discount: parseInt(match[1])
              });
            }
          }
        }
      }
    });
    
    return links.slice(0, 5);
  });
  
  console.log('Links com 20%+ OFF:', productLinks.length);
  
  if (productLinks.length > 0) {
    console.log('\nPrimeiro produto:', productLinks[0]);
  } else {
    // Tentar pegar qualquer produto com desconto
    const anyProduct = await page.evaluate(() => {
      const allDiscounts = document.querySelectorAll('[class*="discount"]');
      for (const el of allDiscounts) {
        const text = el.textContent || '';
        if (text.includes('%')) {
          const parent = el.closest('a') || el.closest('li')?.querySelector('a');
          if (parent?.href?.includes('MLB')) {
            return { url: parent.href, discount: text };
          }
        }
      }
      return null;
    });
    console.log('Produto alternativo:', anyProduct);
  }
  
  // Tirar screenshot para debug
  await page.screenshot({ path: 'ml-ofertas.png' });
  console.log('\nScreenshot salvo: ml-ofertas.png');
  
  await browser.close();
}

main();
