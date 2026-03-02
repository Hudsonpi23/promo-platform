'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '@/lib/auth';

const APPROVED  = ['APPROVED', 'AI_PROCESSING', 'AI_READY', 'AI_BLOCKED'];
const API_URL   = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PAGE_SIZE = 50; // 50 por página — ilimitado via paginação

type RepostState = 'idle' | 'loading' | 'ok' | 'error';

interface Offer {
  id: string;
  title: string;
  finalPrice: string | number;
  originalPrice?: string | number | null;
  discountPct?: number;
  mainImage?: string | null;
  imageUrl?: string | null;
  affiliateUrl?: string;
  createdAt: string;
  curationStatus: string;
  niche?: { name: string; icon?: string } | null;
  store?: { name: string } | null;
}

function formatPrice(v?: string | number | null) {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoricoPage() {
  const [offers, setOffers]         = useState<Offer[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState('');

  const [repost, setRepost]   = useState<Record<string, { tg: RepostState; tw: RepostState }>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  // ── Buscar página de ofertas ──────────────────────────────────────────────
  const fetchPage = useCallback(async (pg: number, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(pg),
        limit: String(PAGE_SIZE),
        curationStatus: 'APPROVED',
      });
      const res = await fetchWithAuth(`${API_URL}/api/offers?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const items: Offer[] = json.data || [];
      const meta = json.meta || {};

      // Filtra client-side para garantir apenas aprovados
      const approved = items.filter(o => APPROVED.includes(o.curationStatus));

      setOffers(prev => append ? [...prev, ...approved] : approved);
      setTotal(meta.total ?? 0);
      setHasMore(pg < (meta.totalPages ?? 1));
      setPage(pg);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchPage(1); }, [fetchPage]);

  // ── Carregar mais ─────────────────────────────────────────────────────────
  const loadMore = () => fetchPage(page + 1, true);

  // ── Deletar oferta ────────────────────────────────────────────────────────
  const deleteOffer = async (id: string, title: string) => {
    if (!confirm(`🗑️ Deletar este post?\n\n"${title}"\n\nEsta ação não pode ser desfeita.`)) return;
    setDeleting(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetchWithAuth(`${API_URL}/api/offers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error?.message || d.message || `HTTP ${res.status}`);
      }
      setOffers(prev => prev.filter(o => o.id !== id));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (e: any) {
      alert(`❌ Erro ao deletar: ${e.message}`);
    } finally {
      setDeleting(prev => ({ ...prev, [id]: false }));
    }
  };

  // ── Republicar Telegram ───────────────────────────────────────────────────
  const setTg = (id: string, s: RepostState) =>
    setRepost(prev => ({ ...prev, [id]: { ...(prev[id] ?? { tg: 'idle', tw: 'idle' }), tg: s } }));
  const setTw = (id: string, s: RepostState) =>
    setRepost(prev => ({ ...prev, [id]: { ...(prev[id] ?? { tg: 'idle', tw: 'idle' }), tw: s } }));

  async function repostTelegram(id: string) {
    setTg(id, 'loading');
    try {
      const r = await fetchWithAuth(`${API_URL}/api/telegram/post-offer/${id}`, { method: 'POST' });
      const d = await r.json();
      setTg(id, d.success ? 'ok' : 'error');
      if (!d.success) alert(`❌ Telegram: ${d.error || 'Erro'}`);
    } catch (e: any) { setTg(id, 'error'); alert(`❌ ${e.message}`); }
  }

  async function repostTwitter(id: string) {
    setTw(id, 'loading');
    try {
      const r = await fetchWithAuth(`${API_URL}/api/twitter/post-offer/${id}`, { method: 'POST' });
      const d = await r.json();
      setTw(id, d.success ? 'ok' : 'error');
      if (!d.success) alert(`❌ X: ${d.error || 'Erro'}`);
    } catch (e: any) { setTw(id, 'error'); alert(`❌ ${e.message}`); }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="text-3xl">📋</span>
            <h1 className="text-2xl font-bold">Histórico de Posts</h1>
            {!loading && (
              <span className="px-2.5 py-1 bg-[#1a1d27] border border-gray-700 rounded-full text-xs text-gray-400">
                {offers.length} de {total} posts
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">
            Posts aprovados via Auto Publicar — ilimitado, paginado.
          </p>
        </div>
        <button
          onClick={() => fetchPage(1)}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1d27] hover:bg-[#22263a] border border-gray-700 hover:border-gray-500 rounded-lg text-sm text-gray-400 hover:text-white transition-all disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* ── Erro ── */}
      {error && (
        <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-red-400 text-sm font-medium">Erro ao carregar histórico</p>
            <p className="text-red-400/60 text-xs mt-0.5 font-mono">{error}</p>
          </div>
          <button onClick={() => fetchPage(1)}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs rounded-lg font-medium transition-colors">
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Loading inicial ── */}
      {loading && (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Carregando histórico...
        </div>
      )}

      {/* ── Vazio ── */}
      {!loading && !error && offers.length === 0 && (
        <div className="text-center py-24 text-gray-500">
          <span className="text-5xl block mb-4">📭</span>
          <p className="text-lg font-medium text-gray-400">Nenhum post ainda</p>
          <p className="text-sm mt-2">Posts do Auto Publicar aparecem aqui automaticamente.</p>
        </div>
      )}

      {/* ── Cards ── */}
      {!loading && offers.length > 0 && (
        <div className="grid gap-3">
          {offers.map((offer) => {
            const img  = offer.mainImage || offer.imageUrl;
            const st   = repost[offer.id] ?? { tg: 'idle' as RepostState, tw: 'idle' as RepostState };
            const isDel = deleting[offer.id];

            return (
              <div key={offer.id}
                className="bg-[#1a1d27] border border-gray-800 hover:border-gray-600 rounded-xl p-4 flex gap-4 transition-colors">

                {/* Imagem */}
                <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-800">
                  {img
                    ? <img src={img} alt={offer.title} className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <div className="w-full h-full flex items-center justify-center text-gray-600 text-2xl">🖼</div>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded px-2 py-0.5">
                      ✓ Publicado
                    </span>
                    {offer.niche && (
                      <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-2 py-0.5">
                        {offer.niche.icon} {offer.niche.name}
                      </span>
                    )}
                    {offer.store && (
                      <span className="text-xs bg-gray-700 text-gray-300 rounded px-2 py-0.5">
                        {offer.store.name}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-2">
                    {offer.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-emerald-400 font-bold">{formatPrice(offer.finalPrice)}</span>
                    {offer.originalPrice && (
                      <span className="text-gray-500 line-through text-xs">{formatPrice(offer.originalPrice)}</span>
                    )}
                    {(offer.discountPct ?? 0) > 0 && (
                      <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded font-semibold">
                        -{offer.discountPct}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDate(offer.createdAt)}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex-shrink-0 flex flex-col items-end gap-2 min-w-[140px]">
                  {offer.affiliateUrl && (
                    <a href={offer.affiliateUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 underline whitespace-nowrap">
                      Ver produto ↗
                    </a>
                  )}

                  {/* Telegram */}
                  <div className="flex items-center gap-1.5 w-full justify-end">
                    {st.tg === 'loading' && <span className="text-xs text-yellow-400 animate-pulse">Enviando...</span>}
                    {st.tg === 'ok'      && <span className="text-xs text-emerald-400">✓ Enviado</span>}
                    {st.tg === 'error'   && <span className="text-xs text-red-400">✗ Falhou</span>}
                    <button onClick={() => repostTelegram(offer.id)} disabled={st.tg === 'loading'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-400 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.474c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.873.747z" />
                      </svg>
                      Telegram
                    </button>
                  </div>

                  {/* X */}
                  <div className="flex items-center gap-1.5 w-full justify-end">
                    {st.tw === 'loading' && <span className="text-xs text-yellow-400 animate-pulse">Enviando...</span>}
                    {st.tw === 'ok'      && <span className="text-xs text-emerald-400">✓ Enviado</span>}
                    {st.tw === 'error'   && <span className="text-xs text-red-400">✗ Falhou</span>}
                    <button onClick={() => repostTwitter(offer.id)} disabled={st.tw === 'loading'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 text-gray-300 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      X (Twitter)
                    </button>
                  </div>

                  {/* Deletar */}
                  <button
                    onClick={() => deleteOffer(offer.id, offer.title)}
                    disabled={isDel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap w-full justify-center mt-1"
                  >
                    {isDel
                      ? <><span className="animate-spin">⏳</span> Deletando...</>
                      : <><span>🗑️</span> Deletar</>
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Carregar mais ── */}
      {!loading && hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg"
          >
            {loadingMore
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Carregando...</>
              : <>↓ Carregar mais ({offers.length} de {total})</>
            }
          </button>
        </div>
      )}

      {/* ── Fim ── */}
      {!loading && !hasMore && offers.length > 0 && (
        <p className="mt-8 text-center text-gray-600 text-sm">
          ✓ Todos os {total} posts exibidos
        </p>
      )}
    </div>
  );
}
