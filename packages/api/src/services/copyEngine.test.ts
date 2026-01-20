/**
 * Testes unitários para o CopyEngine
 * 
 * Execute com: npx ts-node src/services/copyEngine.test.ts
 * Ou com vitest/jest se configurado no projeto
 */

import { strict as assert } from 'assert';
import {
  buildCopy,
  buildCopyForChannels,
  validateForChannel,
  formatBRL,
  discountStr,
  OfferInput,
  Channel,
} from './copyEngine';

// ==================== TEST HELPERS ====================

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`✅ ${name}`);
  } catch (error: any) {
    testsFailed++;
    console.log(`❌ ${name}`);
    console.log(`   ${error.message}`);
  }
}

function createMockOffer(overrides: Partial<OfferInput> = {}): OfferInput {
  return {
    id: 'test-offer-123',
    title: 'Tênis Nike Air Max 90 Masculino',
    originalPrice: 399,
    finalPrice: 224,
    discountPct: 44,
    niche: 'Moda',
    store: 'Netshoes',
    urgency: 'NORMAL',
    imageUrl: 'https://example.com/image.jpg',
    goCode: 'test123',
    ...overrides,
  };
}

// ==================== TESTS ====================

console.log('\n🧪 CopyEngine Tests\n');
console.log('─'.repeat(50));

// Test 1: Formatação de preço BRL
test('formatBRL deve formatar valor corretamente', () => {
  // Usar includes para evitar problemas com caracteres especiais de espaço
  const r1799 = formatBRL(1799);
  assert.ok(r1799.includes('1.799') && r1799.includes('R$'), `Esperado R$ 1.799,xx, recebido: ${r1799}`);
  
  const r99 = formatBRL(99.9);
  assert.ok(r99.includes('99,90') && r99.includes('R$'), `Esperado R$ 99,90, recebido: ${r99}`);
  
  const r0 = formatBRL(0);
  assert.ok(r0.includes('0,00') && r0.includes('R$'), `Esperado R$ 0,00, recebido: ${r0}`);
  
  assert.equal(formatBRL(null), '');
  assert.equal(formatBRL(undefined), '');
});

// Test 2: Formatação de desconto
test('discountStr deve formatar desconto corretamente', () => {
  assert.equal(discountStr(44), '-44%');
  assert.equal(discountStr(10), '-10%');
  assert.equal(discountStr(0), '');
  assert.equal(discountStr(null), '');
  assert.equal(discountStr(undefined), '');
});

// Test 3: Copy com originalPrice + finalPrice
test('buildCopy com preços de/por deve mencionar ambos', () => {
  const offer = createMockOffer({
    originalPrice: 399,
    finalPrice: 224,
  });

  const result = buildCopy({
    offer,
    channel: 'TELEGRAM',
    styleSeed: 42,
  });

  // Deve conter menção aos dois preços
  assert.ok(result.text.includes('399') || result.text.includes('R$ 399'), 'Deve mencionar preço original');
  assert.ok(result.text.includes('224') || result.text.includes('R$ 224'), 'Deve mencionar preço final');
  assert.ok(!result.error, 'Não deve ter erro');
  assert.equal(result.requiresImage, false, 'Telegram não exige imagem');
});

// Test 4: Copy sem originalPrice
test('buildCopy sem preço original deve mencionar apenas preço atual', () => {
  const offer = createMockOffer({
    originalPrice: null,
    finalPrice: 224,
  });

  const result = buildCopy({
    offer,
    channel: 'TELEGRAM',
    styleSeed: 42,
  });

  // Deve conter preço atual
  assert.ok(result.text.includes('224') || result.text.includes('R$ 224'), 'Deve mencionar preço atual');
  // Não deve ter "Era R$" ou similar (padrão de comparação)
  assert.ok(!result.text.includes('Era R$'), 'Não deve ter comparação de preço');
  assert.ok(!result.error, 'Não deve ter erro');
});

// Test 5: Copy com urgência HOJE
test('buildCopy com urgency=HOJE pode ter tom de urgência sutil', () => {
  const offer = createMockOffer({
    urgency: 'HOJE',
  });

  // Testar múltiplos seeds para ver variação
  let foundUrgencyHint = false;
  for (let seed = 0; seed < 20; seed += 5) {
    const result = buildCopy({
      offer,
      channel: 'TELEGRAM',
      styleSeed: seed,
    });
    
    // Verificar se algum tem menção indireta à urgência
    const urgencyPhrases = [
      'não deve durar',
      'amanhã',
      'demorar',
      'depois',
    ];
    
    for (const phrase of urgencyPhrases) {
      if (result.text.toLowerCase().includes(phrase)) {
        foundUrgencyHint = true;
        break;
      }
    }
    
    // Não deve ter termos proibidos
    const forbidden = ['OFERTA DO DIA', 'imperdível', 'corre', 'aproveite', 'promoção relâmpago'];
    for (const term of forbidden) {
      assert.ok(!result.text.toLowerCase().includes(term.toLowerCase()), `Não deve conter "${term}"`);
    }
  }
  
  // Pelo menos em algum seed deve ter hint de urgência
  // (não obrigatório, mas desejável)
  console.log(`   ℹ️  Urgency hint encontrado: ${foundUrgencyHint}`);
});

// Test 6: Canal X exige imagem
test('buildCopy para TWITTER sem imagem deve retornar erro', () => {
  const offer = createMockOffer({
    imageUrl: null,
  });

  const result = buildCopy({
    offer,
    channel: 'TWITTER',
    styleSeed: 42,
  });

  assert.equal(result.error, 'SEM_IMAGEM_PARA_X', 'Deve ter erro SEM_IMAGEM_PARA_X');
  assert.equal(result.requiresImage, true, 'Twitter deve exigir imagem');
  assert.equal(result.text, '', 'Text deve estar vazio');
});

// Test 7: Canal X com imagem deve funcionar
test('buildCopy para TWITTER com imagem deve gerar copy', () => {
  const offer = createMockOffer({
    imageUrl: 'https://example.com/image.jpg',
  });

  const result = buildCopy({
    offer,
    channel: 'TWITTER',
    styleSeed: 42,
  });

  assert.ok(!result.error, 'Não deve ter erro');
  assert.equal(result.requiresImage, true, 'Twitter exige imagem');
  assert.ok(result.text.length > 0, 'Text não deve estar vazio');
  assert.ok(result.text.length <= 280, 'Text deve caber em 280 caracteres');
  assert.ok(result.text.includes('/go/'), 'Deve conter link');
});

// Test 8: Canal Site gera headline/subcopy
test('buildCopy para SITE deve gerar headline e subcopy', () => {
  const offer = createMockOffer();

  const result = buildCopy({
    offer,
    channel: 'SITE',
    styleSeed: 42,
  });

  assert.ok(!result.error, 'Não deve ter erro');
  assert.ok(result.headline, 'Deve ter headline');
  assert.ok(result.subcopy, 'Deve ter subcopy');
  assert.ok(result.text.length > 0, 'Deve ter text');
  // Site não precisa de link no texto
  assert.ok(!result.text.includes('/go/'), 'Site não deve ter link no texto');
});

// Test 9: Seed fixa gera resultado consistente
test('buildCopy com seed fixa deve gerar resultado consistente', () => {
  const offer = createMockOffer();
  const seed = 12345;

  const result1 = buildCopy({
    offer,
    channel: 'TELEGRAM',
    styleSeed: seed,
  });

  const result2 = buildCopy({
    offer,
    channel: 'TELEGRAM',
    styleSeed: seed,
  });

  assert.equal(result1.text, result2.text, 'Mesma seed deve gerar mesmo texto');
});

// Test 10: Seeds diferentes geram variação
test('buildCopy com seeds diferentes deve variar', () => {
  const offer = createMockOffer();
  
  const results = new Set<string>();
  for (let seed = 0; seed < 10; seed++) {
    const result = buildCopy({
      offer,
      channel: 'TELEGRAM',
      styleSeed: seed,
    });
    results.add(result.text);
  }

  // Deve ter pelo menos 3 variações em 10 seeds
  assert.ok(results.size >= 3, `Deve ter variação (encontrado: ${results.size} variações)`);
});

// Test 11: validateForChannel funciona
test('validateForChannel deve validar corretamente', () => {
  const offerWithImage = createMockOffer({ imageUrl: 'https://example.com/img.jpg' });
  const offerWithoutImage = createMockOffer({ imageUrl: null });
  const offerWithoutPrice = createMockOffer({ finalPrice: null as any });

  // Twitter com imagem = válido
  assert.deepEqual(
    validateForChannel(offerWithImage, 'TWITTER'),
    { valid: true }
  );

  // Twitter sem imagem = inválido
  assert.deepEqual(
    validateForChannel(offerWithoutImage, 'TWITTER'),
    { valid: false, error: 'SEM_IMAGEM_PARA_X' }
  );

  // Telegram sem imagem = válido
  assert.deepEqual(
    validateForChannel(offerWithoutImage, 'TELEGRAM'),
    { valid: true }
  );

  // Sem preço = inválido
  assert.deepEqual(
    validateForChannel(offerWithoutPrice, 'TELEGRAM'),
    { valid: false, error: 'SEM_PRECO' }
  );
});

// Test 12: buildCopyForChannels gera para múltiplos canais
test('buildCopyForChannels deve gerar para todos os canais', () => {
  const offer = createMockOffer();
  const channels: Channel[] = ['TELEGRAM', 'TWITTER', 'SITE'];

  const results = buildCopyForChannels(offer, channels, { styleSeed: 42 });

  assert.ok(results.TELEGRAM, 'Deve ter resultado para TELEGRAM');
  assert.ok(results.TWITTER, 'Deve ter resultado para TWITTER');
  assert.ok(results.SITE, 'Deve ter resultado para SITE');
  
  // Cada canal deve ter texto diferente (ou pelo menos link diferente no final)
  assert.ok(results.TELEGRAM.text !== results.SITE.text, 'Telegram e Site devem ser diferentes');
});

// Test 13: Copy não contém termos proibidos
test('buildCopy não deve conter termos robóticos proibidos', () => {
  const offer = createMockOffer();
  const forbidden = [
    'OFERTA DO DIA',
    'imperdível',
    'últimas unidades',
    'corre',
    'aproveite',
    'promoção relâmpago',
  ];

  for (let seed = 0; seed < 20; seed++) {
    const result = buildCopy({
      offer,
      channel: 'TELEGRAM',
      styleSeed: seed,
    });

    for (const term of forbidden) {
      assert.ok(
        !result.text.toLowerCase().includes(term.toLowerCase()),
        `Seed ${seed}: Não deve conter "${term}"`
      );
    }
  }
});

// Test 14: Copy tem no máximo 1 emoji
test('buildCopy deve ter no máximo 1 emoji', () => {
  const offer = createMockOffer();
  
  // Regex para contar emojis comuns
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

  for (let seed = 0; seed < 20; seed++) {
    const result = buildCopy({
      offer,
      channel: 'TELEGRAM',
      styleSeed: seed,
    });

    const emojis = result.text.match(emojiRegex) || [];
    assert.ok(emojis.length <= 1, `Seed ${seed}: Máximo 1 emoji (encontrado: ${emojis.length})`);
  }
});

// ==================== SUMMARY ====================

console.log('─'.repeat(50));
console.log(`\n📊 Resultado: ${testsPassed}/${testsRun} testes passaram`);
if (testsFailed > 0) {
  console.log(`   ⚠️  ${testsFailed} teste(s) falharam\n`);
  process.exit(1);
} else {
  console.log('   ✨ Todos os testes passaram!\n');
}
