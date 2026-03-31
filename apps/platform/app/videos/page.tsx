'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────
interface ProductData {
  title:         string;
  finalPrice:    number;
  originalPrice: number | null;
  discountPct:   number;
  mainImage:     string | null;
  affiliateUrl:  string;
}

// ── Price formatter ────────────────────────────────────────────────────────
function fmtPrice(v?: number | null): string {
  if (!v) return '—';
  const hasDecimals = v % 1 !== 0;
  return v.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

type PaymentMethod = 'pix' | 'avista' | 'parcelado';

function paymentLabel(method: PaymentMethod, price: number, installments: number): string {
  if (method === 'pix') return `por ${fmtPrice(price)} pelo PIX`;
  if (method === 'parcelado') {
    const n = Math.max(2, Math.min(12, installments));
    return `por ${n}x de ${fmtPrice(price / n)}`;
  }
  return `por ${fmtPrice(price)}`;
}

// ── Instagram caption ──────────────────────────────────────────────────────
function buildCaption(
  p: ProductData,
  method: PaymentMethod = 'avista',
  installments: number = 12,
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.manu-promocoes.com.br';
  return [
    p.discountPct >= 30 ? '🔥 DESCONTO INCRÍVEL!' : '🛒 OFERTA DO DIA!',
    '',
    p.title,
    '',
    p.originalPrice && p.originalPrice > p.finalPrice ? `De ${fmtPrice(p.originalPrice)}` : null,
    paymentLabel(method, p.finalPrice, installments),
    p.discountPct > 0 ? `🔥 -${p.discountPct}% DE DESCONTO` : null,
    '',
    '👉 Link na bio ou acesse:',
    `🌐 ${siteUrl}`,
    '',
    '#promoção #desconto #oferta #economize #compras',
  ].filter(l => l !== null).join('\n');
}

// ── Component ──────────────────────────────────────────────────────────────
export default function VideosPage() {
  // Aba activa: 'url' = extrair URL | 'manual' = preencher manualmente
  const [activeTab, setActiveTab]   = useState<'url' | 'manual'>('url');

  // URL scraping
  const [url, setUrl]               = useState('');
  const [scraping, setScraping]     = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [product, setProduct]       = useState<ProductData | null>(null);

  // Manual fields
  const [manualTitle, setManualTitle]         = useState('');
  const [manualPrice, setManualPrice]         = useState('');
  const [manualOldPrice, setManualOldPrice]   = useState('');
  const [manualDiscount, setManualDiscount]   = useState('');
  const [manualAffUrl, setManualAffUrl]       = useState('');

  // Video
  const [videoMode, setVideoMode]       = useState<'file' | 'link'>('file');
  const [videoFile, setVideoFile]       = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [dragOver, setDragOver]         = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // Upload por link
  const [videoLinkInput, setVideoLinkInput]   = useState('');
  const [videoLinkReady, setVideoLinkReady]   = useState(false);
  const [loadingLink, setLoadingLink]         = useState(false);
  const [videoLinkError, setVideoLinkError]   = useState('');

  // Forma de pagamento
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('avista');
  const [installments, setInstallments]   = useState(12);

  // Posting state
  const [postingX, setPostingX]     = useState(false);
  const [postingIg, setPostingIg]   = useState(false);
  const [xResult, setXResult]       = useState<{ url?: string; error?: string } | null>(null);
  const [igResult, setIgResult]     = useState<{ url?: string; error?: string } | null>(null);
  const [copied, setCopied]         = useState(false);

  // ── Stories ──────────────────────────────────────────────────────────────
  const [storyType, setStoryType]           = useState<'video' | 'image'>('video');
  const [storyImageFile, setStoryImageFile] = useState<File | null>(null);
  const [storyImagePreview, setStoryImagePreview] = useState('');
  const [storyCaption, setStoryCaption]     = useState('');
  const [postingStory, setPostingStory]     = useState(false);
  const [storyResult, setStoryResult]       = useState<{ url?: string; error?: string } | null>(null);
  const [storyDragOver, setStoryDragOver]   = useState(false);
  const storyImageRef = useRef<HTMLInputElement>(null);

  // ── Share to Instagram ────────────────────────────────────────────────
  const [isMobile, setIsMobile]         = useState(false);
  const [sharing, setSharing]           = useState(false);
  const [shareStatus, setShareStatus]   = useState<'idle' | 'shared' | 'error' | 'unsupported'>('idle');
  const [shareDownloadUrl, setShareDownloadUrl] = useState('');

  // Remove "R$", espaços e pontos de milhar antes de parsear
  const parsePrice = (v: string) =>
    parseFloat(v.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()) || 0;

  // ── Effective product data (scraped or manual) ────────────────────────
  const effectiveProduct: ProductData | null = product ?? (
    manualTitle && manualPrice ? {
      title:         manualTitle,
      finalPrice:    parsePrice(manualPrice),
      originalPrice: manualOldPrice ? parsePrice(manualOldPrice) : null,
      discountPct:   parseInt(manualDiscount) || 0,
      mainImage:     null,
      affiliateUrl:  manualAffUrl || url,
    } : null
  );

  // ── Scrape ───────────────────────────────────────────────────────────────
  const handleScrape = useCallback(async () => {
    if (!url.trim()) return;
    setScraping(true);
    setScrapeError('');
    setProduct(null);
    setXResult(null);
    setIgResult(null);

    try {
      const res  = await fetchWithAuth('/api/auto-publish/scrape', {
        method: 'POST',
        body:   JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setScrapeError(data.error || 'Não foi possível extrair os dados. Use o preenchimento manual.');
        setManualAffUrl(url.trim());
      } else {
        setProduct(data);
      }
    } catch (err: any) {
      setScrapeError(`Erro de conexão: ${err.message}. Use o preenchimento manual.`);
    } finally {
      setScraping(false);
    }
  }, [url]);

  // ── Handle video file ────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Selecione um arquivo de vídeo (mp4, webm, mov, etc.)');
      return;
    }
    if (file.size > 512 * 1024 * 1024) {
      alert('Vídeo muito grande (máx. 512 MB).');
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setXResult(null);
    setIgResult(null);
  }, []);

  // ── Load video from URL ──────────────────────────────────────────────────
  const handleVideoLink = useCallback(async () => {
    const link = videoLinkInput.trim();
    if (!link) return;
    setLoadingLink(true);
    setVideoLinkError('');
    setVideoFile(null);
    setVideoPreview('');
    setXResult(null);
    setIgResult(null);
    try {
      // Tenta baixar o vídeo como blob (funciona para URLs diretas sem CORS)
      const res = await fetch(link);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob.type.startsWith('video/')) throw new Error('URL não aponta para um vídeo válido.');
      const filename = link.split('/').pop()?.split('?')[0] || 'video.mp4';
      const file = new File([blob], filename, { type: blob.type });
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(blob));
      setVideoLinkReady(true);
    } catch {
      // Se CORS ou download falhar, usa a URL diretamente (backend vai baixar)
      setVideoPreview(link);
      setVideoLinkReady(true);
    } finally {
      setLoadingLink(false);
    }
  }, [videoLinkInput]);

  // ── Post to X ────────────────────────────────────────────────────────────
  const hasVideo = !!videoFile || videoLinkReady;

  const handlePostX = useCallback(async () => {
    if (!hasVideo || !effectiveProduct) return;
    setPostingX(true);
    setXResult(null);

    // Campos de texto ANTES do arquivo — evita perda de dados em streams multipart grandes
    const form = new FormData();
    form.append('title',         effectiveProduct.title);
    form.append('finalPrice',    effectiveProduct.finalPrice.toString());
    form.append('originalPrice', (effectiveProduct.originalPrice ?? 0).toString());
    form.append('discountPct',   effectiveProduct.discountPct.toString());
    form.append('affiliateUrl',   effectiveProduct.affiliateUrl);
    form.append('paymentMethod',  paymentMethod);
    form.append('installments',   installments.toString());
    if (videoFile) {
      form.append('video', videoFile);
    } else {
      form.append('videoUrl', videoLinkInput.trim());
    }

    try {
      const res  = await fetchWithAuth('/api/video-publish/post-x', { method: 'POST', body: form });
      const data = await res.json();
      setXResult(res.ok ? { url: data.tweetUrl } : { error: data.error || 'Erro ao postar no X.' });
    } catch (err: any) {
      setXResult({ error: err.message });
    } finally {
      setPostingX(false);
    }
  }, [hasVideo, videoFile, videoLinkInput, effectiveProduct, paymentMethod, installments]);

  // ── Post to Instagram ────────────────────────────────────────────────────
  const handlePostInstagram = useCallback(async () => {
    if (!hasVideo || !effectiveProduct) return;
    setPostingIg(true);
    setIgResult(null);

    // Campos de texto ANTES do arquivo — evita perda de dados em streams multipart grandes
    const form = new FormData();
    form.append('title',         effectiveProduct.title);
    form.append('finalPrice',    effectiveProduct.finalPrice.toString());
    form.append('originalPrice', (effectiveProduct.originalPrice ?? 0).toString());
    form.append('discountPct',   effectiveProduct.discountPct.toString());
    form.append('affiliateUrl',   effectiveProduct.affiliateUrl);
    form.append('caption',        buildCaption(effectiveProduct, paymentMethod, installments));
    form.append('paymentMethod',  paymentMethod);
    form.append('installments',   installments.toString());
    if (videoFile) {
      form.append('video', videoFile);
    } else {
      form.append('videoUrl', videoLinkInput.trim());
    }

    try {
      const res  = await fetchWithAuth('/api/video-publish/post-instagram', { method: 'POST', body: form });
      const data = await res.json();
      setIgResult(res.ok ? { url: data.instagramUrl } : { error: data.error || 'Erro ao postar no Instagram.' });
    } catch (err: any) {
      setIgResult({ error: err.message });
    } finally {
      setPostingIg(false);
    }
  }, [hasVideo, videoFile, videoLinkInput, effectiveProduct, paymentMethod, installments]);

  // ── Handle story image ───────────────────────────────────────────────────
  const handleStoryImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      alert('Imagem muito grande (máx. 30 MB).');
      return;
    }
    setStoryImageFile(file);
    setStoryImagePreview(URL.createObjectURL(file));
    setStoryResult(null);
  }, []);

  // Detecta se é dispositivo móvel
  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Auto-fill caption when product is loaded
  useEffect(() => {
    if (effectiveProduct) {
      const price = fmtPrice(effectiveProduct.finalPrice);
      const discount = effectiveProduct.discountPct > 0 ? ` (-${effectiveProduct.discountPct}%)` : '';
      setStoryCaption(`🔥 ${effectiveProduct.title.slice(0, 80)}\n💰 ${price}${discount}\n👉 Link na bio!`);
    }
  }, [effectiveProduct]);

  // ── Post Story ───────────────────────────────────────────────────────────
  const handlePostStory = useCallback(async () => {
    if (storyType === 'image' && !storyImageFile) {
      alert('Adicione uma imagem para o Story');
      return;
    }
    if (storyType === 'video' && !hasVideo) {
      alert('Faça upload de um vídeo primeiro');
      return;
    }

    setPostingStory(true);
    setStoryResult(null);

    const form = new FormData();

    if (storyType === 'video') {
      if (videoFile) {
        form.append('media', videoFile);
      } else {
        form.append('mediaUrl', videoLinkInput.trim());
      }
      form.append('mediaType', 'video');
    } else {
      form.append('media', storyImageFile!);
      form.append('mediaType', 'image');
    }

    if (storyCaption.trim()) form.append('caption', storyCaption.trim());

    try {
      const res  = await fetchWithAuth('/api/instagram/publish-story', { method: 'POST', body: form });
      const data = await res.json();
      setStoryResult(res.ok ? { url: data.postId } : { error: data.error || 'Erro ao publicar Story' });
    } catch (err: any) {
      setStoryResult({ error: err.message });
    } finally {
      setPostingStory(false);
    }
  }, [storyType, storyImageFile, videoFile, videoLinkInput, hasVideo, storyCaption]);

  // ── Compartilhar mídia para o Instagram via share sheet do celular ──────
  const handleShareToInstagram = useCallback(async () => {
    setSharing(true);
    setShareStatus('idle');
    setShareDownloadUrl('');

    // Resolve o arquivo a ser compartilhado
    const file: File | null = storyType === 'video' ? videoFile : storyImageFile;

    // Se não tem arquivo mas tem link de vídeo, tenta baixar como blob
    let resolvedFile = file;
    if (!resolvedFile && storyType === 'video' && videoLinkInput.trim()) {
      try {
        const res = await fetch(videoLinkInput.trim());
        if (res.ok) {
          const blob = await res.blob();
          const ext  = blob.type.includes('mp4') ? 'mp4' : 'mov';
          resolvedFile = new File([blob], `story.${ext}`, { type: blob.type });
        }
      } catch { /* usa URL direta como fallback */ }
    }

    // ── CELULAR: tenta Web Share API com arquivo ──────────────────────────
    if (isMobile && typeof navigator.share === 'function') {
      if (resolvedFile) {
        const canShare = typeof navigator.canShare === 'function'
          ? navigator.canShare({ files: [resolvedFile] })
          : true;

        if (canShare) {
          try {
            await navigator.share({
              files: [resolvedFile],
              title: effectiveProduct?.title || 'Story',
            });
            setShareStatus('shared');
            setSharing(false);
            return;
          } catch (err: any) {
            if (err.name === 'AbortError') { setSharing(false); return; }
            // Cai para o fallback de URL
          }
        }
      }

      // Fallback: compartilha como URL (link direto para download)
      const urlToShare = videoLinkInput.trim() || storyImagePreview;
      if (urlToShare && typeof navigator.share === 'function') {
        try {
          await navigator.share({ url: urlToShare, title: effectiveProduct?.title || 'Story' });
          setShareStatus('shared');
          setSharing(false);
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') { setSharing(false); return; }
        }
      }

      setShareStatus('unsupported');
      setSharing(false);
      return;
    }

    // ── DESKTOP: prepara URL de download ─────────────────────────────────
    if (resolvedFile) {
      const objUrl = URL.createObjectURL(resolvedFile);
      setShareDownloadUrl(objUrl);
    } else if (videoLinkInput.trim()) {
      setShareDownloadUrl(videoLinkInput.trim());
    } else if (storyImagePreview) {
      setShareDownloadUrl(storyImagePreview);
    }

    setShareStatus('unsupported'); // desktop sempre cai aqui
    setSharing(false);
  }, [storyType, videoFile, storyImageFile, videoLinkInput, storyImagePreview, isMobile, effectiveProduct]);

  const isPosting = postingX || postingIg || postingStory;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          🎬 Publicar Vídeo
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          Cole o link afiliado para extrair os dados do produto automaticamente, faça upload do seu vídeo e publique no X ou Instagram.
        </p>
      </div>

      {/* ── ABAS: Extrair URL  |  Preencher Manualmente ────────────────── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden mb-5">

        {/* Tab headers */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'url'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            🔍 Extrair do Link Afiliado
          </button>
          <button
            onClick={() => { setActiveTab('manual'); setProduct(null); setScrapeError(''); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'manual'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            ✏️ Preencher Manualmente
          </button>
        </div>

        {/* ── ABA 1: Extrair URL ── */}
        {activeTab === 'url' && (
          <div className="p-5">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Link Afiliado <span className="text-text-muted font-normal">(extrai título, preço e desconto automaticamente)</span>
            </label>
            <div className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScrape()}
                disabled={scraping}
                placeholder="https://mercadolivre.com.br/... ou amzn.to/..."
                className="flex-1 px-4 py-2.5 rounded-lg bg-background border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
              />
              <button
                onClick={handleScrape}
                disabled={!url.trim() || scraping}
                className="px-5 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 whitespace-nowrap"
              >
                {scraping ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Extraindo...</>
                ) : '🔍 Extrair'}
              </button>
            </div>

            {scrapeError && (
              <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm flex items-start gap-2">
                <span>⚠️</span>
                <div>
                  <p>{scrapeError}</p>
                  <button
                    onClick={() => setActiveTab('manual')}
                    className="mt-1 underline text-yellow-300 hover:text-yellow-200"
                  >
                    Preencher manualmente →
                  </button>
                </div>
              </div>
            )}

            {product && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  {product.mainImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.mainImage} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0"/>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-400 truncate">{product.title}</p>
                    <p className="text-xs text-text-muted">
                      {fmtPrice(product.finalPrice)}
                      {product.discountPct > 0 && ` • -${product.discountPct}% DE DESCONTO`}
                    </p>
                  </div>
                  <button
                    onClick={() => { setProduct(null); setScrapeError(''); setUrl(''); }}
                    className="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded border border-border"
                  >✕ Limpar</button>
                </div>

                {/* Forma de pagamento (após extração) */}
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">💳 Forma de pagamento</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'pix',       label: '💸 PIX',       desc: 'Desconto no PIX' },
                      { value: 'avista',    label: '💵 À vista',   desc: 'Cartão / Boleto' },
                      { value: 'parcelado', label: '📅 Parcelado', desc: 'Sem desconto' },
                    ] as { value: PaymentMethod; label: string; desc: string }[]).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPaymentMethod(opt.value)}
                        className={`flex-1 py-2 px-2 rounded-lg border text-xs font-semibold transition-all text-center ${
                          paymentMethod === opt.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-text-muted hover:border-primary/40'
                        }`}
                      >
                        <div>{opt.label}</div>
                        <div className="font-normal text-[10px] mt-0.5 opacity-70">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                  {paymentMethod === 'parcelado' && (
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-xs text-text-muted whitespace-nowrap">Parcelas:</label>
                      <select
                        value={installments}
                        onChange={e => setInstallments(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg bg-background border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                          <option key={n} value={n}>{n}x</option>
                        ))}
                      </select>
                      <span className="text-xs text-text-muted">
                        = {fmtPrice(product.finalPrice / installments)}/parcela
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA 2: Preenchimento Manual ── */}
        {activeTab === 'manual' && (
          <div className="p-5">
            <p className="text-sm text-text-muted mb-4">
              Preencha os dados do produto manualmente para publicar o vídeo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-text-muted mb-1">Título do produto *</label>
                <input
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                  placeholder="Ex: Tênis Nike Air Max 42 Preto"
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Preço atual (R$) *</label>
                <input
                  value={manualPrice}
                  onChange={e => setManualPrice(e.target.value)}
                  placeholder="Ex: 98,44"
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Preço antigo (R$)</label>
                <input
                  value={manualOldPrice}
                  onChange={e => setManualOldPrice(e.target.value)}
                  placeholder="Ex: 169,99"
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Desconto (%)</label>
                <input
                  value={manualDiscount}
                  onChange={e => setManualDiscount(e.target.value)}
                  placeholder="Ex: 42"
                  type="number"
                  min="0"
                  max="100"
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Link afiliado *</label>
                <input
                  value={manualAffUrl}
                  onChange={e => setManualAffUrl(e.target.value)}
                  placeholder="https://mercadolivre.com.br/..."
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-text-primary text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Forma de pagamento */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-text-muted mb-2">💳 Forma de pagamento</label>
                <div className="flex gap-2">
                  {([
                    { value: 'pix',      label: '💸 PIX',      desc: 'Desconto no PIX' },
                    { value: 'avista',   label: '💵 À vista',  desc: 'Cartão / Boleto' },
                    { value: 'parcelado',label: '📅 Parcelado',desc: 'Sem desconto' },
                  ] as { value: PaymentMethod; label: string; desc: string }[]).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentMethod(opt.value)}
                      className={`flex-1 py-2 px-2 rounded-lg border text-xs font-semibold transition-all text-center ${
                        paymentMethod === opt.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-text-muted hover:border-primary/40'
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className="font-normal text-[10px] mt-0.5 opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                {paymentMethod === 'parcelado' && (
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-text-muted whitespace-nowrap">Número de parcelas:</label>
                    <select
                      value={installments}
                      onChange={e => setInstallments(Number(e.target.value))}
                      className="px-3 py-1.5 rounded-lg bg-background border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                        <option key={n} value={n}>{n}x</option>
                      ))}
                    </select>
                    {manualPrice && (
                      <span className="text-xs text-text-muted">
                        = {fmtPrice(parsePrice(manualPrice) / installments)}/parcela
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Preview do produto manual */}
            {manualTitle && manualPrice && (
              <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="text-sm font-medium text-blue-400">{manualTitle}</p>
                  <p className="text-xs text-text-muted">
                    {fmtPrice(parseFloat(manualPrice.replace(',', '.')))}
                    {manualDiscount && ` • -${manualDiscount}% DE DESCONTO`}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MAIN CARD: sempre visível ──────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">

        {/* Card header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary flex items-center gap-2">
            🎬 Card de Publicação
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Faça upload do seu vídeo e escolha onde publicar
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT: Video upload ──────────────────────────────────────── */}
          <div>
            {/* Mini-abas: Do computador | Via link */}
            <div className="flex gap-1 mb-3 bg-background rounded-lg p-1 border border-border">
              <button
                onClick={() => { setVideoMode('file'); setVideoLinkReady(false); setVideoPreview(videoFile ? URL.createObjectURL(videoFile) : ''); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  videoMode === 'file'
                    ? 'bg-surface text-text-primary shadow'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                📁 Do computador
              </button>
              <button
                onClick={() => { setVideoMode('link'); setVideoFile(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  videoMode === 'link'
                    ? 'bg-surface text-text-primary shadow'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                🔗 Via link
              </button>
            </div>

            {/* ── Modo: Do computador ── */}
            {videoMode === 'file' && (
              <>
                {!videoFile ? (
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOver(false);
                      const f = e.dataTransfer.files[0];
                      if (f) handleFile(f);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all min-h-[240px] ${
                      dragOver
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-border hover:border-purple-500/60 hover:bg-surface-hover'
                    }`}
                  >
                    <span className="text-5xl mb-4">🎬</span>
                    <p className="text-sm font-semibold text-text-primary mb-1">Arraste o vídeo aqui</p>
                    <p className="text-xs text-text-muted">ou clique para selecionar</p>
                    <p className="text-xs text-text-muted mt-1">MP4 • WebM • MOV — até 512 MB</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <video src={videoPreview} controls className="w-full rounded-xl border border-border bg-black" style={{ maxHeight: 240 }} />
                    <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary font-medium truncate">{videoFile.name}</p>
                        <p className="text-xs text-text-muted">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <button
                        onClick={() => { setVideoFile(null); setVideoPreview(''); setXResult(null); setIgResult(null); }}
                        className="ml-3 text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-2 py-1 rounded-lg"
                      >Trocar</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Modo: Via link ── */}
            {videoMode === 'link' && (
              <div className="space-y-3">
                {!videoLinkReady ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={videoLinkInput}
                        onChange={e => { setVideoLinkInput(e.target.value); setVideoLinkError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleVideoLink()}
                        placeholder="https://exemplo.com/video.mp4"
                        className="flex-1 px-3 py-2.5 rounded-lg bg-background border border-border text-text-primary text-sm font-mono placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        onClick={handleVideoLink}
                        disabled={!videoLinkInput.trim() || loadingLink}
                        className="px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        {loadingLink
                          ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Carregando</>
                          : '▶ Carregar'}
                      </button>
                    </div>
                    {videoLinkError && (
                      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        ⚠️ {videoLinkError}
                      </p>
                    )}
                    <div className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center min-h-[180px]">
                      <span className="text-4xl mb-2">🔗</span>
                      <p className="text-sm text-text-muted">Cole o link do vídeo acima</p>
                      <p className="text-xs text-text-muted mt-1">Link direto para MP4 ou vídeo público</p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {videoPreview && (
                      <video src={videoPreview} controls className="w-full rounded-xl border border-border bg-black" style={{ maxHeight: 240 }} />
                    )}
                    <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                      <p className="text-xs text-text-muted font-mono truncate flex-1">{videoLinkInput}</p>
                      <button
                        onClick={() => { setVideoLinkReady(false); setVideoPreview(''); setVideoLinkInput(''); setXResult(null); setIgResult(null); }}
                        className="ml-3 text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-2 py-1 rounded-lg"
                      >Trocar</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />

            {/* Product summary under video */}
            {effectiveProduct && (
              <div className="mt-4 p-3 rounded-lg bg-background border border-border">
                <p className="text-xs font-semibold text-text-muted mb-1">Produto</p>
                <p className="text-sm text-text-primary font-medium leading-snug line-clamp-2">
                  {effectiveProduct.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-emerald-400 text-sm font-bold">{fmtPrice(effectiveProduct.finalPrice)}</span>
                  {effectiveProduct.originalPrice && effectiveProduct.originalPrice > effectiveProduct.finalPrice && (
                    <span className="text-text-muted text-xs line-through">{fmtPrice(effectiveProduct.originalPrice)}</span>
                  )}
                  {effectiveProduct.discountPct > 0 && (
                    <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded">
                      -{effectiveProduct.discountPct}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Publish buttons ──────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              🚀 Publicar em
            </p>

            {/* Hint when no video */}
            {!hasVideo && (
              <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-border min-h-[120px]">
                <p className="text-xs text-text-muted text-center px-4">
                  ← Faça upload do vídeo primeiro
                </p>
              </div>
            )}

            {/* X Button */}
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-black text-text-primary">𝕏</span>
                <span className="text-sm font-semibold text-text-primary">X (Twitter)</span>
              </div>
              <p className="text-xs text-text-muted mb-3">
                Envia o vídeo + copy gerada automaticamente com preço, desconto e links.
              </p>
              <button
                onClick={handlePostX}
                disabled={!hasVideo || !effectiveProduct || isPosting}
                className="w-full py-2.5 rounded-lg bg-black text-white font-semibold text-sm hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {postingX ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Enviando para o X...</>
                ) : '𝕏 Publicar no X'}
              </button>
              {xResult && (
                <div className={`mt-2 p-2 rounded-lg text-xs ${xResult.url ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                  {xResult.url
                    ? <span>✓ Publicado! <a href={xResult.url} target="_blank" rel="noreferrer" className="underline">Ver tweet →</a></span>
                    : <span>✗ {xResult.error}</span>
                  }
                </div>
              )}
            </div>

            {/* Instagram Button */}
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📸</span>
                <span className="text-sm font-semibold text-text-primary">Instagram</span>
              </div>
              <p className="text-xs text-text-muted mb-3">
                Posta como Reels via Instagram Graph API. Requer conta business configurada.
              </p>
              <button
                onClick={handlePostInstagram}
                disabled={!hasVideo || !effectiveProduct || isPosting}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {postingIg ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Publicando no Instagram...</>
                ) : '📸 Publicar no Instagram'}
              </button>
              {igResult && (
                <div className={`mt-2 p-2 rounded-lg text-xs ${igResult.url ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                  {igResult.url
                    ? <span>✓ Publicado! <a href={igResult.url} target="_blank" rel="noreferrer" className="underline">Ver post →</a></span>
                    : <span>✗ {igResult.error}</span>
                  }
                </div>
              )}
            </div>

            {/* ── Instagram Stories ──────────────────────────────────── */}
            <div className="rounded-xl border-2 border-pink-500/30 bg-gradient-to-br from-purple-900/10 via-pink-900/10 to-orange-900/10 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">✨</span>
                <span className="text-sm font-bold text-text-primary">Instagram Stories</span>
                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white">
                  VIA POSTFOR.ME
                </span>
              </div>
              <p className="text-xs text-text-muted mb-3">
                Publica imagem ou vídeo como Story (1080×1920). Suporte a vídeo e imagem.
              </p>

              {/* Story type selector */}
              <div className="flex gap-2 mb-3">
                {([
                  { value: 'video', label: '📹 Vídeo', desc: 'usa o vídeo carregado' },
                  { value: 'image', label: '🖼️ Imagem', desc: 'upload de foto' },
                ] as { value: 'video' | 'image'; label: string; desc: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setStoryType(opt.value); setStoryResult(null); }}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all text-center ${
                      storyType === opt.value
                        ? 'border-pink-500 bg-pink-500/10 text-pink-400'
                        : 'border-border text-text-muted hover:border-pink-500/40'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="font-normal text-[10px] mt-0.5 opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Image upload area (only for image stories) */}
              {storyType === 'image' && (
                <div className="mb-3">
                  {!storyImageFile ? (
                    <div
                      onDragOver={e => { e.preventDefault(); setStoryDragOver(true); }}
                      onDragLeave={() => setStoryDragOver(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setStoryDragOver(false);
                        const f = e.dataTransfer.files[0];
                        if (f) handleStoryImage(f);
                      }}
                      onClick={() => storyImageRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all py-6 ${
                        storyDragOver
                          ? 'border-pink-500 bg-pink-500/10'
                          : 'border-border hover:border-pink-500/60 hover:bg-surface-hover'
                      }`}
                    >
                      <span className="text-3xl mb-2">🖼️</span>
                      <p className="text-xs font-semibold text-text-primary">Arraste a imagem aqui</p>
                      <p className="text-[11px] text-text-muted mt-1">JPG • PNG • WebP — ideal 1080×1920</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={storyImagePreview}
                        alt="preview"
                        className="w-full rounded-xl object-cover border border-border"
                        style={{ maxHeight: 180 }}
                      />
                      <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                        <p className="text-xs text-text-primary font-medium truncate">{storyImageFile.name}</p>
                        <button
                          onClick={() => { setStoryImageFile(null); setStoryImagePreview(''); setStoryResult(null); }}
                          className="ml-3 text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-2 py-1 rounded"
                        >Trocar</button>
                      </div>
                    </div>
                  )}
                  <input
                    ref={storyImageRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleStoryImage(f); e.target.value = ''; }}
                  />
                </div>
              )}

              {/* Video story status */}
              {storyType === 'video' && !hasVideo && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
                  ⚠️ Faça upload de um vídeo (seção à esquerda) para publicar como Story
                </p>
              )}
              {storyType === 'video' && hasVideo && (
                <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-3">
                  ✓ Vídeo pronto — será publicado como Story
                </p>
              )}

              {/* Caption */}
              <div className="mb-3">
                <label className="block text-[11px] font-medium text-text-muted mb-1">
                  Legenda <span className="opacity-60">(opcional)</span>
                </label>
                <textarea
                  value={storyCaption}
                  onChange={e => setStoryCaption(e.target.value)}
                  rows={3}
                  placeholder="Ex: 🔥 Oferta imperdível! Corre na bio 👇"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary text-xs placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>

              {/* Publish button */}
              <button
                onClick={handlePostStory}
                disabled={
                  isPosting ||
                  (storyType === 'image' && !storyImageFile) ||
                  (storyType === 'video' && !hasVideo)
                }
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white font-bold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
              >
                {postingStory ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Publicando Story...</>
                ) : '✨ Publicar Story'}
              </button>

              {storyResult && (
                <div className={`mt-2 p-2 rounded-lg text-xs ${storyResult.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                  {storyResult.error
                    ? <span>✗ {storyResult.error}</span>
                    : <span>✓ Story publicado com sucesso! (ID: {storyResult.url})</span>
                  }
                </div>
              )}

              {/* ── Divisor ── */}
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">ou</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* ── Botão: Enviar para o Instagram com sticker de link ── */}
              <button
                onClick={handleShareToInstagram}
                disabled={
                  sharing ||
                  (storyType === 'image' && !storyImageFile) ||
                  (storyType === 'video' && !hasVideo)
                }
                className="w-full py-2.5 rounded-lg border-2 border-pink-500/50 bg-pink-500/5 text-pink-400 font-bold text-sm hover:bg-pink-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {sharing ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Preparando...</>
                ) : (
                  <><span>📲</span> Enviar para o Instagram (com sticker de link)</>
                )}
              </button>
              <p className="text-[10px] text-text-muted text-center mt-1">
                Abre o compartilhamento do celular → escolha Instagram → adicione o sticker de link
              </p>

              {/* ── Resultado do compartilhamento ── */}
              {shareStatus === 'shared' && (
                <div className="mt-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  ✓ Mídia enviada! Agora escolha o Instagram, adicione o sticker de link e publique o Story.
                </div>
              )}

              {shareStatus === 'unsupported' && (
                <div className="mt-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs space-y-2">
                  <p className="text-blue-400 font-semibold">📱 Abra esta página no celular para compartilhar</p>
                  <p className="text-text-muted">No computador, baixe a mídia e envie para o celular via WhatsApp ou AirDrop.</p>

                  {shareDownloadUrl && (
                    <a
                      href={shareDownloadUrl}
                      download={storyType === 'video' ? 'story.mp4' : 'story.jpg'}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-blue-500/20 text-blue-400 font-semibold hover:bg-blue-500/30 transition-colors"
                    >
                      ⬇️ Baixar mídia do Story
                    </a>
                  )}

                  {effectiveProduct?.affiliateUrl && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-text-muted">Link para o sticker (copie e cole no Instagram):</p>
                      <div className="flex items-center gap-2 bg-background rounded-lg px-2 py-1.5 border border-border">
                        <p className="text-xs text-text-primary font-mono flex-1 truncate">{effectiveProduct.affiliateUrl}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(effectiveProduct!.affiliateUrl); }}
                          className="text-[10px] text-blue-400 hover:text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded whitespace-nowrap"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Caption */}
            {effectiveProduct && (
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">📝 Legenda Reels</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(buildCaption(effectiveProduct!, paymentMethod, installments)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="text-xs text-purple-400 hover:text-purple-300 border border-purple-500/30 px-2 py-1 rounded transition-colors"
                  >
                    {copied ? '✓ Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre className="text-xs text-text-secondary font-sans whitespace-pre-wrap leading-relaxed bg-background rounded-lg p-3 border border-border max-h-36 overflow-y-auto">
                  {buildCaption(effectiveProduct, paymentMethod, installments)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
