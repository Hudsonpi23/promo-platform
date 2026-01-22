'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher, getTodayExecutions, getQueuesStatus, runScheduler } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';

// Configuração dos canais
const CHANNEL_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  TELEGRAM: { name: 'Telegram', icon: '📱', color: 'bg-blue-500' },
  WHATSAPP: { name: 'WhatsApp', icon: '💬', color: 'bg-green-500' },
  TWITTER: { name: 'X', icon: '𝕏', color: 'bg-black' },
  INSTAGRAM: { name: 'Instagram', icon: '📷', color: 'bg-pink-500' },
  FACEBOOK: { name: 'Facebook', icon: '👤', color: 'bg-blue-600' },
  SITE: { name: 'Site', icon: '🌐', color: 'bg-purple-500' },
};

export default function ExecutionsPage() {
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');

  // Buscar execuções do dia
  const { data: executions, mutate: mutateExecutions } = useSWR(
    '/api/scheduler/executions',
    fetcher,
    { refreshInterval: 10000 }
  );

  // Buscar status das filas
  const { data: queuesStatus, mutate: mutateQueues } = useSWR(
    '/api/scheduler/status',
    fetcher,
    { refreshInterval: 5000 }
  );

  // Executar scheduler manualmente
  const handleRunScheduler = async () => {
    setIsRunningScheduler(true);
    try {
      await runScheduler();
      mutateExecutions();
      mutateQueues();
    } catch (error) {
      console.error('Erro ao executar scheduler:', error);
    } finally {
      setIsRunningScheduler(false);
    }
  };

  // Filtrar execuções por canal
  const filteredExecutions = Array.isArray(executions)
    ? executions.filter((exec: any) => selectedChannel === 'all' || exec.channel === selectedChannel)
    : [];

  // Calcular estatísticas
  const stats = {
    total: Array.isArray(executions) ? executions.length : 0,
    byChannel: Object.entries(CHANNEL_CONFIG).reduce((acc, [channel]) => {
      acc[channel] = Array.isArray(executions)
        ? executions.filter((e: any) => e.channel === channel).length
        : 0;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            🟢 Execuções do Dia
          </h1>
          <p className="text-text-muted text-sm">
            Aqui você acompanha tudo que já foi disparado hoje.
          </p>
        </div>
        
        <button
          onClick={handleRunScheduler}
          disabled={isRunningScheduler}
          className={cn(
            'px-4 py-2 rounded-lg font-medium text-sm transition-all',
            'bg-primary hover:bg-primary-hover text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isRunningScheduler && 'animate-pulse'
          )}
        >
          {isRunningScheduler ? '⏳ Executando...' : '▶️ Rodar Scheduler'}
        </button>
      </div>

      {/* Status das Filas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(CHANNEL_CONFIG).map(([channel, config]) => {
          const queueData = queuesStatus?.[channel] || {};
          
          return (
            <div
              key={channel}
              onClick={() => setSelectedChannel(selectedChannel === channel ? 'all' : channel)}
              className={cn(
                'p-4 rounded-xl border cursor-pointer transition-all',
                selectedChannel === channel
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-surface hover:border-primary/50'
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-sm', config.color, 'text-white')}>
                  {config.icon}
                </span>
                <span className="text-sm font-medium text-text-primary">{config.name}</span>
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Hoje:</span>
                  <span className="text-emerald-400 font-medium">{queueData.postedToday || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Na fila:</span>
                  <span className="text-yellow-400 font-medium">{queueData.queued || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Intervalo:</span>
                  <span className="text-text-secondary">{queueData.intervalMin || 15} min</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelectedChannel('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            selectedChannel === 'all'
              ? 'bg-primary text-white'
              : 'bg-surface text-text-muted hover:text-text-primary'
          )}
        >
          Todos ({stats.total})
        </button>
        {Object.entries(CHANNEL_CONFIG).map(([channel, config]) => (
          <button
            key={channel}
            onClick={() => setSelectedChannel(channel)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1',
              selectedChannel === channel
                ? 'bg-primary text-white'
                : 'bg-surface text-text-muted hover:text-text-primary'
            )}
          >
            {config.icon} {stats.byChannel[channel] || 0}
          </button>
        ))}
      </div>

      {/* Lista de Execuções */}
      {filteredExecutions.length > 0 ? (
        <div className="space-y-3">
          {filteredExecutions.map((exec: any) => {
            const config = CHANNEL_CONFIG[exec.channel] || CHANNEL_CONFIG.SITE;
            const offer = exec.draft?.offer;
            
            return (
              <div
                key={exec.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface hover:bg-surface-hover/50 transition-all"
              >
                {/* Canal */}
                <span className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-lg', config.color, 'text-white')}>
                  {config.icon}
                </span>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-text-primary truncate">
                    {offer?.title || 'Sem título'}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>{offer?.store?.name || 'Sem loja'}</span>
                    <span>•</span>
                    <span className="text-success font-medium">{formatCurrency(offer?.finalPrice || 0)}</span>
                    {offer?.discountPct > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-warning">{offer.discountPct}% OFF</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Horário */}
                <div className="text-right">
                  <p className="text-sm font-medium text-emerald-400">✅ Postado</p>
                  <p className="text-xs text-text-muted">
                    {exec.postedAt
                      ? new Date(exec.postedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <span className="text-6xl mb-4">📭</span>
          <p className="text-lg">Nenhuma execução hoje</p>
          <p className="text-sm">
            {selectedChannel !== 'all'
              ? `Nenhum post no ${CHANNEL_CONFIG[selectedChannel]?.name || selectedChannel} ainda`
              : 'Os posts aparecerão aqui conforme forem publicados'}
          </p>
        </div>
      )}

      {/* Info */}
      <div className="bg-surface-hover/50 rounded-xl p-4 border border-border">
        <p className="text-sm text-text-muted flex items-start gap-2">
          <span>⏱️</span>
          <span>
            <strong className="text-text-secondary">Sobre os horários:</strong> Cada rede social tem seu próprio ritmo.
            A plataforma controla isso automaticamente para evitar bloqueios.
          </span>
        </p>
      </div>
    </div>
  );
}
