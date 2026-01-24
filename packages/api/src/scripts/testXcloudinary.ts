import 'dotenv/config';
import { uploadFromUrl } from '../services/cloudinary.js';
import { postTweetWithImage } from '../services/twitter.js';

const mlUrl = 'https://mercadolivre.com/sec/2MVwJMT';
const originalImage = 'https://http2.mlstatic.com/D_NQ_NP_2X_606273-MLU78829684361_092024-F.webp';

async function run() {
  console.log('\n========================================');
  console.log('   X via Cloudinary (JPG)');
  console.log('========================================\n');

  // 1. Upload para Cloudinary (converte para JPG)
  console.log('1. Fazendo upload para Cloudinary...');
  const cloudResult = await uploadFromUrl(originalImage, {
    transformation: { format: 'jpg', quality: 90, width: 1000 }
  });
  
  if (!cloudResult.success) {
    console.log('Erro no Cloudinary:', cloudResult.error);
    return;
  }
  
  console.log('   Cloudinary URL:', cloudResult.url);

  // 2. Postar no Twitter com imagem do Cloudinary
  const tweetText = `Cadeira De Escritorio Ergonomica Boston G100

De R$ 746 por R$ 499
33% OFF + Cupom 10%

Frete Gratis!

${mlUrl}`;

  console.log('\n2. Postando no X...');
  const result = await postTweetWithImage(tweetText, cloudResult.url);
  
  if (result.success) {
    console.log('\nSUCESSO!');
    console.log('URL:', result.tweetUrl);
  } else {
    console.log('\nErro:', result.error);
  }
}

run();
