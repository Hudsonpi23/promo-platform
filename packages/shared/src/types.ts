// ==================== ENUMS ====================

export enum DraftStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DISPATCHED = 'DISPATCHED',
  REJECTED = 'REJECTED',
  ERROR = 'ERROR',
}

export enum BatchStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  DISPATCHED = 'DISPATCHED',
  COMPLETED = 'COMPLETED',
}

export enum Channel {
  TELEGRAM = 'TELEGRAM',
  WHATSAPP = 'WHATSAPP',
  FACEBOOK = 'FACEBOOK',
  SITE = 'SITE',
}

export enum Urgency {
  HOJE = 'HOJE',
  ULTIMAS_UNIDADES = 'ULTIMAS_UNIDADES',
  LIMITADO = 'LIMITADO',
  NORMAL = 'NORMAL',
}

export enum Priority {
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}

export enum DeliveryStatus {
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  ERROR = 'ERROR',
}

// ==================== INTERFACES ====================

export interface Niche {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  affiliateUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  title: string;
  description?: string;
  originalPrice: number;
  finalPrice: number;
  discount: number;
  affiliateUrl: string;
  shortUrl?: string;
  imageUrl?: string;
  nicheId: string;
  niche?: Niche;
  storeId: string;
  store?: Store;
  urgency: Urgency;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  scheduledTime: string; // "08:00", "11:00", etc
  date: string;
  status: BatchStatus;
  pendingCount: number;
  approvedCount: number;
  dispatchedCount: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostDraft {
  id: string;
  offerId: string;
  offer?: Offer;
  batchId: string;
  batch?: Batch;
  copyText: string;
  channels: Channel[];
  priority: Priority;
  status: DraftStatus;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
  published?: PostPublished;
}

export interface PostPublished {
  id: string;
  draftId: string;
  title: string;
  copyText: string;
  price: number;
  discount: number;
  affiliateUrl: string;
  niche: string;
  store: string;
  urgency: string;
  imageUrl?: string;
  isVisibleOnSite: boolean;
  publishedAt: string;
  deliveries?: PostDelivery[];
}

export interface PostDelivery {
  id: string;
  postId: string;
  channel: Channel;
  status: DeliveryStatus;
  sentAt?: string;
  externalId?: string;
  error?: string;
  retries: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelConfig {
  id: string;
  channel: Channel;
  name: string;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ErrorLog {
  id: string;
  draftId?: string;
  deliveryId?: string;
  errorType: string;
  message: string;
  details?: Record<string, unknown>;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

// ==================== API TYPES ====================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ApproveResponse {
  success: boolean;
  draftId: string;
  publishedId: string;
  channels: Channel[];
}

export interface DispatchBatchResponse {
  success: boolean;
  dispatched: number;
  totalJobs: number;
}

// ==================== FILTER TYPES ====================

export interface DraftFilters {
  batchId?: string;
  status?: DraftStatus;
  nicheId?: string;
  priority?: Priority;
  limit?: number;
}

export interface OfferFilters {
  nicheId?: string;
  storeId?: string;
  active?: boolean;
  limit?: number;
}

export interface PublicPostFilters {
  niche?: string;
  limit?: number;
  cursor?: string;
  sort?: 'recent' | 'discount' | 'hot';
}
