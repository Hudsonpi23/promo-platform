'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';

// Mesmo padrão da página de Ofertas — useSWR + fetcher
// Quando o Auto Publicar cria uma oferta (curationStatus: 'APPROVED'),
// ela aparece aqui automaticamente no próximo refresh.

const APPROVED = ['APPROVED', 'AI_PROCESSING', 'AI_READY', 'AI_BLOCKED'];

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
  // Mesmo endpoint e fetcher da página de Ofertas
  const { data, error, isLoading, mutate } = useSWR(
    '/api/offers?active=true',
    fetcher,
    { refreshInterval: 30_000 } // atualiza a cada 30s — igual ao fluxo de Ofertas
  );

  const allOffers: any[] = Array.isArray(data) ? data : (data as any)?.data || [];

  // Filtra client-side: só as aprovadas (criadas pelo Auto Publicar)
  const offers = allOffers.filter(o => APPROVED.includes(o.curationStatus));

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-6">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="text-3xl">📋</span>
            <h1 className="text-2xl font-bold">Histórico de Posts</h1>
            {!isLoading && (
              <span className="px-2.5 py-1 bg-[#1a1d27] border border-gray-700 rounded-full text-xs text-gray-400">
                {offers.length} post{offers.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">
            Posts criados via Auto Publicar — atualizados automaticamente.
          </p>
        </div>
        <button
          onClick={() => mutate()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1d27] hover:bg-[#22263a] border border-gray-700 hover:border-gray-500 rounded-lg text-sm text-gray-400 hover:text-white transition-all disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Erro */}
      {error && (
        <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-red-400 text-sm font-medium">Não foi possível carregar o histórico</p>
            <p className="text-red-400/60 text-xs mt-0.5 font-mono">{error?.message || 'Erro de conexão'}</p>
          </div>
          <button onClick={() => mutate()}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs rounded-lg font-medium transition-colors">
            Tentar agora
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Carregando histórico...
        </div>
      )}

      {/* Vazio */}
      {!isLoading && !error && offers.length === 0 && (
        <div className="text-center py-24 text-gray-500">
          <span className="text-5xl block mb-4">📭</span>
          <p className="text-lg font-medium text-gray-400">Nenhum post ainda</p>
          <p className="text-sm mt-2">Quando você publicar via Auto Publicar, os posts aparecem aqui automaticamente.</p>
        </div>
      )}

      {/* Cards */}
      {!isLoading && offers.length > 0 && (
        <div className="grid gap-3">
          {offers.map((offer: any) => {
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

                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-emerald-400 font-bold">{formatPrice(offer.finalPrice)}</span>
                    {offer.originalPrice && (
                      <span className="text-gray-500 line-through text-xs">{formatPrice(offer.originalPrice)}</span>
                    )}
                    {(offer.discountPct || offer.discount) > 0 && (
                      <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded font-semibold">
                        -{offer.discountPct || offer.discount}%
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

                {/* Link */}
                {offer.affiliateUrl && (
                  <div className="flex-shrink-0 flex items-start">
                    <a href={offer.affiliateUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 underline whitespace-nowrap mt-1">
                      Ver produto ↗
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && offers.length > 0 && (
        <p className="mt-8 text-center text-gray-600 text-sm">
          ✓ {offers.length} post{offers.length !== 1 ? 's' : ''} no histórico
        </p>
      )}
    </div>
  );
}
