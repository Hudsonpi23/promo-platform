require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const offers = await prisma.offer.findMany({
    where: { status: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      title: true,
      mainImage: true,
      images: true,
      imageUrl: true,
      createdAt: true,
    }
  });

  console.log('=== ÚLTIMAS 5 OFERTAS ===\n');
  
  offers.forEach((o, i) => {
    console.log(`${i+1}. ${o.title?.substring(0, 50)}`);
    console.log(`   ID: ${o.id}`);
    console.log(`   Criado: ${o.createdAt.toLocaleString('pt-BR')}`);
    console.log(`   mainImage: ${o.mainImage?.substring(0, 80) || 'VAZIO'}`);
    console.log(`   imageUrl: ${o.imageUrl?.substring(0, 80) || 'VAZIO'}`);
    console.log(`   images (galeria): ${o.images?.length || 0} imagens`);
    
    if (o.images && o.images.length > 0) {
      o.images.forEach((img, idx) => {
        console.log(`     [${idx}] ${img.substring(0, 80)}`);
      });
    }
    console.log('');
  });

  await prisma.$disconnect();
  process.exit(0);
})();
