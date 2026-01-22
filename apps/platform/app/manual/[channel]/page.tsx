'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

// ==================== TYPES ====================

interface ManualQueueItem {
  id: string;
  channel: string;
  status: string;
  queuedAt: string;
  offer: {
    id: string;
    title: string;
    price: number;
    oldPrice: number | null;
    discountPct: number;
    imageUrl: string | null;
    store: { name: string; logoUrl?: string } | null;
    niche: { name: string; icon: string } | null;
    promoType: string;
    couponCode: string | null;
  };
  copyText: string;
  originalCopyText: string;
  wasEdited: boolean;
  finalUrl: string;
  goUrl: string;
  humorStyle: string;
}

interface ChannelInfo {
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const CHANNELS: Record<string, ChannelInfo> = {
  facebook: {
    name: 'Facebook',
    emoji: '📘',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
  },
  instagram: {
    name: 'Instagram',
    emoji: '📸',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500/30',
  },
  whatsapp: {
    name: 'WhatsApp',
    emoji: '💬',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
  },
};

// ==================== COMPONENTS ====================

function ManualCard({ item, onMarkDone, onReportError, onEdit }: {
  item: ManualQueueItem;
  onMarkDone: (id: string) => void;
  onReportError: (id: string, reason: string) => void;
  onEdit: (id: string, text: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.copyText);
  const [showError, setShowError] = useState(false);
  const [errorReason, setErrorReason] = useState('');
  const [copied, setCopied] = useState<'text' | 'link' | null>(null);

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(item.copyText);
    setCopied('text');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(item.goUrl || item.finalUrl);
    setCopied('link');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveEdit = () => {
    onEdit(item.id, editText);
    setIsEditing(false);
  };

  const handleReportError = () => {
    if (errorReason.trim().length >= 5) {
      onReportError(item.id, errorReason);
      setShowError(false);
      setErrorReason('');
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 border-b border-border">
        {item.offer.imageUrl && (
          <img 
            src={item.offer.imageUrl} 
            alt={item.offer.title}
            className="w-20 h-20 object-cover rounded-lg"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary leading-tight line-clamp-2">
            {item.offer.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {item.offer.store && (
              <span className="text-xs text-text-muted">📦 {item.offer.store.name}</span>
            )}
            {item.offer.niche && (
              <span className="text-xs text-text-muted">{item.offer.niche.icon} {item.offer.niche.name}</span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            {item.offer.oldPrice && item.offer.oldPrice > item.offer.price && (
              <span className="text-text-muted line-through text-sm">
                R$ {item.offer.oldPrice.toFixed(2)}
              </span>
            )}
            <span className="text-xl font-bold text-success">
              R$ {item.offer.price.toFixed(2)}
            </span>
            {item.offer.discountPct > 0 && (
              <span className="px-2 py-0.5 rounded bg-success/20 text-success text-xs font-medium">
                -{item.offer.discountPct}%
              </span>
            )}
          </div>
          {item.offer.couponCode && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs">
              🎟️ Cupom: <span className="font-mono font-bold">{item.offer.couponCode}</span>
            </div>
          )}
        </div>
      </div>

      {/* Copy Text */}
      <div className="p-4 bg-background/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-muted uppercase tracking-wider">
            Texto para copiar {item.wasEdited && '(editado)'}
          </span>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs text-primary hover:underline"
          >
            {isEditing ? 'Cancelar' : '✏️ Editar'}
          </button>
        </div>
        
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full h-40 p-3 rounded-lg bg-surface border border-border text-text-primary text-sm resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:bg-surface-hover"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1.5 rounded-lg text-sm bg-primary text-white hover:bg-primary-hover"
              >
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-text-secondary font-sans p-3 rounded-lg bg-surface border border-border">
            {item.copyText}
          </pre>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 flex flex-wrap gap-2">
        <button
          onClick={handleCopyText}
          className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
            copied === 'text'
              ? 'bg-success text-white'
              : 'bg-primary hover:bg-primary-hover text-white'
          }`}
        >
          {copied === 'text' ? '✅ Copiado!' : '📋 Copiar Texto'}
        </button>
        
        <button
          onClick={handleCopyLink}
          className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
            copied === 'link'
              ? 'bg-success text-white'
              : 'bg-surface-hover hover:bg-surface text-text-primary border border-border'
          }`}
        >
          {copied === 'link' ? '✅' : '🔗 Link'}
        </button>

        {item.offer.imageUrl && (
          <a
            href={item.offer.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-lg font-medium text-sm bg-surface-hover hover:bg-surface text-text-primary border border-border"
          >
            🖼️ Imagem
          </a>
        )}
        
        <button
          onClick={() => onMarkDone(item.id)}
          className="px-4 py-2.5 rounded-lg font-medium text-sm bg-success/20 hover:bg-success/30 text-success border border-success/30"
        >
          ✅ Marcar Postado
        </button>
        
        <button
          onClick={() => setShowError(true)}
          className="px-4 py-2.5 rounded-lg font-medium text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
        >
          ⚠️ Erro
        </button>
      </div>

      {/* Error Modal */}
      {showError && (
        <div className="p-4 border-t border-border bg-red-500/5">
          <p className="text-sm text-text-secondary mb-2">Descreva o erro encontrado:</p>
          <textarea
            value={errorReason}
            onChange={(e) => setErrorReason(e.target.value)}
            placeholder="Ex: Link não funciona, imagem não carrega..."
            className="w-full h-20 p-3 rounded-lg bg-surface border border-border text-text-primary text-sm resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setShowError(false)}
              className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:bg-surface-hover"
            >
              Cancelar
            </button>
            <button
              onClick={handleReportError}
              disabled={errorReason.trim().length < 5}
              className="px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            >
              Reportar Erro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== PAGE ====================

export default function ManualChannelPage() {
  const params = useParams();
  const channel = (params.channel as string)?.toUpperCase() || 'FACEBOOK';
  const channelInfo = CHANNELS[params.channel as string] || CHANNELS.facebook;

  // Fetch queue
  const { data, error, isLoading, mutate } = useSWR(
    `/api/manual/queue?channel=${channel}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  // Fetch stats
  const { data: statsData } = useSWR('/api/manual/queue/stats', fetcher);

  const items: ManualQueueItem[] = data?.data || [];
  const stats = statsData?.data?.find((s: any) => s.channel === channel);

  // Handlers
  const handleMarkDone = async (id: string) => {
    try {
      await fetch(`/api/manual/mark-done/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      mutate();
    } catch (err) {
      console.error('Erro ao marcar como feito:', err);
    }
  };

  const handleReportError = async (id: string, reason: string) => {
    try {
      await fetch(`/api/manual/report-error/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      mutate();
    } catch (err) {
      console.error('Erro ao reportar erro:', err);
    }
  };

  const handleEdit = async (id: string, text: string) => {
    try {
      await fetch(`/api/manual/edit/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ editedCopyText: text }),
      });
      mutate();
    } catch (err) {
      console.error('Erro ao editar:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${channelInfo.color} flex items-center gap-2`}>
            <span>{channelInfo.emoji}</span>
            Operador {channelInfo.name}
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Posts prontos para copiar e colar no {channelInfo.name}
          </p>
        </div>
        
        {/* Stats */}
        {stats && (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-text-primary">{stats.ready}</p>
              <p className="text-xs text-text-muted">Pendentes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{stats.doneToday}</p>
              <p className="text-xs text-text-muted">Feitos Hoje</p>
            </div>
            {stats.errors > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{stats.errors}</p>
                <p className="text-xs text-text-muted">Erros</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className={`${channelInfo.bgColor} border ${channelInfo.borderColor} rounded-xl p-4`}>
        <h3 className={`font-semibold ${channelInfo.color} mb-2`}>📋 Como usar</h3>
        <ol className="text-sm text-text-secondary space-y-1 list-decimal list-inside">
          <li>Clique em <strong>"Copiar Texto"</strong> para copiar o post completo</li>
          <li>Cole no {channelInfo.name} (grupo, página, stories, etc)</li>
          <li>Se precisar da imagem separada, clique em <strong>"Imagem"</strong></li>
          <li>Após postar, clique em <strong>"Marcar Postado"</strong></li>
          <li>Se encontrar algum problema, clique em <strong>"Erro"</strong></li>
        </ol>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
          <p className="text-text-muted">Carregando posts...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
          Erro ao carregar posts. Tente novamente.
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <span className="text-6xl mb-4">✨</span>
          <p className="text-lg">Nenhum post pendente</p>
          <p className="text-sm">Todos os posts do {channelInfo.name} foram concluídos!</p>
        </div>
      )}

      {/* Cards */}
      {items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <ManualCard
              key={item.id}
              item={item}
              onMarkDone={handleMarkDone}
              onReportError={handleReportError}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
