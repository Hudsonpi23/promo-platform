'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/Card';
import { PromotionCard } from '@/components/PromotionCard';
import { BatchTabs } from '@/components/BatchTabs';
import { StatsBar } from '@/components/StatsBar';
import { fetcher, Batch, PostDraft, dispatchBatch, dispatchAllPendingToX, getTwitterStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

// Tipos de source
type SourceFilter = 'all' | 'MANUAL' | 'MERCADO_LIVRE';

// Dados fake REMOVIDOS - Plataforma pronta para dados reais
const FAKE_DRAFTS: PostDraft[] = [];

const FAKE_BATCHES: Batch[] = [];

export default function Dashboard() {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'error'>('pending');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showOnlyX, setShowOnlyX] = useState(false);
  // AJUSTE 1 - Modo de operação: 'rapido' = OK dispara imediato, 'carga' = OK só aprova
  const [dispatchMode, setDispatchMode] = useState<'rapido' | 'carga'>('rapido');
  
  // 🔥 NOVO: Modo de Card - 'classico' = Card antigo, 'canais' = PromotionCard com canais
  const [cardMode, setCardMode] = useState<'classico' | 'canais'>('canais');
  
  // Estados para "Enviar Tudo para o X"
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDispatchingToX, setIsDispatchingToX] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState({ current: 0, total: 0 });
  const [dispatchResult, setDispatchResult] = useState<{ sent: number; failed: number } | null>(null);

  // Buscar cargas do dia
  const { data: batches, error: batchesError, isLoading: batchesLoading, mutate: mutateBatches } = useSWR<Batch[]>(
    '/api/batches',
    fetcher,
    { 
      refreshInterval: 10000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  // Buscar drafts da carga selecionada
  const { data: drafts, mutate: mutateDrafts } = useSWR<PostDraft[]>(
    selectedBatchId ? `/api/drafts?batchId=${selectedBatchId}` : null,
    fetcher,
    { 
      refreshInterval: 5000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  // Usar dados fake quando API não está conectada
  const isOffline = !!batchesError;
  
  // Garantir que sempre são arrays (proteção contra undefined/null)
  const displayBatches = isOffline 
    ? FAKE_BATCHES 
    : (Array.isArray(batches) ? batches : []);
  const displayDrafts = isOffline 
    ? FAKE_DRAFTS 
    : (Array.isArray(drafts) ? drafts : []);
  
  // Debug: Log data received
  if (process.env.NODE_ENV === 'development') {
    console.log('[Dashboard] Data:', { 
      isOffline, 
      batchesCount: displayBatches.length, 
      draftsCount: displayDrafts.length,
      selectedBatchId
    });
  }

  // Selecionar primeira carga disponível
  useEffect(() => {
    if (displayBatches.length > 0 && !selectedBatchId) {
      const pendingBatch = displayBatches.find((b) => b?.pendingCount > 0);
      setSelectedBatchId(pendingBatch?.id || displayBatches[0]?.id || null);
    }
  }, [displayBatches, selectedBatchId]);

  // Calcular stats (com proteção contra batch undefined)
  const stats = displayBatches.reduce(
    (acc, batch) => {
      if (!batch) return acc;
      return {
        pending: acc.pending + (batch.pendingCount || 0),
        approved: acc.approved + (batch.approvedCount || 0),
        dispatched: acc.dispatched + (batch.dispatchedCount || 0),
        errors: acc.errors + (batch.errorCount || 0),
      };
    },
    { pending: 0, approved: 0, dispatched: 0, errors: 0 }
  );

  // Filtrar drafts (com proteção contra draft undefined)
  const filteredDrafts = displayDrafts.filter((draft) => {
    if (!draft) return false;
    
    // Filtro por status
    if (filter !== 'all') {
      if (filter === 'pending' && draft.status !== 'PENDING') return false;
      if (filter === 'approved' && draft.status !== 'APPROVED') return false;
      if (filter === 'error' && draft.status !== 'ERROR') return false;
    }
    
    // Filtro por source
    if (sourceFilter !== 'all') {
      const draftSource = (draft as any).source || draft.offer?.source || 'MANUAL';
      if (draftSource !== sourceFilter) return false;
    }
    
    // Filtro "somente X"
    if (showOnlyX) {
      const channels = Array.isArray(draft.channels) ? draft.channels : [];
      const hasX = channels.includes('TWITTER');
      const requiresHuman = (draft as any).requiresHumanForX;
      if (!hasX && !requiresHuman) return false;
    }
    
    return true;
  });

  // Atualizar dados
  const handleUpdate = () => {
    mutateBatches();
    mutateDrafts();
  };

  // Disparar todos aprovados
  const handleDispatchAll = async () => {
    if (!selectedBatchId) return;
    try {
      await dispatchBatch(selectedBatchId);
      handleUpdate();
    } catch (error) {
      console.error('Erro ao disparar:', error);
    }
  };

  // Pegar drafts pendentes que incluem X
  const pendingDraftsWithX = displayDrafts.filter((draft) => {
    if (!draft || draft.status !== 'PENDING') return false;
    const channels = Array.isArray(draft.channels) ? draft.channels : [];
    return channels.includes('TWITTER') || (draft as any).requiresHumanForX;
  });

  // Disparar TODOS pendentes para o X
  const handleDispatchAllToX = async () => {
    if (pendingDraftsWithX.length === 0) return;
    
    setShowConfirmModal(false);
    setIsDispatchingToX(true);
    setDispatchProgress({ current: 0, total: pendingDraftsWithX.length });
    setDispatchResult(null);
    
    try {
      const draftIds = pendingDraftsWithX.map(d => d.id);
      
      // Processar um por um para mostrar progresso
      let sent = 0;
      let failed = 0;
      
      for (let i = 0; i < draftIds.length; i++) {
        setDispatchProgress({ current: i + 1, total: draftIds.length });
        
        const result = await dispatchAllPendingToX([draftIds[i]]);
        sent += result.sent;
        failed += result.failed;
        
        // Atualizar UI a cada post
        handleUpdate();
      }
      
      setDispatchResult({ sent, failed });
      
      // Limpar resultado após 5 segundos
      setTimeout(() => {
        setDispatchResult(null);
      }, 5000);
      
    } catch (error) {
      console.error('Erro ao disparar para X:', error);
    } finally {
      setIsDispatchingToX(false);
      handleUpdate();
    }
  };

  const selectedBatch = displayBatches.find((b) => b.id === selectedBatchId);

  // Estado de loading (só mostra se não tiver error/offline)
  if (batchesLoading && !isOffline) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
        <p className="text-text-secondary">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Banner Modo Demo */}
      {isOffline && (
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🎭</span>
          <div>
            <span className="font-semibold text-amber-400">Modo Demo</span>
            <span className="text-text-secondary ml-2">— API não conectada. Conecte-se à API para ver dados reais.</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-muted text-sm">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* AJUSTE 1 - Toggle de Modo */}
          <div className="flex items-center gap-2 bg-surface rounded-xl p-1 border border-border">
            <button
              onClick={() => setDispatchMode('rapido')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                dispatchMode === 'rapido'
                  ? 'bg-success text-white'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              ⚡ Modo Rápido
            </button>
            <button
              onClick={() => setDispatchMode('carga')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                dispatchMode === 'carga'
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              📦 Modo Carga
            </button>
          </div>
          
          {/* Botão Disparar Carga (só aparece no Modo Carga) */}
          {dispatchMode === 'carga' && selectedBatch && selectedBatch.approvedCount > 0 && !isOffline && (
            <button
              onClick={handleDispatchAll}
              className="px-6 py-3 rounded-xl bg-success hover:bg-success/90 text-white font-medium transition-all animate-pulse-glow"
            >
              🚀 Disparar Carga {selectedBatch.scheduledTime} ({selectedBatch.approvedCount})
            </button>
          )}
        </div>
      </div>

      {/* ========== BOTÃO "ENVIAR TUDO PARA O X" - Modo Carga ========== */}
      {dispatchMode === 'carga' && pendingDraftsWithX.length > 0 && !isOffline && (
        <div className="bg-gradient-to-r from-blue-900/40 to-sky-800/30 rounded-xl border border-blue-500/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <span className="text-3xl">🐦</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-400">Disparar para o X (Twitter)</h3>
                <p className="text-blue-300/70 text-sm">
                  {pendingDraftsWithX.length} post{pendingDraftsWithX.length > 1 ? 's' : ''} pendente{pendingDraftsWithX.length > 1 ? 's' : ''} para enviar
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={isDispatchingToX}
              className={cn(
                'px-6 py-3 rounded-xl font-bold text-white transition-all flex items-center gap-3',
                isDispatchingToX
                  ? 'bg-blue-500/50 cursor-wait'
                  : 'bg-gradient-to-r from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
              )}
            >
              {isDispatchingToX ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Enviando {dispatchProgress.current}/{dispatchProgress.total}...
                </>
              ) : (
                <>
                  <span className="text-xl">🚀</span>
                  Enviar Tudo para o X
                </>
              )}
            </button>
          </div>

          {/* Resultado do dispatch */}
          {dispatchResult && (
            <div className={cn(
              'mt-4 p-3 rounded-lg text-sm font-medium',
              dispatchResult.failed === 0
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            )}>
              {dispatchResult.failed === 0 ? (
                <>✅ {dispatchResult.sent} post{dispatchResult.sent > 1 ? 's' : ''} enviado{dispatchResult.sent > 1 ? 's' : ''} com sucesso!</>
              ) : (
                <>⚠️ {dispatchResult.sent} enviado{dispatchResult.sent > 1 ? 's' : ''}, {dispatchResult.failed} com erro</>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== MODAL DE CONFIRMAÇÃO ========== */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🐦</span>
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">
                Confirmar Envio para o X
              </h2>
              <p className="text-text-secondary">
                Você está prestes a enviar <span className="text-blue-400 font-bold">{pendingDraftsWithX.length}</span> post{pendingDraftsWithX.length > 1 ? 's' : ''} para o X (Twitter).
              </p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6">
              <p className="text-amber-400 text-sm flex items-start gap-2">
                <span>⚠️</span>
                <span>Os posts serão enviados em sequência com intervalo de 2 segundos para evitar bloqueio.</span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-surface-hover border border-border text-text-secondary font-medium hover:bg-surface-hover/80 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleDispatchAllToX}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-sky-500 text-white font-bold hover:from-blue-600 hover:to-sky-600 transition-all flex items-center justify-center gap-2"
              >
                <span>🚀</span>
                Confirmar Envio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <StatsBar {...stats} />

      {/* Batch Tabs */}
      <BatchTabs
        batches={displayBatches}
        selectedBatch={selectedBatchId}
        onSelect={setSelectedBatchId}
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filtro por Status */}
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-border">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'pending', label: 'Pendentes' },
            { key: 'approved', label: 'Aprovados' },
            { key: 'error', label: 'Erros' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                filter === f.key
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        
        {/* Filtro por Source */}
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-border">
          {[
            { key: 'all', label: '🌐 Todos', color: '' },
            { key: 'MANUAL', label: '✏️ Manual', color: 'bg-gray-500' },
            { key: 'MERCADO_LIVRE', label: '🛒 ML', color: 'bg-yellow-500' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSourceFilter(s.key as SourceFilter)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                sourceFilter === s.key
                  ? 'bg-amber-500 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        
        {/* Toggle "Somente X" */}
        <button
          onClick={() => setShowOnlyX(!showOnlyX)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
            showOnlyX
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-surface border-border text-text-secondary hover:text-text-primary'
          )}
        >
          🐦 Somente X
        </button>
        
        {/* 🔥 NOVO: Toggle Modo de Card */}
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-border">
          <button
            onClick={() => setCardMode('canais')}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              cardMode === 'canais'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            📊 Canais
          </button>
          <button
            onClick={() => setCardMode('classico')}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              cardMode === 'classico'
                ? 'bg-surface-hover text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            📋 Clássico
          </button>
        </div>
        
        <div className="flex-1" />
        <span className="text-sm text-text-muted">
          {filteredDrafts.length} cards
        </span>
      </div>

      {/* Grid de Cards */}
      {filteredDrafts.length > 0 ? (
        <div className={cn(
          "grid gap-4",
          cardMode === 'canais'
            ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"  // Menos colunas para card com canais
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}>
          {filteredDrafts.map((draft) => (
            cardMode === 'canais' ? (
              <PromotionCard key={draft.id} draft={draft} onUpdate={handleUpdate} />
            ) : (
              <Card key={draft.id} draft={draft} onUpdate={handleUpdate} dispatchMode={dispatchMode} />
            )
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <span className="text-6xl mb-4">📭</span>
          <p className="text-lg">Nenhum card encontrado</p>
          <p className="text-sm">
            {filter === 'pending'
              ? 'Todos os posts foram processados!'
              : 'Selecione outra carga ou filtro'}
          </p>
        </div>
      )}
    </div>
  );
}
