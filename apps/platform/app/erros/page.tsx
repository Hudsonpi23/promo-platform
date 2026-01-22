'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, retryError } from '@/lib/api';
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

export default function ErrorsPage() {
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [retrying, setRetrying] = useState<string | null>(null);
  
  // Buscar erros do scheduler
  const { data: errors, mutate } = useSWR(
    '/api/scheduler/errors?limit=100',
    fetcher,
    { refreshInterval: 10000 }
  );

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      await retryError(id);
      mutate();
    } catch (error) {
      console.error('Erro ao reprocessar:', error);
    } finally {
      setRetrying(null);
    }
  };

  // Filtrar erros por canal
  const filteredErrors = Array.isArray(errors)
    ? errors.filter((err: any) => selectedChannel === 'all' || err.channel === selectedChannel)
    : [];

  // Calcular estatísticas
  const stats = {
    total: Array.isArray(errors) ? errors.length : 0,
    byChannel: Object.entries(CHANNEL_CONFIG).reduce((acc, [channel]) => {
      acc[channel] = Array.isArray(errors)
        ? errors.filter((e: any) => e.channel === channel).length
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
            🔴 Erros
          </h1>
          <p className="text-text-muted text-sm">
            Posts que precisam de atenção
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {stats.total > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 text-sm font-medium">
              {stats.total} erro{stats.total > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Filtros por Canal */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedChannel('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            selectedChannel === 'all'
              ? 'bg-red-500 text-white'
              : 'bg-surface text-text-muted hover:text-text-primary'
          )}
        >
          Todos ({stats.total})
        </button>
        {Object.entries(CHANNEL_CONFIG).map(([channel, config]) => {
          const count = stats.byChannel[channel] || 0;
          if (count === 0) return null;
          
          return (
            <button
              key={channel}
              onClick={() => setSelectedChannel(channel)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1',
                selectedChannel === channel
                  ? 'bg-red-500 text-white'
                  : 'bg-surface text-text-muted hover:text-text-primary'
              )}
            >
              {config.icon} {config.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Lista de Erros */}
      {filteredErrors.length > 0 ? (
        <div className="space-y-4">
          {filteredErrors.map((error: any) => {
            const config = CHANNEL_CONFIG[error.channel] || CHANNEL_CONFIG.SITE;
            const offer = error.draft?.offer;
            
            return (
              <div
                key={error.id}
                className="bg-surface rounded-xl border border-red-500/30 p-5"
              >
                <div className="flex items-start gap-4">
                  {/* Canal */}
                  <span className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0', config.color, 'text-white')}>
                    {config.icon}
                  </span>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-medium">
                        ❌ Erro
                      </span>
                      <span className="text-xs text-text-muted">
                        {config.name}
                      </span>
                    </div>
                    
                    <h3 className="text-sm font-medium text-text-primary mb-1">
                      {offer?.title || 'Sem título'}
                    </h3>
                    
                    {/* Mensagem de Erro */}
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
                      <p className="text-sm text-red-400">
                        {error.errorReason || 'Erro desconhecido'}
                      </p>
                    </div>
                    
                    {/* Info adicional */}
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span>{offer?.store?.name || 'Sem loja'}</span>
                      <span>•</span>
                      <span className="text-success font-medium">{formatCurrency(offer?.finalPrice || 0)}</span>
                      <span>•</span>
                      <span>
                        {error.updatedAt
                          ? new Date(error.updatedAt).toLocaleString('pt-BR')
                          : '--'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Ações */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRetry(error.id)}
                      disabled={retrying === error.id}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        'bg-primary hover:bg-primary-hover text-white',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        retrying === error.id && 'animate-pulse'
                      )}
                    >
                      {retrying === error.id ? '⏳ Reenviando...' : '🔄 Tentar Novamente'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <span className="text-6xl mb-4">✨</span>
          <p className="text-lg">Nenhum erro encontrado</p>
          <p className="text-sm">
            {selectedChannel !== 'all'
              ? `Nenhum erro no ${CHANNEL_CONFIG[selectedChannel]?.name || selectedChannel}`
              : 'Tudo funcionando perfeitamente!'}
          </p>
        </div>
      )}

      {/* Ajuda */}
      <div className="bg-surface-hover/50 rounded-xl p-4 border border-border">
        <p className="text-sm text-text-muted flex items-start gap-2">
          <span>💡</span>
          <span>
            <strong className="text-text-secondary">Dica:</strong> Ao clicar em "Tentar Novamente", 
            o post volta para a fila do canal e será processado automaticamente no próximo ciclo.
          </span>
        </p>
      </div>
    </div>
  );
}
