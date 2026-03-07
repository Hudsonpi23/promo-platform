/**
 * Gerador de GIF animado de contagem regressiva para Ofertas Relâmpago.
 *
 * Layout:
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │            ⚡  OFERTA RELÂMPAGO  ⚡                          │
 *  ├───────────────┬──────────────────────────────────────────────┤
 *  │               │  Título do produto                           │
 *  │  [IMAGEM]     │  De R$ XX,XX                                 │
 *  │               │  R$ YY,YY                                    │
 *  │               │  🔥 -42% DE DESCONTO                         │
 *  ├───────────────┴──────────────────────────────────────────────┤
 *  │      ⏰ TEMPO RESTANTE    02 : 47 : 33                       │
 *  └──────────────────────────────────────────────────────────────┘
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
  /** URL da imagem do produto */
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

/** Auxiliar: retângulo com bordas arredondadas */
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

/**
 * Retorna true se as dependências de geração de GIF estão disponíveis.
 */
export function isFlashGifAvailable(): boolean {
  return !!createCanvas && !!GifEncoder;
}

/**
 * Gera um GIF animado com imagem do produto + cronômetro regressivo.
 * Retorna um Buffer com o GIF pronto para upload.
 */
export async function generateFlashGif(opts: FlashGifOptions): Promise<Buffer> {
  if (!createCanvas || !GifEncoder) {
    throw new Error('canvas/gif-encoder-2 não disponível neste ambiente');
  }

  // ── Dimensões ───────────────────────────────────────────────────────────
  const W  = 600;
  const H  = 360;

  // Zonas
  const BADGE_H  = 38;   // topo: badge relâmpago
  const IMG_W    = 200;  // largura da coluna de imagem
  const MID_H    = 210;  // altura da zona imagem+info
  const TIMER_H  = H - BADGE_H - MID_H; // zona do cronômetro (~112px)

  const encoder = new GifEncoder(W, H, 'neuquant', true);
  encoder.setDelay(1000);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── Tentar carregar imagem do produto ────────────────────────────────────
  let productImg: any = null;
  if (opts.imageUrl) {
    try {
      productImg = await loadImage(opts.imageUrl);
    } catch (_e) {
      // imagem não carregou — continua sem ela
    }
  }

  // ── Calcular tempo restante no momento da geração ────────────────────────
  const now        = Date.now();
  const totalMs    = opts.expiresAt.getTime() - now;
  const totalSecs  = Math.max(0, Math.floor(totalMs / 1000));
  const hoursLeft  = Math.floor(totalSecs / 3600);
  const minsLeft   = Math.floor((totalSecs % 3600) / 60);
  const secsStart  = totalSecs % 60;

  // ── Gerar 60 frames ──────────────────────────────────────────────────────
  for (let frame = 0; frame < 60; frame++) {
    const currentSec  = ((secsStart - frame) % 60 + 60) % 60;
    const displayMins = frame > secsStart ? Math.max(0, minsLeft - 1) : minsLeft;

    // === FUNDO ===
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a0a00');
    bg.addColorStop(0.5, '#2a1000');
    bg.addColorStop(1, '#1a0a00');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Brilhos de canto
    ctx.fillStyle = '#f59e0b18';
    ctx.beginPath(); ctx.arc(0,   0,   70, 0, Math.PI / 2);         ctx.fill();
    ctx.beginPath(); ctx.arc(W,   0,   70, Math.PI / 2, Math.PI);   ctx.fill();
    ctx.beginPath(); ctx.arc(0,   H,   70, -Math.PI / 2, 0);        ctx.fill();
    ctx.beginPath(); ctx.arc(W,   H,   70, Math.PI, 3 * Math.PI/2); ctx.fill();

    // Borda âmbar
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, W - 6, H - 6);

    // === BADGE TOPO ===
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(3, 3, W - 6, BADGE_H);

    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#1a0a00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡  OFERTA RELÂMPAGO  ⚡', W / 2, 3 + BADGE_H / 2);

    // === ZONA IMAGEM + INFO ===
    const midY = BADGE_H;

    // Divisor vertical
    ctx.strokeStyle = '#f59e0b44';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(IMG_W, midY);
    ctx.lineTo(IMG_W, midY + MID_H);
    ctx.stroke();

    // --- IMAGEM DO PRODUTO (esquerda) ---
    const imgPad = 10;
    if (productImg) {
      // fundo branco suave para a imagem
      ctx.fillStyle = '#ffffff08';
      ctx.fillRect(3, midY, IMG_W - 3, MID_H);

      // Calcular dimensões mantendo proporção
      const maxW = IMG_W - imgPad * 2;
      const maxH = MID_H - imgPad * 2;
      const ratio = Math.min(maxW / productImg.width, maxH / productImg.height);
      const dw = productImg.width * ratio;
      const dh = productImg.height * ratio;
      const dx = 3 + (IMG_W - 6) / 2 - dw / 2;
      const dy = midY + MID_H / 2 - dh / 2;
      ctx.drawImage(productImg, dx, dy, dw, dh);
    } else {
      // Placeholder quando não há imagem
      ctx.fillStyle = '#f59e0b22';
      ctx.fillRect(3, midY, IMG_W - 3, MID_H);
      ctx.font = '32px sans-serif';
      ctx.fillStyle = '#f59e0b66';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛍️', 3 + (IMG_W - 3) / 2, midY + MID_H / 2);
    }

    // --- INFO DO PRODUTO (direita) ---
    const infoX    = IMG_W + 16;
    const infoMaxW = W - IMG_W - 20;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Título
    const shortTitle = truncate(opts.title, 36);
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#fef3c7';
    // Quebrar em 2 linhas se necessário
    const words = shortTitle.split(' ');
    let line1 = '', line2 = '';
    for (const word of words) {
      const test = line1 ? `${line1} ${word}` : word;
      if (ctx.measureText(test).width > infoMaxW && line1) {
        line2 = line2 ? `${line2} ${word}` : word;
      } else {
        line1 = test;
      }
    }
    ctx.fillText(line1, infoX, midY + 14);
    if (line2) ctx.fillText(line2, infoX, midY + 34);

    const priceY = midY + (line2 ? 70 : 52);

    // Preço original riscado
    if (opts.originalPrice && opts.originalPrice > opts.finalPrice) {
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#9ca3af';
      const oldStr = formatPrice(opts.originalPrice);
      ctx.fillText(oldStr, infoX, priceY);
      // linha de strike-through
      const tw = ctx.measureText(oldStr).width;
      ctx.beginPath();
      ctx.moveTo(infoX, priceY + 9);
      ctx.lineTo(infoX + tw, priceY + 9);
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Preço final
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(formatPrice(opts.finalPrice), infoX, priceY + (opts.originalPrice ? 22 : 0));

    // Badge desconto
    if (opts.discountPct > 0) {
      const discY = priceY + (opts.originalPrice ? 60 : 38);
      ctx.fillStyle = '#ef4444';
      roundRect(ctx, infoX, discY, infoMaxW - 10, 26, 6);
      ctx.fill();
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🔥  -${opts.discountPct}% DE DESCONTO`, infoX + 8, discY + 13);
    }

    // === DIVISOR HORIZONTAL ===
    const timerY = BADGE_H + MID_H;
    ctx.strokeStyle = '#f59e0b66';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, timerY);
    ctx.lineTo(W - 20, timerY);
    ctx.stroke();

    // === ZONA CRONÔMETRO ===
    const hh = String(hoursLeft).padStart(2, '0');
    const mm = String(displayMins).padStart(2, '0');
    const ss = String(currentSec).padStart(2, '0');

    // Label "TEMPO RESTANTE" à esquerda
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏰  TEMPO RESTANTE', 20, timerY + TIMER_H / 2 - 10);

    // Cronômetro compacto à direita
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 52px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`${hh}:${mm}:${ss}`, W - 20, timerY + TIMER_H / 2 + 6);
    ctx.shadowBlur = 0;

    // Labels hh mm ss
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#f59e0b88';
    ctx.textAlign = 'right';
    ctx.fillText('HH    MM    SS', W - 20, timerY + TIMER_H - 10);

    encoder.addFrame(ctx.getImageData(0, 0, W, H).data);
  }

  encoder.finish();
  return encoder.out.getData();
}
