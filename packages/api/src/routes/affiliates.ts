/**
 * 🔥 Central de Afiliados
 * 
 * Gerencia:
 * - AffiliateAccount (donos do tracking)
 * - AffiliateProgram (lojas/redes)
 * - AffiliateCredential (vínculo dono + loja)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import axios from 'axios';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { sendError, Errors } from '../lib/errors.js';
import { AFFILIATE_TAG, AFFILIATE_TOOL, generateAffiliateUrl, searchProducts, searchDeals, getHighQualityImageUrl } from '../services/mlAffiliate.js';
import { getMLToken } from './mlAuth.js';

// ==================== SCHEMAS ====================

const CreateAccountSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  userId: z.string().optional(),
});

const CreateProgramSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  linkMode: z.enum(['DIRECT_PASTE', 'TEMPLATE_APPEND', 'REDIRECTOR']).default('REDIRECTOR'),
  urlTemplate: z.string().nullish(),
  allowedDomains: z.array(z.string()).optional(),
  logoUrl: z.string().nullish(),
  color: z.string().nullish(),
});

type CreateProgramInput = z.infer<typeof CreateProgramSchema>;

const CreateCredentialSchema = z.object({
  accountId: z.string(),
  programId: z.string(),
  affiliateTag: z.string().optional(),
  affiliateId: z.string().optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  metadata: z.any().optional(),
});

// ==================== ROUTES ====================

export async function affiliatesRoutes(app: FastifyInstance) {
  
  // ==================== AFFILIATE ACCOUNTS ====================

  /**
   * GET /api/affiliates/accounts
   * Lista todas as contas de afiliados
   */
  app.get('/accounts', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accounts = await prisma.affiliateAccount.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          credentials: {
            include: {
              program: { select: { id: true, name: true, slug: true, logoUrl: true } },
            },
          },
          _count: { select: { offers: true } },
        },
        orderBy: { name: 'asc' },
      });
      
      return reply.send({
        success: true,
        data: accounts,
        count: accounts.length,
      });
    } catch (error: any) {
      console.error('Erro ao listar contas:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/affiliates/accounts
   * Cria uma nova conta de afiliado
   */
  app.post('/accounts', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = CreateAccountSchema.parse(request.body);
      
      // Verificar se slug já existe
      const existing = await prisma.affiliateAccount.findUnique({
        where: { slug: body.slug },
      });
      
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: 'SLUG_EXISTS', message: 'Já existe uma conta com esse slug' },
        });
      }
      
      const account = await prisma.affiliateAccount.create({
        data: {
          name: body.name,
          slug: body.slug,
          userId: body.userId || null,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      
      return reply.status(201).send({
        success: true,
        message: 'Conta criada com sucesso',
        data: account,
      });
    } catch (error: any) {
      console.error('Erro ao criar conta:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * PUT /api/affiliates/accounts/:id
   * Atualiza uma conta de afiliado
   */
  app.put('/accounts/:id', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z.object({
        name: z.string().min(2).optional(),
        isActive: z.boolean().optional(),
      }).parse(request.body);
      
      const account = await prisma.affiliateAccount.update({
        where: { id },
        data: body,
      });
      
      return reply.send({
        success: true,
        message: 'Conta atualizada',
        data: account,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar conta:', error);
      return sendError(reply, error);
    }
  });

  // ==================== AFFILIATE PROGRAMS ====================

  /**
   * GET /api/affiliates/programs
   * Lista todos os programas de afiliados
   */
  app.get('/programs', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const programs = await prisma.affiliateProgram.findMany({
        include: {
          _count: { select: { credentials: true, offers: true } },
        },
        orderBy: { name: 'asc' },
      });
      
      return reply.send({
        success: true,
        data: programs,
        count: programs.length,
      });
    } catch (error: any) {
      console.error('Erro ao listar programas:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/affiliates/programs
   * Cria um novo programa de afiliados
   */
  app.post('/programs', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = CreateProgramSchema.parse(request.body);
      
      // Verificar se slug já existe
      const existing = await prisma.affiliateProgram.findUnique({
        where: { slug: body.slug },
      });
      
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: 'SLUG_EXISTS', message: 'Já existe um programa com esse slug' },
        });
      }
      
      const program = await prisma.affiliateProgram.create({
        data: {
          name: body.name,
          slug: body.slug,
          linkMode: body.linkMode,
          urlTemplate: body.urlTemplate || null,
          allowedDomains: body.allowedDomains || [],
          logoUrl: body.logoUrl || null,
          color: body.color || null,
        },
      });
      
      return reply.status(201).send({
        success: true,
        message: 'Programa criado com sucesso',
        data: program,
      });
    } catch (error: any) {
      console.error('Erro ao criar programa:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * PUT /api/affiliates/programs/:id
   * Atualiza um programa de afiliados
   */
  app.put('/programs/:id', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z.object({
        name: z.string().min(2).optional(),
        linkMode: z.enum(['DIRECT_PASTE', 'TEMPLATE_APPEND', 'REDIRECTOR']).optional(),
        urlTemplate: z.string().optional(),
        allowedDomains: z.array(z.string()).optional(),
        logoUrl: z.string().optional(),
        color: z.string().optional(),
        isActive: z.boolean().optional(),
      }).parse(request.body);
      
      const program = await prisma.affiliateProgram.update({
        where: { id },
        data: body,
      });
      
      return reply.send({
        success: true,
        message: 'Programa atualizado',
        data: program,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar programa:', error);
      return sendError(reply, error);
    }
  });

  // ==================== AFFILIATE CREDENTIALS ====================

  /**
   * GET /api/affiliates/credentials
   * Lista todas as credenciais
   */
  app.get('/credentials', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId, programId } = request.query as { accountId?: string; programId?: string };
      
      const where: any = {};
      if (accountId) where.accountId = accountId;
      if (programId) where.programId = programId;
      
      const credentials = await prisma.affiliateCredential.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, slug: true } },
          program: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      return reply.send({
        success: true,
        data: credentials,
        count: credentials.length,
      });
    } catch (error: any) {
      console.error('Erro ao listar credenciais:', error);
      return sendError(reply, error);
    }
  });

  /**
   * POST /api/affiliates/credentials
   * Cria uma nova credencial
   */
  app.post('/credentials', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = CreateCredentialSchema.parse(request.body);
      
      // Verificar se já existe essa combinação
      const existing = await prisma.affiliateCredential.findUnique({
        where: {
          accountId_programId: {
            accountId: body.accountId,
            programId: body.programId,
          },
        },
      });
      
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: { code: 'CREDENTIAL_EXISTS', message: 'Já existe uma credencial para essa conta e programa' },
        });
      }
      
      const credential = await prisma.affiliateCredential.create({
        data: {
          accountId: body.accountId,
          programId: body.programId,
          affiliateTag: body.affiliateTag || null,
          affiliateId: body.affiliateId || null,
          apiKey: body.apiKey || null,
          apiSecret: body.apiSecret || null,
          metadata: body.metadata || null,
        },
        include: {
          account: { select: { id: true, name: true, slug: true } },
          program: { select: { id: true, name: true, slug: true } },
        },
      });
      
      return reply.status(201).send({
        success: true,
        message: 'Credencial criada com sucesso',
        data: credential,
      });
    } catch (error: any) {
      console.error('Erro ao criar credencial:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  /**
   * PUT /api/affiliates/credentials/:id
   * Atualiza uma credencial
   */
  app.put('/credentials/:id', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z.object({
        affiliateTag: z.string().optional(),
        affiliateId: z.string().optional(),
        apiKey: z.string().optional(),
        apiSecret: z.string().optional(),
        metadata: z.any().optional(),
        isActive: z.boolean().optional(),
      }).parse(request.body);
      
      const credential = await prisma.affiliateCredential.update({
        where: { id },
        data: body,
      });
      
      return reply.send({
        success: true,
        message: 'Credencial atualizada',
        data: credential,
      });
    } catch (error: any) {
      console.error('Erro ao atualizar credencial:', error);
      return sendError(reply, error);
    }
  });

  /**
   * DELETE /api/affiliates/credentials/:id
   * Remove uma credencial
   */
  app.delete('/credentials/:id', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      await prisma.affiliateCredential.delete({
        where: { id },
      });
      
      return reply.send({
        success: true,
        message: 'Credencial removida',
      });
    } catch (error: any) {
      console.error('Erro ao remover credencial:', error);
      return sendError(reply, error);
    }
  });

  // ==================== RESOLUÇÃO DE LINKS ====================

  /**
   * POST /api/affiliates/resolve-link
   * Resolve o link final de uma oferta (baseado no programa e modo)
   */
  app.post('/resolve-link', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = z.object({
        offerId: z.string().optional(),
        canonicalUrl: z.string().optional(),
        affiliateUrl: z.string().optional(),
        programId: z.string().optional(),
        accountId: z.string().optional(),
      }).parse(request.body);
      
      // Se tem offerId, buscar oferta
      let offer = null;
      if (body.offerId) {
        offer = await prisma.offer.findUnique({
          where: { id: body.offerId },
          include: {
            affiliateProgram: true,
            ownerAffiliateAccount: true,
          },
        });
      }
      
      // Determinar programa e conta
      const programId = body.programId || offer?.affiliateProgramId;
      const accountId = body.accountId || offer?.ownerAffiliateAccountId;
      
      if (!programId) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_PROGRAM', message: 'Programa de afiliados não especificado' },
        });
      }
      
      // Buscar programa
      const program = await prisma.affiliateProgram.findUnique({
        where: { id: programId },
      });
      
      if (!program) {
        return sendError(reply, Errors.NOT_FOUND('Programa'));
      }
      
      // Resolver link baseado no modo
      let finalUrl = body.affiliateUrl || offer?.affiliateUrl;
      
      switch (program.linkMode) {
        case 'DIRECT_PASTE':
          // Usar o link colado diretamente (Mercado Livre)
          if (!finalUrl) {
            return reply.status(400).send({
              success: false,
              error: { code: 'NO_AFFILIATE_URL', message: 'Link de afiliado não fornecido (modo DIRECT_PASTE)' },
            });
          }
          break;
          
        case 'TEMPLATE_APPEND':
          // Adicionar parâmetros ao link canônico
          if (program.urlTemplate && body.canonicalUrl) {
            // Buscar credencial para pegar tag
            if (accountId) {
              const credential = await prisma.affiliateCredential.findUnique({
                where: {
                  accountId_programId: { accountId, programId },
                },
              });
              
              if (credential?.affiliateTag) {
                finalUrl = program.urlTemplate
                  .replace('{canonicalUrl}', body.canonicalUrl)
                  .replace('{affiliateTag}', credential.affiliateTag);
              }
            }
          }
          break;
          
        case 'REDIRECTOR':
          // Usar sistema de redirect interno
          if (body.offerId) {
            const baseUrl = process.env.API_URL || 'https://api.promo-platform.com';
            finalUrl = `${baseUrl}/go/${body.offerId}`;
          }
          break;
      }
      
      return reply.send({
        success: true,
        data: {
          finalUrl,
          linkMode: program.linkMode,
          program: {
            id: program.id,
            name: program.name,
            slug: program.slug,
          },
        },
      });
    } catch (error: any) {
      console.error('Erro ao resolver link:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // ==================== GERADOR DE LINK DE AFILIADO ====================

  /**
   * POST /api/affiliates/generate
   * 
   * Cola qualquer URL de produto do Mercado Livre e recebe:
   * - Link de afiliado pronto
   * - Informações do produto (título, preço, desconto, imagem)
   * 
   * Aceita formatos:
   * - https://www.mercadolivre.com.br/...
   * - https://produto.mercadolivre.com.br/MLB-XXXXX
   * - https://www.mercadolivre.com.br/p/MLBXXXXX
   */
  app.post('/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = z.object({
        url: z.string().url('URL inválida'),
      }).parse(request.body);

      const productUrl = body.url.trim();

      if (!productUrl.includes('mercadolivre.com.br') && !productUrl.includes('mercadolibre.com')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_DOMAIN', message: 'URL deve ser do Mercado Livre (mercadolivre.com.br)' },
        });
      }

      const affiliateUrl = generateAffiliateUrl(productUrl);

      const itemId = extractMLItemId(productUrl);
      const productCatalogId = extractMLProductId(productUrl);

      let productInfo: any = null;

      const headers: Record<string, string> = { 'Accept': 'application/json' };
      const mlToken = getMLToken();
      if (mlToken?.access_token) {
        headers['Authorization'] = `Bearer ${mlToken.access_token}`;
      }

      if (productCatalogId) {
        try {
          const [prodResp, itemsResp] = await Promise.all([
            axios.get(`https://api.mercadolibre.com/products/${productCatalogId}`, { timeout: 8000, headers }),
            axios.get(`https://api.mercadolibre.com/products/${productCatalogId}/items?limit=1`, { timeout: 8000, headers }),
          ]);

          const prod = prodResp.data;
          const listing = itemsResp.data.results?.[0];

          // buy_box_winner só tem item_id, não price — precisamos buscar o item vencedor
          const buyBoxItemId = prod.buy_box_winner?.item_id;
          let price: number | null = null;
          let originalPrice: number | null = null;
          let winnerItemId: string | null = listing?.item_id || null;

          if (buyBoxItemId) {
            try {
              const bbResp = await axios.get(`https://api.mercadolibre.com/items/${buyBoxItemId}`, { timeout: 8000, headers });
              price = bbResp.data.price ?? null;
              originalPrice = bbResp.data.original_price ?? null;
              winnerItemId = buyBoxItemId;
            } catch {
              // fallback ao listing
              price = listing?.price ?? null;
              originalPrice = listing?.original_price ?? null;
            }
          } else {
            price = listing?.price ?? null;
            originalPrice = listing?.original_price ?? null;
          }

          const discount = originalPrice && price && originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;

          const mainPicture = prod.pictures?.[0]?.url || '';

          productInfo = {
            id: productCatalogId,
            item_id: winnerItemId,
            title: prod.name,
            price,
            original_price: originalPrice,
            discount_percentage: discount,
            thumbnail: mainPicture.replace('http://', 'https://'),
            free_shipping: listing?.shipping?.free_shipping || false,
            condition: listing?.condition || 'new',
            category_id: listing?.category_id || null,
          };
        } catch (err: any) {
          console.warn('[Affiliate Generate] Erro ao buscar produto do catálogo:', err.message);
        }
      }

      if (!productInfo && itemId) {
        try {
          const resp = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, { timeout: 8000, headers });
          const item = resp.data;

          const price = item.price;
          const originalPrice = item.original_price;
          const discount = originalPrice && originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : 0;

          productInfo = {
            id: itemId,
            item_id: itemId,
            title: item.title,
            price,
            original_price: originalPrice,
            discount_percentage: discount,
            thumbnail: (item.thumbnail || '').replace('http://', 'https://'),
            free_shipping: item.shipping?.free_shipping || false,
            condition: item.condition,
            category_id: item.category_id,
          };
        } catch (err: any) {
          console.warn('[Affiliate Generate] Erro ao buscar item:', err.message);
        }
      }

      const tweetSuggestion = productInfo ? buildTweetSuggestion(productInfo, affiliateUrl) : null;

      return reply.send({
        success: true,
        data: {
          original_url: productUrl,
          affiliate_url: affiliateUrl,
          affiliate_tag: AFFILIATE_TAG,
          affiliate_tool: AFFILIATE_TOOL,
          product: productInfo,
          tweet_suggestion: tweetSuggestion,
        },
      });
    } catch (error: any) {
      console.error('[Affiliate Generate] Erro:', error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // ==================== BUSCA MERCADO LIVRE ====================

  /**
   * POST /api/affiliates/search-ml
   * Busca produtos no Mercado Livre com links de afiliado
   */
  app.post('/search-ml', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        keywords?: string;
        category?: string;
        minDiscount?: number;
        maxPrice?: number;
        minPrice?: number;
        limit?: number;
        sort?: 'price_asc' | 'price_desc' | 'relevance';
        dealsOnly?: boolean;
      };

      if (!body.keywords && !body.category) {
        return reply.status(400).send({ error: 'Informe keywords ou category' });
      }

      const searchFn = body.dealsOnly ? searchDeals : searchProducts;
      const result = await searchFn({
        query: body.keywords,
        category: body.category,
        minDiscount: body.minDiscount,
        maxPrice: body.maxPrice,
        minPrice: body.minPrice,
        limit: body.limit || 10,
        sort: body.sort || 'relevance',
      });

      if (!result.success) {
        return reply.status(502).send({
          error: result.error || 'Falha na busca ML',
          products: [],
        });
      }

      const enhanced = result.products.map(p => ({
        ...p,
        highQualityImage: p.thumbnail ? getHighQualityImageUrl(p.thumbnail) : null,
      }));

      return {
        success: true,
        products: enhanced,
        total: result.total,
      };
    } catch (err: any) {
      console.error('[Affiliates] Erro search-ml:', err.message);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * GET /api/affiliates/search-ml/test
   * Testa se a busca ML está funcionando
   */
  app.get('/search-ml/test', { preHandler: [authGuard] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const mlToken = getMLToken();
      const result = await searchProducts({ query: 'fone bluetooth', limit: 3 });
      return {
        success: result.success,
        mlTokenPresent: !!mlToken?.access_token,
        totalFound: result.total,
        sampleProducts: result.products.slice(0, 2).map(p => ({
          title: p.title,
          price: p.price,
          discount: p.discount_percentage,
        })),
        error: result.error || null,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ==================== SEED DE PROGRAMAS POPULARES ====================

  /**
   * POST /api/affiliates/seed-programs
   * Cria os programas de afiliados populares
   */
  app.post('/seed-programs', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const programs = [
        {
          name: 'Mercado Livre',
          slug: 'mercado-livre',
          linkMode: 'DIRECT_PASTE' as const,
          allowedDomains: ['mercadolivre.com.br', 'produto.mercadolivre.com.br'],
          color: '#FFE600',
        },
        {
          name: 'Amazon Brasil',
          slug: 'amazon',
          linkMode: 'TEMPLATE_APPEND' as const,
          urlTemplate: '{canonicalUrl}?tag={affiliateTag}',
          allowedDomains: ['amazon.com.br'],
          color: '#FF9900',
        },
        {
          name: 'Shopee',
          slug: 'shopee',
          linkMode: 'DIRECT_PASTE' as const,
          allowedDomains: ['shopee.com.br'],
          color: '#EE4D2D',
        },
        {
          name: 'Magazine Luiza',
          slug: 'magalu',
          linkMode: 'REDIRECTOR' as const,
          allowedDomains: ['magazineluiza.com.br'],
          color: '#0086FF',
        },
        {
          name: 'Casas Bahia',
          slug: 'casas-bahia',
          linkMode: 'REDIRECTOR' as const,
          allowedDomains: ['casasbahia.com.br'],
          color: '#CC0000',
        },
        {
          name: 'Americanas',
          slug: 'americanas',
          linkMode: 'REDIRECTOR' as const,
          allowedDomains: ['americanas.com.br'],
          color: '#E60014',
        },
        {
          name: 'AliExpress',
          slug: 'aliexpress',
          linkMode: 'DIRECT_PASTE' as const,
          allowedDomains: ['aliexpress.com', 'pt.aliexpress.com'],
          color: '#FF4747',
        },
        {
          name: 'Kabum',
          slug: 'kabum',
          linkMode: 'REDIRECTOR' as const,
          allowedDomains: ['kabum.com.br'],
          color: '#FF6600',
        },
        {
          name: 'Pichau',
          slug: 'pichau',
          linkMode: 'REDIRECTOR' as const,
          allowedDomains: ['pichau.com.br'],
          color: '#00A651',
        },
        {
          name: 'Terabyte',
          slug: 'terabyte',
          linkMode: 'REDIRECTOR' as const,
          allowedDomains: ['terabyteshop.com.br'],
          color: '#1A237E',
        },
      ];
      
      const results = [];
      
      for (const program of programs) {
        const result = await prisma.affiliateProgram.upsert({
          where: { slug: program.slug },
          update: {}, // Não sobrescreve se já existe
          create: program,
        });
        results.push(result);
      }
      
      return reply.status(201).send({
        success: true,
        message: `${results.length} programas criados/verificados`,
        data: results,
      });
    } catch (error: any) {
      console.error('Erro ao criar programas:', error);
      return sendError(reply, error);
    }
  });
}

// ==================== HELPERS ====================

/**
 * Extrai o item ID (ex: MLB1234567890) de URLs do tipo:
 * - https://produto.mercadolivre.com.br/MLB-1234567890-titulo-...
 * - https://www.mercadolivre.com.br/MLB-1234567890
 */
function extractMLItemId(url: string): string | null {
  // Remove segmentos /p/MLB... (catalog IDs) para não confundi-los com item IDs
  const withoutCatalog = url.replace(/\/p\/MLB\d+/gi, '');
  const match = withoutCatalog.match(/MLB[- ]?\d{8,14}/i);
  if (match) {
    return match[0].replace(/-/g, '').replace(/ /g, '');
  }
  return null;
}

/**
 * Extrai o product catalog ID de URLs do tipo:
 * - https://www.mercadolivre.com.br/p/MLB12345678
 */
function extractMLProductId(url: string): string | null {
  const match = url.match(/\/p\/(MLB\d+)/i);
  return match ? match[1] : null;
}

/**
 * Gera uma sugestão de tweet com base nas info do produto
 */
function buildTweetSuggestion(product: any, affiliateUrl: string): string | null {
  if (!product?.title || !product?.price) return null;

  const title = product.title.length > 60
    ? product.title.substring(0, 57) + '...'
    : product.title;

  let tweet = '';

  if (product.discount_percentage >= 30) {
    tweet += `🔥 OFERTAÇO COM ${product.discount_percentage}% OFF!\n`;
  } else if (product.discount_percentage > 0) {
    tweet += `💰 ${product.discount_percentage}% DE DESCONTO!\n`;
  } else {
    tweet += `⚡ PREÇO IMPERDÍVEL!\n`;
  }

  tweet += `${title}\n`;

  if (product.original_price && product.discount_percentage > 0) {
    tweet += `De R$${product.original_price.toFixed(2)} por R$${product.price.toFixed(2)}\n`;
  } else {
    tweet += `Por apenas R$${product.price.toFixed(2)}\n`;
  }

  if (product.free_shipping) {
    tweet += `✅ Frete Grátis\n`;
  }

  tweet += `\n${affiliateUrl}`;

  if (tweet.length > 280) {
    const excess = tweet.length - 280;
    const shorterTitle = product.title.substring(0, Math.max(20, 57 - excess)) + '...';
    tweet = tweet.replace(title, shorterTitle);
  }

  return tweet;
}
