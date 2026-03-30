'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Offer {
  id: string;
  title: string;
  finalPrice: number;
  originalPrice: number | null;
  discountPct: number;
  imageUrl: string | null;
  mainImage: string | null;
  niche?: { name: string };
  store?: { name: string };
}

interface InstagramJob {
  id: string;
  status: JobStatus;
  format: 'CAROUSEL' | 'REEL' | 'STORY';
  aiScore: number | null;
  aiReasoning: string | null;
  aiChosenFormat: string | null;
  aiCaption: string | null;
  slideUrls: string[];
  captionUsed: string | null;
  postformePostId: string | null;
  postformeStatus: string | null;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  nextRetryAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  triggeredBy: string;
  metricViews: number;
  metricLikes: number;
  metricSaves: number;
  metricReach: number;
  offer?: {
    id: string;
    title: string;
    finalPrice: number;
    discountPct: number;
    mainImage: string | null;
    imageUrl: string | null;
  };
}

interface MetricsSummary {
  summary: {
    totalPublished: number;
    totalViews: number;
    totalLikes: number;
    totalSaves: number;
  };
  statusBreakdown: Record<string, number>;
  topPosts: InstagramJob[];
  recent: InstagramJob[];
}

type JobStatus =
  | 'PENDING' | 'SCORING' | 'RENDERING' | 'UPLOADING'
  | 'PUBLISHING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

// ── Helpers ────────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api-manu.onrender.com';

function fmtPrice(v?: number | null) {
  if (!v) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: v % 1 !== 0 ? 2 : 0 });
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
  PENDING:    { label: 'Na fila',    color: 'text-slate-300',  bg: 'bg-slate-800',   dot: 'bg-slate-400' },
  SCORING:    { label: 'IA Score',   color: 'text-purple-300', bg: 'bg-purple-900/40', dot: 'bg-purple-400', spin: true },
  RENDERING:  { label: 'Gerando',    color: 'text-blue-300',   bg: 'bg-blue-900/40', dot: 'bg-blue-400',   spin: true },
  UPLOADING:  { label: 'Upload',     color: 'text-cyan-300',   bg: 'bg-cyan-900/40', dot: 'bg-cyan-400',   spin: true },
  PUBLISHING: { label: 'Publicando', color: 'text-orange-300', bg: 'bg-orange-900/40',dot: 'bg-orange-400',spin: true },
  SUCCESS:    { label: 'Publicado',  color: 'text-green-300',  bg: 'bg-green-900/40',dot: 'bg-green-400' },
  FAILED:     { label: 'Falhou',     color: 'text-red-300',    bg: 'bg-red-900/40',  dot: 'bg-red-400' },
  CANCELLED:  { label: 'Cancelado',  color: 'text-gray-400',   bg: 'bg-gray-800',    dot: 'bg-gray-500' },
};

function StatusBadge({ status }: { status: JobStatus }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${c.spin ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

type Tab = 'enqueue' | 'jobs' | 'metrics';

// ══════════════════════════════════════════════════════════════════════════════
export default function InstagramPage() {
  const [tab, setTab] = useState<Tab>('enqueue');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; username?: string }>>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [enqueueing, setEnqueueing] = useState(false);
  const [enqueueResult, setEnqueueResult] = useState<{ success: boolean; jobId?: string; error?: string } | null>(null);
  const [previewData, setPreviewData] = useState<{
    slideUrls: string[];
    caption: string;
    ai: { score: number; format: string; shouldPublish: boolean; reasoning: string };
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Jobs tab
  const [jobs, setJobs] = useState<InstagramJob[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobFilter, setJobFilter] = useState<JobStatus | ''>('');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Metrics tab
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // ── Load inicial ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [accRes, offRes] = await Promise.all([
          fetchWithAuth(`${API}/api/instagram/accounts`),
          fetchWithAuth(`${API}/api/offers?limit=100&status=ACTIVE`),
        ]);
        const accData = await accRes.json();
        const offData = await offRes.json();
        setAccounts(accData.accounts || []);
        setOffers(offData.offers || offData || []);
      } catch { /* silencioso */ }
    }
    setOffersLoading(true);
    load().finally(() => setOffersLoading(false));
  }, []);

  // Auto-refresh jobs quando tab estiver aberta
  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const url = `${API}/api/instagram/jobs${jobFilter ? `?status=${jobFilter}` : ''}`;
      const res = await fetchWithAuth(url);
      const data = await res.json();
      setJobs(data.jobs || []);
      setJobsTotal(data.total || 0);
    } catch { /* silencioso */ }
    finally { setJobsLoading(false); }
  }, [jobFilter]);

  useEffect(() => {
    if (tab === 'jobs') {
      loadJobs();
      const t = setInterval(loadJobs, 8000); // refresh a cada 8s
      return () => clearInterval(t);
    }
  }, [tab, loadJobs]);

  useEffect(() => {
    if (tab === 'metrics') {
      setMetricsLoading(true);
      fetchWithAuth(`${API}/api/instagram/metrics`)
        .then(r => r.json())
        .then(setMetrics)
        .catch(() => {})
        .finally(() => setMetricsLoading(false));
    }
  }, [tab]);

  // ── Preview ─────────────────────────────────────────────────────────────────

  async function handlePreview() {
    if (!selectedOffer) return;
    setPreviewing(true);
    setPreviewData(null);
    try {
      const res = await fetchWithAuth(`${API}/api/instagram/carousel/preview/${selectedOffer.id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Erro ao gerar preview');
      setPreviewData(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPreviewing(false);
    }
  }

  // ── Enqueue ─────────────────────────────────────────────────────────────────

  async function handleEnqueue() {
    if (!selectedOffer) return;
    setEnqueueing(true);
    setEnqueueResult(null);
    try {
      const res = await fetchWithAuth(`${API}/api/instagram/enqueue/${selectedOffer.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: 'manual' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enfileirar');
      setEnqueueResult({ success: true, jobId: data.jobId });
    } catch (err: any) {
      setEnqueueResult({ success: false, error: err.message });
    } finally {
      setEnqueueing(false);
    }
  }

  // ── Cancel job ──────────────────────────────────────────────────────────────

  async function handleCancelJob(jobId: string) {
    if (!confirm('Cancelar este job?')) return;
    await fetchWithAuth(`${API}/api/instagram/jobs/${jobId}`, { method: 'DELETE' });
    loadJobs();
  }

  const filteredOffers = offers
    .filter(o => o.title.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 25);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-2xl shadow-lg">
            📸
          </div>
          <div>
            <h1 className="text-2xl font-bold">Instagram — Pipeline Inteligente</h1>
            <p className="text-gray-400 text-sm">
              {accounts.length > 0
                ? `✅ @${accounts[0]?.username || 'manudaspromocoes'} conectado`
                : '⚠️ Nenhuma conta conectada'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-0">
          {([
            { id: 'enqueue', label: '🚀 Enfileirar' },
            { id: 'jobs',    label: '⚡ Fila de Jobs' },
            { id: 'metrics', label: '📊 Métricas' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 ${
                tab === t.id
                  ? 'border-purple-500 text-purple-300 bg-purple-900/20'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ TAB: ENQUEUE ══════════════════════════════════════════════════════ */}
        {tab === 'enqueue' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Esquerda: seleção + ação */}
            <div className="space-y-5">

              {/* Busca de oferta */}
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                <h2 className="font-semibold text-gray-200 mb-4">🛍️ Selecionar Oferta</h2>
                <input
                  type="text"
                  placeholder="Buscar oferta..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-3"
                />
                {offersLoading ? (
                  <p className="text-gray-500 text-sm text-center py-6">Carregando ofertas...</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {filteredOffers.map(offer => (
                      <button
                        key={offer.id}
                        onClick={() => { setSelectedOffer(offer); setPreviewData(null); setEnqueueResult(null); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          selectedOffer?.id === offer.id
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                        }`}
                      >
                        {(offer.mainImage || offer.imageUrl) ? (
                          <img src={offer.mainImage || offer.imageUrl!} alt="" className="w-12 h-12 object-contain rounded-lg bg-white flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center text-xl flex-shrink-0">🛍️</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{offer.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-amber-400">{fmtPrice(offer.finalPrice)}</span>
                            {offer.discountPct > 0 && (
                              <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-bold">
                                -{offer.discountPct}%
                              </span>
                            )}
                            {offer.store && <span className="text-xs text-gray-500">{offer.store.name}</span>}
                          </div>
                        </div>
                        {selectedOffer?.id === offer.id && <span className="text-purple-400 text-sm flex-shrink-0">✓</span>}
                      </button>
                    ))}
                    {filteredOffers.length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-6">Nenhuma oferta encontrada</p>
                    )}
                  </div>
                )}
              </div>

              {/* Ações */}
              {selectedOffer && (
                <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-3">
                  <h2 className="font-semibold text-gray-200 mb-1">⚡ Ações</h2>

                  {/* Preview */}
                  <button
                    onClick={handlePreview}
                    disabled={previewing}
                    className="w-full py-3 rounded-xl font-semibold text-sm bg-gray-700 hover:bg-gray-600 text-white transition-all disabled:opacity-50"
                  >
                    {previewing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⏳</span> Gerando preview...
                      </span>
                    ) : '🔍 Ver Preview dos Slides + Score IA'}
                  </button>

                  {/* Enqueue */}
                  <button
                    onClick={handleEnqueue}
                    disabled={enqueueing || !!enqueueResult?.success || accounts.length === 0}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      enqueueResult?.success
                        ? 'bg-green-700 text-white'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg'
                    }`}
                  >
                    {enqueueing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⏳</span> Enfileirando...
                      </span>
                    ) : enqueueResult?.success
                      ? '✅ Enfileirado! Worker vai publicar em breve'
                      : '🚀 Enfileirar para Instagram'}
                  </button>

                  {enqueueResult?.success && (
                    <div className="bg-green-950/50 border border-green-800 rounded-xl p-3">
                      <p className="text-green-300 text-sm font-semibold">✅ Job criado com sucesso!</p>
                      <p className="text-green-400/70 text-xs mt-1">
                        ID: <code className="font-mono">{enqueueResult.jobId}</code>
                      </p>
                      <p className="text-green-400/70 text-xs">
                        A IA vai avaliar, gerar os slides e publicar automaticamente. Acompanhe em{' '}
                        <button onClick={() => setTab('jobs')} className="underline text-green-300">Fila de Jobs</button>.
                      </p>
                    </div>
                  )}

                  {enqueueResult?.success === false && (
                    <div className="bg-red-950/50 border border-red-800 rounded-xl p-3 text-red-300 text-sm">
                      ❌ {enqueueResult.error}
                    </div>
                  )}
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-950/30 border border-blue-800/40 rounded-2xl p-4">
                <p className="text-blue-300 text-xs font-semibold mb-2">💡 Como funciona</p>
                <ol className="text-blue-400/80 text-xs space-y-1 leading-relaxed">
                  <li>1. Selecione a oferta e clique em <strong className="text-blue-300">Enfileirar</strong></li>
                  <li>2. O worker (10s) pega o job e aciona a <strong className="text-blue-300">IA Ana</strong></li>
                  <li>3. Ana dá um <strong className="text-blue-300">Score 0-100</strong> e escolhe o formato</li>
                  <li>4. Se score ≥ 40: gera slides → Cloudinary → Postfor.me → Instagram</li>
                  <li>5. Se falhar: <strong className="text-blue-300">retry automático</strong> (1min → 4min → 15min)</li>
                </ol>
              </div>
            </div>

            {/* Direita: Preview dos slides */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="font-semibold text-gray-200 mb-4">🖼️ Preview dos Slides</h2>

              {!previewData && !previewing && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="text-6xl mb-4 opacity-20">📸</div>
                  <p className="text-gray-500 text-sm">
                    {selectedOffer
                      ? 'Clique em "Ver Preview" para gerar os slides'
                      : 'Selecione uma oferta primeiro'}
                  </p>
                </div>
              )}

              {previewing && (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-4" />
                  <p className="text-gray-400 text-sm">Gerando slides + analisando com IA...</p>
                  <p className="text-gray-500 text-xs mt-1">Pode levar até 20 segundos</p>
                </div>
              )}

              {previewData && !previewing && (
                <div className="space-y-4">

                  {/* Score IA */}
                  <div className={`rounded-xl p-3 border ${
                    previewData.ai.shouldPublish
                      ? 'bg-green-950/40 border-green-800'
                      : 'bg-red-950/40 border-red-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">Score IA</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-black ${previewData.ai.score >= 70 ? 'text-green-400' : previewData.ai.score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                          {previewData.ai.score}
                        </span>
                        <span className="text-gray-400 text-sm">/100</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                      <div
                        className={`h-2 rounded-full transition-all ${previewData.ai.score >= 70 ? 'bg-green-500' : previewData.ai.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${previewData.ai.score}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Formato: <strong className="text-white">{previewData.ai.format}</strong></span>
                      <span className={previewData.ai.shouldPublish ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {previewData.ai.shouldPublish ? '✅ Vai publicar' : '⛔ Score baixo'}
                      </span>
                    </div>
                    {previewData.ai.reasoning && (
                      <p className="text-gray-500 text-xs mt-2 italic line-clamp-2">{previewData.ai.reasoning}</p>
                    )}
                  </div>

                  {/* Slides grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {previewData.slideUrls.map((url, i) => (
                      <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
                        <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-lg font-bold">
                          {i + 1}
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs rounded-xl"
                        >
                          🔍 Ampliar
                        </a>
                      </div>
                    ))}
                  </div>

                  {/* Caption preview */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wider">Caption (gerada pela IA)</p>
                    <div className="bg-gray-800 rounded-xl p-3 text-xs text-gray-300 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap font-mono">
                      {previewData.caption}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB: JOBS ═════════════════════════════════════════════════════════ */}
        {tab === 'jobs' && (
          <div className="space-y-4">

            {/* Filtros */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-gray-400 text-sm font-semibold">Filtrar:</span>
              {(['', 'PENDING', 'SCORING', 'RENDERING', 'UPLOADING', 'PUBLISHING', 'SUCCESS', 'FAILED', 'CANCELLED'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setJobFilter(s as JobStatus | '')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    jobFilter === s
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                  }`}
                >
                  {s === '' ? 'Todos' : STATUS_CONFIG[s as JobStatus]?.label || s}
                </button>
              ))}
              <button onClick={loadJobs} className="ml-auto text-gray-500 hover:text-white text-xs px-3 py-1.5 bg-gray-800 rounded-full border border-gray-700">
                🔄 Atualizar
              </button>
              <span className="text-gray-600 text-xs">{jobsTotal} jobs total</span>
            </div>

            {/* Lista */}
            {jobsLoading && jobs.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl mb-3 opacity-20">📋</div>
                <p className="text-gray-500 text-sm">Nenhum job encontrado</p>
                <button
                  onClick={() => setTab('enqueue')}
                  className="mt-3 text-purple-400 text-sm underline"
                >
                  Enfileirar primeira oferta →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map(job => (
                  <div
                    key={job.id}
                    className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
                  >
                    {/* Linha principal */}
                    <button
                      onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-800/50 transition-colors"
                    >
                      {/* Thumb */}
                      {job.offer?.mainImage || job.offer?.imageUrl ? (
                        <img
                          src={job.offer.mainImage || job.offer.imageUrl!}
                          alt=""
                          className="w-10 h-10 rounded-lg object-contain bg-white flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">🛍️</div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {job.offer?.title || job.id}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <StatusBadge status={job.status} />
                          {job.aiScore !== null && (
                            <span className="text-xs text-gray-500">
                              Score: <span className={job.aiScore >= 70 ? 'text-green-400' : job.aiScore >= 40 ? 'text-amber-400' : 'text-red-400'} >{job.aiScore}/100</span>
                            </span>
                          )}
                          <span className="text-xs text-gray-600">{timeAgo(job.createdAt)}</span>
                          {job.attempts > 1 && (
                            <span className="text-xs text-orange-400">tentativa {job.attempts}/{job.maxAttempts}</span>
                          )}
                        </div>
                      </div>

                      {/* Métricas se publicado */}
                      {job.status === 'SUCCESS' && (job.metricViews > 0 || job.metricLikes > 0) && (
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
                          {job.metricViews > 0 && <span>👁️ {job.metricViews.toLocaleString()}</span>}
                          {job.metricLikes > 0 && <span>❤️ {job.metricLikes}</span>}
                          {job.metricSaves > 0 && <span>🔖 {job.metricSaves}</span>}
                        </div>
                      )}

                      <span className="text-gray-600 text-sm flex-shrink-0">{expandedJob === job.id ? '▲' : '▼'}</span>
                    </button>

                    {/* Expandido */}
                    {expandedJob === job.id && (
                      <div className="border-t border-gray-800 p-4 space-y-3">

                        {/* Slides */}
                        {job.slideUrls?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Slides gerados</p>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {job.slideUrls.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                  <img src={url} alt={`Slide ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-gray-700 hover:border-purple-500 transition-colors flex-shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Caption */}
                        {job.captionUsed && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wider">Caption publicada</p>
                            <div className="bg-gray-800 rounded-xl p-3 text-xs text-gray-300 max-h-28 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                              {job.captionUsed}
                            </div>
                          </div>
                        )}

                        {/* Erro */}
                        {job.errorMessage && (
                          <div className="bg-red-950/40 border border-red-800 rounded-xl p-3">
                            <p className="text-red-300 text-xs font-semibold mb-1">Mensagem de erro</p>
                            <p className="text-red-400/80 text-xs font-mono">{job.errorMessage}</p>
                            {job.nextRetryAt && (
                              <p className="text-orange-400 text-xs mt-1">
                                Próxima tentativa: {new Date(job.nextRetryAt).toLocaleTimeString('pt-BR')}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Postfor.me */}
                        {job.postformePostId && (
                          <div className="text-xs text-gray-500">
                            Postfor.me ID: <code className="text-gray-400 font-mono">{job.postformePostId}</code>
                            {' · '}Status: <span className="text-green-400">{job.postformeStatus}</span>
                          </div>
                        )}

                        {/* Ações */}
                        <div className="flex gap-2">
                          {['PENDING', 'FAILED'].includes(job.status) && (
                            <button
                              onClick={() => handleCancelJob(job.id)}
                              className="text-xs px-3 py-1.5 bg-red-900/40 text-red-300 border border-red-800 rounded-lg hover:bg-red-900/60 transition-colors"
                            >
                              Cancelar job
                            </button>
                          )}
                          <span className="text-xs text-gray-600 self-center">
                            ID: <code className="font-mono">{job.id.slice(-8)}</code>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: METRICS ══════════════════════════════════════════════════════ */}
        {tab === 'metrics' && (
          <div className="space-y-6">
            {metricsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
            ) : metrics ? (
              <>
                {/* Cards de totais */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Publicados', value: metrics.summary.totalPublished, icon: '✅', color: 'text-green-400' },
                    { label: 'Total Views', value: metrics.summary.totalViews.toLocaleString('pt-BR'), icon: '👁️', color: 'text-blue-400' },
                    { label: 'Total Likes', value: metrics.summary.totalLikes.toLocaleString('pt-BR'), icon: '❤️', color: 'text-pink-400' },
                    { label: 'Total Saves', value: metrics.summary.totalSaves.toLocaleString('pt-BR'), icon: '🔖', color: 'text-amber-400' },
                  ].map(c => (
                    <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center">
                      <div className="text-3xl mb-2">{c.icon}</div>
                      <div className={`text-2xl font-black ${c.color}`}>{c.value}</div>
                      <div className="text-gray-500 text-xs mt-1 font-semibold uppercase tracking-wider">{c.label}</div>
                    </div>
                  ))}
                </div>

                {/* Status breakdown */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="font-semibold text-gray-200 mb-4">📊 Status dos Jobs</h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(metrics.statusBreakdown).map(([status, count]) => {
                      const cfg = STATUS_CONFIG[status as JobStatus];
                      return (
                        <div key={status} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${cfg?.bg || 'bg-gray-800'}`}>
                          <span className={`text-xs font-bold ${cfg?.color || 'text-gray-400'}`}>{cfg?.label || status}</span>
                          <span className="text-white font-black text-sm">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top posts */}
                {metrics.topPosts.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <h3 className="font-semibold text-gray-200 mb-4">🏆 Top Posts por Views</h3>
                    <div className="space-y-2">
                      {metrics.topPosts.map((post, i) => (
                        <div key={post.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
                          <span className="text-gray-500 font-bold text-sm w-5">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{post.offer?.title || post.id}</div>
                            <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                              <span>👁️ {post.metricViews.toLocaleString()}</span>
                              <span>❤️ {post.metricLikes}</span>
                              <span>🔖 {post.metricSaves}</span>
                            </div>
                          </div>
                          <span className="text-amber-400 text-xs font-bold">{fmtPrice(post.offer?.finalPrice)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recentes */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="font-semibold text-gray-200 mb-4">🕐 Jobs Recentes</h3>
                  <div className="space-y-2">
                    {metrics.recent.map(job => (
                      <div key={job.id} className="flex items-center gap-3 p-2.5 bg-gray-800 rounded-xl">
                        <StatusBadge status={job.status} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-white truncate block">{job.offer?.title || job.id}</span>
                        </div>
                        {job.aiScore !== null && (
                          <span className="text-xs text-gray-500">Score: <strong className="text-white">{job.aiScore}</strong></span>
                        )}
                        <span className="text-xs text-gray-600 flex-shrink-0">{timeAgo(job.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl mb-3 opacity-20">📊</div>
                <p className="text-gray-500 text-sm">Nenhum dado de métricas ainda</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
