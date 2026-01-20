/**
 * Gerador de Copy Humana por Canal
 * 
 * Gera textos naturais, sem "robô vibes", estilo Manu.
 * PROIBIDO: "OFERTA DO DIA", "PROMOÇÃO", "🔥 OFERTA 🔥", "CORRE"
 */

import { NormalizedOffer } from './types';

// ==================== TEMPLATES HUMANOS ====================

// Aberturas casuais (variar para não repetir)
const OPENINGS = [
  'Achei isso agora.',
  'Olha o que apareceu.',
  'Tava olhando e vi isso aqui.',
  'Isso chamou minha atenção.',
  'Não sei até quando fica assim.',
  'Pra quem tava esperando baixar...',
  'Quem tava de olho, agora é hora.',
  'Esse preço me surpreendeu.',
  'Apareceu isso aqui agora.',
  'Vi e achei que valia compartilhar.',
  'Fazia tempo que não via assim.',
  'Olha só esse preço.',
];

// Aberturas para produtos específicos
const PRODUCT_OPENINGS: Record<string, string[]> = {
  'celular': [
    'Esse celular tá num preço que eu não via fazia tempo.',
    'Apareceu esse celular aqui com desconto bom.',
    'Quem tava querendo trocar de cel, olha isso.',
  ],
  'notebook': [
    'Esse notebook tá com preço interessante.',
    'Pra quem precisa de um note novo...',
    'Notebook bom nesse preço é raro.',
  ],
  'tv': [
    'Essa TV tá num preço que chamou atenção.',
    'TV boa assim nesse valor não aparece sempre.',
    'Se tava pensando em trocar a TV, olha isso.',
  ],
  'tênis': [
    'Esse tênis baixou bastante.',
    'Pra quem curte esse modelo, tá valendo.',
    'Tênis bom com desconto assim é difícil.',
  ],
  'airfryer': [
    'Air fryer boa nesse preço é achado.',
    'Quem tava querendo uma air fryer, olha isso.',
    'Esse modelo de air fryer tá com desconto bom.',
  ],
  'console': [
    'Console com esse desconto é raro.',
    'Pra quem tava esperando baixar...',
    'Se você tava juntando pra comprar, agora pode ser a hora.',
  ],
};

// Fechamentos/CTAs sutis
const CLOSINGS = [
  'Se curtir, vale dar uma olhada.',
  'Quem quiser, tá aí.',
  'Fica a dica.',
  '',
  '',
  '',
];

// Urgência sutil (sem ser robótico)
const URGENCY_HINTS = [
  'Não sei até quando fica assim.',
  'Geralmente some rápido.',
  'Esse preço não costuma durar.',
  '',
  '',
];

// ==================== HELPERS ====================

function formatPrice(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getProductType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('iphone') || lower.includes('samsung') || lower.includes('celular') || lower.includes('smartphone')) return 'celular';
  if (lower.includes('notebook') || lower.includes('laptop') || lower.includes('dell') || lower.includes('lenovo')) return 'notebook';
  if (lower.includes('tv') || lower.includes('smart tv') || lower.includes('oled') || lower.includes('qled')) return 'tv';
  if (lower.includes('tênis') || lower.includes('tenis') || lower.includes('nike') || lower.includes('adidas')) return 'tênis';
  if (lower.includes('air fryer') || lower.includes('airfryer') || lower.includes('fritadeira')) return 'airfryer';
  if (lower.includes('playstation') || lower.includes('xbox') || lower.includes('nintendo') || lower.includes('ps5')) return 'console';
  return 'geral';
}

function pickRandom<T>(arr: T[], seed?: number): T {
  const idx = seed !== undefined ? seed % arr.length : Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function getShortTitle(title: string): string {
  // Pegar até 40 chars sem cortar palavra
  if (title.length <= 40) return title;
  const words = title.split(' ');
  let result = '';
  for (const word of words) {
    if ((result + ' ' + word).length > 37) break;
    result = result ? result + ' ' + word : word;
  }
  return result + '...';
}

// ==================== GENERATORS ====================

export interface GeneratedCopy {
  telegram: string;
  site: string;
  x: string;
}

/**
 * Gera copy humana para todos os canais
 */
export function generateHumanCopy(
  offer: NormalizedOffer,
  link: string,
  seed?: number
): GeneratedCopy {
  const productType = getProductType(offer.title);
  const s = seed ?? Math.floor(Math.random() * 1000);
  
  // Escolher abertura
  let opening: string;
  if (PRODUCT_OPENINGS[productType]) {
    opening = pickRandom(PRODUCT_OPENINGS[productType], s);
  } else {
    opening = pickRandom(OPENINGS, s);
  }
  
  // Linha de preço
  const priceLine = offer.originalPrice > offer.finalPrice
    ? `Caiu de ${formatPrice(offer.originalPrice)} pra ${formatPrice(offer.finalPrice)}.`
    : `Tá ${formatPrice(offer.finalPrice)}.`;
  
  // Fechamento (50% das vezes)
  const closing = s % 2 === 0 ? pickRandom(CLOSINGS, s + 1) : '';
  const urgency = s % 3 === 0 ? pickRandom(URGENCY_HINTS, s + 2) : '';
  
  // === TELEGRAM (2-3 linhas + link) ===
  const telegramParts = [opening, priceLine];
  if (urgency) telegramParts.push(urgency);
  if (closing) telegramParts.push(closing);
  const telegram = telegramParts.filter(Boolean).join('\n') + `\n\n${link}`;
  
  // === SITE (similar ao Telegram, sem link) ===
  const siteParts = [opening, priceLine];
  if (closing) siteParts.push(closing);
  const site = siteParts.filter(Boolean).join('\n');
  
  // === X/TWITTER (curto, ~240 chars, com imagem e link no final) ===
  const shortTitle = getShortTitle(offer.title);
  let xText = `${opening}\n${priceLine}`;
  
  // Se ficar muito longo, simplificar
  if ((xText + '\n\n' + link).length > 250) {
    xText = `${shortTitle}\nDe ${formatPrice(offer.originalPrice)} por ${formatPrice(offer.finalPrice)}`;
  }
  
  // Garantir que cabe com o link
  const xWithLink = xText + `\n\n${link}`;
  const x = xWithLink.length <= 280 ? xWithLink : `${shortTitle}\n${formatPrice(offer.finalPrice)}\n\n${link}`;
  
  return { telegram, site, x };
}

/**
 * Gera copy para um canal específico
 */
export function generateCopyForChannel(
  offer: NormalizedOffer,
  channel: 'TELEGRAM' | 'SITE' | 'TWITTER',
  link: string,
  seed?: number
): string {
  const copies = generateHumanCopy(offer, link, seed);
  
  switch (channel) {
    case 'TELEGRAM':
      return copies.telegram;
    case 'SITE':
      return copies.site;
    case 'TWITTER':
      return copies.x;
    default:
      return copies.telegram;
  }
}
