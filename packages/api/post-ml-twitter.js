const axios = require('axios');
const { chromium } = require('playwright');

const ML_TOKEN = 'APP_USR-6822621568324751-012421-caec448f01234a16b876ec5d23eb1f7e-666498852';
const MATT_TOOL = '77551400';
const MATT_WORD = 'ManuPromo';

// Twitter Credentials
const TWITTER_API_KEY = 'acBLzFYKSv6CGr2GNbPdA1Q8J';
const TWITTER_API_SECRET = 'FMhZAUJGrSoycaFvYIE8rmIF7wS65tDqI7EpFMIgd1xEGigWSV';
const TWITTER_ACCESS_TOKEN = '2013613059290378240-IZ2KyuNn6wuduFATWDWYZV3Wpn57aj';
const TWITTER_ACCESS_TOKEN_SECRET = 'Cp24Cad5OsKpbElFpiX6FpURuGujFHj7W4tMldL3V8o46';

const crypto = require('crypto');

function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function generateOAuthHeader(method, url, extraParams = {}) {
  const oauthParams = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: '1.0',
    ...extraParams
  };
  
  oauthParams.oauth_signature = generateOAuthSignature(method, url, oauthParams, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN_SECRET);
  
  return 'OAuth ' + Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');
}

async function searchMLOffers() {
  console.log('ðŸ” Buscando produtos com desconto no ML...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.mercadolivre.com.br/ofertas#nav-header', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const products = await page.evaluate(() => {
    const items = document.querySelectorAll('.promotion-item__container, .andes-card, [class*="promotion-item"]');
    const results = [];
    
    items.forEach((item) => {
      const linkEl = item.querySelector('a[href*="mercadolivre.com.br"]');
      const discountEl = item.querySelector('[class*="discount"], .promotion-item__discount, .andes-money-amount__discount');
      
      if (linkEl && discountEl) {
        const discountText = discountEl.textContent || '';
        const match = discountText.match(/(\d+)%/);
        if (match) {
          const discount = parseInt(match[1]);
          if (discount >= 20) {
            results.push({
              url: linkEl.href,
              discount: discount
            });
          }
        }
      }
    });
    
    return results.slice(0, 5);
  });
  
  if (products.length === 0) {
    console.log('Buscando de outra forma...');
    const links = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href*="/MLB"]'));
      return allLinks.slice(0, 10).map(a => a.href);
    });
    
    for (const link of links) {
      if (link.includes('/MLB')) {
        products.push({ url: link, discount: 20 });
        break;
      }
    }
  }
  
  await browser.close();
  return products;
}

async function getProductDetails(url) {
  console.log('ðŸ“¦ Extraindo detalhes do produto...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const details = await page.evaluate(() => {
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    const priceEl = document.querySelector('.andes-money-amount__fraction');
    const price = priceEl ? priceEl.textContent : '';
    const discountEl = document.querySelector('[class*="discount"]');
    const discount = discountEl ? discountEl.textContent : '';
    const imageEl = document.querySelector('.ui-pdp-image, img[data-zoom]');
    const image = imageEl ? imageEl.src : '';
    
    return { title, price, discount, image };
  });
  
  // Extrair MLB ID da URL
  const mlbMatch = url.match(/MLB-?(\d+)/i);
  const itemId = mlbMatch ? `MLB${mlbMatch[1]}` : null;
  
  await browser.close();
  
  return { ...details, itemId, originalUrl: url };
}

async function generateAffiliateUrl(itemId) {
  if (!itemId) return null;
  
  try {
    const response = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: { 'Authorization': `Bearer ${ML_TOKEN}` }
    });
    
    const permalink = response.data.permalink;
    const separator = permalink.includes('?') ? '&' : '?';
    return `${permalink}${separator}matt_word=${MATT_WORD}&matt_tool=${MATT_TOOL}`;
  } catch (err) {
    console.log('Erro ao gerar link:', err.message);
    return null;
  }
}

async function postToTwitter(text) {
  console.log('ðŸ¦ Postando no Twitter...');
  
  const url = 'https://api.twitter.com/2/tweets';
  const authHeader = generateOAuthHeader('POST', url);
  
  const response = await axios.post(url, { text }, {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}

async function main() {
  try {
    // 1. Buscar produtos
    const products = await searchMLOffers();
    console.log(`Encontrados ${products.length} produtos`);
    
    if (products.length === 0) {
      console.log('Nenhum produto encontrado, usando URL de teste...');
      products.push({
        url: 'https://www.mercadolivre.com.br/fone-de-ouvido-in-ear-bluetooth-gamer-qcy-ht07-arcbuds-preto/p/MLB25349042',
        discount: 30
      });
    }
    
    // 2. Pegar detalhes do primeiro produto
    const product = await getProductDetails(products[0].url);
    console.log('Produto:', product.title?.substring(0, 50) + '...');
    
    // 3. Gerar link de afiliado
    const affiliateUrl = await generateAffiliateUrl(product.itemId);
    console.log('Link afiliado:', affiliateUrl);
    
    // 4. Criar tweet
    const shortTitle = product.title?.substring(0, 80) || 'Oferta Especial';
    const tweet = `ðŸ”¥ OFERTA! ${product.discount || '20% OFF'}

${shortTitle}

R$ ${product.price || 'Ver preÃ§o'}

${affiliateUrl || product.originalUrl}

#Ofertas #PromoÃ§Ã£o`;

    console.log('\nðŸ“ Tweet:', tweet.length, 'caracteres');
    console.log(tweet);
    
    // 5. Postar
    const result = await postToTwitter(tweet);
    console.log('\nâœ… POSTADO COM SUCESSO!');
    console.log('Tweet ID:', result.data.id);
    
  } catch (err) {
    console.error('Erro:', err.response?.data || err.message);
  }
}

main();
