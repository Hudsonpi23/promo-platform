/**
 * Mercado Livre - Serviço de gerenciamento de tokens OAuth
 * 
 * Funções para:
 * - Buscar conexão ativa
 * - Verificar expiração de tokens
 * - Renovar tokens automaticamente
 * - Garantir token válido para uso
 */

import { PrismaClient, MercadoLivreAccount } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const ML_CONFIG = {
  clientId: process.env.ML_CLIENT_ID || '',
  clientSecret: process.env.ML_CLIENT_SECRET || '',
  tokenUrl: 'https://api.mercadolibre.com/oauth/token',
  apiUrl: 'https://api.mercadolibre.com',
};

/**
 * Busca a conexão ativa do Mercado Livre
 * Por padrão, pega a primeira conta ativa
 */
export async function getMlConnection(): Promise<MercadoLivreAccount | null> {
  const connection = await prisma.mercadoLivreAccount.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  return connection;
}

/**
 * Verifica se o token está expirado ou próximo de expirar
 * @param expiresAt - Data de expiração do token
 * @param safetySeconds - Margem de segurança em segundos (padrão: 60s)
 */
export function isExpired(expiresAt: Date, safetySeconds: number = 60): boolean {
  const now = new Date();
  const expiryWithMargin = new Date(expiresAt.getTime() - safetySeconds * 1000);
  return now >= expiryWithMargin;
}

/**
 * Renova o access_token usando o refresh_token
 * @param connection - Conexão do Mercado Livre
 * @returns Nova conexão atualizada
 */
export async function refreshMlToken(
  connection: MercadoLivreAccount
): Promise<MercadoLivreAccount> {
  try {
    console.log(`🔄 Renovando token ML para mlUserId: ${connection.mlUserId}`);

    const payload = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ML_CONFIG.clientId,
      client_secret: ML_CONFIG.clientSecret,
      refresh_token: connection.refreshToken,
    });

    const response = await axios.post(ML_CONFIG.tokenUrl, payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    });

    const data = response.data as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };

    // Calcular nova data de expiração
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

    // Atualizar no banco
    const updated = await prisma.mercadoLivreAccount.update({
      where: { id: connection.id },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || connection.refreshToken,
        expiresAt,
        scope: data.scope || connection.scope,
        lastRefreshAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Token ML renovado com sucesso. Expira em: ${expiresAt.toISOString()}`);

    return updated;
  } catch (error: any) {
    console.error('❌ Erro ao renovar token ML:', error.response?.data || error.message);
    
    // Se refresh falhou, marcar conta como inativa
    await prisma.mercadoLivreAccount.update({
      where: { id: connection.id },
      data: { isActive: false },
    });

    throw new Error(`Falha ao renovar token ML: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Obtém um access_token válido, renovando se necessário
 * Esta é a função principal que deve ser usada antes de fazer requests ao ML
 * 
 * @returns Access token válido e pronto para uso
 * @throws Error se não houver conexão ou se falhar ao renovar
 */
export async function getValidMlAccessToken(): Promise<string> {
  let connection = await getMlConnection();

  if (!connection) {
    throw new Error('Mercado Livre não conectado. Execute o fluxo OAuth primeiro.');
  }

  // Se o token está expirado ou próximo de expirar, renova
  if (isExpired(connection.expiresAt)) {
    console.log('⏰ Token ML expirado. Renovando...');
    connection = await refreshMlToken(connection);
  }

  // Atualizar lastUsedAt
  await prisma.mercadoLivreAccount.update({
    where: { id: connection.id },
    data: { lastUsedAt: new Date() },
  });

  return connection.accessToken;
}

/**
 * Faz uma requisição autenticada para a API do Mercado Livre
 * Gerencia automaticamente a renovação de tokens se necessário
 * 
 * @param endpoint - Endpoint da API (ex: '/users/me')
 * @param options - Opções do axios
 * @returns Resposta da API
 */
export async function mlApiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    params?: Record<string, any>;
    data?: any;
  } = {}
): Promise<T> {
  const accessToken = await getValidMlAccessToken();

  const url = `${ML_CONFIG.apiUrl}${endpoint}`;
  
  const response = await axios({
    url,
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
    params: options.params,
    data: options.data,
  });

  return response.data;
}
