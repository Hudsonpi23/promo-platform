'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { cn, formatCurrency, getStatusColor } from '@/lib/utils';

interface ErrorLog {
  id: string;
  draftId: string | null;
  errorType: string;
  message: string;
  details: any;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export default function ErrorsPage() {
  const [showResolved, setShowResolved] = useState(false);
  
  const { data: errors, mutate } = useSWR<ErrorLog[]>(
    `/api/channels/errors?resolved=${showResolved}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const handleResolve = async (id: string) => {
    await fetch(`http://localhost:3001/api/channels/errors/${id}/resolve`, {
      method: 'POST',
    });
    mutate();
  };

  const handleRetry = async (id: string) => {
    await fetch(`http://localhost:3001/api/channels/errors/${id}/retry`, {
      method: 'POST',
    });
    mutate();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            🧯 Setor de Erros
          </h1>
          <p className="text-text-muted text-sm">
            Revise e corrija posts com problemas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded"
            />
            Mostrar resolvidos
          </label>
        </div>
      </div>

      {/* Lista de Erros */}
      {errors && errors.length > 0 ? (
        <div className="space-y-4">
          {errors.map((error) => (
            <div
              key={error.id}
              className={cn(
                'bg-surface rounded-xl border p-6',
                error.isResolved ? 'border-border opacity-60' : 'border-error/50'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Tipo de erro */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 rounded-full bg-error/20 text-error text-xs font-medium">
                      {error.errorType}
                    </span>
                    {error.isResolved && (
                      <span className="px-3 py-1 rounded-full bg-success/20 text-success text-xs font-medium">
                        ✅ Resolvido
                      </span>
                    )}
                  </div>

                  {/* Mensagem */}
                  <p className="text-text-primary font-medium mb-2">
                    {error.message}
                  </p>

                  {/* Detalhes */}
                  {error.details && (
                    <pre className="text-xs text-text-muted bg-background p-3 rounded-lg overflow-auto">
                      {JSON.stringify(error.details, null, 2)}
                    </pre>
                  )}

                  {/* Data */}
                  <p className="text-xs text-text-muted mt-3">
                    {new Date(error.createdAt).toLocaleString('pt-BR')}
                    {error.resolvedAt && (
                      <span className="ml-2">
                        • Resolvido em {new Date(error.resolvedAt).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </p>
                </div>

                {/* Ações */}
                {!error.isResolved && (
                  <div className="flex flex-col gap-2">
                    {error.draftId && (
                      <button
                        onClick={() => handleRetry(error.id)}
                        className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-all"
                      >
                        🔄 Reenviar
                      </button>
                    )}
                    <button
                      onClick={() => handleResolve(error.id)}
                      className="px-4 py-2 rounded-lg bg-surface-hover hover:bg-success/20 text-text-secondary hover:text-success text-sm font-medium transition-all"
                    >
                      ✅ Marcar Resolvido
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <span className="text-6xl mb-4">✨</span>
          <p className="text-lg">Nenhum erro encontrado</p>
          <p className="text-sm">
            {showResolved
              ? 'Nenhum erro resolvido ainda'
              : 'Tudo funcionando perfeitamente!'}
          </p>
        </div>
      )}
    </div>
  );
}
