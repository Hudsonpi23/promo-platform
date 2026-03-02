'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Niche } from '@/lib/api';

interface FiltersBarProps {
  niches: Niche[];
  activeNiche?: string;
  totalCount?: number;
  showSearch?: boolean;
  showSort?: boolean;
}

export function FiltersBar({ niches, activeNiche, totalCount, showSearch = true, showSort = true }: FiltersBarProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const currentQ     = searchParams.get('q') || '';
  const currentSort  = searchParams.get('sort') || 'recent';

  // Estado local do campo de busca — sincroniza com a URL
  const [input, setInput] = useState(currentQ);
  const prevQ = useRef(currentQ);

  useEffect(() => {
    // Quando a URL muda (ex: limpar busca), reseta o input
    if (prevQ.current !== currentQ) {
      setInput(currentQ);
      prevQ.current = currentQ;
    }
  }, [currentQ]);

  // ── Buscar ──────────────────────────────────────────────────────────────────
  const doSearch = (term: string) => {
    const params = new URLSearchParams();
    if (term.trim()) params.set('q', term.trim());
    if (currentSort !== 'recent') params.set('sort', currentSort);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : '/');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(input);
  };

  // ── Limpar busca ─────────────────────────────────────────────────────────────
  const clearSearch = () => {
    setInput('');
    const params = new URLSearchParams();
    if (currentSort !== 'recent') params.set('sort', currentSort);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : '/');
  };

  // ── Ordenação ────────────────────────────────────────────────────────────────
  const setSort = (sort: string) => {
    const params = new URLSearchParams();
    if (currentQ) params.set('q', currentQ);
    if (sort !== 'recent') params.set('sort', sort);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : '/');
  };

  return (
    <div className="space-y-4 mb-8">

      {/* Linha 1: Busca + Ordenação */}
      <div className="flex flex-col sm:flex-row gap-3">

        {showSearch && (
          <form onSubmit={handleSubmit} className="flex-1">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400 pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch(input)}
                placeholder="Buscar ofertas... (ex: notebook, creatina, tênis)"
                className="w-full pl-12 pr-24 py-3 rounded-xl border-2 border-blue-200 bg-white text-blue-900 placeholder:text-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-medium"
              />
              {/* Botão limpar */}
              {input && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-[72px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 flex items-center justify-center transition-colors text-xs font-bold"
                  title="Limpar busca"
                >
                  ✕
                </button>
              )}
              {/* Botão buscar */}
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
              >
                Buscar
              </button>
            </div>
          </form>
        )}

        {showSort && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setSort('recent')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                currentSort === 'recent'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              🕐 Recentes
            </button>
            <button
              onClick={() => setSort('discount')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                currentSort === 'discount'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              🔥 Maior Desconto
            </button>
          </div>
        )}
      </div>

      {/* Linha 2: Tag de busca ativa + chips de nicho */}
      <div className="flex gap-2 flex-wrap items-center">
        {/* Tag de busca ativa */}
        {currentQ && (
          <button
            onClick={clearSearch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-blue-600 text-white border-2 border-blue-600 shadow-sm hover:bg-blue-700 transition-all"
          >
            🔍 &quot;{currentQ}&quot; <span className="text-blue-200">✕</span>
          </button>
        )}

        {/* Botão "Todas as ofertas" quando há busca ativa */}
        {currentQ && (
          <button
            onClick={clearSearch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-white text-blue-700 border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-all"
          >
            🏠 Todas as ofertas
          </button>
        )}

        {/* Chips de nicho */}
        {!currentQ && (
          <>
            <span className="text-sm font-bold text-blue-600 mr-1">Filtrar:</span>
            {niches.map((niche) => {
              const isActive = activeNiche === niche.slug;
              return (
                <a
                  key={niche.id}
                  href={`/nicho/${niche.slug}`}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white border-2 border-blue-600 shadow-md'
                      : 'bg-white border-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-400'
                  }`}
                >
                  {niche.icon && <span>{niche.icon}</span>}
                  {niche.name}
                </a>
              );
            })}
          </>
        )}
      </div>

      {/* Contador */}
      {totalCount !== undefined && (
        <p className="text-sm text-gray-500">
          {currentQ
            ? <>Encontradas <span className="font-bold text-blue-600">{totalCount}</span> ofertas para &quot;{currentQ}&quot;</>
            : <>Mostrando <span className="font-bold text-blue-600">{totalCount}</span> ofertas</>
          }
        </p>
      )}
    </div>
  );
}
