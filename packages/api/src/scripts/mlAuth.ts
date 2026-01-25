/**
 * Script para obter Access Token do Mercado Livre via OAuth2
 * 
 * Fluxo:
 * 1. Abre URL de autorização no navegador
 * 2. Usuário autoriza o app
 * 3. ML redireciona com um código
 * 4. Trocamos o código por access_token
 */

import { chromium } from 'playwright';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Credenciais do app (do .env)
const ML_CLIENT_ID = '6822621568324751';
const ML_CLIENT_SECRET = 'U7py3Dau0cd9arlnDaIKEbrFu1C7kmKd';
const REDIRECT_URI = 'https://www.mercadolivre.com.br'; // URL de callback

// Arquivo para salvar o token
const TOKEN_FILE = path.join(__dirname, '../../ml-token.json');

/**
 * Gera a URL de autorização
 */
function getAuthUrl(): string {
  const baseUrl = 'https://auth.mercadolivre.com.br/authorization';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: ML_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Troca o código por access_token
 */
async function exchangeCodeForToken(code: string): Promise<any> {
  console.log('\n🔄 Trocando código por access_token...');
  
  try {
    const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET,
      code: code,
      redirect_uri: REDIRECT_URI,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Erro ao trocar código:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Salva o token em arquivo
 */
function saveToken(tokenData: any): void {
  const dataToSave = {
    ...tokenData,
    obtained_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
  };
  
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(dataToSave, null, 2));
  console.log(`\n💾 Token salvo em: ${TOKEN_FILE}`);
}

/**
 * Carrega token salvo
 */
function loadToken(): any | null {
  if (fs.existsSync(TOKEN_FILE)) {
    const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    return data;
  }
  return null;
}

/**
 * Verifica se o token ainda é válido
 */
function isTokenValid(tokenData: any): boolean {
  if (!tokenData || !tokenData.expires_at) return false;
  const expiresAt = new Date(tokenData.expires_at);
  return expiresAt > new Date();
}

/**
 * Renova o token usando refresh_token
 */
async function refreshToken(refreshToken: string): Promise<any> {
  console.log('\n🔄 Renovando token...');
  
  try {
    const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'refresh_token',
      client_id: ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET,
      refresh_token: refreshToken,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Erro ao renovar token:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Processo principal de autorização
 */
async function authorize() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   🔐 AUTORIZAÇÃO MERCADO LIVRE - OAuth2');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Client ID:', ML_CLIENT_ID);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Verifica se já tem token válido
  const existingToken = loadToken();
  if (existingToken) {
    if (isTokenValid(existingToken)) {
      console.log('✅ Token existente ainda é válido!');
      console.log(`   Access Token: ${existingToken.access_token.substring(0, 20)}...`);
      console.log(`   Expira em: ${existingToken.expires_at}`);
      return existingToken;
    } else if (existingToken.refresh_token) {
      console.log('⏰ Token expirado, tentando renovar...');
      try {
        const newToken = await refreshToken(existingToken.refresh_token);
        saveToken(newToken);
        console.log('✅ Token renovado com sucesso!');
        return newToken;
      } catch (e) {
        console.log('❌ Não foi possível renovar, iniciando nova autorização...');
      }
    }
  }
  
  // Inicia nova autorização
  const authUrl = getAuthUrl();
  
  console.log('📋 Para autorizar, siga os passos:\n');
  console.log('1. Abra esta URL no navegador:');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(authUrl);
  console.log('─────────────────────────────────────────────────────────────────\n');
  console.log('2. Faça login e autorize o aplicativo');
  console.log('3. Após autorizar, você será redirecionado para uma URL');
  console.log('4. Copie o CÓDIGO da URL (parâmetro "code=XXXXX")\n');
  
  // Abre navegador automaticamente
  console.log('🌐 Abrindo navegador...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto(authUrl);
  
  // Aguarda o usuário digitar o código
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const code = await new Promise<string>((resolve) => {
    rl.question('📝 Cole o CÓDIGO aqui (ou a URL completa): ', (answer) => {
      rl.close();
      
      // Se colou a URL completa, extrai o código
      if (answer.includes('code=')) {
        const match = answer.match(/code=([^&]+)/);
        if (match) {
          resolve(match[1]);
          return;
        }
      }
      resolve(answer.trim());
    });
  });
  
  await browser.close();
  
  if (!code) {
    console.log('❌ Código não fornecido.');
    return null;
  }
  
  console.log(`\n📨 Código recebido: ${code.substring(0, 20)}...`);
  
  // Troca código por token
  const tokenData = await exchangeCodeForToken(code);
  
  console.log('\n✅ ACCESS TOKEN OBTIDO COM SUCESSO!');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`   Access Token: ${tokenData.access_token.substring(0, 30)}...`);
  console.log(`   User ID: ${tokenData.user_id}`);
  console.log(`   Expira em: ${tokenData.expires_in} segundos`);
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Salva o token
  saveToken(tokenData);
  
  // Testa o token
  console.log('\n🧪 Testando token...');
  try {
    const userResponse = await axios.get('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    console.log('✅ Token funcionando!');
    console.log(`   Usuário: ${userResponse.data.nickname}`);
    console.log(`   ID: ${userResponse.data.id}`);
  } catch (e: any) {
    console.error('❌ Erro ao testar token:', e.response?.data || e.message);
  }
  
  return tokenData;
}

// Executa
authorize().catch(console.error);
