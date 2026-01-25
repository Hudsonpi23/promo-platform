const { chromium } = require('playwright');

async function main() {
  console.log('ðŸ” Buscando ofertas...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Ir para ofertas do dia
  await page.goto('https://www.mercadolivre.com.br/ofertas#nav-header', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Pegar HTML para debug
  const html = await page.content();
  
  // Procurar por qualquer item com desconto
  const items = await page.$$eval('a', (links) => {
    return links
      .filter(a => a.href && a.href.includes('MLB'))
      .map(a => ({
        href: a.href,
        text: a.textContent?.slice(0, 100)
      }))
      .slice(0, 10);
  });
  
  console.log('Links MLB encontrados:', items.length);
  items.forEach((item, i) => {
    console.log(`${i+1}. ${item.href}`);
  });
  
  if (items.length > 0) {
    // Ir para o primeiro produto
    console.log('\nðŸ“¦ Acessando primeiro produto...');
    await page.goto(items[0].href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Extrair detalhes
    const details = await page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent?.trim();
      const priceEl = document.querySelector('.andes-money-amount__fraction');
      const price = priceEl?.textContent;
      const discountEl = document.querySelector('.andes-money-amount__discount');
      const discount = discountEl?.textContent;
      const img = document.querySelector('.ui-pdp-image')?.src;
      
      return { title, price, discount, img };
    });
    
    console.log('\nDetalhes do produto:');
    console.log('TÃ­tulo:', details.title);
    console.log('PreÃ§o: R$', details.price);
    console.log('Desconto:', details.discount);
    console.log('Imagem:', details.img?.slice(0, 80));
    
    // Extrair MLB ID
    const urlMatch = items[0].href.match(/MLB-?(\d+)/i);
    if (urlMatch) {
      console.log('\nItem ID: MLB' + urlMatch[1]);
    }
  }
  
  await browser.close();
}

main().catch(console.error);
