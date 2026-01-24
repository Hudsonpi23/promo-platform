/**
 * Script para postar no Facebook COM IMAGEM
 * Posta em DUAS páginas com tokens separados!
 */

import dotenv from 'dotenv';
dotenv.config();

// Configuração das duas páginas
const PAGES = [
  { 
    name: 'Manu Das Promoções',
    id: process.env.META_PAGE_1_ID,
    token: process.env.META_PAGE_1_TOKEN,
  },
  { 
    name: 'Manu Promoções de Tecnologia',
    id: process.env.META_PAGE_2_ID,
    token: process.env.META_PAGE_2_TOKEN,
  },
];

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';
const META_API_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface FacebookResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

/**
 * Posta na página do Facebook (com link da imagem)
 */
async function postToPage(
  pageId: string, 
  pageToken: string,
  pageName: string, 
  message: string, 
  imageUrl: string
): Promise<FacebookResult> {
  try {
    console.log(`\n📤 Publicando em "${pageName}"...`);
    
    // Tentar primeiro via /feed com link (mais permissivo)
    const url = `${META_API_BASE}/${pageId}/feed`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        link: imageUrl, // Usa a imagem como link
        access_token: pageToken,
      }),
    });

    const data = await response.json() as any;

    if (data.error) {
      console.error(`   ❌ Erro:`, data.error.message);
      return { 
        success: false, 
        error: data.error.message || 'Erro ao publicar' 
      };
    }

    if (data.id || data.post_id) {
      const postId = data.post_id || data.id;
      const cleanPostId = postId.includes('_') ? postId : `${pageId}_${postId}`;
      const postUrl = `https://facebook.com/${cleanPostId}`;
      
      console.log(`   ✅ Publicado!`);
      console.log(`   🔗 ${postUrl}`);
      return { success: true, postId, postUrl };
    }

    return { success: false, error: 'Resposta inesperada da API' };

  } catch (error: any) {
    console.error(`   ❌ Erro:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('   📘 POST NO FACEBOOK - DUAS PÁGINAS');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  
  // Verificar credenciais
  console.log('🔑 Verificando credenciais...');
  PAGES.forEach((p, i) => {
    const hasId = p.id ? '✅' : '❌';
    const hasToken = p.token ? '✅' : '❌';
    console.log(`   ${i+1}. ${p.name}`);
    console.log(`      ID: ${hasId}  Token: ${hasToken}`);
  });
  console.log(`   Graph API: ${META_GRAPH_VERSION}`);
  
  // Verificar se todas as credenciais estão OK
  const allConfigured = PAGES.every(p => p.id && p.token);
  if (!allConfigured) {
    console.log('\n❌ Algumas credenciais não estão configuradas!');
    return;
  }
  
  console.log('\n✅ Todas as credenciais configuradas!');
  
  // Mesma oferta do Twitter (Echo Dot)
  const offer = {
    title: 'Echo Dot 5ª Geração Smart Speaker Amazon Alexa',
    price: 269.00,
    oldPrice: 399.00,
    discount: 33,
    store: 'Amazon',
    imageUrl: 'https://m.media-amazon.com/images/I/518cRYanpbL._AC_SL1000_.jpg',
  };
  
  const formatPrice = (p: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p);
  
  // Post para Facebook
  const fbPost = `🔥 ${offer.title}

💸 De ${formatPrice(offer.oldPrice)}
✅ Por apenas ${formatPrice(offer.price)} (-${offer.discount}% OFF!)

🛒 ${offer.store}

🔗 Confira todas as ofertas em: manupromocao.com

📢 Ative as notificações para não perder nenhuma promoção!

#Promoção #Oferta #Desconto #Alexa #SmartHome #Amazon #EchoDot`;

  console.log('\n📝 Post:');
  console.log('─────────────────────────────────────────────');
  console.log(fbPost);
  console.log('─────────────────────────────────────────────');
  console.log(`📏 ${fbPost.length} caracteres`);
  console.log(`🖼️  Imagem: ${offer.imageUrl.substring(0, 50)}...`);
  
  // Postar em cada página
  console.log('\n🚀 Iniciando publicação...');
  
  const results: { page: string; result: FacebookResult }[] = [];
  
  for (const page of PAGES) {
    if (!page.id || !page.token) continue;
    
    const result = await postToPage(
      page.id, 
      page.token,
      page.name, 
      fbPost, 
      offer.imageUrl
    );
    results.push({ page: page.name, result });
    
    // Pequena pausa entre posts
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Resumo
  console.log('\n');
  console.log('═══════════════════════════════════════════════');
  console.log('   📊 RESUMO');
  console.log('═══════════════════════════════════════════════');
  
  let successCount = 0;
  results.forEach(({ page, result }) => {
    if (result.success) {
      successCount++;
      console.log(`\n✅ ${page}`);
      console.log(`   🔗 ${result.postUrl}`);
    } else {
      console.log(`\n❌ ${page}`);
      console.log(`   Erro: ${result.error}`);
    }
  });
  
  console.log(`\n📈 ${successCount}/${results.length} páginas publicadas com sucesso!`);
  console.log('');
}

main().catch(console.error);
