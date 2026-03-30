import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';

// Serviços
import { configureCloudinary } from './services/cloudinary';
import { startScheduler } from './workers/schedule.js';
import { prisma } from './lib/prisma.js';

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
import { mlAuthRoutes, startMLTokenAutoRefresh } from './routes/mlAuth';
import { scraperRoutes } from './routes/scraper';
import { customPhrasesRoutes } from './routes/customPhrases';
import { autoPublishRoutes } from './routes/autoPublish';
import { videoPublishRoutes } from './routes/videoPublish';
import { metricsRoutes } from './routes/metrics';
import { imageSearchRoutes } from './routes/imageSearch';
import { amazonRoutes } from './routes/amazon';
import { twitterMetricsRoutes } from './routes/twitterMetrics';
import { instagramRoutes } from './routes/instagram';
import { startInstagramWorker } from './workers/instagramWorker';

const DEFAULT_NICHES = [
  { name: 'Eletrônicos',    slug: 'eletronicos',  icon: '📱', color: '#3B82F6' },
  { name: 'Moda',           slug: 'moda',         icon: '👗', color: '#EC4899' },
  { name: 'Casa',           slug: 'casa',         icon: '🏠', color: '#F59E0B' },
  { name: 'Beleza',         slug: 'beleza',       icon: '💄', color: '#8B5CF6' },
  { name: 'Mercado',        slug: 'mercado',      icon: '🛒', color: '#10B981' },
  { name: 'Games',          slug: 'games',        icon: '🎮', color: '#EF4444' },
  { name: 'Esportes',       slug: 'esportes',     icon: '⚽', color: '#06B6D4' },
  { name: 'Livros',         slug: 'livros',       icon: '📚', color: '#6366F1' },
  { name: 'Papelaria',      slug: 'papelaria',    icon: '✏️',  color: '#F97316' },
  { name: 'Brinquedos',     slug: 'brinquedos',   icon: '🧸', color: '#FBBF24' },
  { name: 'Pets',           slug: 'pets',         icon: '🐾', color: '#84CC16' },
  { name: 'Saúde',          slug: 'saude',        icon: '💊', color: '#14B8A6' },
  { name: 'Bebê e Criança', slug: 'bebe',         icon: '👶', color: '#A78BFA' },
  { name: 'Automotivo',     slug: 'automotivo',   icon: '🚗', color: '#64748B' },
  { name: 'Ferramentas',    slug: 'ferramentas',  icon: '🔨', color: '#78716C' },
  { name: 'Acessórios',     slug: 'acessorios',   icon: '💍', color: '#D97706' },
  { name: 'Viagem',         slug: 'viagem',       icon: '✈️',  color: '#0EA5E9' },
];

async function initDefaultNiches(): Promise<void> {
  try {
    let created = 0;
    for (const n of DEFAULT_NICHES) {
      const result = await prisma.niche.upsert({
        where: { slug: n.slug },
        update: { icon: n.icon, color: n.color, isActive: true },
        create: { ...n, isActive: true },
      });
      if (result) created++;
    }
    const existing = await prisma.niche.count({ where: { isActive: true } });
    console.log(`[Nichos] ✅ ${existing} nichos ativos (${DEFAULT_NICHES.length} padrões sincronizados)`);
  } catch (err: any) {
    console.warn('[Nichos] ⚠️  Não foi possível sincronizar nichos:', err.message);
  }
}

/**
 * Re-categoriza todas as Offers e PublishedPosts existentes no banco.
 * Executa no startup para corrigir classificações erradas de nicho.
 */
async function reCategorizeExistingOffers(): Promise<void> {
  try {
    const { detectNicheSlug } = await import('./services/nicheDetector.js');

    const allNiches = await prisma.niche.findMany({ where: { isActive: true } });
    if (allNiches.length === 0) return;

    const nicheBySlug = Object.fromEntries(allNiches.map(n => [n.slug, n]));

    // ── Re-categorizar Offers ─────────────────────────────────────────────────
    const offers = await prisma.offer.findMany({
      select: { id: true, title: true, nicheId: true },
    });

    let offersFixed = 0;
    for (const offer of offers) {
      const slug = detectNicheSlug(offer.title);
      if (!slug) continue;

      const correctNiche = nicheBySlug[slug];
      if (!correctNiche) continue;

      if (offer.nicheId !== correctNiche.id) {
        await prisma.offer.update({
          where: { id: offer.id },
          data: { nicheId: correctNiche.id },
        });
        offersFixed++;
      }
    }

    // ── Re-categorizar PublishedPosts ─────────────────────────────────────────
    const posts = await prisma.publishedPost.findMany({
      select: { id: true, title: true, nicheId: true },
    });

    let postsFixed = 0;
    for (const post of posts) {
      const slug = detectNicheSlug(post.title);
      if (!slug) continue;

      const correctNiche = nicheBySlug[slug];
      if (!correctNiche) continue;

      if (post.nicheId !== correctNiche.id) {
        await prisma.publishedPost.update({
          where: { id: post.id },
          data: { nicheId: correctNiche.id },
        });
        postsFixed++;
      }
    }

    if (offersFixed + postsFixed > 0) {
      console.log(`[Nichos] 🔁 Re-categorização: ${offersFixed} offer(s) e ${postsFixed} post(s) corrigidos`);
    } else {
      console.log(`[Nichos] ✅ Re-categorização: todos os registros já estão corretos`);
    }
  } catch (err: any) {
    console.warn('[Nichos] ⚠️  Re-categorização falhou:', err.message);
  }
}

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
  server.get('/health', async (request, reply) => {
    const dbUrl = process.env.DATABASE_URL;
    let dbStatus = 'unknown';
    let dbError: string | undefined;

    if (!dbUrl) {
      dbStatus = 'not_configured';
      dbError = 'DATABASE_URL not set';
    } else {
      try {
        const { PrismaClient } = await import('@prisma/client');
        const testPrisma = new PrismaClient();
        await testPrisma.$queryRaw`SELECT 1`;
        await testPrisma.$disconnect();
        dbStatus = 'connected';
      } catch (e: any) {
        dbStatus = 'error';
        dbError = e.message;
      }
    }

    const status = dbStatus === 'connected' ? 200 : 503;
    return reply.status(status).send({ 
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      db: dbStatus,
      ...(dbError && { dbError }),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
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
  
  // 📝 Frases Personalizadas (salvar frases criadas manualmente)
  server.register(customPhrasesRoutes, { prefix: '/api/custom-phrases' });

  // ⚡ Auto Publicar (colar links → IA cria e publica automaticamente)
  server.register(autoPublishRoutes,  { prefix: '/api/auto-publish' });
  server.register(videoPublishRoutes, { prefix: '/api/video-publish' });
  server.register(metricsRoutes,      { prefix: '/api/metrics' });
  server.register(imageSearchRoutes,  { prefix: '/api' });

  // 🛒 Amazon Creators API (busca de produtos, preços, imagens)
  server.register(amazonRoutes,         { prefix: '/api/amazon' });

  // 📊 X/Twitter Metrics (leitura de métricas, timeline, menções)
  server.register(twitterMetricsRoutes, { prefix: '/api/twitter-metrics' });

  // 📸 Instagram (carrosséis via Postfor.me)
  server.register(instagramRoutes, { prefix: '/api/instagram' });

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

    // 📁 Garantir que todos os nichos padrão existem no banco
    await initDefaultNiches();

    // 🔁 Corrigir nichos errados em offers e posts já existentes
    reCategorizeExistingOffers(); // Roda em background, não bloqueia o startup

    // 📸 Instagram Worker (fila de carrosséis/reels)
    startInstagramWorker();

    // 🔑 Auto-refresh do token do Mercado Livre (carrega do banco, renova a cada ~6h, persiste no banco)
    startMLTokenAutoRefresh();

    // ⚡ Auto-delete de ofertas relâmpago expiradas (verificar a cada 5 min)
    setInterval(async () => {
      try {
        const now = new Date();
        const expired = await prisma.offer.findMany({
          where: {
            promoType: 'RELAMPAGO',
            expiresAt: { lte: now },
          },
          select: { id: true, title: true },
        });
        if (expired.length > 0) {
          const ids = expired.map(o => o.id);
          // Deletar PublishedPosts vinculados
          await prisma.publishedPost.deleteMany({ where: { offerId: { in: ids } } });
          // Deletar as offers
          await prisma.offer.deleteMany({ where: { id: { in: ids } } });
          console.log(`[Flash] ⚡ ${expired.length} oferta(s) relâmpago expirada(s) deletada(s):`, expired.map(o => o.title));
        }
      } catch (err: any) {
        console.warn('[Flash] Erro ao limpar ofertas expiradas:', err.message);
      }
    }, 5 * 60 * 1000); // a cada 5 minutos
    
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
