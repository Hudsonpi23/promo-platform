const axios = require('axios');

const API_URL = 'https://promo-platform-api.onrender.com';

async function testFullFlow() {
  try {
    // 1. Login
    console.log('1. Fazendo login...');
    const loginResp = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'password'
    });
    
    const token = loginResp.data.token;
    console.log('   âœ… Token obtido!\n');
    
    // 2. Listar ofertas
    console.log('2. Listando ofertas...');
    const offersResp = await axios.get(`${API_URL}/api/offers?limit=1`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const offers = offersResp.data.data || offersResp.data;
    if (!offers || offers.length === 0) {
      console.log('   âŒ Nenhuma oferta encontrada!');
      return;
    }
    
    const offer = offers[0];
    console.log(`   âœ… Oferta encontrada: ${offer.title.substring(0, 40)}...`);
    console.log(`      ID: ${offer.id}\n`);
    
    // 3. Postar no Telegram
    console.log('3. Postando no Telegram...');
    const telegramResp = await axios.post(
      `${API_URL}/api/telegram/post-offer/${offer.id}`,
      {},
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    console.log('   âœ… Resposta do Telegram:');
    console.log('      Success:', telegramResp.data.success);
    console.log('      Message ID:', telegramResp.data.messageId);
    if (telegramResp.data.sentTextOnly) {
      console.log('      âš ï¸  Enviado apenas texto (foto falhou)');
    }
    if (telegramResp.data.message) {
      console.log('      Mensagem:', telegramResp.data.message);
    }
    
  } catch (error) {
    console.error('\nâŒ Erro:', error.response?.status, error.response?.statusText);
    console.error('   Detalhes:', error.response?.data || error.message);
  }
}

testFullFlow();
