import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/auth.js';

export async function seedRoutes(app: FastifyInstance) {
  /**
   * POST /api/seed
   * Endpoint temporário para executar seed do banco de dados
   * ATENÇÃO: Este endpoint deve ser protegido em produção!
   */
  app.post('/seed', async (request, reply) => {
    try {
      console.log('🌱 Iniciando seed do banco de dados...');

      // Verificar se já existe usuário admin
      const existingAdmin = await prisma.user.findUnique({
        where: { email: 'admin@example.com' },
      });

      if (existingAdmin) {
        return reply.status(200).send({
          success: true,
          message: 'Usuário admin já existe',
          user: {
            email: existingAdmin.email,
            name: existingAdmin.name,
            role: existingAdmin.role,
          },
        });
      }

      // Criar usuário admin
      const passwordHash = await hashPassword('password');
      
      const admin = await prisma.user.create({
        data: {
          name: 'Admin',
          email: 'admin@example.com',
          passwordHash,
          role: 'ADMIN',
          isActive: true,
        },
      });

      console.log('✅ Usuário admin criado com sucesso!');

      // Verificar se existem nichos, se não criar alguns básicos
      const nichesCount = await prisma.niche.count();
      
      if (nichesCount === 0) {
        console.log('🏷️ Criando nichos básicos...');
        
        await prisma.niche.createMany({
          data: [
            { name: 'Eletrônicos', slug: 'eletronicos', icon: '📱', isActive: true },
            { name: 'Moda', slug: 'moda', icon: '👗', isActive: true },
            { name: 'Casa', slug: 'casa', icon: '🏠', isActive: true },
            { name: 'Beleza', slug: 'beleza', icon: '💄', isActive: true },
            { name: 'Mercado', slug: 'mercado', icon: '🛒', isActive: true },
          ],
        });
        
        console.log('✅ Nichos criados!');
      }

      // Verificar se existem lojas, se não criar algumas básicas
      const storesCount = await prisma.store.count();
      
      if (storesCount === 0) {
        console.log('🏪 Criando lojas básicas...');
        
        await prisma.store.createMany({
          data: [
            { name: 'Mercado Livre', slug: 'mercado-livre', isActive: true },
            { name: 'Amazon', slug: 'amazon', isActive: true },
            { name: 'Magazine Luiza', slug: 'magazine-luiza', isActive: true },
            { name: 'Casas Bahia', slug: 'casas-bahia', isActive: true },
          ],
        });
        
        console.log('✅ Lojas criadas!');
      }

      // Criar schedules de cargas se não existirem
      const schedulesCount = await prisma.batchSchedule.count();
      
      if (schedulesCount === 0) {
        console.log('📅 Criando schedules de cargas...');
        
        await prisma.batchSchedule.createMany({
          data: [
            { time: '08:00', enabled: true, order: 1 },
            { time: '11:00', enabled: true, order: 2 },
            { time: '14:00', enabled: true, order: 3 },
            { time: '18:00', enabled: true, order: 4 },
            { time: '22:00', enabled: true, order: 5 },
          ],
        });
        
        console.log('✅ Schedules criados!');
      }

      return reply.status(200).send({
        success: true,
        message: 'Seed executado com sucesso!',
        created: {
          user: {
            email: admin.email,
            name: admin.name,
            role: admin.role,
          },
          niches: nichesCount === 0 ? 5 : 0,
          stores: storesCount === 0 ? 4 : 0,
          schedules: schedulesCount === 0 ? 5 : 0,
        },
      });
    } catch (error: any) {
      console.error('❌ Erro ao executar seed:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });
}
