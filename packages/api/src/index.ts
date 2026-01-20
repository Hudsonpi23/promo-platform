import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';

// Serviços
import { configureCloudinary } from './services/cloudinary.js';

// Rotas
import { authRoutes } from './routes/auth.js';
import { configRoutes } from './routes/config.js';
import { nichesRoutes } from './routes/niches.js';
import { storesRoutes } from './routes/stores.js';
import { offersRoutes } from './routes/offers.js';
import { batchesRoutes } from './routes/batches.js';
import { draftsRoutes } from './routes/drafts.js';
import { publicationsRoutes } from './routes/publications.js';
import { trackingRoutes, statsRoutes } from './routes/tracking.js';
import { publicRoutes } from './routes/public.js';
import { uploadRoutes } from './routes/upload.js';
import mercadoLivreRoutes from './routes/sources.mercadolivre.js';

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

// Health check
server.get('/health', async () => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
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

// Sources (Providers)
server.register(mercadoLivreRoutes, { prefix: '/api/sources/mercadolivre' });

// ==================== ROTAS PÚBLICAS ====================

// Tracking /go/:code
server.register(trackingRoutes, { prefix: '/go' });

// API pública para o site
server.register(publicRoutes, { prefix: '/public' });

// ==================== START ====================

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001');
    await server.listen({ port, host: '0.0.0.0' });
    
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
    console.log(`      POST /api/sources/mercadolivre/run → Coletar ML`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
