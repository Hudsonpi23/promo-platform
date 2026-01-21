'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/Card';
import { BatchTabs } from '@/components/BatchTabs';
import { StatsBar } from '@/components/StatsBar';
import { fetcher, Batch, PostDraft, dispatchBatch } from '@/lib/api';
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
  const displayBatches = isOffline ? FAKE_BATCHES : (batches || []);
  const displayDrafts = isOffline ? FAKE_DRAFTS : (drafts || []);

  // Selecionar primeira carga disponível
  useEffect(() => {
    if (displayBatches.length > 0 && !selectedBatchId) {
      const pendingBatch = displayBatches.find((b) => b.pendingCount > 0);
      setSelectedBatchId(pendingBatch?.id || displayBatches[0].id);
    }
  }, [displayBatches, selectedBatchId]);

  // Calcular stats
  const stats = displayBatches.reduce(
    (acc, batch) => ({
      pending: acc.pending + batch.pendingCount,
      approved: acc.approved + batch.approvedCount,
      dispatched: acc.dispatched + batch.dispatchedCount,
      errors: acc.errors + batch.errorCount,
    }),
    { pending: 0, approved: 0, dispatched: 0, errors: 0 }
  );

  // Filtrar drafts
  const filteredDrafts = displayDrafts.filter((draft) => {
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
      const hasX = draft.channels?.includes('TWITTER');
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
        
        <div className="flex-1" />
        <span className="text-sm text-text-muted">
          {filteredDrafts.length} cards
        </span>
      </div>

      {/* Grid de Cards */}
      {filteredDrafts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDrafts.map((draft) => (
            <Card key={draft.id} draft={draft} onUpdate={handleUpdate} dispatchMode={dispatchMode} />
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
