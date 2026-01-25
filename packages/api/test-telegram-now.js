require('dotenv').config();
const axios = require('axios');

const BOT_TOKEN = '8278816305:AAGUtWOcZ25ArRUfFN5oWvHTuiXYo5VkNF4';
const CHAT_ID = '-1003676225777';

async function testTelegram() {
  console.log('ðŸ” Testando conexÃ£o com Telegram...\n');
  
  // 1. Testar bot
  try {
    const botInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    console.log('âœ… Bot:', botInfo.data.result.first_name, '@' + botInfo.data.result.username);
  } catch (err) {
    console.log('âŒ Erro no bot:', err.message);
    return;
  }
  
  // 2. Testar envio de mensagem
  try {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const testMessage = `ðŸ§ª <b>TESTE DE CONEXÃƒO</b>\n\nâœ… Bot funcionando!\nðŸ•’ ${timestamp}\n\n<i>Se vocÃª estÃ¡ vendo esta mensagem, o Telegram estÃ¡ configurado corretamente!</i>`;
    
    const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: testMessage,
      parse_mode: 'HTML'
    });
    
    if (response.data.ok) {
      console.log('\nâœ… MENSAGEM ENVIADA COM SUCESSO!');
      console.log('ðŸ“± Message ID:', response.data.result.message_id);
      console.log('\nðŸŽ‰ Telegram estÃ¡ funcionando perfeitamente!');
    }
  } catch (err) {
    console.log('\nâŒ Erro ao enviar mensagem:');
    console.log('   ', err.response?.data || err.message);
    
    if (err.response?.data?.description) {
      console.log('\nðŸ“ Detalhes:', err.response.data.description);
      
      if (err.response.data.description.includes('bot was blocked')) {
        console.log('\nâš ï¸  O bot foi bloqueado ou removido do canal!');
        console.log('    Adicione @manudaspromocoesbot como administrador novamente.');
      } else if (err.response.data.description.includes('chat not found')) {
        console.log('\nâš ï¸  Chat ID invÃ¡lido ou bot nÃ£o tem acesso!');
      }
    }
  }
}

testTelegram();
