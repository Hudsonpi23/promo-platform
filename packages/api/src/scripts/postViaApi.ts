/**
 * Script para postar no X via API do Render
 */

const API_URL = 'https://promo-platform-api.onrender.com';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('   🐦 POST NO X VIA API - Promo Platform');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  // Texto do tweet
  const tweetText = `🔥 Fone de Ouvido Bluetooth JBL Tune 520BT

💸 De ~R$ 349,90~
✅ Por R$ 199,90 (-43% OFF)

🛒 Amazon

🔗 Confira em manupromocao.com

#Promoção #Oferta #Desconto`;

  console.log('📝 Tweet a ser postado:');
  console.log('─────────────────────────────────────────────');
  console.log(tweetText);
  console.log('─────────────────────────────────────────────');
  console.log(`📏 ${tweetText.length}/280 caracteres\n`);
  
  console.log('🌐 Enviando para API do Render...\n');
  
  try {
    // Usando rota de teste (temporária)
    const response = await fetch(`${API_URL}/api/twitter/test-post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: tweetText, secret: 'promo2026' }),
    });
    
    const data = await response.json() as any;
    
    console.log('📡 Resposta da API:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n🎉 SUCESSO!');
      console.log('🔗 Tweet:', data.tweetUrl);
    } else {
      console.log('\n❌ ERRO:', data.error || data.message);
    }
    
  } catch (error: any) {
    console.error('❌ Erro de conexão:', error.message);
  }
  
  console.log('');
}

main();
