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
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { sendError, Errors } from '../lib/errors.js';

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
  urlTemplate: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
  logoUrl: z.string().optional(),
  color: z.string().optional(),
});

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
        data: body,
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
        data: body,
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
        data: body,
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
  app.post('/resolve-link', { preHandler: [authGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
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
