import 'dotenv/config';
import axios from 'axios';

const mlUrl = 'https://www.mercadolivre.com.br/social/dh20260120130733?matt_word=dh20260120130733&matt_tool=77551400&forceInApp=true&ref=BAPF%2Fp%2BSdKOZJhUpv0Z1lGyWPAJZg%2FqcVVvOZlKEcG%2FlkVi0aysYyQsUPLDL0L2%2BPvcwec8HL6brCdgcMg7gWWeQLT3t9n3Dr7wxcmmAXtdYbknpok32u%2FG8YsZ5qBVzXY%2FhvOQYPECpH%2Fwg14UGCL65FdjI0V5xvgQBqkP64fXU0n7PwqPn2nQifx7JvnSgZWSIrhs%3D';

async function sendToTelegram() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  const message = `Smart Tv 32 Philco Ptv32k34rkgb Roku Tv Led Dolby Audio

De R$ 1.175 por R$ 821,75
30% OFF no Pix

Mercado Livre

${mlUrl}`;

  console.log('Enviando para Telegram...');
  
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
