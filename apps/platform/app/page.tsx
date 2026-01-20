'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/Card';
import { BatchTabs } from '@/components/BatchTabs';
import { StatsBar } from '@/components/StatsBar';
import { fetcher, Batch, PostDraft, dispatchBatch } from '@/lib/api';
import { cn } from '@/lib/utils';

// Tipos de source
type SourceFilter = 'all' | 'MANUAL' | 'MERCADO_LIVRE';

// Dados fake para demonstração - Estilo "Manu" (natural e humano)
const FAKE_DRAFTS: PostDraft[] = [
  {
    id: 'fake-1',
    offer: {
      id: 'offer-1',
      title: 'Smartphone Samsung Galaxy A55 256GB',
      description: 'Smartphone com câmera de 50MP',
      originalPrice: 2499,
      finalPrice: 1799,
      discount: 28,
      affiliateUrl: 'https://example.com/samsung',
      imageUrl: 'https://images.samsung.com/a55.jpg',
      niche: { id: 'n1', name: 'Eletrônicos', slug: 'eletronicos', icon: '📱' },
      store: { id: 's1', name: 'Magazine Luiza', slug: 'magalu' },
      urgency: 'HOJE',
    },
    batch: { id: 'b3', scheduledTime: '14:00', date: new Date().toISOString(), status: 'PENDING', pendingCount: 4, approvedCount: 0, dispatchedCount: 0, errorCount: 0 },
    copyText: 'Esse celular tá num preço que eu não via fazia tempo 👀\nEra R$ 2.499, agora tá R$ 1.799.',
    channels: ['TELEGRAM', 'TWITTER', 'SITE'],
    priority: 'HIGH',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    aiScore: 94,
  },
  {
    id: 'fake-2',
    offer: {
      id: 'offer-2',
      title: 'Smart TV LG 55" 4K UHD WebOS',
      description: 'TV com controle por voz',
      originalPrice: 3299,
      finalPrice: 2199,
      discount: 33,
      affiliateUrl: 'https://example.com/lg-tv',
      imageUrl: 'https://images.lg.com/tv55.jpg',
      niche: { id: 'n1', name: 'Eletrônicos', slug: 'eletronicos', icon: '📱' },
      store: { id: 's2', name: 'Casas Bahia', slug: 'casasbahia' },
      urgency: 'ULTIMAS_UNIDADES',
    },
    batch: { id: 'b3', scheduledTime: '14:00', date: new Date().toISOString(), status: 'PENDING', pendingCount: 4, approvedCount: 0, dispatchedCount: 0, errorCount: 0 },
    copyText: 'Fazia tempo que eu não via essa TV assim.\nDe R$ 3.299 por R$ 2.199.',
    channels: ['TELEGRAM', 'WHATSAPP', 'SITE'],
    priority: 'NORMAL',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    aiScore: 78,
  },
  {
    id: 'fake-3',
    offer: {
      id: 'offer-3',
      title: 'Tênis Nike Air Max 90 Masculino',
      description: 'Tênis casual confortável',
      originalPrice: 799,
      finalPrice: 449,
      discount: 44,
      affiliateUrl: 'https://example.com/nike',
      imageUrl: 'https://images.nike.com/airmax90.jpg',
      niche: { id: 'n2', name: 'Moda', slug: 'moda', icon: '👗' },
      store: { id: 's3', name: 'Netshoes', slug: 'netshoes' },
      urgency: 'LIMITADO',
    },
    batch: { id: 'b3', scheduledTime: '14:00', date: new Date().toISOString(), status: 'PENDING', pendingCount: 4, approvedCount: 0, dispatchedCount: 0, errorCount: 0 },
    copyText: 'Achei isso agora pouco.\nEra R$ 799, agora tá R$ 449.',
    channels: ['TELEGRAM', 'TWITTER', 'SITE'],
    priority: 'NORMAL',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    aiScore: 91,
  },
  {
    id: 'fake-4',
    offer: {
      id: 'offer-4',
      title: 'Air Fryer Philips Walita 4.1L Digital',
      description: 'Fritadeira sem óleo',
      originalPrice: 599,
      finalPrice: 299,
      discount: 50,
      affiliateUrl: 'https://example.com/airfryer',
      imageUrl: 'https://images.philips.com/airfryer.jpg',
      niche: { id: 'n3', name: 'Casa', slug: 'casa', icon: '🏠' },
      store: { id: 's4', name: 'Amazon', slug: 'amazon' },
      urgency: 'NORMAL',
    },
    batch: { id: 'b3', scheduledTime: '14:00', date: new Date().toISOString(), status: 'PENDING', pendingCount: 4, approvedCount: 0, dispatchedCount: 0, errorCount: 0 },
    copyText: 'Pra quem tava esperando baixar...\nSaiu de R$ 599 pra R$ 299.',
    channels: ['TELEGRAM', 'WHATSAPP', 'FACEBOOK', 'SITE'],
    priority: 'HIGH',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    aiScore: 96,
    deliveries: [
      { channel: 'TELEGRAM', status: 'SENT', sentAt: new Date().toISOString() },
      { channel: 'WHATSAPP', status: 'PENDING' },
      { channel: 'FACEBOOK', status: 'ERROR', error: 'Token expirado' },
      { channel: 'SITE', status: 'SENT', sentAt: new Date().toISOString() },
    ],
  },
  // === OFERTAS MERCADO LIVRE (com source) ===
  {
    id: 'ml-1',
    offer: {
      id: 'offer-ml-1',
      title: 'iPhone 14 Pro Max 256GB Roxo Profundo',
      description: 'iPhone com chip A17 Pro',
      originalPrice: 8999,
      finalPrice: 5999,
      discount: 33,
      affiliateUrl: 'https://mercadolivre.com.br/iphone14',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_iphone14.jpg',
      niche: { id: 'n1', name: 'Eletrônicos', slug: 'eletronicos', icon: '📱' },
      store: { id: 's-ml', name: 'TECHSTORE_OFICIAL', slug: 'techstore-oficial' },
      urgency: 'HOJE',
      source: 'MERCADO_LIVRE',
    },
    batch: { id: 'b3', scheduledTime: '14:00', date: new Date().toISOString(), status: 'PENDING', pendingCount: 4, approvedCount: 0, dispatchedCount: 0, errorCount: 0 },
    copyText: 'Esse celular tá num preço que eu não via fazia tempo 👀\nEra R$ 8.999, agora tá R$ 5.999.',
    copyTextTelegram: 'Esse celular tá num preço que eu não via fazia tempo 👀\nEra R$ 8.999, agora tá R$ 5.999.\n\nNão sei até quando fica assim.\n\nhttps://mercadolivre.com.br/iphone14',
    copyTextSite: 'Esse celular tá num preço que eu não via fazia tempo 👀\nEra R$ 8.999, agora tá R$ 5.999.',
    copyTextX: 'Esse celular tá num preço que eu não via fazia tempo 👀\nDe R$ 8.999 por R$ 5.999\n\nhttps://mercadolivre.com.br/iphone14',
    channels: ['TELEGRAM', 'TWITTER', 'SITE'],
    priority: 'HIGH',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    aiScore: 50,
    score: 50,
    requiresHumanForX: true,
    source: 'MERCADO_LIVRE',
  },
  {
    id: 'ml-2',
    offer: {
      id: 'offer-ml-2',
      title: 'Smart TV LG 55" 4K OLED C3 120Hz Gaming',
      description: 'TV OLED com taxa de atualização de 120Hz',
      originalPrice: 6999,
      finalPrice: 4199,
      discount: 40,
      affiliateUrl: 'https://mercadolivre.com.br/lg-oled',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_lg_oled.jpg',
      niche: { id: 'n1', name: 'Eletrônicos', slug: 'eletronicos', icon: '📱' },
      store: { id: 's-lg', name: 'LG_STORE', slug: 'lg-store' },
      urgency: 'ULTIMAS_UNIDADES',
      source: 'MERCADO_LIVRE',
    },
    batch: { id: 'b3', scheduledTime: '14:00', date: new Date().toISOString(), status: 'PENDING', pendingCount: 4, approvedCount: 0, dispatchedCount: 0, errorCount: 0 },
    copyText: 'Olha o que apareceu.\nCaiu de R$ 6.999 pra R$ 4.199.',
    copyTextTelegram: 'Olha o que apareceu.\nCaiu de R$ 6.999 pra R$ 4.199.\n\nGeralmente some rápido.\n\nhttps://mercadolivre.com.br/lg-oled',
    copyTextSite: 'Olha o que apareceu.\nCaiu de R$ 6.999 pra R$ 4.199.',
    copyTextX: 'Olha o que apareceu.\nDe R$ 6.999 por R$ 4.199\n\nhttps://mercadolivre.com.br/lg-oled',
    channels: ['TELEGRAM', 'TWITTER', 'SITE'],
    priority: 'HIGH',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    aiScore: 60,
    score: 60,
    requiresHumanForX: true,
    source: 'MERCADO_LIVRE',
  },
  {
    id: 'ml-3',
    offer: {
      id: 'offer-ml-3',
      title: 'Robô Aspirador iRobot Roomba i7+ Mapeamento',
      description: 'Robô com esvaziamento automático',
      originalPrice: 4999,
      finalPrice: 2999,
      discount: 40,
      affiliateUrl: 'https://mercadolivre.com.br/roomba-i7',
      imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_roomba.jpg',
      niche: { id: 'n3', name: 'Casa', slug: 'casa', icon: '🏠' },
      store: { id: 's-irobot', name: 'IROBOT_BRASIL', slug: 'irobot-brasil' },
      urgency: 'LIMITADO',
      source: 'MERCADO_LIVRE',
    },
    batch: { id: 'b4', scheduledTime: '18:00', date: new Date().toISOString(), status: 'PENDING', pendingCount: 2, approvedCount: 0, dispatchedCount: 0, errorCount: 0 },
    copyText: 'Fazia tempo que não via assim.\nSaiu de R$ 4.999 pra R$ 2.999.',
    copyTextTelegram: 'Fazia tempo que não via assim.\nSaiu de R$ 4.999 pra R$ 2.999.\n\n👀\n\nhttps://mercadolivre.com.br/roomba-i7',
    copyTextSite: 'Fazia tempo que não via assim.\nSaiu de R$ 4.999 pra R$ 2.999.',
    copyTextX: 'Fazia tempo que não via assim.\nDe R$ 4.999 por R$ 2.999\n\nhttps://mercadolivre.com.br/roomba-i7',
    channels: ['TELEGRAM', 'SITE'],
    priority: 'NORMAL',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    aiScore: 55,
    score: 55,
    requiresHumanForX: false,
    source: 'MERCADO_LIVRE',
  },
];

const FAKE_BATCHES: Batch[] = [
  { id: 'b1', scheduledTime: '08:00', date: new Date().toISOString(), status: 'COMPLETED', pendingCount: 0, approvedCount: 0, dispatchedCount: 8, errorCount: 0 },
  { id: 'b2', scheduledTime: '11:00', date: new Date().toISOString(), status: 'COMPLETED', pendingCount: 0, approvedCount: 0, dispatchedCount: 5, errorCount: 1 },
  { id: 'b3', scheduledTime: '14:00', date: new Date().toISOString(), status: 'PENDING', pendingCount: 4, approvedCount: 0, dispatchedCount: 0, errorCount: 0 },
  { id: 'b4', scheduledTime: '18:00', date: new Date().toISOString(), status: 'PENDING', pendingCount: 0, approvedCount: 0, dispatchedCount: 0, errorCount: 0 },
  { id: 'b5', scheduledTime: '22:00', date: new Date().toISOString(), status: 'PENDING', pendingCount: 0, approvedCount: 0, dispatchedCount: 0, errorCount: 0 },
];

export default function Dashboard() {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'error'>('pending');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showOnlyX, setShowOnlyX] = useState(false);
  // AJUSTE 1 - Modo de operação: 'rapido' = OK dispara imediato, 'carga' = OK só aprova
  const [dispatchMode, setDispatchMode] = useState<'rapido' | 'carga'>('rapido');

  // Buscar cargas do dia
  const { data: batches, error: batchesError, isLoading: batchesLoading, mutate: mutateBatches } = useSWR<Batch[]>(
    '/api/batches',
    fetcher,
    { 
      refreshInterval: 10000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  // Buscar drafts da carga selecionada
  const { data: drafts, mutate: mutateDrafts } = useSWR<PostDraft[]>(
    selectedBatchId ? `/api/drafts?batchId=${selectedBatchId}` : null,
    fetcher,
    { 
      refreshInterval: 5000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  // Usar dados fake quando API não está conectada
  const isOffline = !!batchesError;
  const displayBatches = isOffline ? FAKE_BATCHES : (batches || []);
  const displayDrafts = isOffline ? FAKE_DRAFTS : (drafts || []);

  // Selecionar primeira carga disponível
  useEffect(() => {
    if (displayBatches.length > 0 && !selectedBatchId) {
      const pendingBatch = displayBatches.find((b) => b.pendingCount > 0);
      setSelectedBatchId(pendingBatch?.id || displayBatches[0].id);
    }
  }, [displayBatches, selectedBatchId]);

  // Calcular stats
  const stats = displayBatches.reduce(
    (acc, batch) => ({
      pending: acc.pending + batch.pendingCount,
      approved: acc.approved + batch.approvedCount,
      dispatched: acc.dispatched + batch.dispatchedCount,
      errors: acc.errors + batch.errorCount,
    }),
    { pending: 0, approved: 0, dispatched: 0, errors: 0 }
  );

  // Filtrar drafts
  const filteredDrafts = displayDrafts.filter((draft) => {
    // Filtro por status
    if (filter !== 'all') {
      if (filter === 'pending' && draft.status !== 'PENDING') return false;
      if (filter === 'approved' && draft.status !== 'APPROVED') return false;
      if (filter === 'error' && draft.status !== 'ERROR') return false;
    }
    
    // Filtro por source
    if (sourceFilter !== 'all') {
      const draftSource = (draft as any).source || draft.offer?.source || 'MANUAL';
      if (draftSource !== sourceFilter) return false;
    }
    
    // Filtro "somente X"
    if (showOnlyX) {
      const hasX = draft.channels?.includes('TWITTER');
      const requiresHuman = (draft as any).requiresHumanForX;
      if (!hasX && !requiresHuman) return false;
    }
    
    return true;
  });

  // Atualizar dados
  const handleUpdate = () => {
    mutateBatches();
    mutateDrafts();
  };

  // Disparar todos aprovados
  const handleDispatchAll = async () => {
    if (!selectedBatchId) return;
    try {
      await dispatchBatch(selectedBatchId);
      handleUpdate();
    } catch (error) {
      console.error('Erro ao disparar:', error);
    }
  };

  const selectedBatch = displayBatches.find((b) => b.id === selectedBatchId);

  // Estado de loading (só mostra se não tiver error/offline)
  if (batchesLoading && !isOffline) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
        <p className="text-text-secondary">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Banner Modo Demo */}
      {isOffline && (
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🎭</span>
          <div>
            <span className="font-semibold text-amber-400">Modo Demo</span>
            <span className="text-text-secondary ml-2">— Exibindo cards fake. Inicie a API para dados reais.</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-muted text-sm">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* AJUSTE 1 - Toggle de Modo */}
          <div className="flex items-center gap-2 bg-surface rounded-xl p-1 border border-border">
            <button
              onClick={() => setDispatchMode('rapido')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                dispatchMode === 'rapido'
                  ? 'bg-success text-white'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              ⚡ Modo Rápido
            </button>
            <button
              onClick={() => setDispatchMode('carga')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                dispatchMode === 'carga'
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              📦 Modo Carga
            </button>
          </div>
          
          {/* Botão Disparar Carga (só aparece no Modo Carga) */}
          {dispatchMode === 'carga' && selectedBatch && selectedBatch.approvedCount > 0 && !isOffline && (
            <button
              onClick={handleDispatchAll}
              className="px-6 py-3 rounded-xl bg-success hover:bg-success/90 text-white font-medium transition-all animate-pulse-glow"
            >
              🚀 Disparar Carga {selectedBatch.scheduledTime} ({selectedBatch.approvedCount})
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatsBar {...stats} />

      {/* Batch Tabs */}
      <BatchTabs
        batches={displayBatches}
        selectedBatch={selectedBatchId}
        onSelect={setSelectedBatchId}
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filtro por Status */}
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-border">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'pending', label: 'Pendentes' },
            { key: 'approved', label: 'Aprovados' },
            { key: 'error', label: 'Erros' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                filter === f.key
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        
        {/* Filtro por Source */}
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-border">
          {[
            { key: 'all', label: '🌐 Todos', color: '' },
            { key: 'MANUAL', label: '✏️ Manual', color: 'bg-gray-500' },
            { key: 'MERCADO_LIVRE', label: '🛒 ML', color: 'bg-yellow-500' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSourceFilter(s.key as SourceFilter)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                sourceFilter === s.key
                  ? 'bg-amber-500 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        
        {/* Toggle "Somente X" */}
        <button
          onClick={() => setShowOnlyX(!showOnlyX)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
            showOnlyX
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-surface border-border text-text-secondary hover:text-text-primary'
          )}
        >
          🐦 Somente X
        </button>
        
        <div className="flex-1" />
        <span className="text-sm text-text-muted">
          {filteredDrafts.length} cards
        </span>
      </div>

      {/* Grid de Cards */}
      {filteredDrafts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDrafts.map((draft) => (
            <Card key={draft.id} draft={draft} onUpdate={handleUpdate} dispatchMode={dispatchMode} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <span className="text-6xl mb-4">📭</span>
          <p className="text-lg">Nenhum card encontrado</p>
          <p className="text-sm">
            {filter === 'pending'
              ? 'Todos os posts foram processados!'
              : 'Selecione outra carga ou filtro'}
          </p>
        </div>
      )}
    </div>
  );
}
