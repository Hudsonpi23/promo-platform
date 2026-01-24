import 'dotenv/config';
import axios from 'axios';

const affiliateUrl = 'https://www.awin1.com/cread.php?awinmid=115463&awinaffid=2739090&clickref=https%3A%2F%2Fwww.gigantec.com.br%2Fcomputador-gamer-certox-stream-amd-aq-1026-tc-ryzen-5-pro-5650g-radeon-graphics-16gb-ddr4-256gb-ssd-c-3-fans-windows-11-pro.html';

async function sendToTelegram() {
  console.log('\n=== ENVIANDO PARA TELEGRAM ===\n');
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!botToken || !chatId) {
    console.log('ERRO: TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID nao configurado');
    return;
  }
  
  console.log('Bot Token: ' + botToken.substring(0, 10) + '...');
  console.log('Chat ID: ' + chatId);
  
  const message = `ðŸ–¥ï¸ Computador Gamer CertoX Stream

âœ… AMD Ryzen 5 PRO 5650G
âœ… Radeon Graphics
âœ… 16GB DDR4
âœ… 256GB SSD
âœ… 3 Fans RGB
âœ… Windows 11 Pro

ðŸ’° 10% OFF no PIX!
ðŸ›’ Gigantec

ðŸ‘‰ ${affiliateUrl}`;

  console.log('\nMensagem:');
  console.log(message);
  console.log('\n---\n');
  
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,  // Permite preview do link
      }
    );
    
    console.log('âœ… Enviado para Telegram!');
    console.log('Message ID:', response.data.result.message_id);
  } catch (error: any) {
    console.log('âŒ Erro:', error.response?.data || error.message);
  }
}

sendToTelegram();
