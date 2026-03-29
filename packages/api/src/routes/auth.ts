import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword, hashToken, verifyToken, authGuard } from '../lib/auth.js';
import { loginSchema, refreshSchema } from '../lib/schemas.js';
import { AppError, sendError, Errors } from '../lib/errors.js';

export async function authRoutes(app: FastifyInstance) {
  // TEMPORARY - setup Manu user + debug (remover depois do setup)
  app.post('/setup-manu', async (request, reply) => {
    try {
      const email = 'manu.orquestradora@manu-promocoes.com.br';
      const password = 'ManuOrq2026Promo';
      const hash = await hashPassword(password);
      
      const user = await prisma.user.upsert({
        where: { email },
        update: { passwordHash: hash },
        create: {
          name: 'Manu Orquestradora',
          email,
          passwordHash: hash,
          role: 'ADMIN',
          isActive: true,
        },
      });
      
      const match = await verifyPassword(password, user.passwordHash);
      
      return {
        status: 'OK',
        userId: user.id,
        email: user.email,
        role: user.role,
        active: user.isActive,
        passwordVerified: match,
      };
    } catch (e: any) {
      return { status: 'ERROR', message: e.message };
    }
  });

  // POST /auth/login
  app.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      console.log('[Auth Debug] Login attempt for:', body.email);
      
      // Buscar usuário
      const user = await prisma.user.findUnique({
        where: { email: body.email },
      });

      console.log('[Auth Debug] User lookup result:', user ? `found (${user.email}, active=${user.isActive})` : 'NOT FOUND');
      if (!user || !user.isActive) {
        return sendError(reply, Errors.INVALID_CREDENTIALS);
      }

      // Verificar senha
      console.log('[Auth Debug] User found:', user.email, '| hashStart:', user.passwordHash.substring(0, 20), '| passLength:', body.password.length);
      const validPassword = await verifyPassword(body.password, user.passwordHash);
      console.log('[Auth Debug] Password match result:', validPassword);
      if (!validPassword) {
        return sendError(reply, Errors.INVALID_CREDENTIALS);
      }

      // Gerar tokens (90 dias para não precisar relogar)
      const accessToken = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '90d' } // 90 dias
      );

      const refreshTokenRaw = nanoid(64);
      const refreshTokenHash = await hashToken(refreshTokenRaw);

      // Salvar refresh token (90 dias)
      await prisma.refreshToken.create({
        data: {
          tokenHash: refreshTokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 dias
        },
      });

      return {
        data: {
          accessToken,
          refreshToken: refreshTokenRaw,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
      };
    } catch (error: any) {
      console.error('[Auth] Erro no login:', error?.message || error);
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // POST /auth/refresh
  app.post('/refresh', async (request, reply) => {
    try {
      const body = refreshSchema.parse(request.body);

      // Buscar todos os tokens do usuário não revogados e não expirados
      const tokens = await prisma.refreshToken.findMany({
        where: {
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      // Verificar qual token corresponde
      let validToken = null;
      for (const token of tokens) {
        const isValid = await verifyToken(body.refreshToken, token.tokenHash);
        if (isValid) {
          validToken = token;
          break;
        }
      }

      if (!validToken || !validToken.user.isActive) {
        return sendError(reply, Errors.TOKEN_INVALID);
      }

      // Revogar token antigo
      await prisma.refreshToken.update({
        where: { id: validToken.id },
        data: { revokedAt: new Date() },
      });

      // Gerar novos tokens (90 dias)
      const user = validToken.user;
      const accessToken = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '90d' } // 90 dias
      );

      const refreshTokenRaw = nanoid(64);
      const refreshTokenHash = await hashToken(refreshTokenRaw);

      await prisma.refreshToken.create({
        data: {
          tokenHash: refreshTokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 dias
        },
      });

      return {
        data: {
          accessToken,
          refreshToken: refreshTokenRaw,
        },
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // POST /auth/logout
  app.post('/logout', async (request, reply) => {
    try {
      const body = refreshSchema.parse(request.body);

      // Buscar e revogar o token
      const tokens = await prisma.refreshToken.findMany({
        where: { revokedAt: null },
      });

      for (const token of tokens) {
        const isValid = await verifyToken(body.refreshToken, token.tokenHash);
        if (isValid) {
          await prisma.refreshToken.update({
            where: { id: token.id },
            data: { revokedAt: new Date() },
          });
          break;
        }
      }

      return reply.status(204).send();
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return sendError(reply, Errors.VALIDATION_ERROR(error.errors));
      }
      return sendError(reply, error);
    }
  });

  // GET /auth/me
  app.get('/me', { preHandler: [authGuard] }, async (request, reply) => {
    try {
      const tokenUser = request.user as { id: string };

      const user = await prisma.user.findUnique({
        where: { id: tokenUser.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      if (!user) {
        return sendError(reply, Errors.NOT_FOUND('Usuário'));
      }

      return { data: user };
    } catch (error: any) {
      return sendError(reply, error);
    }
  });
}
