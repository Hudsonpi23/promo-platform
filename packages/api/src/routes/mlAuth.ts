/**
 * Rotas de autenticação OAuth2 do Mercado Livre
 * Com suporte a PKCE (Proof Key for Code Exchange)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import crypto from 'crypto';

// Credenciais do app
const ML_CLIENT_ID = process.env.ML_CLIENT_ID || '6822621568324751';
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET || 'U7py3Dau0cd9arlnDaIKEbrFu1C7kmKd';
const REDIRECT_URI = process.env.ML_REDIRECT_URI || 'https://promo-platform-api.onrender.com/api/auth/mercadolivre/callback';

// Armazena o token em memória (em produção, use banco de dados)
let mlToken: any = null;

// Armazena o code_verifier para PKCE
let codeVerifier: string | null = null;

/**
 * Gera code_verifier e code_challenge para PKCE
 */
function generatePKCE() {
  // Gera code_verifier (43-128 caracteres aleatórios)
  const verifier = crypto.randomBytes(32).toString('base64url');
  
  // Gera code_challenge (SHA256 do verifier em base64url)
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  
  return { verifier, challenge };
}

export async function mlAuthRoutes(fastify: FastifyInstance) {
  
  /**
   * Inicia o fluxo de autorização OAuth2 com PKCE
   * GET /api/auth/mercadolivre
   */
  fastify.get('/api/auth/mercadolivre', async (request: FastifyRequest, reply: FastifyReply) => {
    // Gera PKCE
    const pkce = generatePKCE();
    codeVerifier = pkce.verifier;
    
    console.log('[ML Auth] Iniciando autorização com PKCE');
    console.log('[ML Auth] Code Verifier:', pkce.verifier.substring(0, 20) + '...');
    console.log('[ML Auth] Code Challenge:', pkce.challenge.substring(0, 20) + '...');
    
    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code_challenge=${pkce.challenge}&code_challenge_method=S256`;
    
    return reply.redirect(authUrl);
  });

  /**
   * Callback do OAuth2 - recebe o código e troca por token
   * GET /api/auth/mercadolivre/callback
   */
  fastify.get('/api/auth/mercadolivre/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, error, error_description } = request.query as any;

    // Se houve erro na autorização
    if (error) {
      return reply.status(400).send({
        success: false,
        error,
        error_description,
      });
    }

    // Se não tem código
    if (!code) {
      return reply.status(400).send({
        success: false,
        error: 'missing_code',
        message: 'Código de autorização não fornecido',
      });
    }

    try {
      console.log('[ML Auth] Recebido código:', code.substring(0, 20) + '...');
      console.log('[ML Auth] Code Verifier disponível:', !!codeVerifier);

      // Monta os parâmetros
      const params: any = {
        grant_type: 'authorization_code',
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI,
      };

      // Adiciona code_verifier se disponível (PKCE)
      if (codeVerifier) {
        params.code_verifier = codeVerifier;
        console.log('[ML Auth] Usando PKCE com code_verifier');
      }

      // Troca o código por access_token
      const response = await axios.post('https://api.mercadolibre.com/oauth/token', 
        new URLSearchParams(params).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          }
        }
      );
      
      // Limpa o code_verifier após uso
      codeVerifier = null;

      const tokenData = response.data;
      
      // Salva o token
      mlToken = {
        ...tokenData,
        obtained_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      };

      console.log('[ML Auth] ✅ Token obtido com sucesso!');
      console.log('[ML Auth] User ID:', tokenData.user_id);

      // Retorna página de sucesso
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Autorização ML - Sucesso!</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
            h1 { color: #22c55e; margin-bottom: 20px; }
            .icon { font-size: 64px; margin-bottom: 20px; }
            .info { background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left; }
            .info p { margin: 5px 0; color: #333; }
            .token { font-family: monospace; font-size: 12px; word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✅</div>
            <h1>Autorização Concluída!</h1>
            <p>O Mercado Livre foi conectado com sucesso.</p>
            <div class="info">
              <p><strong>User ID:</strong> ${tokenData.user_id}</p>
              <p><strong>Expira em:</strong> ${Math.round(tokenData.expires_in / 3600)} horas</p>
              <p><strong>Access Token:</strong></p>
              <div class="token" style="user-select: all;">${tokenData.access_token}</div>
              <p style="margin-top: 15px;"><strong>Refresh Token:</strong></p>
              <div class="token" style="user-select: all;">${tokenData.refresh_token || 'N/A'}</div>
            </div>
            <p style="color: #666; font-size: 14px;">Você pode fechar esta janela.</p>
          </div>
        </body>
        </html>
      `);

    } catch (err: any) {
      console.error('[ML Auth] ❌ Erro ao trocar código:', err.response?.data || err.message);
      
      return reply.status(500).send({
        success: false,
        error: 'token_exchange_failed',
        message: 'Erro ao obter access token',
        details: err.response?.data || err.message,
      });
    }
  });

  /**
   * Retorna o token atual (se existir)
   * GET /api/auth/mercadolivre/token
   */
  fastify.get('/api/auth/mercadolivre/token', async (request: FastifyRequest, reply: FastifyReply) => {
    // Tenta carregar do env se não tiver em memória
    if (!mlToken && process.env.ML_ACCESS_TOKEN) {
      mlToken = {
        access_token: process.env.ML_ACCESS_TOKEN,
        refresh_token: process.env.ML_REFRESH_TOKEN,
        user_id: parseInt(process.env.ML_USER_ID || '0'),
        expires_at: process.env.ML_TOKEN_EXPIRES_AT || new Date().toISOString(),
      };
      console.log('[ML Auth] Token carregado das variáveis de ambiente');
    }

    if (!mlToken) {
      return reply.status(404).send({
        success: false,
        error: 'no_token',
        message: 'Nenhum token disponível. Faça a autorização primeiro.',
        auth_url: `/api/auth/mercadolivre`,
      });
    }

    // Verifica se expirou
    const expiresAt = new Date(mlToken.expires_at);
    const isExpired = expiresAt < new Date();

    // Se expirou e tem refresh_token, tenta renovar automaticamente
    if (isExpired && mlToken.refresh_token) {
      console.log('[ML Auth] Token expirado, renovando automaticamente...');
      try {
        const response = await axios.post('https://api.mercadolibre.com/oauth/token',
          new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: ML_CLIENT_ID,
            client_secret: ML_CLIENT_SECRET,
            refresh_token: mlToken.refresh_token,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            }
          }
        );

        mlToken = {
          ...response.data,
          obtained_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + response.data.expires_in * 1000).toISOString(),
        };
        console.log('[ML Auth] Token renovado com sucesso!');
      } catch (err: any) {
        console.error('[ML Auth] Erro ao renovar token:', err.response?.data || err.message);
      }
    }

    return reply.send({
      success: true,
      token: {
        access_token: mlToken.access_token,
        refresh_token: mlToken.refresh_token ? mlToken.refresh_token.substring(0, 20) + '...' : null,
        user_id: mlToken.user_id,
        expires_at: mlToken.expires_at,
        is_expired: isExpired && !mlToken.refresh_token,
      },
    });
  });

  /**
   * Retorna o token COMPLETO (para salvar nas variáveis de ambiente)
   * GET /api/auth/mercadolivre/token/full
   */
  fastify.get('/api/auth/mercadolivre/token/full', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!mlToken) {
      return reply.status(404).send({
        success: false,
        error: 'no_token',
      });
    }

    return reply.send({
      success: true,
      env_variables: {
        ML_ACCESS_TOKEN: mlToken.access_token,
        ML_REFRESH_TOKEN: mlToken.refresh_token,
        ML_USER_ID: mlToken.user_id?.toString(),
        ML_TOKEN_EXPIRES_AT: mlToken.expires_at,
      },
      message: 'Copie essas variáveis para o Render para ter token permanente!',
    });
  });

  /**
   * Renova o token usando refresh_token
   * POST /api/auth/mercadolivre/refresh
   */
  fastify.post('/api/auth/mercadolivre/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!mlToken || !mlToken.refresh_token) {
      return reply.status(400).send({
        success: false,
        error: 'no_refresh_token',
        message: 'Nenhum refresh token disponível.',
      });
    }

    try {
      const response = await axios.post('https://api.mercadolibre.com/oauth/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: ML_CLIENT_ID,
          client_secret: ML_CLIENT_SECRET,
          refresh_token: mlToken.refresh_token,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          }
        }
      );

      mlToken = {
        ...response.data,
        obtained_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + response.data.expires_in * 1000).toISOString(),
      };

      return reply.send({
        success: true,
        message: 'Token renovado com sucesso!',
        expires_at: mlToken.expires_at,
      });

    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: 'refresh_failed',
        details: err.response?.data || err.message,
      });
    }
  });

  /**
   * Testa o token fazendo uma requisição para /users/me
   * GET /api/auth/mercadolivre/test
   */
  fastify.get('/api/auth/mercadolivre/test', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!mlToken) {
      return reply.status(400).send({
        success: false,
        error: 'no_token',
        message: 'Nenhum token disponível.',
      });
    }

    try {
      const response = await axios.get('https://api.mercadolibre.com/users/me', {
        headers: {
          'Authorization': `Bearer ${mlToken.access_token}`,
        }
      });

      return reply.send({
        success: true,
        user: {
          id: response.data.id,
          nickname: response.data.nickname,
          email: response.data.email,
          site_id: response.data.site_id,
        },
      });

    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: 'api_error',
        details: err.response?.data || err.message,
      });
    }
  });
}

// Exporta função para obter o token atual
export function getMLToken(): any {
  return mlToken;
}

// Exporta função para setar o token (útil para carregar de arquivo/banco)
export function setMLToken(token: any): void {
  mlToken = token;
}

export default mlAuthRoutes;
