/**
 * Instagram Carousel Generator
 *
 * Gera slides 1080×1080 px usando `canvas` e faz upload no Cloudinary.
 * Paleta oficial da Manu das Promoções:
 *   - Fundo:   gradiente azul #1e3a8a → #0f172a
 *   - Destaque: âmbar #f59e0b / laranja #f97316
 *   - Texto:   branco #ffffff
 *   - Preço antigo: cinza #94a3b8
 *   - Verde economia: #4ade80
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
let createCanvas: typeof import('canvas').createCanvas;
// eslint-disable-next-line @typescript-eslint/no-var-requires
let loadImage: typeof import('canvas').loadImage;

try {
  const mod = require('canvas');
  createCanvas = mod.createCanvas;
  loadImage = mod.loadImage;
} catch (_e) {
  /* canvas não disponível */
}

import { uploadFromBuffer } from './cloudinary.js';

// ── Dimensões ──────────────────────────────────────────────────────────────────
const W = 1080;
const H = 1080;

// ── Paleta Manu ──────────────────────────────────────────────────────────────────
const COLORS = {
  bg1: '#1e3a8a',       // azul marinho
  bg2: '#0f172a',       // quase preto
  accent: '#f59e0b',    // âmbar
  accentOrange: '#f97316',
  white: '#ffffff',
  grayText: '#94a3b8',
  green: '#4ade80',
  red: '#f87171',
  badgeBg: '#f97316',
  badgeText: '#ffffff',
  overlayDark: 'rgba(0,0,0,0.55)',
};

// ── Tipografia ───────────────────────────────────────────────────────────────────
const FONT = {
  black:  'bold 900 72px sans-serif',
  bold:   'bold 56px sans-serif',
  semiBold: 'bold 40px sans-serif',
  medium: '36px sans-serif',
  small:  '28px sans-serif',
  tiny:   '22px sans-serif',
};

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
}

export interface CarouselResult {
  success: boolean;
  slideUrls?: string[];
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────────

function isCanvasAvailable(): boolean {
  return !!createCanvas;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
  });
}

function drawBg(ctx: any) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, COLORS.bg1);
  grad.addColorStop(1, COLORS.bg2);
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
  ctx: any,
  text: string,
  x: number,
  y: number,
  bgColor = COLORS.badgeBg,
  textColor = COLORS.badgeText,
  fontSize = 32,
  paddingX = 24,
  paddingY = 14,
  radius = 16,
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

function drawManuBrand(ctx: any, y: number) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 28px sans-serif`;
  ctx.fillStyle = COLORS.accent;
  ctx.fillText('🛍️ Manu das Promoções', W / 2, y);
  ctx.font = `22px sans-serif`;
  ctx.fillStyle = COLORS.grayText;
  ctx.fillText('manu-promocoes.com.br', W / 2, y + 40);
}

function drawDivider(ctx: any, y: number) {
  const grad = ctx.createLinearGradient(80, y, W - 80, y);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.3, COLORS.accent);
  grad.addColorStop(0.7, COLORS.accent);
  grad.addColorStop(1, 'transparent');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, y);
  ctx.lineTo(W - 80, y);
  ctx.stroke();
}

// ── SLIDE 1: Produto + Desconto ───────────────────────────────────────────────────

async function generateSlide1(input: CarouselInput): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;

  drawBg(ctx);

  // Área da imagem do produto (central, grande)
  const imgSize = 520;
  const imgX = (W - imgSize) / 2;
  const imgY = 140;

  if (input.imageUrl) {
    try {
      const img = await loadImage(input.imageUrl);
      // Fundo branco arredondado para a imagem
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, imgX, imgY, imgSize, imgSize, 28);
      ctx.fill();

      // Clip na imagem
      ctx.save();
      roundRect(ctx, imgX, imgY, imgSize, imgSize, 28);
      ctx.clip();
      const ratio = Math.min(imgSize / img.width, imgSize / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.drawImage(img, imgX + (imgSize - dw) / 2, imgY + (imgSize - dh) / 2, dw, dh);
      ctx.restore();
    } catch {
      ctx.fillStyle = '#1e293b';
      roundRect(ctx, imgX, imgY, imgSize, imgSize, 28);
      ctx.fill();
      ctx.font = '80px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛍️', W / 2, imgY + imgSize / 2);
    }
  } else {
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, imgX, imgY, imgSize, imgSize, 28);
    ctx.fill();
    ctx.font = '80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛍️', W / 2, imgY + imgSize / 2);
  }

  // Badge de desconto (canto superior direito da imagem)
  if (input.discountPct && input.discountPct > 0) {
    const bx = imgX + imgSize - 10;
    const by = imgY + 10;
    const bSize = 110;
    // Círculo
    const discGrad = ctx.createRadialGradient(bx - bSize / 2, by + bSize / 2, 10, bx - bSize / 2, by + bSize / 2, bSize / 2);
    discGrad.addColorStop(0, '#f97316');
    discGrad.addColorStop(1, '#dc2626');
    ctx.fillStyle = discGrad;
    ctx.beginPath();
    ctx.arc(bx - bSize / 2, by + bSize / 2, bSize / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`-${input.discountPct}%`, bx - bSize / 2, by + bSize / 2 - 10);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('OFF', bx - bSize / 2, by + bSize / 2 + 22);
  }

  // Tag "🔥 OFERTA" no topo
  const tagY = 68;
  drawBadge(ctx, '🔥 OFERTA DO DIA', W / 2, tagY, COLORS.accent, '#0f172a', 30, 28, 16, 20);

  // Nome do produto (abaixo da imagem)
  const titleY = imgY + imgSize + 48;
  const titleFont = 'bold 44px sans-serif';
  const titleLines = wrapText(ctx, input.title, W - 120, titleFont);
  const displayLines = titleLines.slice(0, 2);
  if (titleLines.length > 2) displayLines[1] = displayLines[1].replace(/\s+\S+$/, '…');

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.white;
  ctx.font = titleFont;
  displayLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, titleY + i * 54);
  });

  // Preço final (destaque âmbar)
  const priceY = titleY + displayLines.length * 54 + 32;
  ctx.font = 'bold 72px sans-serif';
  ctx.fillStyle = COLORS.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(formatBRL(input.finalPrice), W / 2, priceY);

  // Swipe label
  ctx.font = '26px sans-serif';
  ctx.fillStyle = COLORS.grayText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Deslize para ver mais  →', W / 2, H - 30);

  return canvas.toBuffer('image/jpeg', { quality: 0.92 });
}

// ── SLIDE 2: Preços e Economia ────────────────────────────────────────────────────

async function generateSlide2(input: CarouselInput): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;

  drawBg(ctx);

  const centerY = H / 2;

  // Ícone topo
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '80px sans-serif';
  ctx.fillText('💰', W / 2, 120);

  ctx.font = 'bold 48px sans-serif';
  ctx.fillStyle = COLORS.white;
  ctx.fillText('Confira o preço!', W / 2, 210);

  drawDivider(ctx, 270);

  // Preço antigo
  if (input.originalPrice && input.originalPrice > input.finalPrice) {
    ctx.font = '44px sans-serif';
    ctx.fillStyle = COLORS.grayText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const oldText = `De ${formatBRL(input.originalPrice)}`;
    ctx.fillText(oldText, W / 2, 350);
    // Linha de riscado
    const oldW = ctx.measureText(oldText).width;
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 - oldW / 2, 350);
    ctx.lineTo(W / 2 + oldW / 2, 350);
    ctx.stroke();
  }

  // "por apenas"
  ctx.font = '36px sans-serif';
  ctx.fillStyle = COLORS.grayText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('por apenas', W / 2, 430);

  // Preço final — grande
  ctx.font = 'bold 900 96px sans-serif';
  ctx.fillStyle = COLORS.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatBRL(input.finalPrice), W / 2, 545);

  // Economia
  if (input.originalPrice && input.originalPrice > input.finalPrice) {
    const saving = input.originalPrice - input.finalPrice;
    drawBadge(
      ctx,
      `✅ Você economiza ${formatBRL(saving)}`,
      W / 2, 650,
      '#166534', COLORS.green, 30, 28, 16, 20,
    );
  }

  drawDivider(ctx, 720);

  // Forma de pagamento
  let paymentText = '';
  if (input.paymentMethod === 'pix') {
    paymentText = '💳 NO PIX';
  } else if (input.paymentMethod === 'parcelado' && input.installments) {
    const installVal = input.installmentValue ?? (input.finalPrice / input.installments);
    paymentText = `💳 ${input.installments}x de ${formatBRL(installVal)} sem juros`;
  }

  if (paymentText) {
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(paymentText, W / 2, 810);
  }

  drawManuBrand(ctx, 950);

  ctx.font = '26px sans-serif';
  ctx.fillStyle = COLORS.grayText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Deslize para ver mais  →', W / 2, H - 30);

  return canvas.toBuffer('image/jpeg', { quality: 0.92 });
}

// ── SLIDE 3: CTA + Urgência ────────────────────────────────────────────────────────

async function generateSlide3(input: CarouselInput): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;

  drawBg(ctx);

  // Padrão decorativo de fundo (pontos sutis)
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      ctx.beginPath();
      ctx.arc(col * 120 + 60, row * 120 + 60, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Emoji grande
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '100px sans-serif';
  ctx.fillText('⚡', W / 2, 160);

  ctx.font = 'bold 60px sans-serif';
  ctx.fillStyle = COLORS.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CORRE!', W / 2, 280);

  ctx.font = 'bold 42px sans-serif';
  ctx.fillStyle = COLORS.white;
  ctx.fillText('Oferta por tempo', W / 2, 370);
  ctx.fillText('limitado! 🔥', W / 2, 430);

  drawDivider(ctx, 500);

  // Preço recap
  ctx.font = 'bold 52px sans-serif';
  ctx.fillStyle = COLORS.accent;
  ctx.fillText(formatBRL(input.finalPrice), W / 2, 590);

  if (input.discountPct && input.discountPct > 0) {
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = COLORS.accentOrange;
    ctx.fillText(`-${input.discountPct}% de desconto`, W / 2, 660);
  }

  drawDivider(ctx, 730);

  // CTA box
  const ctaY = 790;
  const ctaW = 680;
  const ctaH = 90;
  const ctaX = (W - ctaW) / 2;

  const ctaGrad = ctx.createLinearGradient(ctaX, ctaY, ctaX + ctaW, ctaY);
  ctaGrad.addColorStop(0, COLORS.accent);
  ctaGrad.addColorStop(1, COLORS.accentOrange);
  ctx.fillStyle = ctaGrad;
  roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 20);
  ctx.fill();

  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔗 LINK NA BIO  →', W / 2, ctaY + ctaH / 2);

  drawManuBrand(ctx, 960);

  return canvas.toBuffer('image/jpeg', { quality: 0.92 });
}

// ── SLIDE 4: Branding Manu ────────────────────────────────────────────────────────

async function generateSlide4(input: CarouselInput): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;

  // Fundo especial para o slide de branding
  const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 700);
  bgGrad.addColorStop(0, '#1e40af');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Círculo decorativo
  ctx.strokeStyle = 'rgba(245,158,11,0.15)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 200 + i * 80, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Avatar da Manu (tenta carregar, fallback emoji)
  const avatarSize = 220;
  const avatarX = W / 2 - avatarSize / 2;
  const avatarY = 180;

  try {
    const avatarImg = await loadImage('https://www.manu-promocoes.com.br/manu-avatar.png');
    // Círculo de fundo âmbar
    ctx.fillStyle = COLORS.accent;
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
    // Fallback: círculo âmbar com emoji
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.arc(W / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${avatarSize * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛍️', W / 2, avatarY + avatarSize / 2);
  }

  // Nome
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillStyle = COLORS.white;
  ctx.fillText('Manu das Promoções', W / 2, 480);

  ctx.font = '36px sans-serif';
  ctx.fillStyle = COLORS.grayText;
  ctx.fillText('As melhores ofertas do Brasil', W / 2, 548);

  drawDivider(ctx, 610);

  // Redes sociais
  const socials = [
    { icon: '📸', label: '@manupromocao', platform: 'Instagram' },
    { icon: '✈️', label: 't.me/manupromocao', platform: 'Telegram' },
    { icon: '🌐', label: 'manu-promocoes.com.br', platform: 'Site' },
  ];

  socials.forEach((s, i) => {
    const y = 680 + i * 70;
    ctx.font = '34px sans-serif';
    ctx.fillStyle = COLORS.grayText;
    ctx.textAlign = 'center';
    ctx.fillText(`${s.icon}  ${s.label}`, W / 2, y);
  });

  // Tag CTA
  drawBadge(ctx, '🔥 Siga para não perder nenhuma oferta!', W / 2, 930, COLORS.accent, '#0f172a', 28, 24, 14, 18);

  return canvas.toBuffer('image/jpeg', { quality: 0.92 });
}

// ── EXPORTAÇÃO PRINCIPAL ───────────────────────────────────────────────────────────

export async function generateCarousel(input: CarouselInput): Promise<CarouselResult> {
  if (!isCanvasAvailable()) {
    return { success: false, error: 'canvas não disponível neste ambiente' };
  }

  try {
    console.log(`[Carousel] Gerando slides para: ${input.title.slice(0, 60)}`);

    const [buf1, buf2, buf3, buf4] = await Promise.all([
      generateSlide1(input),
      generateSlide2(input),
      generateSlide3(input),
      generateSlide4(input),
    ]);

    const folder = 'promo-platform/carousels';
    const ts = Date.now();
    const id = input.offerId || ts;

    const uploads = await Promise.all([
      uploadFromBuffer(buf1, { folder, publicId: `${id}_slide1`, tags: ['carousel', 'instagram'] }),
      uploadFromBuffer(buf2, { folder, publicId: `${id}_slide2`, tags: ['carousel', 'instagram'] }),
      uploadFromBuffer(buf3, { folder, publicId: `${id}_slide3`, tags: ['carousel', 'instagram'] }),
      uploadFromBuffer(buf4, { folder, publicId: `${id}_slide4`, tags: ['carousel', 'instagram'] }),
    ]);

    const failed = uploads.find(u => !u.success);
    if (failed) {
      return { success: false, error: `Falha no upload: ${failed.error}` };
    }

    const slideUrls = uploads.map(u => u.url!);
    console.log(`[Carousel] ✅ ${slideUrls.length} slides gerados e enviados ao Cloudinary`);

    return { success: true, slideUrls };
  } catch (err: any) {
    console.error('[Carousel] Erro:', err.message);
    return { success: false, error: err.message };
  }
}

export { isCanvasAvailable };
