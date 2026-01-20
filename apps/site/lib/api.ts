const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ==================== TIPOS ====================

export interface PublicPost {
  id: string;
  slug?: string;
  goCode?: string;
  title: string;
  copyText?: string;   // Texto completo estilo Manu (para Telegram/WhatsApp)
  headline?: string;   // Headline curta para cards (ex: "Achado do dia")
  subcopy?: string;    // Subcopy com preço formatado
  price: number;
  originalPrice?: number | null;
  discount: number;
  affiliateUrl: string;
  niche: string;
  nicheSlug?: string;
  nicheIcon?: string;
  store: string;
  storeSlug?: string;
  urgency: 'HOJE' | 'ULTIMAS_UNIDADES' | 'LIMITADO' | 'NORMAL' | string;
  imageUrl?: string | null;
  publishedAt: string;
}

export interface Niche {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
}

export interface FeedResponse {
  items: PublicPost[];
  hasMore: boolean;
  total?: number;
  nextCursor?: string | null;
}

export interface NichePostsResponse {
  niche: Niche;
  posts: PublicPost[];
}

export interface HighlightItem {
  niche: Niche;
  post: PublicPost;
}

// ==================== FETCH WRAPPER ====================

async function apiFetch<T>(
  endpoint: string,
  options?: {
    revalidate?: number;
    cache?: RequestCache;
  }
): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      next: { revalidate: options?.revalidate ?? 30 },
      cache: options?.cache,
    });

    if (!res.ok) {
      console.error(`API Error: ${res.status} - ${endpoint}`);
      return null;
    }

    return res.json();
  } catch (error) {
    console.error(`Fetch error: ${endpoint}`, error);
    return null;
  }
}

// ==================== API FUNCTIONS ====================

// Buscar feed de posts públicos
export async function getPosts(options?: {
  niche?: string;
  q?: string;
  limit?: number;
  page?: number;
  cursor?: string;
  sort?: 'recent' | 'discount';
}): Promise<FeedResponse> {
  const params = new URLSearchParams();
  if (options?.niche) params.set('niche', options.niche);
  if (options?.q) params.set('q', options.q);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.page) params.set('page', options.page.toString());
  if (options?.cursor) params.set('cursor', options.cursor);
  if (options?.sort) params.set('sort', options.sort);

  const queryString = params.toString();
  const data = await apiFetch<FeedResponse>(
    `/public/posts${queryString ? `?${queryString}` : ''}`,
    { revalidate: 30 }
  );

  return data || { items: [], hasMore: false };
}

// Buscar feed público (endpoint alternativo)
export async function getFeed(options?: {
  nicheSlug?: string;
  q?: string;
  limit?: number;
  page?: number;
  sort?: 'recent' | 'discount';
}): Promise<FeedResponse> {
  const params = new URLSearchParams();
  if (options?.nicheSlug) params.set('nicheSlug', options.nicheSlug);
  if (options?.q) params.set('q', options.q);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.page) params.set('page', options.page.toString());
  if (options?.sort) params.set('sort', options.sort);

  const queryString = params.toString();
  const data = await apiFetch<FeedResponse>(
    `/public/feed${queryString ? `?${queryString}` : ''}`,
    { revalidate: 30 }
  );

  return data || { items: [], hasMore: false };
}

// Buscar post específico por ID ou slug
export async function getPost(idOrSlug: string): Promise<PublicPost | null> {
  return apiFetch<PublicPost>(`/public/posts/${idOrSlug}`, { revalidate: 60 });
}

// Buscar oferta por slug (alias)
export async function getOferta(slug: string): Promise<PublicPost | null> {
  return apiFetch<PublicPost>(`/public/oferta/${slug}`, { revalidate: 60 });
}

// Buscar lista de nichos
export async function getNiches(): Promise<Niche[]> {
  const data = await apiFetch<Niche[]>('/public/niches', { revalidate: 300 });
  return data || [];
}

// Buscar posts por nicho (slug)
export async function getPostsByNiche(
  slug: string,
  options?: { limit?: number }
): Promise<NichePostsResponse | null> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', options.limit.toString());

  const queryString = params.toString();
  return apiFetch<NichePostsResponse>(
    `/public/niches/${slug}/posts${queryString ? `?${queryString}` : ''}`,
    { revalidate: 60 }
  );
}

// Buscar destaques (um post de cada nicho)
export async function getHighlights(): Promise<HighlightItem[]> {
  const data = await apiFetch<HighlightItem[]>('/public/highlights', { revalidate: 60 });
  return data || [];
}

// ==================== HELPERS ====================

// Gerar URL do redirect /go
export function getGoUrl(post: PublicPost): string {
  const code = post.goCode || post.slug || post.id;
  // Usar a API base URL para o redirect
  return `${API_URL}/go/${code}`;
}

// Formatar moeda
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Badge de urgência
export function getUrgencyInfo(urgency: string): { text: string; color: string } | null {
  const badges: Record<string, { text: string; color: string }> = {
    HOJE: { text: '🔥 ACABA HOJE', color: 'bg-red-500' },
    ULTIMAS_UNIDADES: { text: '⚡ ÚLTIMAS UNIDADES', color: 'bg-amber-500' },
    LIMITADO: { text: '⏰ LIMITADO', color: 'bg-purple-500' },
  };
  return badges[urgency] || null;
}
