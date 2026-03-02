'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '@/lib/auth';

// Mesmo endpoint da página de Ofertas — sem rota nova, sem bugs
const APPROVED_STATUSES = ['APPROVED', 'AI_PROCESSING', 'AI_READY', 'AI_BLOCKED'];

const POLL_MS  = 30_000;
const RETRY_MS = 15_000;

interface Offer {
  id: string;
  title: string;
  finalPrice: string | number;
  originalPrice: string | number | null;
  discountPct: number;
  mainImage: string | null;
  imageUrl: string | null;
  affiliateUrl: string;
  createdAt: string;
  niche: { name: string; slug: string; icon: string } | null;
  store: { name: string; slug: string } | null;
}

type RepostState = 'idle' | 'loading' | 'ok' | 'error';

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
  const [hasMore, setHasMore]       = useState(false);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [checking, setChecking]     = useState(false);
  const [hasError, setHasError]     = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [retryIn, setRetryIn]       = useState<number | null>(null);
  const [newCount, setNewCount]     = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [fromDate, setFromDate]       = useState('');
  const [toDate, setToDate]           = useState('');

  const [repost, setRepost] = useState<Record<string, { tg: RepostState; tw: RepostState }>>({});

  const offersRef = useRef<Offer[]>([]);
  const searchRef = useRef('');
  const fromRef   = useRef('');
  const toRef     = useRef('');
  const errRef    = useRef(false);

  offersRef.current = offers;
  searchRef.current = search;
  fromRef.current   = fromDate;
  toRef.current     = toDate;
  errRef.current    = hasError;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // ── Fetch — mesmo endpoint da página de Ofertas ─────────────────────────
  const load = useCallback(async (opts: {
    pg: number; q: string; from: string; to: string;
    mode: 'full' | 'more' | 'poll';
  }) => {
    const { pg, q, from, to, mode } = opts;

    if (mode === 'full') { setLoading(true); setHasError(false); }
    if (mode === 'more') setLoadingMore(true);
    if (mode === 'poll') setChecking(true);

    try {
      // Usa EXATAMENTE o mesmo endpoint da página de Ofertas — sem nenhum parâmetro novo
      const params = new URLSearchParams({ page: String(pg), limit: '100' });
      if (q)    params.set('q', q);
      if (from) params.set('dateFrom', from);
      if (to)   params.set('dateTo', to);

      const res = await fetchWithAuth(`${apiBase}/api/offers?${params}`);
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${errText ? ': ' + errText.slice(0, 120) : ''}`);
      }
      const data = await res.json();

      // Filtra client-side: só ofertas aprovadas (criadas via Auto Publicar)
      const allItems: Offer[] = data.data || [];
      const items = allItems.filter((o: any) =>
        ['APPROVED', 'AI_PROCESSING', 'AI_READY', 'AI_BLOCKED'].includes(o.curationStatus)
      );
      const meta  = data.meta  || {};

      setHasError(false);
      setRetryIn(null);
      setLastUpdate(new Date());

      if (mode === 'poll') {
        const known = new Set(offersRef.current.map(x => x.id));
        const fresh = items.filter(x => !known.has(x.id));
        if (fresh.length > 0) {
          setNewCount(n => n + fresh.length);
          setOffers(prev => [...fresh, ...prev]);
        }
        setTotal(meta.total ?? 0);
      } else if (mode === 'more') {
        setOffers(prev => [...prev, ...items]);
        setTotal(meta.total ?? 0);
        setHasMore((pg * 50) < (meta.total ?? 0));
      } else {
        setOffers(items);
        setTotal(meta.total ?? 0);
        setHasMore((pg * 50) < (meta.total ?? 0));
        setNewCount(0);
      }
    } catch (err: any) {
      if (mode !== 'poll') {
        setHasError(true);
        setErrorMsg(err?.message || 'Erro desconhecido');
      }
    } finally {
      if (mode === 'full') setLoading(false);
      if (mode === 'more') setLoadingMore(false);
      if (mode === 'poll') setChecking(false);
    }
  }, [apiBase]);

  // Carga inicial
  useEffect(() => {
    setPage(1);
    load({ pg: 1, q: search, from: fromDate, to: toDate, mode: 'full' });
  }, [search, fromDate, toDate]);

  // Polling + retry
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let countdown: ReturnType<typeof setInterval>;

    function schedule() {
      const isErr = errRef.current;
      const delay = isErr ? RETRY_MS : POLL_MS;

      if (isErr) {
        let secs = Math.ceil(delay / 1000);
        setRetryIn(secs);
        countdown = setInterval(() => {
          secs -= 1;
          setRetryIn(Math.max(0, secs));
          if (secs <= 0) clearInterval(countdown);
        }, 1000);
      }

      timer = setTimeout(() => {
        clearInterval(countdown);
        load({
          pg: 1, q: searchRef.current,
          from: fromRef.current, to: toRef.current,
          mode: isErr ? 'full' : 'poll',
        }).then(schedule);
      }, delay);
    }

    schedule();
    return () => { clearTimeout(timer); clearInterval(countdown); };
  }, [load]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    load({ pg: next, q: search, from: fromDate, to: toDate, mode: 'more' });
  }

  function refresh() {
    setPage(1);
    setNewCount(0);
    load({ pg: 1, q: search, from: fromDate, to: toDate, mode: 'full' });
  }

  function setTg(id: string, s: RepostState) {
    setRepost(prev => {
      const cur = prev[id] ?? { tg: 'idle' as RepostState, tw: 'idle' as RepostState };
      return { ...prev, [id]: { ...cur, tg: s } };
    });
  }
  function setTw(id: string, s: RepostState) {
    setRepost(prev => {
      const cur = prev[id] ?? { tg: 'idle' as RepostState, tw: 'idle' as RepostState };
      return { ...prev, [id]: { ...cur, tw: s } };
    });
  }

  // Repost — usa as rotas de Telegram e Twitter que já existem
  async function repostTelegram(offer: Offer) {
    setTg(offer.id, 'loading');
    try {
      const r = await fetchWithAuth(
        `${apiBase}/api/telegram/post-offer/${offer.id}`,
        { method: 'POST' },
      );
      const d = await r.json();
      setTg(offer.id, d.success ? 'ok' : 'error');
    } catch { setTg(offer.id, 'error'); }
  }

  async function repostTwitter(offer: Offer) {
    setTw(offer.id, 'loading');
    try {
      const r = await fetchWithAuth(
        `${apiBase}/api/twitter/post-offer/${offer.id}`,
        { method: 'POST' },
      );
      const d = await r.json();
      setTw(offer.id, d.success ? 'ok' : 'error');
    } catch { setTw(offer.id, 'error'); }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-6">

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="text-3xl">📋</span>
            <h1 className="text-2xl font-bold">Histórico de Posts</h1>
            {newCount > 0 && (
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold animate-pulse">
                +{newCount} novo{newCount > 1 ? 's' : ''}
              </span>
            )}
            {checking && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin inline-block" />
                Verificando...
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">
            Todos os posts aprovados via Auto Publicar — arquivo ilimitado.
            {lastUpdate && !hasError && (
              <span className="text-gray-600 ml-2">
                Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
              </span>
            )}
            {hasError && retryIn !== null && retryIn > 0 && (
              <span className="text-red-400 ml-2">Reconectando em {retryIn}s...</span>
            )}
          </p>
        </div>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1d27] hover:bg-[#22263a] border border-gray-700 hover:border-gray-500 rounded-lg text-sm text-gray-400 hover:text-white transition-all disabled:opacity-50">
          <svg className={`w-4 h-4 ${loading && !loadingMore ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-4 mb-5 space-y-3">
        <form onSubmit={submitSearch} className="flex gap-2">
          <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar por título..."
            className="flex-1 bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">Buscar</button>
          {search && (
            <button type="button" onClick={() => { setSearchInput(''); setSearch(''); }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">✕</button>
          )}
        </form>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Período:</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          <span className="text-xs text-gray-500">até</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); }}
              className="text-xs text-blue-400 hover:text-blue-300 underline">Limpar</button>
          )}
          <div className="ml-auto text-sm text-gray-400">
            {!loading && <><span className="text-white font-bold">{total.toLocaleString('pt-BR')}</span> posts</>}
          </div>
        </div>
      </div>

      {/* Erro */}
      {hasError && (
        <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
          <span className="text-xl mt-0.5">⚠️</span>
          <div className="flex-1">
            <p className="text-red-400 text-sm font-medium">Não foi possível carregar o histórico</p>
            {errorMsg && (
              <p className="text-red-300/80 text-xs mt-1 font-mono bg-red-900/20 px-2 py-1 rounded">{errorMsg}</p>
            )}
            <p className="text-red-400/60 text-xs mt-1">
              {retryIn && retryIn > 0 ? `Reconectando em ${retryIn}s...` : 'Reconectando agora...'}
            </p>
          </div>
          <button onClick={refresh}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs rounded-lg font-medium transition-colors flex-shrink-0">
            Tentar agora
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !hasError && (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Carregando histórico...
        </div>
      )}

      {/* Vazio */}
      {!loading && !hasError && offers.length === 0 && (
        <div className="text-center py-24 text-gray-500">
          <span className="text-5xl block mb-4">📭</span>
          <p className="text-lg font-medium text-gray-400">Nenhum post ainda</p>
          <p className="text-sm mt-2">Posts do Auto Publicar aparecem aqui automaticamente.</p>
        </div>
      )}

      {/* Cards */}
      {!loading && offers.length > 0 && (
        <div className="grid gap-3">
          {offers.map(offer => {
            const st  = repost[offer.id] ?? { tg: 'idle' as RepostState, tw: 'idle' as RepostState };
            const img = offer.mainImage || offer.imageUrl;
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
                      ✓ Aprovado
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

                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-emerald-400 font-bold">{formatPrice(offer.finalPrice)}</span>
                    {offer.originalPrice && (
                      <span className="text-gray-500 line-through text-xs">{formatPrice(offer.originalPrice)}</span>
                    )}
                    {offer.discountPct > 0 && (
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
                <div className="flex-shrink-0 flex flex-col items-end justify-between gap-2">
                  <a href={offer.affiliateUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline whitespace-nowrap">
                    Ver produto ↗
                  </a>

                  <div className="flex flex-col gap-1.5 items-end">
                    {/* Telegram */}
                    <div className="flex items-center gap-2">
                      {st.tg === 'loading' && <span className="text-xs text-yellow-400 animate-pulse">Enviando...</span>}
                      {st.tg === 'ok'      && <span className="text-xs text-emerald-400">✓ Enviado</span>}
                      {st.tg === 'error'   && <span className="text-xs text-red-400">✗ Falhou</span>}
                      <button onClick={() => repostTelegram(offer)} disabled={st.tg === 'loading'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-400 text-xs rounded-lg font-medium transition-colors disabled:opacity-50">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.474c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.873.747z" />
                        </svg>
                        Telegram
                      </button>
                    </div>

                    {/* X */}
                    <div className="flex items-center gap-2">
                      {st.tw === 'loading' && <span className="text-xs text-yellow-400 animate-pulse">Enviando...</span>}
                      {st.tw === 'ok'      && <span className="text-xs text-emerald-400">✓ Enviado</span>}
                      {st.tw === 'error'   && <span className="text-xs text-red-400">✗ Falhou</span>}
                      <button onClick={() => repostTwitter(offer)} disabled={st.tw === 'loading'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 text-gray-300 text-xs rounded-lg font-medium transition-colors disabled:opacity-50">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        X (Twitter)
                      </button>
                    </div>

                    <div className="flex gap-1">
                      <span title="Instagram — em breve" className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed">📷 IG</span>
                      <span title="WhatsApp — em breve"  className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed">💬 WA</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Carregar mais */}
      {!loading && hasMore && (
        <div className="mt-8 flex justify-center">
          <button onClick={loadMore} disabled={loadingMore}
            className="px-8 py-3 bg-[#1a1d27] hover:bg-[#22263a] border border-gray-700 hover:border-gray-500 rounded-xl text-sm font-medium text-gray-300 transition-all disabled:opacity-50 flex items-center gap-2">
            {loadingMore
              ? <><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Carregando...</>
              : <>Carregar mais <span className="text-gray-500 text-xs">({offers.length.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')})</span></>
            }
          </button>
        </div>
      )}

      {!loading && offers.length > 0 && !hasMore && (
        <p className="mt-8 text-center text-gray-600 text-sm">
          ✓ Todos os {offers.length.toLocaleString('pt-BR')} posts exibidos
        </p>
      )}
    </div>
  );
}
