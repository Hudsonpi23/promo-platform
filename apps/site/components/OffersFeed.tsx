'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PublicPost, FeedResponse } from '@/lib/api';
import { OfferGrid } from './OfferGrid';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface OffersFeedProps {
  initialPosts: PublicPost[];
  initialHasMore: boolean;
  initialNextCursor?: string | null;
  searchQuery?: string;
  sort?: string;
}

export function OffersFeed({ initialPosts, initialHasMore, initialNextCursor, searchQuery, sort }: OffersFeedProps) {
  const router      = useRouter();
  const [posts, setPosts]     = useState<PublicPost[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [cursor, setCursor]   = useState<string | null>(initialNextCursor ?? null);
  const [loading, setLoading] = useState(false);
  const sentinelRef           = useRef<HTMLDivElement>(null);

  // ── Carregar próxima página via cursor ──────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '24' });
      if (cursor) params.set('cursor', cursor);
      if (searchQuery) params.set('q', searchQuery);
      if (sort && sort !== 'recent') params.set('sort', sort);

      const res = await fetch(`${API_URL}/public/posts?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FeedResponse = await res.json();

      const existingIds = new Set(posts.map(p => p.id));
      const fresh = (data.items || []).filter(p => !existingIds.has(p.id));
      setPosts(prev => [...prev, ...fresh]);
      setHasMore(data.hasMore);
      setCursor(data.nextCursor ?? null);
    } catch (err) {
      console.error('[OffersFeed] Erro ao carregar mais:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, cursor, posts, searchQuery, sort]);

  // ── Scroll infinito via IntersectionObserver ────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

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

  // ── Feed com scroll infinito ─────────────────────────────────────────────────
  return (
    <>
      <OfferGrid posts={posts} />

      {/* Sentinel para o IntersectionObserver */}
      <div ref={sentinelRef} className="h-px" aria-hidden="true" />

      {/* Indicador de carregamento */}
      {loading && (
        <div className="flex justify-center items-center gap-3 py-10 text-blue-600 font-medium">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando mais ofertas...
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
