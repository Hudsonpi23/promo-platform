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

interface InstagramJob {
  id: string;
  status: JobStatus;
  format: string;
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
  offer?: {
    title: string;
    finalPrice: number;
    mainImage: string | null;
    imageUrl: string | null;
  };
}

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
  PENDING:    { label: 'Na fila',    color: 'text-slate-300',   bg: 'bg-slate-800',      dot: 'bg-slate-400' },
  SCORING:    { label: 'IA avaliando', color: 'text-purple-300', bg: 'bg-purple-900/40', dot: 'bg-purple-400', spin: true },
  RENDERING:  { label: 'Gerando slides', color: 'text-blue-300', bg: 'bg-blue-900/40',   dot: 'bg-blue-400',   spin: true },
  UPLOADING:  { label: 'Enviando',   color: 'text-cyan-300',    bg: 'bg-cyan-900/40',    dot: 'bg-cyan-400',   spin: true },
  PUBLISHING: { label: 'Publicando', color: 'text-orange-300',  bg: 'bg-orange-900/40',  dot: 'bg-orange-400', spin: true },
  SUCCESS:    { label: '✅ Publicado', color: 'text-green-300',  bg: 'bg-green-900/40',   dot: 'bg-green-400' },
  FAILED:     { label: '❌ Falhou',   color: 'text-red-300',    bg: 'bg-red-900/40',     dot: 'bg-red-400' },
  CANCELLED:  { label: 'Cancelado',  color: 'text-gray-400',    bg: 'bg-gray-800',        dot: 'bg-gray-500' },
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

// ══════════════════════════════════════════════════════════════════════════════

export default function InstagramPage() {
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; username?: string }>>([]);

  // URL input → produto → publicar
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [product, setProduct] = useState<ProductPreview | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Fila
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

  // ── Fila de jobs ─────────────────────────────────────────────────────────────

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

  // ── Buscar produto pela URL ──────────────────────────────────────────────────

  async function handleFetchProduct() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setProduct(null);
    setJobId(null);

    try {
      const isAmazon = trimmed.includes('amazon.com') || trimmed.includes('amzn');
      const isML = trimmed.includes('mercadolivre.com') || trimmed.includes('mercadolibre.com');

      if (!isAmazon && !isML) {
        setError('Cole uma URL da Amazon ou do Mercado Livre');
        return;
      }

      // Chama o endpoint unificado — ele busca o produto, salva e retorna preview
      // Não publica ainda: usamos o from-url só para preview aqui,
      // e o botão "Publicar" faz a publicação de fato
      const isAmazonUrl = isAmazon;
      const endpoint = isAmazonUrl ? '/api/amazon/product-from-url' : '/api/affiliates/generate';

      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Não foi possível buscar o produto. Verifique a URL.');
        return;
      }

      // Normaliza resposta (Amazon vs ML têm formatos diferentes)
      let prod: ProductPreview | null = null;

      if (isAmazonUrl) {
        const p = data.product;
        if (p?.title) {
          prod = {
            title: p.title,
            finalPrice: p.finalPrice ?? p.price ?? 0,
            originalPrice: p.originalPrice ?? null,
            discountPct: p.discountPct ?? 0,
            imageUrl: p.images?.primary ?? null,
            source: 'amazon',
          };
        }
      } else {
        const p = data.data?.product;
        if (p?.title) {
          prod = {
            title: p.title,
            finalPrice: p.price ?? 0,
            originalPrice: p.original_price ?? null,
            discountPct: p.discount_percentage ?? 0,
            imageUrl: p.thumbnail ?? null,
            source: 'mercadolivre',
          };
        }
      }

      if (!prod) {
        setError('Produto não encontrado nessa URL. Tente outra URL.');
        return;
      }

      setProduct(prod);
    } catch (err: any) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // ── Publicar no Instagram ────────────────────────────────────────────────────

  async function handlePublish() {
    if (!url.trim()) return;
    setPublishing(true);
    setError('');
    try {
      const res = await fetchWithAuth('/api/instagram/from-url', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao publicar');
        return;
      }

      setJobId(data.jobId);
      setUrl('');
      setProduct(null);
      await loadJobs();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setPublishing(false);
    }
  }

  // ── Cancel job ───────────────────────────────────────────────────────────────

  async function handleCancelJob(jobId: string) {
    if (!confirm('Cancelar este job?')) return;
    await fetchWithAuth(`/api/instagram/jobs/${jobId}`, { method: 'DELETE' });
    loadJobs();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const accountConnected = accounts.length > 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto p-6 space-y-6">

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

        {/* ── STEP 1: Cole a URL ──────────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-lg font-bold text-white mb-1">1. Cole a URL do produto</h2>
          <p className="text-gray-400 text-sm mb-4">Amazon ou Mercado Livre — o sistema busca o produto automaticamente</p>

          <div className="flex gap-3">
            <input
              type="url"
              placeholder="https://www.amazon.com.br/... ou https://produto.mercadolivre.com.br/..."
              value={url}
              onChange={e => { setUrl(e.target.value); setError(''); setProduct(null); setJobId(null); }}
              onKeyDown={e => e.key === 'Enter' && handleFetchProduct()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              onClick={handleFetchProduct}
              disabled={loading || !url.trim()}
              className="px-5 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Buscando...
                </span>
              ) : '🔍 Buscar produto'}
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 bg-red-950/50 border border-red-800 rounded-xl px-4 py-3">
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* ── STEP 2: Preview do produto + botão publicar ─────────────────── */}
        {product && (
          <div className="bg-gray-900 rounded-2xl border border-purple-800/60 p-6 space-y-5">
            <h2 className="text-lg font-bold text-white">2. Confirme o produto</h2>

            {/* Card do produto */}
            <div className="flex gap-4 bg-gray-800 rounded-xl p-4">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="w-24 h-24 object-contain rounded-xl bg-white flex-shrink-0"
                />
              ) : (
                <div className="w-24 h-24 bg-gray-700 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">🛍️</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white leading-snug line-clamp-3 mb-2">{product.title}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-2xl font-black text-amber-400">{fmtPrice(product.finalPrice)}</span>
                  {product.discountPct > 0 && (
                    <>
                      {product.originalPrice && (
                        <span className="text-gray-500 line-through text-sm">{fmtPrice(product.originalPrice)}</span>
                      )}
                      <span className="bg-orange-500/20 text-orange-400 text-sm font-bold px-2 py-0.5 rounded-full">
                        -{product.discountPct}% OFF
                      </span>
                    </>
                  )}
                </div>
                <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${
                  product.source === 'amazon' ? 'bg-amber-900/30 text-amber-400' : 'bg-yellow-900/30 text-yellow-400'
                }`}>
                  {product.source === 'amazon' ? '📦 Amazon' : '🛒 Mercado Livre'}
                </span>
              </div>
            </div>

            {/* Explicação do que vai acontecer */}
            <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl px-4 py-3">
              <p className="text-blue-300 text-xs font-semibold mb-1">🤖 O que vai acontecer:</p>
              <ol className="text-blue-400/80 text-xs space-y-0.5">
                <li>1. A IA Ana avalia o produto e dá um score</li>
                <li>2. Se aprovado, gera os slides do carrossel automaticamente</li>
                <li>3. Publica no Instagram via Postfor.me</li>
                <li>4. Se falhar, tenta novamente até 3 vezes</li>
              </ol>
            </div>

            {/* Botão publicar */}
            <button
              onClick={handlePublish}
              disabled={publishing || !accountConnected}
              className="w-full py-4 rounded-xl font-bold text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {publishing ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando para a fila...
                </span>
              ) : !accountConnected
                ? '⚠️ Conta Instagram não conectada'
                : '🚀 Publicar no Instagram'}
            </button>
          </div>
        )}

        {/* Sucesso */}
        {jobId && (
          <div className="bg-green-950/50 border border-green-700 rounded-2xl p-5">
            <p className="text-green-300 font-bold text-lg mb-1">✅ Enfileirado com sucesso!</p>
            <p className="text-green-400/80 text-sm">
              A IA já está avaliando o produto. Em alguns segundos vai gerar os slides e publicar no Instagram.
              Acompanhe o status abaixo em <strong>Fila de Publicações</strong>.
            </p>
          </div>
        )}

        {/* ── STEP 3: Fila de jobs ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">📋 Fila de Publicações</h2>
            <button
              onClick={loadJobs}
              className="text-gray-500 hover:text-white text-xs px-3 py-1.5 bg-gray-800 rounded-full border border-gray-700 transition-colors"
            >
              🔄 Atualizar
            </button>
          </div>

          {jobsLoading && jobs.length === 0 ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl py-12 text-center">
              <div className="text-4xl mb-3 opacity-20">📋</div>
              <p className="text-gray-500 text-sm">Nenhuma publicação ainda</p>
              <p className="text-gray-600 text-xs mt-1">Cole uma URL acima e publique sua primeira oferta</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => (
                <div key={job.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

                  {/* Linha principal */}
                  <button
                    onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-800/50 transition-colors"
                  >
                    {/* Imagem */}
                    {(job.offer?.mainImage || job.offer?.imageUrl) ? (
                      <img
                        src={job.offer.mainImage || job.offer.imageUrl!}
                        alt=""
                        className="w-12 h-12 rounded-xl object-contain bg-white flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">🛍️</div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {job.offer?.title || `Job ${job.id.slice(-8)}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <StatusBadge status={job.status} />
                        {job.aiScore !== null && (
                          <span className="text-xs text-gray-500">
                            Score: <span className={job.aiScore >= 70 ? 'text-green-400' : job.aiScore >= 40 ? 'text-amber-400' : 'text-red-400'}>{job.aiScore}/100</span>
                          </span>
                        )}
                        <span className="text-xs text-gray-600">{timeAgo(job.createdAt)}</span>
                      </div>
                    </div>

                    {/* Métricas (se publicado) */}
                    {job.status === 'SUCCESS' && (job.metricViews > 0 || job.metricLikes > 0) && (
                      <div className="flex gap-2 text-xs text-gray-400 flex-shrink-0">
                        {job.metricViews > 0 && <span>👁️ {job.metricViews.toLocaleString()}</span>}
                        {job.metricLikes > 0 && <span>❤️ {job.metricLikes}</span>}
                      </div>
                    )}

                    <span className="text-gray-600 text-xs flex-shrink-0">{expandedJob === job.id ? '▲' : '▼'}</span>
                  </button>

                  {/* Expandido */}
                  {expandedJob === job.id && (
                    <div className="border-t border-gray-800 p-4 space-y-3">

                      {/* Slides gerados */}
                      {job.slideUrls?.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Slides gerados</p>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {job.slideUrls.map((u, i) => (
                              <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                                <img src={u} alt={`Slide ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-gray-700 hover:border-purple-500 transition-colors flex-shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Erro */}
                      {job.errorMessage && (
                        <div className="bg-red-950/40 border border-red-800 rounded-xl p-3">
                          <p className="text-red-300 text-xs font-semibold mb-1">Erro</p>
                          <p className="text-red-400/80 text-xs font-mono">{job.errorMessage}</p>
                          {job.nextRetryAt && (
                            <p className="text-orange-400 text-xs mt-1">
                              Próxima tentativa: {new Date(job.nextRetryAt).toLocaleTimeString('pt-BR')}
                            </p>
                          )}
                          {job.attempts > 1 && (
                            <p className="text-gray-500 text-xs">Tentativa {job.attempts}/{job.maxAttempts}</p>
                          )}
                        </div>
                      )}

                      {/* Ações */}
                      <div className="flex items-center gap-2">
                        {['PENDING', 'FAILED'].includes(job.status) && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="text-xs px-3 py-1.5 bg-red-900/30 text-red-300 border border-red-800 rounded-lg hover:bg-red-900/50 transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                        <span className="text-xs text-gray-600 ml-auto">
                          ID: <code className="font-mono">{job.id.slice(-10)}</code>
                        </span>
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
