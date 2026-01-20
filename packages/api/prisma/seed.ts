import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // ==================== USERS ====================
  console.log('👤 Criando usuários...');
  
  const adminPassword = await bcrypt.hash('admin123', 12);
  const operatorPassword = await bcrypt.hash('operator123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@local.dev' },
    update: {},
    create: {
      email: 'admin@local.dev',
      name: 'Administrador',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operador@local.dev' },
    update: {},
    create: {
      email: 'operador@local.dev',
      name: 'Operador',
      passwordHash: operatorPassword,
      role: 'OPERATOR',
    },
  });

  console.log(`   ✓ Admin: ${admin.email} (senha: admin123)`);
  console.log(`   ✓ Operador: ${operator.email} (senha: operator123)`);

  // ==================== CONFIG ====================
  console.log('\n⚙️  Criando configurações...');
  
  await prisma.config.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      siteName: 'Max Ofertas',
      siteBaseUrl: 'http://localhost:3003',
      defaultUtmSource: 'maxofertas',
      defaultUtmMedium: 'site',
    },
  });

  // ==================== BATCH SCHEDULES ====================
  console.log('📅 Criando schedules de carga...');
  
  const schedules = ['08:00', '11:00', '14:00', '18:00', '22:00'];
  for (let i = 0; i < schedules.length; i++) {
    await prisma.batchSchedule.upsert({
      where: { time: schedules[i] },
      update: { order: i },
      create: {
        time: schedules[i],
        enabled: true,
        order: i,
      },
    });
  }
  console.log(`   ✓ ${schedules.length} horários configurados`);

  // ==================== NICHES ====================
  console.log('\n📁 Criando nichos...');
  
  const nichesData = [
    { name: 'Eletrônicos', slug: 'eletronicos', icon: '📱', color: '#3B82F6' },
    { name: 'Moda', slug: 'moda', icon: '👗', color: '#EC4899' },
    { name: 'Casa', slug: 'casa', icon: '🏠', color: '#F59E0B' },
    { name: 'Beleza', slug: 'beleza', icon: '💄', color: '#8B5CF6' },
    { name: 'Mercado', slug: 'mercado', icon: '🛒', color: '#10B981' },
    { name: 'Games', slug: 'games', icon: '🎮', color: '#EF4444' },
    { name: 'Esportes', slug: 'esportes', icon: '⚽', color: '#06B6D4' },
    { name: 'Livros', slug: 'livros', icon: '📚', color: '#6366F1' },
  ];

  const niches: any = {};
  for (const n of nichesData) {
    const niche = await prisma.niche.upsert({
      where: { slug: n.slug },
      update: { icon: n.icon, color: n.color },
      create: n,
    });
    niches[n.slug] = niche;
  }
  console.log(`   ✓ ${nichesData.length} nichos criados`);

  // ==================== STORES ====================
  console.log('\n🏪 Criando lojas...');
  
  const storesData = [
    { name: 'Amazon', slug: 'amazon' },
    { name: 'Magazine Luiza', slug: 'magalu' },
    { name: 'Casas Bahia', slug: 'casasbahia' },
    { name: 'Americanas', slug: 'americanas' },
    { name: 'Shopee', slug: 'shopee' },
    { name: 'Mercado Livre', slug: 'mercadolivre' },
    { name: 'KaBuM!', slug: 'kabum' },
    { name: 'AliExpress', slug: 'aliexpress' },
  ];

  const stores: any = {};
  for (const s of storesData) {
    const store = await prisma.store.upsert({
      where: { slug: s.slug },
      update: {},
      create: s,
    });
    stores[s.slug] = store;
  }
  console.log(`   ✓ ${storesData.length} lojas criadas`);

  // ==================== OFFERS ====================
  console.log('\n🏷️  Criando ofertas...');
  
  const offersData = [
    {
      title: 'iPhone 15 Pro Max 256GB Titânio Natural',
      description: 'O iPhone mais avançado. Chip A17 Pro, câmera de 48MP.',
      originalPrice: 9999,
      finalPrice: 7499,
      discountPct: 25,
      affiliateUrl: 'https://example.com/iphone15',
      nicheSlug: 'eletronicos',
      storeSlug: 'amazon',
      urgency: 'HOJE',
    },
    {
      title: 'Smart TV Samsung 65" 4K Neo QLED',
      description: 'TV com tecnologia Quantum Matrix para pretos perfeitos.',
      originalPrice: 5499,
      finalPrice: 3299,
      discountPct: 40,
      affiliateUrl: 'https://example.com/tv-samsung',
      nicheSlug: 'eletronicos',
      storeSlug: 'magalu',
      urgency: 'ULTIMAS_UNIDADES',
    },
    {
      title: 'Air Fryer Philips Walita 4.1L Digital',
      description: 'Fritadeira sem óleo com tecnologia Rapid Air.',
      originalPrice: 599,
      finalPrice: 299,
      discountPct: 50,
      affiliateUrl: 'https://example.com/airfryer',
      nicheSlug: 'casa',
      storeSlug: 'casasbahia',
      urgency: 'LIMITADO',
    },
    {
      title: 'Tênis Nike Air Max 90 Masculino',
      description: 'O clássico que nunca sai de moda.',
      originalPrice: 799,
      finalPrice: 449,
      discountPct: 44,
      affiliateUrl: 'https://example.com/nike-airmax',
      nicheSlug: 'moda',
      storeSlug: 'shopee',
      urgency: 'HOJE',
    },
    {
      title: 'PlayStation 5 Slim Digital 1TB',
      description: 'O console mais desejado, agora mais compacto.',
      originalPrice: 3999,
      finalPrice: 3199,
      discountPct: 20,
      affiliateUrl: 'https://example.com/ps5',
      nicheSlug: 'games',
      storeSlug: 'kabum',
      urgency: 'ULTIMAS_UNIDADES',
    },
    {
      title: 'Kit Maquiagem Ruby Rose 24 Peças',
      description: 'Kit completo com sombras, batons e mais.',
      originalPrice: 199,
      finalPrice: 89,
      discountPct: 55,
      affiliateUrl: 'https://example.com/maquiagem',
      nicheSlug: 'beleza',
      storeSlug: 'shopee',
      urgency: 'LIMITADO',
    },
    {
      title: 'Notebook Lenovo IdeaPad 3i Core i5',
      description: '8GB RAM, 256GB SSD. Ideal para trabalho.',
      originalPrice: 3299,
      finalPrice: 2199,
      discountPct: 33,
      affiliateUrl: 'https://example.com/notebook',
      nicheSlug: 'eletronicos',
      storeSlug: 'americanas',
      urgency: 'HOJE',
    },
    {
      title: 'Whey Protein Isolado 900g Growth',
      description: '27g de proteína por dose. Sabor chocolate.',
      originalPrice: 189,
      finalPrice: 119,
      discountPct: 37,
      affiliateUrl: 'https://example.com/whey',
      nicheSlug: 'esportes',
      storeSlug: 'mercadolivre',
      urgency: 'NORMAL',
    },
    {
      title: 'Echo Dot 5ª Geração com Alexa',
      description: 'Assistente virtual com som melhorado.',
      originalPrice: 449,
      finalPrice: 249,
      discountPct: 44,
      affiliateUrl: 'https://example.com/echodot',
      nicheSlug: 'eletronicos',
      storeSlug: 'amazon',
      urgency: 'HOJE',
    },
    {
      title: 'Box Harry Potter Capa Dura 7 Livros',
      description: 'Coleção completa em edição especial.',
      originalPrice: 399,
      finalPrice: 199,
      discountPct: 50,
      affiliateUrl: 'https://example.com/harrypotter',
      nicheSlug: 'livros',
      storeSlug: 'amazon',
      urgency: 'LIMITADO',
    },
  ];

  const offers: any[] = [];
  for (const o of offersData) {
    const offer = await prisma.offer.create({
      data: {
        title: o.title,
        description: o.description,
        originalPrice: o.originalPrice,
        finalPrice: o.finalPrice,
        discountPct: o.discountPct,
        affiliateUrl: o.affiliateUrl,
        nicheId: niches[o.nicheSlug].id,
        storeId: stores[o.storeSlug].id,
        urgency: o.urgency as any,
        status: 'ACTIVE',
      },
    });
    offers.push(offer);
  }
  console.log(`   ✓ ${offers.length} ofertas criadas`);

  // ==================== BATCHES DO DIA ====================
  console.log('\n📦 Criando cargas do dia...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const batches: any[] = [];
  for (const time of schedules) {
    const batch = await prisma.batch.upsert({
      where: {
        date_scheduledTime: {
          date: today,
          scheduledTime: time,
        },
      },
      update: {},
      create: {
        date: today,
        scheduledTime: time,
        status: 'PENDING',
      },
    });
    batches.push(batch);
  }
  console.log(`   ✓ ${batches.length} cargas criadas para hoje`);

  // ==================== DRAFTS ====================
  console.log('\n📝 Criando drafts...');
  
  // Distribuir ofertas entre as cargas
  let draftCount = 0;
  for (let i = 0; i < offers.length; i++) {
    const offer = offers[i];
    const batch = batches[i % batches.length];
    
    const copyTexts = [
      `🔥 OFERTA IMPERDÍVEL!\n\n${offer.title}\n\nDe R$ ${offer.originalPrice} por apenas R$ ${offer.finalPrice}!\n\n⚡ ${offer.discountPct}% de desconto - Corre!`,
      `💰 PREÇO BAIXOU!\n\n${offer.title}\n\nAntes: R$ ${offer.originalPrice}\nAgora: R$ ${offer.finalPrice}\n\n🏷️ Economize ${offer.discountPct}%!`,
      `🎯 ACHADO DO DIA!\n\n${offer.title}\n\n✅ De R$ ${offer.originalPrice}\n✅ Por R$ ${offer.finalPrice}\n\n🚀 ${offer.discountPct}% OFF!`,
    ];

    await prisma.postDraft.create({
      data: {
        offerId: offer.id,
        batchId: batch.id,
        copyText: copyTexts[i % copyTexts.length],
        channels: ['TELEGRAM', 'SITE'],
        priority: i < 3 ? 'HIGH' : 'NORMAL',
        status: 'PENDING',
        aiScore: Math.floor(Math.random() * 30) + 70, // 70-100
      },
    });
    draftCount++;
  }
  console.log(`   ✓ ${draftCount} drafts criados`);

  // Atualizar contadores dos batches
  for (const batch of batches) {
    const count = await prisma.postDraft.count({
      where: { batchId: batch.id, status: 'PENDING' },
    });
    await prisma.batch.update({
      where: { id: batch.id },
      data: { pendingCount: count },
    });
  }

  // ==================== PUBLISHED POSTS ====================
  console.log('\n🌐 Criando posts publicados...');
  
  // Publicar as 5 primeiras ofertas
  for (let i = 0; i < 5; i++) {
    const offer = offers[i];
    const goCode = nanoid(8);
    const slug = offer.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) + '-' + (i + 1);

    await prisma.publishedPost.upsert({
      where: { slug },
      update: {},
      create: {
        offerId: offer.id,
        slug,
        goCode,
        title: offer.title,
        excerpt: offer.description,
        copyText: `🔥 ${offer.title}\n\nDe R$ ${offer.originalPrice} por R$ ${offer.finalPrice}\n\n${offer.discountPct}% de desconto!`,
        price: offer.finalPrice,
        originalPrice: offer.originalPrice,
        discountPct: offer.discountPct,
        affiliateUrl: offer.affiliateUrl,
        urgency: offer.urgency,
        nicheId: offer.nicheId,
        storeId: offer.storeId,
        isActive: true,
      },
    });
  }
  console.log(`   ✓ 5 posts publicados`);

  // ==================== RESUMO ====================
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ SEED CONCLUÍDO COM SUCESSO!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('📌 Credenciais de acesso:');
  console.log('   Admin:    admin@local.dev / admin123');
  console.log('   Operador: operador@local.dev / operator123');
  console.log('');
  console.log('📌 Dados criados:');
  console.log(`   • ${Object.keys(niches).length} nichos`);
  console.log(`   • ${Object.keys(stores).length} lojas`);
  console.log(`   • ${offers.length} ofertas`);
  console.log(`   • ${batches.length} cargas (hoje)`);
  console.log(`   • ${draftCount} drafts`);
  console.log(`   • 5 posts publicados`);
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
