require('dotenv').config();
const axios = require('axios');

const BOT_TOKEN = '8278816305:AAGUtWOcZ25ArRUfFN5oWvHTuiXYo5VkNF4';
const CHAT_ID = '-1003676225777';

async function testWithImage() {
  // Testar com uma URL de imagem do Cloudinary (deve funcionar)
  const testImageUrl = 'https://res.cloudinary.com/dmdiipxhb/image/upload/v1/offers/test.jpg';
  
  const caption = `ðŸ”¥ <b>TESTE COM IMAGEM</b>

<b>R$ 562,32</b>

ðŸ‘‰ https://mercadolivre.com/teste

#Promocao`;

  try {
    console.log('ðŸ“¸ Testando envio com imagem...\n');
    
    const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      chat_id: CHAT_ID,
      photo: testImageUrl,
      caption: caption,
      parse_mode: 'HTML'
    });
    
    if (response.data.ok) {
      console.log('âœ… Foto enviada com sucesso!');
    }
  } catch (err) {
    console.log('âŒ Erro com foto:', err.response?.data?.description || err.message);
    console.log('\nðŸ“ Tentando enviar sÃ³ texto...\n');
    
    // Fallback: sÃ³ texto
    try {
      const textResponse = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: caption,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });
      
      if (textResponse.data.ok) {
        console.log('âœ… Texto enviado com sucesso (sem foto)!');
        console.log('ðŸ“± Message ID:', textResponse.data.result.message_id);
      }
    } catch (textErr) {
      console.log('âŒ Erro com texto tambÃ©m:', textErr.response?.data || textErr.message);
    }
  }
}

testWithImage();
