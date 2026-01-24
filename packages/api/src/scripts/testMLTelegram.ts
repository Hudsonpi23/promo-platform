import 'dotenv/config';
import axios from 'axios';

const mlUrl = 'https://www.mercadolivre.com.br/social/dh20260120130733?matt_word=dh20260120130733&matt_tool=77551400&forceInApp=true&ref=BGa%2FimCrFn7%2FVpQQbvDIxKnvczm319Vel5sgXmVP%2Bmn2oTKpwfI1VG9zo%2BUv09YOHlkix%2BW06FJtnYfA0WdRspN%2FrZ1vak2Ol962JMevn1NG%2B4FeHN%2F75sHUVkDPpIGkk2nh7MDSVRun0xWRtEQwqrMwzbcRB0scPmU56n1l2rgqcxmSSzTexCWSCQfMKr0bwSK3bg%3D%3D';

async function sendToTelegram() {
  console.log('\n=== TESTE MERCADO LIVRE NO TELEGRAM ===\n');
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  const message = `Camera De Seguranca Lampada Soquete Wifi Visao Noturna 360 Graus Full Hd

De R$ 78,95 por R$ 49,60
37% OFF

Mercado Livre

${mlUrl}`;

  console.log('Enviando para Telegram...');
  
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        disable_web_page_preview: false,
      }
    );
    
    console.log('Enviado! Message ID:', response.data.result.message_id);
  } catch (error: any) {
    console.log('Erro:', error.response?.data || error.message);
  }
}

sendToTelegram();
