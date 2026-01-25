const axios = require('axios');
const crypto = require('crypto');

const ML_TOKEN = 'APP_USR-6822621568324751-012421-caec448f01234a16b876ec5d23eb1f7e-666498852';

// 1. Buscar ofertas via API do ML
async function searchOffers() {
  console.log('Buscando ofertas via API...');
  
  try {
    // Buscar em categoria de eletronicos
    const resp = await axios.get('https://api.mercadolibre.com/sites/MLB/search', {
      params: {
        category: 'MLB1051', // Celulares
        discount: '20-100',  // 20% ou mais
        limit: 5
      }
    });
    
    const items = resp.data.results.filter(item => {
      if (item.original_price && item.price) {
        const discount = ((item.original_price - item.price) / item.original_price) * 100;
        return discount >= 20;
      }
      return false;
    });
    
    console.log('Produtos encontrados:', items.length);
    return items;
  } catch (err) {
    console.log('Erro na busca:', err.message);
    return [];
  }
}

async function main() {
  const items = await searchOffers();
  
  if (items.length > 0) {
    const item = items[0];
    const discount = Math.round(((item.original_price - item.price) / item.original_price) * 100);
    
    console.log('\nðŸ“¦ Produto selecionado:');
    console.log('TÃ­tulo:', item.title);
    console.log('PreÃ§o original:', item.original_price);
    console.log('PreÃ§o atual:', item.price);
    console.log('Desconto:', discount + '%');
    console.log('ID:', item.id);
    console.log('Link:', item.permalink);
  } else {
    console.log('Nenhum produto com 20%+ OFF encontrado');
  }
}

main();
