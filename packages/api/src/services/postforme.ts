/**
 * Postfor.me API Client
 *
 * Publicação de conteúdo no Instagram via Postfor.me.
 * Documentação: https://www.postforme.dev/resources
 *
 * Endpoints usados:
 *   POST /v1/social-posts  → Criar post (carrossel, reel, imagem simples)
 *   GET  /v1/social-posts/:id → Status do post
 *   GET  /v1/social-accounts  → Contas conectadas
 */

const POSTFORME_API_URL = 'https://api.postforme.dev';
const POSTFORME_API_KEY = process.env.POSTFORME_API_KEY || '';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PostForMeMediaItem {
  url: string;
}

export interface PostForMeInstagramConfig {
  placement?: 'timeline' | 'reels' | 'stories';
  share_to_feed?: boolean;
}

export interface PostForMePlatformConfigurations {
  instagram?: PostForMeInstagramConfig & {
    media?: PostForMeMediaItem[];
  };
}

export interface CreateSocialPostParams {
  caption: string;
  social_accounts: string[];
  media: PostForMeMediaItem[];
  platform_configurations?: PostForMePlatformConfigurations;
  scheduled_at?: string; // ISO 8601
  external_id?: string;
}

export interface PostForMePostResponse {
  id: string;
  status: 'pending' | 'published' | 'failed' | 'scheduled';
  created_at: string;
  social_posts?: Array<{
    id: string;
    platform: string;
    status: string;
    url?: string;
    error?: string;
  }>;
}

export interface PostForMeAccount {
  id: string;
  platform: string;
  name: string;
  username?: string;
  profile_picture_url?: string;
  connected_at: string;
}

// ── API Helpers ────────────────────────────────────────────────────────────────

async function postformeRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: object,
): Promise<T> {
  const apiKey = POSTFORME_API_KEY;

  if (!apiKey) {
    throw new Error('POSTFORME_API_KEY não configurada');
  }

  const res = await fetch(`${POSTFORME_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json() as any;

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Postfor.me API error: ${msg}`);
  }

  return data as T;
}

// ── Publicar Carrossel ─────────────────────────────────────────────────────────

export interface PublishCarouselParams {
  caption: string;
  slideUrls: string[];
  instagramAccountId: string;
  offerId?: string;
  scheduledAt?: Date;
}

export interface PublishCarouselResult {
  success: boolean;
  postId?: string;
  status?: string;
  error?: string;
}

export async function publishCarousel(params: PublishCarouselParams): Promise<PublishCarouselResult> {
  try {
    if (!params.slideUrls || params.slideUrls.length < 2) {
      return { success: false, error: 'Carrossel precisa de pelo menos 2 slides' };
    }

    const media: PostForMeMediaItem[] = params.slideUrls.map(url => ({ url }));

    const payload: CreateSocialPostParams = {
      caption: params.caption,
      social_accounts: [params.instagramAccountId],
      media,
      ...(params.offerId && { external_id: params.offerId }),
      ...(params.scheduledAt && { scheduled_at: params.scheduledAt.toISOString() }),
    };

    console.log(`[Postfor.me] Publicando carrossel com ${media.length} slides...`);

    const response = await postformeRequest<PostForMePostResponse>('POST', '/v1/social-posts', payload);

    console.log(`[Postfor.me] ✅ Post criado: ${response.id} (status: ${response.status})`);

    return {
      success: true,
      postId: response.id,
      status: response.status,
    };
  } catch (err: any) {
    console.error('[Postfor.me] Erro:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Publicar Vídeo (Reel) ──────────────────────────────────────────────────────

export interface PublishReelParams {
  caption: string;
  videoUrl: string;
  instagramAccountId: string;
  shareToFeed?: boolean;
  offerId?: string;
  scheduledAt?: Date;
}

export async function publishReel(params: PublishReelParams): Promise<PublishCarouselResult> {
  try {
    const payload: CreateSocialPostParams = {
      caption: params.caption,
      social_accounts: [params.instagramAccountId],
      media: [{ url: params.videoUrl }],
      platform_configurations: {
        instagram: {
          placement: 'reels',
          share_to_feed: params.shareToFeed ?? true,
        },
      },
      ...(params.offerId && { external_id: params.offerId }),
      ...(params.scheduledAt && { scheduled_at: params.scheduledAt.toISOString() }),
    };

    console.log(`[Postfor.me] Publicando Reel...`);

    const response = await postformeRequest<PostForMePostResponse>('POST', '/v1/social-posts', payload);

    console.log(`[Postfor.me] ✅ Reel criado: ${response.id} (status: ${response.status})`);

    return {
      success: true,
      postId: response.id,
      status: response.status,
    };
  } catch (err: any) {
    console.error('[Postfor.me] Erro no Reel:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Publicar Story ─────────────────────────────────────────────────────────────

export interface PublishStoryParams {
  mediaUrl: string;
  caption?: string;
  instagramAccountId: string;
}

export async function publishStory(params: PublishStoryParams): Promise<PublishCarouselResult> {
  try {
    if (!params.mediaUrl) {
      return { success: false, error: 'URL da mídia obrigatória para Story' };
    }

    const payload: CreateSocialPostParams = {
      caption: params.caption || '',
      social_accounts: [params.instagramAccountId],
      media: [{ url: params.mediaUrl }],
      platform_configurations: {
        instagram: {
          placement: 'stories',
        },
      },
    };

    console.log('[Postfor.me] Publicando Story...');
    const response = await postformeRequest<PostForMePostResponse>('POST', '/v1/social-posts', payload);
    console.log(`[Postfor.me] ✅ Story criado: ${response.id} (status: ${response.status})`);

    return { success: true, postId: response.id, status: response.status };
  } catch (err: any) {
    console.error('[Postfor.me] Erro no Story:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Status de Post ─────────────────────────────────────────────────────────────

export async function getPostStatus(postId: string): Promise<PostForMePostResponse | null> {
  try {
    return await postformeRequest<PostForMePostResponse>('GET', `/v1/social-posts/${postId}`);
  } catch (err: any) {
    console.error('[Postfor.me] Erro ao buscar status:', err.message);
    return null;
  }
}

// ── Listar Contas Conectadas ───────────────────────────────────────────────────

export async function listConnectedAccounts(): Promise<PostForMeAccount[]> {
  try {
    const response = await postformeRequest<{ data: PostForMeAccount[] }>('GET', '/v1/social-accounts');
    return response.data || [];
  } catch (err: any) {
    console.error('[Postfor.me] Erro ao listar contas:', err.message);
    return [];
  }
}

// ── Gerar Caption para Instagram ───────────────────────────────────────────────

export function generateInstagramCaption(params: {
  title: string;
  finalPrice: number;
  originalPrice?: number | null;
  discountPct?: number | null;
  installments?: number | null;
  installmentValue?: number | null;
  paymentMethod?: 'pix' | 'parcelado' | 'normal' | null;
  affiliateUrl?: string;
  nicheName?: string;
  couponCode?: string | null;
  couponType?: 'percent' | 'fixed' | null;
  couponDiscountPct?: number | null;
  couponFixedValue?: number | null;
  couponMaxSavings?: number | null;
}): string {
  const { title, finalPrice, originalPrice, discountPct, installments, installmentValue, paymentMethod, affiliateUrl, nicheName, couponCode, couponType, couponDiscountPct, couponFixedValue, couponMaxSavings } = params;

  const formatBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: v % 1 !== 0 ? 2 : 0 });

  let lines: string[] = [];

  // Título
  const shortTitle = title.length > 80 ? title.slice(0, 77) + '...' : title;
  lines.push(`🛍️ ${shortTitle}`);
  lines.push('');

  // Desconto + preço (com ou sem cupom)
  const resolvedCouponType = couponType ?? 'percent';
  const hasCoupon = !!(
    couponCode && (
      (resolvedCouponType === 'percent' && couponDiscountPct && couponDiscountPct > 0) ||
      (resolvedCouponType === 'fixed'   && couponFixedValue  && couponFixedValue  > 0)
    )
  );

  if (hasCoupon) {
    const { calculateWithCoupon } = require('./couponCalculator.js');
    const couponResult = calculateWithCoupon({
      originalPrice: originalPrice ?? finalPrice,
      adDiscountPct: discountPct ?? 0,
      // finalPrice já é o preço com desconto do anúncio — cupom se aplica sobre ele
      priceBeforeCoupon: finalPrice,
      couponCode: couponCode!,
      couponType: resolvedCouponType,
      couponDiscountPct: couponDiscountPct ?? null,
      couponFixedValue: couponFixedValue ?? null,
      couponMaxSavings: couponMaxSavings ?? null,
    });
    lines.push(`🔥 De ${formatBRL(originalPrice ?? finalPrice)} por ${formatBRL(couponResult.finalPrice)} (${couponResult.totalDiscountPct}% OFF real com cupom)`);
    lines.push('');
    if (resolvedCouponType === 'fixed') {
      lines.push(`🎟️ Cupom: ${couponCode!.toUpperCase()} — ${formatBRL(couponFixedValue!)} de desconto`);
    } else {
      lines.push(`🎟️ Use o cupom: ${couponCode!.toUpperCase()} (${couponDiscountPct}% OFF)`);
      if (couponResult.couponWasCapped) {
        lines.push(`   ⚠️ Cupom limitado a ${formatBRL(couponMaxSavings!)}`);
      }
    }
  } else if (discountPct && discountPct > 0 && originalPrice && originalPrice > finalPrice) {
    lines.push(`🔥 De ${formatBRL(originalPrice)} por apenas ${formatBRL(finalPrice)} (-${discountPct}% OFF)`);
  } else {
    lines.push(`💰 Por apenas ${formatBRL(finalPrice)}`);
  }

  // Pagamento
  if (paymentMethod === 'pix') {
    lines.push(`💳 Preço no PIX`);
  } else if (paymentMethod === 'parcelado' && installments) {
    const val = installmentValue ?? finalPrice / installments;
    lines.push(`💳 Ou ${installments}x de ${formatBRL(val)} sem juros`);
  }

  lines.push('');
  lines.push('🔗 Link na bio para pegar a oferta!');
  lines.push('');

  // Hashtags por nicho
  const baseHashtags = '#promocoes #oferta #desconto #compraonline #economize';
  const nicheHashtags: Record<string, string> = {
    eletronicos: '#tech #eletronicos #gadgets #smartphone',
    moda: '#moda #fashion #roupas #looks',
    casa: '#casa #decoracao #utilidades',
    beleza: '#beleza #skincare #makeup #cosmeticos',
    pets: '#pets #petshop #cachorros #gatos',
    games: '#games #gamer #videogame',
    esportes: '#esportes #fitness #academia',
    livros: '#livros #leitura #literatura',
    mercado: '#supermercado #alimentacao',
    bebe: '#bebe #maternidade #criancas',
  };

  const nicheSlug = nicheName?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
  const extra = Object.entries(nicheHashtags).find(([k]) => nicheSlug.includes(k))?.[1] || '';

  lines.push(`${baseHashtags} ${extra}`.trim());
  lines.push('#manupromocoes #manudaspromocoes');

  return lines.join('\n');
}
