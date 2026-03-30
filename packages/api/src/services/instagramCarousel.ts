/**
 * Instagram Carousel Generator — Copy Viral + 3 Temas
 *
 * DARK   : Azul marinho escuro + âmbar
 * MEDIUM : Azul médio + dourado claro
 * LIGHT  : Branco/azul clarinho + acentos azul escuro
 *
 * Filosofia dos slides:
 *  Slide 1 — Para o scroll (headline agressiva)
 *  Slide 2 — Dor (você ia pagar quanto nisso?)
 *  Slide 3 — Ganho (+R$X no seu bolso)
 *  Slide 4 — Branding + CTA final (se sumir, não volta)
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
let createCanvas: typeof import('canvas').createCanvas;
// eslint-disable-next-line @typescript-eslint/no-var-requires
let loadImage: typeof import('canvas').loadImage;

try {
  const mod = require('canvas');
  createCanvas = mod.createCanvas;
  loadImage = mod.loadImage;
} catch (_e) { /* canvas não disponível */ }

import { uploadFromBuffer } from './cloudinary.js';

const W = 1080;
const H = 1080;

// ── Tipos de tema ──────────────────────────────────────────────────────────────

export type CarouselTheme = 'dark' | 'medium' | 'light';

export interface ThemeColors {
  bgFrom: string;
  bgTo: string;
  bgRadialFrom: string;
  bgRadialTo: string;
  accent: string;
  accentAlt: string;
  text: string;
  subText: string;
  divider: string;
  cardBg: string;
  badgeBg: string;
  badgeText: string;
  ctaBg1: string;
  ctaBg2: string;
  ctaText: string;
  savingBg: string;
  savingText: string;
  strikeFg: string;
  decorCircle: string;
}

export const THEMES: Record<CarouselTheme, ThemeColors> = {
  dark: {
    bgFrom:       '#1e3a8a',
    bgTo:         '#0f172a',
    bgRadialFrom: '#1e40af',
    bgRadialTo:   '#0f172a',
    accent:       '#f59e0b',
    accentAlt:    '#f97316',
    text:         '#ffffff',
    subText:      '#94a3b8',
    divider:      '#f59e0b',
    cardBg:       '#1e293b',
    badgeBg:      '#f59e0b',
    badgeText:    '#0f172a',
    ctaBg1:       '#f59e0b',
    ctaBg2:       '#f97316',
    ctaText:      '#0f172a',
    savingBg:     '#166534',
    savingText:   '#4ade80',
    strikeFg:     '#f87171',
    decorCircle:  'rgba(245,158,11,0.15)',
  },
  medium: {
    bgFrom:       '#1565c0',
    bgTo:         '#0d47a1',
    bgRadialFrom: '#1976d2',
    bgRadialTo:   '#0d47a1',
    accent:       '#ffd54f',
    accentAlt:    '#ffb300',
    text:         '#ffffff',
    subText:      '#bbdefb',
    divider:      '#ffd54f',
    cardBg:       '#1a237e',
    badgeBg:      '#ffd54f',
    badgeText:    '#0d47a1',
    ctaBg1:       '#ffd54f',
    ctaBg2:       '#ffb300',
    ctaText:      '#0d47a1',
    savingBg:     '#2e7d32',
    savingText:   '#a5d6a7',
    strikeFg:     '#ef9a9a',
    decorCircle:  'rgba(255,213,79,0.15)',
  },
  light: {
    bgFrom:       '#e3f2fd',
    bgTo:         '#ffffff',
    bgRadialFrom: '#bbdefb',
    bgRadialTo:   '#ffffff',
    accent:       '#1565c0',
    accentAlt:    '#1976d2',
    text:         '#0d47a1',
    subText:      '#546e7a',
    divider:      '#1565c0',
    cardBg:       '#f0f4f8',
    badgeBg:      '#1565c0',
    badgeText:    '#ffffff',
    ctaBg1:       '#1565c0',
    ctaBg2:       '#1976d2',
    ctaText:      '#ffffff',
    savingBg:     '#e8f5e9',
    savingText:   '#2e7d32',
    strikeFg:     '#e53935',
    decorCircle:  'rgba(21,101,192,0.10)',
  },
};

// ── Interfaces ─────────────────────────────────────────────────────────────────

export interface CarouselInput {
  title: string;
  finalPrice: number;
  originalPrice?: number | null;
  discountPct?: number | null;
  imageUrl?: string | null;
  installments?: number | null;
  installmentValue?: number | null;
  paymentMethod?: 'pix' | 'parcelado' | 'normal' | null;
  affiliateUrl?: string;
  offerId?: string;
  theme?: CarouselTheme;
}

export interface CarouselResult {
  success: boolean;
  slideUrls?: string[];
  error?: string;
}

// ── Copy Viral Dinâmico ────────────────────────────────────────────────────────

function detectCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('tv') || t.includes('televisão') || t.includes('smart tv')) return 'TV';
  if (t.includes('celular') || t.includes('smartphone') || t.includes('iphone') || t.includes('samsung')) return 'CELULAR';
  if (t.includes('notebook') || t.includes('laptop')) return 'NOTEBOOK';
  if (t.includes('tablet') || t.includes('ipad')) return 'TABLET';
  if (t.includes('fone') || t.includes('headphone') || t.includes('earphone') || t.includes('airpod')) return 'FONE';
  if (t.includes('câmera') || t.includes('camera') || t.includes('gopro')) return 'CÂMERA';
  if (t.includes('geladeira') || t.includes('fogão') || t.includes('máquina de lavar') || t.includes('microondas')) return 'ELETRODOMÉSTICO';
  if (t.includes('ar condicionado') || t.includes('ventilador')) return 'APARELHO';
  if (t.includes('console') || t.includes('playstation') || t.includes('xbox') || t.includes('nintendo')) return 'CONSOLE';
  if (t.includes('cadeira') || t.includes('sofá') || t.includes('mesa')) return 'MÓVEL';
  return 'PRODUTO';
}

function getViralHook(title: string, discountPct: number | null | undefined, finalPrice: number): { headline: string; sub: string } {
  const pct = discountPct ?? 0;
  const category = detectCategory(title);

  if (pct >= 55) {
    return { headline: 'ISSO NÃO DEVIA ESTAR ESSE PREÇO 🤯', sub: `${pct}% OFF agora` };
  }
  if (pct >= 40) {
    return { headline: 'NÃO ERA PRA ESTAR ESSE PREÇO... 😳', sub: `${pct}% de desconto real` };
  }
  if (pct >= 30) {
    return { headline: `ESSA ${category} DESPENCOU DE PREÇO 🔥`, sub: `${pct}% OFF hoje` };
  }
  if (pct >= 20) {
    return { headline: 'ERRO DE PREÇO? ACHEI ANTES DE SUMIR 👇', sub: `${pct}% abaixo do normal` };
  }
  if (pct >= 10) {
    return { headline: 'MENOR PREÇO QUE ENCONTREI 👀', sub: `Oferta por tempo limitado` };
  }
  // Sem desconto — foca em urgência e descoberta
  const thousands = Math.floor(finalPrice / 1000);
  if (thousands >= 1) {
    return { headline: `${category} POR MENOS DE ${thousands + 1} MIL 😳`, sub: 'Não vai durar muito' };
  }
  const noDiscountHooks = [
    { headline: 'ACHEI ISSO E PRECISEI COMPARTILHAR 😱', sub: 'Preço que não espera' },
    { headline: 'ESSE PREÇO TÁ ABSURDO 🤯', sub: 'Corre antes de sumir' },
    { headline: 'OLHA SÓ O QUE EU ENCONTREI 👀', sub: 'Oferta por tempo limitado' },
    { headline: 'NÃO ERA PRA ESTAR ESSE PREÇO... 😳', sub: 'Aproveita agora' },
  ];
  return noDiscountHooks[Math.floor(finalPrice * 10) % noDiscountHooks.length];
}

function getPriceShock(finalPrice: number, originalPrice: number | null | undefined, discountPct: number | null | undefined): string {
  const pct = discountPct ?? 0;
  if (originalPrice && originalPrice > finalPrice) {
    if (pct >= 30) {
      return `DE ${formatBRL(originalPrice)} → ${formatBRL(finalPrice)} 🤯`;
    }
    return `DE ${formatBRL(originalPrice)} POR ${formatBRL(finalPrice)}`;
  }
  // Sem preço original — tenta round number hook
  const thousands = Math.floor(finalPrice / 1000);
  if (thousands >= 1 && finalPrice < (thousands + 1) * 1000) {
    return `POR MENOS DE ${thousands + 1} MIL 😳`;
  }
  return `APENAS ${formatBRL(finalPrice)}`;
}

function getPainLine(originalPrice: number | null | undefined): string {
  if (!originalPrice) return 'Você ia pagar quanto nisso?';
  return `Você ia pagar ${formatBRL(originalPrice)} nisso?`;
}

function getSavingsHook(saving: number, finalPrice: number): { main: string; sub: string } {
  const pct = Math.round((saving / (saving + finalPrice)) * 100);
  if (saving >= 2000) {
    return { main: `+${formatBRL(saving)} NO SEU BOLSO 💰`, sub: 'Isso paga MUITA coisa' };
  }
  if (saving >= 500) {
    return { main: `+${formatBRL(saving)} NO SEU BOLSO 💰`, sub: 'Isso paga outra compra 😳' };
  }
  if (pct >= 30) {
    return { main: `VOCÊ ECONOMIZA ${pct}% 💸`, sub: `${formatBRL(saving)} de volta no bolso` };
  }
  return { main: `ECONOMIZE ${formatBRL(saving)} 💸`, sub: `${pct}% abaixo do preço normal` };
}

const CTAS_URGENCY = [
  'CORRE NA BIO ANTES QUE ACABE ⚠️',
  'JÁ TEM GENTE COMPRANDO 👇',
  'LINK NA BIO — NÃO DEMORA ⏳',
  'CORRE QUE TÁ ACABANDO 🔥',
];

function getUrgencyCTA(finalPrice: number): string {
  // Usa o preço para variar o CTA de forma determinística
  return CTAS_URGENCY[Math.floor(finalPrice) % CTAS_URGENCY.length];
}

// ── Helpers de desenho ─────────────────────────────────────────────────────────

export function isCanvasAvailable(): boolean { return !!createCanvas; }

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
  });
}

function drawBg(ctx: any, c: ThemeColors) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, c.bgFrom);
  grad.addColorStop(1, c.bgTo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBadge(
  ctx: any, text: string, x: number, y: number,
  bgColor: string, textColor: string,
  fontSize = 32, paddingX = 24, paddingY = 14, radius = 16,
) {
  ctx.font = `bold ${fontSize}px sans-serif`;
  const textW = ctx.measureText(text).width;
  const bW = textW + paddingX * 2;
  const bH = fontSize + paddingY * 2;
  ctx.fillStyle = bgColor;
  roundRect(ctx, x - bW / 2, y - bH / 2, bW, bH, radius);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function wrapText(ctx: any, text: string, maxWidth: number, font: string): string[] {
  ctx.font = font;
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawManuBrand(ctx: any, y: number, c: ThemeColors) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = c.accent;
  ctx.fillText('🛍️ Manu das Promoções', W / 2, y);
  ctx.font = '22px sans-serif';
  ctx.fillStyle = c.subText;
  ctx.fillText('manu-promocoes.com.br', W / 2, y + 40);
}

function drawDivider(ctx: any, y: number, c: ThemeColors) {
  const grad = ctx.createLinearGradient(80, y, W - 80, y);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.3, c.divider);
  grad.addColorStop(0.7, c.divider);
  grad.addColorStop(1, 'transparent');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, y);
  ctx.lineTo(W - 80, y);
  ctx.stroke();
}

// ── SLIDE 1: Para o scroll ─────────────────────────────────────────────────────
// Regra: Slide 1 não vende — Slide 1 FAZ PARAR

async function generateSlide1(input: CarouselInput, c: ThemeColors): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;
  drawBg(ctx, c);

  const hook = getViralHook(input.title, input.discountPct, input.finalPrice);
  const priceShock = getPriceShock(input.finalPrice, input.originalPrice, input.discountPct);

  // ── Imagem do produto (área central) ──────────────────────────────────────
  const imgSize = 460;
  const imgX = (W - imgSize) / 2;
  const imgY = 200;

  if (input.imageUrl) {
    try {
      const img = await loadImage(input.imageUrl);
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, imgX, imgY, imgSize, imgSize, 28);
      ctx.fill();
      ctx.save();
      roundRect(ctx, imgX, imgY, imgSize, imgSize, 28);
      ctx.clip();
      const ratio = Math.min(imgSize / img.width, imgSize / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.drawImage(img, imgX + (imgSize - dw) / 2, imgY + (imgSize - dh) / 2, dw, dh);
      ctx.restore();
    } catch {
      ctx.fillStyle = c.cardBg;
      roundRect(ctx, imgX, imgY, imgSize, imgSize, 28);
      ctx.fill();
      ctx.font = '80px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛍️', W / 2, imgY + imgSize / 2);
    }
  } else {
    ctx.fillStyle = c.cardBg;
    roundRect(ctx, imgX, imgY, imgSize, imgSize, 28);
    ctx.fill();
    ctx.font = '80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛍️', W / 2, imgY + imgSize / 2);
  }

  // Badge de desconto (canto superior direito da imagem)
  if (input.discountPct && input.discountPct > 0) {
    const bx = imgX + imgSize;
    const by = imgY;
    const bSize = 120;
    const discGrad = ctx.createRadialGradient(bx - bSize / 2, by + bSize / 2, 10, bx - bSize / 2, by + bSize / 2, bSize / 2);
    discGrad.addColorStop(0, c.accentAlt);
    discGrad.addColorStop(1, c.strikeFg);
    ctx.fillStyle = discGrad;
    ctx.beginPath();
    ctx.arc(bx - bSize / 2, by + bSize / 2, bSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(`-${input.discountPct}%`, bx - bSize / 2, by + bSize / 2 - 12);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('OFF', bx - bSize / 2, by + bSize / 2 + 24);
  }

  // ── Headline viral (TOPO — antes da imagem) ────────────────────────────────
  const headlineFont = 'bold 52px sans-serif';
  const headlineLines = wrapText(ctx, hook.headline, W - 80, headlineFont);
  const displayHeadlineLines = headlineLines.slice(0, 2);
  const headlineH = displayHeadlineLines.length * 64;
  const headlineY = (imgY - headlineH) / 2 + 20;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = c.text;
  ctx.font = headlineFont;
  displayHeadlineLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, headlineY + i * 64);
  });

  // Sub-headline
  ctx.font = '32px sans-serif';
  ctx.fillStyle = c.subText;
  ctx.fillText(hook.sub, W / 2, headlineY + displayHeadlineLines.length * 64 + 10);

  // ── Price shock (ABAIXO DA IMAGEM) ─────────────────────────────────────────
  const priceY = imgY + imgSize + 52;
  const priceShockFont = 'bold 54px sans-serif';
  const priceShockLines = wrapText(ctx, priceShock, W - 80, priceShockFont);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = c.accent;
  ctx.font = priceShockFont;
  priceShockLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, W / 2, priceY + i * 64);
  });

  // Swipe hint
  ctx.font = '26px sans-serif';
  ctx.fillStyle = c.subText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Deslize para ver mais  →', W / 2, H - 30);

  return canvas.toBuffer('image/jpeg', { quality: 0.97 });
}

// ── SLIDE 2: Dor — comparação de preço ou valor ───────────────────────────────

async function generateSlide2(input: CarouselInput, c: ThemeColors): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;
  drawBg(ctx, c);

  const hasDiscount = input.originalPrice && input.originalPrice > input.finalPrice;

  if (hasDiscount) {
    // ── COM DESCONTO: Dor + preço antigo riscado em vermelho ────────────────

    // Decoração circular sutil
    ctx.fillStyle = c.decorCircle;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 200 + i * 100, 0, Math.PI * 2);
      ctx.fill();
    }

    // Emoji de choque
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '88px sans-serif';
    ctx.fillText('😳', W / 2, 105);

    // Linha de dor
    const painLine = getPainLine(input.originalPrice);
    const painFont = 'bold 52px sans-serif';
    const painLines = wrapText(ctx, painLine, W - 100, painFont);
    ctx.font = painFont;
    ctx.fillStyle = c.text;
    painLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, W / 2, 210 + i * 64);
    });

    drawDivider(ctx, 320, c);

    // Preço antigo — grande, riscado em vermelho
    ctx.font = 'bold 80px sans-serif';
    ctx.fillStyle = c.subText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const oldText = formatBRL(input.originalPrice!);
    ctx.fillText(oldText, W / 2, 415);
    const oldW = ctx.measureText(oldText).width;
    ctx.strokeStyle = c.strikeFg;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(W / 2 - oldW / 2 - 10, 415);
    ctx.lineTo(W / 2 + oldW / 2 + 10, 415);
    ctx.stroke();

    // Badge % desconto ao lado do preço
    if (input.discountPct && input.discountPct > 0) {
      drawBadge(ctx, `-${input.discountPct}%`, W / 2 + oldW / 2 + 70, 415, c.strikeFg, '#ffffff', 28, 16, 10, 12);
    }

    // Seta
    ctx.font = '60px sans-serif';
    ctx.fillStyle = c.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↓', W / 2, 510);

    // Resposta
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = c.subText;
    ctx.fillText('Achou errado? Não.', W / 2, 583);

    drawDivider(ctx, 640, c);

    // Preço final — grande, destaque
    ctx.font = 'bold 100px sans-serif';
    ctx.fillStyle = c.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatBRL(input.finalPrice), W / 2, 745);

    // Forma de pagamento
    if (input.paymentMethod === 'pix') {
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = c.text;
      ctx.fillText('💳 NO PIX', W / 2, 835);
    } else if (input.paymentMethod === 'parcelado' && input.installments) {
      const installVal = input.installmentValue ?? (input.finalPrice / input.installments);
      ctx.font = 'bold 34px sans-serif';
      ctx.fillStyle = c.text;
      ctx.fillText(`💳 ${input.installments}x de ${formatBRL(installVal)} sem juros`, W / 2, 835);
    }

  } else {
    // ── SEM DESCONTO: foca no produto + preço impactante ────────────────────

    // Emoji
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '88px sans-serif';
    ctx.fillText('🔥', W / 2, 120);

    ctx.font = 'bold 50px sans-serif';
    ctx.fillStyle = c.text;
    ctx.fillText('Confira o preço!', W / 2, 220);

    drawDivider(ctx, 290, c);

    // Nome do produto (resumido, 2 linhas)
    const titleFont = 'bold 42px sans-serif';
    const titleLines = wrapText(ctx, input.title, W - 120, titleFont);
    ctx.font = titleFont;
    ctx.fillStyle = c.subText;
    titleLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, W / 2, 380 + i * 56);
    });

    drawDivider(ctx, 510, c);

    // "Por apenas"
    ctx.font = '38px sans-serif';
    ctx.fillStyle = c.subText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('por apenas', W / 2, 580);

    // Preço — destaque máximo
    ctx.font = 'bold 100px sans-serif';
    ctx.fillStyle = c.accent;
    ctx.fillText(formatBRL(input.finalPrice), W / 2, 690);

    // Forma de pagamento
    if (input.paymentMethod === 'pix') {
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = c.text;
      ctx.fillText('💳 NO PIX', W / 2, 790);
    } else if (input.paymentMethod === 'parcelado' && input.installments) {
      const installVal = input.installmentValue ?? (input.finalPrice / input.installments);
      ctx.font = 'bold 34px sans-serif';
      ctx.fillStyle = c.text;
      ctx.fillText(`💳 ${input.installments}x de ${formatBRL(installVal)} sem juros`, W / 2, 790);
    }

    drawManuBrand(ctx, 920, c);
  }

  // Swipe hint (comum a ambos os casos)
  ctx.font = '26px sans-serif';
  ctx.fillStyle = c.subText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Deslize para ver mais  →', W / 2, H - 30);

  return canvas.toBuffer('image/jpeg', { quality: 0.97 });
}

// ── SLIDE 3: Ganho + Urgência ──────────────────────────────────────────────────
// "+R$X NO SEU BOLSO" + CTA agressivo

async function generateSlide3(input: CarouselInput, c: ThemeColors): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;
  drawBg(ctx, c);

  const saving = (input.originalPrice && input.originalPrice > input.finalPrice)
    ? input.originalPrice - input.finalPrice
    : null;

  // Ícone de dinheiro
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '96px sans-serif';
  ctx.fillText('💸', W / 2, 120);

  // ── Bloco de economia (se tiver) ──────────────────────────────────────────
  if (saving && saving > 0) {
    const savingsHook = getSavingsHook(saving, input.finalPrice);

    const mainFont = 'bold 62px sans-serif';
    const mainLines = wrapText(ctx, savingsHook.main, W - 80, mainFont);
    ctx.font = mainFont;
    ctx.fillStyle = c.accent;
    mainLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, W / 2, 240 + i * 76);
    });

    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = c.text;
    ctx.fillText(savingsHook.sub, W / 2, 240 + mainLines.slice(0, 2).length * 76 + 20);
  } else {
    // Sem saving — foca no preço final
    ctx.font = 'bold 54px sans-serif';
    ctx.fillStyle = c.accent;
    ctx.fillText('OFERTA POR TEMPO LIMITADO ⚡', W / 2, 240);
    ctx.font = 'bold 88px sans-serif';
    ctx.fillStyle = c.text;
    ctx.fillText(formatBRL(input.finalPrice), W / 2, 350);
  }

  drawDivider(ctx, 500, c);

  // Preço resumido
  ctx.font = 'bold 64px sans-serif';
  ctx.fillStyle = c.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatBRL(input.finalPrice), W / 2, 585);

  if (input.discountPct && input.discountPct > 0) {
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = c.accentAlt;
    ctx.fillText(`-${input.discountPct}% de desconto real`, W / 2, 660);
  }

  drawDivider(ctx, 730, c);

  // ── CTA AGRESSIVO ──────────────────────────────────────────────────────────
  const ctaText = getUrgencyCTA(input.finalPrice);
  const ctaY = 800;
  const ctaW = 900;
  const ctaH = 100;
  const ctaX = (W - ctaW) / 2;
  const ctaGrad = ctx.createLinearGradient(ctaX, ctaY, ctaX + ctaW, ctaY);
  ctaGrad.addColorStop(0, c.ctaBg1);
  ctaGrad.addColorStop(1, c.ctaBg2);
  ctx.fillStyle = ctaGrad;
  roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 24);
  ctx.fill();

  const ctaFont = 'bold 42px sans-serif';
  const ctaLines = wrapText(ctx, ctaText, ctaW - 40, ctaFont);
  ctx.font = ctaFont;
  ctx.fillStyle = c.ctaText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (ctaLines.length > 1) {
    ctaLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, W / 2, ctaY + 30 + i * 46);
    });
  } else {
    ctx.fillText(ctaLines[0] || ctaText, W / 2, ctaY + ctaH / 2);
  }

  // Linha "SE SUMIR, NÃO VOLTA" abaixo do CTA
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = c.strikeFg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚠️  SE SUMIR, NÃO VOLTA', W / 2, 940);

  return canvas.toBuffer('image/jpeg', { quality: 0.97 });
}

// ── SLIDE 4: Branding Manu + CTA Final ────────────────────────────────────────

async function generateSlide4(input: CarouselInput, c: ThemeColors): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;

  const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 700);
  bgGrad.addColorStop(0, c.bgRadialFrom);
  bgGrad.addColorStop(1, c.bgRadialTo);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Círculos decorativos
  ctx.strokeStyle = c.decorCircle;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 200 + i * 80, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Avatar da Manu
  const avatarSize = 200;
  const avatarX = W / 2 - avatarSize / 2;
  const avatarY = 160;

  try {
    const avatarImg = await loadImage('https://www.manu-promocoes.com.br/manu-avatar.png');
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(W / 2, avatarY + avatarSize / 2, avatarSize / 2 + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch {
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(W / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${avatarSize * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛍️', W / 2, avatarY + avatarSize / 2);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillStyle = c.text;
  ctx.fillText('Manu das Promoções', W / 2, 460);

  ctx.font = '32px sans-serif';
  ctx.fillStyle = c.subText;
  ctx.fillText('As melhores ofertas do Brasil', W / 2, 520);

  drawDivider(ctx, 580, c);

  // Redes sociais
  const socials = [
    { icon: '📸', label: '@manupromocao' },
    { icon: '✈️', label: 't.me/manupromocao' },
    { icon: '🌐', label: 'manu-promocoes.com.br' },
  ];
  socials.forEach((s, i) => {
    ctx.font = '32px sans-serif';
    ctx.fillStyle = c.subText;
    ctx.textAlign = 'center';
    ctx.fillText(`${s.icon}  ${s.label}`, W / 2, 650 + i * 62);
  });

  drawDivider(ctx, 860, c);

  // CTA final — 2 linhas de urgência
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = c.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔗 Link na bio para pegar a oferta', W / 2, 910);

  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = c.strikeFg;
  ctx.fillText('⏰ SE SUMIR, NÃO VOLTA', W / 2, 962);

  drawManuBrand(ctx, 1018, c);

  return canvas.toBuffer('image/jpeg', { quality: 0.97 });
}

// ── EXPORTAÇÃO PRINCIPAL ───────────────────────────────────────────────────────

export async function generateCarousel(input: CarouselInput): Promise<CarouselResult> {
  if (!isCanvasAvailable()) {
    return { success: false, error: 'canvas não disponível neste ambiente' };
  }

  try {
    const theme = input.theme || 'dark';
    const c = THEMES[theme];
    console.log(`[Carousel] Gerando slides — tema: ${theme} — produto: ${input.title.slice(0, 60)}`);

    const [buf1, buf2, buf3, buf4] = await Promise.all([
      generateSlide1(input, c),
      generateSlide2(input, c),
      generateSlide3(input, c),
      generateSlide4(input, c),
    ]);

    const folder = 'promo-platform/carousels';
    const ts = Date.now();
    const id = input.offerId || ts;

    const uploadOpts = (slide: number) => ({
      folder,
      publicId: `${id}_${theme}_slide${slide}`,
      tags: ['carousel', 'instagram', theme],
    });

    const uploads = await Promise.all([
      uploadFromBuffer(buf1, uploadOpts(1)),
      uploadFromBuffer(buf2, uploadOpts(2)),
      uploadFromBuffer(buf3, uploadOpts(3)),
      uploadFromBuffer(buf4, uploadOpts(4)),
    ]);

    const failed = uploads.find(u => !u.success);
    if (failed) return { success: false, error: `Falha no upload: ${failed.error}` };

    const slideUrls = uploads.map(u => u.url!);
    console.log(`[Carousel] ✅ ${slideUrls.length} slides (tema ${theme}) enviados ao Cloudinary`);
    return { success: true, slideUrls };
  } catch (err: any) {
    console.error('[Carousel] Erro:', err.message);
    return { success: false, error: err.message };
  }
}
