'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth } from '@/lib/auth';

interface HistoryPost {
  id: string;
  slug: string;
  goCode: string;
  title: string;
  price: number;
  originalPrice: number | null;
  discountPct: number;
  imageUrl: string | null;
  affiliateUrl: string;
  publishedAt: string;
  isActive: boolean;
  niche: { name: string; slug: string; icon: string } | null;
  store: { name: string; slug: string } | null;
  offer: { id: string; mainImage: string | null; images: string[] } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

function formatPrice(value?: number | null) {
  if (!value && value !== 0) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RepostStatus({ status }: { status: 'idle' | 'loading' | 'ok' | 'error'; label: string }) {
  if (status === 'loading') return <span className="text-xs text-yellow-400 animate-pulse">Enviando...</span>;
  if (status === 'ok')      return <span className="text-xs text-emerald-400">✓ Enviado</span>;
  if (status === 'error')   return <span className="text-xs text-red-400">✗ Falhou</span>;
  return null;
}

export default function HistoricoPage() {
  const [posts, setPosts] = useState<HistoryPost[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [repostStatus, setRepostStatus] = useState<Record<string, { telegram?: 'idle' | 'loading' | 'ok' | 'error'; twitter?: 'idle' | 'loading' | 'ok' | 'error' }>>({});

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchPosts = useCallback(async (page: number, searchTerm: string, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (searchTerm) params.set('q', searchTerm);

      const res = await fetchWithAuth(`${apiBase}/api/history?${params}`);
      if (!res.ok) throw new Error('Erro ao buscar histórico');

      const data = await res.json();
      if (append) {
        setPosts(prev => [...prev, ...data.data]);
      } else {
        setPosts(data.data);
      }
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [apiBase]);

  useEffect(() => {
    setCurrentPage(1);
    fetchPosts(1, search, false);
  }, [search]);

  useEffect(() => {
    fetchPosts(1, '', false);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  function loadMore() {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchPosts(nextPage, search, true);
  }

  async function repostTelegram(postId: string) {
    setRepostStatus(prev => ({ ...prev, [postId]: { ...prev[postId], telegram: 'loading' } }));
    try {
      const res = await fetchWithAuth(`${apiBase}/api/history/${postId}/repost-telegram`, { method: 'POST' });
      const data = await res.json();
      setRepostStatus(prev => ({ ...prev, [postId]: { ...prev[postId], telegram: data.success ? 'ok' : 'error' } }));
    } catch {
      setRepostStatus(prev => ({ ...prev, [postId]: { ...prev[postId], telegram: 'error' } }));
    }
  }

  async function repostTwitter(postId: string) {
    setRepostStatus(prev => ({ ...prev, [postId]: { ...prev[postId], twitter: 'loading' } }));
    try {
      const res = await fetchWithAuth(`${apiBase}/api/history/${postId}/repost-twitter`, { method: 'POST' });
      const data = await res.json();
      setRepostStatus(prev => ({ ...prev, [postId]: { ...prev[postId], twitter: data.success ? 'ok' : 'error' } }));
    } catch {
      setRepostStatus(prev => ({ ...prev, [postId]: { ...prev[postId], twitter: 'error' } }));
    }
  }

  const totalPosted = pagination?.total ?? 0;

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-6">
      {/* Cabeçalho */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📋</span>
          <h1 className="text-2xl font-bold text-white">Histórico de Posts</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Todos os posts publicados — manualmente ou pela IA. Clique em repostar para republicar em qualquer canal.
        </p>
      </div>

      {/* Barra de busca + contador */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar por título..."
            className="flex-1 bg-[#1a1d27] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            Buscar
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setSearch(''); }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              ✕
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="bg-[#1a1d27] border border-gray-700 rounded-lg px-4 py-2">
            {loading ? '...' : (
              <span>
                <span className="text-white font-semibold">{totalPosted.toLocaleString('pt-BR')}</span> posts publicados
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Estado de erro */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading inicial */}
      {loading && (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-gray-400">Carregando histórico...</span>
        </div>
      )}

      {/* Lista de posts */}
      {!loading && posts.length === 0 && !error && (
        <div className="text-center py-20 text-gray-500">
          <span className="text-5xl block mb-4">📭</span>
          <p className="text-lg font-medium">Nenhum post encontrado</p>
          <p className="text-sm mt-2">
            {search
              ? `Nenhum post com "${search}"`
              : 'Posts publicados via Auto Publicar ou manualmente aparecerão aqui.'}
          </p>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div className="grid gap-4">
          {posts.map(post => {
            const statusMap = repostStatus[post.id] || {};
            const img = post.imageUrl || post.offer?.mainImage || null;

            return (
              <div
                key={post.id}
                className="bg-[#1a1d27] border border-gray-800 rounded-xl p-4 flex gap-4 hover:border-gray-600 transition-colors"
              >
                {/* Imagem */}
                <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-800">
                  {img ? (
                    <img
                      src={img}
                      alt={post.title}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-2xl">🖼</div>
                  )}
                </div>

                {/* Conteúdo principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-1">
                    {/* Tags niche/store */}
                    {post.niche && (
                      <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-2 py-0.5">
                        {post.niche.icon} {post.niche.name}
                      </span>
                    )}
                    {post.store && (
                      <span className="text-xs bg-gray-700 text-gray-300 rounded px-2 py-0.5">
                        {post.store.name}
                      </span>
                    )}
                    {!post.isActive && (
                      <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded px-2 py-0.5">
                        Inativo
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 mb-2">
                    {post.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
                    <span className="text-emerald-400 font-bold">{formatPrice(post.price)}</span>
                    {post.originalPrice && (
                      <span className="text-gray-500 line-through text-xs">{formatPrice(post.originalPrice)}</span>
                    )}
                    {post.discountPct > 0 && (
                      <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded font-semibold">
                        -{post.discountPct}%
                      </span>
                    )}
                  </div>

                  {/* Data/hora */}
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatDate(post.publishedAt)}
                    </span>
                    <span className="text-xs text-gray-600">#{post.goCode}</span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-col gap-2 flex-shrink-0 items-end justify-between">
                  {/* Link afiliado */}
                  <a
                    href={post.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Ver produto ↗
                  </a>

                  {/* Botões de repost */}
                  <div className="flex flex-col gap-1 items-end">
                    <div className="flex items-center gap-2">
                      <RepostStatus status={statusMap.telegram || 'idle'} label="Telegram" />
                      <button
                        onClick={() => repostTelegram(post.id)}
                        disabled={statusMap.telegram === 'loading'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.474c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.873.747z" />
                        </svg>
                        Telegram
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <RepostStatus status={statusMap.twitter || 'idle'} label="X" />
                      <button
                        onClick={() => repostTwitter(post.id)}
                        disabled={statusMap.twitter === 'loading'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 text-gray-300 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        X (Twitter)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botão carregar mais */}
      {!loading && pagination?.hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-8 py-3 bg-[#1a1d27] hover:bg-[#22263a] border border-gray-700 hover:border-gray-500 rounded-xl text-sm font-medium text-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loadingMore ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Carregando...
              </>
            ) : (
              <>
                Carregar mais
                <span className="text-gray-500 text-xs">
                  ({posts.length.toLocaleString('pt-BR')} de {pagination.total.toLocaleString('pt-BR')})
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Tudo carregado */}
      {!loading && !pagination?.hasMore && posts.length > 0 && (
        <div className="mt-8 text-center text-gray-600 text-sm">
          ✓ Todos os {posts.length.toLocaleString('pt-BR')} posts exibidos
        </div>
      )}
    </div>
  );
}
