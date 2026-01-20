import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

// Helper para gerar copy humana (sem robô vibes)
function generateHumanCopy(title: string, originalPrice: number, finalPrice: number): {
  telegram: string;
  site: string;
  x: string;
} {
  const openings = [
    'Achei isso agora.',
    'Olha o que apareceu.',
    'Esse preço chamou atenção.',
    'Fazia tempo que não via assim.',
    'Pra quem tava esperando baixar...',
    'Tava olhando e vi isso.',
  ];
  
  const opening = openings[Math.floor(Math.random() * openings.length)];
  const priceLine = `Caiu de R$ ${originalPrice.toLocaleString('pt-BR')} pra R$ ${finalPrice.toLocaleString('pt-BR')}.`;
  
  const telegram = `${opening}\n${priceLine}\n\nNão sei até quando fica assim.\n\nhttps://link.exemplo.com`;
  const site = `${opening}\n${priceLine}`;
  const x = `${opening}\nDe R$ ${originalPrice.toLocaleString('pt-BR')} por R$ ${finalPrice.toLocaleString('pt-BR')}\n\nhttps://link.exemplo.com`;
  
  return { telegram, site, x };
}

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
      siteName: 'Manu das Promoções',
      siteBaseUrl: 'http://localhost:3003',
      defaultUtmSource: 'manupromocoes',
      defaultUtmMedium: 'site',
      twitterHandle: '@manupromocao',
      telegramChannel: '@manupromocao',
    },
  });
  
  // ==================== PROVIDER CONFIG (Mercado Livre) ====================
  console.log('\n🔧 Criando configuração do Mercado Livre...');
  
  await prisma.providerConfig.upsert({
    where: { source: 'MERCADO_LIVRE' },
    update: {},
    create: {
      source: 'MERCADO_LIVRE',
      enabled: true,
      keywords: ['iphone', 'samsung', 'notebook', 'tv 4k', 'air fryer', 'playstation', 'nike', 'adidas'],
      categories: ['MLB1055', 'MLB1648', 'MLB1002', 'MLB1574', 'MLB1144', 'MLB3530'],
      minDiscount: 20,
      minPrice: 50,
      conditionFilter: ['new'],
      maxItemsPerRun: 50,
      enableX: true,
      xDailyLimit: 30,
      xMinScore: 60,
      scheduleTimes: ['08:00', '11:00', '14:00', '18:00', '22:00'],
    },
  });
  console.log('   ✓ Mercado Livre configurado');

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

  // Ofertas do Mercado Livre (com copy humana)
  const mlOffersData = [
    {
      title: 'iPhone 14 Pro Max 256GB Roxo Profundo',
      originalPrice: 8999,
      finalPrice: 5999,
      discountPct: 33,
      affiliateUrl: 'https://mercadolivre.com.br/iphone14',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_iphone14.jpg',
      nicheSlug: 'eletronicos',
      sellerName: 'TECHSTORE_OFICIAL',
      externalId: 'MLB1234567890',
    },
    {
      title: 'Samsung Galaxy S24 Ultra 512GB Titanium Black',
      originalPrice: 7499,
      finalPrice: 4799,
      discountPct: 36,
      affiliateUrl: 'https://mercadolivre.com.br/samsung-s24',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_samsung_s24.jpg',
      nicheSlug: 'eletronicos',
      sellerName: 'SAMSUNG_STORE',
      externalId: 'MLB1234567891',
    },
    {
      title: 'Smart TV LG 55" 4K OLED C3 120Hz Gaming',
      originalPrice: 6999,
      finalPrice: 4199,
      discountPct: 40,
      affiliateUrl: 'https://mercadolivre.com.br/lg-oled',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_lg_oled.jpg',
      nicheSlug: 'eletronicos',
      sellerName: 'LG_STORE',
      externalId: 'MLB1234567893',
    },
    {
      title: 'Air Fryer Philips Walita 4.1L Digital XXL',
      originalPrice: 699,
      finalPrice: 349,
      discountPct: 50,
      affiliateUrl: 'https://mercadolivre.com.br/philips-airfryer',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_airfryer.jpg',
      nicheSlug: 'casa',
      sellerName: 'PHILIPS_OFICIAL',
      externalId: 'MLB3234567890',
    },
    {
      title: 'Tênis Nike Air Max 90 Essential Masculino',
      originalPrice: 799,
      finalPrice: 449,
      discountPct: 44,
      affiliateUrl: 'https://mercadolivre.com.br/nike-air-max',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_nike_airmax.jpg',
      nicheSlug: 'moda',
      sellerName: 'NIKE_OFICIAL',
      externalId: 'MLB2234567890',
    },
    {
      title: 'PlayStation 5 Slim Digital Edition 1TB',
      originalPrice: 4499,
      finalPrice: 3199,
      discountPct: 29,
      affiliateUrl: 'https://mercadolivre.com.br/ps5-slim',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_ps5_slim.jpg',
      nicheSlug: 'games',
      sellerName: 'PLAYSTATION_BR',
      externalId: 'MLB4234567890',
    },
    {
      title: 'Dyson Airwrap Complete Styler Multi-uso',
      originalPrice: 4299,
      finalPrice: 2999,
      discountPct: 30,
      affiliateUrl: 'https://mercadolivre.com.br/dyson-airwrap',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_dyson_airwrap.jpg',
      nicheSlug: 'beleza',
      sellerName: 'DYSON_BRASIL',
      externalId: 'MLB5234567890',
    },
    {
      title: 'Robô Aspirador iRobot Roomba i7+ Mapeamento',
      originalPrice: 4999,
      finalPrice: 2999,
      discountPct: 40,
      affiliateUrl: 'https://mercadolivre.com.br/roomba-i7',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_roomba.jpg',
      nicheSlug: 'casa',
      sellerName: 'IROBOT_BRASIL',
      externalId: 'MLB3234567891',
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
  console.log(`   ✓ ${offers.length} ofertas manuais criadas`);

  // ==================== OFERTAS MERCADO LIVRE ====================
  console.log('\n🛒 Criando ofertas do Mercado Livre...');
  
  const mlOffers: any[] = [];
  for (const o of mlOffersData) {
    // Criar ou buscar store do seller
    const sellerSlug = o.sellerName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    let sellerStore = await prisma.store.findFirst({ where: { slug: sellerSlug } });
    if (!sellerStore) {
      sellerStore = await prisma.store.create({
        data: { name: o.sellerName, slug: sellerSlug }
      });
    }

    const offer = await prisma.offer.create({
      data: {
        title: o.title,
        originalPrice: o.originalPrice,
        finalPrice: o.finalPrice,
        discountPct: o.discountPct,
        affiliateUrl: o.affiliateUrl,
        imageUrl: o.imageUrl,
        nicheId: niches[o.nicheSlug].id,
        storeId: sellerStore.id,
        source: 'MERCADO_LIVRE',
        externalId: o.externalId,
        productUrl: o.affiliateUrl,
        sellerName: o.sellerName,
        sellerReputation: '5_green',
        condition: 'new',
        urgency: o.discountPct >= 40 ? 'HOJE' : 'NORMAL',
        status: 'ACTIVE',
      },
    });
    mlOffers.push({ ...offer, originalPrice: o.originalPrice, finalPrice: o.finalPrice });
  }
  console.log(`   ✓ ${mlOffers.length} ofertas Mercado Livre criadas`);

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
  console.log(`   ✓ ${draftCount} drafts manuais criados`);

  // ==================== DRAFTS MERCADO LIVRE (com copy humana) ====================
  console.log('\n📝 Criando drafts Mercado Livre com copy humana...');
  
  let mlDraftCount = 0;
  for (let i = 0; i < mlOffers.length; i++) {
    const offer = mlOffers[i];
    const batch = batches[i % batches.length];
    
    // Gerar copy humana (sem robô vibes!)
    const copies = generateHumanCopy(offer.title, offer.originalPrice, offer.finalPrice);
    
    // Calcular score (40% desconto = +40 pontos)
    const discount = offer.discountPct;
    let score = 0;
    if (discount >= 40) score += 40;
    else if (discount >= 25) score += 20;
    else score += 10;
    score += 10; // boa reputação
    if (offer.imageUrl) score += 0; else score -= 15;
    
    // Determinar canais (X só se score >= 60 e tem imagem)
    const channels = ['TELEGRAM', 'SITE'];
    const requiresHumanForX = score >= 60 && offer.imageUrl;
    if (requiresHumanForX) {
      channels.push('TWITTER');
    }

    await prisma.postDraft.create({
      data: {
        offerId: offer.id,
        batchId: batch.id,
        copyText: copies.telegram,
        copyTextTelegram: copies.telegram,
        copyTextSite: copies.site,
        copyTextX: copies.x,
        channels,
        priority: score >= 50 ? 'HIGH' : 'NORMAL',
        status: 'PENDING',
        score,
        imageUrl: offer.imageUrl,
        requiresImage: channels.includes('TWITTER'),
        requiresHumanForX,
      },
    });
    mlDraftCount++;
  }
  console.log(`   ✓ ${mlDraftCount} drafts ML criados (copy humana)`);

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
  console.log(`   • ${Object.keys(stores).length}+ lojas`);
  console.log(`   • ${offers.length} ofertas manuais`);
  console.log(`   • ${mlOffers.length} ofertas Mercado Livre`);
  console.log(`   • ${batches.length} cargas (hoje)`);
  console.log(`   • ${draftCount} drafts manuais`);
  console.log(`   • ${mlDraftCount} drafts ML (copy humana)`);
  console.log(`   • 5 posts publicados`);
  console.log('');
  console.log('📌 Mercado Livre:');
  console.log('   • Provider configurado (keywords, categorias, filtros)');
  console.log('   • X habilitado (limite 30/dia, score mín 60)');
  console.log('   • Copy humana sem "robô vibes"');
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
