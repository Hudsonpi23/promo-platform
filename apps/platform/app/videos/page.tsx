'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Offer {
  id: string;
  title: string;
  finalPrice: number;
  originalPrice?: number | null;
  discountPct?: number | null;
  imageUrl?: string | null;
  mainImage?: string | null;
  affiliateUrl?: string;
  store?: { name: string };
  niche?: { name: string };
}

type VideoFormat = 'square' | 'story';

const FORMATS = {
  square: { w: 1080, h: 1080, label: 'Feed (1:1)', icon: '⬛' },
  story:  { w: 1080, h: 1920, label: 'Stories/Reels (9:16)', icon: '📱' },
};

const SITE_URL = 'manu-promocoes.vercel.app';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPrice(v?: number | null): string {
  if (!v) return '';
  const hasDecimals = v % 1 !== 0;
  return v.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function clamp(t: number, a: number, b: number): number {
  return Math.max(0, Math.min(1, (t - a) / (b - a)));
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VideosPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [format, setFormat] = useState<VideoFormat>('square');
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [search, setSearch] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const imgCache = useRef<Record<string, HTMLImageElement>>({});

  // ── Fetch offers ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth('/api/offers?limit=50&status=APPROVED');
        if (res.ok) {
          const data = await res.json();
          setOffers(data.offers ?? data ?? []);
        }
      } catch {
        // silencioso
      } finally {
        setLoadingOffers(false);
      }
    })();
  }, []);

  const filtered = offers.filter(o =>
    o.title.toLowerCase().includes(search.toLowerCase())
  );

  // ── Load image helper ───────────────────────────────────────────────────────
  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    if (imgCache.current[src]) return Promise.resolve(imgCache.current[src]);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { imgCache.current[src] = img; resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  // ── Draw one frame ──────────────────────────────────────────────────────────
  const drawFrame = useCallback(async (
    canvas: HTMLCanvasElement,
    offer: Offer,
    t: number,       // 0..1 progress of full animation (6s)
    productImg: HTMLImageElement | null,
  ) => {
    const fmt = FORMATS[format];
    const ctx = canvas.getContext('2d')!;
    const W = fmt.w;
    const H = fmt.h;
    canvas.width  = W;
    canvas.height = H;

    const isStory = format === 'story';

    // ── Background gradient ──────────────────────────────────────────────────
    const bgAlpha = easeOut(clamp(t, 0, 0.08));
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, `rgba(10,10,20,${bgAlpha})`);
    grad.addColorStop(1, `rgba(20,10,40,${bgAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ── Decorative circles ───────────────────────────────────────────────────
    if (bgAlpha > 0.5) {
      ctx.save();
      ctx.globalAlpha = 0.07 * bgAlpha;
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(W * 0.85, H * 0.15, W * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(W * 0.15, H * 0.85, W * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Product image ────────────────────────────────────────────────────────
    const imgAlpha = easeOut(clamp(t, 0.06, 0.22));
    const imgSlide = (1 - imgAlpha) * 60;
    if (productImg && imgAlpha > 0) {
      const imgAreaH = isStory ? H * 0.45 : H * 0.52;
      const imgAreaY = isStory ? H * 0.12 : H * 0.08;
      const imgAreaW = W * 0.88;
      const imgAreaX = (W - imgAreaW) / 2;

      const scale = Math.min(imgAreaW / productImg.width, imgAreaH / productImg.height);
      const sw = productImg.width * scale;
      const sh = productImg.height * scale;
      const sx = (W - sw) / 2;
      const sy = imgAreaY + (imgAreaH - sh) / 2 + imgSlide;

      ctx.save();
      ctx.globalAlpha = imgAlpha;
      // Rounded rect clip
      const r = 24;
      ctx.beginPath();
      ctx.moveTo(sx + r, sy); ctx.lineTo(sx + sw - r, sy);
      ctx.arcTo(sx + sw, sy, sx + sw, sy + r, r);
      ctx.lineTo(sx + sw, sy + sh - r);
      ctx.arcTo(sx + sw, sy + sh, sx + sw - r, sy + sh, r);
      ctx.lineTo(sx + r, sy + sh);
      ctx.arcTo(sx, sy + sh, sx, sy + sh - r, r);
      ctx.lineTo(sx, sy + r);
      ctx.arcTo(sx, sy, sx + r, sy, r);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(productImg, sx, sy, sw, sh);
      ctx.restore();
    }

    // ── Content area (bottom for story, below image for square) ─────────────
    const contentY = isStory ? H * 0.60 : H * 0.62;
    const pad = W * 0.07;

    // ── Product title ────────────────────────────────────────────────────────
    const titleAlpha = easeOut(clamp(t, 0.20, 0.32));
    const titleSlide = (1 - titleAlpha) * 30;
    if (titleAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = titleAlpha;
      ctx.fillStyle = '#ffffff';
      const fontSize = isStory ? 52 : 44;
      ctx.font = `700 ${fontSize}px -apple-system, 'Segoe UI', sans-serif`;
      ctx.textAlign = 'left';
      const maxW = W - pad * 2;
      const lines = wrapText(ctx, offer.title, maxW);
      const lineH = fontSize * 1.25;
      lines.slice(0, 3).forEach((line, i) => {
        ctx.fillText(line, pad, contentY + i * lineH + titleSlide);
      });
      ctx.restore();
    }

    // ── Price block ──────────────────────────────────────────────────────────
    const priceAlpha = easeOut(clamp(t, 0.30, 0.44));
    const priceSlide = (1 - priceAlpha) * 25;
    if (priceAlpha > 0) {
      const titleLines = (() => {
        const tmp = document.createElement('canvas').getContext('2d')!;
        tmp.font = `700 ${isStory ? 52 : 44}px sans-serif`;
        return Math.min(3, wrapText(tmp, offer.title, W - pad * 2).length);
      })();
      const priceY = contentY + titleLines * (isStory ? 65 : 55) + (isStory ? 28 : 20) + priceSlide;

      ctx.save();
      ctx.globalAlpha = priceAlpha;

      if (offer.originalPrice && offer.originalPrice > offer.finalPrice) {
        // Preço antigo riscado
        ctx.fillStyle = '#9ca3af';
        const oldFontSize = isStory ? 38 : 32;
        ctx.font = `400 ${oldFontSize}px -apple-system, sans-serif`;
        const oldText = `De ${fmtPrice(offer.originalPrice)}`;
        ctx.fillText(oldText, pad, priceY);

        // Linha sobre o preço antigo
        const oldW = ctx.measureText(oldText).width;
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pad, priceY - oldFontSize * 0.35);
        ctx.lineTo(pad + oldW, priceY - oldFontSize * 0.35);
        ctx.stroke();
      }

      // Preço atual em destaque
      const newFontSize = isStory ? 72 : 60;
      ctx.font = `800 ${newFontSize}px -apple-system, sans-serif`;
      const newY = priceY + (offer.originalPrice ? (isStory ? 58 : 48) : 0);
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`por ${fmtPrice(offer.finalPrice)}`, pad, newY);

      ctx.restore();
    }

    // ── Discount badge ───────────────────────────────────────────────────────
    const discPct = offer.discountPct
      ?? (offer.originalPrice && offer.originalPrice > offer.finalPrice
          ? Math.round((offer.originalPrice - offer.finalPrice) / offer.originalPrice * 100)
          : 0);

    const badgeAlpha = easeOut(clamp(t, 0.42, 0.56));
    const badgeScale = 0.6 + 0.4 * easeOut(clamp(t, 0.42, 0.56));
    if (discPct > 0 && badgeAlpha > 0) {
      const bW = isStory ? 380 : 320;
      const bH = isStory ? 80 : 66;
      const bX = pad;

      const titleLines = Math.min(3, wrapText({ measureText: (s: string) => ({ width: s.length * (isStory ? 30 : 25) }) } as any, offer.title, W - pad * 2).length);
      const priceBlockH = (offer.originalPrice ? (isStory ? 58 : 48) : 0) + (isStory ? 80 : 68);
      const bY = contentY + titleLines * (isStory ? 65 : 55) + (isStory ? 28 : 20) + priceBlockH + (isStory ? 22 : 16);

      ctx.save();
      ctx.globalAlpha = badgeAlpha;
      ctx.translate(bX + bW / 2, bY + bH / 2);
      ctx.scale(badgeScale, badgeScale);
      ctx.translate(-(bX + bW / 2), -(bY + bH / 2));

      // Badge background
      const bGrad = ctx.createLinearGradient(bX, bY, bX + bW, bY);
      bGrad.addColorStop(0, '#dc2626');
      bGrad.addColorStop(1, '#b91c1c');
      ctx.fillStyle = bGrad;
      const br = bH / 2;
      ctx.beginPath();
      ctx.moveTo(bX + br, bY);
      ctx.lineTo(bX + bW - br, bY);
      ctx.arcTo(bX + bW, bY, bX + bW, bY + bH, br);
      ctx.lineTo(bX + br, bY + bH);
      ctx.arcTo(bX, bY + bH, bX, bY, br);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      const bFontSize = isStory ? 38 : 32;
      ctx.font = `800 ${bFontSize}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`🔥 -${discPct}% DE DESCONTO`, bX + bW / 2, bY + bH / 2 + bFontSize * 0.36);
      ctx.restore();
    }

    // ── Rodapé: site URL + logo ──────────────────────────────────────────────
    const footerAlpha = easeOut(clamp(t, 0.54, 0.68));
    if (footerAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = footerAlpha;

      // Linha separadora
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pad, H - (isStory ? 110 : 90));
      ctx.lineTo(W - pad, H - (isStory ? 110 : 90));
      ctx.stroke();

      // URL do site
      ctx.fillStyle = '#a78bfa';
      const urlFontSize = isStory ? 34 : 28;
      ctx.font = `600 ${urlFontSize}px -apple-system, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`🌐 ${SITE_URL}`, pad, H - (isStory ? 68 : 54));

      // "Manu das Promoções" alinhado à direita
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      const brandFontSize = isStory ? 26 : 22;
      ctx.font = `400 ${brandFontSize}px -apple-system, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText('Manu das Promoções', W - pad, H - (isStory ? 68 : 54));

      ctx.restore();
    }
  }, [format]);

  // ── Live preview ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selected || !previewRef.current) return;
    let cancelled = false;
    let startTime: number | null = null;
    const DURATION = 6000;
    let productImg: HTMLImageElement | null = null;

    const imgSrc = selected.mainImage || selected.imageUrl;
    if (imgSrc) {
      loadImage(imgSrc).then(img => { productImg = img; }).catch(() => {});
    }

    const animate = (ts: number) => {
      if (cancelled) return;
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const t = Math.min(elapsed / DURATION, 1);

      if (previewRef.current) {
        drawFrame(previewRef.current, selected, t, productImg);
      }

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Loop preview
        startTime = null;
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [selected, format, drawFrame, loadImage]);

  // ── Generate & Download video ─────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!selected || !canvasRef.current) return;
    setRecording(true);
    setProgress(0);

    const fmt = FORMATS[format];
    const canvas = canvasRef.current;
    canvas.width  = fmt.w;
    canvas.height = fmt.h;

    const imgSrc = selected.mainImage || selected.imageUrl;
    let productImg: HTMLImageElement | null = null;
    if (imgSrc) {
      try { productImg = await loadImage(imgSrc); } catch {}
    }

    const DURATION = 6000; // ms
    const FPS = 30;
    const stream = canvas.captureStream(FPS);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const safeName = selected.title.replace(/[^a-z0-9]/gi, '_').substring(0, 40);
      a.download = `manu_promo_${safeName}.webm`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      setRecording(false);
      setProgress(0);
    };

    recorder.start(100);

    const startTime = performance.now();
    const renderLoop = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / DURATION, 1);
      setProgress(Math.round(t * 100));
      drawFrame(canvas, selected, t, productImg);
      if (t < 1) {
        requestAnimationFrame(renderLoop);
      } else {
        recorder.stop();
      }
    };
    requestAnimationFrame(renderLoop);
  }, [selected, format, drawFrame, loadImage]);

  // ── Instagram caption ────────────────────────────────────────────────────
  const instagramCaption = selected ? [
    selected.discountPct && selected.discountPct >= 30
      ? `🔥 DESCONTO INCRÍVEL!`
      : `🛒 OFERTA DO DIA!`,
    ``,
    selected.title,
    ``,
    selected.originalPrice && selected.originalPrice > selected.finalPrice
      ? `De ${fmtPrice(selected.originalPrice)}`
      : null,
    `por ${fmtPrice(selected.finalPrice)}`,
    selected.discountPct ? `🔥 -${selected.discountPct}% DE DESCONTO` : null,
    ``,
    `👉 Link na bio ou acesse:`,
    `🌐 ${SITE_URL}`,
    ``,
    `#promoção #desconto #oferta #economize #compras`,
  ].filter(l => l !== null).join('\n') : '';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          🎬 Gerador de Vídeos
        </h1>
        <p className="text-text-secondary mt-1">
          Crie cards animados para Instagram e X. Selecione um produto, escolha o formato e baixe o vídeo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: Offer list ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Selecionar Produto
            </h2>
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-3"
            />
            {loadingOffers ? (
              <div className="text-center py-8 text-text-muted text-sm animate-pulse">
                Carregando produtos...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">
                Nenhum produto encontrado.
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {filtered.map(offer => (
                  <button
                    key={offer.id}
                    onClick={() => setSelected(offer)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      selected?.id === offer.id
                        ? 'border-purple-500/50 bg-purple-500/10'
                        : 'border-border hover:border-border hover:bg-surface-hover'
                    }`}
                  >
                    {(offer.mainImage || offer.imageUrl) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={offer.mainImage || offer.imageUrl || ''}
                        alt=""
                        className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary font-medium leading-tight line-clamp-2">
                        {offer.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-emerald-400 text-xs font-bold">
                          {fmtPrice(offer.finalPrice)}
                        </span>
                        {offer.discountPct && offer.discountPct > 0 && (
                          <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded font-bold">
                            -{offer.discountPct}%
                          </span>
                        )}
                      </div>
                    </div>
                    {selected?.id === offer.id && (
                      <span className="text-purple-400 text-lg flex-shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Preview + Controls ─────────────────────────────────── */}
        <div className="space-y-4">

          {/* Format selector */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Formato do Vídeo
            </h2>
            <div className="flex gap-3">
              {(Object.keys(FORMATS) as VideoFormat[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-all ${
                    format === f
                      ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                      : 'border-border text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <span className="block text-xl mb-1">{FORMATS[f].icon}</span>
                  {FORMATS[f].label}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas preview */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Prévia Animada
            </h2>
            {!selected ? (
              <div className="flex items-center justify-center bg-background rounded-xl border border-dashed border-border h-64 text-text-muted text-sm">
                ← Selecione um produto para visualizar
              </div>
            ) : (
              <div className="flex justify-center">
                <canvas
                  ref={previewRef}
                  className={`rounded-xl border border-border bg-black ${
                    format === 'story' ? 'h-80' : 'h-72 w-72'
                  }`}
                  style={{
                    maxWidth: '100%',
                    aspectRatio: format === 'story' ? '9/16' : '1/1',
                  }}
                />
              </div>
            )}
          </div>

          {/* Download button */}
          {selected && (
            <button
              onClick={handleDownload}
              disabled={recording}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {recording ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Gerando vídeo... {progress}%
                </>
              ) : (
                <>⬇️ Baixar Vídeo ({FORMATS[format].label})</>
              )}
            </button>
          )}

          {/* Progress bar */}
          {recording && (
            <div className="h-2 rounded-full bg-surface border border-border overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Instagram caption */}
          {selected && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                  📸 Legenda para Instagram
                </h2>
                <button
                  onClick={() => navigator.clipboard.writeText(instagramCaption)}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors px-2 py-1 rounded border border-purple-500/30 hover:border-purple-400/50"
                >
                  Copiar
                </button>
              </div>
              <pre className="text-xs text-text-secondary font-sans whitespace-pre-wrap leading-relaxed bg-background rounded-lg p-3 border border-border max-h-48 overflow-y-auto">
                {instagramCaption}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for recording (full resolution) */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
