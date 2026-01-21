import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanFakeData() {
  console.log('🧹 LIMPANDO DADOS FAKE...\n');

  // 1. Apagar todos os posts publicados
  console.log('🗑️  Apagando posts publicados fake...');
  const deletedPublished = await prisma.publishedPost.deleteMany({});
  console.log(`   ✓ ${deletedPublished.count} posts publicados removidos`);

  // 2. Apagar todos os clicks
  console.log('🗑️  Apagando histórico de clicks...');
  const deletedClicks = await prisma.click.deleteMany({});
  console.log(`   ✓ ${deletedClicks.count} clicks removidos`);

  // 3. Apagar todos os deliveries
  console.log('🗑️  Apagando deliveries...');
  const deletedDeliveries = await prisma.postDelivery.deleteMany({});
  console.log(`   ✓ ${deletedDeliveries.count} deliveries removidos`);

  // 4. Apagar todos os drafts
  console.log('🗑️  Apagando drafts fake...');
  const deletedDrafts = await prisma.postDraft.deleteMany({});
  console.log(`   ✓ ${deletedDrafts.count} drafts removidos`);

  // 5. Apagar todas as ofertas
  console.log('🗑️  Apagando ofertas fake...');
  const deletedOffers = await prisma.offer.deleteMany({});
  console.log(`   ✓ ${deletedOffers.count} ofertas removidas`);

  // 6. Apagar batches (cargas)
  console.log('🗑️  Apagando batches/cargas...');
  const deletedBatches = await prisma.batch.deleteMany({});
  console.log(`   ✓ ${deletedBatches.count} batches removidos`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ LIMPEZA CONCLUÍDA!');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('📌 O QUE FOI MANTIDO:');
  
  const niches = await prisma.niche.count();
  const stores = await prisma.store.count();
  const users = await prisma.user.count();
  const schedules = await prisma.batchSchedule.count();
  const mlConfig = await prisma.providerConfig.count();
  
  console.log(`   • ${niches} nichos`);
  console.log(`   • ${stores} lojas`);
  console.log(`   • ${users} usuários`);
  console.log(`   • ${schedules} schedules de carga`);
  console.log(`   • ${mlConfig} configuração(ões) de provider (ML)`);
  
  console.log('\n📌 PLATAFORMA PRONTA PARA:');
  console.log('   1. Coletar ofertas REAIS do Mercado Livre');
  console.log('   2. Criar drafts com promoções VERDADEIRAS');
  console.log('   3. Operador revisar e aprovar');
  console.log('   4. Publicar no site e canais');
  
  console.log('\n🎯 PRÓXIMO PASSO:');
  console.log('   Testar busca real do Mercado Livre!');
  console.log('');
}

cleanFakeData()
  .catch((error) => {
    console.error('❌ Erro ao limpar dados:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
