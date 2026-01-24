/**
 * Script para verificar os IDs corretos das páginas do Facebook
 */

import dotenv from 'dotenv';
dotenv.config();

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';

// Tokens
const tokens = [
  { name: 'Manu Das Promoções', token: process.env.META_PAGE_1_TOKEN },
  { name: 'Manu Promoções de Tecnologia', token: process.env.META_PAGE_2_TOKEN },
];

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('   🔍 VERIFICANDO IDS DAS PÁGINAS');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  for (const { name, token } of tokens) {
    if (!token) {
      console.log(`❌ ${name}: Token não configurado`);
      continue;
    }
    
    try {
      // Buscar informações da página usando o token
      const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/me?fields=id,name&access_token=${token}`;
      
      const response = await fetch(url);
      const data = await response.json() as any;
      
      if (data.error) {
        console.log(`❌ ${name}: ${data.error.message}`);
      } else {
        console.log(`✅ ${name}`);
        console.log(`   ID correto: ${data.id}`);
        console.log(`   Nome: ${data.name}`);
      }
    } catch (error: any) {
      console.log(`❌ ${name}: ${error.message}`);
    }
    
    console.log('');
  }
}

main().catch(console.error);
