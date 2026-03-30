'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────

type JobStatus =
  | 'PENDING' | 'SCORING' | 'RENDERING' | 'UPLOADING'
  | 'PUBLISHING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

interface ProductPreview {
  title: string;
  finalPrice: number;
  originalPrice: number | null;
  discountPct: number;
  imageUrl: string | null;
  source: 'amazon' | 'mercadolivre';
}

interface SlidesPreview {
  slideUrls: string[];
  caption: string;
}

interface InstagramJob {
  id: string;
  status: JobStatus;
  aiScore: number | null;
  slideUrls: string[];
  captionUsed: string | null;
  errorMessage: string | null;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  metricViews: number;
  metricLikes: number;
  metricSaves: number;
  triggeredBy: string;
  offer?: {
    title: string;
    finalPrice: number;
    mainImage: string | null;
    imageUrl: string | null;
  };
}

type Step = 'url' | 'product' | 'slides' | 'done';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPrice(v?: number | null) {
  if (!v) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string; dot: string; spin?: boolean }> = {
  PENDING:    { label: 'Na fila',       color: 'text-slate-300',  bg: 'bg-slate-800',      dot: 'bg-slate-400' },
  SCORING:    { label: 'IA avaliando',  color: 'text-purple-300', bg: 'bg-purple-900/40',  dot: 'bg-purple-400', spin: true },
  RENDERING:  { label: 'Gerando slides',color: 'text-blue-300',   bg: 'bg-blue-900/40',    dot: 'bg-blue-400',   spin: true },
  UPLOADING:  { label: 'Enviando',      color: 'text-cyan-300',   bg: 'bg-cyan-900/40',    dot: 'bg-cyan-400',   spin: true },
  PUBLISHING: { label: 'Publicando',    color: 'text-orange-300', bg: 'bg-orange-900/40',  dot: 'bg-orange-400', spin: true },
  SUCCESS:    { label: '✅ Publicado',  color: 'text-green-300',  bg: 'bg-green-900/40',   dot: 'bg-green-400' },
  FAILED:     { label: '❌ Falhou',     color: 'text-red-300',    bg: 'bg-red-900/40',     dot: 'bg-red-400' },
  CANCELLED:  { label: 'Cancelado',     color: 'text-gray-400',   bg: 'bg-gray-800',       dot: 'bg-gray-500' },
};

function StatusBadge({ status }: { status: JobStatus }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${c.bg} ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${c.spin ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner({ text }: { text: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
      {text}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════

export default function InstagramPage() {
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; username?: string }>>([]);

  // Fluxo de publicação
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [fetchingProduct, setFetchingProduct] = useState(false);
  const [product, setProduct] = useState<ProductPreview | null>(null);
  const [theme, setTheme] = useState<'dark' | 'medium' | 'light'>('dark');
  const [generatingSlides, setGeneratingSlides] = useState(false);
  const [slides, setSlides] = useState<SlidesPreview | null>(null);
  const [caption, setCaption] = useState('');
  const [publishingManual, setPublishingManual] = useState(false);
  const [publishingAI, setPublishingAI] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; manual?: boolean; postId?: string; jobId?: string; slideUrls?: string[]; error?: string } | null>(null);
  const [error, setError] = useState('');

  // Fila de jobs
  const [jobs, setJobs] = useState<InstagramJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // ── Load contas ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchWithAuth('/api/instagram/accounts')
      .then(r => r.json())
      .then(d => setAccounts(Array.isArray(d.accounts) ? d.accounts : []))
      .catch(() => {});
  }, []);

  // ── Fila ─────────────────────────────────────────────────────────────────────

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await fetchWithAuth('/api/instagram/jobs');
      const data = await res.json();
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch { /* silencioso */ }
    finally { setJobsLoading(false); }
  }, []);

  useEffect(() => {
    loadJobs();
    const t = setInterval(loadJobs, 8000);
    return () => clearInterval(t);
  }, [loadJobs]);

  // ── Passo 1: Buscar produto ───────────────────────────────────────────────────

  async function handleFetchProduct() {
    const trimmed = url.trim();
    if (!trimmed) return;

    const isAmazon = trimmed.includes('amazon.com') || trimmed.includes('amzn');
    const isML = trimmed.includes('mercadolivre.com') || trimmed.includes('mercadolibre.com');
    if (!isAmazon && !isML) {
      setError('Cole uma URL da Amazon ou do Mercado Livre');
      return;
    }

    setFetchingProduct(true);
    setError('');
    setProduct(null);
    setSlides(null);
    setPublishResult(null);

    try {
      const endpoint = isAmazon ? '/api/amazon/product-from-url' : '/api/affiliates/generate';
      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Não foi possível buscar o produto.'); return; }

      let prod: ProductPreview | null = null;
      if (isAmazon) {
        const p = data.product;
        if (p?.title) prod = {
          title: p.title,
          finalPrice: p.finalPrice ?? p.price ?? 0,
          originalPrice: p.originalPrice ?? null,
          discountPct: p.discountPct ?? 0,
          imageUrl: p.images?.primary ?? null,
          source: 'amazon',
        };
      } else {
        const p = data.data?.product;
        if (p?.title) prod = {
          title: p.title,
          finalPrice: p.price ?? 0,
          originalPrice: p.original_price ?? null,
          discountPct: p.discount_percentage ?? 0,
          imageUrl: p.thumbnail ?? null,
          source: 'mercadolivre',
        };
      }

      if (!prod) { setError('Produto não encontrado nessa URL. Tente outra.'); return; }
      setProduct(prod);
      setStep('product');
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setFetchingProduct(false);
    }
  }

  // ── Passo 2: Gerar slides (preview) ──────────────────────────────────────────

  async function handleGenerateSlides() {
    setGeneratingSlides(true);
    setSlides(null);
    setError('');
    try {
      const res = await fetchWithAuth('/api/instagram/preview-slides', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim(), theme }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao gerar slides.'); return; }
      setSlides({ slideUrls: data.slideUrls, caption: data.caption });
      setCaption(data.caption || '');
      setStep('slides');
    } catch {
      setError('Erro ao gerar slides. Tente novamente.');
    } finally {
      setGeneratingSlides(false);
    }
  }

  // ── Passo 3a: Publicar manualmente (direto) ───────────────────────────────────

  async function handlePublishManual() {
    setPublishingManual(true);
    setError('');
    try {
      const res = await fetchWithAuth('/api/instagram/publish-now', {
        method: 'POST',
        body: JSON.stringify({
          url: url.trim(),
          caption: caption.trim() || undefined,
          slideUrls: slides?.slideUrls?.length ? slides.slideUrls : undefined,
          theme,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao publicar.'); return; }
      setPublishResult({ success: true, manual: true, postId: data.postId, slideUrls: data.slideUrls });
      setStep('done');
      await loadJobs();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setPublishingManual(false);
    }
  }

  // ── Passo 3b: Publicar com IA ─────────────────────────────────────────────────

  async function handlePublishAI() {
    setPublishingAI(true);
    setError('');
    try {
      const res = await fetchWithAuth('/api/instagram/from-url', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim(), theme }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao enfileirar.'); return; }
      setPublishResult({ success: true, manual: false, jobId: data.jobId });
      setStep('done');
      await loadJobs();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setPublishingAI(false);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────────

  function reset() {
    setStep('url');
    setUrl('');
    setProduct(null);
    setSlides(null);
    setCaption('');
    setPublishResult(null);
    setError('');
  }

  const accountConnected = accounts.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-2xl shadow-lg">
            📸
          </div>
          <div>
            <h1 className="text-2xl font-bold">Publicar no Instagram</h1>
            <p className={`text-sm ${accountConnected ? 'text-green-400' : 'text-amber-400'}`}>
              {accountConnected
                ? `✅ @${accounts[0]?.username || 'manudasPromocoes'} conectado`
                : '⚠️ Nenhuma conta Instagram conectada'}
            </p>
          </div>
        </div>

        {/* ════ STEP INDICATOR ════════════════════════════════════════════════ */}
        <div className="flex items-center gap-0">
          {[
            { key: 'url', num: 1, label: 'URL' },
            { key: 'product', num: 2, label: 'Produto' },
            { key: 'slides', num: 3, label: 'Preview' },
            { key: 'done', num: 4, label: 'Publicado' },
          ].map((s, i, arr) => {
            const steps: Step[] = ['url', 'product', 'slides', 'done'];
            const current = steps.indexOf(step);
            const me = steps.indexOf(s.key as Step);
            const done = me < current;
            const active = me === current;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    done ? 'bg-green-500 text-white' : active ? 'bg-purple-600 text-white ring-2 ring-purple-400 ring-offset-2 ring-offset-gray-950' : 'bg-gray-800 text-gray-500'
                  }`}>
                    {done ? '✓' : s.num}
                  </div>
                  <span className={`text-xs mt-1 font-semibold ${active ? 'text-purple-300' : done ? 'text-green-400' : 'text-gray-600'}`}>{s.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-5 transition-all ${done ? 'bg-green-500' : 'bg-gray-800'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ════ STEP 1: Cole a URL ════════════════════════════════════════════ */}
        {step === 'url' && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Cole a URL do produto</h2>
              <p className="text-gray-400 text-sm">Amazon ou Mercado Livre</p>
            </div>
            <div className="flex gap-3">
              <input
                type="url"
                placeholder="https://www.amazon.com.br/... ou https://produto.mercadolivre.com.br/..."
                value={url}
                onChange={e => { setUrl(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleFetchProduct()}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={handleFetchProduct}
                disabled={fetchingProduct || !url.trim()}
                className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all whitespace-nowrap"
              >
                {fetchingProduct ? <Spinner text="Buscando..." /> : '🔍 Buscar'}
              </button>
            </div>
            {error && <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-4 py-2">{error}</p>}
          </div>
        )}

        {/* ════ STEP 2: Produto encontrado ════════════════════════════════════ */}
        {step === 'product' && product && (
          <div className="space-y-4">
            {/* Card produto */}
            <div className="bg-gray-900 rounded-2xl border border-green-800/40 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-green-400 text-sm font-bold">✅ Produto encontrado</span>
                <button onClick={reset} className="ml-auto text-xs text-gray-500 hover:text-white transition-colors">← Trocar URL</button>
              </div>
              <div className="flex gap-4">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.title} className="w-28 h-28 object-contain rounded-xl bg-white flex-shrink-0 shadow" />
                ) : (
                  <div className="w-28 h-28 bg-gray-700 rounded-xl flex items-center justify-center text-4xl flex-shrink-0">🛍️</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white leading-snug line-clamp-3 mb-3">{product.title}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-2xl font-black text-amber-400">{fmtPrice(product.finalPrice)}</span>
                    {product.discountPct > 0 && (
                      <>
                        {product.originalPrice && <span className="text-gray-500 line-through text-sm">{fmtPrice(product.originalPrice)}</span>}
                        <span className="bg-orange-500/20 text-orange-400 text-sm font-bold px-2 py-0.5 rounded-full">-{product.discountPct}% OFF</span>
                      </>
                    )}
                  </div>
                  <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${
                    product.source === 'amazon' ? 'bg-amber-900/30 text-amber-400' : 'bg-yellow-900/30 text-yellow-400'
                  }`}>
                    {product.source === 'amazon' ? '📦 Amazon' : '🛒 Mercado Livre'}
                  </span>
                </div>
              </div>
            </div>

            {/* Seletor de tema */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h3 className="font-bold text-white mb-1">🎨 Escolha o tema do carrossel</h3>
              <p className="text-gray-400 text-xs mb-3">Selecione antes de gerar o preview</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'dark',   label: 'Azul Escuro',  desc: 'Original', preview: 'from-blue-900 to-slate-900', accent: 'bg-amber-400' },
                  { id: 'medium', label: 'Azul Médio',   desc: 'Mais claro', preview: 'from-blue-600 to-blue-800', accent: 'bg-yellow-300' },
                  { id: 'light',  label: 'Branco & Azul', desc: 'Clarinho', preview: 'from-sky-100 to-white', accent: 'bg-blue-700' },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id); setSlides(null); }}
                    className={`rounded-xl border-2 p-3 transition-all text-left ${
                      theme === t.id ? 'border-purple-500 ring-2 ring-purple-400/40' : 'border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <div className={`w-full h-10 rounded-lg bg-gradient-to-br ${t.preview} mb-2 flex items-center justify-center gap-1`}>
                      <div className={`w-3 h-3 rounded-full ${t.accent}`} />
                      <div className="w-8 h-1.5 rounded bg-white/60" />
                    </div>
                    <p className="text-white text-xs font-bold">{t.label}</p>
                    <p className="text-gray-500 text-xs">{t.desc}</p>
                    {theme === t.id && <p className="text-purple-400 text-xs font-bold mt-0.5">✓ Selecionado</p>}
                  </button>
                ))}
              </div>
            </div>

            {/* Ação: gerar preview dos slides */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h3 className="font-bold text-white mb-1">Quer ver o carrossel antes de publicar?</h3>
              <p className="text-gray-400 text-sm mb-4">Gera os 4 slides do Instagram para você conferir. Leva ~15 segundos.</p>
              <button
                onClick={handleGenerateSlides}
                disabled={generatingSlides}
                className="w-full py-3 rounded-xl font-bold text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white transition-all"
              >
                {generatingSlides ? <Spinner text="Gerando slides... (~15s)" /> : '🖼️ Gerar Preview dos Slides'}
              </button>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-4 py-2">{error}</p>}

            {/* Publicar direto sem preview */}
            <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-4">
              <p className="text-gray-400 text-xs mb-3">Ou publique direto sem ver o preview:</p>
              <div className="flex gap-3">
                <button
                  onClick={handlePublishManual}
                  disabled={publishingManual || !accountConnected}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white transition-all"
                >
                  {publishingManual ? <Spinner text="Publicando..." /> : '📲 Publicar Agora (Manual)'}
                </button>
                <button
                  onClick={handlePublishAI}
                  disabled={publishingAI || !accountConnected}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white transition-all"
                >
                  {publishingAI ? <Spinner text="Enfileirando..." /> : '🤖 Publicar com IA'}
                </button>
              </div>
              {!accountConnected && <p className="text-amber-400 text-xs text-center mt-2">⚠️ Conta Instagram não conectada</p>}
            </div>
          </div>
        )}

        {/* ════ STEP 3: Preview dos slides ════════════════════════════════════ */}
        {step === 'slides' && slides && product && (
          <div className="space-y-4">

            {/* Slides */}
            <div className="bg-gray-900 rounded-2xl border border-purple-800/40 p-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-bold text-white text-lg">Slides do Carrossel</h2>
                <span className="text-xs text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded-full">{slides.slideUrls.length} slides</span>
                <button onClick={() => setStep('product')} className="ml-auto text-xs text-gray-500 hover:text-white transition-colors">← Voltar</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {slides.slideUrls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="group relative block">
                    <img src={u} alt={`Slide ${i + 1}`} className="w-full aspect-square object-cover rounded-xl border border-gray-700 group-hover:border-purple-500 transition-colors" />
                    <span className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-lg font-bold">{i + 1}</span>
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl text-white text-xs font-bold">
                      🔍 Ampliar
                    </span>
                  </a>
                ))}
              </div>
              <p className="text-gray-500 text-xs">Clique em qualquer slide para ampliar</p>
            </div>

            {/* Caption editável */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h3 className="font-bold text-white mb-1">Caption</h3>
              <p className="text-gray-400 text-xs mb-3">Gerada automaticamente. Você pode editar antes de publicar.</p>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                rows={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-purple-500 transition-colors resize-none"
              />
              <p className="text-gray-600 text-xs mt-1 text-right">{caption.length} caracteres</p>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-4 py-2">{error}</p>}

            {/* Botões de publicação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handlePublishManual}
                disabled={publishingManual || !accountConnected}
                className="py-4 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-lg"
              >
                {publishingManual ? <Spinner text="Publicando agora..." /> : '📲 Publicar Agora (Manual)'}
              </button>
              <button
                onClick={handlePublishAI}
                disabled={publishingAI || !accountConnected}
                className="py-4 rounded-xl font-bold text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white border border-gray-600 transition-all"
              >
                {publishingAI ? <Spinner text="Enfileirando com IA..." /> : '🤖 Publicar com IA'}
              </button>
            </div>

            {!accountConnected && (
              <p className="text-amber-400 text-sm text-center">⚠️ Conta Instagram não conectada no Postfor.me</p>
            )}

            {/* Info IA */}
            <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl px-4 py-3">
              <p className="text-blue-300 text-xs font-semibold mb-1">Qual a diferença?</p>
              <p className="text-blue-400/70 text-xs">
                <strong className="text-purple-300">📲 Manual:</strong> Publica agora com esses slides e essa caption. Você controla tudo. Resultado em ~5 segundos.
              </p>
              <p className="text-blue-400/70 text-xs mt-1">
                <strong className="text-blue-300">🤖 Com IA:</strong> A IA avalia o produto, cria uma caption melhor e publica. Pode levar 1-2 minutos. Retry automático se falhar.
              </p>
            </div>
          </div>
        )}

        {/* ════ STEP 4: Publicado ════════════════════════════════════════════ */}
        {step === 'done' && publishResult?.success && (
          <div className="space-y-4">
            <div className={`rounded-2xl border p-6 ${publishResult.manual ? 'bg-green-950/40 border-green-700' : 'bg-purple-950/40 border-purple-700'}`}>
              <div className="text-4xl mb-3">{publishResult.manual ? '✅' : '🤖'}</div>
              <h2 className="text-xl font-bold text-white mb-2">
                {publishResult.manual ? 'Publicado no Instagram!' : 'Enfileirado com sucesso!'}
              </h2>
              <p className={`text-sm ${publishResult.manual ? 'text-green-300' : 'text-purple-300'}`}>
                {publishResult.manual
                  ? 'O carrossel foi publicado diretamente no Instagram via Postfor.me.'
                  : 'A IA está avaliando o produto. Em breve vai gerar os slides e publicar. Acompanhe na fila abaixo.'}
              </p>

              {/* Slides publicados (manual) */}
              {publishResult.slideUrls && publishResult.slideUrls.length > 0 && (
                <div className="flex gap-2 mt-4 overflow-x-auto">
                  {publishResult.slideUrls.map((u, i) => (
                    <img key={i} src={u} alt={`Slide ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-green-700 flex-shrink-0" />
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={reset}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 transition-all"
            >
              ➕ Publicar outro produto
            </button>
          </div>
        )}

        {/* ════ FILA DE PUBLICAÇÕES ════════════════════════════════════════════ */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-300">📋 Histórico de Publicações</h2>
            <button
              onClick={loadJobs}
              className="text-gray-500 hover:text-white text-xs px-3 py-1.5 bg-gray-800 rounded-full border border-gray-700 transition-colors"
            >
              🔄 Atualizar
            </button>
          </div>

          {jobsLoading && jobs.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl py-10 text-center">
              <div className="text-3xl mb-2 opacity-20">📋</div>
              <p className="text-gray-500 text-sm">Nenhuma publicação ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => (
                <div key={job.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-800/50 transition-colors"
                  >
                    {(job.offer?.mainImage || job.offer?.imageUrl) ? (
                      <img src={job.offer.mainImage || job.offer.imageUrl!} alt="" className="w-11 h-11 rounded-lg object-contain bg-white flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">🛍️</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{job.offer?.title || `Job ${job.id.slice(-8)}`}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <StatusBadge status={job.status} />
                        {job.triggeredBy === 'manual' && <span className="text-xs text-purple-400">📲 manual</span>}
                        {job.aiScore !== null && (
                          <span className="text-xs text-gray-500">Score IA: <span className={job.aiScore >= 70 ? 'text-green-400' : job.aiScore >= 40 ? 'text-amber-400' : 'text-red-400'}>{job.aiScore}</span></span>
                        )}
                        <span className="text-xs text-gray-600">{timeAgo(job.createdAt)}</span>
                      </div>
                    </div>
                    {job.status === 'SUCCESS' && (job.metricViews > 0 || job.metricLikes > 0) && (
                      <div className="flex gap-2 text-xs text-gray-400 flex-shrink-0">
                        {job.metricViews > 0 && <span>👁️ {job.metricViews.toLocaleString()}</span>}
                        {job.metricLikes > 0 && <span>❤️ {job.metricLikes}</span>}
                      </div>
                    )}
                    <span className="text-gray-600 text-xs flex-shrink-0">{expandedJob === job.id ? '▲' : '▼'}</span>
                  </button>

                  {expandedJob === job.id && (
                    <div className="border-t border-gray-800 p-4 space-y-3">
                      {job.slideUrls?.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto">
                          {job.slideUrls.map((u, i) => (
                            <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                              <img src={u} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-700 hover:border-purple-500 transition-colors flex-shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                      {job.captionUsed && (
                        <div className="bg-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono max-h-24 overflow-y-auto whitespace-pre-wrap">{job.captionUsed}</div>
                      )}
                      {job.errorMessage && (
                        <div className="bg-red-950/40 border border-red-800 rounded-xl p-3">
                          <p className="text-red-300 text-xs font-semibold">Erro</p>
                          <p className="text-red-400/80 text-xs font-mono mt-0.5">{job.errorMessage}</p>
                          {job.nextRetryAt && <p className="text-orange-400 text-xs mt-1">Próxima tentativa: {new Date(job.nextRetryAt).toLocaleTimeString('pt-BR')}</p>}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {['PENDING', 'FAILED'].includes(job.status) && (
                          <button
                            onClick={async () => {
                              if (!confirm('Cancelar este job?')) return;
                              await fetchWithAuth(`/api/instagram/jobs/${job.id}`, { method: 'DELETE' });
                              loadJobs();
                            }}
                            className="text-xs px-3 py-1.5 bg-red-900/30 text-red-300 border border-red-800 rounded-lg hover:bg-red-900/50 transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                        <span className="text-xs text-gray-600 ml-auto font-mono">{job.id.slice(-10)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
