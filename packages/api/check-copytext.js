require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const offer = await prisma.offer.findUnique({
    where: { id: 'cmkud4vfz00011bouahddvkt2' },
    select: {
      title: true,
      copyText: true,
      finalPrice: true,
      originalPrice: true,
      discountPct: true,
      affiliateUrl: true,
      store: { select: { name: true } }
    }
  });

  console.log('=== OFERTA DO BRINCO ===\n');
  console.log('Titulo:', offer.title);
  console.log('copyText:', offer.copyText || '❌ VAZIO!');
  console.log('Preco:', offer.finalPrice);
  console.log('Loja:', offer.store?.name);
  console.log('Desconto:', offer.discountPct || 0, '%');

  await prisma.$disconnect();
  process.exit(0);
})();
