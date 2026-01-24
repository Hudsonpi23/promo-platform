import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { postTweetWithImage } from '../services/twitter.js';

const mlUrl = 'https://mercadolivre.com/sec/2MVwJMT';

async function run() {
  console.log('\n========================================');
  console.log('   Download ML + Upload Twitter');
  console.log('========================================\n');

  // URLs para tentar
  const imageUrls = [
    'https://http2.mlstatic.com/D_NQ_NP_606273-MLU78829684361_092024-O.jpg',
    'https://http2.mlstatic.com/D_NQ_NP_2X_606273-MLU78829684361_092024-F.webp',
    'https://http2.mlstatic.com/D_606273-MLU78829684361_092024-I.jpg',
  ];

  let imageBuffer = null;
  
  for (const url of imageUrls) {
    try {
      console.log('Tentando:', url);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Referer': 'https://www.mercadolivre.com.br/',
        },
        timeout: 10000,
      });
      
      console.log('  Status:', response.status);
      console.log('  Tamanho:', Math.round(response.data.length / 1024), 'KB');
      console.log('  Content-Type:', response.headers['content-type']);
      
      if (response.data.length > 5000) {
        imageBuffer = response.data;
        console.log('  OK!');
        break;
      } else {
        console.log('  Imagem muito pequena, pode ser erro');
      }
    } catch (error) {
      console.log('  Erro:', error.message);
    }
  }

  if (!imageBuffer) {
    console.log('\nNao conseguiu baixar nenhuma imagem do ML');
    return;
  }

  // Salvar localmente
  const localPath = path.join(process.cwd(), 'temp_chair.jpg');
  fs.writeFileSync(localPath, imageBuffer);
  console.log('\nSalvo em:', localPath);
  
  console.log('\nVerifique a imagem e me avise!');
}

run();
