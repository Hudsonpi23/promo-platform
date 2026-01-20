'use client';

import { cn } from '@/lib/utils';
import { Batch } from '@/lib/api';

interface BatchTabsProps {
  batches: Batch[];
  selectedBatch: string | null;
  onSelect: (batchId: string) => void;
}

export function BatchTabs({ batches, selectedBatch, onSelect }: BatchTabsProps) {
  // Horários padrão das cargas
  const defaultTimes = ['08:00', '11:00', '14:00', '18:00', '22:00'];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {defaultTimes.map((time) => {
        const batch = batches.find((b) => b.scheduledTime === time);
        const isSelected = batch?.id === selectedBatch;
        
        return (
          <button
            key={time}
            onClick={() => batch && onSelect(batch.id)}
            disabled={!batch}
            className={cn(
              'flex flex-col items-center px-4 py-3 rounded-xl border transition-all min-w-[120px]',
              isSelected
                ? 'bg-primary/20 border-primary text-primary'
                : batch
                  ? 'bg-surface border-border hover:border-primary/50 text-text-secondary hover:text-text-primary'
                  : 'bg-surface/50 border-border/50 text-text-muted cursor-not-allowed opacity-50'
            )}
          >
            <span className="text-lg font-bold">{time}</span>
            {batch && (
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  {batch.pendingCount}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  {batch.approvedCount}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  {batch.dispatchedCount}
                </span>
                {batch.errorCount > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    {batch.errorCount}
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
