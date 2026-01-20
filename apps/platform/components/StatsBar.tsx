'use client';

import { cn } from '@/lib/utils';

interface StatsBarProps {
  pending: number;
  approved: number;
  dispatched: number;
  errors: number;
}

export function StatsBar({ pending, approved, dispatched, errors }: StatsBarProps) {
  const total = pending + approved + dispatched + errors;

  const stats = [
    { label: 'Pendentes', value: pending, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
    { label: 'Aprovados', value: approved, color: 'bg-blue-500', textColor: 'text-blue-400' },
    { label: 'Disparados', value: dispatched, color: 'bg-green-500', textColor: 'text-green-400' },
    { label: 'Erros', value: errors, color: 'bg-red-500', textColor: 'text-red-400' },
  ];

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-secondary">Resumo do Dia</h3>
        <span className="text-2xl font-bold text-text-primary">{total} posts</span>
      </div>

      {/* Barra de progresso */}
      <div className="h-3 rounded-full bg-surface-hover overflow-hidden flex mb-4">
        {stats.map((stat, index) => (
          stat.value > 0 && (
            <div
              key={stat.label}
              className={cn('h-full transition-all', stat.color)}
              style={{ width: `${(stat.value / total) * 100}%` }}
            />
          )
        ))}
      </div>

      {/* Legendas */}
      <div className="flex items-center justify-between">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-2">
            <span className={cn('w-3 h-3 rounded-full', stat.color)}></span>
            <div>
              <span className={cn('text-lg font-bold', stat.textColor)}>{stat.value}</span>
              <span className="text-xs text-text-muted ml-1">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
