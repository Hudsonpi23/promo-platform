import { fetchWithAuth } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Fetcher para SWR com timeout e autenticação
export const fetcher = async (url: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos timeout

  try {
    console.log('[Fetcher] Requesting:', url);
    
    const res = await fetchWithAuth(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.error('[Fetcher] HTTP error:', res.status, url);
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    // Debug: Log response structure
    console.log('[Fetcher] Response:', url, { 
      hasData: !!data?.data, 
      isArray: Array.isArray(data?.data || data),
      count: Array.isArray(data?.data) ? data.data.length : (Array.isArray(data) ? data.length : 'N/A')
    });
    
    // Normalizar resposta - a API pode retornar { data: [...] } ou diretamente [...]
    return data?.data || data || [];
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('[Fetcher] Error:', url, error.message);
    
    if (error.name === 'AbortError') {
      throw new Error('API timeout - servidor não respondeu');
    }
    throw error;
  }
};

// Tipos
export interface Niche {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

// Source de onde veio a oferta
export type OfferSource = 'MANUAL' | 'MERCADO_LIVRE' | 'AMAZON' | 'MAGALU' | 'LOMADEE';

export interface Offer {
  id: string;
  title: string;
  description?: string;
  originalPrice: number;
  finalPrice: number;
  discount: number;
  discountPct?: number; // Campo alternativo do banco
  affiliateUrl: string;
  imageUrl?: string;
  niche: Niche;
  store: Store;
  urgency: 'HOJE' | 'ULTIMAS_UNIDADES' | 'LIMITADO' | 'NORMAL';
  expiresAt?: string;
  // Campos do Mercado Livre
  source?: OfferSource;
  externalId?: string;
  sellerName?: string;
  sellerReputation?: string;
}

// Canais de divulgação disponíveis
export type Channel = 'TELEGRAM' | 'WHATSAPP' | 'FACEBOOK' | 'TWITTER' | 'SITE';

// Status de entrega por canal
export interface ChannelDelivery {
  channel: Channel;
  status: 'PENDING' | 'SENT' | 'ERROR';
  sentAt?: string;
  error?: string;
}

export interface PostDraft {
  id: string;
  offer: Offer;
  batch: Batch;
  copyText: string;
  channels: Channel[];
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  status: 'PENDING' | 'APPROVED' | 'DISPATCHED' | 'REJECTED' | 'ERROR' | 'PENDING_X_QUOTA';
  approvedAt?: string;
  createdAt: string;
  // AJUSTE 2 - Status por canal
  deliveries?: ChannelDelivery[];
  // AJUSTE 3 - Score de confiança da IA
  aiScore?: number;
  // Campos do Mercado Livre / Copy por Canal
  source?: OfferSource;
  score?: number;
  copyTextTelegram?: string;
  copyTextSite?: string;
  copyTextX?: string;
  imageUrl?: string;
  requiresImage?: boolean;
  requiresHumanForX?: boolean;
}

export interface Batch {
  id: string;
  scheduledTime: string;
  date: string;
  status: 'PENDING' | 'READY' | 'DISPATCHED' | 'COMPLETED';
  pendingCount: number;
  approvedCount: number;
  dispatchedCount: number;
  errorCount: number;
}

// API Functions

// AJUSTE 1 - Aprovar E disparar imediatamente (Modo Rápido)
export async function approveDraft(id: string) {
  const res = await fetchWithAuth(`/api/drafts/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return res.json();
}

// AJUSTE 1 - Apenas marcar como aprovado, SEM disparar (Modo Carga)
export async function markAsApproved(id: string) {
  const res = await fetchWithAuth(`/api/drafts/${id}/mark-approved`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function rejectDraft(id: string) {
  const res = await fetchWithAuth(`/api/drafts/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function sendToError(id: string, message?: string) {
  const res = await fetchWithAuth(`/api/drafts/${id}/error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message || '' }),
  });
  return res.json();
}

export async function updateDraft(id: string, data: Partial<PostDraft>) {
  const res = await fetchWithAuth(`/api/drafts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function dispatchBatch(batchId: string) {
  const res = await fetchWithAuth(`/api/batches/${batchId}/dispatch-approved`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return res.json();
}

// ==================== MERCADO LIVRE ====================

export interface MLRunResult {
  collected: number;
  insertedOffers: number;
  createdDrafts: number;
  skipped: number;
  errors: string[];
}

export async function runMercadoLivreCollection(options?: {
  mode?: 'keywords' | 'categories' | 'both';
  keywords?: string[];
  categories?: string[];
  maxItems?: number;
}): Promise<{ success: boolean; data?: MLRunResult; error?: string }> {
  const res = await fetch(`${API_URL}/api/sources/mercadolivre/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || { mode: 'both' }),
  });
  return res.json();
}

export async function getMercadoLivreConfig(): Promise<any> {
  const res = await fetch(`${API_URL}/api/sources/mercadolivre/config`);
  return res.json();
}

export async function updateMercadoLivreConfig(config: any): Promise<any> {
  const res = await fetch(`${API_URL}/api/sources/mercadolivre/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function getMercadoLivreStats(): Promise<any> {
  const res = await fetch(`${API_URL}/api/sources/mercadolivre/stats`);
  return res.json();
}

// ==================== TWITTER/X ====================

export async function postToXNow(offerId: string): Promise<{ success: boolean; tweetUrl?: string; error?: string }> {
  const res = await fetchWithAuth(`/api/twitter/post-offer/${offerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offerId }),
  });
  return res.json();
}

export async function getTwitterStatus(): Promise<{ configured: boolean; username?: string }> {
  const res = await fetchWithAuth('/api/twitter/status');
  return res.json();
}

// Criar draft para X (sem carga fixa)
export async function createDraftForX(offerId: string): Promise<{ success: boolean; data?: PostDraft; error?: string }> {
  const res = await fetchWithAuth(`/api/offers/${offerId}/create-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channels: ['TWITTER'],
      priority: 'HIGH',
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    return { success: false, error: json.message || json.error?.message || 'Erro ao criar draft' };
  }
  return { success: true, data: json.data };
}

// Publicar oferta no site
export async function publishToSite(offerId: string): Promise<{ success: boolean; siteUrl?: string; error?: string }> {
  const res = await fetchWithAuth(`/api/publications/from-offer/${offerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const json = await res.json();
  if (!res.ok) {
    return { success: false, error: json.message || json.error?.message || 'Erro ao publicar no site' };
  }
  return { success: true, siteUrl: json.siteUrl };
}

// Publicar draft no site
export async function publishDraftToSite(draftId: string): Promise<{ success: boolean; siteUrl?: string; error?: string }> {
  const res = await fetchWithAuth(`/api/publications/from-draft/${draftId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const json = await res.json();
  if (!res.ok) {
    return { success: false, error: json.message || json.error?.message || 'Erro ao publicar no site' };
  }
  return { success: true, siteUrl: json.siteUrl };
}

// Disparar todos os posts pendentes para o X
export interface DispatchAllToXResult {
  success: boolean;
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    draftId: string;
    offerId: string;
    success: boolean;
    tweetUrl?: string;
    error?: string;
  }>;
}

export async function dispatchAllPendingToX(draftIds: string[]): Promise<DispatchAllToXResult> {
  const results: DispatchAllToXResult['results'] = [];
  let sent = 0;
  let failed = 0;

  for (const draftId of draftIds) {
    try {
      // Buscar o draft para pegar o offerId
      const draftRes = await fetchWithAuth(`/api/drafts/${draftId}`);
      const draftData = await draftRes.json();
      const draft = draftData?.data || draftData;
      
      if (!draft?.offerId) {
        results.push({ draftId, offerId: '', success: false, error: 'Draft não encontrado' });
        failed++;
        continue;
      }

      // Postar no X
      const result = await postToXNow(draft.offerId);
      
      if (result.success) {
        // Atualizar status do draft para DISPATCHED
        await fetchWithAuth(`/api/drafts/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DISPATCHED' }),
        });
        
        results.push({ 
          draftId, 
          offerId: draft.offerId, 
          success: true, 
          tweetUrl: result.tweetUrl 
        });
        sent++;
      } else {
        // Marcar como erro
        await fetchWithAuth(`/api/drafts/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ERROR', errorMsg: result.error }),
        });
        
        results.push({ 
          draftId, 
          offerId: draft.offerId, 
          success: false, 
          error: result.error 
        });
        failed++;
      }

      // Delay entre posts para evitar rate limit do X (2 segundos)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error: any) {
      results.push({ draftId, offerId: '', success: false, error: error.message });
      failed++;
    }
  }

  return {
    success: failed === 0,
    total: draftIds.length,
    sent,
    failed,
    results,
  };
}
