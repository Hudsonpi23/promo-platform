import { Suspense } from 'react';
import Image from 'next/image';
import { getPosts, getNiches, getHighlights, PublicPost, Niche } from '@/lib/api';
import { OfferCard } from '@/components/OfferCard';
import { OfferGrid } from '@/components/OfferGrid';
import { FiltersBar } from '@/components/FiltersBar';
import Link from 'next/link';

export const revalidate = 30;

// Nichos padrão (quando API não retorna)
const DEFAULT_NICHES: Niche[] = [
  { id: '1', name: 'Eletrônicos', slug: 'eletronicos', icon: '📱' },
  { id: '2', name: 'Moda', slug: 'moda', icon: '👗' },
  { id: '3', name: 'Casa', slug: 'casa', icon: '🏠' },
  { id: '4', name: 'Beleza', slug: 'beleza', icon: '💄' },
  { id: '5', name: 'Games', slug: 'games', icon: '🎮' },
  { id: '6', name: 'Esportes', slug: 'esportes', icon: '⚽' },
  { id: '7', name: 'Livros', slug: 'livros', icon: '📚' },
  { id: '8', name: 'Mercado', slug: 'mercado', icon: '🛒' },
];

interface PageProps {
  searchParams: { q?: string; sort?: string; page?: string };
}

export default async function Home({ searchParams }: PageProps) {
  const [postsData, niches, highlights] = await Promise.all([
    getPosts({ 
      limit: 24, 
      sort: (searchParams.sort as 'recent' | 'discount') || 'recent',
      q: searchParams.q,
    }),
    getNiches(),
    getHighlights(),
  ]);

  const posts = postsData.items;
  const displayNiches = niches.length > 0 ? niches : DEFAULT_NICHES;
  const hasMore = postsData.hasMore;
  const isEmpty = postsData.items.length === 0;
  const searchQuery = searchParams.q;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Banner Sem Ofertas */}
      {isEmpty && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center py-2 text-sm font-bold">
          🔄 Aguardando ofertas — Publique ofertas na plataforma para exibi-las aqui!
        </div>
      )}

      {/* Hero Section com Banner da Manu */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 overflow-hidden">
        {/* Banner de fundo */}
        <div className="absolute inset-0">
          <Image
            src="/manu-banner.png"
            alt="Manu das Promoções"
            fill
            className="object-cover object-right-top"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/95 via-blue-900/80 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-20 lg:py-24">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-bold mb-6 border border-white/30">
              <span className={`w-2 h-2 rounded-full ${posts.length > 0 ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></span>
              {posts.length > 0 ? `Ao vivo • ${posts.length}+ ofertas ativas` : 'Em breve • Aguardando ofertas'}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
              As Melhores
              <br />
              <span className="text-blue-300">Promoções</span> do Dia! 🔥
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-lg">
              A Manu garimpa as ofertas mais quentes da internet pra você economizar de verdade!
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#ofertas"
                className="px-8 py-4 rounded-2xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition-all transform hover:scale-105 shadow-xl"
              >
                Ver Ofertas →
              </a>
              <a
                href="https://t.me/manupromocao"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 rounded-2xl bg-blue-600/50 backdrop-blur-sm text-white font-bold hover:bg-blue-600/70 transition-all border border-white/30"
              >
                📲 Siga no Telegram
              </a>
            </div>

            {/* Redes Sociais */}
            <div className="flex items-center gap-4 mt-8">
              <span className="text-blue-200 text-sm font-medium">Siga-nos:</span>
              <div className="flex gap-3">
                <a href="https://t.me/manupromocao" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/20 hover:bg-blue-500 flex items-center justify-center transition-all" title="Telegram">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                </a>
                <a href="https://instagram.com/manupromocao" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/20 hover:bg-pink-500 flex items-center justify-center transition-all" title="Instagram">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a href="https://twitter.com/manupromocao" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-white/20 hover:bg-black flex items-center justify-center transition-all" title="Twitter/X">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-12 md:h-16">
            <path d="M0 100L60 87.5C120 75 240 50 360 37.5C480 25 600 25 720 31.25C840 37.5 960 50 1080 56.25C1200 62.5 1320 62.5 1380 62.5L1440 62.5V100H1380C1320 100 1200 100 1080 100C960 100 840 100 720 100C600 100 480 100 360 100C240 100 120 100 60 100H0Z" fill="#eff6ff"/>
          </svg>
        </div>
      </section>

      {/* Destaques por Categoria */}
      <section className="max-w-7xl mx-auto px-4 -mt-6 relative z-10 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {displayNiches.map((niche) => (
            <Link
              key={niche.id}
              href={`/nicho/${niche.slug}`}
              className="bg-white rounded-2xl p-4 shadow-md hover:shadow-xl border-2 border-blue-100 hover:border-blue-300 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl md:text-3xl group-hover:scale-110 transition-transform">{niche.icon || '📦'}</span>
                <span className="font-bold text-blue-900 group-hover:text-blue-600 transition-colors text-sm md:text-base">
                  {niche.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Seção de Ofertas */}
      <section className="max-w-7xl mx-auto px-4 py-8" id="ofertas">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl">🛒</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-blue-900">
              {searchQuery ? `🔍 Resultados para "${searchQuery}"` : 'Todas as Ofertas'}
            </h2>
          </div>
        </div>

        {/* Filtros */}
        <Suspense fallback={<div className="h-20 bg-blue-100 rounded-2xl animate-pulse" />}>
          <FiltersBar 
            niches={displayNiches}
            totalCount={posts.length}
            showSearch
            showSort
          />
        </Suspense>
      </section>

      {/* Grid de Ofertas */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <OfferGrid 
          posts={posts} 
          emptyMessage={searchQuery ? `Nenhuma oferta encontrada para "${searchQuery}"` : 'Nenhuma oferta disponível'}
        />

        {/* Carregar Mais */}
        {hasMore && (
          <div className="text-center mt-12">
            <button className="px-8 py-4 rounded-2xl bg-blue-100 text-blue-700 font-bold hover:bg-blue-200 transition-colors">
              Carregar mais ofertas
            </button>
          </div>
        )}
      </section>

      {/* CTA Final */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="relative w-24 h-24 mx-auto mb-6 rounded-full overflow-hidden border-4 border-white/30 shadow-xl">
            <Image
              src="/manu-avatar.png"
              alt="Manu"
              fill
              className="object-cover object-top"
            />
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
            Não perca nenhuma oferta! 🎯
          </h2>
          <p className="text-blue-200 mb-8 text-lg">
            Siga a Manu nas redes sociais e receba as melhores promoções em primeira mão!
          </p>
          
          {/* Botões de Redes Sociais */}
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://t.me/manupromocao"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-bold transition-all"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              Telegram
            </a>
            <a
              href="https://instagram.com/manupromocao"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold transition-all"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Instagram
            </a>
            <a
              href="https://twitter.com/manupromocao"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-black hover:bg-gray-800 text-white font-bold transition-all"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Twitter/X
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
