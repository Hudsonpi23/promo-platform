// Inicializar todos os workers
import { telegramWorker } from './telegram.js';
import { whatsappWorker } from './whatsapp.js';
import { facebookWorker } from './facebook.js';
import { siteWorker } from './site.js';

console.log('🚀 Workers iniciados:');
console.log('  - Telegram Worker');
console.log('  - WhatsApp Worker');
console.log('  - Facebook Worker');
console.log('  - Site Worker');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Encerrando workers...');
  await telegramWorker.close();
  await whatsappWorker.close();
  await facebookWorker.close();
  await siteWorker.close();
  process.exit(0);
});
