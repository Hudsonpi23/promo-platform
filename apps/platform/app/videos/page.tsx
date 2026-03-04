'use client';

import { useState, useRef, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────
interface ProductData {
  title:         string;
  finalPrice:    number;
  originalPrice: number | null;
  discountPct:   number;
  mainImage:     string | null;
  affiliateUrl:  string;
  store:         string;
}

type Step = 'idle' | 'scraping' | 'ready' | 'posting-x' | 'posting-ig' | 'done-x' | 'done-ig';

// ── Price formatter ────────────────────────────────────────────────────────
function fmtPrice(v?: number | null): string {
  if (!v) return '—';
  const hasDecimals = v % 1 !== 0;
  return v.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

// ── Instagram caption generator ────────────────────────────────────────────
function buildCaption(p: ProductData): string {
  const SITE = 'manu-promocoes.vercel.app';
  return [
    p.discountPct >= 30 ? '🔥 DESCONTO INCRÍVEL!' : '🛒 OFERTA DO DIA!',
    '',
    p.title,
    '',
    p.originalPrice && p.originalPrice > p.finalPrice ? `De ${fmtPrice(p.originalPrice)}` : null,
    `por ${fmtPrice(p.finalPrice)}`,
    p.discountPct > 0 ? `🔥 -${p.discountPct}% DE DESCONTO` : null,
    '',
    '👉 Link na bio ou acesse:',
    `🌐 ${SITE}`,
    '',
    '#promoção #desconto #oferta #economize #compras',
  ].filter(l => l !== null).join('\n');
}

// ── Component ──────────────────────────────────────────────────────────────
export default function VideosPage() {
  const [url, setUrl]             = useState('');
  const [step, setStep]           = useState<Step>('idle');
  const [product, setProduct]     = useState<ProductData | null>(null);
  const [scrapeError, setScrapeError] = useState('');

  // Video file
  const [videoFile, setVideoFile]     = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [dragOver, setDragOver]       = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // Results
  const [xResult, setXResult]     = useState<{ url?: string; error?: string } | null>(null);
  const [igResult, setIgResult]   = useState<{ url?: string; error?: string } | null>(null);

  // Caption copy feedback
  const [copied, setCopied]       = useState(false);

  // ── Scrape ───────────────────────────────────────────────────────────────
  const handleScrape = useCallback(async () => {
    if (!url.trim()) return;
    setStep('scraping');
    setScrapeError('');
    setProduct(null);
    setVideoFile(null);
    setVideoPreview('');
    setXResult(null);
    setIgResult(null);

    try {
      const res  = await fetchWithAuth('/api/auto-publish/scrape', {
        method: 'POST',
        body:   JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setScrapeError(data.error || 'Erro ao extrair dados do produto.');
        setStep('idle');
        return;
      }

      setProduct(data);
      setStep('ready');
    } catch (err: any) {
      setScrapeError(`Erro de conexão: ${err.message}`);
      setStep('idle');
    }
  }, [url]);

  // ── Handle video file ────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Selecione um arquivo de vídeo (mp4, webm, mov, etc.)');
      return;
    }
    if (file.size > 512 * 1024 * 1024) {
      alert('Vídeo muito grande (máx. 512 MB).');
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setXResult(null);
    setIgResult(null);
  }, []);

  // ── Post to X ────────────────────────────────────────────────────────────
  const handlePostX = useCallback(async () => {
    if (!product || !videoFile) return;
    setStep('posting-x');
    setXResult(null);

    const form = new FormData();
    form.append('video',         videoFile);
    form.append('title',         product.title);
    form.append('finalPrice',    product.finalPrice.toString());
    form.append('originalPrice', (product.originalPrice ?? 0).toString());
    form.append('discountPct',   product.discountPct.toString());
    form.append('affiliateUrl',  product.affiliateUrl);

    try {
      const res  = await fetchWithAuth('/api/video-publish/post-x', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setXResult({ error: data.error || 'Erro ao postar no X.' });
      } else {
        setXResult({ url: data.tweetUrl });
      }
    } catch (err: any) {
      setXResult({ error: err.message });
    } finally {
      setStep('ready');
    }
  }, [product, videoFile]);

  // ── Post to Instagram ────────────────────────────────────────────────────
  const handlePostInstagram = useCallback(async () => {
    if (!product || !videoFile) return;
    setStep('posting-ig');
    setIgResult(null);

    const form = new FormData();
    form.append('video',         videoFile);
    form.append('title',         product.title);
    form.append('finalPrice',    product.finalPrice.toString());
    form.append('originalPrice', (product.originalPrice ?? 0).toString());
    form.append('discountPct',   product.discountPct.toString());
    form.append('affiliateUrl',  product.affiliateUrl);
    form.append('caption',       buildCaption(product));

    try {
      const res  = await fetchWithAuth('/api/video-publish/post-instagram', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setIgResult({ error: data.error || 'Erro ao postar no Instagram.' });
      } else {
        setIgResult({ url: data.instagramUrl });
      }
    } catch (err: any) {
      setIgResult({ error: err.message });
    } finally {
      setStep('ready');
    }
  }, [product, videoFile]);

  // ── Copy caption ─────────────────────────────────────────────────────────
  const handleCopyCaption = useCallback(() => {
    if (!product) return;
    navigator.clipboard.writeText(buildCaption(product));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [product]);

  const isPosting = step === 'posting-x' || step === 'posting-ig';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          🎬 Publicar Vídeo
        </h1>
        <p className="text-text-secondary mt-1">
          Cole o link afiliado, extraia os dados do produto, faça upload do seu vídeo e publique no X ou Instagram.
        </p>
      </div>

      {/* ── STEP 1: URL input ─────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Link Afiliado do Produto
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScrape()}
            disabled={step === 'scraping'}
            placeholder="https://mercadolivre.com.br/produto/MLB... ou amzn.to/..."
            className="flex-1 px-4 py-3 rounded-lg bg-background border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
          />
          <button
            onClick={handleScrape}
            disabled={!url.trim() || step === 'scraping'}
            className="px-6 py-3 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 whitespace-nowrap"
          >
            {step === 'scraping' ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Extraindo...
              </>
            ) : '🔍 Extrair Dados'}
          </button>
        </div>

        {scrapeError && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            ✗ {scrapeError}
          </div>
        )}
      </div>

      {/* ── STEP 2: Product card + Video upload ───────────────────────── */}
      {product && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

          {/* Product info card */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
              Produto Extraído
            </h2>

            {product.mainImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.mainImage}
                alt={product.title}
                className="w-full h-48 object-contain rounded-lg bg-background mb-4 border border-border"
              />
            )}

            <p className="font-semibold text-text-primary text-sm leading-snug mb-3">
              {product.title}
            </p>

            <div className="flex items-center gap-3 mb-2">
              <span className="text-emerald-400 text-xl font-bold">
                {fmtPrice(product.finalPrice)}
              </span>
              {product.originalPrice && product.originalPrice > product.finalPrice && (
                <span className="text-text-muted text-sm line-through">
                  {fmtPrice(product.originalPrice)}
                </span>
              )}
            </div>

            {product.discountPct > 0 && (
              <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-sm font-bold px-3 py-1 rounded-full">
                🔥 -{product.discountPct}% DE DESCONTO
              </span>
            )}

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-text-muted truncate">
                🔗 {product.affiliateUrl.substring(0, 60)}...
              </p>
            </div>
          </div>

          {/* Video upload area */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
              Upload do Seu Vídeo
            </h2>

            {!videoFile ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-border hover:border-purple-500/50 hover:bg-surface-hover'
                }`}
              >
                <div className="text-4xl mb-3">🎬</div>
                <p className="text-sm font-medium text-text-primary mb-1">
                  Arraste o vídeo aqui
                </p>
                <p className="text-xs text-text-muted">
                  ou clique para selecionar
                </p>
                <p className="text-xs text-text-muted mt-2">
                  MP4, WebM, MOV • máx. 512 MB
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Video preview */}
                <video
                  src={videoPreview}
                  controls
                  className="w-full rounded-xl border border-border bg-black max-h-64 object-contain"
                />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-primary font-medium truncate max-w-[180px]">
                      {videoFile.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => { setVideoFile(null); setVideoPreview(''); setXResult(null); setIgResult(null); }}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/20 hover:border-red-400/40 transition-colors"
                  >
                    Trocar vídeo
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        </div>
      )}

      {/* ── STEP 3: Publish buttons ────────────────────────────────────── */}
      {product && videoFile && (
        <div className="space-y-4">

          {/* Post buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* X (Twitter) */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl font-bold text-text-primary">𝕏</span>
                <span className="text-sm font-semibold text-text-primary">Enviar para X (Twitter)</span>
              </div>
              <p className="text-xs text-text-muted mb-4">
                Posta o vídeo com a copy gerada automaticamente, link afiliado e link do site.
              </p>

              <button
                onClick={handlePostX}
                disabled={isPosting}
                className="w-full py-3 rounded-lg bg-black text-white font-semibold text-sm hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {step === 'posting-x' ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Enviando vídeo... (pode demorar)
                  </>
                ) : '𝕏 Publicar no X'}
              </button>

              {xResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  xResult.url
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}>
                  {xResult.url ? (
                    <>✓ Publicado! <a href={xResult.url} target="_blank" rel="noreferrer" className="underline">Ver tweet →</a></>
                  ) : (
                    <>✗ {xResult.error}</>
                  )}
                </div>
              )}
            </div>

            {/* Instagram */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📸</span>
                <span className="text-sm font-semibold text-text-primary">Enviar para Instagram</span>
              </div>
              <p className="text-xs text-text-muted mb-4">
                Posta o vídeo como Reels via Instagram Graph API. Requer conta business configurada.
              </p>

              <button
                onClick={handlePostInstagram}
                disabled={isPosting}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {step === 'posting-ig' ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Publicando no Instagram...
                  </>
                ) : '📸 Publicar no Instagram'}
              </button>

              {igResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  igResult.url
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}>
                  {igResult.url ? (
                    <>✓ Publicado! <a href={igResult.url} target="_blank" rel="noreferrer" className="underline">Ver post →</a></>
                  ) : (
                    <>✗ {igResult.error}</>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Instagram caption */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                📝 Legenda Gerada para Instagram
              </h2>
              <button
                onClick={handleCopyCaption}
                className="text-xs px-3 py-1.5 rounded-lg border border-purple-500/30 text-purple-400 hover:border-purple-400/50 hover:text-purple-300 transition-colors"
              >
                {copied ? '✓ Copiado!' : 'Copiar'}
              </button>
            </div>
            <pre className="text-xs text-text-secondary font-sans whitespace-pre-wrap leading-relaxed bg-background rounded-lg p-4 border border-border">
              {buildCaption(product)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
