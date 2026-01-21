'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/Card';
import { fetcher, Batch, PostDraft, Offer, dispatchBatch, postToXNow, getTwitterStatus } from '@/lib/api';
import { cn, getStatusColor, getStatusLabel } from '@/lib/utils';

export default function CargasPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Buscar cargas do dia selecionado
  const { data: batchesRaw, error: batchesError, mutate: mutateBatches } = useSWR<Batch[]>(
    `/api/batches?date=${selectedDate}`,
    fetcher,
    { 
      refreshInterval: 10000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  // Estado para carga expandida
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  
  // Estado para seção X expandida
  const [xSectionExpanded, setXSectionExpanded] = useState(true);
  
  // Estado para loading do botão X
  const [postingToX, setPostingToX] = useState<string | null>(null);

  // Buscar drafts da carga expandida
  const { data: draftsRaw, mutate: mutateDrafts } = useSWR<PostDraft[]>(
    expandedBatch ? `/api/drafts?batchId=${expandedBatch}` : null,
    fetcher
  );
  
  // Buscar ofertas para postar no X
  const { data: offersRaw, mutate: mutateOffers } = useSWR<Offer[]>(
    '/api/offers?limit=20',
    fetcher,
    { refreshInterval: 30000 }
  );
  
  // Buscar status do Twitter
  const { data: twitterStatus } = useSWR(
    '/api/twitter/status',
    async (url) => {
      try {
        const status = await getTwitterStatus();
        return status;
      } catch {
        return { configured: false };
      }
    },
    { refreshInterval: 60000 }
  );

  // Garantir que sempre são arrays
  const batches = useMemo(() => 
    Array.isArray(batchesRaw) ? batchesRaw : [], 
    [batchesRaw]
  );
  const drafts = useMemo(() => 
    Array.isArray(draftsRaw) ? draftsRaw : [], 
    [draftsRaw]
  );
  const offers = useMemo(() => 
    Array.isArray(offersRaw) ? offersRaw : [], 
    [offersRaw]
  );

  // Debug: Log data
  if (process.env.NODE_ENV === 'development') {
    console.log('[Cargas] Data:', { 
      batchesCount: batches.length, 
      draftsCount: drafts.length, 
      offersCount: offers.length,
      expandedBatch,
      error: batchesError?.message
    });
  }

  const handleDispatchBatch = async (batchId: string) => {
    try {
      await dispatchBatch(batchId);
      mutateBatches();
      mutateDrafts();
    } catch (error) {
      console.error('Erro ao disparar carga:', error);
    }
  };

  const handleUpdate = () => {
    mutateBatches();
    mutateDrafts();
    mutateOffers();
  };
  
  // Postar no X imediatamente
  const handlePostToX = async (offerId: string) => {
    if (postingToX) return;
    
    setPostingToX(offerId);
    
    try {
      const result = await postToXNow(offerId);
      
      if (result.success) {
        alert(`✅ Postado no X com sucesso!\n\n🔗 ${result.tweetUrl || 'Tweet criado!'}`);
        handleUpdate();
      } else {
        alert(`❌ Erro ao postar no X:\n${result.error}`);
      }
    } catch (error: any) {
      console.error('Erro ao postar no X:', error);
      alert(`❌ Erro ao postar no X:\n${error.message}`);
    } finally {
      setPostingToX(null);
    }
  };

  // Horários padrão das cargas
  const defaultTimes = ['08:00', '11:00', '14:00', '18:00', '22:00'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">📦 Cargas</h1>
          <p className="text-text-muted text-sm">
            Gerencie as cargas de posts por horário
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* ========== X (Twitter) - SEM HORÁRIO FIXO ========== */}
      <div className="bg-gradient-to-r from-blue-900/30 to-blue-800/20 rounded-xl border border-blue-500/30 overflow-hidden">
        {/* Header do X */}
        <div
          className={cn(
            'flex items-center justify-between px-6 py-4 cursor-pointer transition-colors',
            xSectionExpanded ? 'bg-blue-900/20' : 'hover:bg-blue-900/10'
          )}
          onClick={() => setXSectionExpanded(!xSectionExpanded)}
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl">🐦</span>
            <div>
              <h2 className="text-xl font-bold text-blue-400">X (Twitter)</h2>
              <p className="text-sm text-blue-300/70">Sem horário fixo - Poste quando quiser</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {twitterStatus?.configured ? (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                ✅ Conectado
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                ⚠️ Não configurado
              </span>
            )}
            
            <span className="text-blue-400 text-sm">
              {offers.length} ofertas disponíveis
            </span>
            
            <span className={cn(
              'text-blue-400 transition-transform',
              xSectionExpanded && 'rotate-180'
            )}>
              ▼
            </span>
          </div>
        </div>

        {/* Conteúdo do X */}
        {xSectionExpanded && (
          <div className="border-t border-blue-500/30 p-6">
            {!twitterStatus?.configured ? (
              <div className="text-center py-8">
                <span className="text-4xl mb-4 block">⚙️</span>
                <p className="text-blue-300 mb-2">Twitter API não configurada</p>
                <p className="text-blue-400/60 text-sm">
                  Configure as variáveis TWITTER_API_KEY, TWITTER_API_SECRET, etc. no Render
                </p>
              </div>
            ) : offers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {offers.slice(0, 9).map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-surface/50 rounded-lg border border-border p-4 hover:border-blue-500/50 transition-all"
                  >
                    {/* Imagem */}
                    {offer.imageUrl && (
                      <div className="w-full h-32 rounded-lg overflow-hidden mb-3 bg-surface">
                        <img
                          src={offer.imageUrl}
                          alt={offer.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    {/* Título */}
                    <h3 className="font-medium text-text-primary text-sm mb-2 line-clamp-2">
                      {offer.title}
                    </h3>
                    
                    {/* Preços */}
                    <div className="flex items-center gap-2 mb-3">
                      {offer.originalPrice && (
                        <span className="text-text-muted line-through text-xs">
                          R$ {Number(offer.originalPrice).toFixed(2)}
                        </span>
                      )}
                      <span className="text-green-400 font-bold">
                        R$ {Number(offer.finalPrice).toFixed(2)}
                      </span>
                      {(offer.discountPct || offer.discount) && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                          -{offer.discountPct || offer.discount}%
                        </span>
                      )}
                    </div>
                    
                    {/* Loja */}
                    <div className="text-xs text-text-muted mb-3">
                      📦 {offer.store?.name || 'Loja'}
                    </div>
                    
                    {/* Botão Postar no X */}
                    <button
                      onClick={() => handlePostToX(offer.id)}
                      disabled={postingToX === offer.id}
                      className={cn(
                        'w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2',
                        postingToX === offer.id
                          ? 'bg-blue-500/30 text-blue-300 cursor-wait'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      )}
                    >
                      {postingToX === offer.id ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Postando...
                        </>
                      ) : (
                        <>
                          🐦 Postar no X Agora
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-blue-300/70">
                <span className="text-4xl mb-2 block">📭</span>
                <p>Nenhuma oferta disponível</p>
                <p className="text-sm mt-1">Cadastre ofertas na página Ofertas</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========== CARGAS COM HORÁRIO FIXO ========== */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-text-secondary mb-4">
          📅 Cargas Programadas (horários fixos)
        </h2>
      </div>

      {/* Lista de Cargas */}
      <div className="space-y-4">
        {defaultTimes.map((time) => {
          const batch = batches.find((b) => b?.scheduledTime === time);
          const isExpanded = batch ? expandedBatch === batch.id : false;
          const total = batch
            ? (batch.pendingCount || 0) + (batch.approvedCount || 0) + (batch.dispatchedCount || 0) + (batch.errorCount || 0)
            : 0;

          return (
            <div
              key={time}
              className="bg-surface rounded-xl border border-border overflow-hidden"
            >
              {/* Header da Carga */}
              <div
                className={cn(
                  'flex items-center justify-between px-6 py-4 cursor-pointer transition-colors',
                  isExpanded ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'
                )}
                onClick={() => batch && setExpandedBatch(isExpanded ? null : batch.id)}
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-bold text-primary">{time}</span>
                  {batch ? (
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium border',
                        getStatusColor(batch.status)
                      )}>
                        {getStatusLabel(batch.status)}
                      </span>
                      <span className="text-text-muted text-sm">
                        {total} posts
                      </span>
                    </div>
                  ) : (
                    <span className="text-text-muted text-sm">Sem carga</span>
                  )}
                </div>

                {batch && (
                  <div className="flex items-center gap-6">
                    {/* Contadores */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        <span className="text-text-secondary">{batch.pendingCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span className="text-text-secondary">{batch.approvedCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-text-secondary">{batch.dispatchedCount}</span>
                      </div>
                      {batch.errorCount > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          <span className="text-text-secondary">{batch.errorCount}</span>
                        </div>
                      )}
                    </div>

                    {/* Botão Disparar */}
                    {batch.approvedCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDispatchBatch(batch.id);
                        }}
                        className="px-4 py-2 rounded-lg bg-success hover:bg-success/90 text-white text-sm font-medium transition-all"
                      >
                        🚀 Disparar {batch.approvedCount}
                      </button>
                    )}

                    {/* Chevron */}
                    <span className={cn(
                      'text-text-muted transition-transform',
                      isExpanded && 'rotate-180'
                    )}>
                      ▼
                    </span>
                  </div>
                )}
              </div>

              {/* Conteúdo Expandido */}
              {isExpanded && (
                <div className="border-t border-border p-6">
                  {drafts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {drafts.map((draft) => draft && (
                        <Card key={draft.id} draft={draft} onUpdate={handleUpdate} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-text-muted">
                      <span className="text-4xl mb-2 block">📭</span>
                      <p>Nenhum post nesta carga</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-6 text-sm text-text-muted pt-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span>Pendente</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
          <span>Aprovado</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span>Disparado</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span>Erro</span>
        </div>
      </div>
    </div>
  );
}
