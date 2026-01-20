const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Fetcher para SWR com timeout
export const fetcher = async (url: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout

  try {
    const res = await fetch(`${API_URL}${url}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
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

export interface Offer {
  id: string;
  title: string;
  description?: string;
  originalPrice: number;
  finalPrice: number;
  discount: number;
  affiliateUrl: string;
  imageUrl?: string;
  niche: Niche;
  store: Store;
  urgency: 'HOJE' | 'ULTIMAS_UNIDADES' | 'LIMITADO' | 'NORMAL';
  expiresAt?: string;
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
  status: 'PENDING' | 'APPROVED' | 'DISPATCHED' | 'REJECTED' | 'ERROR';
  approvedAt?: string;
  createdAt: string;
  // AJUSTE 2 - Status por canal
  deliveries?: ChannelDelivery[];
  // AJUSTE 3 - Score de confiança da IA
  aiScore?: number;
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
  const res = await fetch(`${API_URL}/api/drafts/${id}/approve`, {
    method: 'POST',
  });
  return res.json();
}

// AJUSTE 1 - Apenas marcar como aprovado, SEM disparar (Modo Carga)
export async function markAsApproved(id: string) {
  const res = await fetch(`${API_URL}/api/drafts/${id}/mark-approved`, {
    method: 'POST',
  });
  return res.json();
}

export async function rejectDraft(id: string) {
  const res = await fetch(`${API_URL}/api/drafts/${id}/reject`, {
    method: 'POST',
  });
  return res.json();
}

export async function sendToError(id: string, message?: string) {
  const res = await fetch(`${API_URL}/api/drafts/${id}/error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

export async function updateDraft(id: string, data: Partial<PostDraft>) {
  const res = await fetch(`${API_URL}/api/drafts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function dispatchBatch(batchId: string) {
  const res = await fetch(`${API_URL}/api/batches/${batchId}/dispatch-approved`, {
    method: 'POST',
  });
  return res.json();
}
