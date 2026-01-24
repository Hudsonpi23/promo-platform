import 'dotenv/config';
import { postTweet } from '../services/twitter.js';

const mlUrl = 'https://mercadolivre.com/sec/2MVwJMT';

async function run() {
  console.log('\n========================================');
  console.log('   Teste Link /sec/ no X (Twitter)');
  console.log('========================================\n');

  const tweetText = `Cadeira De Escritorio Ergonomica Boston G100

De R$ 746 por R$ 499
33% OFF + Cupom 10%

Frete Gratis!

${mlUrl}`;

  console.log('Tweet:', tweetText);
  console.log('\nPostando no X...');
  
  const result = await postTweet(tweetText);
  
  if (result.success) {
    console.log('\nPostado com sucesso!');
    console.log('URL:', result.tweetUrl);
  } else {
    console.log('\nErro:', result.error);
  }
}

run();
