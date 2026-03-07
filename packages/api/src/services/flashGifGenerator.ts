/**
 * Gerador de GIF animado compacto para Ofertas Relâmpago.
 *
 * Formato "widget" — largo e pequeno, aparece exatamente onde
 * a imagem do produto ficaria no post do X:
 *
 *  ┌───────────────────────────────────────────────────────────┐
 *  │ [thumb] │ ⏳ TERMINA EM   │    02 : 28 : 47 ← ticking    │
 *  └───────────────────────────────────────────────────────────┘
 *    90px       ~180px              ~240px
 *
 * Dimensões: 600 × 90px
 * 60 frames — segundos 59→00, loop invisível.
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

  const W = 600;
  const H = 90;

  const THUMB_W = 90;   // thumbnail do produto
  const MID_X   = THUMB_W; // início da zona central

  const encoder = new GifEncoder(W, H, 'neuquant', true);
  encoder.setDelay(1000);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Carregar thumbnail do produto ─────────────────────────────────────────
  let productImg: any = null;
  if (opts.imageUrl) {
    try { productImg = await loadImage(opts.imageUrl); } catch (_e) { /* ok */ }
  }

  // ── Pré-renderizar thumbnail (estático, igual em todos os frames) ─────────
  // Fundo branco para a thumbnail
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, THUMB_W, H);

  if (productImg) {
    const ratio = Math.min((THUMB_W - 8) / productImg.width, (H - 8) / productImg.height);
    const dw = productImg.width  * ratio;
    const dh = productImg.height * ratio;
    ctx.drawImage(productImg, (THUMB_W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    ctx.font         = '28px sans-serif';
    ctx.fillStyle    = '#cccccc';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛍️', THUMB_W / 2, H / 2);
  }

  // Capturar pixels estáticos da thumbnail
  const thumbPixels = ctx.getImageData(0, 0, THUMB_W, H);

  // ── Tempo restante ────────────────────────────────────────────────────────
  const totalSecs = Math.max(0, Math.floor((opts.expiresAt.getTime() - Date.now()) / 1000));
  const hoursLeft = Math.floor(totalSecs / 3600);
  const minsLeft  = Math.floor((totalSecs % 3600) / 60);

  // ── 60 frames ─────────────────────────────────────────────────────────────
  for (let frame = 0; frame < 60; frame++) {
    const sec = 59 - frame;

    // Pulso sutil no badge (ciclo 10 frames)
    const pulse = (Math.sin((frame / 10) * 2 * Math.PI) + 1) / 2; // 0→1
    const badgeAlpha = 0.65 + pulse * 0.35;

    // === FUNDO (zona direita) ===
    const bg = ctx.createLinearGradient(MID_X, 0, W, 0);
    bg.addColorStop(0, '#0d0500');
    bg.addColorStop(1, '#1a0800');
    ctx.fillStyle = bg;
    ctx.fillRect(MID_X, 0, W - MID_X, H);

    // Borda âmbar ao redor de tudo
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth   = 2.5;
    ctx.strokeRect(1.25, 1.25, W - 2.5, H - 2.5);

    // Divisor vertical entre thumb e conteúdo
    ctx.strokeStyle = '#f59e0b55';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(THUMB_W, 0);
    ctx.lineTo(THUMB_W, H);
    ctx.stroke();

    // === RESTAURAR THUMBNAIL (estático) ===
    ctx.putImageData(thumbPixels, 0, 0);

    // === ZONA CENTRAL: Label + badge flash ===
    const labelX = MID_X + 14;

    // Badge "⚡ FLASH" pequeno acima
    ctx.save();
    ctx.globalAlpha = badgeAlpha;
    ctx.fillStyle   = '#f59e0b';
    roundRect(ctx, labelX, 8, 70, 18, 4);
    ctx.fill();
    ctx.restore();

    ctx.font         = 'bold 10px sans-serif';
    ctx.fillStyle    = `rgba(26,10,0,${badgeAlpha})`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ RELÂMPAGO', labelX + 35, 17);

    // Label "⏳ TERMINA EM"
    ctx.font         = 'bold 12px sans-serif';
    ctx.fillStyle    = '#f59e0b';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏳  TERMINA EM', labelX, H / 2 + 6);

    // Preço final pequeno abaixo
    ctx.font         = '11px sans-serif';
    ctx.fillStyle    = '#fbbf2499';
    ctx.fillText(`por ${opts.finalPrice.toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL',
      minimumFractionDigits: opts.finalPrice % 1 !== 0 ? 2 : 0,
    })}`, labelX, H - 12);

    // === ZONA DIREITA: Cronômetro grande ===
    const clockX = MID_X + 200; // início da zona do relógio

    // Fundo levemente destacado para o relógio
    ctx.fillStyle = '#ffffff08';
    ctx.fillRect(clockX - 10, 4, W - clockX + 6, H - 8);

    const hh = String(hoursLeft).padStart(2, '0');
    const mm = String(minsLeft).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');

    // Cronômetro — grande, com glow
    ctx.shadowColor  = '#f59e0b';
    ctx.shadowBlur   = 12;
    ctx.font         = 'bold 42px monospace';
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${hh}:${mm}:${ss}`, clockX + (W - clockX) / 2, H / 2 - 4);
    ctx.shadowBlur   = 0;

    // Labels HH MM SS
    ctx.font         = '9px sans-serif';
    ctx.fillStyle    = '#f59e0b88';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('HH         MM         SS', clockX + (W - clockX) / 2, H - 4);

    encoder.addFrame(ctx.getImageData(0, 0, W, H).data);
  }

  encoder.finish();
  return encoder.out.getData();
}
