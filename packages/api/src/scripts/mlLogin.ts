/**
 * Script para fazer login no Mercado Livre e salvar a sessão
 * 
 * Como tem 2FA, abre o navegador VISÍVEL para o usuário completar
 * Depois salva os cookies para usar automaticamente
 */

import { chromium, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Credenciais do ML
const ML_EMAIL = 'declanhygor@gmail.com';
const ML_PASSWORD = '23091830Da*';

// Arquivo para salvar a sessão
const SESSION_FILE = path.join(__dirname, '../../ml-session.json');

/**
 * Faz login no Mercado Livre
 */
async function loginToMercadoLivre() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   🔐 LOGIN NO MERCADO LIVRE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Email:', ML_EMAIL);
  console.log('   Navegador: VISÍVEL (para completar 2FA se necessário)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Abre navegador VISÍVEL (headless: false)
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    // 1. Acessa página de login
    console.log('🌐 Abrindo página de login do Mercado Livre...');
    await page.goto('https://www.mercadolivre.com.br/');
    await page.waitForTimeout(2000);
    
    // Clica em "Entrar"
    console.log('🔍 Procurando botão de login...');
    const loginButton = page.locator('a:has-text("Entrar"), a:has-text("Entre")').first();
    await loginButton.click();
    await page.waitForTimeout(3000);
    
    // 2. Preenche email
    console.log('📧 Preenchendo email...');
    const emailInput = page.locator('input[name="user_id"], input[type="text"]').first();
    await emailInput.fill(ML_EMAIL);
    await page.waitForTimeout(500);
    
    // Clica em continuar
    const continueButton = page.locator('button:has-text("Continuar"), button[type="submit"]').first();
    await continueButton.click();
    await page.waitForTimeout(3000);
    
    // 3. Preenche senha
    console.log('🔑 Preenchendo senha...');
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    await passwordInput.fill(ML_PASSWORD);
    await page.waitForTimeout(500);
    
    // Clica em entrar
    const submitButton = page.locator('button:has-text("Entrar"), button:has-text("Iniciar sessão"), button[type="submit"]').first();
    await submitButton.click();
    
    console.log('\n⏳ Aguardando verificação de 2FA (se necessário)...');
    console.log('   👉 COMPLETE A VERIFICAÇÃO NO NAVEGADOR SE APARECER');
    console.log('   👉 O script vai aguardar até 2 minutos...\n');
    
    // 4. Aguarda login completar (máximo 2 minutos para 2FA)
    await page.waitForURL('**/mercadolivre.com.br/**', { timeout: 120000 });
    
    // Verifica se está logado
    await page.waitForTimeout(5000);
    
    // Tenta encontrar indicador de login
    const userMenu = await page.locator('[data-testid="action-user"], .nav-header-user').count();
    
    if (userMenu > 0) {
      console.log('✅ LOGIN REALIZADO COM SUCESSO!\n');
      
      // 5. Salva os cookies da sessão
      console.log('💾 Salvando sessão...');
      const cookies = await context.cookies();
      const storageState = await context.storageState();
      
      fs.writeFileSync(SESSION_FILE, JSON.stringify(storageState, null, 2));
      console.log(`✅ Sessão salva em: ${SESSION_FILE}\n`);
      
      // Testa acessando um produto
      console.log('🧪 Testando acesso a produto...');
      await page.goto('https://www.mercadolivre.com.br/fone-de-ouvido-sem-fio-m10-bluetooth-com-powerbank-microfone-preto/p/MLB63611545');
      await page.waitForTimeout(3000);
      
      // Procura botão de compartilhar
      const shareButton = page.locator('button:has-text("Compartilhar"), a:has-text("Compartilhar")').first();
      
      if (await shareButton.count() > 0) {
        console.log('✅ Botão "Compartilhar" encontrado!\n');
        
        // Clica em compartilhar
        await shareButton.click();
        await page.waitForTimeout(2000);
        
        // Procura o link de afiliado
        const copyLink = page.locator('button:has-text("Copiar link"), button:has-text("Copiar")').first();
        if (await copyLink.count() > 0) {
          console.log('✅ Botão "Copiar link" encontrado!');
          console.log('   O sistema está pronto para gerar links de afiliado!\n');
        }
      }
      
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('   ✅ CONFIGURAÇÃO COMPLETA!');
      console.log('   A sessão foi salva e pode ser usada automaticamente.');
      console.log('═══════════════════════════════════════════════════════════════\n');
      
      // Mantém o navegador aberto por 30 segundos para conferir
      console.log('⏳ Navegador ficará aberto por 30 segundos para você conferir...');
      console.log('   Depois fechará automaticamente.\n');
      await page.waitForTimeout(30000);
      
    } else {
      console.log('❌ Não foi possível confirmar o login.');
      console.log('   Verifique se completou a verificação de 2FA.\n');
      
      // Mantém navegador aberto para debug
      console.log('⏳ Navegador ficará aberto por 2 minutos para você tentar manualmente...');
      await page.waitForTimeout(120000);
    }
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.log('\n⏳ Navegador ficará aberto para você tentar manualmente...');
    await page.waitForTimeout(120000);
  } finally {
    await browser.close();
    console.log('🔒 Navegador fechado.');
  }
}

// Executa
loginToMercadoLivre().catch(console.error);
