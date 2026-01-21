'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/Card';
import { fetcher, Batch, PostDraft, dispatchBatch } from '@/lib/api';
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

  // Buscar drafts da carga expandida
  const { data: draftsRaw, mutate: mutateDrafts } = useSWR<PostDraft[]>(
    expandedBatch ? `/api/drafts?batchId=${expandedBatch}` : null,
    fetcher
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

  // Debug: Log data
  if (process.env.NODE_ENV === 'development') {
    console.log('[Cargas] Data:', { 
      batchesCount: batches.length, 
      draftsCount: drafts.length, 
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
