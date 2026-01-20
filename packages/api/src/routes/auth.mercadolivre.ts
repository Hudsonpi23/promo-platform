/**
 * Rotas de OAuth do Mercado Livre
 * 
 * GET  /api/auth/mercadolivre/connect    - Inicia fluxo OAuth
 * GET  /api/auth/mercadolivre/callback   - Callback do ML após autorização
 * POST /api/auth/mercadolivre/refresh    - Renova token manualmente
 * GET  /api/auth/mercadolivre/status     - Status da conexão
 * DELETE /api/auth/mercadolivre/disconnect - Desconecta conta
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';

const prisma = new PrismaClient();

// Helper para gerar base64url (PKCE)
function base64url(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

// Configuração do ML (vem das variáveis de ambiente)
const ML_CONFIG = {
  clientId: process.env.ML_CLIENT_ID || '',
  clientSecret: process.env.ML_CLIENT_SECRET || '',
  redirectUri: process.env.ML_REDIRECT_URI || '',
  authUrl: 'https://auth.mercadolivre.com.br/authorization',
  tokenUrl: 'https://api.mercadolibre.com/oauth/token',
  apiUrl: 'https://api.mercadolibre.com',
};

// ==================== ROUTES ====================

export async function mercadoLivreAuthRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/auth/mercadolivre/connect
   * Redireciona o usuário para o Mercado Livre para autorização
   */
  fastify.get('/connect', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ML_CONFIG.clientId || !ML_CONFIG.redirectUri) {
      return reply.status(500).send({
        success: false,
        error: 'Mercado Livre não configurado. Defina ML_CLIENT_ID e ML_REDIRECT_URI.',
      });
    }

    // Gerar state para CSRF protection
    const state = Math.random().toString(36).substring(2, 15);
    
    // Construir URL de autorização
    const authUrl = new URL(ML_CONFIG.authUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', ML_CONFIG.clientId);
    authUrl.searchParams.set('redirect_uri', ML_CONFIG.redirectUri);
    authUrl.searchParams.set('state', state);
    
    // Redirecionar para o ML
    return reply.redirect(authUrl.toString());
  });

  /**
   * GET /api/auth/mercadolivre/login
   * Redireciona o usuário para o ML com PKCE (mais seguro)
   */
  fastify.get('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ML_CONFIG.clientId || !ML_CONFIG.redirectUri) {
      return reply.status(500).send({
        success: false,
        error: 'Mercado Livre não configurado. Defina ML_CLIENT_ID e ML_REDIRECT_URI.',
      });
    }

    // PKCE - Gerar code_verifier e code_challenge
    const codeVerifier = base64url(crypto.randomBytes(32));
    const codeChallenge = base64url(
      crypto.createHash('sha256').update(codeVerifier).digest()
    );

    // State para proteção CSRF
    const state = base64url(crypto.randomBytes(16));

    // Guardar state e verifier em cookies seguros
    reply.setCookie('ml_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutos
    });
    
    reply.setCookie('ml_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutos
    });

    // Construir URL de autorização com PKCE
    const authUrl = new URL(ML_CONFIG.authUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', ML_CONFIG.clientId);
    authUrl.searchParams.set('redirect_uri', ML_CONFIG.redirectUri);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);

    // Redirecionar para o ML
    return reply.redirect(authUrl.toString());
  });

  /**
   * GET /api/auth/mercadolivre/callback
   * Callback após o usuário autorizar no Mercado Livre
   */
  fastify.get('/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error, error_description } = request.query as any;

    // Verificar se houve erro no OAuth
    if (error) {
      console.error('Erro OAuth ML:', error, error_description);
      // Redirecionar para frontend com erro
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return reply.redirect(`${frontendUrl}/?ml=error&message=${encodeURIComponent(error_description || error)}`);
    }

    if (!code) {
      return reply.status(400).send({
        success: false,
        error: 'Código de autorização não recebido',
      });
    }

    // Verificar state (CSRF protection) se vier dos cookies
    const mlState = request.cookies.ml_state;
    const mlVerifier = request.cookies.ml_verifier;
    
    if (mlState && state && mlState !== state) {
      console.error('State inválido (CSRF)');
      return reply.status(403).send({
        success: false,
        error: 'State inválido. Possível ataque CSRF.',
      });
    }

    try {
      // Preparar body para trocar code por tokens
      const tokenBody: any = {
        grant_type: 'authorization_code',
        client_id: ML_CONFIG.clientId,
        client_secret: ML_CONFIG.clientSecret,
        code,
        redirect_uri: ML_CONFIG.redirectUri,
      };

      // Se tiver verifier (PKCE), adicionar
      if (mlVerifier) {
        tokenBody.code_verifier = mlVerifier;
      }

      // Trocar code por tokens usando axios
      const tokenResponse = await axios.post(
        ML_CONFIG.tokenUrl,
        new URLSearchParams(tokenBody).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
        }
      );

      const tokenData = tokenResponse.data as {
        access_token: string;
        token_type: string;
        expires_in: number;
        scope: string;
        user_id: number;
        refresh_token: string;
      };
      
      // {
      //   access_token: "...",
      //   token_type: "Bearer",
      //   expires_in: 21600, // ~6 horas
      //   scope: "offline_access read write",
      //   user_id: 123456789,
      //   refresh_token: "..."
      // }

      // Buscar dados do usuário no ML
      const userResponse = await fetch(`${ML_CONFIG.apiUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      let mlUserData: any = {};
      if (userResponse.ok) {
        mlUserData = await userResponse.json();
      }

      // Calcular quando o token expira
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

      // Salvar ou atualizar conta no banco
      const account = await prisma.mercadoLivreAccount.upsert({
        where: { mlUserId: String(tokenData.user_id) },
        update: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenType: tokenData.token_type || 'Bearer',
          expiresAt,
          scope: tokenData.scope,
          mlNickname: mlUserData.nickname,
          mlEmail: mlUserData.email,
          isActive: true,
          lastRefreshAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          mlUserId: String(tokenData.user_id),
          mlNickname: mlUserData.nickname,
          mlEmail: mlUserData.email,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenType: tokenData.token_type || 'Bearer',
          expiresAt,
          scope: tokenData.scope,
          isActive: true,
        },
      });

      console.log(`✅ Conta ML conectada: ${account.mlNickname || account.mlUserId}`);

      // Limpar cookies do PKCE
      reply.clearCookie('ml_state');
      reply.clearCookie('ml_verifier');

      // Redirecionar para frontend com sucesso
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return reply.redirect(`${frontendUrl}/?ml=connected&status=success`);

    } catch (error: any) {
      console.error('Erro no callback OAuth ML:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return reply.redirect(`${frontendUrl}/?ml=error&message=${encodeURIComponent(error.message)}`);
    }
  });

  /**
   * POST /api/auth/mercadolivre/refresh
   * Renova o access_token usando o refresh_token
   */
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.body as { accountId?: string };

    try {
      // Buscar conta (a mais recente se não especificada)
      const account = accountId
        ? await prisma.mercadoLivreAccount.findUnique({ where: { id: accountId } })
        : await prisma.mercadoLivreAccount.findFirst({ 
            where: { isActive: true },
            orderBy: { updatedAt: 'desc' }
          });

      if (!account) {
        return reply.status(404).send({
          success: false,
          error: 'Nenhuma conta Mercado Livre conectada',
        });
      }

      // Renovar token
      const tokenResponse = await fetch(ML_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: ML_CONFIG.clientId,
          client_secret: ML_CONFIG.clientSecret,
          refresh_token: account.refreshToken,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json() as { message?: string };
        console.error('Erro ao renovar token ML:', errorData);
        
        // Marcar conta como inativa se o refresh falhar
        await prisma.mercadoLivreAccount.update({
          where: { id: account.id },
          data: { isActive: false },
        });
        
        throw new Error(errorData.message || 'Falha ao renovar token');
      }

      const tokenData = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      // Calcular nova expiração
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

      // Atualizar no banco
      const updated = await prisma.mercadoLivreAccount.update({
        where: { id: account.id },
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || account.refreshToken,
          expiresAt,
          lastRefreshAt: new Date(),
        },
      });

      return reply.send({
        success: true,
        message: 'Token renovado com sucesso',
        expiresAt: updated.expiresAt,
      });

    } catch (error: any) {
      console.error('Erro ao renovar token ML:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Erro ao renovar token',
      });
    }
  });

  /**
   * GET /api/auth/mercadolivre/status
   * Retorna o status da conexão com o Mercado Livre
   */
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accounts = await prisma.mercadoLivreAccount.findMany({
        where: { isActive: true },
        select: {
          id: true,
          mlUserId: true,
          mlNickname: true,
          mlEmail: true,
          expiresAt: true,
          lastUsedAt: true,
          createdAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      const configured = !!(ML_CONFIG.clientId && ML_CONFIG.clientSecret && ML_CONFIG.redirectUri);

      return reply.send({
        success: true,
        data: {
          configured,
          connected: accounts.length > 0,
          accounts: accounts.map(acc => ({
            ...acc,
            tokenExpired: new Date(acc.expiresAt) < new Date(),
          })),
        },
      });

    } catch (error: any) {
      console.error('Erro ao verificar status ML:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Erro ao verificar status',
      });
    }
  });

  /**
   * DELETE /api/auth/mercadolivre/disconnect
   * Desconecta uma conta do Mercado Livre
   */
  fastify.delete('/disconnect', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.query as { accountId?: string };

    try {
      if (accountId) {
        await prisma.mercadoLivreAccount.update({
          where: { id: accountId },
          data: { isActive: false },
        });
      } else {
        // Desconectar todas
        await prisma.mercadoLivreAccount.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      return reply.send({
        success: true,
        message: 'Conta(s) desconectada(s) com sucesso',
      });

    } catch (error: any) {
      console.error('Erro ao desconectar ML:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Erro ao desconectar',
      });
    }
  });
}
