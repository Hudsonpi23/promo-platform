// Script para descobrir o Chat ID do seu canal do Telegram
// Execute: node get-telegram-chat-id.js

require('dotenv').config();
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8278816305:AAGUtWOcZ25ArRUfFN5oWvHTuiXYo5VkNF4';

async function getUpdates() {
  console.log('🔍 Buscando atualizações do bot...\n');
  
  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    
    if (response.data.ok && response.data.result.length > 0) {
      console.log('📱 Mensagens/Canais encontrados:\n');
      
      response.data.result.forEach((update, i) => {
        const chat = update.message?.chat || update.channel_post?.chat;
        
        if (chat) {
          console.log(`${i + 1}. ${chat.title || chat.first_name || 'Chat'}`);
          console.log(`   Chat ID: ${chat.id}`);
          console.log(`   Tipo: ${chat.type}`);
          console.log('');
        }
      });
      
      console.log('\n✅ Use um desses Chat IDs no seu .env como TELEGRAM_CHAT_ID');
    } else {
      console.log('⚠️  Nenhuma mensagem encontrada.');
      console.log('\n📝 INSTRUÇÕES:');
      console.log('1. Adicione o bot ao seu canal como administrador');
      console.log('2. Envie uma mensagem qualquer no canal');
      console.log('3. Execute este script novamente');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    
    if (error.response?.data) {
      console.log('\nDetalhes:', error.response.data);
    }
  }
}

// Também testar getMe para verificar se o token está válido
async function testBot() {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    
    if (response.data.ok) {
      console.log('✅ Bot conectado com sucesso!');
      console.log(`📱 Nome: ${response.data.result.first_name}`);
      console.log(`🆔 Username: @${response.data.result.username}\n`);
    }
  } catch (error) {
    console.error('❌ Token inválido ou bot não encontrado\n');
  }
}

async function main() {
  await testBot();
  await getUpdates();
}

main();
