/**
 * Gerador de GIF animado para Ofertas Relâmpago.
 *
 * Estrutura simples e impactante:
 *
 *  ┌─────────────────────────────────────────────────┐
 *  │                                                 │
 *  │      [FOTO DO PRODUTO — estática, grande]       │  ← 380px
 *  │                                                 │
 *  ├─────────────────────────────────────────────────┤
 *  │  ⏳ TERMINA EM          01 : 54 : 23 ←ticking  │  ← 52px animada
 *  └─────────────────────────────────────────────────┘
 *
 * Só a barra do cronômetro muda frame a frame — GIF comprime muito bem.
 * Segundos: 59→00 sempre (loop invisível — parece apenas "mais um minuto passou").
 * Horas e minutos: fixos no valor do momento da geração.
 *
 * X (Twitter) não permite imagem + GIF no mesmo tweet, então este GIF
 * substitui a imagem do produto e adiciona o cronômetro ao vivo.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
let createCanvas: typeof import('canvas').createCanvas;
// eslint-disable-next-line @typescript-eslint/no-var-requires
let loadImage: typeof import('canvas').loadImage;
// @ts-ignore
let GifEncoder: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod  = require('canvas');
  createCanvas = mod.createCanvas;
  loadImage    = mod.loadImage;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  GifEncoder   = require('gif-encoder-2');
} catch (_e) { /* libs nativas indisponíveis */ }

export interface FlashGifOptions {
  title: string;
  finalPrice: number;
  originalPrice?: number | null;
  discountPct: number;
  expiresAt: Date;
  imageUrl?: string | null;
}

export function isFlashGifAvailable(): boolean {
  return !!createCanvas && !!GifEncoder;
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

export async function generateFlashGif(opts: FlashGifOptions): Promise<Buffer> {
  if (!createCanvas || !GifEncoder) {
    throw new Error('canvas/gif-encoder-2 não disponível neste ambiente');
  }

  const W       = 600;
  const IMG_H   = 380;  // imagem do produto — grande e dominante
  const TIMER_H = 52;   // barra do cronômetro — pequena e compacta
  const H       = IMG_H + TIMER_H;

  const encoder = new GifEncoder(W, H, 'neuquant', true);
  encoder.setDelay(1000);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Carregar imagem do produto ───────────────────────────────────────────
  let productImg: any = null;
  if (opts.imageUrl) {
    try { productImg = await loadImage(opts.imageUrl); } catch (_e) { /* continua sem imagem */ }
  }

  // ── Pré-renderizar a parte ESTÁTICA (imagem) — igual em todos os frames ──
  // Fundo escuro para a zona de imagem
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, W, IMG_H);

  if (productImg) {
    // Fundo branco para destacar o produto
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, IMG_H);

    // Fit: manter proporção, centralizar na área
    const ratio = Math.min(W / productImg.width, IMG_H / productImg.height);
    const dw    = productImg.width  * ratio;
    const dh    = productImg.height * ratio;
    const dx    = (W - dw) / 2;
    const dy    = (IMG_H - dh) / 2;
    ctx.drawImage(productImg, dx, dy, dw, dh);
  } else {
    // Placeholder sem imagem
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, IMG_H);
    ctx.font         = '64px sans-serif';
    ctx.fillStyle    = '#444444';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛍️', W / 2, IMG_H / 2);
  }

  // Capturar os pixels da imagem (iguais em todos os 60 frames)
  const staticPixels = ctx.getImageData(0, 0, W, IMG_H);

  // ── Calcular tempo restante (horas + minutos fixos; segundos animados) ───
  const totalSecs = Math.max(0, Math.floor((opts.expiresAt.getTime() - Date.now()) / 1000));
  const hoursLeft = Math.floor(totalSecs / 3600);
  const minsLeft  = Math.floor((totalSecs % 3600) / 60);

  // ── Gerar 60 frames: só a barra do cronômetro muda ─────────────────────
  for (let frame = 0; frame < 60; frame++) {
    const sec = 59 - frame; // 59 → 0, depois loop invisível

    // Restaurar parte estática da imagem (sem redesenhar)
    ctx.putImageData(staticPixels, 0, 0);

    // === BARRA DO CRONÔMETRO ===
    const barY = IMG_H;

    // Fundo da barra — gradiente âmbar/escuro
    const barBg = ctx.createLinearGradient(0, barY, 0, barY + TIMER_H);
    barBg.addColorStop(0, '#1a0a00');
    barBg.addColorStop(1, '#0d0500');
    ctx.fillStyle = barBg;
    ctx.fillRect(0, barY, W, TIMER_H);

    // Linha âmbar no topo da barra
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, barY, W, 2);

    // Label "⏳ TERMINA EM"
    ctx.font         = 'bold 13px sans-serif';
    ctx.fillStyle    = '#f59e0b';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏳  TERMINA EM', 18, barY + TIMER_H / 2);

    // Cronômetro — compacto, com brilho âmbar
    const hh = String(hoursLeft).padStart(2, '0');
    const mm = String(minsLeft).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');

    ctx.shadowColor  = '#f59e0b';
    ctx.shadowBlur   = 10;
    ctx.font         = 'bold 28px monospace';
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${hh}:${mm}:${ss}`, W - 18, barY + TIMER_H / 2);
    ctx.shadowBlur   = 0;

    encoder.addFrame(ctx.getImageData(0, 0, W, H).data);
  }

  encoder.finish();
  return encoder.out.getData();
}
