import 'dotenv/config';
import axios from 'axios';
import { postTweetWithImage } from '../services/twitter.js';

const mlUrl = 'https://mercadolivre.com/sec/2MVwJMT';
// URL real da imagem encontrada pelo Playwright
const imageUrl = 'https://http2.mlstatic.com/D_NQ_NP_2X_627800-MLA96570430844_112025-F.webp';

async function run() {
  console.log('\n========================================');
  console.log('   Twitter com URL REAL do ML');
  console.log('========================================\n');

  // Primeiro testar download
  console.log('Testando download da URL real...');
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    console.log('Status:', response.status);
    console.log('Tamanho:', Math.round(response.data.length / 1024), 'KB');
    console.log('Content-Type:', response.headers['content-type']);
    
    if (response.data.length < 10000) {
      console.log('ERRO: Imagem muito pequena!');
      return;
    }
  } catch (error) {
    console.log('Erro no download:', error.message);
    return;
  }

  const tweetText = `Cadeira Ergonomica Boston G100

R$ 746 por R$ 499
33% OFF + Cupom 10%

${mlUrl}`;

  console.log('\nPostando no Twitter...');
  const result = await postTweetWithImage(tweetText, imageUrl);
  
  if (result.success) {
    console.log('\nSUCESSO!');
    console.log('URL:', result.tweetUrl);
  } else {
    console.log('\nErro:', result.error);
  }
}

run();
