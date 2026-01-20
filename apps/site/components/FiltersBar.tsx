'use client';

import { useState } from 'react';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const currentSort = searchParams.get('sort') || 'recent';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search) {
      params.set('q', search);
    } else {
      params.delete('q');
    }
    router.push(`/?${params.toString()}`);
  };

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', sort);
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="space-y-4 mb-8">
      {/* Busca e Ordenação */}
      <div className="flex flex-col sm:flex-row gap-3">
        {showSearch && (
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar ofertas..."
                className="w-full px-4 py-3 pl-12 rounded-xl border-2 border-blue-200 bg-white text-blue-900 placeholder:text-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-medium"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('q');
                    router.push(`/?${params.toString()}`);
                  }}
                  className="absolute right-12 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-100 text-blue-500 hover:bg-blue-200 flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                Buscar
              </button>
            </div>
          </form>
        )}

        {showSort && (
          <div className="flex gap-2">
            <button
              onClick={() => handleSortChange('recent')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                currentSort === 'recent'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400'
              }`}
            >
              🕐 Recentes
            </button>
            <button
              onClick={() => handleSortChange('discount')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                currentSort === 'discount'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400'
              }`}
            >
              🔥 Maior Desconto
            </button>
          </div>
        )}
      </div>

      {/* Chips de Nicho */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-sm font-bold text-blue-600 self-center mr-1">Filtrar:</span>
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
      </div>

      {/* Contador */}
      {totalCount !== undefined && (
        <p className="text-sm text-gray-500">
          Mostrando <span className="font-bold text-blue-600">{totalCount}</span> ofertas
        </p>
      )}
    </div>
  );
}
