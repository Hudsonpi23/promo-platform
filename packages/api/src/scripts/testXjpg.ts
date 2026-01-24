import 'dotenv/config';
import { postTweetWithImage } from '../services/twitter.js';

const mlUrl = 'https://mercadolivre.com/sec/2MVwJMT';
// Tentar URL alternativa do ML (sem webp, forÃ§ando jpg)
const imageUrl = 'https://http2.mlstatic.com/D_NQ_NP_606273-MLU78829684361_092024-O.jpg';

async function run() {
  console.log('\n========================================');
  console.log('   X com imagem JPG do ML');
  console.log('========================================\n');

  const tweetText = `Cadeira Ergonomica Boston G100

R$ 746 por R$ 499
33% OFF + Cupom 10%

${mlUrl}`;

  console.log('Imagem:', imageUrl);
  console.log('\nPostando...');
  
  const result = await postTweetWithImage(tweetText, imageUrl);
  
  if (result.success) {
    console.log('\nSUCESSO!');
    console.log('URL:', result.tweetUrl);
  } else {
    console.log('\nErro:', result.error);
  }
}

run();
