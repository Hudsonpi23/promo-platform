require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const result = await prisma.offer.update({
    where: { id: 'cmkud4vfz00011bouahddvkt2' },
    data: { images: [] }
  });
  
  console.log('✅ Galeria limpa!');
  console.log('Agora só vai usar mainImage:', result.mainImage?.substring(0, 80));
  
  await prisma.$disconnect();
  process.exit(0);
})();
