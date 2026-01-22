/**
 * 🔥 Link Resolver Service
 * 
 * Resolve o link monetizado final para publicação.
 * 
 * Modos:
 * - DIRECT_PASTE: Usa affiliate_url colado manualmente
 * - TEMPLATE_APPEND: Constrói URL via template
 * - REDIRECTOR: Sempre usa /go/:offerId?src=:channel
 * 
 * REGRA: A IA NUNCA inventa link. Este serviço é a fonte da verdade.
 */

import { prisma } from '../lib/prisma.js';
import { Channel, AffiliateLinkMode } from '@prisma/client';

// ==================== TYPES ====================

export interface ResolvedLink {
  finalUrl: string;  // Link monetizado final (para redes sociais)
  goUrl: string;     // Link interno /go/:offerId?src=:channel (para tracking)
  linkMode: AffiliateLinkMode;
  needsManualUrl?: boolean; // Se true, precisa de affiliate_url manual
  error?: string;
}

export interface LinkResolverInput {
  offerId: string;
  channel: Channel;
  ownerAffiliateAccountId?: string;
}

// ==================== MAIN FUNCTION ====================

/**
 * 🔥 Resolve o link monetizado final para uma oferta + canal
 * 
 * Esta função é a ÚNICA fonte de verdade para links.
 * A IA e o copy engine DEVEM usar o retorno desta função.
 */
export async function resolveFinalUrl(input: LinkResolverInput): Promise<ResolvedLink> {
  const { offerId, channel, ownerAffiliateAccountId } = input;

  // Buscar oferta com dados de afiliados
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      affiliateProgram: true,
      ownerAffiliateAccount: true,
    },
  });

  if (!offer) {
    return {
      finalUrl: '',
      goUrl: '',
      linkMode: 'REDIRECTOR',
      error: 'OFFER_NOT_FOUND',
    };
  }

  // Base URL para /go
  const apiBaseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.promo.manu.com.br';
  const goUrl = `${apiBaseUrl}/go/${offerId}?src=${channel.toLowerCase()}`;

  // Determinar programa de afiliados
  const program = offer.affiliateProgram;
  const linkMode = program?.linkMode || 'REDIRECTOR';

  // Determinar conta de afiliado
  const accountId = ownerAffiliateAccountId || offer.ownerAffiliateAccountId;

  // ==================== DIRECT_PASTE ====================
  if (linkMode === 'DIRECT_PASTE') {
    // Exige affiliate_url colado manualmente
    if (!offer.affiliateUrl || offer.affiliateUrl.trim() === '') {
      return {
        finalUrl: '',
        goUrl,
        linkMode,
        needsManualUrl: true,
        error: 'NEEDS_AFFILIATE_LINK: Modo DIRECT_PASTE requer affiliate_url preenchido',
      };
    }

    return {
      finalUrl: offer.affiliateUrl,
      goUrl,
      linkMode,
    };
  }

  // ==================== TEMPLATE_APPEND ====================
  if (linkMode === 'TEMPLATE_APPEND') {
    // Buscar credencial do owner para o programa
    if (!accountId || !program) {
      return {
        finalUrl: offer.affiliateUrl || offer.productUrl || offer.canonicalUrl || '',
        goUrl,
        linkMode,
        error: 'NO_AFFILIATE_CONFIG: Sem credencial configurada',
      };
    }

    const credential = await prisma.affiliateCredential.findUnique({
      where: {
        accountId_programId: {
          accountId,
          programId: program.id,
        },
      },
    });

    if (!credential || !program.urlTemplate) {
      return {
        finalUrl: offer.affiliateUrl || offer.productUrl || offer.canonicalUrl || '',
        goUrl,
        linkMode,
        error: 'NO_TEMPLATE: Template de URL não configurado',
      };
    }

    // Construir URL via template
    const baseUrl = offer.canonicalUrl || offer.productUrl || offer.affiliateUrl || '';
    
    let finalUrl = program.urlTemplate
      .replace('{canonicalUrl}', encodeURIComponent(baseUrl))
      .replace('{affiliateTag}', credential.affiliateTag || '')
      .replace('{affiliateId}', credential.affiliateId || '')
      .replace('{channel}', channel.toLowerCase())
      .replace('{offerId}', offerId);

    return {
      finalUrl,
      goUrl,
      linkMode,
    };
  }

  // ==================== REDIRECTOR (DEFAULT) ====================
  // Usa o sistema interno /go para tracking
  // O /go redireciona para affiliate_url ou productUrl
  
  const finalUrl = offer.affiliateUrl || offer.productUrl || offer.canonicalUrl || '';

  if (!finalUrl) {
    return {
      finalUrl: '',
      goUrl,
      linkMode: 'REDIRECTOR',
      error: 'NO_URL: Nenhuma URL disponível para redirecionamento',
    };
  }

  return {
    finalUrl,
    goUrl,
    linkMode: 'REDIRECTOR',
  };
}

// ==================== BATCH RESOLVER ====================

/**
 * Resolve links para múltiplos canais de uma oferta
 */
export async function resolveAllChannelLinks(offerId: string): Promise<Record<string, ResolvedLink>> {
  const channels: Channel[] = ['TELEGRAM', 'WHATSAPP', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'SITE'];
  const results: Record<string, ResolvedLink> = {};

  for (const channel of channels) {
    results[channel] = await resolveFinalUrl({ offerId, channel });
  }

  return results;
}

// ==================== VALIDATION ====================

/**
 * Verifica se uma oferta tem todos os dados necessários para publicação
 */
export async function validateOfferForPublication(offerId: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      affiliateProgram: true,
      store: true,
      niche: true,
    },
  });

  if (!offer) {
    return { valid: false, errors: ['OFFER_NOT_FOUND'], warnings: [] };
  }

  // Verificar campos obrigatórios
  if (!offer.title || offer.title.trim().length < 5) {
    errors.push('INVALID_TITLE: Título muito curto ou ausente');
  }

  if (!offer.finalPrice || Number(offer.finalPrice) <= 0) {
    errors.push('INVALID_PRICE: Preço inválido');
  }

  // Verificar canonical_url
  if (!offer.canonicalUrl && !offer.productUrl && !offer.affiliateUrl) {
    errors.push('NO_URL: Nenhuma URL disponível');
  }

  // Verificar link mode
  const linkMode = offer.affiliateProgram?.linkMode || 'REDIRECTOR';
  
  if (linkMode === 'DIRECT_PASTE' && !offer.affiliateUrl) {
    errors.push('NEEDS_AFFILIATE_LINK: Modo DIRECT_PASTE requer affiliate_url');
  }

  // Verificar imagem (warning)
  if (!offer.imageUrl) {
    warnings.push('NO_IMAGE: Sem imagem (recomendado ter)');
  }

  // Verificar programa de afiliados (warning)
  if (!offer.affiliateProgramId) {
    warnings.push('NO_PROGRAM: Programa de afiliados não definido');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ==================== UPDATE PROMOTION CHANNEL ====================

/**
 * Atualiza um PromotionChannel com os links resolvidos
 */
export async function updatePromotionChannelLinks(
  promotionChannelId: string
): Promise<{ finalUrl: string; goUrl: string } | null> {
  const pc = await prisma.promotionChannel.findUnique({
    where: { id: promotionChannelId },
    include: {
      draft: {
        include: {
          offer: true,
        },
      },
    },
  });

  if (!pc || !pc.draft.offerId) {
    return null;
  }

  const resolved = await resolveFinalUrl({
    offerId: pc.draft.offerId,
    channel: pc.channel,
  });

  if (resolved.error) {
    console.warn(`[LinkResolver] Erro ao resolver link: ${resolved.error}`);
  }

  await prisma.promotionChannel.update({
    where: { id: promotionChannelId },
    data: {
      finalUrl: resolved.finalUrl,
      goUrl: resolved.goUrl,
    },
  });

  return {
    finalUrl: resolved.finalUrl,
    goUrl: resolved.goUrl,
  };
}

export default {
  resolveFinalUrl,
  resolveAllChannelLinks,
  validateOfferForPublication,
  updatePromotionChannelLinks,
};
