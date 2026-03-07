/**
 * Gerador de GIF animado premium para Ofertas Relâmpago.
 *
 * Animações:
 *  • Produto: zoom suave 100%→104%→100% (loop sem pulo)
 *  • Sombra 3D abaixo do produto (realismo)
 *  • Preço: glow âmbar pulsante
 *  • Badge desconto: pisca vermelho vivo
 *  • Selo "🔥 MAIS VENDIDO" no canto da imagem
 *  • Cronômetro: segundos 59→00 (loop invisível)
 *
 * Layout (600 × 432):
 *  ┌──────────────────────────────────────────────┐
 *  │  [FOTO]  🔥 MAIS VENDIDO (canto)             │ ← 300px imagem
 *  ├──────────────────────────────────────────────┤
 *  │  De R$ 169,99 ~~    R$ 98,44 ← glow pulsante │ ← 78px preços
 *  │       🔥 -42% DE DESCONTO (pisca)            │
 *  ├──────────────────────────────────────────────┤
 *  │  ⏳ TERMINA EM            01:54:23           │ ← 54px timer
 *  └──────────────────────────────────────────────┘
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

function fmt(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function truncate(t: string, max: number) {
  return t.length > max ? t.substring(0, max - 1) + '…' : t;
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
  const IMG_H   = 300;  // zona imagem
  const INFO_H  = 78;   // zona preço + badge desconto
  const TIMER_H = 54;   // zona cronômetro
  const H       = IMG_H + INFO_H + TIMER_H; // 432px

  const encoder = new GifEncoder(W, H, 'neuquant', true);
  encoder.setDelay(1000);
  encoder.setRepeat(0);
  encoder.setQuality(12);
  encoder.start();

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Carregar imagem do produto ───────────────────────────────────────────
  let productImg: any = null;
  if (opts.imageUrl) {
    try { productImg = await loadImage(opts.imageUrl); } catch (_e) { /* sem imagem */ }
  }

  // ── Tempo restante (horas+minutos fixos, segundos animados) ─────────────
  const totalSecs = Math.max(0, Math.floor((opts.expiresAt.getTime() - Date.now()) / 1000));
  const hoursLeft = Math.floor(totalSecs / 3600);
  const minsLeft  = Math.floor((totalSecs % 3600) / 60);

  // ── 60 frames ────────────────────────────────────────────────────────────
  for (let frame = 0; frame < 60; frame++) {

    // === Curvas de animação ===

    // Zoom produto: 100% → 104% → 100% (sinusoidal suave, loop perfeito)
    const zoomT   = (Math.sin((frame / 60) * 2 * Math.PI - Math.PI / 2) + 1) / 2; // 0→1→0
    const zoom    = 1.0 + zoomT * 0.04; // 1.000 → 1.040 → 1.000

    // Badge pisca: ciclo de 10 frames (bright=0.9 / dim=0.55)
    const badgeT  = (Math.sin((frame / 10) * 2 * Math.PI) + 1) / 2;
    const badgeA  = 0.55 + badgeT * 0.45; // 0.55 → 1.0

    // Glow do preço: ciclo de 20 frames
    const glowT   = (Math.sin((frame / 20) * 2 * Math.PI) + 1) / 2;
    const glowBlur = 8 + glowT * 14; // 8 → 22

    // Segundos do cronômetro (59 → 00)
    const sec     = 59 - frame;
    const hh      = String(hoursLeft).padStart(2, '0');
    const mm      = String(minsLeft).padStart(2, '0');
    const ss      = String(sec).padStart(2, '0');

    // ── ZONA IMAGEM ────────────────────────────────────────────────────────
    // Fundo branco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, IMG_H);

    if (productImg) {
      // Calcular tamanho base (fit)
      const baseRatio  = Math.min((W - 20) / productImg.width, (IMG_H - 40) / productImg.height);
      const baseW      = productImg.width  * baseRatio;
      const baseH      = productImg.height * baseRatio;
      const scaledW    = baseW  * zoom;
      const scaledH    = baseH  * zoom;
      const dx         = (W - scaledW) / 2;
      const dy         = (IMG_H - scaledH) / 2 - 8; // levemente acima do centro

      // Sombra 3D: elipse escura abaixo do produto
      ctx.save();
      ctx.globalAlpha = 0.18 + zoomT * 0.07; // sombra cresce com o zoom
      ctx.beginPath();
      ctx.ellipse(
        W / 2,
        IMG_H - 16,
        scaledW * 0.38,
        scaledH * 0.08,
        0, 0, 2 * Math.PI
      );
      ctx.fillStyle = '#000000';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).filter = 'blur(8px)';
      ctx.fill();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).filter = 'none';
      ctx.restore();

      // Produto com zoom
      ctx.drawImage(productImg, dx, dy, scaledW, scaledH);
    } else {
      ctx.fillStyle    = '#f5f5f5';
      ctx.fillRect(0, 0, W, IMG_H);
      ctx.font         = '64px sans-serif';
      ctx.fillStyle    = '#cccccc';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛍️', W / 2, IMG_H / 2);
    }

    // Selo "🔥 MAIS VENDIDO" — canto superior direito
    {
      const bW = 148, bH = 26, bX = W - bW - 10, bY = 10;
      ctx.fillStyle = '#dc2626';
      roundRect(ctx, bX, bY, bW, bH, 6);
      ctx.fill();
      ctx.font         = 'bold 12px sans-serif';
      ctx.fillStyle    = '#ffffff';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔥  MAIS VENDIDO', bX + bW / 2, bY + bH / 2);
    }

    // Linha separadora âmbar abaixo da imagem
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, IMG_H - 3, W, 3);

    // ── ZONA INFO (preço + badge) ─────────────────────────────────────────
    const infoY = IMG_H;

    // Fundo escuro premium
    const infoBg = ctx.createLinearGradient(0, infoY, 0, infoY + INFO_H);
    infoBg.addColorStop(0, '#111111');
    infoBg.addColorStop(1, '#1a0a00');
    ctx.fillStyle = infoBg;
    ctx.fillRect(0, infoY, W, INFO_H);

    // Preço antigo riscado
    if (opts.originalPrice && opts.originalPrice > opts.finalPrice) {
      ctx.font         = '16px sans-serif';
      ctx.fillStyle    = '#9ca3af';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      const oldStr     = fmt(opts.originalPrice);
      ctx.fillText(oldStr, W / 2, infoY + 6);
      const tw = ctx.measureText(oldStr).width;
      ctx.beginPath();
      ctx.moveTo(W / 2 - tw / 2, infoY + 16);
      ctx.lineTo(W / 2 + tw / 2, infoY + 16);
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }

    // Preço final — ENORME com glow pulsante
    ctx.shadowColor  = '#f59e0b';
    ctx.shadowBlur   = glowBlur;
    ctx.font         = 'bold 44px sans-serif';
    ctx.fillStyle    = '#fbbf24';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    const priceTopY  = opts.originalPrice ? infoY + 26 : infoY + 10;
    ctx.fillText(fmt(opts.finalPrice), W / 2, priceTopY);
    ctx.shadowBlur   = 0;

    // Badge desconto piscante
    if (opts.discountPct > 0) {
      const bdW  = 230, bdH  = 22;
      const bdX  = W / 2 - bdW / 2;
      const bdY  = infoY + INFO_H - bdH - 6;

      ctx.save();
      ctx.globalAlpha = badgeA;
      ctx.fillStyle   = '#dc2626';
      roundRect(ctx, bdX, bdY, bdW, bdH, 5);
      ctx.fill();
      ctx.restore();

      ctx.font         = 'bold 12px sans-serif';
      ctx.fillStyle    = `rgba(255,255,255,${badgeA})`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🔥  -${opts.discountPct}% DE DESCONTO`, W / 2, bdY + bdH / 2);
    }

    // ── ZONA CRONÔMETRO ────────────────────────────────────────────────────
    const timerY = IMG_H + INFO_H;

    // Fundo
    ctx.fillStyle = '#0d0500';
    ctx.fillRect(0, timerY, W, TIMER_H);

    // Linha âmbar no topo do timer
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, timerY, W, 2);

    // Label
    ctx.font         = 'bold 13px sans-serif';
    ctx.fillStyle    = '#f59e0b';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏳  TERMINA EM', 18, timerY + TIMER_H / 2);

    // Cronômetro com glow branco
    ctx.shadowColor  = '#ffffff';
    ctx.shadowBlur   = 6;
    ctx.font         = 'bold 30px monospace';
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${hh}:${mm}:${ss}`, W - 18, timerY + TIMER_H / 2);
    ctx.shadowBlur   = 0;

    encoder.addFrame(ctx.getImageData(0, 0, W, H).data);
  }

  encoder.finish();
  return encoder.out.getData();
}
