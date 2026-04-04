import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../lib/auth.js';
import { isTwitterConfigured, postOfferToTwitter, postTweet, generateTweetText, postTweetWithImage } from '../services/twitter.js';
import { generateCopies } from '../services/aiCopyGenerator.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';

const HUMOR_PHRASES: Record<string, string[]> = {
  tv: [
    'Seu vizinho vai achar que você abriu um cinema 😂🍿',
    'Prepare a pipoca porque essa TV pede maratona 🍿😎',
    'Essa TV é tão boa que até o gato vai parar pra assistir 🐱📺',
  ],
  monitor: [
    'Seu setup vai ficar tão bonito que dá pra chorar 😭🖥️',
    'Produtividade ou game? Com esse monitor, os dois 🎮💼',
    'Seu chefe vai pensar que você trabalha melhor assim 😂🖥️',
  ],
  fone: [
    'Vizinho barulhento? Problema resolvido 😂🎧',
    'Você vai esquecer que o mundo existe 🎧✨',
    'Modo "não me perturbe" ativado automaticamente 😎🎶',
  ],
  celular: [
    'Seu celular antigo mandou dizer que aceita aposentadoria 😂📱',
    'Foto boa assim nem precisa de filtro 📸😎',
    'Bateria que dura mais que segunda-feira 🔋😂',
  ],
  notebook: [
    'Leve que nem papel, potente que nem foguete 🚀💻',
    'Home office com esse notebook é outra vida 😎💻',
    'Seu notebook atual acabou de pedir demissão 😂💻',
  ],
  game: [
    'Sua vida social pode sofrer efeitos colaterais 😂🎮',
    'Avisa a família que você vai sumir por uns dias 🎮😂',
    'Inimigo vai pedir desculpa quando ver esse setup 😎🕹️',
  ],
  cadeira: [
    'Sua coluna mandou dizer: "obrigada!" 😂🪑',
    'Conforto nível "não quero mais levantar" 🪑😎',
  ],
  cozinha: [
    'Chef Manu aprova essa oferta 👨‍🍳🔥',
    'Cozinhar com esse preço é receita de felicidade 😂🍳',
  ],
  esporte: [
    'Faltou motivação? Faltou era esse preço 😂💪',
    'Seu eu fitness agradece essa oferta 🏃‍♂️🔥',
  ],
  bebe: [
    'O bebê não entende o preço mas você sim 😂👶',
    'Papai/Mamãe esperto(a) economiza assim 👶💰',
  ],
  pet: [
    'Seu pet merece e seu bolso também 🐶😂',
    'Mimado com desconto é o melhor tipo de mimado 🐱💕',
  ],
  geral: [
    'Esse preço tá tão bom que parece bug 😂🔥',
    'Corre que daqui a pouco alguém acorda 😂⚡',
    'Promoção assim eu até acordo mais cedo 😴💰',
    'Preço bom assim dá vontade de comprar dois 😂🛒',
    'Se tá barato eu não julgo, eu compro 😂🛍️',
    'Minha carteira pediu pra eu não mostrar isso 😂💸',
    'Esse desconto deveria ser crime 🚨😂',
    'Quem disse que coisa boa não cai do céu? 😂🎁',
  ],
};

function pickHumorPhrase(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('tv') || t.includes('televisão') || t.includes('smart tv')) return pick(HUMOR_PHRASES.tv);
  if (t.includes('monitor')) return pick(HUMOR_PHRASES.monitor);
  if (t.includes('fone') || t.includes('headset') || t.includes('earphone') || t.includes('airpod')) return pick(HUMOR_PHRASES.fone);
  if (t.includes('celular') || t.includes('iphone') || t.includes('samsung galaxy') || t.includes('smartphone')) return pick(HUMOR_PHRASES.celular);
  if (t.includes('notebook') || t.includes('laptop') || t.includes('macbook')) return pick(HUMOR_PHRASES.notebook);
  if (t.includes('console') || t.includes('playstation') || t.includes('xbox') || t.includes('nintendo') || t.includes('jogo') || t.includes('game')) return pick(HUMOR_PHRASES.game);
  if (t.includes('cadeira') || t.includes('escritório')) return pick(HUMOR_PHRASES.cadeira);
  if (t.includes('air fryer') || t.includes('cafeteira') || t.includes('liquidificador') || t.includes('panela') || t.includes('fogão') || t.includes('geladeira')) return pick(HUMOR_PHRASES.cozinha);
  if (t.includes('tênis') || t.includes('bicicleta') || t.includes('esteira') || t.includes('halter')) return pick(HUMOR_PHRASES.esporte);
  if (t.includes('bebê') || t.includes('carrinho') || t.includes('berço') || t.includes('fralda')) return pick(HUMOR_PHRASES.bebe);
  if (t.includes('pet') || t.includes('ração') || t.includes('cachorro') || t.includes('gato')) return pick(HUMOR_PHRASES.pet);
  return pick(HUMOR_PHRASES.geral);
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function twitterRoutes(app: FastifyInstance) {
  /**
   * GET /api/twitter/status
   * Verifica se a API do Twitter está configurada
   */
  app.get('/status', { preHandler: [authGuard] }, async (request, reply) => {
    const configured = isTwitterConfigured();
    
    return {
      configured,
      message: configured 
        ? 'Twitter API configurada e pronta para uso'
        : 'Twitter API não configurada. Configure as variáveis de ambiente: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET',
    };
  });

  /**
   * GET /api/twitter/status-public
   * Verifica status (sem auth) - temporário para testes
   */
  app.get('/status-public', async (request, reply) => {
    const configured = isTwitterConfigured();
    return { configured };
  });

  /**
   * POST /api/twitter/test-post
   * Rota de teste SEM autenticação - REMOVER APÓS TESTES
   */
  app.post('/test-post', async (request, reply) => {
    const schema = z.object({
      text: z.string().min(1).max(280),
      secret: z.string(), // Segredo simples para evitar abusos
    });

    try {
      const { text, secret } = schema.parse(request.body);
      
      // Validação simples - troque por algo mais seguro se necessário
      if (secret !== 'promo2026') {
        return reply.status(403).send({ success: false, error: 'Invalid secret' });
      }
      
      const result = await postTweet(text);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      return {
        success: true,
        tweetId: result.tweetId,
        tweetUrl: result.tweetUrl,
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: 'Dados inválidos',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  /**
   * POST /api/twitter/post-agent
   * Rota para agentes (Manu/OpenClaw) postarem no X sem sessão de login.
   * Aceita produto direto do ml-browse com geração automática de humor.
   */
  app.post('/post-agent', async (request, reply) => {
    const schema = z.object({
      secret: z.string(),
      title: z.string().min(1),
      price: z.number().optional(),
      originalPrice: z.number().optional(),
      discountPercent: z.number().optional(),
      affiliateUrl: z.string().min(1),
      imageUrl: z.string().url().optional(),
      freeShipping: z.boolean().optional(),
      couponText: z.string().optional().nullable(),
      pixDiscount: z.number().optional().nullable(),
      pixPrice: z.number().optional().nullable(),
      installmentQty: z.number().optional().nullable(),
      installmentAmount: z.number().optional().nullable(),
      installmentNoInterest: z.boolean().optional(),
      installmentTotalPrice: z.number().optional().nullable(),
      customHumor: z.string().optional(),
    });

    try {
      const body = schema.parse(request.body);

      if (body.secret !== 'promo2026') {
        return reply.status(403).send({ success: false, error: 'Invalid secret' });
      }

      if (!isTwitterConfigured()) {
        return reply.status(500).send({ success: false, error: 'Twitter API não configurada' });
      }

      const humor = body.customHumor || pickHumorPhrase(body.title);

      const titleShort = body.title.length > 65
        ? body.title.substring(0, 62) + '...'
        : body.title;

      const parts: string[] = [];
      parts.push(humor);
      parts.push('');
      parts.push(titleShort);

      // Price line: "De R$629,80 por R$431,10 (-31% no Pix)"
      if (body.originalPrice && body.price && body.originalPrice > body.price) {
        const pct = body.pixDiscount || body.discountPercent || Math.round(((body.originalPrice - body.price) / body.originalPrice) * 100);
        const pixSuffix = body.pixDiscount ? ' no Pix' : '';
        parts.push(`De R$${body.originalPrice.toFixed(2)} por R$${body.price.toFixed(2)} (-${pct}%${pixSuffix})`);
      } else if (body.pixDiscount && body.pixPrice && body.originalPrice) {
        parts.push(`De R$${body.originalPrice.toFixed(2)} por R$${body.pixPrice.toFixed(2)} (-${body.pixDiscount}% no Pix)`);
      } else if (body.price) {
        parts.push(`Por R$${body.price.toFixed(2)}`);
      }

      // Installments line: "ou 9x de R$53,22 sem juros"
      if (body.installmentQty && body.installmentAmount) {
        const noInterest = body.installmentNoInterest ? ' sem juros' : '';
        parts.push(`ou ${body.installmentQty}x de R$${body.installmentAmount.toFixed(2)}${noInterest}`);
      }

      if (body.freeShipping) parts.push('Frete Grátis ✅');
      if (body.couponText) parts.push(`🏷️ ${body.couponText}`);

      parts.push('');
      parts.push(`👉 ${body.affiliateUrl}`);

      let tweetText = parts.join('\n');

      // Compact fallback if too long
      if (tweetText.length > 280) {
        const compact: string[] = [humor, '', titleShort.substring(0, 50) + '...'];
        if (body.price && body.originalPrice && body.originalPrice > body.price) {
          const pct = body.pixDiscount || body.discountPercent || 0;
          compact.push(`R$${body.price.toFixed(2)} (-${pct}%${body.pixDiscount ? ' Pix' : ''})`);
        } else if (body.price) {
          compact.push(`R$${body.price.toFixed(2)}`);
        }
        if (body.installmentQty && body.installmentAmount) {
          compact.push(`${body.installmentQty}x R$${body.installmentAmount.toFixed(2)} s/ juros`);
        }
        compact.push('', `👉 ${body.affiliateUrl}`);
        tweetText = compact.join('\n');
      }

      if (tweetText.length > 280) {
        tweetText = tweetText.substring(0, 277) + '...';
      }

      console.log(`[Twitter post-agent] Tweet (${tweetText.length} chars): ${tweetText.substring(0, 80)}...`);

      const result = body.imageUrl
        ? await postTweetWithImage(tweetText, body.imageUrl)
        : await postTweet(tweetText);

      if (!result.success) {
        return reply.status(400).send({ success: false, error: result.error });
      }

      return {
        success: true,
        tweetId: result.tweetId,
        tweetUrl: result.tweetUrl,
        tweetText,
        humorUsed: humor,
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ success: false, error: 'Dados inválidos', details: error.errors });
      }
      console.error('[Twitter post-agent] Erro:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/twitter/post
   * Posta um texto personalizado no Twitter
   */
  app.post('/post', { preHandler: [authGuard] }, async (request, reply) => {
    const schema = z.object({
      text: z.string().min(1).max(280),
      imageUrl: z.string().url().optional(),
    });

    try {
      const { text, imageUrl } = schema.parse(request.body);
      
      const result = imageUrl
        ? await postTweetWithImage(text, imageUrl)
        : await postTweet(text);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      return {
        success: true,
        tweetId: result.tweetId,
        tweetUrl: result.tweetUrl,
      };
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: 'Texto inválido',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  /**
   * POST /api/twitter/post-offer/:offerId
   * Posta uma oferta específica no Twitter
   */
  app.post('/post-offer/:offerId', { preHandler: [authGuard] }, async (request, reply) => {
    const { offerId } = request.params as { offerId: string };
    const body = (request.body as { paymentMethod?: string; installments?: number; installmentValue?: number; phraseMode?: string; customText?: string }) || {};
    const paymentMethod    = (body.paymentMethod || 'avista') as 'pix' | 'avista' | 'parcelado';
    const installments     = body.installments ?? 12;
    const installmentValue = body.installmentValue ?? undefined;
    const phraseMode       = (body.phraseMode === 'generic' || body.phraseMode === 'brand') ? body.phraseMode : undefined;
    const customText       = typeof body.customText === 'string' && body.customText.trim().length > 5 ? body.customText.trim() : undefined;

    // Buscar oferta
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        niche: { select: { name: true } },
        store: { select: { name: true } },
      },
    });

    if (!offer) {
      return reply.status(404).send({
        success: false,
        error: 'Oferta não encontrada',
      });
    }

    // Postar no Twitter
    const images = (offer as any).images || [];
    const mainImage = offer.imageUrl;
    
    console.log(`[Twitter] Preparando post: galeria=${images.length}, principal=${mainImage ? 'sim' : 'não'}, pagamento=${paymentMethod}, customText=${!!customText}`);

    let result;
    if (customText) {
      // Usa exatamente o texto do preview — não regera frase
      result = mainImage
        ? await postTweetWithImage(customText, mainImage)
        : await postTweet(customText);
    } else {
      result = await postOfferToTwitter({
        title: offer.title,
        originalPrice: offer.originalPrice ? Number(offer.originalPrice) : undefined,
        finalPrice: Number(offer.finalPrice),
        discount: offer.discountPct || undefined,
        affiliateUrl: offer.affiliateUrl || undefined,
        storeName: offer.store?.name,
        imageUrl: mainImage || undefined,
        images: images.length > 0 ? images : undefined,
        paymentMethod,
        installments,
        installmentValue,
        phraseMode,
        couponCode: (offer as any).couponCode || undefined,
      });
    }

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    // Registrar publicação para contagem nos cards
    try {
      await prisma.postHistory.create({
        data: {
          offerId,
          channel: 'TWITTER',
          humorStyle: 'NEUTRO',
          uniqueHash: `manual-TWITTER-${offerId}-${Date.now()}`,
          copyText: offer.title,
          externalId: result.tweetId || null,
        },
      });
    } catch (e) {
      console.error('[PostHistory/Twitter] Erro ao registrar publicação:', e);
    }

    // Nota: PublishedPost é exclusivo para o site (evita duplicatas na vitrine)

    return {
      success: true,
      tweetId: result.tweetId,
      tweetUrl: result.tweetUrl,
      message: 'Oferta postada no Twitter com sucesso!',
    };
  });

  /**
   * POST /api/twitter/post-draft/:draftId
   * Posta um draft aprovado no Twitter
   */
  app.post('/post-draft/:draftId', { preHandler: [authGuard] }, async (request, reply) => {
    const { draftId } = request.params as { draftId: string };

    // Buscar draft
    const draft = await prisma.postDraft.findUnique({
      where: { id: draftId },
      include: {
        offer: {
          include: {
            niche: { select: { name: true } },
            store: { select: { name: true } },
          },
        },
      },
    });

    if (!draft) {
      return reply.status(404).send({
        success: false,
        error: 'Draft não encontrado',
      });
    }

    if (!draft.offer) {
      return reply.status(400).send({
        success: false,
        error: 'Draft não possui oferta associada',
      });
    }

    // OBRIGATÓRIO: SEMPRE usar postOfferToTwitter que já tem toda a lógica correta
    // Isso garante que o texto seja gerado com frases personalizadas, preços, descontos, etc.
    const offer = draft.offer;
    const images = (offer as any).images || [];
    const mainImage = (draft as any).imageUrl || offer.imageUrl;
    
    console.log(`[Twitter post-draft] Preparando post: galeria=${images.length}, principal=${mainImage ? 'sim' : 'não'}`);
    console.log(`[Twitter post-draft] Oferta: ${offer.title.substring(0, 50)}`);
    console.log(`[Twitter post-draft] Preço: R$ ${Number(offer.finalPrice).toFixed(2)}`);
    console.log(`[Twitter post-draft] Desconto: ${offer.discountPct || 0}%`);

    // Usar postOfferToTwitter que já gera o texto completo com frases, preços, descontos
    const result = await postOfferToTwitter({
      title: offer.title,
      originalPrice: offer.originalPrice ? Number(offer.originalPrice) : undefined,
      finalPrice: Number(offer.finalPrice),
      discount: offer.discountPct || undefined,
      affiliateUrl: offer.affiliateUrl || undefined,
      storeName: offer.store?.name,
      imageUrl: mainImage || undefined,
      images: images.length > 0 ? images : undefined,
    });

    if (!result.success) {
      // Atualizar status do draft para erro
      await prisma.postDraft.update({
        where: { id: draftId },
        data: { status: 'ERROR' },
      });

      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    // Registrar delivery bem-sucedida
    await prisma.postDelivery.create({
      data: {
        draftId,
        channel: 'TWITTER',
        status: 'SENT',
        sentAt: new Date(),
        externalId: result.tweetId,
        payload: {
          tweetUrl: result.tweetUrl,
          text: 'Gerado automaticamente pelo sistema',
        },
      },
    });

    return {
      success: true,
      tweetId: result.tweetId,
      tweetUrl: result.tweetUrl,
      message: 'Draft postado no Twitter com sucesso!',
    };
  });

  /**
   * GET /api/twitter/preview/:offerId
   * Visualiza como ficará o tweet de uma oferta
   */
  app.get('/preview/:offerId', { preHandler: [authGuard] }, async (request, reply) => {
    const { offerId } = request.params as { offerId: string };
    const q = request.query as {
      paymentMethod?: string;
      installments?: string;
      installmentValue?: string;
      phraseMode?: string;
    };

    const paymentMethod    = (['pix','avista','parcelado'].includes(q.paymentMethod || '') ? q.paymentMethod : 'avista') as 'pix'|'avista'|'parcelado';
    const installments     = q.installments ? parseInt(q.installments) : 12;
    const installmentValue = q.installmentValue ? parseFloat(q.installmentValue) : undefined;
    const phraseMode       = (q.phraseMode === 'brand' || q.phraseMode === 'generic') ? q.phraseMode : undefined;

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: { store: { select: { name: true } } },
    });

    if (!offer) {
      return reply.status(404).send({ success: false, error: 'Oferta não encontrada' });
    }

    // Tentar gerar link oficial do ML se a URL salva é do ML
    let trackingUrl = offer.affiliateUrl || '';
    if (trackingUrl.includes('mercadolivre') && !trackingUrl.includes('meli.la') && !trackingUrl.includes('/social/')) {
      const { createOfficialAffiliateLink } = await import('../services/mlAffiliate.js');
      const official = await createOfficialAffiliateLink(trackingUrl);
      if (official?.shortUrl) {
        trackingUrl = official.shortUrl;
      }
    }

    const copies = generateCopies({
      title: offer.title,
      price: Number(offer.finalPrice),
      oldPrice: offer.originalPrice ? Number(offer.originalPrice) : null,
      discountPct: offer.discountPct ? Number(offer.discountPct) : 0,
      advertiserName: offer.store?.name,
      storeName: offer.store?.name,
      category: null,
      trackingUrl,
      paymentMethod,
      installments,
      installmentValue,
      phraseMode,
      couponCode: (offer as any).couponCode || undefined,
    });

    const tweetText = copies.x;
    return {
      success: true,
      preview: tweetText,
      length: tweetText.length,
      maxLength: 280,
      isValid: tweetText.length <= 280,
    };
  });
}
