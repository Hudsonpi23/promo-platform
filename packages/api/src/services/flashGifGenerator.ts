/**
 * Gerador de GIF animado de contagem regressiva para Ofertas Relâmpago.
 *
 * Layout vertical (600 × 460):
 *  ┌───────────────────────────────────────────────────────┐
 *  │           ⚡  OFERTA RELÂMPAGO  ⚡                    │ ← badge (40px)
 *  ├───────────────────────────────────────────────────────┤
 *  │                                                       │
 *  │          [FOTO DO PRODUTO — full width]               │ ← 220px
 *  │   (título do produto overlay no rodapé da imagem)     │
 *  ├───────────────────────────────────────────────────────┤
 *  │   De R$ 169,99 ~~risca~~                              │ ← preço antigo
 *  │   R$ 98,44   ← ENORME 70px                           │ ← preço atual
 *  │   🔥 -42% DE DESCONTO  (badge vermelho)               │ ← desconto
 *  ├───────────────────────────────────────────────────────┤
 *  │  ⏰ TEMPO RESTANTE         01 : 55 : 47              │ ← cronômetro
 *  └───────────────────────────────────────────────────────┘
 *
 * Fix do cronômetro: segundos vão de 59 → 00 sempre (loop invisível).
 * Horas e minutos ficam fixos no valor do momento da geração.
 */

// canvas e gif-encoder-2 podem não estar disponíveis em todos os ambientes
// eslint-disable-next-line @typescript-eslint/no-var-requires
let createCanvas: typeof import('canvas').createCanvas;
// eslint-disable-next-line @typescript-eslint/no-var-requires
let loadImage: typeof import('canvas').loadImage;
// @ts-ignore
let GifEncoder: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const canvasModule = require('canvas');
  createCanvas = canvasModule.createCanvas;
  loadImage    = canvasModule.loadImage;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  GifEncoder = require('gif-encoder-2');
} catch (_e) {
  // Dependências nativas não disponíveis — gerador desabilitado
}

export interface FlashGifOptions {
  title: string;
  finalPrice: number;
  originalPrice?: number | null;
  discountPct: number;
  expiresAt: Date;
  imageUrl?: string | null;
}

function formatPrice(value: number): string {
  const hasDecimal = value % 1 !== 0;
  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.substring(0, max - 1) + '…' : text;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export function isFlashGifAvailable(): boolean {
  return !!createCanvas && !!GifEncoder;
}

export async function generateFlashGif(opts: FlashGifOptions): Promise<Buffer> {
  if (!createCanvas || !GifEncoder) {
    throw new Error('canvas/gif-encoder-2 não disponível neste ambiente');
  }

  // ── Dimensões ────────────────────────────────────────────────────────────
  const W        = 600;
  const BADGE_H  = 40;   // topo: badge ⚡ OFERTA RELÂMPAGO
  const IMG_H    = 220;  // foto do produto (full width)
  const PRICE_H  = 120;  // zona preços (antigo + atual + desconto)
  const TIMER_H  = 68;   // zona cronômetro
  const H        = BADGE_H + IMG_H + PRICE_H + TIMER_H; // 448px

  const encoder = new GifEncoder(W, H, 'neuquant', true);
  encoder.setDelay(1000); // 1 frame = 1 segundo
  encoder.setRepeat(0);   // loop infinito
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Carregar imagem do produto ────────────────────────────────────────────
  let productImg: any = null;
  if (opts.imageUrl) {
    try { productImg = await loadImage(opts.imageUrl); } catch (_e) { /* sem imagem */ }
  }

  // ── Tempo restante no momento da geração ─────────────────────────────────
  const totalMs   = Math.max(0, opts.expiresAt.getTime() - Date.now());
  const totalSecs = Math.floor(totalMs / 1000);
  const hoursLeft = Math.floor(totalSecs / 3600);
  const minsLeft  = Math.floor((totalSecs % 3600) / 60);
  // ↑ horas e minutos FIXOS em todos os 60 frames (não mudam no loop)

  // ── Gerar 60 frames — segundos de 59 → 00 (loop invisível) ───────────────
  for (let frame = 0; frame < 60; frame++) {
    // Segundos sempre de 59→00. Sem pulo visível no loop (parece 1 segundo de diferença).
    const currentSec = 59 - frame;

    // === FUNDO ===
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,    '#0d0500');
    bg.addColorStop(0.45, '#1e0c00');
    bg.addColorStop(1,    '#0d0500');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Brilhos de canto
    ctx.fillStyle = '#f59e0b14';
    ctx.beginPath(); ctx.arc(0, 0,  90, 0,           Math.PI / 2);          ctx.fill();
    ctx.beginPath(); ctx.arc(W, 0,  90, Math.PI / 2, Math.PI);              ctx.fill();
    ctx.beginPath(); ctx.arc(0, H,  90, -Math.PI / 2, 0);                   ctx.fill();
    ctx.beginPath(); ctx.arc(W, H,  90, Math.PI,      3 * Math.PI / 2);     ctx.fill();

    // Borda âmbar
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth   = 3;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    // ── BADGE TOPO ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(2, 2, W - 4, BADGE_H - 2);

    ctx.font          = 'bold 16px sans-serif';
    ctx.fillStyle     = '#1a0a00';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText('⚡  OFERTA RELÂMPAGO  ⚡', W / 2, 2 + (BADGE_H - 2) / 2);

    // ── ZONA IMAGEM ─────────────────────────────────────────────────────────
    const imgY = BADGE_H;

    if (productImg) {
      // Fundo branco levíssimo atrás da imagem
      ctx.fillStyle = '#ffffff0a';
      ctx.fillRect(2, imgY, W - 4, IMG_H);

      // Fit/cover: manter proporção, centralizar
      const ratio = Math.min((W - 4) / productImg.width, IMG_H / productImg.height);
      const dw    = productImg.width  * ratio;
      const dh    = productImg.height * ratio;
      const dx    = (W - dw) / 2;
      const dy    = imgY + (IMG_H - dh) / 2;
      ctx.drawImage(productImg, dx, dy, dw, dh);
    } else {
      // Placeholder
      ctx.fillStyle = '#f59e0b18';
      ctx.fillRect(2, imgY, W - 4, IMG_H);
      ctx.font         = '56px sans-serif';
      ctx.fillStyle    = '#f59e0b44';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛍️', W / 2, imgY + IMG_H / 2);
    }

    // Gradiente overlay no rodapé da imagem para o título
    const titleOverlay = ctx.createLinearGradient(0, imgY + IMG_H - 50, 0, imgY + IMG_H);
    titleOverlay.addColorStop(0, 'rgba(0,0,0,0)');
    titleOverlay.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = titleOverlay;
    ctx.fillRect(2, imgY + IMG_H - 50, W - 4, 50);

    // Título sobre a imagem
    ctx.font         = 'bold 14px sans-serif';
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(truncate(opts.title, 60), W / 2, imgY + IMG_H - 6);

    // ── ZONA PREÇOS ──────────────────────────────────────────────────────────
    const priceY = BADGE_H + IMG_H;

    // Linha divisória sutil
    ctx.strokeStyle = '#f59e0b33';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(20, priceY);
    ctx.lineTo(W - 20, priceY);
    ctx.stroke();

    ctx.textAlign    = 'center';

    // Preço original riscado
    if (opts.originalPrice && opts.originalPrice > opts.finalPrice) {
      ctx.font         = '20px sans-serif';
      ctx.fillStyle    = '#9ca3af';
      ctx.textBaseline = 'top';
      const oldStr     = formatPrice(opts.originalPrice);
      ctx.fillText(oldStr, W / 2, priceY + 8);

      // Linha de strike-through
      const tw = ctx.measureText(oldStr).width;
      ctx.beginPath();
      ctx.moveTo(W / 2 - tw / 2, priceY + 19);
      ctx.lineTo(W / 2 + tw / 2, priceY + 19);
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // Preço final — ENORME
    ctx.shadowColor  = '#f59e0b';
    ctx.shadowBlur   = 16;
    ctx.font         = 'bold 70px sans-serif';
    ctx.fillStyle    = '#fbbf24';
    ctx.textBaseline = 'top';
    const priceOffsetY = opts.originalPrice ? 34 : 14;
    ctx.fillText(formatPrice(opts.finalPrice), W / 2, priceY + priceOffsetY);
    ctx.shadowBlur = 0;

    // Badge desconto — fundo vermelho
    if (opts.discountPct > 0) {
      const discH  = 28;
      const discW  = 220;
      const discX  = W / 2 - discW / 2;
      const discY2 = priceY + priceOffsetY + 76;

      ctx.fillStyle = '#dc2626';
      roundRect(ctx, discX, discY2, discW, discH, 6);
      ctx.fill();

      ctx.font         = 'bold 14px sans-serif';
      ctx.fillStyle    = '#ffffff';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🔥  -${opts.discountPct}% DE DESCONTO`, W / 2, discY2 + discH / 2);
    }

    // ── ZONA CRONÔMETRO ──────────────────────────────────────────────────────
    const timerY = BADGE_H + IMG_H + PRICE_H;

    // Divisor
    ctx.strokeStyle = '#f59e0b55';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(20, timerY);
    ctx.lineTo(W - 20, timerY);
    ctx.stroke();

    // Label
    ctx.font         = 'bold 12px sans-serif';
    ctx.fillStyle    = '#f59e0b';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏰  TEMPO RESTANTE', 20, timerY + TIMER_H / 2 - 8);

    // Cronômetro (segundos sempre 59→00, horas+minutos fixos)
    const hh = String(hoursLeft).padStart(2, '0');
    const mm = String(minsLeft).padStart(2, '0');
    const ss = String(currentSec).padStart(2, '0');

    ctx.shadowColor  = '#f59e0b';
    ctx.shadowBlur   = 14;
    ctx.font         = 'bold 46px monospace';
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${hh}:${mm}:${ss}`, W - 16, timerY + TIMER_H / 2 + 2);
    ctx.shadowBlur = 0;

    // Labels HH MM SS
    ctx.font         = '9px sans-serif';
    ctx.fillStyle    = '#f59e0b77';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('HH           MM           SS', W - 16, timerY + TIMER_H - 4);

    encoder.addFrame(ctx.getImageData(0, 0, W, H).data);
  }

  encoder.finish();
  return encoder.out.getData();
}
