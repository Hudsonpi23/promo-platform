/**
 * 🦅 Urubu Copy Generator - Copy no estilo "Urubu das Promoções"
 * 
 * Tom:
 * - Informal
 * - Brasileiro
 * - Meme leve
 * - Conversa de grupo
 * 
 * Regras:
 * - Frase curta no começo (gancho)
 * - Nada técnico
 * - Pode brincar com preço alto
 * - Nunca mentir
 * - Nunca exagerar estoque
 */

import { Channel } from '@prisma/client';

// ==================== TEMPLATES ====================

// Ganchos iniciais (frases de abertura)
const GANCHOS_URUBU = [
  "SÓ PRA QUEM TÁ FORTE NO PIX",
  "ESSE PREÇO NÃO DURA",
  "SE PISCAR, PERDE",
  "NÃO ME RESPONSABILIZO",
  "ALERTA DE PREÇO BAIXO",
  "ACHEI E VIM AVISAR",
  "OLHA O PREÇO DISSO",
  "CORRAM QUE TÁ BARATO",
  "TÁ DE GRAÇA QUASE",
  "PREÇO DE DESAPEGO",
  "ACHADO NÃO É ROUBADO",
  "MENOR PREÇO QUE JÁ VI",
  "PROMOÇÃO RELÂMPAGO",
  "CAIU O PREÇO",
  "OLHA ISSO GENTE",
];

const GANCHOS_FLASH = [
  "⚡ URGENTE",
  "🚨 ALERTA",
  "🔥 VAI ACABAR",
  "⏰ CORRE",
  "💨 VOANDO",
];

// Ganchos específicos para RELAMPAGO (Thor/raio só com desconto >= 35%)
const GANCHOS_RELAMPAGO = [
  "⚡ RELÂMPAGO DE THOR",
  "🌩️ RAIO ENTRE AS ESTRELAS",
  "⚡⚡ RAIO DUPLO",
  "🔥 RELÂMPAGO ABSOLUTO",
  "⚡ DESCARGA ELÉTRICA DE DESCONTO",
];

// Ganchos para OFERTA_DO_DIA
const GANCHOS_OFERTA_DIA = [
  "🌟 ACHADINHO DO DIA",
  "✨ MELHOR DO DIA",
  "🏆 DESTAQUE DO DIA",
  "📌 OFERTA DO DIA",
  "💎 PÉROLA DO DIA",
];

// Ganchos para CUPOM
const GANCHOS_CUPOM = [
  "🎟️ CUPOM LIBERADO",
  "🏷️ TEM CUPOM",
  "💳 COM CUPOM SAI MAIS BARATO",
  "🎫 USA O CUPOM",
];

const GANCHOS_NEUTRO = [
  "Promoção imperdível",
  "Oferta especial",
  "Preço reduzido",
  "Desconto exclusivo",
  "Oportunidade única",
];

// Fechamentos
const FECHAMENTOS = [
  "Normalmente some rápido 👀",
  "Se durar até o fim do dia é milagre 👀",
  "Aproveita enquanto dá",
  "Corre que o urubu avisou",
  "Não deixa passar",
  "Quem viu, viu",
  "Depois não diz que não avisei",
  "O bicho tá on 🔥",
  "Vai que é tua",
  "",  // Sem fechamento às vezes
];

const EMOJIS_PRECO = ["💰", "💵", "🏷️", ""];
const EMOJIS_DESCONTO = ["🔥", "⬇️", "📉", ""];

// ==================== HELPERS ====================

function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatPrice(price: number): string {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calculateDiscount(oldPrice: number, newPrice: number): number {
  if (!oldPrice || oldPrice <= newPrice) return 0;
  return Math.round(((oldPrice - newPrice) / oldPrice) * 100);
}

// ==================== GERADORES ====================

export interface CopyInput {
  title: string;
  price: number;
  oldPrice?: number;
  discountPct?: number;
  channel: Channel | string;
  humorStyle?: 'URUBU' | 'NEUTRO' | 'FLASH' | 'ENGRACADO';
  trackingUrl: string;
  storeName?: string;
  promoType?: 'RELAMPAGO' | 'OFERTA_DO_DIA' | 'NORMAL' | 'CUPOM';
  couponCode?: string;
}

export interface GeneratedCopy {
  text: string;
  gancho: string;
  humorStyle: string;
  charCount: number;
}

/**
 * Gera copy para X (Twitter) - até 240 caracteres
 */
function generateForX(input: CopyInput): GeneratedCopy {
  const { title, price, oldPrice, discountPct, humorStyle = 'URUBU', trackingUrl } = input;
  
  // Escolher gancho baseado no estilo
  let gancho: string;
  switch (humorStyle) {
    case 'FLASH':
      gancho = random(GANCHOS_FLASH);
      break;
    case 'NEUTRO':
      gancho = random(GANCHOS_NEUTRO);
      break;
    default:
      gancho = random(GANCHOS_URUBU);
  }

  const discount = discountPct || calculateDiscount(oldPrice || 0, price);
  const emoji = random(EMOJIS_PRECO);
  
  // Título curto (máximo 60 chars)
  const shortTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
  
  // Montar copy
  let parts: string[] = [];
  
  // Gancho + Título
  parts.push(`${gancho}`);
  parts.push(shortTitle);
  
  // Preço
  if (oldPrice && oldPrice > price) {
    parts.push(`De ${formatPrice(oldPrice)} por ${formatPrice(price)} ${emoji}`);
  } else {
    parts.push(`Por apenas ${formatPrice(price)} ${emoji}`);
  }
  
  // Fechamento curto para X
  const fechamento = random(FECHAMENTOS.filter(f => f.length < 30));
  if (fechamento) {
    parts.push(fechamento);
  }
  
  // Link
  parts.push(`👉 ${trackingUrl}`);
  
  let text = parts.join('\n');
  
  // Se passar de 280 chars, encurtar
  while (text.length > 280 && parts.length > 3) {
    parts.splice(-2, 1); // Remove o penúltimo (fechamento)
    text = parts.join('\n');
  }
  
  return {
    text,
    gancho,
    humorStyle,
    charCount: text.length,
  };
}

/**
 * Escolhe gancho baseado no promoType e humorStyle
 */
function chooseGancho(input: CopyInput): string {
  const { promoType, humorStyle = 'URUBU', discountPct = 0 } = input;
  
  // RELAMPAGO: Thor/raio só com desconto >= 35%
  if (promoType === 'RELAMPAGO') {
    if (discountPct >= 35) {
      return random(GANCHOS_RELAMPAGO);
    }
    return random(GANCHOS_FLASH);
  }
  
  // OFERTA_DO_DIA
  if (promoType === 'OFERTA_DO_DIA') {
    return random(GANCHOS_OFERTA_DIA);
  }
  
  // CUPOM
  if (promoType === 'CUPOM') {
    return random(GANCHOS_CUPOM);
  }
  
  // NORMAL ou baseado em humorStyle
  switch (humorStyle) {
    case 'FLASH':
      return random(GANCHOS_FLASH);
    case 'NEUTRO':
      return random(GANCHOS_NEUTRO);
    default:
      return random(GANCHOS_URUBU);
  }
}

/**
 * Gera copy para Telegram - até 500 caracteres
 */
function generateForTelegram(input: CopyInput): GeneratedCopy {
  const { title, price, oldPrice, discountPct, humorStyle = 'URUBU', trackingUrl, storeName, promoType, couponCode } = input;
  
  // Escolher gancho baseado no promoType e estilo
  const gancho = chooseGancho(input);

  const discount = discountPct || calculateDiscount(oldPrice || 0, price);
  const emojiDesconto = random(EMOJIS_DESCONTO);
  
  // Montar copy
  let parts: string[] = [];
  
  // Gancho
  parts.push(gancho);
  parts.push('');
  
  // Título
  parts.push(`<b>${title}</b>`);
  
  // Loja (se tiver)
  if (storeName) {
    parts.push(`📦 ${storeName}`);
  }
  
  // Preço
  if (oldPrice && oldPrice > price) {
    parts.push(`<s>De ${formatPrice(oldPrice)}</s> por <b>${formatPrice(price)}</b> ${emojiDesconto}`);
    if (discount > 0) {
      parts.push(`💥 ${discount}% OFF`);
    }
  } else {
    parts.push(`💰 Por apenas <b>${formatPrice(price)}</b>`);
  }
  
  // Cupom (se tiver)
  if (promoType === 'CUPOM' && couponCode) {
    parts.push('');
    parts.push(`🎟️ Use o cupom: <b>${couponCode}</b>`);
  }
  
  parts.push('');
  
  // Fechamento
  const fechamento = random(FECHAMENTOS);
  if (fechamento) {
    parts.push(fechamento);
  }
  
  // Link
  parts.push(`👉 <a href="${trackingUrl}">APROVEITAR OFERTA</a>`);
  
  const text = parts.join('\n');
  
  return {
    text,
    gancho,
    humorStyle,
    charCount: text.length,
  };
}

/**
 * Gera copy para WhatsApp - curto e direto
 */
function generateForWhatsApp(input: CopyInput): GeneratedCopy {
  const { title, price, oldPrice, discountPct, trackingUrl } = input;
  
  const discount = discountPct || calculateDiscount(oldPrice || 0, price);
  
  // WhatsApp é bem curto
  let parts: string[] = [];
  
  parts.push(`👀 ${discount > 0 ? 'Caiu o preço' : 'Achei essa'}`);
  parts.push('');
  parts.push(title.length > 80 ? title.substring(0, 77) + '...' : title);
  
  if (oldPrice && oldPrice > price) {
    parts.push(`Por ${formatPrice(price)} (era ${formatPrice(oldPrice)})`);
  } else {
    parts.push(`Por ${formatPrice(price)}`);
  }
  
  parts.push('');
  parts.push(`Vale conferir: ${trackingUrl}`);
  
  const text = parts.join('\n');
  
  return {
    text,
    gancho: 'Caiu o preço',
    humorStyle: 'URUBU',
    charCount: text.length,
  };
}

/**
 * Gera copy para Site - similar ao Telegram
 */
function generateForSite(input: CopyInput): GeneratedCopy {
  return generateForTelegram(input);
}

/**
 * Gera copy genérica
 */
function generateGeneric(input: CopyInput): GeneratedCopy {
  return generateForTelegram(input);
}

// ==================== EXPORTAÇÃO PRINCIPAL ====================

/**
 * 🦅 Gera copy no estilo Urubu das Promoções
 */
export function generateUruboCopy(input: CopyInput): GeneratedCopy {
  const channel = input.channel.toString().toUpperCase();
  
  switch (channel) {
    case 'TWITTER':
    case 'X':
      return generateForX(input);
    case 'TELEGRAM':
      return generateForTelegram(input);
    case 'WHATSAPP':
      return generateForWhatsApp(input);
    case 'SITE':
      return generateForSite(input);
    default:
      return generateGeneric(input);
  }
}

/**
 * 🦅 Gera copy para TODOS os canais de uma vez
 */
export function generateAllChannelsCopy(input: Omit<CopyInput, 'channel'>): Record<string, GeneratedCopy> {
  const channels: Channel[] = ['TELEGRAM', 'WHATSAPP', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'SITE'];
  const result: Record<string, GeneratedCopy> = {};
  
  for (const channel of channels) {
    result[channel] = generateUruboCopy({ ...input, channel });
  }
  
  return result;
}

/**
 * Valida se a copy está dentro dos limites do canal
 */
export function validateCopyLength(text: string, channel: Channel | string): {
  valid: boolean;
  charCount: number;
  maxAllowed: number;
} {
  const limits: Record<string, number> = {
    TWITTER: 280,
    X: 280,
    TELEGRAM: 4096,
    WHATSAPP: 1024,
    INSTAGRAM: 2200,
    FACEBOOK: 63206,
    SITE: 10000,
  };
  
  const maxAllowed = limits[channel.toString().toUpperCase()] || 1000;
  
  return {
    valid: text.length <= maxAllowed,
    charCount: text.length,
    maxAllowed,
  };
}
