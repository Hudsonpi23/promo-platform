import 'dotenv/config';
import axios from 'axios';

const mlUrl = 'https://mercadolivre.com/sec/2MVwJMT';

async function sendToTelegram() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  const message = `ðŸ”— Teste Link /sec/ do ML

${mlUrl}`;

  console.log('Enviando link /sec/ para Telegram...');
  
  const response = await axios.post(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      chat_id: chatId,
      text: message,
      disable_web_page_preview: false,
    }
  );
  
  console.log('Enviado! Message ID:', response.data.result.message_id);
}

sendToTelegram().catch(e => console.log('Erro:', e.message));
