import 'dotenv/config';
import { postTweetWithImage } from '../services/twitter.js';

const mlUrl = 'https://mercadolivre.com/sec/2MVwJMT';
const imageUrl = 'https://http2.mlstatic.com/D_NQ_NP_2X_606273-MLU78829684361_092024-F.webp';

async function run() {
  console.log('\n========================================');
  console.log('   Teste Link /sec/ no X COM IMAGEM');
  console.log('========================================\n');

  const tweetText = `Cadeira De Escritorio Ergonomica Boston G100

De R$ 746 por R$ 499
33% OFF + Cupom 10%

Frete Gratis!

${mlUrl}`;

  console.log('Tweet:', tweetText);
  console.log('Imagem:', imageUrl);
  console.log('\nPostando no X com imagem...');
  
  const result = await postTweetWithImage(tweetText, imageUrl);
  
  if (result.success) {
    console.log('\nPostado com sucesso!');
    console.log('URL:', result.tweetUrl);
  } else {
    console.log('\nErro:', result.error);
  }
}

run();
