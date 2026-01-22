/**
 * AI Copy Generator Service
 * 
 * Gera textos de marketing para ofertas usando regras determinísticas
 * com fallback para IA externa (OpenAI) quando disponível.
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

export interface CopyInputData {
  title: string;
  price: number;
  oldPrice?: number | null;
  discountPct: number;
  advertiserName?: string | null;
  storeName?: string | null;
  category?: string | null;
  trackingUrl: string;
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
  TELEGRAM: 350,
  SITE: 600,
  X: 240,
};

// Templates humanos - evitam linguagem robótica
const OPENINGS_CASUAL = [
  'Achei isso agora.',
  'Olha o que apareceu.',
  'Tava olhando e vi isso.',
  'Isso me chamou atenção 👀',
  'Não sei até quando fica assim.',
  'Pra quem tava esperando baixar...',
  'Esse preço me surpreendeu.',
  'Vi e achei que valia compartilhar.',
  'Fazia tempo que não via assim.',
  'Olha só esse preço.',
];

const OPENINGS_BY_CATEGORY: Record<string, string[]> = {
  'eletronicos': [
    'Apareceu com desconto bom.',
    'Quem tava querendo, olha isso.',
    'Esse desconto é difícil de ver.',
  ],
  'moda': [
    'Baixou bastante.',
    'Pra quem curte esse estilo, tá valendo.',
    'Com desconto assim é achado.',
  ],
  'casa': [
    'Pra casa com desconto bom.',
    'Achado pra quem precisa.',
    'Esse valor é raro.',
  ],
  'games': [
    'Console/jogo com esse desconto é raro.',
    'Pra quem tava esperando baixar...',
    'Se você tava juntando, pode ser a hora.',
  ],
};

const PRICE_TEMPLATES = [
  (old: string, now: string) => `Caiu de ${old} pra ${now}.`,
  (old: string, now: string) => `Era ${old}, agora tá ${now}.`,
  (old: string, now: string) => `De ${old} por ${now}.`,
  (old: string, now: string) => `Saiu de ${old} pra ${now}.`,
];

const PRICE_TEMPLATES_NO_OLD = [
  (now: string) => `Tá ${now}.`,
  (now: string) => `Por ${now}.`,
  (now: string) => `Saindo por ${now}.`,
];

const CTAS_SUBTLE = [
  'Ver oferta',
  'Aproveitar',
  'Ver mais',
  'Conferir',
  '',
];

// ==================== HELPERS ====================

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
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
  if (text.match(/tênis|tenis|nike|adidas|puma|roupa|camisa|calça/)) return 'moda';
  if (text.match(/air ?fryer|geladeira|microondas|fogão|cozinha|panela/)) return 'casa';
  if (text.match(/playstation|xbox|nintendo|ps5|switch|jogo|game/)) return 'games';
  
  return 'geral';
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
  const priceNow = formatPrice(input.price);
  
  if (input.oldPrice && input.oldPrice > input.price) {
    const priceOld = formatPrice(input.oldPrice);
    const template = pickRandom(PRICE_TEMPLATES, seed);
    return template(priceOld, priceNow);
  }
  
  const template = pickRandom(PRICE_TEMPLATES_NO_OLD, seed);
  return template(priceNow);
}

/**
 * Gera abertura baseada na categoria
 */
function generateOpening(input: CopyInputData, seed: number): string {
  const categoryKey = getCategoryKey(input.category, input.title);
  
  if (OPENINGS_BY_CATEGORY[categoryKey]) {
    // 60% chance de usar abertura específica da categoria
    if (seed % 10 < 6) {
      return pickRandom(OPENINGS_BY_CATEGORY[categoryKey], seed);
    }
  }
  
  return pickRandom(OPENINGS_CASUAL, seed);
}

/**
 * Gera CTA sutil (pode ser vazio)
 */
function generateCTA(seed: number): string {
  return pickRandom(CTAS_SUBTLE, seed);
}

/**
 * Gera copy para Telegram (≤ 350 caracteres)
 */
function generateTelegramCopy(input: CopyInputData, seed: number): string {
  const opening = generateOpening(input, seed);
  const priceLine = generatePriceLine(input, seed + 1);
  const cta = generateCTA(seed + 2);
  
  // Montar texto
  let text = `${opening}\n${priceLine}`;
  
  // Adicionar desconto se > 30%
  if (input.discountPct >= 30) {
    text += ` (-${Math.round(input.discountPct)}%)`;
  }
  
  // Adicionar CTA se houver e couber
  if (cta && (text + '\n\n' + cta + '\n' + input.trackingUrl).length <= CHAR_LIMITS.TELEGRAM) {
    text += `\n\n${cta}`;
  }
  
  // Adicionar link
  text += `\n${input.trackingUrl}`;
  
  // Truncar se necessário
  if (text.length > CHAR_LIMITS.TELEGRAM) {
    const linkPart = `\n${input.trackingUrl}`;
    const maxTextLength = CHAR_LIMITS.TELEGRAM - linkPart.length - 3;
    text = text.substring(0, maxTextLength) + '...' + linkPart;
  }
  
  return text;
}

/**
 * Gera copy para Site (≤ 600 caracteres)
 */
function generateSiteCopy(input: CopyInputData, seed: number): string {
  const opening = generateOpening(input, seed);
  const priceLine = generatePriceLine(input, seed + 1);
  const shortTitle = getShortTitle(input.title, 80);
  
  // Site pode ter mais contexto
  let text = `${opening}\n\n${shortTitle}\n\n${priceLine}`;
  
  // Adicionar desconto
  if (input.discountPct >= 20) {
    text += ` (-${Math.round(input.discountPct)}% OFF)`;
  }
  
  // Adicionar loja se conhecida
  const storeName = input.storeName || input.advertiserName;
  if (storeName && text.length + storeName.length + 15 <= CHAR_LIMITS.SITE) {
    text += `\n\nNa ${storeName}.`;
  }
  
  // Truncar se necessário
  if (text.length > CHAR_LIMITS.SITE) {
    text = text.substring(0, CHAR_LIMITS.SITE - 3) + '...';
  }
  
  return text;
}

/**
 * Gera copy para X/Twitter (≤ 240 caracteres)
 */
function generateXCopy(input: CopyInputData, seed: number): string {
  const priceNow = formatPrice(input.price);
  const shortTitle = getShortTitle(input.title, 60);
  const link = input.trackingUrl;
  
  // X é mais curto - ir direto ao ponto
  let text: string;
  
  if (input.oldPrice && input.oldPrice > input.price) {
    const priceOld = formatPrice(input.oldPrice);
    text = `${shortTitle}\nDe ${priceOld} por ${priceNow}`;
    
    // Adicionar desconto se couber
    if ((text + ` (-${Math.round(input.discountPct)}%)\n\n${link}`).length <= CHAR_LIMITS.X) {
      text += ` (-${Math.round(input.discountPct)}%)`;
    }
  } else {
    text = `${shortTitle}\n${priceNow}`;
  }
  
  // Adicionar link
  text += `\n\n${link}`;
  
  // Se ainda muito longo, usar versão ultra-curta
  if (text.length > CHAR_LIMITS.X) {
    const ultraShort = getShortTitle(input.title, 40);
    text = `${ultraShort}\n${priceNow}\n\n${link}`;
  }
  
  // Último fallback - só preço e link
  if (text.length > CHAR_LIMITS.X) {
    text = `${priceNow} 👀\n${link}`;
  }
  
  return text;
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Gera copies para todos os canais
 * 
 * Regras obrigatórias:
 * - Sempre mencionar preço e % off
 * - Não prometer estoque
 * - Não inventar urgência falsa
 * - CTA simples ("Ver oferta", "Aproveitar")
 */
export function generateCopies(
  input: CopyInputData,
  options?: CopyGeneratorOptions
): GeneratedCopies {
  const seed = generateSeed(input);
  const generateVariations = options?.generateVariations ?? false;
  
  // Gerar copy principal
  const telegram = generateTelegramCopy(input, seed);
  const site = generateSiteCopy(input, seed);
  const x = generateXCopy(input, seed);
  
  const result: GeneratedCopies = { telegram, site, x };
  
  // Gerar variações se solicitado
  if (generateVariations) {
    result.variations = {
      telegram: [
        generateTelegramCopy(input, seed + 100),
        generateTelegramCopy(input, seed + 200),
      ],
      site: [
        generateSiteCopy(input, seed + 100),
        generateSiteCopy(input, seed + 200),
      ],
      x: [
        generateXCopy(input, seed + 100),
        generateXCopy(input, seed + 200),
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
