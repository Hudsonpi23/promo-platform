import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';

// Serviços
import { configureCloudinary } from './services/cloudinary';
import { startScheduler } from './workers/schedule.js';

// Rotas
import { authRoutes } from './routes/auth';
import { configRoutes } from './routes/config';
import { nichesRoutes } from './routes/niches';
import { storesRoutes } from './routes/stores';
import { offersRoutes } from './routes/offers';
import { batchesRoutes } from './routes/batches';
import { draftsRoutes } from './routes/drafts';
import { publicationsRoutes } from './routes/publications';
import { trackingRoutes, statsRoutes } from './routes/tracking';
import { publicRoutes } from './routes/public';
import { uploadRoutes } from './routes/upload';
import { seedRoutes } from './routes/seed';
import { twitterRoutes } from './routes/twitter';
import { telegramRoutes } from './routes/telegram';
import { facebookRoutes } from './routes/facebook';
import { promotionChannelsRoutes } from './routes/promotionChannels';
import { schedulerRoutes } from './routes/scheduler';
import { affiliatesRoutes } from './routes/affiliates';
import { manualRoutes } from './routes/manual';
import { aiWorkflowRoutes } from './routes/aiWorkflow';
import { autoPromoterRoutes } from './routes/autoPromoterFastify';
import { mlAuthRoutes } from './routes/mlAuth';
import { scraperRoutes } from './routes/scraper';

async function main() {
  const server = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    },
  });

  // CORS
  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  // Cookies
  await server.register(cookie, {
    secret: process.env.JWT_SECRET || 'cookie-secret', // Para signed cookies
  });

  // JWT
  await server.register(jwt, {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
  });

  // Multipart (para upload de arquivos)
  await server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // Configurar Cloudinary
  const cloudinaryOk = configureCloudinary();
  if (!cloudinaryOk) {
    console.warn('⚠️  Cloudinary não configurado - uploads desabilitados');
  }

  // Rota raiz - Boas-vindas
  server.get('/', async () => {
    return {
      message: '🎉 Bem-vindo à API Manu das Promoções!',
      version: '1.0.0',
      status: 'online',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        publicFeed: '/public/feed',
        login: '/auth/login',
        docs: 'https://github.com/Hudsonpi23/promo-platform'
      }
    };
  });

  // Health check
  server.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  });

  // Setup/Seed - Criar usuário admin (endpoint público temporário)
  server.get('/setup', async (request, reply) => {
    const { PrismaClient } = await import('@prisma/client');
    const bcrypt = await import('bcryptjs');
    const prisma = new PrismaClient();

    try {
      // Verificar se já existe
      const existing = await prisma.user.findUnique({
        where: { email: 'admin@example.com' },
      });

      if (existing) {
        await prisma.$disconnect();
        return { success: true, message: 'Admin já existe', email: existing.email };
      }

      // Criar admin
      const passwordHash = await bcrypt.hash('password', 10);
      const admin = await prisma.user.create({
        data: {
          name: 'Admin',
          email: 'admin@example.com',
          passwordHash,
          role: 'ADMIN',
          isActive: true,
        },
      });

      // Criar nichos básicos
      await prisma.niche.createMany({
        data: [
          { name: 'Eletrônicos', slug: 'eletronicos', icon: '📱', isActive: true },
          { name: 'Moda', slug: 'moda', icon: '👗', isActive: true },
          { name: 'Casa', slug: 'casa', icon: '🏠', isActive: true },
          { name: 'Beleza', slug: 'beleza', icon: '💄', isActive: true },
          { name: 'Mercado', slug: 'mercado', icon: '🛒', isActive: true },
        ],
        skipDuplicates: true,
      });

      // Criar lojas básicas
      await prisma.store.createMany({
        data: [
          { name: 'Mercado Livre', slug: 'mercado-livre', isActive: true },
          { name: 'Amazon', slug: 'amazon', isActive: true },
          { name: 'Magazine Luiza', slug: 'magazine-luiza', isActive: true },
          { name: 'Casas Bahia', slug: 'casas-bahia', isActive: true },
        ],
        skipDuplicates: true,
      });

      await prisma.$disconnect();
      return { 
        success: true, 
        message: 'Setup completo!',
        admin: { email: admin.email, name: admin.name },
      };
    } catch (error: any) {
      await prisma.$disconnect();
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ==================== ROTAS PRIVADAS (API) ====================

  // Auth
  server.register(authRoutes, { prefix: '/auth' });

  // Config
  server.register(configRoutes, { prefix: '/api/config' });

  // Resources
  server.register(nichesRoutes, { prefix: '/api/niches' });
  server.register(storesRoutes, { prefix: '/api/stores' });
  server.register(offersRoutes, { prefix: '/api/offers' });

  // Cargas e Drafts
  server.register(batchesRoutes, { prefix: '/api/batches' });
  server.register(draftsRoutes, { prefix: '/api/drafts' });

  // Publicações
  server.register(publicationsRoutes, { prefix: '/api/publications' });

  // Stats
  server.register(statsRoutes, { prefix: '/api/stats' });

  // Upload (Cloudinary)
  server.register(uploadRoutes, { prefix: '/api' });

  // Seed - Inicialização do banco (temporário)
  server.register(seedRoutes, { prefix: '/api' });

  // Twitter/X - Postagem em redes sociais
  server.register(twitterRoutes, { prefix: '/api/twitter' });

  // Telegram - Postagem no canal
  server.register(telegramRoutes, { prefix: '/api/telegram' });

  // Facebook - Postagem na página
  server.register(facebookRoutes, { prefix: '/api/facebook' });

  // 🔥 NOVO: Canais de Promoção (estados por canal)
  server.register(promotionChannelsRoutes, { prefix: '/api/drafts' });

  // 🔥 NOVO: Sistema de Filas por Canal
  server.register(schedulerRoutes, { prefix: '/api/scheduler' });

  // 🔥 NOVO: Central de Afiliados
  server.register(affiliatesRoutes, { prefix: '/api/affiliates' });

  // 🔥 NOVO: Operação Manual (Copy/Paste)
  server.register(manualRoutes, { prefix: '/api/manual' });

  // 🤖 NOVO v2.0: AI Workflow (Curadoria + Agentes)
  server.register(aiWorkflowRoutes, { prefix: '/api/ai' });

  // 🚀 NOVO: Auto Promoter (ML → Redes Sociais)
  server.register(autoPromoterRoutes, { prefix: '/api/auto-promoter' });

  // 🔐 NOVO: Autenticação OAuth2 do Mercado Livre
  server.register(mlAuthRoutes);

  // 🔍 NOVO: Scraper de Produtos (Auto-preencher ofertas)
  server.register(scraperRoutes, { prefix: '/api/scraper' });

  // ==================== ROTAS PÚBLICAS ====================

  // Tracking /go/:code
  server.register(trackingRoutes, { prefix: '/go' });

  // API pública para o site
  server.register(publicRoutes, { prefix: '/public' });

  // ==================== START ====================

  try {
    const port = parseInt(process.env.PORT || '3001');
    await server.listen({ port, host: '0.0.0.0' });
    
    // 🔥 Iniciar scheduler automático (processa filas a cada 1 minuto)
    startScheduler();
    
    console.log('');
    console.log('🚀 ═══════════════════════════════════════════════════');
    console.log(`   API rodando em http://localhost:${port}`);
    console.log('   ───────────────────────────────────────────────────');
    console.log('   📌 Endpoints principais:');
    console.log(`      POST /auth/login           → Login`);
    console.log(`      GET  /api/batches          → Listar cargas`);
    console.log(`      GET  /api/drafts           → Listar drafts`);
    console.log(`      GET  /api/offers           → Listar ofertas`);
    console.log(`      GET  /api/publications     → Listar publicações`);
    console.log(`      POST /api/upload/url       → Upload via URL`);
    console.log(`      POST /api/upload/file      → Upload arquivo`);
    console.log(`      GET  /public/feed          → Feed público`);
    console.log(`      GET  /go/:code             → Redirect c/ tracking`);
    console.log(`      POST /api/scheduler/run    → Executar scheduler`);
    console.log(`      GET  /api/manual/queue     → Fila manual copy/paste`);
    console.log('   ⏰ Scheduler automático: ATIVO (1 min)');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  } catch (err: any) {
    console.error('❌ Erro ao iniciar servidor:');
    console.error('   Mensagem:', err.message);
    console.error('   Stack:', err.stack);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Erro fatal na inicialização:');
  console.error('   Mensagem:', err.message);
  console.error('   Stack:', err.stack);
  process.exit(1);
});
