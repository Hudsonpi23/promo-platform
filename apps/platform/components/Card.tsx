'use client';

import { useState } from 'react';
import { PostDraft, approveDraft, markAsApproved, rejectDraft, sendToError, updateDraft } from '@/lib/api';
import { cn, formatCurrency, formatDiscount, getUrgencyLabel, getStatusColor, getStatusLabel, getChannelIcon } from '@/lib/utils';

type CopyTab = 'TELEGRAM' | 'SITE' | 'X';

interface CardProps {
  draft: PostDraft;
  onUpdate: () => void;
  dispatchMode?: 'rapido' | 'carga';
}

export function Card({ draft, onUpdate, dispatchMode = 'rapido' }: CardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCopy, setEditedCopy] = useState(draft.copyText);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(draft.channels);
  const [activeTab, setActiveTab] = useState<CopyTab>('TELEGRAM');

  const { offer } = draft;
  const urgencyLabel = getUrgencyLabel(offer.urgency);

  // AJUSTE 1 - Aprovar (modo depende do dispatchMode)
  const handleApprove = async () => {
    setIsLoading(true);
    try {
      if (dispatchMode === 'rapido') {
        // Modo Rápido: OK → dispara imediatamente
        await approveDraft(draft.id);
      } else {
        // Modo Carga: OK → marca como aprovado (disparo posterior via botão de carga)
        await markAsApproved(draft.id);
      }
      onUpdate();
    } catch (error) {
      console.error('Erro ao aprovar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reprovar
  const handleReject = async () => {
    setIsLoading(true);
    try {
      await rejectDraft(draft.id);
      onUpdate();
    } catch (error) {
      console.error('Erro ao reprovar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Enviar para Erros
  const handleSendToError = async () => {
    setIsLoading(true);
    try {
      await sendToError(draft.id);
      onUpdate();
    } catch (error) {
      console.error('Erro ao enviar para erros:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Salvar edição
  const handleSaveEdit = async () => {
    setIsLoading(true);
    try {
      await updateDraft(draft.id, {
        copyText: editedCopy,
        channels: selectedChannels as any,
      });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle channel
  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const isPending = draft.status === 'PENDING';
  
  // Obter source (Mercado Livre, Manual, etc)
  const draftSource = (draft as any).source || (draft as any).offer?.source || 'MANUAL';
  const isML = draftSource === 'MERCADO_LIVRE';
  
  // Score (preferir score do provider sobre aiScore)
  const displayScore = (draft as any).score ?? draft.aiScore;
  
  // Copy por canal
  const getCopyForTab = (tab: CopyTab): string => {
    const draftAny = draft as any;
    switch (tab) {
      case 'TELEGRAM':
        return draftAny.copyTextTelegram || draft.copyText;
      case 'SITE':
        return draftAny.copyTextSite || draft.copyText;
      case 'X':
        return draftAny.copyTextX || draft.copyText;
      default:
        return draft.copyText;
    }
  };
  
  // Verificar se tem imagem (necessário para X)
  const hasImage = draft.offer?.imageUrl || (draft as any).imageUrl;
  const requiresHumanForX = (draft as any).requiresHumanForX;

  return (
    <div className={cn(
      'bg-surface rounded-xl border border-border overflow-hidden animate-slide-in',
      'hover:border-primary/50 transition-all duration-200',
      draft.priority === 'HIGH' && 'ring-2 ring-warning/50'
    )}>
      {/* Header - Tags */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-hover/50">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Badge Mercado Livre */}
          {isML && (
            <span className="px-2 py-1 rounded-md bg-yellow-500/20 text-yellow-500 text-xs font-medium">
              🛒 ML
            </span>
          )}
          <span className="px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-medium">
            {offer.niche.icon} {offer.niche.name}
          </span>
          {draft.priority === 'HIGH' && (
            <span className="px-2 py-1 rounded-md bg-warning/20 text-warning text-xs font-medium">
              🔥 Alta
            </span>
          )}
          {/* Score */}
          {displayScore !== undefined && (
            <span className={cn(
              'px-2 py-1 rounded-md text-xs font-medium',
              displayScore >= 60 ? 'bg-success/20 text-success' :
              displayScore >= 40 ? 'bg-primary/20 text-primary' :
              'bg-warning/20 text-warning'
            )}>
              📊 {displayScore}
            </span>
          )}
          {/* Urgência */}
          {urgencyLabel && (
            <span className="px-2 py-1 rounded-md bg-orange-500/20 text-orange-500 text-xs font-medium">
              ⏰ {urgencyLabel}
            </span>
          )}
        </div>
        <span className="px-2 py-1 rounded-md bg-surface text-text-secondary text-xs truncate max-w-[100px]">
          {offer.store.name}
        </span>
      </div>

      {/* Conteúdo Principal */}
      <div className="p-4 space-y-4">
        {/* Título */}
        <h3 className="text-lg font-semibold text-text-primary leading-tight">
          {offer.title}
        </h3>

        {/* Preços */}
        <div className="flex items-baseline gap-3">
          <span className="text-text-muted line-through text-sm">
            {formatCurrency(offer.originalPrice)}
          </span>
          <span className="text-2xl font-bold text-success">
            {formatCurrency(offer.finalPrice)}
          </span>
          <span className="px-2 py-0.5 rounded bg-success/20 text-success text-sm font-medium">
            {formatDiscount(offer.discount)}
          </span>
        </div>

        {/* Imagem (se X estiver nos canais) */}
        {hasImage && selectedChannels.includes('TWITTER') && (
          <div className="relative h-24 rounded-lg overflow-hidden bg-surface-hover">
            <img 
              src={hasImage} 
              alt={offer.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute bottom-1 right-1 px-2 py-0.5 rounded bg-black/60 text-white text-xs">
              📷 Imagem para X
            </div>
          </div>
        )}

        {/* Tabs de Preview por Canal */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 border-b border-border pb-1">
            {(['TELEGRAM', 'SITE', 'X'] as CopyTab[]).map((tab) => {
              const isActive = activeTab === tab;
              const hasContent = tab === 'X' ? (draft as any).copyTextX : 
                                tab === 'SITE' ? (draft as any).copyTextSite : true;
              const isTwitter = tab === 'X';
              const xDisabled = isTwitter && !hasImage;
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  disabled={xDisabled}
                  className={cn(
                    'px-3 py-1.5 rounded-t-lg text-xs font-medium transition-all',
                    isActive
                      ? 'bg-surface border border-border border-b-surface text-text-primary'
                      : 'text-text-muted hover:text-text-secondary',
                    xDisabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {tab === 'TELEGRAM' && '📱 Telegram'}
                  {tab === 'SITE' && '🌐 Site'}
                  {tab === 'X' && (
                    <>
                      🐦 X
                      {requiresHumanForX && <span className="ml-1 text-warning">👁</span>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Preview do Copy */}
          {!isEditing ? (
            <div className="p-3 rounded-lg bg-background border border-border min-h-[80px]">
              <p className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-5">
                {getCopyForTab(activeTab)}
              </p>
              {activeTab === 'X' && !hasImage && (
                <p className="text-xs text-error mt-2">⚠️ X requer imagem do produto</p>
              )}
            </div>
          ) : (
            <textarea
              value={editedCopy}
              onChange={(e) => setEditedCopy(e.target.value)}
              className="w-full h-32 p-3 rounded-lg bg-background border border-primary text-text-primary text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>

        {/* AJUSTE 2 - Canais de Destino com Status Visual */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {['TELEGRAM', 'WHATSAPP', 'FACEBOOK', 'TWITTER', 'SITE'].map((channel) => {
              // Buscar status de delivery do canal
              const delivery = draft.deliveries?.find(d => d.channel === channel);
              const deliveryStatus = delivery?.status;
              
              // Ícone de status
              const statusIcon = deliveryStatus === 'SENT' ? '✅' :
                                deliveryStatus === 'ERROR' ? '❌' :
                                deliveryStatus === 'PENDING' ? '⏳' : '';
              
              return (
                <button
                  key={channel}
                  onClick={() => isEditing && toggleChannel(channel)}
                  disabled={!isEditing}
                  title={delivery?.error || (deliveryStatus ? `Status: ${deliveryStatus}` : '')}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1',
                    selectedChannels.includes(channel)
                      ? deliveryStatus === 'SENT' ? 'bg-success/20 text-success border border-success/30' :
                        deliveryStatus === 'ERROR' ? 'bg-error/20 text-error border border-error/30' :
                        'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-surface-hover text-text-muted border border-transparent',
                    isEditing && 'cursor-pointer hover:border-primary/50'
                  )}
                >
                  {getChannelIcon(channel)} {channel.slice(0, 2)}
                  {statusIcon && <span className="ml-0.5">{statusIcon}</span>}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-text-muted">
            Carga: <span className="text-text-secondary font-medium">{draft.batch.scheduledTime}</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border',
            getStatusColor(draft.status)
          )}>
            {getStatusLabel(draft.status)}
          </span>
        </div>
      </div>

      {/* Ações */}
      {isPending && (
        <div className="flex flex-col gap-2 p-4 border-t border-border bg-surface-hover/30">
          {!isEditing ? (
            <>
              <div className="flex items-center gap-2">
                {/* Botão OK (Telegram + Site) */}
                <button
                  onClick={handleApprove}
                  disabled={isLoading || selectedChannels.length === 0}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg font-medium text-sm transition-all',
                    dispatchMode === 'rapido' 
                      ? 'bg-success hover:bg-success/90 text-white'
                      : 'bg-primary hover:bg-primary-hover text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    isLoading && 'animate-pulse'
                  )}
                >
                  {dispatchMode === 'rapido' ? '✅ OK (TG+Site)' : '👍 Aprovar'}
                </button>
                
                {/* Botão OK p/ X (supervisionado) - só aparece se X está nos canais */}
                {requiresHumanForX && selectedChannels.includes('TWITTER') && (
                  <button
                    onClick={handleApprove}
                    disabled={isLoading || !hasImage}
                    title={!hasImage ? 'X requer imagem do produto' : 'Aprovar para X (supervisionado)'}
                    className={cn(
                      'py-2.5 px-3 rounded-lg font-medium text-sm transition-all',
                      'bg-blue-500 hover:bg-blue-600 text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      isLoading && 'animate-pulse'
                    )}
                  >
                    🐦 OK p/ X
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 py-2 rounded-lg bg-surface-hover hover:bg-border text-text-secondary text-sm transition-all"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={handleReject}
                  disabled={isLoading}
                  className="flex-1 py-2 rounded-lg bg-surface-hover hover:bg-error/20 text-text-secondary hover:text-error text-sm transition-all"
                >
                  ❌ Rejeitar
                </button>
                <button
                  onClick={handleSendToError}
                  disabled={isLoading}
                  className="py-2 px-3 rounded-lg bg-surface-hover hover:bg-warning/20 text-text-secondary hover:text-warning text-sm transition-all"
                >
                  🧯
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={handleSaveEdit}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all"
              >
                💾 Salvar
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedCopy(draft.copyText);
                  setSelectedChannels(draft.channels);
                }}
                className="px-4 py-2.5 rounded-lg bg-surface-hover hover:bg-border text-text-secondary text-sm transition-all"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
