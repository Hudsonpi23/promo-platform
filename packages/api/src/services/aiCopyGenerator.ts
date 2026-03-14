/**
 * AI Copy Generator Service
 * 
 * Gera textos de marketing para ofertas usando regras determinísticas
 * com fallback para IA externa (OpenAI) quando disponível.
 * 
 * ESTILO:
 * - Tom engraçado, focado em jovens 16-25 anos
 * - Referências à cultura jovem (ex: Malbec = perfume de quem trai)
 * - Frases pequenas e chamativas
 * - SEMPRE destacar desconto quando houver
 * - TODAS as frases em MAIÚSCULAS
 * 
 * A IA:
 * - NÃO acessa Awin
 * - NÃO acessa Mercado Livre
 * - NÃO vê tokens
 * - NÃO decide quais ofertas buscar
 * 
 * A IA RECEBE um JSON limpo e DEVOLVE copies formatados.
 */

// ==================== TYPES ====================

export type PaymentMethod = 'pix' | 'avista' | 'parcelado';

export interface CopyInputData {
  title: string;
  price: number;
  oldPrice?: number | null;
  discountPct: number;
  advertiserName?: string | null;
  storeName?: string | null;
  category?: string | null;
  trackingUrl: string;
  /** Link do produto no site vitrine — adicionado separado do link de afiliado */
  siteUrl?: string | null;
  /** Se é oferta relâmpago (tempo limitado) */
  isFlash?: boolean;
  /** Duração em minutos da oferta relâmpago */
  flashMinutes?: number;
  /** Forma de pagamento destacada no post */
  paymentMethod?: PaymentMethod;
  /** Número de parcelas (quando paymentMethod = 'parcelado') */
  installments?: number;
  /** Valor por parcela inserido manualmente (sobrepõe o cálculo automático price/installments) */
  installmentValue?: number;
  /**
   * Modo de seleção de frases:
   *   'brand'   → detecta a marca no título e usa SÓ as frases daquela marca;
   *               se a marca não tiver frases, usa genéricas do tipo de produto.
   *   'generic' → usa SÓ frases genéricas do tipo de produto (ignora marcas).
   *   undefined → comportamento padrão (pool unificado — marca + genérico misturados).
   */
  phraseMode?: 'generic' | 'brand';
  /** Código de cupom de desconto (ex: "PROMO10", "20% OFF") */
  couponCode?: string | null;
}

export interface GeneratedCopies {
  telegram: string;
  site: string;
  x: string;
  variations?: {
    telegram: string[];
    site: string[];
    x: string[];
  };
}

export interface CopyGeneratorOptions {
  generateVariations?: boolean;   // Gerar 2-3 variações por canal
  useAI?: boolean;                // Usar IA externa (se disponível)
  style?: 'casual' | 'urgente' | 'informativo';
}

// ==================== CONSTANTS ====================

const CHAR_LIMITS = {
  TELEGRAM: 1024, // Limite real do Telegram para caption é 1024 caracteres
  SITE: 600,
  X: 280, // Limite do Twitter/X é 280 caracteres
};

// Templates engraçados para jovens 16-25 anos - TUDO EM MAIÚSCULAS + EMOJIS
const OPENINGS_ENGRAÇADOS = [
  'ACHADO NÃO É ROUBADO',
  'OLHA SÓ ESSE PREÇO 👀',
  'ISSO AQUI É DE GRAÇA',
  'TÁ DE BRINCADEIRA',
  'NÃO É POSSÍVEL',
  'CORRE QUE TÁ BARATO',
  'ISSO É ROUBO (MAS DO BOM)',
  'TÁ MUITO BARATO',
  'OLHA ESSA PROMOÇÃO',
  'ISSO É ACHADO',
];

// Aberturas por categoria com humor jovem + EMOJIS
const OPENINGS_BY_CATEGORY: Record<string, string[]> = {
  'eletronicos': [
    'QUEM TAVA QUERENDO, OLHA ISSO 👀',
    'ESSE DESCONTO É RARO',
    'APARECEU COM PREÇO BOM',
    'TÁ BARATO DEMAIS',
  ],
  'moda': [
    'TÁ VALENDO MUITO',
    'COM DESCONTO ASSIM É ACHADO',
    'BAIXOU PRA VALER',
    'ESSE PREÇO É DE GRAÇA',
  ],
  'casa': [
    'PRA CASA COM DESCONTO BOM',
    'ACHADO PRA QUEM PRECISA',
    'ESSE VALOR É RARO',
    'TÁ MUITO BARATO',
  ],
  'games': [
    'CONSOLE/JOGO COM ESSE DESCONTO É RARO',
    'QUEM TAVA ESPERANDO, CHEGOU A HORA',
    'TÁ JUNTANDO? PODE COMPRAR',
    'ESSE PREÇO É DE GRAÇA',
  ],
  'perfumes': [
    'ESSE TE DEIXA CHEIROSO',
    'PERFUME BOM E BARATO',
    'CHEIRO DE RICO POR PREÇO DE POBRE',
    'TÁ VALENDO MUITO',
  ],
};


// ==================== PRODUCT PHRASES (importado de ./phrases/) ====================
import { PRODUCT_SPECIFIC_PHRASES } from './phrases/index';

// REGRA: apenas nomes de MARCA disparam o merged pool.
// Termos genéricos (camisa, calça, tênis, panela, furadeira...) NÃO entram aqui —
// eles usam o pool individual próprio, que tem frases adequadas ao produto.
// Isso evita que "Camisa Flamengo" receba frase de jeans ou
// "Furadeira sem marca" receba frase de Bosch.
const MERGED_POOL_KEYS: Record<string, string[]> = {
  'tenis': [
    'nike', 'adidas', 'puma', 'new balance', 'asics',
    'vans', 'converse', 'all star', 'under armour', 'fila', 'mizuno',
    'olimpikus', 'kappa',
  ],
  'roupas': [
    'polo ralph lauren', 'ralph lauren', 'lacoste',
    'tommy hilfiger', 'calvin klein', 'insider', 'insaider',
    "levi's", 'levis',
  ],
  'ferramentas': [
    'bosch professional', 'bosch', 'makita', 'dewalt', 'milwaukee', 'hilti',
    'snap-on', 'snap on', 'festool', 'metabo', 'ryobi', 'ridgid',
    'stanley', 'black+decker', 'black decker', 'irwin', 'craftsman',
    'gedore', 'belzer', 'bahco', 'knipex',
    'vonder', 'worker', 'gamma', 'sparta',
  ],
  // Tramontina pertence a cozinha (panelas, facas, utensílios)
  'cozinha': [
    'tramontina pro', 'tramontina',
    'brinox', 'rochedo', 'panelux', 'multiflon', 'nigro', 'sanremo',
    'plasútil', 'plasutil',
  ],
  // Chinelos — marcas brasileiras principais
  'chinelo': [
    'havaianas', 'rider', 'kenner', 'ipanema',
  ],
  // Cadeiras Gamer — marcas mais vendidas no Brasil
  'cadeira gamer': [
    'dxracer', 'thunderx3', 'cougar gamer', 'secretlab', 'razer',
  ],
  // Caixas de Som / Speakers
  'caixa de som': [
    'jbl', 'bose', 'marshall', 'sony caixa',
  ],
};

// Pool unificado por categoria — construído uma vez ao carregar o módulo.
const MERGED_CATEGORY_PHRASES: Record<string, string[]> = (() => {
  const result: Record<string, string[]> = {};
  for (const [category, keys] of Object.entries(MERGED_POOL_KEYS)) {
    result[category] = keys.flatMap(k => PRODUCT_SPECIFIC_PHRASES[k] ?? []);
  }
  return result;
})();

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCT_POOL — Um pool único por tipo de produto.
// Cada pool reúne frases de marcas conhecidas + frases genéricas do tipo.
// O título do produto determina qual pool usar. Simples assim.
// ══════════════════════════════════════════════════════════════════════════════
const PRODUCT_POOL: Record<string, string[]> = (() => {
  function merge(...keys: string[]): string[] {
    return keys.flatMap(k => PRODUCT_SPECIFIC_PHRASES[k] ?? []);
  }
  return {
    // ── Calçados ─────────────────────────────────────────────────────────────
    // Pool = todas as marcas de tênis + frases genéricas de tênis
    'tenis': [...(MERGED_CATEGORY_PHRASES['tenis'] ?? []), ...merge('tênis', 'tenis')],

    // ── Vestuário ─────────────────────────────────────────────────────────────
    // Pool = todas as marcas de roupas + camisa + calça + roupa genérica
    'roupas': [...(MERGED_CATEGORY_PHRASES['roupas'] ?? []), ...merge('camisa', 'camiseta', 'calça', 'calca', 'roupa')],

    // ── Cozinha ──────────────────────────────────────────────────────────────
    // Pool = Tramontina + Brinox + outras + frases genéricas de panela
    'cozinha': [...(MERGED_CATEGORY_PHRASES['cozinha'] ?? []), ...merge('panela', 'frigideira')],

    // ── Ferramentas ──────────────────────────────────────────────────────────
    // Pool = Bosch + Makita + outras + frases genéricas de ferramenta
    'ferramentas': [...(MERGED_CATEGORY_PHRASES['ferramentas'] ?? []), ...merge('ferramenta', 'furadeira', 'parafusadeira')],

    // ── Chinelos ─────────────────────────────────────────────────────────────
    // Pool = Havaianas + Rider + Kenner + Ipanema + genéricas de chinelo
    'chinelo': [...(MERGED_CATEGORY_PHRASES['chinelo'] ?? []), ...merge('chinelo')],

    // ── Cadeiras Gamer ───────────────────────────────────────────────────────
    // Pool = DXRacer + ThunderX3 + Cougar + SecretLab + Razer + genéricas de cadeira gamer
    'cadeira gamer': [...(MERGED_CATEGORY_PHRASES['cadeira gamer'] ?? []), ...merge('cadeira gamer', 'poltrona gamer')],

    // ── Caixa de Som ─────────────────────────────────────────────────────────
    // Pool = JBL + Bose + Marshall + Sony + frases genéricas de caixa de som
    'caixa de som': [...(MERGED_CATEGORY_PHRASES['caixa de som'] ?? []), ...merge('caixa de som')],
  };
})();

// Detecta a qual categoria merged um produto pertence.
// Usa word boundary (\b) para evitar falsos positivos como
// 'forma' dentro de 'formato', 'fila' dentro de 'família', etc.
// ══════════════════════════════════════════════════════════════════════════════
// SISTEMA DE 3 CAMADAS PARA SELEÇÃO DE FRASES
//
// Camada 1 — Tipo de produto  (o QUE é o produto?)
// Camada 2 — Marca do produto (de QUAL marca é?)
// Camada 3 — Frase correta    (frases da marca se houver; senão genéricas do tipo)
//
// Isso evita que "CAMISA ADIDAS" use frases de tênis (Vans, Mizuno…)
// ou que "GELADEIRA BOSCH" use frases de furadeira.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Detectores de tipo de produto ordenados do mais específico para o mais genérico.
 * `phraseKey` → chave em PRODUCT_SPECIFIC_PHRASES para frases genéricas do tipo.
 * `brandCat`  → chave em MERGED_POOL_KEYS para buscar marcas válidas para este tipo.
 */
const PRODUCT_TYPE_DETECTORS: Array<{
  kw: string[];
  phraseKey: string;
  brandCat?: string;
}> = [
  // ─── Vestuário superior — ORDEM: mais específico primeiro ───────────────

  // 1. Camisa de time (jersey de clube/seleção) — detectar ANTES de qualquer outra camisa
  { kw: [
      'camisa de futebol', 'camisa do time', 'camisa oficial', 'camisa retrô', 'camisa retro',
      'jersey oficial', 'camisa de jogo', 'camiseta de time', 'camiseta oficial',
      // Times brasileiros
      'flamengo', 'corinthians', 'palmeiras', 'são paulo', 'sao paulo', 'santos',
      'grêmio', 'gremio', 'internacional', 'atletico mineiro', 'atlético mineiro',
      'cruzeiro', 'vasco', 'botafogo', 'fluminense', 'fortaleza', 'ceará', 'ceara',
      'sport recife', 'bahia', 'athletico paranaense', 'coritiba', 'goias', 'goiás',
      'america mineiro', 'américa mineiro', 'bragantino', 'cuiabá', 'cuiaba',
      // Seleções
      'seleção brasileira', 'selecao brasileira', 'brasil seleção', 'camisa do brasil',
      'seleção', 'selecao', 'canarinho',
      // Times europeus
      'real madrid', 'barcelona', 'manchester', 'chelsea', 'liverpool', 'arsenal',
      'juventus', 'inter de milão', 'inter de milao', 'ac milan', 'paris saint',
      'psg', 'bayern', 'borussia', 'ajax', 'benfica', 'porto',
    ],                                                                               phraseKey: 'camisa de time' },

  // 2. Camisa Polo (gola polo, diferente de camiseta básica)
  { kw: ['camisa polo', 'polo shirt', 'polo masculina', 'polo feminina', 'polo com gola'], phraseKey: 'camisa polo', brandCat: 'roupas' },

  // 3. Camisa Social (de botão, trabalho, eventos)
  { kw: ['camisa social', 'camisa de botão', 'camisa de botao', 'camisa slim', 'camisa jeans', 'camisa xadrez', 'camisa listrada', 'camisa manga longa', 'camisa manga curta'], phraseKey: 'camisa social', brandCat: 'roupas' },

  // 4. Regata (sem manga)
  { kw: ['regata', 'camiseta regata', 'top regata'],                                phraseKey: 'regata',           brandCat: 'roupas' },

  // 5. Camiseta básica (t-shirt genérica — vem por último entre as camisas)
  { kw: ['insider camiseta', 'camiseta insider', 'insider camisa', 'camisa insider', 'insider shorts', 'shorts insider', 'insider'],  phraseKey: 'insider', brandCat: 'roupas' },
  // ─── Oakley (brand) ───────────────────────────────────────────────────────
  { kw: ['óculos oakley', 'oculos oakley', 'oakley óculos', 'oakley oculos', 'lente oakley', 'armação oakley'], phraseKey: 'óculos oakley' },
  { kw: ['oakley camiseta', 'camiseta oakley', 'oakley bermuda', 'bermuda oakley', 'oakley shorts', 'shorts oakley', 'oakley calça', 'oakley polo', 'polo oakley', 'oakley'], phraseKey: 'oakley' },
  // ─── Plus Size ────────────────────────────────────────────────────────────
  { kw: ['plus size', 'tamanho grande', 'tamanho extra', 'size plus', 'gg', 'xgg', 'eg', 'tamanho especial', 'moda plus', 'roupa plus'], phraseKey: 'plus size' },

  // ─── Anime / Geek / Superhero (ANTES do detector genérico de camiseta) ───
  // Figuras colecionáveis / action figures
  { kw: [
      'figura anime', 'boneco anime', 'action figure anime', 'figure anime',
      'estatueta anime', 'colecionável anime', 'figure one piece', 'figure naruto',
      'figure dragon ball', 'figure demon slayer', 'figure jujutsu', 'figure attack on titan',
      'figure sword art', 'figure fullmetal', 'figure bleach', 'figure fairy tail',
      'figure tokyo ghoul', 'figure hunter x hunter', 'figure mob psycho',
      'figure my hero academia', 'figure black clover', 'figure chainsaw man',
      'figura de anime', 'boneco colecionável anime', 'action figure marvel',
      'action figure dc', 'estatueta marvel', 'estatueta dc', 'action figure spider',
      'action figure batman', 'action figure superman', 'action figure ironman',
      'figura de resina', 'figure pvc', 'boneco pvc anime', 'boneco decorativo anime',
    ],                                                                               phraseKey: 'figura anime' },
  // Funko Pop (vinil — detectar separadamente do figure PVC)
  { kw: [
      'funko pop', 'funko', 'vinyl figure', 'figure vinil', 'figure vinil',
      'funko marvel', 'funko dc', 'funko anime', 'funko naruto', 'funko dragon ball',
      'funko one piece', 'funko batman', 'funko spiderman', 'funko spider-man',
    ],                                                                               phraseKey: 'funko pop' },
  // Nendoroid / Figma / SH Figuarts (figuras articuladas premium)
  { kw: [
      'nendoroid', 'figma', 'sh figuarts', 'figuarts', 'good smile company',
      'revoltech', 'banpresto', 'ichiban kuji',
    ],                                                                               phraseKey: 'nendoroid' },
  // Camiseta anime / geek / super-herói (ANTES do detector genérico de camiseta)
  { kw: [
      'camiseta anime', 'camisa anime', 'camiseta naruto', 'camiseta dragon ball',
      'camiseta one piece', 'camiseta demon slayer', 'camiseta attack on titan',
      'camiseta jujutsu', 'camiseta bleach', 'camiseta fullmetal', 'camiseta tokyo ghoul',
      'camiseta my hero academia', 'camiseta chainsaw man', 'camiseta mob psycho',
      'camiseta sword art', 'camiseta fairy tail', 'camiseta hunter x hunter',
      'camiseta geek', 'camisa geek', 'camiseta nerd', 'camisa nerd',
      'camiseta marvel', 'camiseta dc', 'camiseta super herói', 'camiseta super-herói',
      'camiseta batman', 'camiseta superman', 'camiseta spider-man', 'camiseta spiderman',
      'camiseta iron man', 'camiseta hulk', 'camiseta thor', 'camiseta captain america',
      'camiseta capitão america', 'camiseta flash', 'camiseta aquaman', 'camiseta lanterna',
      'camiseta x-men', 'camiseta xmen', 'camiseta wolverine', 'camiseta deadpool',
      'camiseta thanos', 'camiseta avengers', 'camiseta vingadores',
      'camiseta hq', 'camisa hq', 'camiseta quadrinhos', 'camisa quadrinhos',
      'camiseta otaku', 'camisa otaku', 'camiseta geek anime',
    ],                                                                               phraseKey: 'camiseta anime' },

  { kw: ['camiseta', 'camisa', 'jersey', 'uniforme'],                               phraseKey: 'camisa',           brandCat: 'roupas' },
  // ─── Vestuário externo (mais específico primeiro) ─────────────────────────
  { kw: ['jaqueta masculina', 'jaqueta para homem', 'jaqueta bomber masculina', 'jaqueta corta-vento masculina', 'jaqueta puffer masculina'], phraseKey: 'jaqueta masculina' },
  { kw: ['jaqueta feminina', 'jaqueta para mulher', 'jaqueta bomber feminina', 'jaqueta corta-vento feminina', 'jaqueta puffer feminina', 'jaqueta trench coat'], phraseKey: 'jaqueta feminina' },
  { kw: ['puffer jacket', 'jaqueta puffer', 'casaco puffer', 'parka masculino', 'parka feminino', 'parka', 'sobretudo', 'trench coat', 'casaco de inverno'], phraseKey: 'casaco' },
  { kw: ['jaqueta jeans', 'jaqueta couro', 'jaqueta corta-vento', 'jaqueta bomber', 'jaqueta'],  phraseKey: 'jaqueta' },
  { kw: ['moletom com zíper', 'moletom fechado', 'moletom canguru', 'moletom'],       phraseKey: 'moletom' },
  { kw: ['agasalho', 'conjunto agasalho', 'conjunto moletom'],                        phraseKey: 'moletom' },
  { kw: ['casaco', 'blazer de lã', 'blazer inverno'],                                 phraseKey: 'casaco' },
  { kw: ['suéter', 'sueter', 'tricô', 'trico', 'cardigan'],                          phraseKey: 'roupa' },
  { kw: ['blusa de frio', 'blusa feminina', 'blusa'],                                 phraseKey: 'roupa',            brandCat: 'roupas' },

  // ─── Vestuário feminino (mais específico primeiro) ─────────────────────────
  { kw: ['vestido longo', 'vestido curto', 'vestido midi', 'vestido festa'],          phraseKey: 'vestido' },
  { kw: ['vestido'],                                                                  phraseKey: 'vestido' },
  { kw: ['saia longa', 'saia midi', 'saia curta'],                                   phraseKey: 'roupa' },
  { kw: ['saia'],                                                                     phraseKey: 'roupa' },
  { kw: ['cropped', 'top feminino', 'top esportivo'],                                 phraseKey: 'roupa' },
  { kw: ['maiô', 'biquíni', 'maio', 'biquini'],                                       phraseKey: 'roupa' },
  { kw: ['lingerie', 'sutiã', 'sutia', 'calcinha'],                                   phraseKey: 'roupa' },
  { kw: ['pijama feminino', 'pijama masculino', 'pijama'],                             phraseKey: 'roupa' },

  // ─── Acessórios de vestuário ───────────────────────────────────────────────
  { kw: ['boné', 'bone', 'cap', 'viseira', 'chapéu', 'chapeu'],                      phraseKey: 'boné',             brandCat: 'roupas' },
  { kw: ['papel a4', 'papel sulfite', 'resma de papel', 'resma papel', 'papel para impressora', 'papel de impressão', 'papel report', 'papel 75g', 'papel 90g', 'folhas a4'], phraseKey: 'papel a4' },
  { kw: ['mochila escolar', 'mochila infantil', 'mochila escolar infantil'],           phraseKey: 'mochila escolar' },
  { kw: ['mochila para notebook', 'mochila para pc', 'mochila executiva'],            phraseKey: 'mochila casual' },
  { kw: ['mochila de viagem', 'mochila trekking', 'mochila mochileiro'],              phraseKey: 'mochila de viagem' },
  { kw: ['mochila maternidade', 'mochila de bebê', 'mochila bebe'],                  phraseKey: 'mochila maternidade' },
  { kw: ['mochila esportiva', 'mochila de academia', 'mochila casual'],               phraseKey: 'mochila casual' },
  { kw: ['mochila'],                                                                  phraseKey: 'mochila' },
  { kw: ['bolsa feminina', 'bolsa de couro', 'bolsa casual', 'bolsa de mão', 'bolsa transversal', 'bolsa clutch'], phraseKey: 'bolsa' },
  { kw: ['tote bag', 'pochete', 'bolsa', 'bag'],                                      phraseKey: 'bolsa' },
  { kw: ['mala de viagem', 'mala de rodinha', 'mala'],                                phraseKey: 'mochila de viagem' },
  { kw: ['carteira masculina', 'carteira feminina', 'carteira'],                       phraseKey: 'roupa' },
  { kw: ['cinto', 'cinto de couro'],                                                  phraseKey: 'roupa' },
  { kw: ['óculos de sol', 'oculos de sol', 'óculos solar', 'sunglasses'],              phraseKey: 'óculos de sol' },
  { kw: ['óculos de grau', 'oculos de grau', 'armação de grau', 'armacao de grau', 'óculos com lente', 'óculos receituário'], phraseKey: 'óculos de grau' },
  { kw: ['óculos', 'oculos'],                                                          phraseKey: 'óculos' },
  { kw: ['necessaire'],                                                               phraseKey: 'roupa' },

  // ─── Vestuário inferior (mais específico primeiro) ─────────────────────────
  { kw: ['calça social', 'calça de alfaiataria', 'calça de linho', 'calça formal'],   phraseKey: 'calça social' },
  { kw: ['calça jeans', 'jeans masculino', 'jeans feminino', 'jeans skinny', 'jeans slim'], phraseKey: 'calça',     brandCat: 'roupas' },
  { kw: ['legging', 'legging fitness', 'calça legging'],                              phraseKey: 'legging' },
  { kw: ['bermuda jeans', 'bermuda masculina', 'bermuda feminina', 'bermuda'],        phraseKey: 'bermuda' },
  { kw: ['shorts fitness', 'shorts esportivo', 'shorts masculino', 'shorts'],         phraseKey: 'bermuda' },
  { kw: ['calça de moletom', 'calça sweatpants'],                                     phraseKey: 'calça' },
  { kw: ['calça', 'calca'],                                                           phraseKey: 'calça',            brandCat: 'roupas' },

  // ─── Roupa Íntima (detectar ANTES de marcas esportivas para evitar conflito) ──
  { kw: ['cueca boxer', 'cueca brief', 'cueca slip', 'kit cueca', 'cueca sem costura', 'cueca masculina', 'cueca'], phraseKey: 'cueca' },
  { kw: ['calcinha', 'calcinha fio dental', 'calcinha sem costura', 'kit calcinha'],  phraseKey: 'cueca' },

  // ─── Slides de Marca (detectar ANTES de Nike/Adidas/Lacoste para evitar pool errado) ──
  { kw: ['slide nike', 'chinelo nike', 'nike slide', 'chinelo adidas', 'slide adidas', 'adidas slide', 'chinelo lacoste', 'slide lacoste', 'lacoste slide', 'chinelo puma', 'slide puma', 'puma slide', 'chinelo fila', 'slide fila', 'chinelo vans', 'slide vans'], phraseKey: 'slide' },
  { kw: ['slide masculino', 'slide feminino', 'slide esportivo', 'chinelo slide', 'slide'],  phraseKey: 'slide' },

  // ─── Calçados (mais específico primeiro) ─────────────────────────────────
  { kw: ['tênis running', 'tênis de corrida', 'tênis esportivo', 'tênis training'],   phraseKey: 'tênis',            brandCat: 'tenis' },
  { kw: ['tênis casual', 'tênis lifestyle', 'tênis chunky'],                          phraseKey: 'tênis',            brandCat: 'tenis' },
  { kw: ['tênis', 'tenis', 'sneaker', 'sapatênis', 'sapatenis'],                      phraseKey: 'tênis',            brandCat: 'tenis' },
  { kw: ['chuteira society', 'chuteira campo', 'chuteira futsal', 'chuteira'],        phraseKey: 'chuteira' },
  { kw: ['botina de segurança', 'botina de trabalho', 'botina'],                      phraseKey: 'bota' },
  { kw: ['bota feminina', 'bota de couro', 'bota cano longo', 'bota'],               phraseKey: 'bota' },
  { kw: ['crocs bayaband', 'crocs classic', 'crocs clog', 'sandalia crocs', 'sandália crocs', 'crocs'],  phraseKey: 'crocs' },
  { kw: ['crocs bayaband', 'crocs classic', 'crocs clog', 'sandália crocs', 'crocs'],  phraseKey: 'crocs' },
  { kw: ['sandália rasteira', 'sandália plataforma', 'sandália feminina'],            phraseKey: 'sandália' },
  { kw: ['sandália', 'sandalia'],                                                     phraseKey: 'sandália' },
  { kw: ['chinelo de dedo', 'chinelo masculino', 'chinelo feminino', 'chinelo slide'], phraseKey: 'chinelo', brandCat: 'chinelo' },
  { kw: ['havaianas', 'rider', 'kenner', 'ipanema'],                                  phraseKey: 'chinelo', brandCat: 'chinelo' },
  { kw: ['chinelo', 'alpargata', 'rasteira', 'tamanco'],                              phraseKey: 'chinelo', brandCat: 'chinelo' },
  { kw: ['sapato social masculino', 'sapato social feminino', 'sapato social'],       phraseKey: 'sapato' },
  { kw: ['mocassim', 'loafer', 'oxford', 'derby'],                                   phraseKey: 'sapato' },
  { kw: ['scarpin', 'salto alto', 'salto stiletto', 'plataforma'],                   phraseKey: 'sapato' },
  { kw: ['sapato casual', 'sapato'],                                                  phraseKey: 'sapato' },

  // ─── TV / Projeção (mais específico primeiro) ─────────────────────────────
  { kw: ['smart tv', 'smartv'],                                                       phraseKey: 'smart tv' },
  { kw: ['tv qled', 'tv oled', 'tv neo qled'],                                        phraseKey: 'smart tv' },
  { kw: ['tv 4k', 'tv 8k', 'tv uhd', 'tv led', 'tv full hd'],                        phraseKey: 'tv' },
  { kw: ['televisor', 'televisão', 'televisao'],                                      phraseKey: 'tv' },
  { kw: ['suporte para tv gamer', 'suporte tv gamer'],                               phraseKey: 'suporte gamer monitor' },
  { kw: ['suporte para tv', 'suporte de tv', 'suporte tv', 'suporte parede tv', 'fixador tv', 'fixador de tv'], phraseKey: 'suporte para tv' },
  { kw: ['projetor smart', 'smart projector', 'projetor android', 'projetor wifi', 'projetor wi-fi'], phraseKey: 'projetor smart' },
  { kw: ['mini projetor', 'projetor portátil', 'projetor pocket'],                   phraseKey: 'mini projetor' },
  { kw: ['projetor'],                                                                 phraseKey: 'projetor' },

  // ─── Computação (mais específico primeiro) ───────────────────────────────
  { kw: ['notebook gamer', 'laptop gamer'],                                           phraseKey: 'notebook' },
  { kw: ['notebook ultrafino', 'notebook ultrabook', 'notebook 2 em 1'],              phraseKey: 'notebook' },
  { kw: ['notebook', 'laptop'],                                                       phraseKey: 'notebook' },
  { kw: ['tablet infantil', 'tablet android', 'tablet samsung', 'tablet apple'],      phraseKey: 'tablet' },
  { kw: ['tablet'],                                                                   phraseKey: 'tablet' },
  { kw: ['suporte monitor gamer', 'suporte para monitor gamer', 'suporte gamer monitor', 'suporte monitor rgb'], phraseKey: 'suporte gamer monitor' },
  { kw: ['suporte para monitor', 'suporte de monitor', 'suporte monitor', 'braço monitor', 'braco monitor', 'elevador monitor'], phraseKey: 'suporte para monitor' },
  { kw: ['monitor gamer', 'monitor 4k', 'monitor curvo', 'monitor ultrawide'],        phraseKey: 'monitor' },
  { kw: ['monitor'],                                                                  phraseKey: 'monitor' },
  { kw: ['placa de vídeo', 'placa de video', 'gpu', 'rtx', 'gtx', 'radeon'],         phraseKey: 'placa de vídeo' },
  { kw: ['processador intel', 'processador amd', 'processador', 'cpu'],               phraseKey: 'processador' },
  { kw: ['memória ram', 'memoria ram', 'pente de ram'],                               phraseKey: 'memória ram' },
  { kw: ['ssd nvme', 'ssd sata', 'ssd m.2', 'ssd'],                                  phraseKey: 'ssd' },
  { kw: ['hd externo', 'hd interno', 'pendrive', 'pen drive', 'leitor de cartão'],   phraseKey: 'ssd' },
  { kw: ['mouse vertical', 'mouse ergonômico vertical', 'vertical mouse'],             phraseKey: 'mouse vertical' },
  { kw: ['mouse gamer', 'mouse sem fio', 'mouse bluetooth'],                          phraseKey: 'mouse' },
  { kw: ['mouse'],                                                                    phraseKey: 'mouse' },
  { kw: ['teclado laser', 'teclado de projeção', 'teclado holográfico'],              phraseKey: 'teclado laser' },
  { kw: ['teclado gamer', 'teclado mecânico', 'teclado sem fio'],                     phraseKey: 'teclado' },
  { kw: ['teclado'],                                                                  phraseKey: 'teclado' },
  { kw: ['webcam full hd', 'webcam 4k', 'webcam'],                                   phraseKey: 'webcam' },
  { kw: ['impressora multifuncional', 'impressora a laser', 'impressora'],            phraseKey: 'impressora' },

  // ─── Mobile (mais específico primeiro) ────────────────────────────────────
  { kw: ['iphone 15', 'iphone 14', 'iphone 13', 'iphone 12', 'iphone'],              phraseKey: 'iphone' },
  { kw: ['samsung galaxy s', 'galaxy s24', 'galaxy s23', 'samsung galaxy'],          phraseKey: 'samsung' },
  { kw: ['xiaomi', 'redmi note', 'redmi', 'poco'],                                   phraseKey: 'xiaomi' },
  { kw: ['motorola moto', 'moto g', 'motorola'],                                     phraseKey: 'celular' },
  { kw: ['celular', 'smartphone'],                                                    phraseKey: 'celular' },
  { kw: ['smartwatch', 'smart watch', 'relógio inteligente', 'relogio inteligente'],  phraseKey: 'smartwatch' },

  // ─── Áudio (mais específico primeiro) ─────────────────────────────────────
  { kw: ['airpods pro', 'airpods max', 'airpods'],                                    phraseKey: 'airpods' },
  { kw: ['fone de ouvido sem fio', 'fone bluetooth', 'headphone bluetooth'],          phraseKey: 'fone' },
  { kw: ['fone de ouvido com fio', 'fone p2', 'headphone com fio'],                   phraseKey: 'fone' },
  { kw: ['headset gamer', 'headset'],                                                 phraseKey: 'fone' },
  { kw: ['fone de ouvido', 'headphone', 'earphone', 'earbuds', 'in-ear'],            phraseKey: 'fone' },
  { kw: ['soundbar com subwoofer', 'soundbar bluetooth', 'soundbar', 'sound bar'],    phraseKey: 'soundbar' },
  { kw: ['jbl charge', 'jbl flip', 'jbl xtreme', 'jbl boombox', 'jbl go', 'jbl clip', 'jbl partybox', 'jbl'], phraseKey: 'caixa de som', brandCat: 'caixa de som' },
  { kw: ['bose soundlink', 'bose portable', 'bose speaker', 'bose'],                 phraseKey: 'caixa de som', brandCat: 'caixa de som' },
  { kw: ['marshall emberton', 'marshall kilburn', 'marshall stanmore', 'marshall acton', 'marshall woburn', 'marshall speaker', 'marshall bluetooth'], phraseKey: 'caixa de som', brandCat: 'caixa de som' },
  { kw: ['sony srs', 'sony xb', 'sony x-series', 'caixa sony'],                      phraseKey: 'caixa de som', brandCat: 'caixa de som' },
  { kw: ['caixa de som bluetooth', 'caixinha bluetooth', 'speaker bluetooth'],        phraseKey: 'caixa de som', brandCat: 'caixa de som' },
  { kw: ['caixa de som', 'caixa amplificada'],                                        phraseKey: 'caixa de som', brandCat: 'caixa de som' },
  // ── Microfones (mais específico primeiro) ──────────────────────────────────
  { kw: ['microfone lapela', 'lapela sem fio', 'microfone de lapela', 'lavalier'],    phraseKey: 'microfone lapela' },
  { kw: ['microfone usb', 'microfone condensador usb', 'mic usb'],                   phraseKey: 'microfone usb' },
  { kw: ['microfone gamer', 'microfone para stream'],                                 phraseKey: 'microfone gamer' },
  { kw: ['microfone condensador', 'microfone cardioide', 'microfone'],               phraseKey: 'microfone' },
  { kw: ['toca-disco', 'vitrola', 'tornamesa'],                                       phraseKey: 'toca-disco' },
  // ── Tech para Criadores de Conteúdo ───────────────────────────────────────
  { kw: ['ring light', 'ringlight', 'anel de luz', 'iluminador circular'],           phraseKey: 'ring light' },
  { kw: ['tripé articulado', 'tripé flexível', 'tripé para celular', 'tripé para câmera', 'tripé de mesa', 'tripé', 'tripe'], phraseKey: 'tripé' },
  { kw: ['placa de captura', 'capture card', 'captura de vídeo'],                    phraseKey: 'placa de captura' },
  { kw: ['stream deck', 'streamdeck'],                                                phraseKey: 'stream deck' },
  { kw: ['teleprompter', 'telepromter', 'teleprompt'],                               phraseKey: 'teleprompter' },
  // ── AI Gadgets ────────────────────────────────────────────────────────────
  { kw: ['gravador com ia', 'gravador ia', 'transcrição automática', 'gravador de reunião', 'gravador de voz ia', 'transcrição de áudio'], phraseKey: 'gravador com ia' },
  { kw: ['tradutor portátil', 'tradutor instantâneo', 'dispositivo tradutor', 'tradutor de bolso'], phraseKey: 'tradutor portátil' },
  { kw: ['caneta digitalizadora', 'caneta scanner', 'caneta leitora', 'pen scanner'], phraseKey: 'caneta digitalizadora' },
  { kw: ['scanner portátil', 'scanner de mesa portátil', 'digitalizador portátil'],  phraseKey: 'scanner portátil' },
  { kw: ['óculos com ia', 'óculos inteligente', 'smart glasses', 'óculos ar', 'óculos de realidade aumentada'], phraseKey: 'óculos com ia' },
  // ── Gadgets Futuristas ────────────────────────────────────────────────────
  { kw: ['display holográfico', 'leque holográfico', 'fan holográfico', 'holograma', 'quadro digital led'], phraseKey: 'display holográfico' },
  // ── Tech para Celular ─────────────────────────────────────────────────────
  { kw: ['carregador magnético', 'carregador magsafe', 'magsafe', 'carregador mag-safe'], phraseKey: 'carregador magnético' },
  { kw: ['power bank solar', 'carregador solar portátil', 'bateria solar portátil'], phraseKey: 'power bank solar' },
  { kw: ['hub usb-c', 'hub usb c', 'hub tipo-c', 'hub para notebook', 'adaptador usb-c multiportas'], phraseKey: 'hub usb-c' },
  { kw: ['dock station', 'docking station', 'base para notebook'],                   phraseKey: 'dock station' },
  { kw: ['lente para celular', 'lentes para celular', 'lente macro celular', 'lente grande angular celular', 'kit de lentes'], phraseKey: 'lentes para celular' },
  { kw: ['gimbal', 'estabilizador gimbal', 'estabilizador para celular', 'gimbal para celular', 'gimbal para câmera'], phraseKey: 'gimbal' },
  // ── Suportes (mais específico primeiro) ───────────────────────────────────
  { kw: ['suporte gamer monitor', 'suporte monitor gamer', 'suporte de monitor gamer', 'suporte articulado gamer', 'braço monitor gamer', 'braço gamer monitor'], phraseKey: 'suporte gamer monitor' },
  { kw: ['suporte para monitor', 'suporte de monitor', 'suporte elevador monitor', 'braço articulado monitor', 'braço de monitor'], phraseKey: 'suporte para monitor' },
  { kw: ['suporte para tv', 'suporte de tv', 'suporte de parede tv', 'suporte parede tv', 'suporte articulado tv', 'braço tv', 'fixador tv', 'fixação tv'], phraseKey: 'suporte para tv' },

  // ─── Eletrodomésticos (mais específico primeiro) ──────────────────────────
  { kw: ['air fryer digital', 'air fryer elétrica', 'air fryer', 'airfryer', 'fritadeira sem óleo'], phraseKey: 'air fryer' },
  { kw: ['adega climatizada', 'adega de vinho', 'adega para vinho', 'cave de vinho', 'refrigerador de vinho'], phraseKey: 'adega climatizada' },
  { kw: ['geladeira frost free', 'geladeira side by side', 'geladeira duplex'],       phraseKey: 'geladeira' },
  { kw: ['geladeira', 'refrigerador', 'frigobar'],                                   phraseKey: 'geladeira' },
  { kw: ['microondas de bancada', 'microondas com grill', 'microondas'],              phraseKey: 'microondas' },
  { kw: ['máquina de lavar roupa', 'lavadora de roupas', 'lava e seca', 'lavadora'],  phraseKey: 'máquina de lavar' },
  { kw: ['fogão 4 bocas', 'fogão 5 bocas', 'fogão a gás', 'fogão'],                  phraseKey: 'fogão' },
  { kw: ['cooktop de indução', 'cooktop elétrico', 'fogão de indução', 'fogão elétrico', 'placa de indução', 'fogão vitrocerâmico'], phraseKey: 'fogão de indução' },
  { kw: ['cooktop a gás', 'cooktop'],                                                 phraseKey: 'fogão' },
  { kw: ['forno elétrico', 'forno de embutir', 'forno a gás'],                        phraseKey: 'microondas' },
  { kw: ['liquidificador', 'batedeira', 'processador de alimentos'],                  phraseKey: 'liquidificador' },
  { kw: ['sanduicheira elétrica', 'sanduicheira'],                                    phraseKey: 'sanduicheira' },
  { kw: ['omeleteira elétrica', 'omeleteira antiaderente', 'omeleteira'],            phraseKey: 'omeleteira' },
  { kw: ['grill elétrico', 'wafleira', 'crepioca'],                                  phraseKey: 'sanduicheira' },
  { kw: ['bebedouro de coluna', 'bebedouro refrigerado', 'bebedouro compressor', 'purificador de água', 'filtro de água', 'bebedouro'], phraseKey: 'bebedouro' },
  { kw: ['chaleira elétrica', 'chaleira'],                                            phraseKey: 'cafeteira' },
  { kw: ['cafeteira espresso', 'cafeteira nespresso', 'cafeteira dolce gusto', 'máquina de café', 'cafeteira'], phraseKey: 'cafeteira' },
  { kw: ['caneca de porcelana', 'caneca personalizada', 'caneca de cerâmica', 'caneca térmica', 'caneca', 'xícara de café', 'xícara'], phraseKey: 'caneca' },
  { kw: ['kit de copos', 'conjunto de copos', 'jogo de copos', 'copo americano', 'copo de vidro', 'copo long drink', 'copo de cristal', 'copo de whisky'], phraseKey: 'copo' },
  { kw: ['aspirador de pó e água', 'aspirador pó e água', 'aspirador agua e po', 'aspirador 2 em 1', 'aspirador molhado e seco'], phraseKey: 'aspirador pó e água' },
  { kw: ['robô aspirador', 'aspirador de pó sem fio', 'aspirador de pó', 'aspirador'], phraseKey: 'aspirador' },
  { kw: ['ventilador de teto', 'ventilador de mesa', 'climatizador', 'ventilador'],   phraseKey: 'ventilador' },
  { kw: ['ar condicionado split', 'ar condicionado portátil', 'ar condicionado'],     phraseKey: 'ar condicionado' },
  { kw: ['ferro de passar a vapor', 'ferro de passar', 'vaporizador'],                phraseKey: 'ferro de passar' },
  { kw: ['fralda geriátrica', 'fralda para adulto', 'fralda adulto', 'fralda de idoso', 'fralda geriátricas', 'absorvente geriátrico', 'roupa íntima descartável adulto'], phraseKey: 'fralda geriátrica' },
  { kw: ['fralda descartável', 'fralda infantil', 'fralda bebê', 'fralda bebe', 'fralda recém-nascido', 'fralda recem nascido', 'fralda turma da mônica', 'fralda huggies', 'fralda pampers', 'fralda babysec', 'fralda pom pom', 'pacote de fralda', 'pacote fralda', 'kit fralda', 'fralda'], phraseKey: 'fralda' },
  { kw: ['gloss labial', 'lip gloss', 'gloss lábio', 'gloss fran', 'gloss mel', 'gloss hidratante', 'gloss brilhoso', 'gloss'], phraseKey: 'gloss' },
  { kw: ['batom líquido', 'batom matte', 'batom gloss', 'batom', 'lip balm', 'lip tint'], phraseKey: 'batom' },
  { kw: ['gloss labial', 'lip gloss', 'gloss lip', 'batom gloss', 'gloss hidratante', 'gloss brilhoso', 'gloss'], phraseKey: 'gloss' },
  { kw: ['batom líquido', 'batom matte', 'batom cremoso', 'batom'],                   phraseKey: 'batom' },
  { kw: ['depilador elétrico', 'depilador feminino', 'epilador', 'depilador corporal', 'depilador', 'barbeador feminino'], phraseKey: 'depilador elétrico' },
  { kw: ['máquina de cortar cabelo', 'cortador de cabelo', 'clipper de cabelo', 'máquina de cabelo', 'máquina corte de cabelo'], phraseKey: 'máquina de cortar cabelo' },

  // ─── Vestuário Impermeável ─────────────────────────────────────────────
  { kw: ['capa de chuva', 'capa impermeável', 'capa para moto', 'capa moto chuva', 'poncho impermeável', 'poncho chuva', 'roupa impermeável', 'jaqueta impermeável', 'corta-vento impermeável'], phraseKey: 'capa de chuva' },

  // ─── Cozinha — utensílios (mais específico primeiro) ─────────────────────
  { kw: ['conjunto de panelas', 'jogo de panelas', 'kit panelas', 'jogo de cozinha'], phraseKey: 'panela',           brandCat: 'cozinha' },
  { kw: ['panela de pressão elétrica', 'panela de pressão'],                          phraseKey: 'panela',           brandCat: 'cozinha' },
  { kw: ['frigideira antiaderente', 'frigideira de ferro', 'frigideira'],             phraseKey: 'panela',           brandCat: 'cozinha' },
  { kw: ['wok', 'caçarola', 'panela'],                                                phraseKey: 'panela',           brandCat: 'cozinha' },
  { kw: ['assadeira', 'forma de bolo', 'forma de pizza', 'forma'],                    phraseKey: 'panela',           brandCat: 'cozinha' },
  { kw: ['kit de facas', 'conjunto de facas', 'faca de chef', 'faca'],                phraseKey: 'panela',           brandCat: 'cozinha' },
  { kw: ['tábua de cortar', 'tábua de madeira'],                                      phraseKey: 'panela',           brandCat: 'cozinha' },
  { kw: ['pote hermético', 'pote de vidro', 'vasilha', 'pote'],                       phraseKey: 'panela',           brandCat: 'cozinha' },
  { kw: ['stanley quencher', 'stanley tumbler', 'stanley copo', 'copo stanley', 'garrafa stanley', 'stanley térmica', 'stanley 40oz', 'stanley 30oz'], phraseKey: 'stanley térmica' },
  { kw: ['garrafa térmica', 'copo térmico', 'squeeze térmico', 'squeeze', 'copo de viagem', 'copo inox'], phraseKey: 'garrafa térmica' },

  // ─── Ferramentas — subtipos (mais específico primeiro) ────────────────────
  { kw: ['furadeira de impacto', 'furadeira sem fio', 'furadeira'],                   phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['parafusadeira sem fio', 'parafusadeira'],                                   phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['esmerilhadeira angular', 'esmerilhadeira'],                                 phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['martelete', 'rotomartelo', 'britadeira'],                                   phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['serra circular', 'serra de bancada', 'policorte', 'serra tico-tico'],       phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['lixadeira orbital', 'lixadeira de cinta', 'lixadeira'],                    phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['soprador', 'soprador de ar quente'],                                        phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['compressor de ar', 'compressor'],                                           phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['gerador de energia', 'gerador'],                                            phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['chave de impacto', 'chave torquímetro', 'torquímetro'],                     phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['chave inglesa', 'chave de fenda', 'chave allen', 'chave combinada'],        phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['alicate universal', 'alicate de pressão', 'alicate', 'alicates'],          phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['martelo', 'marreta'],                                                       phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['broca para madeira', 'broca para metal', 'broca para concreto', 'broca'],  phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['nível a laser', 'nível digital', 'nível'],                                  phraseKey: 'ferramenta',       brandCat: 'ferramentas' },
  { kw: ['caixa de ferramentas', 'kit de ferramentas', 'maleta de ferramentas'],      phraseKey: 'ferramenta',       brandCat: 'ferramentas' },

  // ─── NICHO: PERFUMARIA — subtipos do mais específico para o mais genérico ──

  // 1. Perfume árabe / Oud — detectar antes de "perfume" genérico
  { kw: ['perfume árabe', 'perfume arabe', 'oud', 'oudh', 'bakhoor', 'attar', 'amouage', 'lattafa', 'maison alhambra', 'rasasi'], phraseKey: 'perfume árabe' },

  // 2. Perfume importado / grife
  { kw: ['perfume importado', 'perfume grife', 'parfum importado', 'dior', 'chanel', 'givenchy', 'yves saint laurent', 'ysl', 'armani', 'versace', 'hugo boss', 'calvin klein parfum', 'mont blanc', 'paco rabanne', 'creed', 'tom ford', 'thierry mugler', 'lancome', 'guerlain', 'hermes parfum', 'burberry'], phraseKey: 'perfume importado' },

  // 3. Kit de perfume / presente
  { kw: ['kit de perfume', 'kit perfume', 'conjunto de perfume', 'presente perfume', 'caixa de perfume', 'gift set perfume'], phraseKey: 'kit de perfume' },

  // 4. Perfume feminino
  { kw: ['perfume feminino', 'eau de parfum feminino', 'fragrance feminino', 'parfum feminino', 'perfume para mulher', 'perfume feminino floral', 'perfume feminino frutal', 'perfume feminino oriental'], phraseKey: 'perfume feminino' },

  // 5. Perfume masculino
  { kw: ['perfume masculino', 'eau de parfum masculino', 'fragrance masculino', 'parfum masculino', 'perfume para homem', 'perfume masculino madeiroso', 'perfume masculino fresco', 'perfume masculino intenso'], phraseKey: 'perfume masculino' },

  // 6. Body splash / bruma / splash
  { kw: ['body splash', 'body mist', 'bruma corporal', 'bruma perfumada', 'splash corporal'], phraseKey: 'body splash' },

  // 7. Colônia / deo colônia
  { kw: ['deo colônia masculino', 'deo colônia feminino', 'deo colônia', 'colônia masculina', 'colônia feminina', 'eau de cologne'], phraseKey: 'colônia' },

  // 8. Perfume genérico (fallback do nicho)
  { kw: ['perfume', 'eau de parfum', 'eau de toilette', 'fragrance', 'fragrância', 'colônia'], phraseKey: 'perfume' },

  // ─── Beleza / Cabelo ──────────────────────────────────────────────────────
  { kw: ['secador de cabelo profissional', 'secador de cabelo', 'secador'],           phraseKey: 'secador' },
  { kw: ['chapinha profissional', 'prancha de cabelo', 'chapinha', 'prancha'],        phraseKey: 'chapinha' },
  { kw: ['barbeador elétrico', 'aparelho de barbear', 'aparador de pelos'],           phraseKey: 'barbeador elétrico' },
  { kw: ['escova rotativa', 'escova secadora rotativa', 'escova com rotação', 'babyliss rotativa', 'escova styling'], phraseKey: 'escova rotativa' },
  { kw: ['escova secadora', 'escova alisadora', 'escova modeladora'],                phraseKey: 'escova rotativa' },

  // ─── Relógios / Joias (mais específico primeiro) ──────────────────────────
  { kw: ['relógio masculino', 'relogio masculino', 'watch masculino'],                phraseKey: 'relógio masculino' },
  { kw: ['relógio feminino', 'relogio feminino', 'watch feminino'],                   phraseKey: 'relógio feminino' },
  { kw: ['relógio de luxo', 'relógio automático', 'relógio analógico'],               phraseKey: 'relógio masculino' },
  { kw: ['relógio', 'relogio'],                                                       phraseKey: 'smartwatch' },
  { kw: ['corrente de ouro', 'corrente de prata', 'corrente masculina'],              phraseKey: 'corrente masculina' },
  { kw: ['pulseira de couro', 'pulseira masculina', 'pulseira feminina', 'pulseira'], phraseKey: 'corrente masculina' },
  { kw: ['anel de ouro', 'anel de prata', 'anel', 'aliança'],                        phraseKey: 'corrente masculina' },
  { kw: ['brinco de ouro', 'brinco de prata', 'brinco'],                             phraseKey: 'corrente masculina' },
  { kw: ['colar', 'gargantilha', 'pingente', 'joias', 'bijuteria'],                  phraseKey: 'corrente masculina' },

  // ─── Games / Entretenimento (mais específico primeiro) ────────────────────
  { kw: ['playstation 5', 'ps5'],                                                     phraseKey: 'ps5' },
  { kw: ['playstation 4', 'ps4', 'playstation'],                                      phraseKey: 'playstation' },
  { kw: ['xbox series x', 'xbox series s', 'xbox one', 'xbox'],                       phraseKey: 'xbox' },
  { kw: ['nintendo switch oled', 'nintendo switch lite', 'nintendo switch'],          phraseKey: 'nintendo switch' },
  // ─── Controles específicos (mais específico primeiro) ─────────────────────
  { kw: ['dualsense', 'dual sense', 'controle ps5', 'controle playstation 5'],        phraseKey: 'dualsense' },
  { kw: ['dualshock', 'dual shock', 'controle ps4', 'controle playstation 4'],        phraseKey: 'dualsense' },
  { kw: ['controle xbox series', 'controle xbox one', 'xbox controller'],             phraseKey: 'controle xbox' },
  { kw: ['joy-con', 'joycon', 'controle switch', 'controle pro nintendo', 'nintendo pro controller'], phraseKey: 'controle nintendo' },
  { kw: ['controle sem fio', 'controle wireless', 'controle bluetooth', 'gamepad wireless'], phraseKey: 'controle gamer' },
  { kw: ['controle de videogame', 'controle para videogame', 'joystick', 'gamepad', 'controle gamer'], phraseKey: 'controle gamer' },
  { kw: ['console', 'videogame', 'video game'],                                       phraseKey: 'videogame' },
  { kw: ['jogo ps5', 'jogo ps4', 'jogo xbox', 'jogo nintendo'],                       phraseKey: 'videogame' },
  // ─── Cadeiras e Poltronas Gamer (mais específico primeiro) ──────────────────
  { kw: ['poltrona gamer', 'poltrona reclinável gamer'],                               phraseKey: 'poltrona gamer', brandCat: 'cadeira gamer' },
  { kw: ['cadeira gamer dxracer', 'dxracer'],                                          phraseKey: 'cadeira gamer', brandCat: 'cadeira gamer' },
  { kw: ['cadeira gamer thunderx3', 'thunderx3'],                                      phraseKey: 'cadeira gamer', brandCat: 'cadeira gamer' },
  { kw: ['cadeira gamer cougar', 'cougar gaming chair', 'cougar gamer'],               phraseKey: 'cadeira gamer', brandCat: 'cadeira gamer' },
  { kw: ['cadeira gamer secretlab', 'secretlab'],                                      phraseKey: 'cadeira gamer', brandCat: 'cadeira gamer' },
  { kw: ['cadeira gamer razer', 'razer iskur'],                                        phraseKey: 'cadeira gamer', brandCat: 'cadeira gamer' },
  { kw: ['cadeira gamer'],                                                              phraseKey: 'cadeira gamer', brandCat: 'cadeira gamer' },

  // ─── Móveis / Casa (mais específico primeiro) ─────────────────────────────
  { kw: ['guarda-roupa casal', 'guarda roupa casal', 'guarda-roupa solteiro', 'guarda roupa solteiro', 'guarda-roupa', 'guarda roupa', 'armário de quarto', 'armário embutido'], phraseKey: 'guarda-roupa' },
  { kw: ['cômoda 3 gavetas', 'cômoda 4 gavetas', 'cômoda com espelho', 'cômoda para quarto', 'cômoda', 'comoda'], phraseKey: 'cômoda' },
  { kw: ['escrivaninha com gaveta', 'escrivaninha gamer', 'mesa para escritório', 'mesa de escritório', 'mesa de estudo', 'mesa gamer', 'escrivaninha'], phraseKey: 'escrivaninha' },
  { kw: ['mesa de jantar 4 lugares', 'mesa de jantar 6 lugares', 'mesa de jantar 8 lugares', 'mesa de jantar', 'mesa jantar'], phraseKey: 'mesa de jantar' },
  { kw: ['sofá retrátil', 'sofá de canto', 'sofá cama', 'sofá', 'sofa'],             phraseKey: 'sofá' },
  { kw: ['poltrona', 'cadeira de escritório', 'cadeira ergonômica'],                  phraseKey: 'sofá' },
  { kw: ['colchão de molas', 'colchão viscoelástico', 'colchão'],                     phraseKey: 'colchão' },
  { kw: ['cama box casal', 'cama box solteiro', 'cama box'],                          phraseKey: 'colchão' },
  { kw: ['travesseiro de espuma', 'travesseiro de penas', 'travesseiro'],             phraseKey: 'colchão' },
  { kw: ['jogo de cama casal', 'jogo de cama solteiro', 'jogo de cama'],              phraseKey: 'jogo de cama' },
  { kw: ['edredom', 'cobertor', 'manta'],                                             phraseKey: 'jogo de cama' },
  { kw: ['lâmpada led', 'lâmpada inteligente', 'lâmpada', 'lampada'],                phraseKey: 'lâmpada' },
  { kw: ['fita led', 'luminária led', 'luminária'],                                   phraseKey: 'lâmpada' },
  { kw: ['espelho decorativo', 'espelho de banheiro', 'espelho'],                     phraseKey: 'espelho' },
  { kw: ['tapete sala', 'tapete quarto', 'tapete'],                                   phraseKey: 'tapete' },
  { kw: ['prateleira', 'nicho', 'rack para tv', 'painel tv', 'rack'],                phraseKey: 'sofá' },

  // ─── Câmera / Drones (mais específico primeiro) ───────────────────────────
  { kw: ['câmera mirrorless', 'câmera dslr', 'câmera fotográfica'],                   phraseKey: 'câmera' },
  { kw: ['câmera de ação', 'câmera esportiva', 'gopro'],                              phraseKey: 'câmera' },
  { kw: ['câmera de segurança', 'câmera ip', 'câmera inteligente', 'câmera 360'],     phraseKey: 'câmera de segurança' },
  { kw: ['drone profissional', 'drone com câmera', 'drone'],                          phraseKey: 'drone' },
  { kw: ['telescópio refrator', 'telescópio refletor', 'telescópio astronômico', 'telescópio', 'telescopio'], phraseKey: 'telescópio' },
  { kw: ['binóculo 10x', 'binóculo 8x', 'binóculo profissional', 'binóculo náutico', 'binóculo', 'binoculo'], phraseKey: 'binóculo' },

  // ─── Esporte / Saúde (mais específico primeiro) ───────────────────────────
  { kw: ['bicicleta spinning', 'bike spinning', 'bicicleta indoor', 'bike indoor', 'bicicleta para exercícios', 'bike para exercícios'], phraseKey: 'bicicleta spinning' },
  { kw: ['bicicleta ergométrica', 'bike ergométrica'],                                phraseKey: 'bicicleta spinning' },
  { kw: ['elíptico', 'transport elíptico', 'ergométrico elíptico'],                   phraseKey: 'elíptico' },
  { kw: ['bicicleta elétrica', 'bike elétrica', 'e-bike'],                            phraseKey: 'bicicleta' },
  { kw: ['bicicleta de mountain bike', 'bicicleta speed', 'bicicleta'],               phraseKey: 'bicicleta' },
  { kw: ['esteira ergométrica', 'esteira elétrica', 'esteira'],                       phraseKey: 'esteira' },
  { kw: ['patinete elétrico', 'scooter elétrica', 'patinete'],                        phraseKey: 'patinete elétrico' },
  { kw: ['barra olímpica', 'barra de supino', 'barra de musculação'],                 phraseKey: 'barra de supino' },
  { kw: ['anilha olímpica', 'anilha de ferro', 'anilha borracha', 'anilha'],         phraseKey: 'anilha' },
  { kw: ['halter ajustável', 'halter de ferro', 'halter', 'halteres'],               phraseKey: 'halter' },
  { kw: ['kettlebell'],                                                                phraseKey: 'kettlebell' },
  { kw: ['luva de boxe', 'saco de boxe', 'protetor bucal'],                           phraseKey: 'esteira' },
  { kw: ['balança digital', 'balança inteligente'],                                   phraseKey: 'esteira' },
  { kw: ['massageador elétrico', 'massageador de pescoço', 'massageador'],            phraseKey: 'massageador' },

  // ─── Doces / Confeitaria (mais específico primeiro) ─────────────────────
  { kw: ['kit chocolate', 'caixa de chocolate', 'cesta de chocolate', 'box chocolate', 'presente de chocolate'], phraseKey: 'kit chocolate' },
  { kw: ['nutella', 'creme de avelã', 'creme de avela', 'ferrero nutella'],           phraseKey: 'nutella' },
  { kw: ['barra de amendoim', 'paçoca', 'pacoca', 'doce de amendoim', 'amendoim coberto', 'amendoim caramelizado'], phraseKey: 'barra de amendoim' },
  { kw: ['barra de chocolate', 'tablete de chocolate', 'chocolate ao leite', 'chocolate amargo', 'chocolate branco', 'chocolate meio amargo', 'kit kat', 'snickers', 'twix', 'ferrero rocher', 'Ferrero', 'bombom', 'trufa', 'chocolate recheado', 'chocolate importado'], phraseKey: 'chocolate' },
  { kw: ['bala de goma', 'bala mastigável', 'bala de gelatina', 'bala de fruta', 'balas', 'bala', 'gummy', 'gummies', 'marshmallow', 'algodão doce', 'pirulito', 'drops'], phraseKey: 'doce' },
  { kw: ['caramelo', 'toffee', 'wafer', 'biscoito recheado', 'biscoito doce', 'cookie', 'cookies'], phraseKey: 'doce' },
  { kw: ['doce caseiro', 'brigadeiro', 'beijinho', 'cajuzinho', 'doce de leite', 'maria mole', 'cocada', 'quindim'], phraseKey: 'doce' },
  { kw: ['doce', 'candy', 'guloseima', 'sobremesa'],                                  phraseKey: 'doce' },

  // ─── Suplementos / Alimentação Fitness ───────────────────────────────────
  { kw: ['barra de creatina', 'creatina em barra'],                                   phraseKey: 'barra de proteína' },
  { kw: ['barra de proteína', 'barra proteica', 'protein bar'],                       phraseKey: 'barra de proteína' },
  { kw: ['barra de cereal', 'barra cereal', 'granola bar', 'snack barra'],            phraseKey: 'barra de cereal' },
  { kw: ['paçoca', 'pacoca', 'barra de amendoim', 'barra amendoim', 'amendoim doce'], phraseKey: 'paçoca' },
  { kw: ['bala de goma', 'bala de gelatina', 'bala mastigável', 'goma de mascar', 'chiclete', 'pirulito'], phraseKey: 'bala' },
  { kw: ['creatina monohidratada', 'creatine', 'creatina'],                           phraseKey: 'creatina' },

  // ─── Roupas de Academia / Fitness ────────────────────────────────────────
  { kw: ['conjunto fitness', 'conjunto de academia', 'kit academia', 'conjunto treino'], phraseKey: 'roupa de academia' },
  { kw: ['short de academia', 'short fitness', 'bermuda de treino', 'bermuda academia'], phraseKey: 'roupa de academia' },
  { kw: ['camiseta fitness', 'camiseta dry fit', 'camiseta de treino', 'regata fitness', 'regata de treino', 'regata academia'], phraseKey: 'roupa de academia' },
  { kw: ['top fitness', 'top de academia', 'top esportivo'],                           phraseKey: 'roupa de academia' },
  { kw: ['calça de treino', 'calça fitness', 'calça academia', 'calça de academia'],  phraseKey: 'roupa de academia' },
  { kw: ['roupa de academia', 'roupa fitness', 'roupa de treino', 'roupas fitness'],   phraseKey: 'roupa de academia' },

  // ─── Conectividade / Acessórios tech (mais específico primeiro) ──────────
  { kw: ['roteador wi-fi 6', 'roteador mesh', 'roteador', 'repetidor wifi'],          phraseKey: 'roteador' },
  { kw: ['nobreak', 'estabilizador de voltagem', 'estabilizador'],                    phraseKey: 'nobreak' },
  { kw: ['power bank 20000mah', 'power bank 10000mah', 'power bank turbo', 'power bank', 'carregador portátil power bank', 'carregador portatil power bank'], phraseKey: 'power bank' },
  { kw: ['carregador portátil', 'carregador portatil', 'carregador universal', 'carregador turbo', 'carregador rápido', 'carregador de parede', 'carregador usb'], phraseKey: 'carregador portátil' },
  { kw: ['carregador sem fio', 'carregador wireless', 'carregador qi'],               phraseKey: 'carregador sem fio' },
  { kw: ['tela de projeção elétrica', 'tela de projeção retrátil', 'tela elétrica projetor', 'tela para projetor', 'tela de projeção', 'tela projeção'], phraseKey: 'tela de projeção' },
  { kw: ['transmissor hdmi sem fio', 'transmissor receptor hdmi', 'hdmi wireless', 'hdmi sem fio', 'transmissor wireless hdmi', 'receptor hdmi wireless', 'espelhar tv sem fio'], phraseKey: 'transmissor hdmi' },
  { kw: ['cabo hdmi 4k', 'cabo hdmi', 'cabo usb-c', 'cabo usb'],                      phraseKey: 'cabo hdmi' },
  { kw: ['chromecast', 'fire tv stick', 'fire stick', 'streaming stick'],             phraseKey: 'chromecast' },
  { kw: ['assistente virtual', 'caixa inteligente', 'alto-falante inteligente', 'speaker inteligente', 'echo dot', 'echo show', 'echo plus', 'alexa'], phraseKey: 'assistente virtual' },

  // ─── NICHO: LIVROS — subtipos do mais específico para o mais genérico ─────
  // NOTA: Muitos títulos de livros/mangás NÃO contêm a palavra "livro".
  //       Por isso usamos: títulos famosos, nomes de autores, editoras e
  //       indicadores físicos como "capa mole" / "capa dura".

  // Mangá — títulos famosos + editora JBC + formatos comuns
  { kw: [
      'mangá', 'manga', 'anime book', 'volume mangá',
      // Editoras brasileiras de mangá
      'editora jbc', 'jbc capa', 'panini manga',
      // Títulos famosos de mangá (detectar mesmo sem "mangá" no título)
      'death note', 'naruto shippuden', 'one piece', 'dragon ball',
      'bleach', 'attack on titan', 'shingeki no kyojin',
      'demon slayer', 'kimetsu no yaiba',
      'my hero academia', 'boku no hero academia',
      'fullmetal alchemist', 'sword art online',
      'tokyo ghoul', 'hunter x hunter',
      'fairy tail', 'jujutsu kaisen',
      'chainsaw man', 'spy x family',
      'vinland saga', 'berserk',
      'one punch man', 'mob psycho',
      'black clover', 'seven deadly sins',
      'ao no exorcist', 'blue exorcist',
      'neon genesis evangelion', 'cowboy bebop',
      'sailor moon', 'dragon ball z',
      'dbz', 'boruto', 'akira',
      // Formatos de mangá
      'black edition manga', 'kanzenban', 'wide edition',
    ],                                                                                 phraseKey: 'mangá' },

  // Livro de terror / horror
  { kw: ['livro de terror', 'livro de horror', 'stephen king', 'dean koontz', 'clive barker', 'horror literário', 'it a coisa', 'o iluminado', 'o hobbit'], phraseKey: 'livro de terror' },

  // Livro infantil (mais específico antes de "livro" genérico)
  { kw: ['livro infantil', 'livro para criança', 'livro ilustrado', 'livro de colorir', 'livro de historinhas', 'literatura infantil', 'turma da mônica', 'pequeno príncipe'], phraseKey: 'livro infantil' },

  // Quadrinhos / HQ — títulos famosos + formatos + editoras ocidentais
  { kw: [
      'hq', 'história em quadrinhos', 'histórias em quadrinhos',
      'graphic novel', 'dc comics', 'marvel comics',
      'batman', 'superman', 'homem-aranha', 'spider-man',
      'vingadores', 'avengers', 'x-men', 'liga da justiça',
      'flash', 'aquaman', 'pantera negra',
      'quadrinhos', 'gibi', 'comics',
    ],                                                                                 phraseKey: 'quadrinhos' },

  // Romance literário
  { kw: ['romance literário', 'romance histórico', 'livro de romance', 'chick lit', 'new adult', 'literatura romântica', 'nicholas sparks', 'colleen hoover', 'it ends with us'], phraseKey: 'romance' },

  // Autoajuda
  { kw: ['autoajuda', 'auto-ajuda', 'livro de autoajuda', 'mentalidade', 'mindset', 'hábitos atômicos', 'poder do hábito', 'pense e enriqueça', 'homem mais rico da babilônia', 'os segredos da mente milionária'], phraseKey: 'autoajuda' },

  // Desenvolvimento pessoal
  { kw: ['desenvolvimento pessoal', 'crescimento pessoal', 'liderança', 'inteligência emocional', 'produtividade', 'foco', 'disciplina', 'gestão de tempo'], phraseKey: 'desenvolvimento pessoal' },

  // Negócios / Empreendedorismo
  { kw: ['livro de negócios', 'empreendedorismo', 'marketing', 'vendas', 'gestão', 'administração', 'startup', 'finanças pessoais', 'investimentos', 'pai rico', 'o jeito warren buffett'], phraseKey: 'negócios' },

  // Ficção científica
  { kw: ['ficção científica', 'ficcao cientifica', 'sci-fi', 'scifi', 'distopia', 'cyberpunk', 'space opera', 'duna', 'fundação', 'ender', 'asimov'], phraseKey: 'ficção científica' },

  // Fantasia
  { kw: ['fantasia épica', 'alta fantasia', 'livro de fantasia', 'dragões', 'elfos', 'tolkien', 'george r.r. martin', 'harry potter', 'nome do vento', 'wheel of time', 'o senhor dos anéis', 'percy jackson'], phraseKey: 'fantasia' },

  // Thriller / Suspense
  { kw: ['thriller', 'suspense literário', 'policial', 'detetive', 'crime literário', 'agatha christie', 'gillian flynn', 'john grisham', 'lee child', 'dan brown', 'código da vinci'], phraseKey: 'thriller' },

  // Biografia / Autobiografia
  { kw: ['biografia', 'autobiografia', 'memórias', 'memorias', 'vida e obra', 'a história de', 'elon musk', 'steve jobs', 'michelle obama', 'relato autobiográfico'], phraseKey: 'biografia' },

  // Culinária / Gastronomia
  { kw: ['livro de receitas', 'livro de culinária', 'gastronomia', 'culinária brasileira', 'confeitaria', 'padaria artesanal', 'chef', 'receitas'], phraseKey: 'culinária' },

  // Livro de história
  { kw: ['livro de história', 'história do brasil', 'história mundial', 'história geral', 'segunda guerra', 'história política', 'historiografia'], phraseKey: 'livro de história' },

  // Livro genérico — palavra "livro" OU indicadores físicos de livro / editoras conhecidas
  { kw: [
      'livro', 'literatura', 'leitura', 'obra literária',
      // Indicadores físicos de livro (aparecem em títulos sem a palavra "livro")
      'capa mole', 'capa dura', 'brochura',
      // Editoras brasileiras conhecidas (livros)
      'editora rocco', 'editora intrínseca', 'editora sextante',
      'editora planeta', 'companhia das letras', 'editora record',
      'editora objetiva', 'editora globo livros', 'editora suma',
      'editora arqueiro', 'editora verus', 'editora novo conceito',
      // Indicadores comuns de publicação em português
      'em português', 'edição brasileira', 'tradução para o português',
    ],                                                                                 phraseKey: 'livro' },
];

/**
 * Detecta o tipo de produto a partir do título (Camada 1).
 * Retorna o phraseKey e o brandCat (opcional) do primeiro detector que bater.
 */
/**
 * Verifica se um caractere é separador de palavra (espaço, pontuação, início/fim).
 * Usado para word-boundary manual com palavras acentuadas (ex: "boné", "tênis").
 * O \b nativo do JS não reconhece caracteres Unicode como é, ê, ã, ç.
 */
function isWordBoundaryChar(ch: string | undefined): boolean {
  if (ch === undefined) return true; // início ou fim da string
  return /[\s\-_.,;:!?/\\()\[\]{}"'@#$%&*+=|<>~`^]/.test(ch);
}

function matchesKeyword(titleLower: string, kw: string): boolean {
  if (kw.includes(' ')) {
    // Multi-palavra: substring simples é suficiente
    return titleLower.includes(kw);
  }

  // Palavra simples — verificar boundary manualmente para suportar acentos
  const idx = titleLower.indexOf(kw);
  if (idx === -1) return false;

  const charBefore = idx > 0 ? titleLower[idx - 1] : undefined;
  const charAfter  = idx + kw.length < titleLower.length ? titleLower[idx + kw.length] : undefined;

  return isWordBoundaryChar(charBefore) && isWordBoundaryChar(charAfter);
}

function detectProductType(titleLower: string): { phraseKey: string; brandCat?: string } | null {
  for (const det of PRODUCT_TYPE_DETECTORS) {
    for (const kw of det.kw) {
      if (matchesKeyword(titleLower, kw)) {
        return { phraseKey: det.phraseKey, brandCat: det.brandCat };
      }
    }
  }
  return null;
}

/**
 * Detecta a primeira marca conhecida (dentro de uma categoria de marcas) no título (Camada 2).
 * Retorna a chave exata da marca em PRODUCT_SPECIFIC_PHRASES.
 */
function detectBrandInTitle(titleLower: string, brandCatKey: string): string | null {
  for (const brandKey of (MERGED_POOL_KEYS[brandCatKey] ?? [])) {
    if (matchesKeyword(titleLower, brandKey)) return brandKey;
  }
  return null;
}

function getMergedCategoryKey(title: string): string | null {
  const t = title.toLowerCase();
  const order = ['cozinha', 'tenis', 'roupas', 'ferramentas', 'chinelo'];
  for (const cat of order) {
    for (const k of (MERGED_POOL_KEYS[cat] ?? [])) {
      if (matchesKeyword(t, k)) return cat;
    }
  }
  return null;
}

// ==================== FRASES DE VENDAS PARA X/TWITTER ====================
// Ganchos organizados em 3 categorias: urgência, surpresa e curiosidade
// Isso aumenta o alcance pois atinge perfis diferentes de leitores

// 1️⃣ URGÊNCIA — transmite pressa, sensação de perder a oportunidade
const X_HOOKS_URGENCIA = [
  '🔥 ALERTA DE PROMOÇÃO',
  '🔥 ALERTA DE DESCONTO',
  '🔥 ALERTA DE OFERTA',
  '🔥 PROMOÇÃO CHEGANDO',
  '🔥 PROMOÇÃO QUENTE',
  '🔥 PROMOÇÃO FORTE',
  '🔥 DESCONTO ATIVO',
  '🔥 OFERTA DO DIA',
  '🔥 OFERTA QUENTE',
  '🔥 OFERTA ESPECIAL',
  '⚡ PROMOÇÃO RELÂMPAGO',
  '⚡ PROMOÇÃO RÁPIDA',
  '⚡ PROMOÇÃO LIMITADA',
  '⚡ PROMOÇÃO ATIVA',
  '⚡ PROMOÇÃO DO MOMENTO',
  '⚡ PROMOÇÃO TEMPORÁRIA',
  '⚡ PROMOÇÃO EM ANDAMENTO',
  '⚡ PROMOÇÃO LIBERADA',
  '⚡ PROMOÇÃO HOJE',
  '⚡ PROMOÇÃO ONLINE',
  '📢 ATENÇÃO PARA ESSA OFERTA',
  '📢 ATENÇÃO PARA ESSE PREÇO',
  '📢 ATENÇÃO PROMOÇÃO',
  '📢 ATENÇÃO DESCONTO',
  '📢 ATENÇÃO PREÇO BAIXO',
  '📢 ATENÇÃO PROMOÇÃO ATIVA',
  '📢 ATENÇÃO PREÇO REDUZIDO',
  '📢 ATENÇÃO OFERTA',
  '📢 ATENÇÃO DESCONTO HOJE',
  '📢 ATENÇÃO OPORTUNIDADE',
];

// 2️⃣ SURPRESA — gera impacto, estimula clique por choque
const X_HOOKS_SURPRESA = [
  '😱 OFERTA INSANA',
  '😱 OFERTA ABSURDA',
  '😱 DESCONTO LOUCO',
  '😱 DESCONTO GIGANTE',
  '😱 DESCONTO PESADO',
  '😱 OFERTA IMPERDÍVEL',
  '😱 PREÇO SURPREENDENTE',
  '😱 DESCONTO FORTE',
  '😱 PREÇO MALUCO',
  '😱 OFERTA INACREDITÁVEL',
  '⚠️ PREÇO DESPENCOU',
  '⚠️ PREÇO CAIU',
  '⚠️ PREÇO BAIXOU',
  '⚠️ PREÇO DERRETEU',
  '⚠️ PREÇO REDUZIDO',
  '⚠️ PREÇO EM QUEDA',
  '⚠️ PREÇO ATUALIZADO',
  '⚠️ PREÇO CAIU HOJE',
  '⚠️ PREÇO REBAIXADO',
  '⚠️ PREÇO AJUSTADO',
  '💰 DESCONTO PESADO',
  '💰 DESCONTO ATIVO',
  '💰 DESCONTO LIBERADO',
  '💰 DESCONTO FORTE',
  '💰 DESCONTO ESPECIAL',
  '💰 DESCONTO DO DIA',
  '💰 DESCONTO IMPERDÍVEL',
  '💰 SUPER DESCONTO',
  '💰 ECONOMIA REAL',
  '💰 DESCONTO GRANDE',
];

// 3️⃣ CURIOSIDADE — instiga o clique para saber o preço/produto
const X_HOOKS_CURIOSIDADE = [
  '🔥 PREÇO HISTÓRICO',
  '🔥 MENOR PREÇO',
  '🔥 PREÇO MÍNIMO',
  '🔥 PREÇO BAIXO',
  '🔥 PREÇO DIFERENCIADO',
  '🔥 PREÇO ESPECIAL',
  '🔥 PREÇO PROMOCIONAL',
  '🔥 PREÇO REDUZIDO',
  '🔥 PREÇO BAIXO HOJE',
  '🔥 PREÇO AJUSTADO',
  '🛒 OPORTUNIDADE',
  '🛒 OPORTUNIDADE HOJE',
  '🛒 OPORTUNIDADE DE COMPRA',
  '🛒 BOA OFERTA',
  '🛒 VALE A PENA',
  '🛒 OFERTA INTERESSANTE',
  '🛒 ACHADO DO DIA',
  '🛒 PREÇO BOM',
  '🛒 PREÇO LEGAL',
  '🛒 COMPRA INTELIGENTE',
];

// Pool completo (usado como fallback)
const X_HOOKS_ALL = [
  ...X_HOOKS_URGENCIA,
  ...X_HOOKS_SURPRESA,
  ...X_HOOKS_CURIOSIDADE,
];

// ── Frases complementares por categoria ────────────────────────────────────
// Aparecem logo abaixo do gancho, sem linha em branco entre eles.
// Reforçam a emoção do gancho e estimulam o clique.

// Complementares de URGÊNCIA — reforçam pressa/limite
const X_SUBTITLES_URGENCIA = [
  'Corre antes que acabe!',
  'Aproveite enquanto dura!',
  'Pode acabar a qualquer momento!',
  'Estoque limitado, não perca!',
  'Hoje pode ser o último dia!',
  'Não vai durar muito não!',
  'Por tempo limitado!',
  'Já estão acabando as unidades!',
  'Essa oferta não espera!',
  'Quem chega primeiro leva!',
  'Não deixa pra amanhã!',
  'Enquanto tiver em estoque!',
  'É agora ou nunca!',
  'Não perca essa chance!',
  'Oferta por tempo limitado!',
];

// Complementares de SURPRESA — reforçam o choque/impacto
const X_SUBTITLES_SURPRESA = [
  'Esse preço não faz o menor sentido.',
  'Quem viu e não pegou vai se arrepender.',
  'Desconto desse nível aparece uma vez no ano.',
  'Olha o que chegou sem avisar...',
  'Nunca achei assim tão barato.',
  'Tô passando o link antes de esgotar.',
  'Não consegui ignorar quando vi o preço.',
  'Isso é promoção ou erro de sistema?',
  'Parece errado, mas não é — é real.',
  'Mandei pro grupo antes de postar aqui.',
  'Preço que faz a gente pesquisar se tá certo.',
  'Que oferta absurdamente boa.',
  'Difícil passar reto por esse desconto.',
  'Esse não dura nem até amanhã.',
  'Salvei primeiro, postei depois.',
];

// Complementares de CURIOSIDADE — instigam a conferir
const X_SUBTITLES_CURIOSIDADE = [
  'Você não vai acreditar no preço...',
  'Olha só o que achei pra você',
  'Dá uma olhada nisso...',
  'Um achado que você precisa ver',
  'Confira antes que suma do ar',
  'O preço vai te surpreender',
  'Vai querer saber quanto ficou?',
  'Olha o que apareceu hoje...',
  'Esse é aquele produto que você queria',
  'Acho que esse é pra você',
  'Achei e já vim te avisar',
  'Viu que oferta boa?',
  'Esse eu não consegui ignorar',
  'Precisei te mostrar isso',
  'Que achado é esse...',
];

// CTAs variados — impulsivos, com senso de ação e urgência
const X_CTAS = [
  '👉 aproveitar agora',
  '👉 ver desconto agora',
  '👉 aproveitar desconto',
  '👉 conferir oferta',
  '👉 aproveitar promoção',
  '👉 ver promoção',
  '👉 garantir o meu agora',
  '👉 pegar essa promoção',
  '👉 aproveitar enquanto tem',
  '👉 quero essa promoção',
  '👉 não perder essa',
  '👉 correr pra aproveitar',
];

// Templates de preço em MAIÚSCULAS
const PRICE_TEMPLATES = [
  (old: string, now: string) => `DE ${old} POR ${now}`,
  (old: string, now: string) => `ERA ${old}, AGORA TÁ ${now}`,
  (old: string, now: string) => `CAIU DE ${old} PRA ${now}`,
  (old: string, now: string) => `SAIU DE ${old} PRA ${now}`,
];

const PRICE_TEMPLATES_NO_OLD = [
  (now: string) => `POR ${now}`,
  (now: string) => `TÁ ${now}`,
  (now: string) => `SAINDO POR ${now}`,
];

// ==================== DAILY PHRASE TRACKER ====================
// Evita repetição de frases para o mesmo tipo de produto no mesmo dia.
// Reset automático a meia-noite (ou quando todas as frases do tipo forem esgotadas).

const _dailyPhraseUsage = new Map<string, Set<number>>();

// Cache da última frase escolhida por chave no dia.
// Permite que X reutilize a mesma frase já sorteada para Telegram
// sem avançar o tracker duas vezes para o mesmo post.
const _lastPickedToday = new Map<string, string>();

function _getTodayStr(): string {
  return new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
}

function _cleanOldEntries(): void {
  const today = _getTodayStr();
  for (const key of _dailyPhraseUsage.keys()) {
    if (!key.startsWith(today + ':')) {
      _dailyPhraseUsage.delete(key);
    }
  }
}

function _usedSet(productKey: string): Set<number> {
  const key = `${_getTodayStr()}:${productKey}`;
  if (!_dailyPhraseUsage.has(key)) {
    _dailyPhraseUsage.set(key, new Set());
  }
  return _dailyPhraseUsage.get(key)!;
}

/**
 * Sorteia uma frase ainda não usada hoje para o tipo de produto.
 * Se todas já foram usadas, reseta o histórico do dia para aquele tipo e sorteia novamente.
 */
function pickUnusedPhrase<T>(arr: T[], productKey: string): T {
  _cleanOldEntries();
  const used = _usedSet(productKey);

  const available = arr
    .map((item, idx) => ({ item, idx }))
    .filter(({ idx }) => !used.has(idx));

  let chosen: { item: T; idx: number };

  if (available.length === 0) {
    // Todas usadas hoje → reset e começa novo ciclo
    used.clear();
    const idx = Math.floor(Math.random() * arr.length);
    used.add(idx);
    chosen = { item: arr[idx], idx };
  } else {
    chosen = available[Math.floor(Math.random() * available.length)];
    used.add(chosen.idx);
  }

  // Salva no cache para que outros canais do mesmo post possam reutilizar
  const cacheKey = `${_getTodayStr()}:${productKey}:last`;
  _lastPickedToday.set(cacheKey, String(chosen.item));

  return chosen.item;
}

// Retorna a última frase sorteada para esta chave hoje, sem avançar o tracker.
// Usado pelo X para reutilizar a mesma frase já escolhida para Telegram.
function peekLastPhrase(productKey: string): string | null {
  const cacheKey = `${_getTodayStr()}:${productKey}:last`;
  return _lastPickedToday.get(cacheKey) ?? null;
}

// ==================== HELPERS ====================

function formatPrice(value: number): string {
  // Se o valor tem centavos, sempre mostrar 2 casas (ex: R$ 67,90 e não R$ 67,9)
  // Se o valor é inteiro, não mostrar casas (ex: R$ 97 e não R$ 97,00)
  const hasDecimals = value % 1 !== 0;
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function pickRandom<T>(arr: T[], seed?: number): T {
  const idx = seed !== undefined 
    ? Math.abs(seed) % arr.length 
    : Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function getShortTitle(title: string, maxLength: number = 50): string {
  if (title.length <= maxLength) return title;
  
  const words = title.split(' ');
  let result = '';
  
  for (const word of words) {
    if ((result + ' ' + word).length > maxLength - 3) break;
    result = result ? result + ' ' + word : word;
  }
  
  return result + '...';
}

function getCategoryKey(category?: string | null, title?: string): string {
  const text = ((category || '') + ' ' + (title || '')).toLowerCase();
  
  if (text.match(/celular|smartphone|iphone|samsung|galaxy|xiaomi/)) return 'eletronicos';
  if (text.match(/notebook|laptop|computador|pc|macbook/)) return 'eletronicos';
  if (text.match(/tv|televisor|smart tv|oled|qled/)) return 'eletronicos';
  if (text.match(/fone|headphone|earbuds|airpod/)) return 'eletronicos';
  if (text.match(/monitor/)) return 'eletronicos';
  if (text.match(/tênis|tenis|nike|adidas|puma|new balance|asics|vans|converse|all star|under armour|fila|mizuno|olimpikus|kappa|ralph lauren|lacoste|tommy hilfiger|calvin klein|levi|insaider|roupa|camisa|calça/)) return 'moda';
  if (text.match(/bosch|makita|dewalt|milwaukee|hilti|stanley|black.?decker|irwin|craftsman|ridgid|metabo|ryobi|gedore|belzer|bahco|knipex|tramontina|vonder|worker|gamma|sparta|snap.?on|festool|ferramenta|furadeira|parafusadeira|esmerilhadeira|martelete|chave inglesa|alicate/)) return 'ferramentas';
  if (text.match(/brinox|rochedo|panelux|multiflon|nigro|sanremo|plasútil|plasutil|panela|utensílio|cozinha|frigideira|antiaderente/)) return 'cozinha';
  if (text.match(/air ?fryer|geladeira|microondas|fogão|cozinha|panela/)) return 'casa';
  if (text.match(/playstation|xbox|nintendo|ps5|switch|jogo|game/)) return 'games';
  if (text.match(/perfume|colônia|colonia|malbec|uomini|boticário|boticario/)) return 'perfumes';
  
  return 'geral';
}

// Detecta produtos específicos para usar frases engraçadas.
// Usa o DailyPhraseTracker para garantir que o mesmo tipo de produto
// não repita a mesma frase em posts diferentes no mesmo dia.
// Retorna a frase de produto sem avançar o tracker —
// reutiliza o que já foi sorteado para este título hoje (ex: Telegram → X).
// Retorna a última frase sorteada para este título hoje (sem avançar o tracker).
// Usa o mesmo mapeamento de getProductSpecificPhrase.
function peekProductSpecificPhrase(title: string, phraseMode?: 'generic' | 'brand'): string | null {
  const titleLower = title.toLowerCase();

  // 1. Tipo de produto → mesma chave de pool usada no pick
  const productType = detectProductType(titleLower);
  if (productType) {
    const poolId = PRODUCT_TYPE_POOL_MAP[productType.phraseKey] ?? productType.phraseKey;
    const isMergedPool = poolId.startsWith('pool:');
    const mergedCatKey = isMergedPool ? poolId.slice(5) : null;

    if (phraseMode === 'brand' && mergedCatKey) {
      const brand = detectBrandInTitle(titleLower, mergedCatKey);
      if (brand) {
        const last = peekLastPhrase(brand);
        if (last) return last;
      }
      const last = peekLastPhrase(productType.phraseKey);
      if (last) return last;
    } else if (phraseMode === 'generic' && isMergedPool) {
      const last = peekLastPhrase(productType.phraseKey);
      if (last) return last;
    } else {
      const last = peekLastPhrase(poolId);
      if (last) return last;
    }
  }

  // 2. Fallback: marca detectada → pool merged
  const mergedCat = getMergedCategoryKey(titleLower);
  if (mergedCat) {
    const last = peekLastPhrase(`pool:${mergedCat}`);
    if (last) return last;
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCT_TYPE_POOL_MAP
// Mapeia a chave detectada em detectProductType → qual pool usar.
//
// Regra simples: título → tipo → pool → sortear frase.
// Cada pool tem frases de marca + genéricas misturadas.
// ══════════════════════════════════════════════════════════════════════════════
const PRODUCT_TYPE_POOL_MAP: Record<string, string> = {
  // Calçados → pool unificado (marca+genérico)
  'crocs':    'crocs',
  'tênis':    'pool:tenis',
  'slide':    'slide',
  'chinelo':  'pool:chinelo',
  // Vestuário — subtipos específicos (mais específico primeiro)
  'insider':        'insider',
  'cueca':          'cueca',
  'oakley':         'oakley',
  'óculos oakley':  'óculos oakley',
  'plus size':      'plus size',
  'camisa de time': 'camisa de time',
  'camisa polo':    'camisa polo',
  'camisa social':  'camisa social',
  'regata':         'regata',
  'camisa':         'pool:roupas',
  'polo':           'polo',
  'calça':          'pool:roupas',
  'roupa':          'pool:roupas',
  'boné':           'boné',
  // Óculos — subtypes
  'óculos de sol':  'óculos de sol',
  'óculos de grau': 'óculos de grau',
  'óculos':         'óculos',
  // Bolsas e mochilas
  'bolsa':              'bolsa',
  'mochila':            'mochila',
  'papel a4':           'papel a4',
  'mochila escolar':    'mochila escolar',
  'mochila de viagem':  'mochila de viagem',
  'mochila casual':     'mochila casual',
  'mochila maternidade': 'mochila maternidade',
  // Cozinha → pool 'cozinha' (marca+genérico)
  'panela':   'pool:cozinha',
  // Ferramentas → pool 'ferramentas' (marca+genérico)
  'ferramenta': 'pool:ferramentas',

  // Eletrônicos — PRODUCT_SPECIFIC_PHRASES individuais
  'smart tv':   'smart tv',
  'tv':         'tv',
  'notebook':   'notebook',
  'celular':    'celular',
  'smartwatch': 'smartwatch',
  'fone':       'fone',
  'adega climatizada': 'adega climatizada',
  'escova rotativa':   'escova rotativa',
  'geladeira':  'geladeira',
  'microondas': 'microondas',
  'air fryer':  'air fryer',
  'monitor':    'monitor gamer',
  'tablet':     'tablet',
  'iphone':     'iphone',
  'samsung':    'samsung',
  'xiaomi':     'xiaomi',
  'poco':       'poco',
  'soundbar':   'soundbar',
  'caixa de som': 'pool:caixa de som',
  'airpods':    'airpods',
  'suporte para monitor':  'suporte para monitor',
  'suporte gamer monitor': 'suporte gamer monitor',
  'suporte para tv':       'suporte para tv',
  'projetor smart': 'projetor smart',
  'projetor':   'projetor',
  'drone':       'drone',
  'telescópio':  'telescópio',
  'binóculo':    'binóculo',
  'câmera':     'câmera',
  'câmera de segurança': 'câmera de segurança',
  'ssd':        'ssd',
  'mouse':      'mouse',
  'teclado':    'teclado',
  'roteador':   'roteador',
  'nobreak':    'nobreak',
  'power bank':          'power bank',
  'carregador portátil': 'carregador portátil',
  'carregador sem fio':  'carregador sem fio',
  'carregador magnético': 'carregador magnético',
  'transmissor hdmi':   'transmissor hdmi',
  'tela de projeção':   'tela de projeção',
  'assistente virtual': 'assistente virtual',
  'chromecast': 'chromecast',
  'webcam':     'webcam',

  // ── Tech Criadores de Conteúdo ──────────────────────────────────────────
  'microfone usb':    'microfone usb',
  'microfone lapela': 'microfone lapela',
  'ring light':       'ring light',
  'tripé':            'tripé',
  'placa de captura': 'placa de captura',
  'stream deck':      'stream deck',
  'teleprompter':     'teleprompter',

  // ── AI Gadgets ───────────────────────────────────────────────────────────
  'gravador com ia':       'gravador com ia',
  'tradutor portátil':     'tradutor portátil',
  'caneta digitalizadora': 'caneta digitalizadora',
  'scanner portátil':      'scanner portátil',
  'óculos com ia':         'óculos com ia',

  // ── Gadgets Futuristas ───────────────────────────────────────────────────
  'teclado laser':      'teclado laser',
  'mouse vertical':     'mouse vertical',
  'mini projetor':      'mini projetor',
  'display holográfico': 'display holográfico',

  // ── Tech para Celular ────────────────────────────────────────────────────
  'power bank solar':   'power bank solar',
  'hub usb-c':          'hub usb-c',
  'dock station':       'dock station',
  'lentes para celular': 'lentes para celular',
  'gimbal':             'gimbal',

  // Eletrodomésticos
  'liquidificador': 'liquidificador',
  'sanduicheira':   'sanduicheira',
  'omeleteira':     'omeleteira',
  'cafeteira':      'cafeteira',
  'aspirador pó e água': 'aspirador pó e água',
  'aspirador':      'aspirador',
  'ventilador':     'ventilador',
  'ar condicionado': 'ar condicionado',
  'ferro de passar': 'ferro de passar',
  'secador':        'secador',
  'chapinha':       'chapinha',
  'fralda geriátrica': 'fralda geriátrica',
  'fralda':            'fralda',
  'gloss':              'gloss',
  'batom':              'batom',
  'depilador elétrico': 'depilador elétrico',
  'barbeador elétrico': 'barbeador elétrico',
  'máquina de lavar':   'máquina de lavar',
  'fogão de indução':   'fogão de indução',
  'fogão':              'fogão',
  'máquina de cortar cabelo': 'máquina de cortar cabelo',

  // Vestuário / Impermeáveis e Frio
  'capa de chuva':    'capa de chuva',
  'jaqueta masculina': 'jaqueta masculina',
  'jaqueta feminina':  'jaqueta feminina',
  'casaco':            'casaco',
  'jaqueta':           'jaqueta',
  'moletom':           'moletom',

  // Copos e Garrafas Térmicas / Bebidas
  'stanley térmica': 'stanley térmica',
  'garrafa térmica': 'garrafa térmica',
  'caneca':          'caneca',
  'copo':            'copo',
  'bebedouro':       'bebedouro',

  // Perfumaria — subtipos do nicho
  'perfume árabe':     'perfume árabe',
  'perfume importado': 'perfume importado',
  'kit de perfume':    'kit de perfume',
  'perfume feminino':  'perfume feminino',
  'perfume masculino': 'perfume masculino',
  'body splash':       'body splash',
  'colônia':           'colônia',
  'perfume':           'perfume',

  // Relógios / Joias
  'relógio masculino': 'relógio masculino',
  'relógio feminino':  'relógio feminino',
  'corrente masculina': 'corrente masculina',

  // ── Anime / Geek / Colecionáveis ────────────────────────────────────────
  'figura anime':   'figura anime',
  'funko pop':      'funko pop',
  'nendoroid':      'nendoroid',
  'camiseta anime': 'camiseta anime',

  // Games
  'ps5':            'ps5',
  'playstation':    'playstation',
  'xbox':           'xbox',
  'nintendo switch': 'nintendo switch',
  'dualsense':        'dualsense',
  'controle xbox':    'controle xbox',
  'controle nintendo': 'controle nintendo',
  'controle gamer':   'controle gamer',
  'videogame':      'videogame',

  // Cadeiras e Poltronas Gamer
  'cadeira gamer':  'pool:cadeira gamer',
  'poltrona gamer': 'poltrona gamer',

  // Móveis / Casa
  'guarda-roupa':  'guarda-roupa',
  'cômoda':        'cômoda',
  'escrivaninha':  'escrivaninha',
  'mesa de jantar': 'mesa de jantar',
  'sofá':          'sofá',
  'colchão':       'colchão',
  'lâmpada':       'lâmpada led',

  // Esporte / Academia
  'bicicleta spinning': 'bicicleta spinning',
  'elíptico':           'elíptico',
  'bicicleta':          'bicicleta',
  'esteira':            'esteira',
  'patinete elétrico':  'patinete elétrico',
  'anilha':             'anilha',
  'halter':             'halter',
  'kettlebell':         'kettlebell',
  'barra de supino':    'barra de supino',

  // Doces / Confeitaria
  'doce':              'doce',
  'chocolate':         'chocolate',
  'nutella':           'nutella',
  'barra de amendoim': 'barra de amendoim',
  'kit chocolate':     'kit chocolate',

  // Suplementos / Alimentação Fitness
  'creatina':          'creatina',
  'barra de proteína': 'barra de proteína',
  'barra de cereal':   'barra de cereal',
  'roupa de academia': 'roupa de academia',

  'paçoca':     'paçoca',
  'bala':       'bala',

  // Jogos de tabuleiro
  'war':              'war',
  'jogo estratégico': 'jogo estratégico',
  'jogo família':     'jogo família',
  'jogo de tabuleiro': 'jogo de tabuleiro',

  // ── NICHO: LIVROS — subtipos mapeados ──────────────────────────────────────
  'livro de terror':       'livro de terror',
  'livro infantil':        'livro infantil',
  'quadrinhos':            'quadrinhos',
  'romance':               'romance',
  'autoajuda':             'autoajuda',
  'desenvolvimento pessoal': 'desenvolvimento pessoal',
  'negócios':              'negócios',
  'ficção científica':     'ficção científica',
  'fantasia':              'fantasia',
  'thriller':              'thriller',
  'suspense':              'thriller',
  'biografia':             'biografia',
  'culinária':             'culinária',
  'livro de história':     'livro de história',
  'mangá':                 'mangá',
  'livro':                 'livro',
};

function getProductSpecificPhrase(title: string, phraseMode?: 'generic' | 'brand'): string | null {
  const titleLower = title.toLowerCase();

  function fromPool(poolId: string): string | null {
    if (poolId.startsWith('pool:')) {
      const cat = poolId.slice(5);
      const pool = PRODUCT_POOL[cat];
      return pool?.length ? pickUnusedPhrase(pool, `pool:${cat}`) : null;
    }
    const pool = PRODUCT_SPECIFIC_PHRASES[poolId];
    return pool?.length ? pickUnusedPhrase(pool, poolId) : null;
  }

  function fromGenericKey(genericKey: string): string | null {
    const pool = PRODUCT_SPECIFIC_PHRASES[genericKey];
    return pool?.length ? pickUnusedPhrase(pool, genericKey) : null;
  }

  function fromBrand(mergedCatKey: string): string | null {
    const brand = detectBrandInTitle(titleLower, mergedCatKey);
    if (!brand) return null;
    const pool = PRODUCT_SPECIFIC_PHRASES[brand];
    return pool?.length ? pickUnusedPhrase(pool, brand) : null;
  }

  // ── 1. Detectar tipo de produto pelo título ────────────────────────────────
  const productType = detectProductType(titleLower);
  if (productType) {
    const poolId = PRODUCT_TYPE_POOL_MAP[productType.phraseKey] ?? productType.phraseKey;
    const isMergedPool = poolId.startsWith('pool:');
    const mergedCatKey = isMergedPool ? poolId.slice(5) : null;

    if (phraseMode === 'brand' && mergedCatKey) {
      // Modo MARCA: detecta a marca → usa só as frases dessa marca.
      // Fallback: genéricas do tipo de produto.
      const branded = fromBrand(mergedCatKey);
      if (branded) return branded;
      return fromGenericKey(productType.phraseKey);
    }

    if (phraseMode === 'generic' && isMergedPool) {
      // Modo GENÉRICO: ignora marcas, usa só pool genérico do tipo.
      return fromGenericKey(productType.phraseKey);
    }

    // Modo padrão (undefined): pool unificado (marca + genérico misturados)
    const result = fromPool(poolId);
    if (result) return result;
  }

  // ── 2. Fallback: produto sem palavra-chave de tipo → detecta por marca ─────
  const mergedCat = getMergedCategoryKey(titleLower);
  if (mergedCat) {
    if (phraseMode === 'brand') {
      const branded = fromBrand(mergedCat);
      if (branded) return branded;
    }
    const result = fromPool(`pool:${mergedCat}`);
    if (result) return result;
  }

  // ── 3. Último recurso: varrer PRODUCT_SPECIFIC_PHRASES por keyword ──────────
  for (const [key, phrases] of Object.entries(PRODUCT_SPECIFIC_PHRASES)) {
    if (phrases.length > 0 && titleLower.includes(key)) {
      return pickUnusedPhrase(phrases, key);
    }
  }

  return null;
}

function generateSeed(input: CopyInputData): number {
  // Gera seed baseado no título para consistência
  let hash = 0;
  const str = input.title + input.price;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ==================== COPY GENERATION ====================

/**
 * Gera linha de preço formatada
 */
function generatePriceLine(input: CopyInputData, seed: number): string {
  // VALIDAÇÃO: Garantir que temos preço
  if (!input.price || input.price <= 0) {
    console.warn('[generatePriceLine] Preço inválido, usando fallback');
    return 'PREÇO NÃO DISPONÍVEL';
  }
  
  const priceNow = formatPrice(input.price);
  
  if (input.oldPrice && input.oldPrice > input.price) {
    const priceOld = formatPrice(input.oldPrice);
    const template = pickRandom(PRICE_TEMPLATES, seed);
    const result = template(priceOld, priceNow);
    // VALIDAÇÃO: Garantir que retornou algo
    if (result && result.trim().length > 0) {
      return result;
    }
  }
  
  const template = pickRandom(PRICE_TEMPLATES_NO_OLD, seed);
  const result = template(priceNow);
  // VALIDAÇÃO: Garantir que retornou algo
  if (result && result.trim().length > 0) {
    return result;
  }
  
  // Fallback absoluto
  return `POR ${priceNow}`;
}

/**
 * Gera abertura baseada na categoria e produto (com humor jovem).
 * Usa o DailyPhraseTracker para não repetir frases do mesmo tipo de produto no mesmo dia.
 * @param channelSeedOffset - Offset adicional para variar por canal (0, 1000, 2000)
 */
function generateOpening(input: CopyInputData, seed: number, channelSeedOffset: number = 0): string {
  // Primeiro, verificar se há frase específica do produto — com anti-repetição diária
  const productPhrase = getProductSpecificPhrase(input.title, input.phraseMode);
  if (productPhrase) {
    return productPhrase.toUpperCase();
  }

  // Sem frase específica: usar abertura por categoria (também sem repetição diária)
  const categoryKey = getCategoryKey(input.category, input.title);
  const combinedSeed = seed + channelSeedOffset;

  if (OPENINGS_BY_CATEGORY[categoryKey]) {
    // 80% chance de usar abertura específica da categoria
    if (combinedSeed % 10 < 8) {
      const phrase = pickUnusedPhrase(OPENINGS_BY_CATEGORY[categoryKey], `cat:${categoryKey}`);
      if (phrase && phrase.trim().length > 0) {
        return phrase.toUpperCase();
      }
    }
  }

  const phrase = pickUnusedPhrase(OPENINGS_ENGRAÇADOS, 'geral');
  if (phrase && phrase.trim().length > 0) {
    return phrase.toUpperCase();
  }

  return 'ACHADO NÃO É ROUBADO';
}

/**
 * Retorna emoji baseado no desconto e produto
 */
function getDiscountEmoji(discountPct: number, title: string): string {
  // 🔥 para descontos altos (20% ou mais) - sempre usar
  if (discountPct >= 20) {
    return '🔥';
  }
  // Para descontos menores, não usar emoji
  return '';
}

/**
 * Gera copy para Telegram (≤ 350 caracteres) - TUDO EM MAIÚSCULAS + EMOJIS
 */
function generateTelegramCopy(input: CopyInputData, seed: number): string {
  // VALIDAÇÃO: Garantir que temos dados mínimos
  if (!input.title || !input.price || !input.trackingUrl) {
    console.error('[generateTelegramCopy] Dados inválidos:', { 
      hasTitle: !!input.title, 
      hasPrice: !!input.price, 
      hasTrackingUrl: !!input.trackingUrl 
    });
    // Fallback mínimo no formato correto (link PRIMEIRO)
    const fallbackPrice = formatPrice(input.price || 0);
    const fallbackTitle = (input.title || 'PRODUTO').toUpperCase();
    const trackingUrl = (input.trackingUrl || '').toLowerCase(); // Link sempre em minúsculas
    
    // Link PRIMEIRO (garante preview do Telegram)
    let fallbackText = `${trackingUrl}\n\nACHADO NÃO É ROUBADO\nPOR ${fallbackPrice}`;
    if (input.discountPct && input.discountPct >= 20) {
      fallbackText += ` 🔥 (-${Math.round(input.discountPct)}% OFF)`;
    }
    fallbackText += `\n\n${fallbackTitle}`;
    return fallbackText.toUpperCase();
  }
  
  const opening = generateOpening(input, seed, 0); // Canal Telegram: offset 0
  const priceLine = generatePriceLine(input, seed + 1);
  const discountEmoji = getDiscountEmoji(input.discountPct, input.title);
  
  // LOG: Verificar o que foi gerado
  console.log('[generateTelegramCopy] Verificando conteúdo gerado:');
  console.log('  - Opening:', opening ? opening.substring(0, 50) : 'VAZIO');
  console.log('  - PriceLine:', priceLine ? priceLine.substring(0, 50) : 'VAZIO');
  
  // VALIDAÇÃO: Garantir que opening e priceLine não estão vazios
  if (!opening || opening.trim().length === 0) {
    console.warn('[generateTelegramCopy] Opening vazio, usando fallback');
    const fallbackOpening = pickRandom(OPENINGS_ENGRAÇADOS, seed);
    const finalOpening = fallbackOpening || 'ACHADO NÃO É ROUBADO';
    const finalPriceLine = priceLine || generatePriceLine(input, seed + 1);
    
    // Conteúdo PRIMEIRO, link DEPOIS - sempre em minúsculas
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    let text = `${finalOpening}\n`;
    
    if (input.discountPct > 0) {
      const discountText = `(-${Math.round(input.discountPct)}% OFF)`;
      if (input.discountPct >= 20 && discountEmoji) {
        text += `${finalPriceLine} ${discountEmoji} ${discountText}`;
      } else {
        text += `${finalPriceLine} ${discountText}`;
      }
    } else {
      text += finalPriceLine;
    }
    
    const shortTitle = getShortTitle(input.title, 50).toUpperCase();
    const textWithTitle = text + `\n\n${shortTitle}`;
    if (textWithTitle.length <= CHAR_LIMITS.TELEGRAM) {
      text = textWithTitle;
    }
    
    // ADICIONAR LINK NO FINAL
    text = text + `\n\n${normalizedUrl}`;
    
    return text.toUpperCase();
  }
  
  if (!priceLine || priceLine.trim().length === 0) {
    console.warn('[generateTelegramCopy] PriceLine vazio, gerando novamente');
    const finalPriceLine = generatePriceLine(input, seed + 1);
    
    // Link PRIMEIRO (garante preview do Telegram) - sempre em minúsculas
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    let text = `${normalizedUrl}\n\n${opening}\n`;
    
    if (input.discountPct > 0) {
      const discountText = `(-${Math.round(input.discountPct)}% OFF)`;
      if (input.discountPct >= 20 && discountEmoji) {
        text += `${finalPriceLine} ${discountEmoji} ${discountText}`;
      } else {
        text += `${finalPriceLine} ${discountText}`;
      }
    } else {
      text += finalPriceLine;
    }
    
    const shortTitle = getShortTitle(input.title, 50).toUpperCase();
    const textWithTitle = text + `\n\n${shortTitle}`;
    if (textWithTitle.length <= CHAR_LIMITS.TELEGRAM) {
      text = textWithTitle;
    }
    
    // ADICIONAR LINK NO FINAL
    text = text + `\n\n${normalizedUrl}`;
    
    return text.toUpperCase();
  }
  
  // Montar texto no formato que garante preview do Telegram:
  // MUDANÇA: Conteúdo PRIMEIRO, link DEPOIS (para texto aparecer antes do preview)
  // 1. Frase de abertura (com emoji se tiver)
  // 2. Linha de preço: "SAIU DE R$ X PRA R$ Y 🔥 (-X% OFF)"
  // 3. Título do produto
  // 4. Link (DEPOIS - Telegram ainda gera preview mesmo no final)
  
  // IMPORTANTE: Link sempre em minúsculas (URLs devem ser minúsculas)
  const normalizedUrl = input.trackingUrl.toLowerCase();
  
  // VALIDAÇÃO CRÍTICA: Garantir que opening e priceLine existem ANTES de construir
  const finalOpening = (opening && opening.trim().length > 0) ? opening : 'ACHADO NÃO É ROUBADO';
  const finalPriceLine = (priceLine && priceLine.trim().length > 0) ? priceLine : `POR ${formatPrice(input.price)}`;
  
  // LOG: Verificar valores antes de construir
  console.log('[generateTelegramCopy] Valores antes de construir texto:');
  console.log('  - finalOpening:', finalOpening);
  console.log('  - finalOpening tem emoji?', /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑/u.test(finalOpening));
  console.log('  - finalPriceLine:', finalPriceLine);
  console.log('  - discountPct:', input.discountPct);
  console.log('  - discountEmoji:', discountEmoji);
  
  // Construir texto COMPLETO de uma vez - CONTEÚDO PRIMEIRO, link DEPOIS
  // GARANTIR que o opening tem emoji (se a frase específica não tiver, adicionar)
  let openingWithEmoji = finalOpening;
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑|💎|⭐|💰|💵|🍎|🌟|💪|⚡/u.test(finalOpening);
  if (!hasEmoji) {
    // SEMPRE adicionar emoji na frase de abertura (mesmo sem desconto alto)
    // Se tiver desconto alto, usar 🔥, senão usar outro emoji
    if (input.discountPct >= 20) {
      openingWithEmoji = `${finalOpening} 🔥`;
    } else {
      openingWithEmoji = `${finalOpening} 🔥`; // Sempre usar 🔥 para destacar
    }
  }
  
  let text = `${openingWithEmoji}\n`;
  
  // Linha de preço com emoji ANTES do desconto (formato da imagem)
  if (input.discountPct > 0) {
    const discountText = `(-${Math.round(input.discountPct)}% OFF)`;
    // Adicionar 🔥 ANTES do desconto se >= 20%
    if (input.discountPct >= 20 && discountEmoji) {
      text += `${finalPriceLine} ${discountEmoji} ${discountText}`;
    } else {
      text += `${finalPriceLine} ${discountText}`;
    }
  } else {
    text += finalPriceLine;
  }
  
  // LOG: Verificar texto após adicionar preço
  console.log('[generateTelegramCopy] Texto após adicionar preço:', text.substring(0, 200));
  console.log('[generateTelegramCopy] Tamanho após preço:', text.length);
  
  // Adicionar título do produto (sempre, se couber)
  const shortTitle = getShortTitle(input.title, 50).toUpperCase();
  const textWithTitle = text + `\n\n${shortTitle}`;
  if (textWithTitle.length <= CHAR_LIMITS.TELEGRAM) {
    text = textWithTitle;
  }
  
  // Cupom de desconto (antes do link de afiliado)
  if (input.couponCode) {
    text += `\n- Resgate o cupom: ${input.couponCode} 🏷️`;
  }

  // ADICIONAR LINK NO FINAL (depois do conteúdo)
  text = text + `\n\n${normalizedUrl}`;
  
  // LOG: Verificar o texto antes de processar
  console.log('[generateTelegramCopy] 📝 Texto ANTES de processar:');
  console.log('[generateTelegramCopy] Tamanho:', text.length);
  console.log('[generateTelegramCopy] Conteúdo completo:', JSON.stringify(text));
  console.log('[generateTelegramCopy] Linhas totais:', text.split('\n').length);
  console.log('[generateTelegramCopy] Linhas não vazias:', text.split('\n').filter(l => l.trim().length > 0).length);
  
  // VALIDAÇÃO CRÍTICA: Garantir que há conteúdo além do link ANTES de processar
  const textLines = text.split('\n').filter(line => line.trim().length > 0);
  console.log('[generateTelegramCopy] TextLines:', textLines.length, 'linhas');
  console.log('[generateTelegramCopy] Primeira linha (conteúdo):', textLines[0]?.substring(0, 50));
  console.log('[generateTelegramCopy] Última linha (link):', textLines[textLines.length - 1]?.substring(0, 50));
  console.log('[generateTelegramCopy] Resto das linhas:', textLines.slice(1).join(' | ').substring(0, 200));
  
  if (textLines.length <= 1) {
    console.error('[generateTelegramCopy] ❌ ERRO CRÍTICO: Texto contém apenas o link!');
    console.error('[generateTelegramCopy] Texto atual completo:', JSON.stringify(text));
    console.error('[generateTelegramCopy] finalOpening:', finalOpening);
    console.error('[generateTelegramCopy] finalPriceLine:', finalPriceLine);
    console.error('[generateTelegramCopy] shortTitle:', shortTitle);
    
    // Reconstruir com conteúdo garantido - FORÇAR conteúdo (conteúdo PRIMEIRO, link DEPOIS)
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    let reconstructedText = `${finalOpening}\n`;
    
    if (input.discountPct > 0) {
      const discountText = `(-${Math.round(input.discountPct)}% OFF)`;
      if (input.discountPct >= 20 && discountEmoji) {
        reconstructedText += `${finalPriceLine} ${discountEmoji} ${discountText}`;
      } else {
        reconstructedText += `${finalPriceLine} ${discountText}`;
      }
    } else {
      reconstructedText += finalPriceLine;
    }
    
    reconstructedText += `\n\n${shortTitle}`;
    
    // ADICIONAR LINK NO FINAL
    reconstructedText += `\n\n${normalizedUrl}`;
    
    text = reconstructedText;
    console.log('[generateTelegramCopy] ✅ Texto FORÇADO reconstruído:');
    console.log('[generateTelegramCopy] Novo texto:', JSON.stringify(text));
    console.log('[generateTelegramCopy] Novo tamanho:', text.length);
    console.log('[generateTelegramCopy] Novas linhas não vazias:', text.split('\n').filter(l => l.trim().length > 0).length);
  }
  
  // VALIDAÇÃO FINAL ABSOLUTA: Verificar se o texto tem conteúdo além do link ANTES de processar
  const textBeforeProcessing = text;
  const linesBeforeProcessing = textBeforeProcessing.split('\n').filter(line => line.trim().length > 0);
  
  console.log('[generateTelegramCopy] 🔍 VALIDAÇÃO FINAL antes de processar:');
  console.log('[generateTelegramCopy] Texto completo:', JSON.stringify(textBeforeProcessing));
  console.log('[generateTelegramCopy] Linhas não vazias:', linesBeforeProcessing.length);
  console.log('[generateTelegramCopy] Primeira linha (conteúdo):', linesBeforeProcessing[0]?.substring(0, 80));
  console.log('[generateTelegramCopy] Última linha (deve ser link):', linesBeforeProcessing[linesBeforeProcessing.length - 1]?.substring(0, 80));
  console.log('[generateTelegramCopy] Resto das linhas:', linesBeforeProcessing.slice(1).join(' | '));
  
  // Se tiver apenas 1 linha (apenas o link), FORÇAR adição de conteúdo
  if (linesBeforeProcessing.length <= 1) {
    console.error('[generateTelegramCopy] ❌❌❌ ERRO CRÍTICO: Texto tem apenas o link antes de processar!');
    console.error('[generateTelegramCopy] Texto atual:', JSON.stringify(textBeforeProcessing));
    
    // FORÇAR reconstrução com conteúdo garantido (conteúdo PRIMEIRO, link DEPOIS)
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    const guaranteedOpening = finalOpening || 'ACHADO NÃO É ROUBADO';
    const guaranteedPrice = finalPriceLine || `POR ${formatPrice(input.price)}`;
    const guaranteedTitle = shortTitle || input.title.toUpperCase().substring(0, 50);
    
    let forcedText = `${guaranteedOpening}\n`;
    
    if (input.discountPct > 0) {
      const discountText = `(-${Math.round(input.discountPct)}% OFF)`;
      if (input.discountPct >= 20) {
        forcedText += `${guaranteedPrice} 🔥 ${discountText}`;
      } else {
        forcedText += `${guaranteedPrice} ${discountText}`;
      }
    } else {
      forcedText += guaranteedPrice;
    }
    
    forcedText += `\n\n${guaranteedTitle}`;
    
    // ADICIONAR LINK NO FINAL
    forcedText += `\n\n${normalizedUrl}`;
    
    text = forcedText;
    console.log('[generateTelegramCopy] ✅✅✅ Texto FORÇADO reconstruído:', JSON.stringify(text));
  }
  
  // LOG CRÍTICO: Verificar o texto ANTES de processar
  console.log('[generateTelegramCopy] 🔍 ANTES DE PROCESSAR:');
  console.log('[generateTelegramCopy] Texto completo:', JSON.stringify(text));
  console.log('[generateTelegramCopy] Tamanho:', text.length);
  console.log('[generateTelegramCopy] Todas as linhas:', text.split('\n').map((l, i) => `[${i}]: ${l.substring(0, 60)}`));
  
  // MUDANÇA: Texto PRIMEIRO, link DEPOIS (para aparecer antes do preview)
  // O Telegram ainda gera o preview mesmo com o link no final
  const lines = text.split('\n');
  const link = lines[lines.length - 1]?.trim() || ''; // Última linha é o link (já está em minúsculas)
  const contentLines = lines.slice(0, -1).filter(line => line.trim().length > 0); // Todas as linhas exceto a última (link)
  
  // Converter para maiúsculas PRESERVANDO EMOJIS
  // toUpperCase() não afeta emojis, mas vamos garantir que estão preservados
  const content = contentLines.map(line => {
    // Separar texto de emojis (emojis são preservados automaticamente)
    return line.toUpperCase();
  }).join('\n');
  
  // Formato final: conteúdo PRIMEIRO, link DEPOIS
  // Isso faz o texto aparecer ANTES do preview do link
  
  console.log('[generateTelegramCopy] 🔍 APÓS PROCESSAR:');
  console.log('[generateTelegramCopy] Link extraído:', link.substring(0, 80));
  console.log('[generateTelegramCopy] Linhas de conteúdo:', contentLines.length);
  console.log('[generateTelegramCopy] Conteúdo extraído:', JSON.stringify(content.substring(0, 300)));
  
  // VALIDAÇÃO CRÍTICA: Se não houver conteúdo além do link, usar fallback
  if (!content || content.trim().length === 0) {
    console.error('[generateTelegramCopy] ❌❌❌ ERRO CRÍTICO: Conteúdo está vazio após processamento!');
    console.error('[generateTelegramCopy] Texto original completo:', JSON.stringify(text));
    console.error('[generateTelegramCopy] Total de linhas:', lines.length);
    console.error('[generateTelegramCopy] Linhas de conteúdo encontradas:', contentLines.length);
    console.error('[generateTelegramCopy] Todas as linhas originais:', lines.map((l, i) => `[${i}]: "${l}"`));
    
    // Fallback completo com conteúdo garantido (conteúdo PRIMEIRO, link DEPOIS)
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    const fallbackContent = `ACHADO NÃO É ROUBADO 🔥\n\n${input.title.toUpperCase()}\nPOR ${formatPrice(input.price)}`;
    const fallbackText = `${fallbackContent}\n\n${normalizedUrl}`;
    console.log('[generateTelegramCopy] ✅✅✅ Retornando FALLBACK completo:', JSON.stringify(fallbackText));
    return fallbackText;
  }
  
  // INVERTER ORDEM: Conteúdo PRIMEIRO, link DEPOIS
  // Isso faz o texto aparecer ANTES do preview do Telegram
  let finalText = content + '\n\n' + link;

  // Adicionar link do site vitrine separado do link de afiliado
  if (input.siteUrl) {
    finalText += `\n\n🌐 ${input.siteUrl}`;
  }
  
  // LOG: Verificar o que está sendo gerado
  console.log('[generateTelegramCopy] ✅ Texto gerado com sucesso');
  console.log('[generateTelegramCopy] Link:', link.substring(0, 50));
  console.log('[generateTelegramCopy] Conteúdo (primeiros 200 chars):', content.substring(0, 200));
  console.log('[generateTelegramCopy] Conteúdo tem emoji?', /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑/u.test(content));
  console.log('[generateTelegramCopy] Tamanho total:', finalText.length, 'caracteres');
  console.log('[generateTelegramCopy] Texto final tem emoji?', /[\u{1F300}-\u{1F9FF}]|🔥|👀|🎬|😤|⚽|😂|📺|😡|🎮|💕|😱|🎉|🎯|👑/u.test(finalText));
  
  // Truncar se necessário (mas manter link no final e NUNCA truncar a frase de abertura)
  if (finalText.length > CHAR_LIMITS.TELEGRAM) {
    const linkPart = '\n\n' + link; // Link + quebras de linha
    const maxContentLength = CHAR_LIMITS.TELEGRAM - linkPart.length - 3;
    
    // IMPORTANTE: Preservar a primeira linha (frase de abertura) e truncar apenas o resto
    const contentLines = content.split('\n');
    const openingLine = contentLines[0] || ''; // Primeira linha (frase de abertura)
    const restOfContent = contentLines.slice(1).join('\n'); // Resto do conteúdo
    
    // Calcular quanto espaço sobra para o resto (preservando abertura)
    const openingWithNewline = openingLine + '\n';
    const maxRestLength = maxContentLength - openingWithNewline.length;
    
    if (maxRestLength > 0 && restOfContent.length > maxRestLength) {
      // Truncar apenas o resto, mantendo abertura completa
      const truncatedRest = restOfContent.substring(0, maxRestLength - 3) + '...';
      finalText = openingWithNewline + truncatedRest + linkPart;
    } else {
      // Se couber tudo, usar conteúdo completo
      finalText = content + linkPart;
    }
    
    console.warn('[generateTelegramCopy] ⚠️ Texto truncado para', finalText.length, 'caracteres');
    console.warn('[generateTelegramCopy] Frase de abertura preservada:', openingLine);
    console.warn('[generateTelegramCopy] Conteúdo truncado:', finalText.substring(0, 150));
  }
  
  // VALIDAÇÃO ABSOLUTA: Se ainda estiver vazio, retornar fallback
  if (!finalText || finalText.trim().length < 10) {
    console.error('[generateTelegramCopy] ❌ Texto final ainda vazio após todas as validações!');
    // Conteúdo PRIMEIRO, link DEPOIS no fallback
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    return `ACHADO NÃO É ROUBADO 🔥\n\n${input.title.toUpperCase()}\nPOR ${formatPrice(input.price)}\n\n${normalizedUrl}`;
  }
  
  // VALIDAÇÃO FINAL ABSOLUTA: Verificar se o texto final tem apenas o link
  const finalLines = finalText.split('\n').filter(line => line.trim().length > 0);
  if (finalLines.length <= 1 || finalText.trim() === input.trackingUrl) {
    console.error('[generateTelegramCopy] ❌❌❌ ERRO EXTREMO: Texto final contém apenas o link!');
    console.error('[generateTelegramCopy] finalText:', JSON.stringify(finalText));
    console.error('[generateTelegramCopy] finalLines:', finalLines.length);
    
    // ÚLTIMO RECURSO: Forçar texto mínimo (conteúdo PRIMEIRO, link DEPOIS)
    const normalizedUrl = (input.trackingUrl || '').toLowerCase();
    const minTitle = input.title.toUpperCase().substring(0, 40);
    const minPrice = formatPrice(input.price).toUpperCase();
    
    let forcedMinText = `ACHADO NÃO É ROUBADO 🔥\n\n${minTitle}\nPOR ${minPrice}`;
    
    if (input.discountPct > 0) {
      forcedMinText += ` (-${Math.round(input.discountPct)}% OFF)`;
      if (input.discountPct >= 20) {
        forcedMinText = forcedMinText.replace('POR', 'POR').replace('(-', '🔥 (-');
      }
    }
    
    forcedMinText += `\n\n${normalizedUrl}`;
    
    console.log('[generateTelegramCopy] ✅✅✅ Retornando texto MÍNIMO forçado:', JSON.stringify(forcedMinText));
    return forcedMinText;
  }
  
  console.log('[generateTelegramCopy] ✅✅✅ Texto final validado e pronto:', finalText.substring(0, 200));
  return finalText;
}

/**
 * Gera copy para Site (≤ 600 caracteres) - TUDO EM MAIÚSCULAS + EMOJIS
 */
function generateSiteCopy(input: CopyInputData, seed: number): string {
  const opening = generateOpening(input, seed, 1000); // Canal Site: offset 1000
  const priceLine = generatePriceLine(input, seed + 1);
  const shortTitle = getShortTitle(input.title, 80).toUpperCase();
  const discountEmoji = getDiscountEmoji(input.discountPct, input.title);
  
  // Site pode ter mais contexto
  let text = `${opening}\n\n${shortTitle}\n\n${priceLine}`;
  
  // SEMPRE destacar desconto quando houver
  if (input.discountPct > 0) {
    const discountText = ` (-${Math.round(input.discountPct)}% OFF)`;
    // Adicionar 🔥 se desconto >= 20%
    if (input.discountPct >= 20 && discountEmoji) {
      text += ` ${discountEmoji}${discountText}`;
    } else {
      text += discountText;
    }
  }
  
  // Adicionar loja se conhecida
  const storeName = input.storeName || input.advertiserName;
  if (storeName && text.length + storeName.length + 15 <= CHAR_LIMITS.SITE) {
    text += `\n\nNA ${storeName.toUpperCase()}`;
  }
  
  // Truncar se necessário
  if (text.length > CHAR_LIMITS.SITE) {
    text = text.substring(0, CHAR_LIMITS.SITE - 3) + '...';
  }
  
  // Garantir que está tudo em MAIÚSCULAS (exceto emojis)
  return text.toUpperCase();
}

/**
 * Gera copy para X/Twitter no formato estruturado por linhas.
 * Mistura 3 tipos de ganchos: urgência, surpresa e curiosidade.
 *
 *  🔥 ALERTA DE PROMOÇÃO          ← gancho (linha 1)
 *
 *  Nome do Produto                ← linha 2
 *
 *  De R$ XX,XX                    ← linha 3
 *  por R$ YY,YY                   ← linha 4
 *
 *  🔥 -35% OFF                    ← linha 5 (desconto)
 *
 *  👉 aproveitar oferta           ← linha 6 (CTA — sempre em linha própria)
 *
 *  https://link-afiliado
 *  🌐 https://link-site
 */
function generateXCopy(input: CopyInputData, seed: number): string {
  const priceNow = formatPrice(input.price);
  const discountPct = Math.round(input.discountPct || (
    input.oldPrice && input.oldPrice > input.price
      ? ((input.oldPrice - input.price) / input.oldPrice * 100)
      : 0
  ));

  // ── Escolher gancho sem repetir o mesmo nicho no mesmo dia ──
  // A chave de nicho para o tracker é baseada na categoria do produto,
  // garantindo que TVs diferentes não repitam o mesmo gancho entre si.
  const nicheKey = getCategoryKey(input.category, input.title);

  let hook: string;
  let subtitle: string;

  if (input.isFlash) {
    const FLASH_HOOKS = [
      '⚡ OFERTA RELÂMPAGO',
      '⚡ ACABANDO AGORA',
      '⚡ ÚLTIMAS HORAS',
      '⚡ CORRE QUE TÁ ACABANDO',
      '⚡ TEMPO LIMITADO',
    ];
    const FLASH_SUBTITLES = [
      'Essa oferta tem prazo pra acabar!',
      'Não vai durar mais que algumas horas.',
      'Quando acabar, acabou.',
      'Oferta com countdown ativo.',
      'Aproveita agora ou perde.',
    ];
    hook     = pickUnusedPhrase(FLASH_HOOKS, `x-flash:hook`);
    subtitle = pickUnusedPhrase(FLASH_SUBTITLES, `x-flash:subtitle`);
  } else {
    // Tentar usar frase específica de marca/produto como hook.
    // Prioridade: reutilizar a mesma frase já sorteada para o Telegram neste post
    // (sem avançar o tracker); se nada foi sorteado ainda, sortear agora.
    const productHook =
      peekProductSpecificPhrase(input.title, input.phraseMode) ??
      getProductSpecificPhrase(input.title, input.phraseMode);

    if (productHook) {
      hook = productHook.toUpperCase();
      // Frase de produto é autocontida — não precisa de subtítulo genérico.
      // Um subtítulo genérico só enfraqueceria a frase.
      subtitle = '';
    } else {
      // Sem frase de produto: usar hooks genéricos de urgência/surpresa/curiosidade
      // Descontos altos (≥30%) → forçar surpresa (mais impacto)
      const hookType = discountPct >= 30 ? 1 : Math.floor(Math.random() * 3);

      if (hookType === 0) {
        hook     = pickUnusedPhrase(X_HOOKS_URGENCIA, `x-hook-urgencia:${nicheKey}`);
        subtitle = pickUnusedPhrase(X_SUBTITLES_URGENCIA, `x-subtitle-urgencia:${nicheKey}`);
      } else if (hookType === 1) {
        hook     = pickUnusedPhrase(X_HOOKS_SURPRESA, `x-hook-surpresa:${nicheKey}`);
        subtitle = pickUnusedPhrase(X_SUBTITLES_SURPRESA, `x-subtitle-surpresa:${nicheKey}`);
      } else {
        hook     = pickUnusedPhrase(X_HOOKS_CURIOSIDADE, `x-hook-curiosidade:${nicheKey}`);
        subtitle = pickUnusedPhrase(X_SUBTITLES_CURIOSIDADE, `x-subtitle-curiosidade:${nicheKey}`);
      }
    }
  }

  // ── Escolher CTA sem repetir no mesmo nicho no mesmo dia ──
  const cta = input.isFlash
    ? '👉 aproveitar agora'
    : pickUnusedPhrase(X_CTAS, `x-cta:${nicheKey}`);

  // ── Bloco de preço (considera forma de pagamento) ──
  const priceBlock: string[] = [];
  const pm = input.paymentMethod ?? 'avista';
  const inst = Math.max(2, Math.min(12, input.installments ?? 12));

  if (pm === 'pix') {
    if (input.oldPrice && input.oldPrice > input.price) {
      priceBlock.push(`De ${formatPrice(input.oldPrice)}`);
    }
    priceBlock.push(`por ${priceNow}`);
  } else if (pm === 'parcelado') {
    // Usa o valor por parcela inserido manualmente; se não fornecido, calcula a partir do preço total
    const instValue = (input.installmentValue && input.installmentValue > 0)
      ? input.installmentValue
      : input.price / inst;
    if (input.oldPrice && input.oldPrice > input.price) {
      priceBlock.push(`De ${formatPrice(input.oldPrice)}`);
    }
    priceBlock.push(`por ${inst}x de ${formatPrice(instValue)}`);
  } else {
    if (input.oldPrice && input.oldPrice > input.price) {
      priceBlock.push(`De ${formatPrice(input.oldPrice)}`);
    }
    priceBlock.push(`por ${priceNow}`);
  }

  // ── Linha de desconto ──
  const discountLine = discountPct > 0
    ? pm === 'pix'
      ? `${discountPct >= 30 ? '🔥' : '💰'} -${discountPct}% DE DESCONTO NO PIX`
      : `${discountPct >= 30 ? '🔥' : '💰'} -${discountPct}% DE DESCONTO`
    : '';

  // ── CTA ──

  // ── Calcular espaço disponível para o título ──
  // Twitter conta qualquer URL como 23 chars (t.co). Montamos o post sem o título,
  // substituindo URLs por placeholder de 23 chars, e usamos o que sobrar para o título.
  const TWITTER_LIMIT = 280;
  const TWITTER_URL_LEN = 23;
  const urlPlaceholder = 'x'.repeat(TWITTER_URL_LEN);

  const flashTimeLine = (() => {
    if (input.isFlash && input.flashMinutes) {
      const h = Math.floor(input.flashMinutes / 60);
      const m = input.flashMinutes % 60;
      return `⏰ Oferta encerra em ~${h > 0 ? `${h}h${m > 0 ? `${m}min` : ''}` : `${m}min`}`;
    }
    return null;
  })();

  // No X: extrair apenas o código do cupom (até 20 chars) para economizar caracteres pro título
  const rawCoupon = input.couponCode ?? null;
  const xCouponCode = rawCoupon
    ? (rawCoupon.match(/[A-Z0-9]{4,20}/i)?.[0] ?? rawCoupon.substring(0, 20))
    : null;
  const couponLine = xCouponCode ? `🏷️ Cupom: ${xCouponCode}` : null;

  // Subtitle omitido no X — libera espaço para o título completo do produto
  const fixedLines = [
    hook,
    '',
    // título vai aqui — não incluído no cálculo
    '',
    ...priceBlock,
    ...(discountLine ? ['', discountLine] : []),
    ...(couponLine ? ['', couponLine] : []),
    ...(flashTimeLine ? ['', flashTimeLine] : []),
    '',
    `👉 ${urlPlaceholder}`,
  ];
  const fixedChars = fixedLines.join('\n').length;
  const titleLimit = Math.max(120, TWITTER_LIMIT - fixedChars);

  // Usa o título completo se couber; senão corta na última palavra inteira
  let xTitle = input.title;
  if (xTitle.length > titleLimit) {
    const words = xTitle.split(' ');
    let trimmed = '';
    for (const word of words) {
      const candidate = trimmed ? `${trimmed} ${word}` : word;
      if (candidate.length <= titleLimit - 3) {
        trimmed = candidate;
      } else break;
    }
    xTitle = (trimmed || xTitle.substring(0, titleLimit - 3)) + '...';
  }

  // ── Montar post linha a linha ──
  const lines: string[] = [
    hook,
    '',
    xTitle,
    '',
    ...priceBlock,
  ];

  if (discountLine) {
    lines.push('');
    lines.push(discountLine);
  }

  if (couponLine) {
    lines.push('');
    lines.push(couponLine);
  }

  if (flashTimeLine) {
    lines.push('');
    lines.push(flashTimeLine);
  }

  lines.push('');
  lines.push(`👉 ${input.trackingUrl}`);

  let finalText = lines.join('\n');

  console.log('[generateXCopy] Gancho:', hook, '| Flash:', input.isFlash ?? false);
  console.log('[generateXCopy] Formato: CTA + afiliado na mesma linha | site link separado');
  console.log('[generateXCopy] Texto final:', finalText.substring(0, 250));
  return finalText;
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Gera copies para todos os canais
 * 
 * Regras obrigatórias:
 * - Tom engraçado para jovens 16-25 anos
 * - Referências à cultura jovem quando aplicável
 * - Frases pequenas e chamativas
 * - SEMPRE destacar desconto quando houver
 * - TODAS as frases em MAIÚSCULAS
 * - Sempre mencionar preço
 * - Não prometer estoque
 * - Não inventar urgência falsa
 */
export function generateCopies(
  input: CopyInputData,
  options?: CopyGeneratorOptions
): GeneratedCopies {
  const baseSeed = generateSeed(input);
  const generateVariations = options?.generateVariations ?? false;
  
  // Usar seeds diferentes para cada canal para garantir frases diferentes
  // Telegram: seed base
  // Site: seed + 1000 (mudança significativa)
  // X: seed + 2000 (mudança significativa)
  const telegramSeed = baseSeed;
  const siteSeed = baseSeed + 1000;
  const xSeed = baseSeed + 2000;
  
  // Gerar copy principal com seeds diferentes
  const telegram = generateTelegramCopy(input, telegramSeed);
  const site = generateSiteCopy(input, siteSeed);
  const x = generateXCopy(input, xSeed);
  
  const result: GeneratedCopies = { telegram, site, x };
  
  // Gerar variações se solicitado
  if (generateVariations) {
    result.variations = {
      telegram: [
        generateTelegramCopy(input, telegramSeed + 100),
        generateTelegramCopy(input, telegramSeed + 200),
      ],
      site: [
        generateSiteCopy(input, siteSeed + 100),
        generateSiteCopy(input, siteSeed + 200),
      ],
      x: [
        generateXCopy(input, xSeed + 100),
        generateXCopy(input, xSeed + 200),
      ],
    };
  }
  
  return result;
}

/**
 * Valida se copy está dentro dos limites do canal
 */
export function validateCopy(
  text: string,
  channel: 'TELEGRAM' | 'SITE' | 'X'
): { valid: boolean; length: number; limit: number; overflow: number } {
  const limit = CHAR_LIMITS[channel];
  const length = text.length;
  
  return {
    valid: length <= limit,
    length,
    limit,
    overflow: Math.max(0, length - limit),
  };
}

/**
 * Prepara dados limpos para enviar à IA (se usar IA externa)
 * 
 * Importante: Este JSON NÃO contém tokens nem URLs de API.
 */
export function prepareDataForAI(input: CopyInputData): Record<string, unknown> {
  return {
    title: input.title,
    price: input.price,
    oldPrice: input.oldPrice || null,
    discountPct: Math.round(input.discountPct),
    advertiserName: input.advertiserName || null,
    category: input.category || null,
    trackingUrl: input.trackingUrl,
    // NÃO incluir: tokens, secrets, API keys, etc.
  };
}

/**
 * Formata prompt para IA externa (OpenAI, etc.)
 */
export function generateAIPrompt(input: CopyInputData): string {
  const data = prepareDataForAI(input);
  
  return `Você é um copywriter de promoções brasileiro.

Gere textos de marketing para esta oferta:
${JSON.stringify(data, null, 2)}

REGRAS OBRIGATÓRIAS:
1. Sempre mencionar preço atual e % de desconto
2. NÃO prometer estoque ("enquanto durar" etc.)
3. NÃO inventar urgência falsa ("CORRE", "ÚLTIMAS HORAS")
4. CTA simples: "Ver oferta" ou "Aproveitar"
5. Tom casual, como amigo avisando sobre promoção
6. Máximo 1 emoji por texto (ou nenhum)

GERAR:
1. copyTelegram: ≤ 350 caracteres, 2-3 linhas + link no final
2. copySite: ≤ 600 caracteres, pode ter mais contexto
3. copyX: ≤ 240 caracteres, bem curto, direto ao ponto

Responda em JSON:
{
  "copyTelegram": "...",
  "copySite": "...",
  "copyX": "..."
}`;
}

// ==================== EXPORTS ====================

export default {
  generateCopies,
  validateCopy,
  prepareDataForAI,
  generateAIPrompt,
  CHAR_LIMITS,
};
