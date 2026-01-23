'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PostDraft,
  PromotionChannel,
  Channel,
  ChannelPostStatus,
  HumorStyle,
  getPromotionChannels,
  addToQueue,
  addToAllQueues,
  removeFromQueue,
} from '@/lib/api';
import { cn, formatCurrency, formatDiscount, getUrgencyLabel, getStatusColor, getStatusLabel } from '@/lib/utils';

// ==================== TIPOS ====================

interface PromotionCardProps {
  draft: PostDraft;
  onUpdate: () => void;
}

// ==================== CONSTANTES ====================

const CHANNEL_CONFIG: Record<Channel, { 
  name: string; 
  icon: string; 
  color: string;
}> = {
  TELEGRAM: { name: 'Telegram', icon: '📱', color: 'bg-blue-500' },
  WHATSAPP: { name: 'WhatsApp', icon: '💬', color: 'bg-green-500' },
  SITE: { name: 'Site', icon: '🌐', color: 'bg-purple-500' },
  TWITTER: { name: 'X', icon: '𝕏', color: 'bg-black' },
  INSTAGRAM: { name: 'Instagram', icon: '📷', color: 'bg-pink-500' },
  FACEBOOK: { name: 'Facebook', icon: '👤', color: 'bg-blue-600' },
};

// 🔥 NOVO: Status do sistema de filas
const STATUS_STYLES: Record<ChannelPostStatus, { bg: string; text: string; label: string; icon: string }> = {
  PENDING: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Pendente', icon: '⏸️' },
  QUEUED: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Em fila', icon: '🕐' },
  POSTED: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Postado', icon: '✅' },
  ERROR: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Erro', icon: '❌' },
  READY_MANUAL: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Pronto (Manual)', icon: '📋' },
  DONE_MANUAL: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Feito', icon: '✅' },
};

const ALL_CHANNELS: Channel[] = ['TELEGRAM', 'WHATSAPP', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'SITE'];

// ==================== COMPONENTE ====================

export function PromotionCard({ draft, onUpdate }: PromotionCardProps) {
  const [channels, setChannels] = useState<PromotionChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [queueingChannel, setQueueingChannel] = useState<Channel | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedHumor, setSelectedHumor] = useState<HumorStyle>('URUBU');

  // Dados da oferta com proteção
  const offer = draft?.offer || {
    title: 'Sem título',
    originalPrice: 0,
    finalPrice: 0,
    discountPct: 0,
    urgency: 'NORMAL' as const,
    niche: { name: 'Sem nicho', icon: '📦' },
    store: { name: 'Sem loja' },
    affiliateUrl: '',
    imageUrl: '',
    // 🤖 v2.0: Campos de IA
    mainImage: '',
    curationStatus: 'DRAFT',
    aiPriorityScore: null,
    aiRiskLevel: null,
  };

  // 🤖 v2.0: Informações de IA
  const aiInfo = {
    curationStatus: (offer as any).curationStatus || 'DRAFT',
    priorityScore: (offer as any).aiPriorityScore,
    riskLevel: (offer as any).aiRiskLevel,
    isProcessing: (offer as any).curationStatus === 'AI_PROCESSING',
    isReady: (offer as any).curationStatus === 'AI_READY',
    isBlocked: (offer as any).curationStatus === 'AI_BLOCKED',
  };

  const urgencyLabel = getUrgencyLabel(offer.urgency || 'NORMAL');
  const displayScore = (draft as any).score ?? draft.aiScore ?? 0;
  const hasImage = offer?.imageUrl || (draft as any).imageUrl;
  const isML = (draft as any).source === 'MERCADO_LIVRE' || (draft as any).offer?.source === 'MERCADO_LIVRE';

  // Carregar canais
  const loadChannels = useCallback(async () => {
    if (!draft?.id) return;
    
    try {
      const data = await getPromotionChannels(draft.id);
      
      // Se não há canais, criar placeholders
      if (!data || data.length === 0) {
        const placeholders: PromotionChannel[] = ALL_CHANNELS.map(ch => ({
          draftId: draft.id,
          channel: ch,
          status: 'PENDING',
          _isPlaceholder: true,
        }));
        setChannels(placeholders);
      } else {
        // Completar canais faltantes
        const existingChannels = new Set(data.map(c => c.channel));
        const completeChannels = [...data];
        
        for (const ch of ALL_CHANNELS) {
          if (!existingChannels.has(ch)) {
            completeChannels.push({
              draftId: draft.id,
              channel: ch,
              status: 'PENDING',
              _isPlaceholder: true,
            });
          }
        }
        
        setChannels(completeChannels);
      }
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
    }
  }, [draft?.id]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // 🔥 Adicionar à fila de um canal específico
  const handleAddToQueue = async (channel: Channel) => {
    if (!draft?.id) return;
    
    // Verificar se X precisa de imagem
    if (channel === 'TWITTER' && !hasImage) {
      alert('X/Twitter requer uma imagem do produto.');
      return;
    }
    
    setQueueingChannel(channel);
    
    try {
      const result = await addToQueue(draft.id, channel, { humorStyle: selectedHumor });
      
      if (result.success) {
        // Atualizar canal local
        setChannels(prev => prev.map(ch => 
          ch.channel === channel 
            ? { ...ch, status: 'QUEUED' as ChannelPostStatus, queuedAt: new Date().toISOString() }
            : ch
        ));
        onUpdate();
      } else {
        alert(`Erro ao adicionar à fila`);
      }
    } catch (error: any) {
      console.error('Erro ao adicionar à fila:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setQueueingChannel(null);
    }
  };

  // 🔥 Adicionar a TODAS as filas
  const handleAddToAllQueues = async () => {
    if (!draft?.id) return;
    
    setIsLoading(true);
    
    try {
      // Filtrar canais que ainda não estão na fila ou postados
      const channelsToQueue = channels
        .filter(ch => ch.status === 'PENDING' || ch.status === 'READY_MANUAL')
        .map(ch => ch.channel);
      
      if (channelsToQueue.length === 0) {
        alert('Todos os canais já estão na fila ou postados.');
        return;
      }
      
      const result = await addToAllQueues(draft.id, {
        humorStyle: selectedHumor,
        channels: channelsToQueue,
      });
      
      if (result.success) {
        await loadChannels();
        onUpdate();
      }
    } catch (error: any) {
      console.error('Erro:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Remover da fila
  const handleRemoveFromQueue = async (channel: Channel) => {
    if (!draft?.id) return;
    
    try {
      await removeFromQueue(draft.id, channel);
      setChannels(prev => prev.map(ch => 
        ch.channel === channel 
          ? { ...ch, status: 'PENDING' as ChannelPostStatus, queuedAt: undefined }
          : ch
      ));
      onUpdate();
    } catch (error: any) {
      console.error('Erro:', error);
    }
  };

  // Calcular resumo de status
  const statusSummary = {
    posted: channels.filter(c => c.status === 'POSTED' || c.status === 'DONE_MANUAL').length,
    queued: channels.filter(c => c.status === 'QUEUED').length,
    pending: channels.filter(c => c.status === 'PENDING' || c.status === 'READY_MANUAL').length,
    error: channels.filter(c => c.status === 'ERROR').length,
    total: channels.length,
  };

  // Verificar se tem ações pendentes (não está tudo postado ou na fila)
  const hasPendingActions = statusSummary.pending > 0;

  return (
    <div className={cn(
      'bg-surface rounded-xl border border-border overflow-hidden',
      'hover:border-primary/50 transition-all duration-200',
      draft.priority === 'HIGH' && 'ring-2 ring-warning/50',
      statusSummary.posted === statusSummary.total && 'opacity-60'
    )}>
      {/* Header - Tags */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-hover/50">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 🤖 v2.0: Badge de Status da IA */}
          {aiInfo.isProcessing && (
            <span className="px-2 py-1 rounded-md bg-yellow-500/20 text-yellow-400 text-xs font-medium animate-pulse">
              🧠 IA Processando
            </span>
          )}
          {aiInfo.isReady && (
            <span className="px-2 py-1 rounded-md bg-green-500/20 text-green-400 text-xs font-medium">
              ✅ IA Pronta
            </span>
          )}
          {aiInfo.isBlocked && (
            <span className="px-2 py-1 rounded-md bg-red-500/20 text-red-400 text-xs font-medium">
              ⚠️ Bloqueado
            </span>
          )}
          {/* 🤖 v2.0: Score da IA */}
          {aiInfo.priorityScore && (
            <span className={cn(
              'px-2 py-1 rounded-md text-xs font-medium',
              aiInfo.priorityScore >= 70 ? 'bg-green-500/20 text-green-400' :
              aiInfo.priorityScore >= 50 ? 'bg-blue-500/20 text-blue-400' :
              'bg-yellow-500/20 text-yellow-400'
            )}>
              🤖 {aiInfo.priorityScore}
            </span>
          )}
          {isML && (
            <span className="px-2 py-1 rounded-md bg-yellow-500/20 text-yellow-500 text-xs font-medium">
              🛒 ML
            </span>
          )}
          <span className="px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-medium">
            {offer?.niche?.icon || '📦'} {offer?.niche?.name || 'Sem nicho'}
          </span>
          {draft.priority === 'HIGH' && (
            <span className="px-2 py-1 rounded-md bg-warning/20 text-warning text-xs font-medium">
              🔥 Alta
            </span>
          )}
          {displayScore > 0 && !aiInfo.priorityScore && (
            <span className={cn(
              'px-2 py-1 rounded-md text-xs font-medium',
              displayScore >= 70 ? 'bg-success/20 text-success' :
              displayScore >= 50 ? 'bg-primary/20 text-primary' :
              'bg-warning/20 text-warning'
            )}>
              📊 {displayScore}
            </span>
          )}
        </div>
        <span className="px-2 py-1 rounded-md bg-surface text-text-secondary text-xs truncate max-w-[100px]">
          {offer?.store?.name || 'Sem loja'}
        </span>
      </div>

      {/* Conteúdo Principal */}
      <div className="p-4 space-y-4">
        {/* Título */}
        <h3 className="text-lg font-semibold text-text-primary leading-tight line-clamp-2">
          {offer.title}
        </h3>

        {/* Preços */}
        <div className="flex items-baseline gap-3 flex-wrap">
          {offer.originalPrice > 0 && offer.originalPrice > offer.finalPrice && (
            <span className="text-text-muted line-through text-sm">
              {formatCurrency(offer.originalPrice)}
            </span>
          )}
          <span className="text-2xl font-bold text-success">
            {formatCurrency(offer.finalPrice)}
          </span>
          {(offer.discountPct || 0) > 0 && (
            <span className="px-2 py-0.5 rounded bg-success/20 text-success text-sm font-medium">
              {formatDiscount(offer.discountPct || 0)}
            </span>
          )}
        </div>

        {/* Imagem (se houver) */}
        {hasImage && (
          <div className="relative h-24 rounded-lg overflow-hidden bg-surface-hover">
            <img 
              src={hasImage} 
              alt={offer.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* 🔥 Resumo de Status dos Canais (SISTEMA DE FILAS) */}
        <div className="flex items-center justify-between py-2 border-y border-border">
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">Canais:</span>
            {statusSummary.posted > 0 && (
              <span className="text-xs font-medium text-emerald-400">
                ✅ {statusSummary.posted} postados
              </span>
            )}
            {statusSummary.queued > 0 && (
              <span className="text-xs font-medium text-yellow-400">
                🕐 {statusSummary.queued} em fila
              </span>
            )}
            {statusSummary.error > 0 && (
              <span className="text-xs font-medium text-red-400">
                ❌ {statusSummary.error} erros
              </span>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-primary hover:underline"
          >
            {isExpanded ? 'Recolher ▲' : 'Ver canais ▼'}
          </button>
        </div>

        {/* Lista de Canais (expandível) */}
        {isExpanded && (
          <div className="space-y-2 animate-slide-in">
            {/* Seletor de Humor */}
            <div className="flex items-center gap-2 p-2 bg-surface-hover/50 rounded-lg">
              <span className="text-xs text-text-muted">Estilo:</span>
              {(['URUBU', 'NEUTRO', 'FLASH'] as HumorStyle[]).map((humor) => (
                <button
                  key={humor}
                  onClick={() => setSelectedHumor(humor)}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium transition-all',
                    selectedHumor === humor
                      ? 'bg-primary text-white'
                      : 'bg-surface text-text-muted hover:text-text-primary'
                  )}
                >
                  {humor === 'URUBU' && '🦅 Urubu'}
                  {humor === 'NEUTRO' && '📝 Neutro'}
                  {humor === 'FLASH' && '⚡ Flash'}
                </button>
              ))}
            </div>

            {channels.map((ch) => {
              const config = CHANNEL_CONFIG[ch.channel];
              const statusStyle = STATUS_STYLES[ch.status];
              const isQueueing = queueingChannel === ch.channel;
              const canQueue = ch.status === 'PENDING' || ch.status === 'READY_MANUAL';
              const isInQueue = ch.status === 'QUEUED';
              const isPosted = ch.status === 'POSTED' || ch.status === 'DONE_MANUAL';
              const isXWithoutImage = ch.channel === 'TWITTER' && !hasImage;
              
              return (
                <div
                  key={ch.channel}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    'bg-surface-hover/50 border border-border',
                    isPosted && 'opacity-60'
                  )}
                >
                  {/* Info do Canal */}
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm',
                      config.color, 'text-white'
                    )}>
                      {config.icon}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {config.name}
                      </p>
                      {ch.queuedAt && (
                        <p className="text-xs text-text-muted">
                          Na fila desde {new Date(ch.queuedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {ch.postedAt && (
                        <p className="text-xs text-text-muted">
                          Postado às {new Date(ch.postedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status e Ações */}
                  <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-medium flex items-center gap-1',
                      statusStyle.bg, statusStyle.text
                    )}>
                      {statusStyle.icon} {statusStyle.label}
                    </span>

                    {/* Botão de Ação */}
                    {canQueue && (
                      <button
                        onClick={() => handleAddToQueue(ch.channel)}
                        disabled={isQueueing || isXWithoutImage}
                        title={isXWithoutImage ? 'X requer imagem' : 'Adicionar à fila'}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                          'flex items-center gap-1',
                          !isXWithoutImage
                            ? 'bg-primary hover:bg-primary-hover text-white'
                            : 'bg-surface text-text-muted cursor-not-allowed opacity-50',
                          isQueueing && 'animate-pulse'
                        )}
                      >
                        {isQueueing ? '⏳' : '🚀'} Postar
                      </button>
                    )}

                    {isInQueue && (
                      <button
                        onClick={() => handleRemoveFromQueue(ch.channel)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-all"
                        title="Remover da fila"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Status Badge do Draft */}
        <div className="flex items-center justify-between">
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border',
            getStatusColor(draft.status)
          )}>
            {getStatusLabel(draft.status)}
          </span>
          
          {urgencyLabel && (
            <span className="text-xs text-orange-400">
              ⏰ {urgencyLabel}
            </span>
          )}
        </div>
      </div>

      {/* 🔥 Ação Rápida - Postar em Todos (só aparece se tem ações pendentes) */}
      {hasPendingActions && (
        <div className="p-4 border-t border-border bg-surface-hover/30">
          <button
            onClick={handleAddToAllQueues}
            disabled={isLoading}
            className={cn(
              'w-full py-2.5 rounded-lg font-medium text-sm transition-all',
              'bg-gradient-to-r from-primary to-purple-500 hover:from-primary-hover hover:to-purple-600 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isLoading && 'animate-pulse'
            )}
          >
            {isLoading ? '⏳ Adicionando às filas...' : `🚀 Postar em ${statusSummary.pending} canais`}
          </button>
          <p className="text-xs text-text-muted text-center mt-2">
            Os posts serão publicados automaticamente respeitando o intervalo de cada canal
          </p>
        </div>
      )}
    </div>
  );
}
