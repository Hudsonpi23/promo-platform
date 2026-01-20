/**
 * Copy Engine - Gerador de copy "humano" estilo Manu
 * 
 * Gera textos naturais para promoções, sem linguagem robótica.
 * Cada canal tem suas regras específicas de formatação.
 */

import { Decimal } from '@prisma/client/runtime/library';

// ==================== TYPES ====================

export type Channel = 'TELEGRAM' | 'WHATSAPP' | 'FACEBOOK' | 'TWITTER' | 'SITE';

export interface OfferInput {
  id: string;
  title: string;
  originalPrice?: number | Decimal | null;
  finalPrice: number | Decimal;
  discountPct?: number | null;
  niche?: string;
  store?: string;
  urgency?: 'HOJE' | 'ULTIMAS_UNIDADES' | 'LIMITADO' | 'NORMAL';
  imageUrl?: string | null;
  goCode?: string;
}

export interface CopyResult {
  text: string;
  headline?: string;      // Para Site
  subcopy?: string;       // Para Site
  requiresImage: boolean; // X exige imagem
  error?: string;         // Se não puder gerar (ex: X sem imagem)
}

export interface BuildCopyOptions {
  offer: OfferInput;
  channel: Channel;
  styleSeed?: number;     // Para variar templates de forma controlada
  baseUrl?: string;       // URL base do site (default: env ou localhost)
}

// ==================== FORMATAÇÃO ====================

/**
 * Formata valor para BRL: "R$ 1.799,00"
 */
export function formatBRL(value: number | Decimal | null | undefined): string {
  if (value == null) return '';
  const num = typeof value === 'number' ? value : Number(value);
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

/**
 * Formata desconto: "-44%"
 */
export function discountStr(pct: number | null | undefined): string {
  if (pct == null || pct <= 0) return '';
  return `-${Math.round(pct)}%`;
}

/**
 * Gera URL curta do post
 */
function getShortUrl(offer: OfferInput, baseUrl: string): string {
  const code = offer.goCode || offer.id;
  return `${baseUrl}/go/${code}`;
}

// ==================== TEMPLATES HUMANOS ====================

/**
 * Aberturas naturais - estilo pessoa real avisando sobre promoção
 * Máximo 1 emoji por copy (ou nenhum)
 */
const OPENINGS_WITH_PRICE_DROP = [
  // Descoberta casual
  (title: string) => `Achei isso agora pouco.`,
  (title: string) => `Tava olhando e apareceu isso.`,
  (title: string) => `Olha o que eu achei.`,
  
  // Preço chamou atenção
  (title: string) => `Esse preço chamou atenção 👀`,
  (title: string) => `Fazia tempo que eu não via assim.`,
  (title: string) => `Não sei até quando fica assim.`,
  
  // Recomendação sutil
  (title: string) => `Se você tava precisando, vale olhar.`,
  (title: string) => `Pra quem tava esperando baixar...`,
  (title: string) => `Quem tava de olho, agora é hora.`,
  
  // Surpresa
  (title: string) => `Esse ${getProductType(title)} tá num preço que eu não via fazia tempo 👀`,
  (title: string) => `Olha isso aqui.`,
  (title: string) => `Isso aqui apareceu agora.`,
];

const OPENINGS_NO_COMPARISON = [
  (title: string) => `Achei esse ${getProductType(title)} por um preço bom.`,
  (title: string) => `Olha o preço desse aqui.`,
  (title: string) => `Tá valendo dar uma olhada.`,
  (title: string) => `Apareceu isso aqui agora.`,
  (title: string) => `Vi isso e achei que valia compartilhar.`,
  (title: string) => `Quem tava precisando...`,
];

const OPENINGS_URGENCY_HOJE = [
  (title: string) => `Esse preço não deve durar muito.`,
  (title: string) => `Não sei se amanhã ainda tá assim.`,
  (title: string) => `Melhor não demorar pra olhar.`,
  (title: string) => `Se interessar, eu não deixaria pra depois.`,
];

/**
 * Extrai tipo de produto do título para personalização
 */
function getProductType(title: string): string {
  const lower = title.toLowerCase();
  
  // Eletrônicos
  if (lower.includes('iphone') || lower.includes('smartphone') || lower.includes('celular')) return 'celular';
  if (lower.includes('notebook') || lower.includes('laptop')) return 'notebook';
  if (lower.includes('tv') || lower.includes('smart tv')) return 'TV';
  if (lower.includes('fone') || lower.includes('airpod') || lower.includes('earbuds')) return 'fone';
  if (lower.includes('playstation') || lower.includes('xbox') || lower.includes('ps5') || lower.includes('ps4')) return 'console';
  if (lower.includes('tablet') || lower.includes('ipad')) return 'tablet';
  
  // Casa
  if (lower.includes('air fryer') || lower.includes('airfryer')) return 'air fryer';
  if (lower.includes('geladeira') || lower.includes('refrigerador')) return 'geladeira';
  if (lower.includes('máquina de lavar') || lower.includes('lavadora')) return 'máquina de lavar';
  if (lower.includes('aspirador')) return 'aspirador';
  if (lower.includes('cafeteira')) return 'cafeteira';
  
  // Moda
  if (lower.includes('tênis') || lower.includes('tenis')) return 'tênis';
  if (lower.includes('nike') || lower.includes('adidas')) return 'tênis';
  if (lower.includes('bolsa')) return 'bolsa';
  if (lower.includes('relógio') || lower.includes('relogio')) return 'relógio';
  
  // Genérico - pega primeira palavra significativa
  const words = title.split(' ').filter(w => w.length > 3);
  return words[0]?.toLowerCase() || 'produto';
}

/**
 * Seleciona abertura baseado no seed e contexto
 */
function selectOpening(
  offer: OfferInput,
  seed: number,
  hasComparison: boolean
): string {
  const title = offer.title;
  
  // Se urgência = HOJE, usar aberturas específicas (20% das vezes)
  if (offer.urgency === 'HOJE' && seed % 5 === 0) {
    const idx = seed % OPENINGS_URGENCY_HOJE.length;
    return OPENINGS_URGENCY_HOJE[idx](title);
  }
  
  // Com comparação de preço
  if (hasComparison) {
    // Usar apenas 6 aberturas por "semana" (seed / 7)
    const weekSeed = Math.floor(seed / 7);
    const activeOpenings = OPENINGS_WITH_PRICE_DROP.slice(
      (weekSeed * 6) % OPENINGS_WITH_PRICE_DROP.length,
      ((weekSeed * 6) % OPENINGS_WITH_PRICE_DROP.length) + 6
    );
    // Se passar do array, volta do início
    const normalizedOpenings = activeOpenings.length >= 6 
      ? activeOpenings 
      : [...activeOpenings, ...OPENINGS_WITH_PRICE_DROP.slice(0, 6 - activeOpenings.length)];
    
    const idx = seed % normalizedOpenings.length;
    return normalizedOpenings[idx](title);
  }
  
  // Sem comparação
  const idx = seed % OPENINGS_NO_COMPARISON.length;
  return OPENINGS_NO_COMPARISON[idx](title);
}

/**
 * Formata linha de preço
 */
function formatPriceLine(
  originalPrice: number | Decimal | null | undefined,
  finalPrice: number | Decimal,
  channel: Channel
): string {
  const hasOriginal = originalPrice != null && Number(originalPrice) > Number(finalPrice);
  
  if (hasOriginal) {
    const orig = formatBRL(originalPrice);
    const final = formatBRL(finalPrice);
    
    // Variações naturais
    if (channel === 'TWITTER') {
      return `De ${orig} por ${final}`;
    }
    
    // Telegram/WhatsApp - mais conversacional
    const variations = [
      `Era ${orig}, agora tá ${final}.`,
      `De ${orig} por ${final}.`,
      `Saiu de ${orig} pra ${final}.`,
      `Tava ${orig}, agora ${final}.`,
    ];
    
    // Usa seed simples baseado no preço para variar
    const idx = Math.floor(Number(finalPrice)) % variations.length;
    return variations[idx];
  }
  
  // Só preço atual
  return `Tá ${formatBRL(finalPrice)}.`;
}

// ==================== BUILD COPY POR CANAL ====================

/**
 * Gera copy para Twitter/X
 * - Máx ~220 caracteres
 * - 1 bloco + link
 * - Exige imagem
 */
function buildTwitterCopy(offer: OfferInput, seed: number, baseUrl: string): CopyResult {
  // X sempre exige imagem
  const requiresImage = true;
  
  if (!offer.imageUrl) {
    return {
      text: '',
      requiresImage,
      error: 'SEM_IMAGEM_PARA_X',
    };
  }
  
  const hasComparison = offer.originalPrice != null && Number(offer.originalPrice) > Number(offer.finalPrice);
  const opening = selectOpening(offer, seed, hasComparison);
  const priceLine = formatPriceLine(offer.originalPrice, offer.finalPrice, 'TWITTER');
  const link = getShortUrl(offer, baseUrl);
  
  // Montar texto curto
  let text = `${opening}\n${priceLine}\n\n${link}`;
  
  // Se passar de 280, encurtar abertura
  if (text.length > 280) {
    const shortOpening = 'Olha esse preço 👀';
    text = `${shortOpening}\n${priceLine}\n\n${link}`;
  }
  
  return {
    text,
    requiresImage,
  };
}

/**
 * Gera copy para Telegram
 * - 2-3 linhas
 * - 1 emoji máx
 * - Link no final
 */
function buildTelegramCopy(offer: OfferInput, seed: number, baseUrl: string): CopyResult {
  const hasComparison = offer.originalPrice != null && Number(offer.originalPrice) > Number(offer.finalPrice);
  const opening = selectOpening(offer, seed, hasComparison);
  const priceLine = formatPriceLine(offer.originalPrice, offer.finalPrice, 'TELEGRAM');
  const link = getShortUrl(offer, baseUrl);
  
  const text = `${opening}\n${priceLine}\n\n${link}`;
  
  return {
    text,
    requiresImage: false,
  };
}

/**
 * Gera copy para WhatsApp
 * - Similar ao Telegram
 * - Pode ser um pouco mais informal
 */
function buildWhatsAppCopy(offer: OfferInput, seed: number, baseUrl: string): CopyResult {
  const hasComparison = offer.originalPrice != null && Number(offer.originalPrice) > Number(offer.finalPrice);
  const opening = selectOpening(offer, seed, hasComparison);
  const priceLine = formatPriceLine(offer.originalPrice, offer.finalPrice, 'WHATSAPP');
  const link = getShortUrl(offer, baseUrl);
  
  const text = `${opening}\n${priceLine}\n\n${link}`;
  
  return {
    text,
    requiresImage: false,
  };
}

/**
 * Gera copy para Facebook
 * - Pode ser um pouco mais longo
 * - Com link no final
 */
function buildFacebookCopy(offer: OfferInput, seed: number, baseUrl: string): CopyResult {
  const hasComparison = offer.originalPrice != null && Number(offer.originalPrice) > Number(offer.finalPrice);
  const opening = selectOpening(offer, seed, hasComparison);
  const priceLine = formatPriceLine(offer.originalPrice, offer.finalPrice, 'FACEBOOK');
  const link = getShortUrl(offer, baseUrl);
  
  // Facebook permite mais contexto
  let text = `${opening}\n${priceLine}`;
  
  // Adicionar nome do produto se couber de forma natural
  if (offer.store && seed % 3 === 0) {
    text += `\n\nNa ${offer.store}.`;
  }
  
  text += `\n\n${link}`;
  
  return {
    text,
    requiresImage: false,
  };
}

/**
 * Gera copy para Site
 * - headline curta
 * - subcopy opcional
 * - SEM link no texto (o site usa botão)
 */
function buildSiteCopy(offer: OfferInput, seed: number): CopyResult {
  const hasComparison = offer.originalPrice != null && Number(offer.originalPrice) > Number(offer.finalPrice);
  
  // Headline - curta e direta
  const headlines = [
    `${getProductType(offer.title)} com desconto`,
    `Preço baixou`,
    `Vale a pena olhar`,
    `Achado do dia`,
    `Preço bom`,
    `Oferta boa`,
  ];
  
  const headline = hasComparison 
    ? headlines[seed % headlines.length]
    : 'Preço bom';
  
  // Subcopy - preço formatado
  const subcopy = hasComparison
    ? `De ${formatBRL(offer.originalPrice)} por ${formatBRL(offer.finalPrice)}`
    : formatBRL(offer.finalPrice);
  
  // Text principal (para cards expandidos)
  const opening = selectOpening(offer, seed, hasComparison);
  const priceLine = formatPriceLine(offer.originalPrice, offer.finalPrice, 'SITE');
  const text = `${opening}\n${priceLine}`;
  
  return {
    text,
    headline,
    subcopy,
    requiresImage: false,
  };
}

// ==================== MAIN FUNCTION ====================

/**
 * Gera copy para um canal específico
 * 
 * @param options - Opções de geração
 * @returns CopyResult com texto e metadados
 */
export function buildCopy(options: BuildCopyOptions): CopyResult {
  const { offer, channel, styleSeed, baseUrl } = options;
  
  // Seed para variação controlada
  // Se não fornecido, usa hash simples do ID da oferta
  const seed = styleSeed ?? simpleHash(offer.id);
  
  // URL base
  const url = baseUrl || process.env.SITE_BASE_URL || 'https://manupromocoes.com.br';
  
  switch (channel) {
    case 'TWITTER':
      return buildTwitterCopy(offer, seed, url);
    case 'TELEGRAM':
      return buildTelegramCopy(offer, seed, url);
    case 'WHATSAPP':
      return buildWhatsAppCopy(offer, seed, url);
    case 'FACEBOOK':
      return buildFacebookCopy(offer, seed, url);
    case 'SITE':
      return buildSiteCopy(offer, seed);
    default:
      return buildTelegramCopy(offer, seed, url);
  }
}

/**
 * Gera copies para múltiplos canais
 */
export function buildCopyForChannels(
  offer: OfferInput,
  channels: Channel[],
  options?: { styleSeed?: number; baseUrl?: string }
): Record<Channel, CopyResult> {
  const result: Partial<Record<Channel, CopyResult>> = {};
  
  for (const channel of channels) {
    result[channel] = buildCopy({
      offer,
      channel,
      styleSeed: options?.styleSeed,
      baseUrl: options?.baseUrl,
    });
  }
  
  return result as Record<Channel, CopyResult>;
}

/**
 * Valida se oferta pode ser enviada para um canal
 */
export function validateForChannel(offer: OfferInput, channel: Channel): { valid: boolean; error?: string } {
  if (channel === 'TWITTER' && !offer.imageUrl) {
    return { valid: false, error: 'SEM_IMAGEM_PARA_X' };
  }
  
  if (!offer.finalPrice) {
    return { valid: false, error: 'SEM_PRECO' };
  }
  
  return { valid: true };
}

// ==================== HELPERS ====================

/**
 * Hash simples para gerar seed a partir de string
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Gera seed baseado na data (para variar por dia/semana)
 */
export function getDateSeed(date?: Date): number {
  const d = date || new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Gera seed semanal (para rotação de templates)
 */
export function getWeekSeed(date?: Date): number {
  const d = date || new Date();
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.floor(days / 7);
}
