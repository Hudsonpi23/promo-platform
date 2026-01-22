'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PostDraft,
  PromotionChannel,
  Channel,
  ChannelStatus,
  getPromotionChannels,
  initializePromotionChannels,
  publishToChannel,
  updatePromotionChannel,
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
  autoDefault: boolean;
}> = {
  TELEGRAM: { name: 'Telegram', icon: '📱', color: 'bg-blue-500', autoDefault: true },
  WHATSAPP: { name: 'WhatsApp', icon: '💬', color: 'bg-green-500', autoDefault: true },
  SITE: { name: 'Site', icon: '🌐', color: 'bg-purple-500', autoDefault: true },
  TWITTER: { name: 'X', icon: '𝕏', color: 'bg-black', autoDefault: false },
  INSTAGRAM: { name: 'Instagram', icon: '📷', color: 'bg-pink-500', autoDefault: false },
  FACEBOOK: { name: 'Facebook', icon: '👤', color: 'bg-blue-600', autoDefault: false },
};

const STATUS_STYLES: Record<ChannelStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Pendente' },
  READY: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Pronto' },
  MANUAL: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Manual' },
  PUBLISHED: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Publicado' },
  ERROR: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Erro' },
  SKIPPED: { bg: 'bg-gray-500/10', text: 'text-gray-500', label: 'Ignorado' },
};

const ALL_CHANNELS: Channel[] = ['TELEGRAM', 'WHATSAPP', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'SITE'];

// ==================== COMPONENTE ====================

export function PromotionCard({ draft, onUpdate }: PromotionCardProps) {
  const [channels, setChannels] = useState<PromotionChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [publishingChannel, setPublishingChannel] = useState<Channel | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

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
          status: CHANNEL_CONFIG[ch].autoDefault ? 'READY' : 'MANUAL',
          autoPublish: CHANNEL_CONFIG[ch].autoDefault,
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
              status: CHANNEL_CONFIG[ch].autoDefault ? 'READY' : 'MANUAL',
              autoPublish: CHANNEL_CONFIG[ch].autoDefault,
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

  // Inicializar canais (cria no backend)
  const handleInitialize = async () => {
    if (!draft?.id) return;
    setIsLoading(true);
    
    try {
      await initializePromotionChannels(draft.id);
      await loadChannels();
      onUpdate();
    } catch (error) {
      console.error('Erro ao inicializar canais:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Publicar em um canal específico
  const handlePublish = async (channel: Channel) => {
    if (!draft?.id) return;
    
    // Verificar se X precisa de imagem
    if (channel === 'TWITTER' && !hasImage) {
      alert('X/Twitter requer uma imagem do produto.');
      return;
    }
    
    setPublishingChannel(channel);
    
    try {
      const result = await publishToChannel(draft.id, channel);
      
      if (result.success) {
        // Atualizar canal local
        setChannels(prev => prev.map(ch => 
          ch.channel === channel 
            ? { ...ch, status: 'PUBLISHED' as ChannelStatus, publishedAt: new Date().toISOString() }
            : ch
        ));
        onUpdate();
      } else {
        alert(`Erro ao publicar: ${result.error?.message || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error('Erro ao publicar:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setPublishingChannel(null);
    }
  };

  // Toggle autoPublish
  const handleToggleAuto = async (channel: Channel) => {
    if (!draft?.id) return;
    
    const currentChannel = channels.find(c => c.channel === channel);
    if (!currentChannel) return;
    
    const newAuto = !currentChannel.autoPublish;
    
    try {
      // Se é placeholder, primeiro inicializar
      if (currentChannel._isPlaceholder) {
        await handleInitialize();
      }
      
      await updatePromotionChannel(draft.id, channel, {
        autoPublish: newAuto,
        status: newAuto ? 'READY' : 'MANUAL',
      });
      
      setChannels(prev => prev.map(ch => 
        ch.channel === channel 
          ? { ...ch, autoPublish: newAuto, status: newAuto ? 'READY' : 'MANUAL' }
          : ch
      ));
    } catch (error) {
      console.error('Erro ao atualizar canal:', error);
    }
  };

  // Calcular resumo de status
  const statusSummary = {
    published: channels.filter(c => c.status === 'PUBLISHED').length,
    ready: channels.filter(c => c.status === 'READY' || c.status === 'MANUAL').length,
    error: channels.filter(c => c.status === 'ERROR').length,
    total: channels.length,
  };

  return (
    <div className={cn(
      'bg-surface rounded-xl border border-border overflow-hidden',
      'hover:border-primary/50 transition-all duration-200',
      draft.priority === 'HIGH' && 'ring-2 ring-warning/50'
    )}>
      {/* Header - Tags */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-hover/50">
        <div className="flex items-center gap-2 flex-wrap">
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
          {displayScore > 0 && (
            <span className={cn(
              'px-2 py-1 rounded-md text-xs font-medium',
              displayScore >= 70 ? 'bg-success/20 text-success' :
              displayScore >= 50 ? 'bg-primary/20 text-primary' :
              'bg-warning/20 text-warning'
            )}>
              📊 {displayScore}
            </span>
          )}
          {urgencyLabel && (
            <span className="px-2 py-1 rounded-md bg-orange-500/20 text-orange-500 text-xs font-medium">
              ⏰ {urgencyLabel}
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

        {/* Resumo de Status dos Canais */}
        <div className="flex items-center justify-between py-2 border-y border-border">
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">Canais:</span>
            <span className="text-xs font-medium text-emerald-400">
              {statusSummary.published} publicados
            </span>
            <span className="text-xs font-medium text-green-400">
              {statusSummary.ready} prontos
            </span>
            {statusSummary.error > 0 && (
              <span className="text-xs font-medium text-red-400">
                {statusSummary.error} erros
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
            {channels.map((ch) => {
              const config = CHANNEL_CONFIG[ch.channel];
              const statusStyle = STATUS_STYLES[ch.status];
              const isPublishing = publishingChannel === ch.channel;
              const canPublish = ch.status === 'READY' || ch.status === 'MANUAL';
              const isXWithoutImage = ch.channel === 'TWITTER' && !hasImage;
              
              return (
                <div
                  key={ch.channel}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    'bg-surface-hover/50 border border-border',
                    ch.status === 'PUBLISHED' && 'opacity-60'
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
                      <p className="text-xs text-text-muted">
                        {ch.autoPublish ? 'Auto: On' : 'Manual'}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      statusStyle.bg, statusStyle.text
                    )}>
                      {statusStyle.label}
                    </span>
                    
                    {/* Toggle Auto */}
                    <button
                      onClick={() => handleToggleAuto(ch.channel)}
                      disabled={ch.status === 'PUBLISHED'}
                      className={cn(
                        'w-10 h-5 rounded-full transition-all relative',
                        ch.autoPublish ? 'bg-primary' : 'bg-gray-600',
                        ch.status === 'PUBLISHED' && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <span className={cn(
                        'absolute w-4 h-4 rounded-full bg-white top-0.5 transition-all',
                        ch.autoPublish ? 'right-0.5' : 'left-0.5'
                      )} />
                    </button>

                    {/* Botão Publicar */}
                    <button
                      onClick={() => handlePublish(ch.channel)}
                      disabled={!canPublish || isPublishing || isXWithoutImage}
                      title={isXWithoutImage ? 'X requer imagem' : ''}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        'flex items-center gap-1',
                        canPublish && !isXWithoutImage
                          ? 'bg-primary hover:bg-primary-hover text-white'
                          : 'bg-surface text-text-muted cursor-not-allowed opacity-50',
                        isPublishing && 'animate-pulse'
                      )}
                    >
                      {isPublishing ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Publicando...
                        </>
                      ) : ch.status === 'PUBLISHED' ? (
                        <>✓ Publicado</>
                      ) : (
                        <>🚀 Postar</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Botão Inicializar Canais (se são placeholders) */}
            {channels.some(c => c._isPlaceholder) && (
              <button
                onClick={handleInitialize}
                disabled={isLoading}
                className={cn(
                  'w-full py-2 rounded-lg text-sm font-medium transition-all',
                  'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30',
                  isLoading && 'animate-pulse'
                )}
              >
                {isLoading ? '⏳ Inicializando...' : '🔧 Inicializar Canais'}
              </button>
            )}
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
          
          <span className="text-xs text-text-muted">
            {draft.batch?.scheduledTime || '--:--'}
          </span>
        </div>
      </div>

      {/* Ação Rápida - Publicar Todos os Auto */}
      {statusSummary.ready > 0 && (
        <div className="p-4 border-t border-border bg-surface-hover/30">
          <button
            onClick={async () => {
              setIsLoading(true);
              try {
                for (const ch of channels.filter(c => c.autoPublish && (c.status === 'READY' || c.status === 'MANUAL'))) {
                  await handlePublish(ch.channel);
                  await new Promise(r => setTimeout(r, 1000)); // Delay entre publicações
                }
                onUpdate();
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
            className={cn(
              'w-full py-2.5 rounded-lg font-medium text-sm transition-all',
              'bg-success hover:bg-success/90 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isLoading && 'animate-pulse'
            )}
          >
            {isLoading ? '⏳ Publicando...' : `🚀 Publicar Automáticos (${channels.filter(c => c.autoPublish && c.status !== 'PUBLISHED').length})`}
          </button>
        </div>
      )}
    </div>
  );
}
