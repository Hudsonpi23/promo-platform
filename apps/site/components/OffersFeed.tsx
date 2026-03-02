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
  const router = useRouter();
  const [posts, setPosts]         = useState<PublicPost[]>(initialPosts);
  const [hasMore, setHasMore]     = useState(initialHasMore);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const nextPage = page + 1;
      const params = new URLSearchParams({ page: String(nextPage), limit: '24' });
      if (searchQuery) params.set('q', searchQuery);
      if (sort)        params.set('sort', sort);

      const res = await fetch(`${API_URL}/public/posts?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: FeedResponse = await res.json();
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const fresh = (data.items || []).filter(p => !existingIds.has(p.id));
        return [...prev, ...fresh];
      });
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch (err) {
      console.error('[OffersFeed] loadMore error:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, searchQuery, sort]);

  // Nenhum resultado encontrado — mostrar botão para limpar busca
  if (posts.length === 0 && searchQuery) {
    return (
      <div className="bg-white rounded-2xl border-2 border-blue-100 py-16 text-center px-6">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-bold text-blue-800 mb-2">
          Nenhuma oferta encontrada para &quot;{searchQuery}&quot;
        </h3>
        <p className="text-gray-500 mb-6">
          Tente outro termo ou veja todas as ofertas disponíveis.
        </p>
        <button
          onClick={() => router.replace('/')}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md"
        >
          ✕ Limpar busca — Ver todas as ofertas
        </button>
      </div>
    );
  }

  return (
    <>
      <OfferGrid
        posts={posts}
        emptyMessage="Nenhuma oferta disponível no momento"
      />

      {hasMore && (
        <div className="text-center mt-12">
          <button
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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

      {!hasMore && posts.length > 0 && (
        <p className="mt-10 text-center text-gray-400 text-sm font-medium">
          ✓ Você viu todas as {posts.length} ofertas disponíveis
        </p>
      )}
    </>
  );
}
