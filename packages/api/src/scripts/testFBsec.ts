import 'dotenv/config';
import axios from 'axios';

const mlUrl = 'https://mercadolivre.com/sec/2MVwJMT';

const PAGE_1_TOKEN = 'EAAN6z9wxpSkBQsfuLhU7kGZAGcpwaZAauUbwaQwn9RXrkjIJsKN5PgVitZCKQY60DK0k8RK1YUmVFJoOZCiedKSuZASYG8NWjDcgmFYprZARkZAVnaf0VRh2lArNlCAczLw3vscgejZAlf1wUPEXn4a1zgAcrZA0n4nERl3vJTumlo2uCYLGA8tKhxRgZCW4ma22ONP2d3';
const PAGE_2_TOKEN = 'EAAN6z9wxpSkBQlmIzbFbXmZCfUVHiwOeCBlq69NTvRhBU6arQxQeK4AKv9G9iXTfkC975SrVOjKC4DlfxOs5mkMbzbZBiWuhZBP2oQdBxbtr3gIxgF6HyG2HQczzFe5TO5SeU2KZBjVN6ub8prdwY4OZBo4aQe7sdUSQffxQmuvu98u3aLwHG8n2EpHPuFwXpwEF5';

const PAGE_1_ID = '371318satisfan906003218';
const PAGE_2_ID = '61559863006136';

async function postToFacebook(pageId: string, token: string, pageName: string) {
  const message = `Cadeira De Escritorio Ergonomica Boston G100

De R$ 746 por R$ 499
33% OFF + Cupom 10%

Frete Gratis!

${mlUrl}`;

  console.log(`Postando em ${pageName}...`);
  
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v24.0/${pageId}/feed`,
      {
        message: message,
        link: mlUrl,
        access_token: token,
      }
    );
    
    console.log(`${pageName}: Postado! ID: ${response.data.id}`);
    return true;
  } catch (error: any) {
    console.log(`${pageName} Erro:`, error.response?.data?.error?.message || error.message);
    return false;
  }
}

async function run() {
  console.log('\n========================================');
  console.log('   Teste Link /sec/ no Facebook');
  console.log('========================================\n');
  
  await postToFacebook('371318906003218', PAGE_1_TOKEN, 'Manu das Promocoes');
  await postToFacebook('61559863006136', PAGE_2_TOKEN, 'Manu Promocoes Tech');
}

run();
