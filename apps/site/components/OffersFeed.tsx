'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PublicPost, FeedResponse } from '@/lib/api';
import { OfferGrid } from './OfferGrid';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface OffersFeedProps {
  initialPosts: PublicPost[];
  initialHasMore: boolean;
  searchQuery?: string;
  sort?: string;
}

export function OffersFeed({ initialPosts, initialHasMore, searchQuery, sort }: OffersFeedProps) {
  const router    = useRouter();
  const [posts, setPosts]     = useState<PublicPost[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);

  // ── Carregar mais (próxima página) ──────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams({ page: String(nextPage), limit: '24' });
      if (searchQuery) params.set('q', searchQuery);
      if (sort && sort !== 'recent') params.set('sort', sort);

      const res = await fetch(`${API_URL}/public/posts?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FeedResponse = await res.json();

      const existingIds = new Set(posts.map(p => p.id));
      const fresh = (data.items || []).filter(p => !existingIds.has(p.id));
      setPosts(prev => [...prev, ...fresh]);
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch (err) {
      console.error('[OffersFeed] Erro ao carregar mais:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, posts, searchQuery, sort]);

  // ── Sem resultados na busca ──────────────────────────────────────────────────
  if (posts.length === 0 && searchQuery) {
    return (
      <div className="bg-white rounded-2xl border-2 border-blue-100 py-16 text-center px-6">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-bold text-blue-800 mb-2">
          Nenhuma oferta para &ldquo;{searchQuery}&rdquo;
        </h3>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
          Não encontramos produtos com esse nome. Tente outro termo ou veja todas as ofertas.
        </p>
        <button
          onClick={() => router.replace('/')}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold transition-all shadow-md text-base"
        >
          🏠 Ver todas as ofertas
        </button>
      </div>
    );
  }

  // ── Sem ofertas em geral ─────────────────────────────────────────────────────
  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-blue-100 py-16 text-center px-6">
        <div className="text-6xl mb-4">📭</div>
        <h3 className="text-xl font-bold text-blue-800 mb-2">Nenhuma oferta no momento</h3>
        <p className="text-gray-500">Novas ofertas chegam em breve. Siga a Manu no Telegram!</p>
      </div>
    );
  }

  // ── Feed normal ──────────────────────────────────────────────────────────────
  return (
    <>
      <OfferGrid posts={posts} />

      {/* Carregar mais */}
      {hasMore && (
        <div className="text-center mt-12">
          <button
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Carregando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Carregar mais ofertas
              </>
            )}
          </button>
        </div>
      )}

      {/* Fim do feed */}
      {!hasMore && posts.length > 0 && (
        <p className="mt-10 text-center text-gray-400 text-sm font-medium">
          ✓ Você viu todas as {posts.length} ofertas disponíveis
        </p>
      )}
    </>
  );
}
