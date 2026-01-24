import 'dotenv/config';
import axios from 'axios';

const mlUrl = 'https://www.mercadolivre.com.br/social/dh20260120130733?matt_word=dh20260120130733&matt_tool=77551400&forceInApp=true&ref=BI3D7LEe%2FI9mKvtjBnMpTgkhEcCgokX3nD9%2FdDi3d%2BRYPhjGUBT78i2kJD2DM10y7Iv2EjQrTJjE5EgZzG162WGW9vvyY9UvYydOYrUav3rTVn1weOdfqMxWaa08%2FfdYGtl%2Faa845JhU8hNLwGAO81D58zokWUvDJyInmsQYa4PG9OMVFzpEmQgBtrJsyYQiFRWuQY0%3D';

async function sendToTelegram() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  const message = `Smart Tv 50 Aoc 4k Dled Roku Tv

De R$ 3.799 por R$ 1.769
53% OFF

Mercado Livre

${mlUrl}`;

  console.log('Enviando...');
  
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
