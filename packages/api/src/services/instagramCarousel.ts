/**
 * Instagram Carousel Generator — 3 temas
 *
 * DARK   : Azul marinho escuro + âmbar (original)
 * MEDIUM : Azul médio + branco + dourado claro
 * LIGHT  : Fundo branco/azul clarinho + acentos azul escuro
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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── SLIDE 1: Produto + Desconto ───────────────────────────────────────────────

async function generateSlide1(input: CarouselInput, c: ThemeColors): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;
  drawBg(ctx, c);

  const imgSize = 520;
  const imgX = (W - imgSize) / 2;
  const imgY = 140;

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

  if (input.discountPct && input.discountPct > 0) {
    const bx = imgX + imgSize - 10;
    const by = imgY + 10;
    const bSize = 110;
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
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`-${input.discountPct}%`, bx - bSize / 2, by + bSize / 2 - 10);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('OFF', bx - bSize / 2, by + bSize / 2 + 22);
  }

  drawBadge(ctx, '🔥 OFERTA DO DIA', W / 2, 68, c.badgeBg, c.badgeText, 30, 28, 16, 20);

  const titleY = imgY + imgSize + 48;
  const titleFont = 'bold 44px sans-serif';
  const titleLines = wrapText(ctx, input.title, W - 120, titleFont);
  const displayLines = titleLines.slice(0, 2);
  if (titleLines.length > 2) displayLines[1] = displayLines[1].replace(/\s+\S+$/, '…');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = c.text;
  ctx.font = titleFont;
  displayLines.forEach((line, i) => { ctx.fillText(line, W / 2, titleY + i * 54); });

  const priceY = titleY + displayLines.length * 54 + 32;
  ctx.font = 'bold 72px sans-serif';
  ctx.fillStyle = c.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(formatBRL(input.finalPrice), W / 2, priceY);

  ctx.font = '26px sans-serif';
  ctx.fillStyle = c.subText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Deslize para ver mais  →', W / 2, H - 30);

  return canvas.toBuffer('image/jpeg', { quality: 0.92 });
}

// ── SLIDE 2: Preços e Economia ─────────────────────────────────────────────────

async function generateSlide2(input: CarouselInput, c: ThemeColors): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;
  drawBg(ctx, c);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '80px sans-serif';
  ctx.fillText('💰', W / 2, 120);

  ctx.font = 'bold 48px sans-serif';
  ctx.fillStyle = c.text;
  ctx.fillText('Confira o preço!', W / 2, 210);

  drawDivider(ctx, 270, c);

  if (input.originalPrice && input.originalPrice > input.finalPrice) {
    ctx.font = '44px sans-serif';
    ctx.fillStyle = c.subText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const oldText = `De ${formatBRL(input.originalPrice)}`;
    ctx.fillText(oldText, W / 2, 350);
    const oldW = ctx.measureText(oldText).width;
    ctx.strokeStyle = c.strikeFg;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 - oldW / 2, 350);
    ctx.lineTo(W / 2 + oldW / 2, 350);
    ctx.stroke();
  }

  ctx.font = '36px sans-serif';
  ctx.fillStyle = c.subText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('por apenas', W / 2, 430);

  ctx.font = 'bold 900 96px sans-serif';
  ctx.fillStyle = c.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatBRL(input.finalPrice), W / 2, 545);

  if (input.originalPrice && input.originalPrice > input.finalPrice) {
    const saving = input.originalPrice - input.finalPrice;
    drawBadge(ctx, `✅ Você economiza ${formatBRL(saving)}`, W / 2, 650, c.savingBg, c.savingText, 30, 28, 16, 20);
  }

  drawDivider(ctx, 720, c);

  if (input.paymentMethod === 'pix') {
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = c.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💳 NO PIX', W / 2, 810);
  } else if (input.paymentMethod === 'parcelado' && input.installments) {
    const installVal = input.installmentValue ?? (input.finalPrice / input.installments);
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = c.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`💳 ${input.installments}x de ${formatBRL(installVal)} sem juros`, W / 2, 810);
  }

  drawManuBrand(ctx, 950, c);

  ctx.font = '26px sans-serif';
  ctx.fillStyle = c.subText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Deslize para ver mais  →', W / 2, H - 30);

  return canvas.toBuffer('image/jpeg', { quality: 0.92 });
}

// ── SLIDE 3: CTA + Urgência ────────────────────────────────────────────────────

async function generateSlide3(input: CarouselInput, c: ThemeColors): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;
  drawBg(ctx, c);

  // Pontos decorativos
  ctx.fillStyle = 'rgba(128,128,128,0.05)';
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      ctx.beginPath();
      ctx.arc(col * 120 + 60, row * 120 + 60, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '100px sans-serif';
  ctx.fillText('⚡', W / 2, 160);

  ctx.font = 'bold 60px sans-serif';
  ctx.fillStyle = c.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CORRE!', W / 2, 280);

  ctx.font = 'bold 42px sans-serif';
  ctx.fillStyle = c.text;
  ctx.fillText('Oferta por tempo', W / 2, 370);
  ctx.fillText('limitado! 🔥', W / 2, 430);

  drawDivider(ctx, 500, c);

  ctx.font = 'bold 52px sans-serif';
  ctx.fillStyle = c.accent;
  ctx.fillText(formatBRL(input.finalPrice), W / 2, 590);

  if (input.discountPct && input.discountPct > 0) {
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = c.accentAlt;
    ctx.fillText(`-${input.discountPct}% de desconto`, W / 2, 660);
  }

  drawDivider(ctx, 730, c);

  const ctaY = 790;
  const ctaW = 680;
  const ctaH = 90;
  const ctaX = (W - ctaW) / 2;
  const ctaGrad = ctx.createLinearGradient(ctaX, ctaY, ctaX + ctaW, ctaY);
  ctaGrad.addColorStop(0, c.ctaBg1);
  ctaGrad.addColorStop(1, c.ctaBg2);
  ctx.fillStyle = ctaGrad;
  roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 20);
  ctx.fill();

  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = c.ctaText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔗 LINK NA BIO  →', W / 2, ctaY + ctaH / 2);

  drawManuBrand(ctx, 960, c);

  return canvas.toBuffer('image/jpeg', { quality: 0.92 });
}

// ── SLIDE 4: Branding Manu ─────────────────────────────────────────────────────

async function generateSlide4(input: CarouselInput, c: ThemeColors): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;

  const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 700);
  bgGrad.addColorStop(0, c.bgRadialFrom);
  bgGrad.addColorStop(1, c.bgRadialTo);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = c.decorCircle;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 200 + i * 80, 0, Math.PI * 2);
    ctx.stroke();
  }

  const avatarSize = 220;
  const avatarX = W / 2 - avatarSize / 2;
  const avatarY = 180;

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
  ctx.font = 'bold 56px sans-serif';
  ctx.fillStyle = c.text;
  ctx.fillText('Manu das Promoções', W / 2, 480);

  ctx.font = '36px sans-serif';
  ctx.fillStyle = c.subText;
  ctx.fillText('As melhores ofertas do Brasil', W / 2, 548);

  drawDivider(ctx, 610, c);

  const socials = [
    { icon: '📸', label: '@manupromocao' },
    { icon: '✈️', label: 't.me/manupromocao' },
    { icon: '🌐', label: 'manu-promocoes.com.br' },
  ];
  socials.forEach((s, i) => {
    const y = 680 + i * 70;
    ctx.font = '34px sans-serif';
    ctx.fillStyle = c.subText;
    ctx.textAlign = 'center';
    ctx.fillText(`${s.icon}  ${s.label}`, W / 2, y);
  });

  drawBadge(ctx, '🔥 Siga para não perder nenhuma oferta!', W / 2, 930, c.badgeBg, c.badgeText, 28, 24, 14, 18);

  return canvas.toBuffer('image/jpeg', { quality: 0.92 });
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

    const uploads = await Promise.all([
      uploadFromBuffer(buf1, { folder, publicId: `${id}_${theme}_slide1`, tags: ['carousel', 'instagram', theme] }),
      uploadFromBuffer(buf2, { folder, publicId: `${id}_${theme}_slide2`, tags: ['carousel', 'instagram', theme] }),
      uploadFromBuffer(buf3, { folder, publicId: `${id}_${theme}_slide3`, tags: ['carousel', 'instagram', theme] }),
      uploadFromBuffer(buf4, { folder, publicId: `${id}_${theme}_slide4`, tags: ['carousel', 'instagram', theme] }),
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
