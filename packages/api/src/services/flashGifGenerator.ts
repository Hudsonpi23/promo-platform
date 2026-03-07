/**
 * Gerador de GIF animado de contagem regressiva para Ofertas Relâmpago.
 *
 * Gera 60 frames (1 por segundo) mostrando o cronômetro regressivo.
 * Os minutos e horas são fixos no momento de geração; os segundos
 * ticam de 59 a 00, criando a ilusão de um cronômetro ao vivo.
 */

// canvas e gif-encoder-2 podem não estar disponíveis em todos os ambientes
// eslint-disable-next-line @typescript-eslint/no-var-requires
let createCanvas: typeof import('canvas').createCanvas;
// @ts-ignore
let GifEncoder: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  createCanvas = require('canvas').createCanvas;
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

/**
 * Gera um GIF animado com o cronômetro regressivo.
 * Retorna um Buffer com o GIF pronto para upload.
 */
/**
 * Retorna true se as dependências de geração de GIF estão disponíveis.
 */
export function isFlashGifAvailable(): boolean {
  return !!createCanvas && !!GifEncoder;
}

export async function generateFlashGif(opts: FlashGifOptions): Promise<Buffer> {
  if (!createCanvas || !GifEncoder) {
    throw new Error('canvas/gif-encoder-2 não disponível neste ambiente');
  }

  const W = 600;
  const H = 315; // proporção Twitter card 1.91:1

  const encoder = new GifEncoder(W, H, 'neuquant', true);
  encoder.setDelay(1000); // 1 frame por segundo
  encoder.setRepeat(0);   // loop infinito
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Calcular tempo restante no momento da geração
  const now = Date.now();
  const totalMs = opts.expiresAt.getTime() - now;
  const totalSecs = Math.max(0, Math.floor(totalMs / 1000));
  const hoursLeft = Math.floor(totalSecs / 3600);
  const minsLeft  = Math.floor((totalSecs % 3600) / 60);
  const secsStart = totalSecs % 60; // segundos atuais

  // Gerar 60 frames (1 por segundo, os segundos descem de secsStart a 0 e reiniciam)
  for (let frame = 0; frame < 60; frame++) {
    const currentSec = ((secsStart - frame) % 60 + 60) % 60;
    const displayMins = frame > secsStart ? Math.max(0, minsLeft - 1) : minsLeft;

    // ── Fundo gradiente escuro âmbar ──────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a0a00');
    bg.addColorStop(0.5, '#2d1200');
    bg.addColorStop(1, '#1a0a00');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Borda âmbar brilhante ─────────────────────────────────────────────
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, W - 8, H - 8);

    // ── Raios decorativos nos cantos ──────────────────────────────────────
    ctx.fillStyle = '#f59e0b22';
    ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI / 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W, 0, 80, Math.PI / 2, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(0, H, 80, -Math.PI / 2, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(W, H, 80, Math.PI, 3 * Math.PI / 2); ctx.fill();

    // ── Badge "⚡ OFERTA RELÂMPAGO" ───────────────────────────────────────
    ctx.fillStyle = '#f59e0b';
    roundRect(ctx, W / 2 - 140, 18, 280, 34, 8);
    ctx.fill();
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#1a0a00';
    ctx.textAlign = 'center';
    ctx.fillText('⚡  OFERTA RELÂMPAGO  ⚡', W / 2, 41);

    // ── Título do produto ─────────────────────────────────────────────────
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#fef3c7';
    ctx.textAlign = 'center';
    const shortTitle = truncate(opts.title, 44);
    ctx.fillText(shortTitle, W / 2, 88);

    // ── Preços ────────────────────────────────────────────────────────────
    if (opts.originalPrice && opts.originalPrice > opts.finalPrice) {
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'center';
      // texto riscado simulado
      const oldStr = formatPrice(opts.originalPrice);
      ctx.fillText(oldStr, W / 2, 116);
      ctx.beginPath();
      const w = ctx.measureText(oldStr).width;
      ctx.moveTo(W / 2 - w / 2, 112);
      ctx.lineTo(W / 2 + w / 2, 112);
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(formatPrice(opts.finalPrice), W / 2, 150);

    if (opts.discountPct > 0) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`🔥  -${opts.discountPct}% DE DESCONTO`, W / 2, 176);
    }

    // ── Divisor ────────────────────────────────────────────────────────────
    ctx.strokeStyle = '#f59e0b55';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 192); ctx.lineTo(W - 40, 192);
    ctx.stroke();

    // ── Label "TEMPO RESTANTE" ─────────────────────────────────────────────
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('⏰  TEMPO RESTANTE', W / 2, 214);

    // ── Cronômetro GIGANTE ─────────────────────────────────────────────────
    const hh = String(hoursLeft).padStart(2, '0');
    const mm = String(displayMins).padStart(2, '0');
    const ss = String(currentSec).padStart(2, '0');
    const timeStr = `${hh}:${mm}:${ss}`;

    // Sombra do cronômetro
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 72px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(timeStr, W / 2, 292);
    ctx.shadowBlur = 0;

    // ── Labels HH MM SS ───────────────────────────────────────────────────
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#f59e0b99';
    ctx.fillText('HORAS', W / 2 - 118, 305);
    ctx.fillText('MIN', W / 2, 305);
    ctx.fillText('SEG', W / 2 + 118, 305);

    // Adicionar frame ao GIF
    encoder.addFrame(ctx.getImageData(0, 0, W, H).data);
  }

  encoder.finish();
  return encoder.out.getData();
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
