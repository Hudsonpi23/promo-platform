'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '@/lib/auth';

// Verifica novos posts a cada 30s; se há erro de rede, tenta reconectar a cada 15s
const POLL_INTERVAL_MS  = 30_000;
const RETRY_INTERVAL_MS = 15_000;

interface HistoryItem {
  id: string;
  source: 'published_post' | 'approved_offer';
  offerId: string;
  title: string;
  price: number;
  originalPrice: number | null;
  discountPct: number;
  imageUrl: string | null;
  affiliateUrl: string;
  date: string;
  niche: { name: string; slug: string; icon: string } | null;
  store: { name: string; slug: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

type RepostState = 'idle' | 'loading' | 'ok' | 'error';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(value?: number | null) {
  if (!value && value !== 0) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function RepostFeedback({ state }: { state: RepostState }) {
  if (state === 'loading') return <span className="text-xs text-yellow-400 animate-pulse">Enviando...</span>;
  if (state === 'ok')      return <span className="text-xs text-emerald-400 font-medium">✓ Enviado</span>;
  if (state === 'error')   return <span className="text-xs text-red-400 font-medium">✗ Falhou</span>;
  return null;
}

function SourceBadge({ source }: { source: HistoryItem['source'] }) {
  if (source === 'published_post') {
    return (
      <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded px-2 py-0.5">
        ✓ Auto Publicado
      </span>
    );
  }
  return (
    <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 rounded px-2 py-0.5">
      ✓ Aprovado
    </span>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function HistoricoPage() {
  const [items, setItems]             = useState<HistoryItem[]>([]);
  const [pagination, setPagination]   = useState<Pagination | null>(null);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [hasError, setHasError]       = useState(false);
  const [retryIn, setRetryIn]         = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [newCount, setNewCount]       = useState(0);

  // Filtro de busca (data é opcional — por padrão mostra TUDO)
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [filterFrom, setFilterFrom]   = useState('');
  const [filterTo, setFilterTo]       = useState('');

  // Repost: { [itemId]: { telegram, twitter } }
  const [repostStatus, setRepostStatus] = useState<
    Record<string, { telegram: RepostState; twitter: RepostState }>
  >({});

  // Refs para usar dentro dos intervals sem closures velhas
  const itemsRef  = useRef<HistoryItem[]>([]);
  const searchRef = useRef('');
  const fromRef   = useRef('');
  const toRef     = useRef('');
  const errorRef  = useRef(false);

  itemsRef.current  = items;
  searchRef.current = search;
  fromRef.current   = filterFrom;
  toRef.current     = filterTo;
  errorRef.current  = hasError;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const doFetch = useCallback(async (opts: {
    page: number;
    q: string;
    from: string;
    to: string;
    mode: 'full' | 'append' | 'silent';
  }) => {
    const { page, q, from, to, mode } = opts;

    if (mode === 'full')   { setLoading(true); setHasError(false); }
    if (mode === 'append') setLoadingMore(true);
    if (mode === 'silent') setRefreshing(true);

    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (q)    params.set('q', q);
      if (from) params.set('from', from + 'T00:00:00.000Z');
      // "to" em modo silent é sempre agora, para capturar posts novos
      const toFinal = mode === 'silent' ? toInputDate(new Date()) : to;
      if (toFinal) params.set('to', toFinal + 'T23:59:59.999Z');

      const res = await fetchWithAuth(`${apiBase}/api/history?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setHasError(false);
      setRetryIn(null);
      setLastRefresh(new Date());

      if (mode === 'silent') {
        // Detecta itens novos (não vistos ainda)
        const known = new Set(itemsRef.current.map(i => i.id));
        const fresh = (data.data as HistoryItem[]).filter(i => !known.has(i.id));
        if (fresh.length > 0) {
          setNewCount(n => n + fresh.length);
          setItems(prev => [...fresh, ...prev]);
          setPagination(data.pagination);
        }
      } else if (mode === 'append') {
        setItems(prev => [...prev, ...data.data]);
        setPagination(data.pagination);
      } else {
        setItems(data.data);
        setPagination(data.pagination);
        setNewCount(0);
      }
    } catch {
      if (mode !== 'silent') {
        setHasError(true);
      }
    } finally {
      if (mode === 'full')   setLoading(false);
      if (mode === 'append') setLoadingMore(false);
      if (mode === 'silent') setRefreshing(false);
    }
  }, [apiBase]);

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
    doFetch({ page: 1, q: search, from: filterFrom, to: filterTo, mode: 'full' });
  }, [search, filterFrom, filterTo]);

  // ── Polling: 30s normal, 15s quando há erro ────────────────────────────────
  useEffect(() => {
    let countdown = 0;
    let countdownTimer: ReturnType<typeof setInterval>;

    const tick = () => {
      const isErr = errorRef.current;
      const interval = isErr ? RETRY_INTERVAL_MS : POLL_INTERVAL_MS;

      if (isErr) {
        // Exibe contador regressivo para o usuário saber que vai tentar de novo
        countdown = Math.ceil(interval / 1000);
        setRetryIn(countdown);
        countdownTimer = setInterval(() => {
          countdown -= 1;
          setRetryIn(Math.max(0, countdown));
          if (countdown <= 0) clearInterval(countdownTimer);
        }, 1000);
      }

      doFetch({
        page: 1,
        q: searchRef.current,
        from: fromRef.current,
        to: toRef.current,
        mode: isErr ? 'full' : 'silent',
      });

      // Reprograma próximo tick
      pollingTimer = setTimeout(tick, interval);
    };

    let pollingTimer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(pollingTimer);
      clearInterval(countdownTimer);
    };
  }, [doFetch]);

  // ── Ações ─────────────────────────────────────────────────────────────────

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  function loadMore() {
    const next = currentPage + 1;
    setCurrentPage(next);
    doFetch({ page: next, q: search, from: filterFrom, to: filterTo, mode: 'append' });
  }

  function manualRefresh() {
    setCurrentPage(1);
    setNewCount(0);
    doFetch({ page: 1, q: search, from: filterFrom, to: filterTo, mode: 'full' });
  }

  function clearDateFilter() {
    setFilterFrom('');
    setFilterTo('');
  }

  function setChannelState(id: string, channel: 'telegram' | 'twitter', state: RepostState) {
    setRepostStatus(prev => {
      const current = prev[id] ?? { telegram: 'idle' as RepostState, twitter: 'idle' as RepostState };
      return { ...prev, [id]: { ...current, [channel]: state } };
    });
  }

  async function repostTelegram(item: HistoryItem) {
    setChannelState(item.id, 'telegram', 'loading');
    try {
      const res = await fetchWithAuth(
        `${apiBase}/api/history/${item.id}/repost-telegram?source=${item.source}`,
        { method: 'POST' },
      );
      const data = await res.json();
      setChannelState(item.id, 'telegram', data.success ? 'ok' : 'error');
    } catch {
      setChannelState(item.id, 'telegram', 'error');
    }
  }

  async function repostTwitter(item: HistoryItem) {
    setChannelState(item.id, 'twitter', 'loading');
    try {
      const res = await fetchWithAuth(
        `${apiBase}/api/history/${item.id}/repost-twitter?source=${item.source}`,
        { method: 'POST' },
      );
      const data = await res.json();
      setChannelState(item.id, 'twitter', data.success ? 'ok' : 'error');
    } catch {
      setChannelState(item.id, 'twitter', 'error');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const total = pagination?.total ?? 0;

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-6">

      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="text-3xl">📋</span>
            <h1 className="text-2xl font-bold">Histórico de Posts</h1>

            {newCount > 0 && (
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold animate-pulse">
                +{newCount} novo{newCount > 1 ? 's' : ''}
              </span>
            )}

            {refreshing && !hasError && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin inline-block" />
                Verificando...
              </span>
            )}
          </div>

          <p className="text-gray-400 text-sm">
            Arquivo completo de todos os posts publicados via Auto Publicar.
            {lastRefresh && !hasError && (
              <span className="text-gray-600 ml-2">
                Atualizado: {lastRefresh.toLocaleTimeString('pt-BR')}
              </span>
            )}
            {hasError && retryIn !== null && (
              <span className="text-red-400 ml-2">
                API indisponível — reconectando em {retryIn}s...
              </span>
            )}
          </p>
        </div>

        <button
          onClick={manualRefresh}
          disabled={loading || refreshing}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1d27] hover:bg-[#22263a] border border-gray-700 hover:border-gray-500 rounded-lg text-sm text-gray-400 hover:text-white transition-all disabled:opacity-50 whitespace-nowrap"
        >
          <svg className={`w-4 h-4 ${loading && !loadingMore ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar agora
        </button>
      </div>

      {/* Barra de filtros */}
      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-4 mb-5 space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar por título do produto..."
            className="flex-1 bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
            Buscar
          </button>
          {search && (
            <button type="button" onClick={() => { setSearchInput(''); setSearch(''); }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">✕</button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Filtrar por data:</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">De</label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Até</label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          {(filterFrom || filterTo) && (
            <button onClick={clearDateFilter}
              className="text-xs text-blue-400 hover:text-blue-300 underline">
              Limpar filtro
            </button>
          )}

          <div className="ml-auto">
            {!loading && (
              <span className="text-gray-400 text-sm">
                <span className="text-white font-bold">{total.toLocaleString('pt-BR')}</span> posts no histórico
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Erro com retry */}
      {hasError && (
        <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
          <span className="text-red-400 text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-red-400 text-sm font-medium">
              Não foi possível conectar à API
            </p>
            <p className="text-red-400/70 text-xs mt-0.5">
              {retryIn !== null && retryIn > 0
                ? `Tentando reconectar em ${retryIn} segundo${retryIn !== 1 ? 's' : ''}...`
                : 'Reconectando agora...'}
            </p>
          </div>
          <button onClick={manualRefresh}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs rounded-lg font-medium transition-colors">
            Tentar agora
          </button>
        </div>
      )}

      {/* Loading inicial */}
      {loading && !hasError && (
        <div className="flex justify-center items-center py-24 gap-3 text-gray-400">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Carregando histórico completo...
        </div>
      )}

      {/* Vazio */}
      {!loading && !hasError && items.length === 0 && (
        <div className="text-center py-24 text-gray-500">
          <span className="text-5xl block mb-4">📭</span>
          <p className="text-lg font-medium text-gray-400">Nenhum post encontrado</p>
          <p className="text-sm mt-2">
            {search
              ? `Nenhum resultado para "${search}"`
              : filterFrom || filterTo
                ? 'Nenhum post no período selecionado. Limpe o filtro de data.'
                : 'Posts do Auto Publicar aparecerão aqui automaticamente.'}
          </p>
        </div>
      )}

      {/* Lista de posts */}
      {!loading && items.length > 0 && (
        <div className="grid gap-3">
          {items.map(item => {
            const st = repostStatus[item.id] ?? { telegram: 'idle' as RepostState, twitter: 'idle' as RepostState };
            return (
              <div key={item.id}
                className="bg-[#1a1d27] border border-gray-800 hover:border-gray-600 rounded-xl p-4 flex gap-4 transition-colors">

                {/* Imagem */}
                <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-800">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-2xl">🖼</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    <SourceBadge source={item.source} />
                    {item.niche && (
                      <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-2 py-0.5">
                        {item.niche.icon} {item.niche.name}
                      </span>
                    )}
                    {item.store && (
                      <span className="text-xs bg-gray-700 text-gray-300 rounded px-2 py-0.5">
                        {item.store.name}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-2">
                    {item.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-emerald-400 font-bold">{formatPrice(item.price)}</span>
                    {item.originalPrice && (
                      <span className="text-gray-500 line-through text-xs">{formatPrice(item.originalPrice)}</span>
                    )}
                    {item.discountPct > 0 && (
                      <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded font-semibold">
                        -{item.discountPct}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDate(item.date)}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex-shrink-0 flex flex-col gap-2 items-end justify-between">
                  <a href={item.affiliateUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline whitespace-nowrap">
                    Ver produto ↗
                  </a>

                  <div className="flex flex-col gap-1.5 items-end">
                    <div className="flex items-center gap-2">
                      <RepostFeedback state={st.telegram} />
                      <button onClick={() => repostTelegram(item)}
                        disabled={st.telegram === 'loading'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-400 text-xs rounded-lg font-medium transition-colors disabled:opacity-50">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.474c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.873.747z" />
                        </svg>
                        Telegram
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <RepostFeedback state={st.twitter} />
                      <button onClick={() => repostTwitter(item)}
                        disabled={st.twitter === 'loading'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 text-gray-300 text-xs rounded-lg font-medium transition-colors disabled:opacity-50">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        X (Twitter)
                      </button>
                    </div>

                    <div className="flex gap-1">
                      <span title="Instagram — em breve"
                        className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed">
                        📷 IG
                      </span>
                      <span title="WhatsApp — em breve"
                        className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed">
                        💬 WA
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Carregar mais */}
      {!loading && pagination?.hasMore && (
        <div className="mt-8 flex justify-center">
          <button onClick={loadMore} disabled={loadingMore}
            className="px-8 py-3 bg-[#1a1d27] hover:bg-[#22263a] border border-gray-700 hover:border-gray-500 rounded-xl text-sm font-medium text-gray-300 transition-all disabled:opacity-50 flex items-center gap-2">
            {loadingMore
              ? <><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Carregando...</>
              : <>Carregar mais <span className="text-gray-500 text-xs">({items.length.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')})</span></>
            }
          </button>
        </div>
      )}

      {!loading && items.length > 0 && !pagination?.hasMore && (
        <div className="mt-8 text-center text-gray-600 text-sm">
          ✓ Todos os {items.length.toLocaleString('pt-BR')} posts exibidos
        </div>
      )}
    </div>
  );
}
