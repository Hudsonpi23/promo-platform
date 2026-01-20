/**
 * Draft Dispatcher Service
 * 
 * Responsável por preparar e disparar drafts para os canais de divulgação.
 * Integra com o CopyEngine para gerar textos personalizados por canal.
 */

import { PrismaClient, PostDraft, PostDelivery, Channel, DeliveryStatus } from '@prisma/client';
import { buildCopy, buildCopyForChannels, validateForChannel, CopyResult, OfferInput, getDateSeed } from './copyEngine';

const prisma = new PrismaClient();

// ==================== TYPES ====================

interface DraftWithOffer extends PostDraft {
  offer: {
    id: string;
    title: string;
    originalPrice: any;
    finalPrice: any;
    discountPct: number;
    affiliateUrl: string;
    imageUrl: string | null;
    niche: { name: string };
    store: { name: string };
    urgency: 'HOJE' | 'ULTIMAS_UNIDADES' | 'LIMITADO' | 'NORMAL';
  };
}

interface DispatchResult {
  draftId: string;
  success: boolean;
  deliveries: {
    channel: Channel;
    status: DeliveryStatus;
    error?: string;
    payload?: CopyResult;
  }[];
  errors: string[];
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Prepara um draft para dispatch, gerando copies para cada canal
 * 
 * @param draftId - ID do draft
 * @returns Draft atualizado com copies geradas
 */
export async function prepareDraftForDispatch(draftId: string): Promise<DraftWithOffer> {
  // Buscar draft com offer completa
  const draft = await prisma.postDraft.findUnique({
    where: { id: draftId },
    include: {
      offer: {
        include: {
          niche: true,
          store: true,
        },
      },
    },
  }) as DraftWithOffer | null;

  if (!draft) {
    throw new Error(`Draft não encontrado: ${draftId}`);
  }

  // Converter para OfferInput
  const offerInput: OfferInput = {
    id: draft.offer.id,
    title: draft.offer.title,
    originalPrice: draft.offer.originalPrice ? Number(draft.offer.originalPrice) : undefined,
    finalPrice: Number(draft.offer.finalPrice),
    discountPct: draft.offer.discountPct,
    niche: draft.offer.niche.name,
    store: draft.offer.store.name,
    urgency: draft.offer.urgency,
    imageUrl: draft.offer.imageUrl,
    goCode: draft.id, // Usar draftId como goCode
  };

  // Gerar copies para todos os canais
  const channels = draft.channels as Channel[];
  const copies = buildCopyForChannels(offerInput, channels, {
    styleSeed: getDateSeed(),
  });

  // Verificar se algum canal exige imagem
  const requiresImage = channels.includes('TWITTER');

  // Atualizar draft com variantes e flag de imagem
  await prisma.postDraft.update({
    where: { id: draftId },
    data: {
      copyChannelVariants: copies as any,
      requiresImage,
      // Atualizar copyText com versão Telegram como padrão
      copyText: copies.TELEGRAM?.text || copies.SITE?.text || draft.copyText,
    },
  });

  return draft;
}

/**
 * Dispara um draft para todos os canais configurados
 * 
 * @param draftId - ID do draft
 * @returns Resultado do dispatch
 */
export async function dispatchDraft(draftId: string): Promise<DispatchResult> {
  const result: DispatchResult = {
    draftId,
    success: true,
    deliveries: [],
    errors: [],
  };

  // Buscar draft com offer
  const draft = await prisma.postDraft.findUnique({
    where: { id: draftId },
    include: {
      offer: {
        include: {
          niche: true,
          store: true,
        },
      },
      deliveries: true,
    },
  }) as (DraftWithOffer & { deliveries: PostDelivery[] }) | null;

  if (!draft) {
    result.success = false;
    result.errors.push(`Draft não encontrado: ${draftId}`);
    return result;
  }

  // Verificar status do draft
  if (draft.status !== 'APPROVED') {
    result.success = false;
    result.errors.push(`Draft não está aprovado: ${draft.status}`);
    return result;
  }

  // Converter para OfferInput
  const offerInput: OfferInput = {
    id: draft.offer.id,
    title: draft.offer.title,
    originalPrice: draft.offer.originalPrice ? Number(draft.offer.originalPrice) : undefined,
    finalPrice: Number(draft.offer.finalPrice),
    discountPct: draft.offer.discountPct,
    niche: draft.offer.niche.name,
    store: draft.offer.store.name,
    urgency: draft.offer.urgency,
    imageUrl: draft.offer.imageUrl,
    goCode: draft.id,
  };

  const channels = draft.channels as Channel[];

  // Processar cada canal
  for (const channel of channels) {
    // Validar se pode enviar para este canal
    const validation = validateForChannel(offerInput, channel);
    
    if (!validation.valid) {
      // Criar delivery com erro
      const delivery = await createOrUpdateDelivery(draftId, channel, {
        status: 'ERROR',
        errorMessage: validation.error,
      });

      result.deliveries.push({
        channel,
        status: 'ERROR',
        error: validation.error,
      });

      result.errors.push(`${channel}: ${validation.error}`);
      continue;
    }

    // Gerar copy para o canal
    const copy = buildCopy({
      offer: offerInput,
      channel,
      styleSeed: getDateSeed(),
    });

    if (copy.error) {
      // Copy não pode ser gerada
      const delivery = await createOrUpdateDelivery(draftId, channel, {
        status: 'ERROR',
        errorMessage: copy.error,
      });

      result.deliveries.push({
        channel,
        status: 'ERROR',
        error: copy.error,
        payload: copy,
      });

      result.errors.push(`${channel}: ${copy.error}`);
      continue;
    }

    // Criar delivery com payload (pronto para envio)
    const delivery = await createOrUpdateDelivery(draftId, channel, {
      status: 'PENDING',
      payload: {
        text: copy.text,
        headline: copy.headline,
        subcopy: copy.subcopy,
        link: `https://manupromocoes.com.br/go/${draft.id}`,
      },
    });

    result.deliveries.push({
      channel,
      status: 'PENDING',
      payload: copy,
    });
  }

  // Atualizar status do draft se houver erros em todos os canais
  const allFailed = result.deliveries.every(d => d.status === 'ERROR');
  if (allFailed && result.deliveries.length > 0) {
    await prisma.postDraft.update({
      where: { id: draftId },
      data: {
        status: 'ERROR',
        errorMsg: result.errors.join('; '),
      },
    });
    result.success = false;
  } else {
    // Atualizar para DISPATCHED se pelo menos um canal está pronto
    await prisma.postDraft.update({
      where: { id: draftId },
      data: { status: 'DISPATCHED' },
    });
  }

  return result;
}

/**
 * Cria ou atualiza um PostDelivery
 */
async function createOrUpdateDelivery(
  draftId: string,
  channel: Channel,
  data: {
    status: DeliveryStatus;
    payload?: any;
    errorMessage?: string;
    externalId?: string;
    sentAt?: Date;
  }
): Promise<PostDelivery> {
  return prisma.postDelivery.upsert({
    where: {
      draftId_channel: { draftId, channel },
    },
    create: {
      draftId,
      channel,
      status: data.status,
      payload: data.payload,
      errorMessage: data.errorMessage,
      externalId: data.externalId,
      sentAt: data.sentAt,
    },
    update: {
      status: data.status,
      payload: data.payload,
      errorMessage: data.errorMessage,
      externalId: data.externalId,
      sentAt: data.sentAt,
    },
  });
}

/**
 * Marca um delivery como enviado com sucesso
 */
export async function markDeliveryAsSent(
  draftId: string,
  channel: Channel,
  externalId?: string
): Promise<PostDelivery> {
  return createOrUpdateDelivery(draftId, channel, {
    status: 'SENT',
    externalId,
    sentAt: new Date(),
  });
}

/**
 * Marca um delivery como erro
 */
export async function markDeliveryAsError(
  draftId: string,
  channel: Channel,
  errorMessage: string
): Promise<PostDelivery> {
  const delivery = await createOrUpdateDelivery(draftId, channel, {
    status: 'ERROR',
    errorMessage,
  });

  // Incrementar retries
  await prisma.postDelivery.update({
    where: { id: delivery.id },
    data: { retries: { increment: 1 } },
  });

  return delivery;
}

/**
 * Obtém preview de copy para um canal específico
 * Útil para mostrar no painel antes de aprovar
 */
export async function getCopyPreview(
  draftId: string,
  channel: Channel
): Promise<CopyResult | null> {
  const draft = await prisma.postDraft.findUnique({
    where: { id: draftId },
    include: {
      offer: {
        include: {
          niche: true,
          store: true,
        },
      },
    },
  });

  if (!draft) return null;

  const offerInput: OfferInput = {
    id: draft.offer.id,
    title: draft.offer.title,
    originalPrice: draft.offer.originalPrice ? Number(draft.offer.originalPrice) : undefined,
    finalPrice: Number(draft.offer.finalPrice),
    discountPct: draft.offer.discountPct,
    niche: draft.offer.niche.name,
    store: draft.offer.store.name,
    urgency: draft.offer.urgency as any,
    imageUrl: draft.offer.imageUrl,
    goCode: draft.id,
  };

  return buildCopy({
    offer: offerInput,
    channel,
    styleSeed: getDateSeed(),
  });
}

/**
 * Verifica se draft pode ser enviado para Twitter
 * (tem imagem disponível)
 */
export async function canSendToTwitter(draftId: string): Promise<boolean> {
  const draft = await prisma.postDraft.findUnique({
    where: { id: draftId },
    include: { offer: true },
  });

  if (!draft) return false;
  return !!draft.offer.imageUrl;
}
