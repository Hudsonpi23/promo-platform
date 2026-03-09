/**
 * Video Publish Routes
 *
 * Recebe um vídeo (multipart) + dados do produto e publica no X (Twitter)
 * ou no Instagram via API.
 *
 * POST /api/video-publish/post-x
 * POST /api/video-publish/post-instagram
 */

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { authGuard } from '../lib/auth.js';
import { generateCopies } from '../services/aiCopyGenerator.js';
import { prisma } from '../lib/prisma.js';

const TWITTER_API_KEY              = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET           = process.env.TWITTER_API_SECRET || '';
const TWITTER_ACCESS_TOKEN         = process.env.TWITTER_ACCESS_TOKEN || '';
const TWITTER_ACCESS_TOKEN_SECRET  = process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

const INSTAGRAM_ACCESS_TOKEN       = process.env.INSTAGRAM_ACCESS_TOKEN || '';
const INSTAGRAM_BUSINESS_ID        = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '';

const SITE_URL = process.env.SITE_URL || 'https://www.manu-promocoes.com.br';
const TWITTER_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const TWITTER_TWEETS_URL = 'https://api.twitter.com/2/tweets';

// ── OAuth 1.0a helpers ────────────────────────────────────────────────────────
/**
 * Gera header OAuth 1.0a.
 * @param bodyParams - Parâmetros do body URL-encoded (incluídos na assinatura).
 *                     Não usar para multipart/form-data.
 */
function generateOAuthHeader(
  method: string,
  url: string,
  bodyParams: Record<string, string> = {},
): string {
  const ts    = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const oauthBase: Record<string, string> = {
    oauth_consumer_key:     TWITTER_API_KEY,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        ts,
    oauth_token:            TWITTER_ACCESS_TOKEN,
    oauth_version:          '1.0',
  };

  // Para POST URL-encoded: incluir body params na assinatura
  const allParams = { ...oauthBase, ...bodyParams };

  const sorted = Object.keys(allParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');

  const sigBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sorted)}`;
  const sigKey  = `${encodeURIComponent(TWITTER_API_SECRET)}&${encodeURIComponent(TWITTER_ACCESS_TOKEN_SECRET)}`;
  const sig     = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64');

  oauthBase.oauth_signature = sig;
  const headerParts = Object.keys(oauthBase).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthBase[k])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

// ── Twitter chunked video upload ──────────────────────────────────────────────
async function uploadVideoToTwitter(videoBuffer: Buffer, mimeType: string): Promise<string> {
  const totalBytes = videoBuffer.length;
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB por chunk

  // 1. INIT
  const initBody: Record<string, string> = {
    command:        'INIT',
    media_type:     mimeType,
    total_bytes:    totalBytes.toString(),
    media_category: 'tweet_video',
  };
  const initParams = new URLSearchParams(initBody);

  const initRes  = await fetch(TWITTER_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization:  generateOAuthHeader('POST', TWITTER_UPLOAD_URL, initBody),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: initParams.toString(),
  });

  const initData = await initRes.json() as { media_id_string?: string; error?: string };
  if (!initData.media_id_string) {
    throw new Error(`Twitter INIT falhou: ${JSON.stringify(initData)}`);
  }
  const mediaId = initData.media_id_string;

  // 2. APPEND (chunks)
  let segmentIndex = 0;
  for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
    const chunk = videoBuffer.subarray(offset, offset + CHUNK_SIZE);
    const form  = new FormData();
    form.append('command',        'APPEND');
    form.append('media_id',       mediaId);
    form.append('segment_index',  segmentIndex.toString());
    form.append('media',          new Blob([chunk], { type: mimeType }), 'chunk');

    const appendRes = await fetch(TWITTER_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: generateOAuthHeader('POST', TWITTER_UPLOAD_URL) },
      body: form,
    });

    if (appendRes.status !== 204 && appendRes.status !== 200) {
      const err = await appendRes.text();
      throw new Error(`Twitter APPEND falhou (segment ${segmentIndex}): ${err}`);
    }
    segmentIndex++;
  }

  // 3. FINALIZE
  const finalizeBody: Record<string, string> = { command: 'FINALIZE', media_id: mediaId };
  const finalizeParams = new URLSearchParams(finalizeBody);
  const finalizeRes = await fetch(TWITTER_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization:  generateOAuthHeader('POST', TWITTER_UPLOAD_URL, finalizeBody),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: finalizeParams.toString(),
  });

  const finalizeData = await finalizeRes.json() as { processing_info?: { state: string; check_after_secs?: number }; media_id_string?: string };

  // 4. STATUS poll (aguardar processamento se necessário)
  if (finalizeData.processing_info?.state === 'pending' || finalizeData.processing_info?.state === 'in_progress') {
    let waitSecs = finalizeData.processing_info.check_after_secs ?? 5;
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(r => setTimeout(r, waitSecs * 1000));

      const statusRes  = await fetch(
        `${TWITTER_UPLOAD_URL}?command=STATUS&media_id=${mediaId}`,
        { headers: { Authorization: generateOAuthHeader('GET', TWITTER_UPLOAD_URL) } }
      );
      const statusData = await statusRes.json() as { processing_info?: { state: string; check_after_secs?: number; error?: { message: string } } };

      if (statusData.processing_info?.state === 'succeeded') break;
      if (statusData.processing_info?.state === 'failed') {
        throw new Error(`Twitter: processamento do vídeo falhou — ${statusData.processing_info?.error?.message}`);
      }
      waitSecs = statusData.processing_info?.check_after_secs ?? 5;
    }
  }

  return mediaId;
}

// ── Format price ─────────────────────────────────────────────────────────────
function fmtPrice(v: number): string {
  const hasDecimals = v % 1 !== 0;
  return v.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function videoPublishRoutes(app: FastifyInstance) {

  /**
   * POST /api/video-publish/post-x
   *
   * Body: multipart/form-data
   *   - video       : File  (mp4, webm, mov — máx 512 MB)
   *   - title       : string
   *   - finalPrice  : number
   *   - originalPrice: number (opcional)
   *   - discountPct : number (opcional)
   *   - affiliateUrl: string
   *   - siteUrl     : string (opcional — URL do produto no site vitrine)
   */
  app.post('/post-x', { preHandler: [authGuard] }, async (request, reply) => {
    if (!TWITTER_API_KEY || !TWITTER_ACCESS_TOKEN) {
      return reply.status(503).send({ error: 'Twitter API não configurada no servidor.' });
    }

    let videoBuffer: Buffer | null = null;
    let videoMime = 'video/mp4';
    let title = '', affiliateUrl = '', siteUrl = SITE_URL, videoUrl = '';
    let finalPrice = 0, originalPrice = 0, discountPct = 0;
    let paymentMethod = 'avista';
    let installments = 12;

    // Parse multipart
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'video') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk as Buffer);
        videoBuffer = Buffer.concat(chunks);
        videoMime   = part.mimetype || 'video/mp4';
      } else if (part.type === 'field') {
        const val = part.value as string;
        if (part.fieldname === 'title')          title         = val;
        if (part.fieldname === 'affiliateUrl')   affiliateUrl  = val;
        if (part.fieldname === 'siteUrl')        siteUrl       = val || SITE_URL;
        if (part.fieldname === 'videoUrl')       videoUrl      = val;
        if (part.fieldname === 'finalPrice')     finalPrice    = parseFloat(val) || 0;
        if (part.fieldname === 'originalPrice')  originalPrice = parseFloat(val) || 0;
        if (part.fieldname === 'discountPct')    discountPct   = parseFloat(val) || 0;
        if (part.fieldname === 'paymentMethod')  paymentMethod = val || 'avista';
        if (part.fieldname === 'installments')   installments  = parseInt(val) || 12;
      }
    }

    // Se não chegou arquivo mas chegou URL, baixa o vídeo
    if ((!videoBuffer || videoBuffer.length === 0) && videoUrl) {
      try {
        console.log('[VideoPublish/post-x] Baixando vídeo via URL:', videoUrl.substring(0, 80));
        const dlRes = await fetch(videoUrl);
        if (!dlRes.ok) throw new Error(`HTTP ${dlRes.status} ao baixar vídeo`);
        const arrayBuf = await dlRes.arrayBuffer();
        videoBuffer = Buffer.from(arrayBuf);
        videoMime   = dlRes.headers.get('content-type') || 'video/mp4';
      } catch (dlErr: any) {
        return reply.status(400).send({ error: `Não foi possível baixar o vídeo da URL: ${dlErr.message}` });
      }
    }

    console.log('[VideoPublish/post-x] Dados recebidos:', { title, finalPrice, originalPrice, discountPct, affiliateUrl: affiliateUrl?.substring(0, 60) });

    if (!videoBuffer || videoBuffer.length === 0) {
      return reply.status(400).send({ error: 'Nenhum vídeo recebido. Faça upload de um arquivo ou informe um link válido.' });
    }
    if (!title || !affiliateUrl) {
      return reply.status(400).send({ error: 'Título e URL afiliada são obrigatórios.' });
    }
    if (finalPrice <= 0) {
      return reply.status(400).send({ error: 'Preço inválido (R$ 0). Verifique o campo "Preço atual" e tente novamente.' });
    }

    try {
      // 1. Gerar copy do post
      const copies = generateCopies({
        title,
        price:         finalPrice,
        oldPrice:      originalPrice > finalPrice ? originalPrice : null,
        discountPct,
        trackingUrl:   affiliateUrl,
        siteUrl,
        paymentMethod: paymentMethod as 'pix' | 'avista' | 'parcelado',
        installments,
      });
      const tweetText = copies.x;

      // 2. Upload do vídeo para o Twitter (chunked)
      console.log(`[VideoPublish] Iniciando upload do vídeo para Twitter (${Math.round(videoBuffer.length / 1024)} KB)`);
      const mediaId = await uploadVideoToTwitter(videoBuffer, videoMime);
      console.log(`[VideoPublish] Vídeo enviado ao Twitter, media_id: ${mediaId}`);

      // 3. Postar o tweet com o vídeo
      const authHeader = generateOAuthHeader('POST', TWITTER_TWEETS_URL);
      const tweetRes   = await fetch(TWITTER_TWEETS_URL, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: tweetText, media: { media_ids: [mediaId] } }),
      });

      const tweetData = await tweetRes.json() as { data?: { id: string }; detail?: string };

      if (!tweetRes.ok || !tweetData.data?.id) {
        return reply.status(500).send({ error: `Twitter: ${tweetData.detail || 'Erro ao postar tweet'}` });
      }

      // Registrar publicação de vídeo para métricas globais
      try {
        await prisma.postHistory.create({
          data: {
            offerId:    'video-standalone',
            channel:    'TWITTER',
            humorStyle: 'NEUTRO',
            uniqueHash: `manual-TWITTER-video-${Date.now()}`,
            copyText:   title,
            externalId: tweetData.data.id,
          },
        });
      } catch (e) {
        console.error('[PostHistory/VideoX] Erro ao registrar publicação:', e);
      }

      return reply.send({
        success:  true,
        tweetId:  tweetData.data.id,
        tweetUrl: `https://twitter.com/i/web/status/${tweetData.data.id}`,
        text:     tweetText,
      });

    } catch (err: any) {
      console.error('[VideoPublish/post-x]', err.message);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * POST /api/video-publish/post-instagram
   *
   * Body: multipart/form-data
   *   - video       : File  (mp4, mov)
   *   - title       : string
   *   - finalPrice  : number
   *   - originalPrice: number (opcional)
   *   - discountPct : number (opcional)
   *   - affiliateUrl: string
   *   - caption     : string (opcional — legenda customizada)
   *
   * Requer: INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_BUSINESS_ACCOUNT_ID
   *
   * Fluxo Instagram Graph API:
   *   1. Upload do vídeo para Cloudinary (URL pública necessária)
   *   2. Criar media container com a URL do vídeo
   *   3. Aguardar processamento
   *   4. Publicar
   */
  app.post('/post-instagram', { preHandler: [authGuard] }, async (request, reply) => {
    if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ID) {
      return reply.status(503).send({
        error: 'Instagram API não configurada. Adicione INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_BUSINESS_ACCOUNT_ID nas variáveis de ambiente.',
      });
    }

    let videoBuffer: Buffer | null = null;
    let videoMime = 'video/mp4';
    let title = '', affiliateUrl = '', caption = '', videoLinkUrl = '';
    let finalPrice = 0, originalPrice = 0, discountPct = 0;
    let igPaymentMethod = 'avista';
    let igInstallments = 12;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'video') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk as Buffer);
        videoBuffer = Buffer.concat(chunks);
        videoMime   = part.mimetype || 'video/mp4';
      } else if (part.type === 'field') {
        const val = part.value as string;
        if (part.fieldname === 'title')          title           = val;
        if (part.fieldname === 'affiliateUrl')   affiliateUrl    = val;
        if (part.fieldname === 'caption')        caption         = val;
        if (part.fieldname === 'videoUrl')       videoLinkUrl    = val;
        if (part.fieldname === 'finalPrice')     finalPrice      = parseFloat(val) || 0;
        if (part.fieldname === 'originalPrice')  originalPrice   = parseFloat(val) || 0;
        if (part.fieldname === 'discountPct')    discountPct     = parseFloat(val) || 0;
        if (part.fieldname === 'paymentMethod')  igPaymentMethod = val || 'avista';
        if (part.fieldname === 'installments')   igInstallments  = parseInt(val) || 12;
      }
    }

    // Se não chegou arquivo mas chegou URL, baixa o vídeo
    if ((!videoBuffer || videoBuffer.length === 0) && videoLinkUrl) {
      try {
        console.log('[VideoPublish/post-instagram] Baixando vídeo via URL:', videoLinkUrl.substring(0, 80));
        const dlRes = await fetch(videoLinkUrl);
        if (!dlRes.ok) throw new Error(`HTTP ${dlRes.status} ao baixar vídeo`);
        const arrayBuf = await dlRes.arrayBuffer();
        videoBuffer = Buffer.from(arrayBuf);
        videoMime   = dlRes.headers.get('content-type') || 'video/mp4';
      } catch (dlErr: any) {
        return reply.status(400).send({ error: `Não foi possível baixar o vídeo da URL: ${dlErr.message}` });
      }
    }

    console.log('[VideoPublish/post-instagram] Dados recebidos:', { title, finalPrice, originalPrice, discountPct, affiliateUrl: affiliateUrl?.substring(0, 60) });

    if (!videoBuffer || videoBuffer.length === 0) {
      return reply.status(400).send({ error: 'Nenhum vídeo recebido. Faça upload de um arquivo ou informe um link válido.' });
    }
    if (!title || !affiliateUrl) {
      return reply.status(400).send({ error: 'Título e URL afiliada são obrigatórios.' });
    }
    if (finalPrice <= 0) {
      return reply.status(400).send({ error: 'Preço inválido (R$ 0). Verifique o campo "Preço atual" e tente novamente.' });
    }

    try {
      // 1. Upload para Cloudinary para obter URL pública
      const { uploadFromBuffer } = await import('../services/cloudinary.js');
      const cloudRes = await uploadFromBuffer(videoBuffer, {
        folder: 'promo-platform/videos',
        tags:   ['video', 'instagram'],
      });

      if (!cloudRes.success || !cloudRes.url) {
        return reply.status(500).send({ error: `Falha no upload do vídeo: ${cloudRes.error}` });
      }

      const videoUrl = cloudRes.url.replace('/upload/', '/upload/vc_auto/').replace(/\.\w+$/, '.mp4');
      console.log(`[VideoPublish] Vídeo no Cloudinary: ${videoUrl}`);

      // 2. Gerar legenda
      const igPriceLabel = (() => {
        const fmtInst = igInstallments > 1 ? igInstallments : 12;
        const pm = igPaymentMethod as 'pix' | 'avista' | 'parcelado';
        if (pm === 'pix') return `por ${fmtPrice(finalPrice)} pelo PIX`;
        if (pm === 'parcelado') return `por ${fmtInst}x de ${fmtPrice(finalPrice / fmtInst)}`;
        return `por ${fmtPrice(finalPrice)}`;
      })();

      const instagramCaption = caption || [
        discountPct >= 30 ? `🔥 DESCONTO INCRÍVEL!` : `🛒 OFERTA DO DIA!`,
        ``,
        title,
        ``,
        originalPrice > finalPrice ? `De ${fmtPrice(originalPrice)}` : null,
        igPriceLabel,
        discountPct > 0
          ? (igPaymentMethod === 'pix' ? `🔥 -${discountPct}% DE DESCONTO NO PIX` : `🔥 -${discountPct}% DE DESCONTO`)
          : null,
        ``,
        `👉 Link na bio ou acesse:`,
        `🌐 ${SITE_URL}`,
        ``,
        `#promoção #desconto #oferta #economize`,
      ].filter(Boolean).join('\n');

      // 3. Criar container de mídia no Instagram
      const containerUrl = `https://graph.facebook.com/v19.0/${INSTAGRAM_BUSINESS_ID}/media`;
      const containerRes = await fetch(containerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type:   'REELS',
          video_url:    videoUrl,
          caption:      instagramCaption,
          access_token: INSTAGRAM_ACCESS_TOKEN,
        }),
      });

      const containerData = await containerRes.json() as { id?: string; error?: { message: string } };
      if (!containerData.id) {
        return reply.status(500).send({ error: `Instagram container: ${containerData.error?.message || 'Erro desconhecido'}` });
      }

      // 4. Aguardar processamento do vídeo pelo Instagram
      const containerId = containerData.id;
      let processed = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 6000));
        const statusRes  = await fetch(
          `https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${INSTAGRAM_ACCESS_TOKEN}`
        );
        const statusData = await statusRes.json() as { status_code?: string; status?: string };
        if (statusData.status_code === 'FINISHED') { processed = true; break; }
        if (statusData.status_code === 'ERROR')    throw new Error(`Instagram processamento falhou: ${statusData.status}`);
      }

      if (!processed) {
        return reply.status(500).send({ error: 'Instagram: timeout no processamento do vídeo.' });
      }

      // 5. Publicar
      const publishRes  = await fetch(`https://graph.facebook.com/v19.0/${INSTAGRAM_BUSINESS_ID}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerId, access_token: INSTAGRAM_ACCESS_TOKEN }),
      });
      const publishData = await publishRes.json() as { id?: string; error?: { message: string } };

      if (!publishData.id) {
        return reply.status(500).send({ error: `Instagram publish: ${publishData.error?.message || 'Erro desconhecido'}` });
      }

      // Registrar publicação de vídeo para métricas globais
      try {
        await prisma.postHistory.create({
          data: {
            offerId:    'video-standalone',
            channel:    'INSTAGRAM',
            humorStyle: 'NEUTRO',
            uniqueHash: `manual-INSTAGRAM-video-${Date.now()}`,
            copyText:   title,
            externalId: publishData.id,
          },
        });
      } catch (e) {
        console.error('[PostHistory/VideoInstagram] Erro ao registrar publicação:', e);
      }

      return reply.send({
        success:       true,
        instagramId:   publishData.id,
        instagramUrl:  `https://www.instagram.com/p/${publishData.id}/`,
        caption:       instagramCaption,
      });

    } catch (err: any) {
      console.error('[VideoPublish/post-instagram]', err.message);
      return reply.status(500).send({ error: err.message });
    }
  });
}
