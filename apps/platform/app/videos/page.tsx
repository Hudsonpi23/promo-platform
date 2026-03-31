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

// ── Story Style ─────────────────────────────────────────────────────────────
interface StoryStyleConfig {
  presetName:          string;
  bgType:              'solid' | 'gradient';
  bgColor:             string;
  bgGradient:          [string, string];
  boxColor:            string;
  boxOpacity:          number;
  boxRadius:           number;
  textPrimaryColor:    string;
  textSecondaryColor:  string;
  ctaColor:            string;
  priceColor:          string;
  fontFamily:          string;
  headlineSize:        number;
  subheadlineSize:     number;
  ctaSize:             number;
}

const STORY_PRESETS: StoryStyleConfig[] = [
  {
    presetName: 'Manu Padrão', bgType: 'gradient', bgColor: '#0a1628',
    bgGradient: ['#0a1628', '#0d2240'], boxColor: '#000000', boxOpacity: 0.55,
    boxRadius: 24, textPrimaryColor: '#ffffff', textSecondaryColor: 'rgba(255,255,255,0.85)',
    ctaColor: '#f0c040', priceColor: '#f0c040', fontFamily: 'sans-serif',
    headlineSize: 52, subheadlineSize: 36, ctaSize: 44,
  },
  {
    presetName: 'Oferta', bgType: 'gradient', bgColor: '#0d0d0d',
    bgGradient: ['#1a0800', '#0d0d0d'], boxColor: '#000000', boxOpacity: 0.65,
    boxRadius: 20, textPrimaryColor: '#ffffff', textSecondaryColor: 'rgba(255,255,255,0.9)',
    ctaColor: '#ff4444', priceColor: '#f0c040', fontFamily: 'sans-serif',
    headlineSize: 54, subheadlineSize: 38, ctaSize: 46,
  },
  {
    presetName: 'Urgente', bgType: 'gradient', bgColor: '#1a0000',
    bgGradient: ['#2d0000', '#1a0000'], boxColor: '#aa0000', boxOpacity: 0.70,
    boxRadius: 20, textPrimaryColor: '#ffffff', textSecondaryColor: '#ffffff',
    ctaColor: '#ffdd00', priceColor: '#ffdd00', fontFamily: 'sans-serif',
    headlineSize: 56, subheadlineSize: 38, ctaSize: 48,
  },
  {
    presetName: 'Economia', bgType: 'gradient', bgColor: '#001a0a',
    bgGradient: ['#002a10', '#001a0a'], boxColor: '#004d1a', boxOpacity: 0.65,
    boxRadius: 20, textPrimaryColor: '#ffffff', textSecondaryColor: '#a0ffb0',
    ctaColor: '#40ff80', priceColor: '#f0c040', fontFamily: 'sans-serif',
    headlineSize: 52, subheadlineSize: 36, ctaSize: 44,
  },
  {
    presetName: 'Claro', bgType: 'gradient', bgColor: '#f0f4ff',
    bgGradient: ['#ffffff', '#e8f0fe'], boxColor: '#1a2a6c', boxOpacity: 0.08,
    boxRadius: 24, textPrimaryColor: '#1a2a6c', textSecondaryColor: '#2d3a7a',
    ctaColor: '#e63946', priceColor: '#1565C0', fontFamily: 'sans-serif',
    headlineSize: 50, subheadlineSize: 34, ctaSize: 42,
  },
];

// ── Text style presets (Instagram-style) ───────────────────────────────────
const TEXT_STYLE_PRESETS = [
  { id: 'strong',  name: 'Strong',  fontFamily: 'Montserrat', fontWeight: '800', shadowBlur: 8,  shadowColor: 'rgba(0,0,0,0.7)', letterSpacing: 1,    uppercase: true  },
  { id: 'modern',  name: 'Modern',  fontFamily: 'Inter',      fontWeight: '700', shadowBlur: 0,  shadowColor: 'transparent',     letterSpacing: 0,    uppercase: false },
  { id: 'promo',   name: 'Promo',   fontFamily: 'Poppins',    fontWeight: '800', shadowBlur: 6,  shadowColor: 'rgba(0,0,0,0.5)', letterSpacing: -0.5, uppercase: true  },
  { id: 'neon',    name: 'Neon',    fontFamily: 'sans-serif', fontWeight: '800', shadowBlur: 18, shadowColor: '#00cfff',         letterSpacing: 2,    uppercase: true  },
  { id: 'classic', name: 'Classic', fontFamily: 'Poppins',    fontWeight: '600', shadowBlur: 6,  shadowColor: 'rgba(0,0,0,0.4)', letterSpacing: 0.5,  uppercase: false },
  { id: 'minimal', name: 'Minimal', fontFamily: 'Inter',      fontWeight: '400', shadowBlur: 0,  shadowColor: 'transparent',     letterSpacing: 1.5,  uppercase: false },
] as const;
type TextStylePresetId = typeof TEXT_STYLE_PRESETS[number]['id'];

const TEXT_MODES = [
  { id: 'box',       icon: '[A]', label: 'Caixa'       },
  { id: 'bg',        icon: '▬A',  label: 'Fundo full'  },
  { id: 'highlight', icon: '▌A',  label: 'Destaque'    },
  { id: 'plain',     icon: 'A',   label: 'Sem fundo'   },
] as const;
type TextMode = typeof TEXT_MODES[number]['id'];

const BLOCK_SIZES = {
  headline:    { S: 38, M: 52, L: 68 },
  subheadline: { S: 26, M: 36, L: 48 },
  cta:         { S: 30, M: 42, L: 56 },
} as const;
type BlockSizeKey = keyof typeof BLOCK_SIZES;

const QUICK_COLORS = ['#ffffff', '#f0c040', '#ff4444', '#40ff80', '#00cfff', '#ff69b4', '#000000'];

interface TextBlockConfig { stylePresetId: TextStylePresetId; mode: TextMode; color: string; size: 'S'|'M'|'L' }
interface AllBlockConfigs  { headline: TextBlockConfig; subheadline: TextBlockConfig; cta: TextBlockConfig }

const DEFAULT_BLOCK_CONFIGS: AllBlockConfigs = {
  headline:    { stylePresetId: 'strong',  mode: 'box', color: '#ffffff', size: 'M' },
  subheadline: { stylePresetId: 'modern',  mode: 'box', color: '#ffffff', size: 'M' },
  cta:         { stylePresetId: 'promo',   mode: 'box', color: '#f0c040', size: 'M' },
};

// ── Story text positioning ──────────────────────────────────────────────────
interface TextBlockPos   { x: number; y: number }   // 0–1 fractions of canvas
interface StoryTextPositions { headline: TextBlockPos; subheadline: TextBlockPos; cta: TextBlockPos }
interface DragState { block: keyof StoryTextPositions; startCX: number; startCY: number; startPX: number; startPY: number }

const DEFAULT_TEXT_POSITIONS: StoryTextPositions = {
  headline:    { x: 0.5, y: 0.08 },
  subheadline: { x: 0.5, y: 0.72 },
  cta:         { x: 0.5, y: 0.87 },
};

function hexToRgbStr(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
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
  const [postingIg, setPostingIg]   = useState(false);
  const [igResult, setIgResult]     = useState<{ url?: string; error?: string } | null>(null);
  const [copied, setCopied]         = useState(false);

  // ── Stories ──────────────────────────────────────────────────────────────
  const [storyType, setStoryType]                 = useState<'video' | 'image'>('video');
  const [storyImageFile, setStoryImageFile]       = useState<File | null>(null);
  const [storyImagePreview, setStoryImagePreview] = useState('');
  const [postingStory, setPostingStory]           = useState(false);
  const [storyResult, setStoryResult]             = useState<{ url?: string; error?: string } | null>(null);
  const [storyDragOver, setStoryDragOver]         = useState(false);
  const storyImageRef   = useRef<HTMLInputElement>(null);
  const rawStoryFileRef = useRef<File | null>(null);

  // ── Story Style Editor ────────────────────────────────────────────────
  const [storyHeadline, setStoryHeadline]         = useState('');
  const [storySubheadline, setStorySubheadline]   = useState('');
  const [storyCta, setStoryCta]                   = useState('');
  const [storyStyle, setStoryStyle]               = useState<StoryStyleConfig>(STORY_PRESETS[0]);
  const [showStylePanel, setShowStylePanel]       = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [openStorySections, setOpenStorySections] = useState<Set<string>>(new Set(['text', 'style']));
  const toggleStorySection = (id: string) => setOpenStorySections(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const [blockConfigs, setBlockConfigs] = useState<AllBlockConfigs>(DEFAULT_BLOCK_CONFIGS);
  const [storyTextPositions, setStoryTextPositions] = useState<StoryTextPositions>(DEFAULT_TEXT_POSITIONS);
  const [storyBgPreview, setStoryBgPreview]       = useState('');
  const [isDragging, setIsDragging]               = useState<string | null>(null);
  const dragStateRef      = useRef<DragState | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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

  const hasVideo = !!videoFile || videoLinkReady;

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

  // ── Canvas helpers shared between preview and final render ───────────────
  // Renders background + product image/price onto ctx; returns the bottom-Y of the product block
  const drawStoryBase = useCallback(async (
    ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number, s: StoryStyleConfig
  ): Promise<void> => {
    const fontStr = (sz: number, wt = 'bold') =>
      `${wt} ${sz}px ${s.fontFamily !== 'sans-serif' ? `'${s.fontFamily}', ` : ''}sans-serif`;
    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
      ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
      ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
      ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
    };
    if (s.bgType === 'gradient') {
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,s.bgGradient[0]); g.addColorStop(1,s.bgGradient[1]);
      ctx.fillStyle = g;
    } else { ctx.fillStyle = s.bgColor; }
    ctx.fillRect(0,0,W,H);
    const glow = ctx.createRadialGradient(W/2,H*0.42,0,W/2,H*0.42,W*0.9);
    glow.addColorStop(0,'rgba(255,255,255,0.04)'); glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0,0,W,H);
    const pad = 36, maxImgH = H*0.40, maxImgW = W*0.80;
    const ratio = Math.min(maxImgW/img.width, maxImgH/img.height);
    const dw = img.width*ratio, dh = img.height*ratio;
    const dx = (W-dw)/2, dy = H*0.22;
    ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=60; ctx.shadowOffsetY=20;
    ctx.fillStyle='#ffffff'; roundRect(dx-pad,dy-pad,dw+pad*2,dh+pad*2,40); ctx.fill();
    ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetY=0;
    ctx.drawImage(img,dx,dy,dw,dh);
    let belowY = dy+dh+pad+56;
    const prodPrice = effectiveProduct ? fmtPrice(effectiveProduct.finalPrice) : null;
    const prodTitle = effectiveProduct?.title;
    if (prodPrice) {
      ctx.font=fontStr(72); ctx.fillStyle=s.priceColor; ctx.textAlign='center';
      ctx.fillText(prodPrice,W/2,belowY); belowY+=84;
    }
    if (prodTitle) {
      ctx.font=fontStr(34,'600'); ctx.fillStyle=s.textSecondaryColor; ctx.textAlign='center';
      const mc=52, l1=prodTitle.slice(0,mc), l2=prodTitle.length>mc?prodTitle.slice(mc,mc*2)+'…':'';
      ctx.fillText(l1,W/2,belowY);
      if (l2) { ctx.fillText(l2,W/2,belowY+44); belowY+=44; }
    }
    ctx.font=fontStr(38,'600'); ctx.fillStyle='rgba(255,255,255,0.30)'; ctx.textAlign='center';
    ctx.fillText('@manudaspromocoes',W/2,H-68);
  }, [effectiveProduct]);

  // Draws a single text block centred at (cx, cy) using per-block TextBlockConfig
  const drawTextAtPos = useCallback((
    ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number,
    opts: { blockCfg: TextBlockConfig; sizeMap: { S:number; M:number; L:number };
            boxColor: string; boxOpacity: number; boxRadius: number; W: number }
  ) => {
    if (!text.trim()) return;
    const { blockCfg, sizeMap, boxColor, boxOpacity, boxRadius, W } = opts;
    const preset  = TEXT_STYLE_PRESETS.find(p => p.id === blockCfg.stylePresetId) ?? TEXT_STYLE_PRESETS[0];
    const size    = sizeMap[blockCfg.size];
    const actual  = preset.uppercase ? text.toUpperCase() : text;
    const lh = size * 1.38, pad = 28, maxW = W - 80;

    const fontStr = `${preset.fontWeight} ${size}px ${preset.fontFamily !== 'sans-serif' ? `'${preset.fontFamily}', ` : ''}sans-serif`;
    ctx.font = fontStr; ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) (ctx as any).letterSpacing = `${preset.letterSpacing}px`;

    // Word wrap
    const words = actual.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const wd of words) {
      const t = cur ? `${cur} ${wd}` : wd;
      if (ctx.measureText(t).width > maxW) { if (cur) lines.push(cur); cur = wd; } else cur = t;
    }
    if (cur) lines.push(cur);

    const totalH = lines.length * lh, boxH = totalH + pad * 2, boxY = cy - boxH / 2;

    // Apply shadow/glow
    if (preset.shadowBlur > 0) { ctx.shadowBlur = preset.shadowBlur; ctx.shadowColor = preset.shadowColor; }

    // Background mode
    const mode = blockCfg.mode;
    const rgb  = hexToRgbStr(boxColor.startsWith('#') ? boxColor : '#000000');
    if (mode === 'bg') {
      ctx.fillStyle = `rgba(${rgb},${boxOpacity})`;
      ctx.fillRect(40, boxY, W - 80, boxH);
    } else if (mode === 'box') {
      ctx.fillStyle = `rgba(${rgb},${boxOpacity})`;
      const bx = 40, bw = W - 80, r = boxRadius;
      ctx.beginPath();
      ctx.moveTo(bx+r,boxY); ctx.lineTo(bx+bw-r,boxY); ctx.arcTo(bx+bw,boxY,bx+bw,boxY+r,r);
      ctx.lineTo(bx+bw,boxY+boxH-r); ctx.arcTo(bx+bw,boxY+boxH,bx+bw-r,boxY+boxH,r);
      ctx.lineTo(bx+r,boxY+boxH); ctx.arcTo(bx,boxY+boxH,bx,boxY+boxH-r,r);
      ctx.lineTo(bx,boxY+r); ctx.arcTo(bx,boxY,bx+r,boxY,r);
      ctx.closePath(); ctx.fill();
    } else if (mode === 'highlight') {
      const hlRgb = hexToRgbStr(blockCfg.color.startsWith('#') ? blockCfg.color : '#f0c040');
      lines.forEach((line, i) => {
        const lw = ctx.measureText(line).width + 24;
        ctx.fillStyle = `rgba(${hlRgb},0.30)`;
        ctx.fillRect(cx - lw/2, boxY + pad * 0.4 + i * lh, lw, size * 1.25);
      });
    }
    // Plain = no background

    // Draw text
    ctx.fillStyle = blockCfg.color;
    lines.forEach((line, i) => ctx.fillText(line, cx, boxY + pad + (i + 0.85) * lh));

    // Reset
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    if ('letterSpacing' in ctx) (ctx as any).letterSpacing = '0px';
  }, []);

  // ── Background-only canvas render → blob URL (for the interactive preview) ──
  const renderStoryBackground = useCallback((file: File): Promise<string> => {
    return new Promise(resolve => {
      const W=1080, H=1920, img=new Image(), url=URL.createObjectURL(file);
      img.onload = async () => {
        const canvas=document.createElement('canvas');
        canvas.width=W; canvas.height=H;
        const ctx=canvas.getContext('2d')!;
        if (storyStyle.fontFamily!=='sans-serif') {
          try { await document.fonts.load(`bold ${storyStyle.headlineSize}px '${storyStyle.fontFamily}'`); } catch {}
        }
        await drawStoryBase(ctx,img,W,H,storyStyle);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => resolve(blob?URL.createObjectURL(blob):''),'image/jpeg',0.75);
      };
      img.onerror = ()=>{ URL.revokeObjectURL(url); resolve(''); };
      img.src = url;
    });
  }, [storyStyle, drawStoryBase]);

  // ── Full canvas render (background + text at free positions) ─────────────
  const formatImageForStory = useCallback((file: File): Promise<File> => {
    return new Promise(resolve => {
      const W=1080, H=1920, img=new Image(), url=URL.createObjectURL(file);
      img.onload = async () => {
        const canvas=document.createElement('canvas');
        canvas.width=W; canvas.height=H;
        const ctx=canvas.getContext('2d')!;
        const s=storyStyle;
        if (s.fontFamily!=='sans-serif') {
          try { await document.fonts.load(`bold ${s.headlineSize}px '${s.fontFamily}'`); } catch {}
        }
        const fontStr = (sz:number,wt='bold') =>
          `${wt} ${sz}px ${s.fontFamily!=='sans-serif'?`'${s.fontFamily}', `:''}sans-serif`;
        await drawStoryBase(ctx,img,W,H,s);
        const sharedOpts = { boxColor:s.boxColor, boxOpacity:s.boxOpacity, boxRadius:s.boxRadius, W };
        drawTextAtPos(ctx, storyHeadline,    storyTextPositions.headline.x*W,    storyTextPositions.headline.y*H,
          { blockCfg:blockConfigs.headline,    sizeMap:BLOCK_SIZES.headline,    ...sharedOpts });
        drawTextAtPos(ctx, storySubheadline, storyTextPositions.subheadline.x*W, storyTextPositions.subheadline.y*H,
          { blockCfg:blockConfigs.subheadline, sizeMap:BLOCK_SIZES.subheadline, ...sharedOpts });
        drawTextAtPos(ctx, storyCta,         storyTextPositions.cta.x*W,         storyTextPositions.cta.y*H,
          { blockCfg:blockConfigs.cta,         sizeMap:BLOCK_SIZES.cta,         ...sharedOpts });
        URL.revokeObjectURL(url);
        canvas.toBlob(blob=>{
          if(!blob){resolve(file);return;}
          resolve(new File([blob],'story_1080x1920.jpg',{type:'image/jpeg'}));
        },'image/jpeg',0.93);
      };
      img.onerror=()=>{ URL.revokeObjectURL(url); resolve(file); };
      img.src=url;
    });
  }, [effectiveProduct, storyHeadline, storySubheadline, storyCta, storyStyle, storyTextPositions, blockConfigs, drawStoryBase, drawTextAtPos]);

  const handleStoryImage = useCallback(async (file: File) => {
    rawStoryFileRef.current = file;
    if (!file.type.startsWith('image/')) { alert('Selecione uma imagem (JPG, PNG, WebP)'); return; }
    if (file.size > 30*1024*1024) { alert('Imagem muito grande (máx. 30 MB).'); return; }
    setStoryResult(null);
    setIsGeneratingPreview(true);
    try {
      const [formatted, bgUrl] = await Promise.all([
        formatImageForStory(file),
        renderStoryBackground(file),
      ]);
      setStoryImageFile(formatted);
      setStoryImagePreview(URL.createObjectURL(formatted));
      setStoryBgPreview(bgUrl);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [formatImageForStory, renderStoryBackground]);

  // Detecta se é dispositivo móvel
  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Auto-fill story text blocks when product is loaded
  useEffect(() => {
    if (effectiveProduct) {
      const price    = fmtPrice(effectiveProduct.finalPrice);
      const discount = effectiveProduct.discountPct >= 30 ? ` (-${effectiveProduct.discountPct}%)` : '';
      const shortTitle = effectiveProduct.title.slice(0, 60).toUpperCase();
      setStoryHeadline(`🔥 ${shortTitle}`);
      setStorySubheadline(effectiveProduct.discountPct > 0 ? `DE ${fmtPrice(effectiveProduct.originalPrice ?? 0)} → ${price}${discount}` : `POR APENAS ${price}`);
      setStoryCta('CORRE NA BIO ANTES QUE ACABE ⚠️');
    }
  }, [effectiveProduct]);

  // Auto-regenerate bg preview when style/product changes (debounced)
  useEffect(() => {
    if (!rawStoryFileRef.current) return;
    const t = setTimeout(async () => {
      const bgUrl = await renderStoryBackground(rawStoryFileRef.current!);
      setStoryBgPreview(bgUrl);
    }, 600);
    return () => clearTimeout(t);
  }, [storyStyle, renderStoryBackground]);

  // Auto-regenerate final image when style/text/positions change (debounced)
  useEffect(() => {
    if (!rawStoryFileRef.current) return;
    const t = setTimeout(async () => {
      setIsGeneratingPreview(true);
      try {
        const formatted = await formatImageForStory(rawStoryFileRef.current!);
        setStoryImageFile(formatted);
        setStoryImagePreview(URL.createObjectURL(formatted));
      } finally {
        setIsGeneratingPreview(false);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [storyStyle, storyHeadline, storySubheadline, storyCta, storyTextPositions, blockConfigs, formatImageForStory]);

  // Sync block colors when a named background preset changes
  useEffect(() => {
    if (storyStyle.presetName === 'Custom') return;
    setBlockConfigs(prev => ({
      headline:    { ...prev.headline,    color: storyStyle.textPrimaryColor },
      subheadline: { ...prev.subheadline, color: storyStyle.textSecondaryColor },
      cta:         { ...prev.cta,         color: storyStyle.ctaColor },
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyStyle.presetName]);

  // Load Google Fonts for canvas
  useEffect(() => {
    const id = 'story-gfonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id   = id;
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&family=Inter:wght@400;600;700;800&family=Montserrat:wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
  }, []);

  // ── Drag handlers for the interactive story preview ──────────────────────
  const getClientXY = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) return { cx: e.touches[0].clientX, cy: e.touches[0].clientY };
    return { cx: (e as React.MouseEvent).clientX, cy: (e as React.MouseEvent).clientY };
  };

  const handleDragStart = useCallback((block: keyof StoryTextPositions, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { cx, cy } = getClientXY(e);
    dragStateRef.current = {
      block,
      startCX: cx, startCY: cy,
      startPX: storyTextPositions[block].x,
      startPY: storyTextPositions[block].y,
    };
    setIsDragging(block);
  }, [storyTextPositions]);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragStateRef.current || !previewContainerRef.current) return;
    e.preventDefault();
    const { cx, cy } = getClientXY(e);
    const rect = previewContainerRef.current.getBoundingClientRect();
    const dx = (cx - dragStateRef.current.startCX) / rect.width;
    const dy = (cy - dragStateRef.current.startCY) / rect.height;
    const newX = Math.max(0.05, Math.min(0.95, dragStateRef.current.startPX + dx));
    const newY = Math.max(0.02, Math.min(0.97, dragStateRef.current.startPY + dy));
    setStoryTextPositions(prev => ({
      ...prev,
      [dragStateRef.current!.block]: { x: newX, y: newY },
    }));
  }, []);

  const handleDragEnd = useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(null);
  }, []);

  const snapBlock = (block: keyof StoryTextPositions, xSnap: number | null, ySnap: number | null) => {
    setStoryTextPositions(prev => ({
      ...prev,
      [block]: {
        x: xSnap !== null ? xSnap : prev[block].x,
        y: ySnap !== null ? ySnap : prev[block].y,
      },
    }));
  };

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

    const builtCaption = [storyHeadline, storySubheadline, storyCta].filter(Boolean).join('\n');
    if (builtCaption.trim()) form.append('caption', builtCaption.trim());

    try {
      const res  = await fetchWithAuth('/api/instagram/publish-story', { method: 'POST', body: form });
      const data = await res.json();
      setStoryResult(res.ok ? { url: data.postId } : { error: data.error || 'Erro ao publicar Story' });
    } catch (err: any) {
      setStoryResult({ error: err.message });
    } finally {
      setPostingStory(false);
    }
  }, [storyType, storyImageFile, videoFile, videoLinkInput, hasVideo, storyHeadline, storySubheadline, storyCta]);

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

  const isPosting = postingIg || postingStory;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          📸 Publicar no Instagram
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          Cole o link afiliado para extrair os dados do produto, faça upload do vídeo e publique como Reels ou crie um Story com editor visual.
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
                        onClick={() => { setVideoFile(null); setVideoPreview('');  setIgResult(null); }}
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
                        onClick={() => { setVideoLinkReady(false); setVideoPreview(''); setVideoLinkInput('');  setIgResult(null); }}
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
              📸 Publicar no Instagram
            </p>

            {/* Hint when no video */}
            {!hasVideo && (
              <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-border min-h-[120px]">
                <p className="text-xs text-text-muted text-center px-4">
                  ← Faça upload do vídeo primeiro
                </p>
              </div>
            )}

            {/* Instagram Reels Button */}
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
            <div className="rounded-xl border-2 border-pink-500/30 bg-gradient-to-br from-purple-900/10 via-pink-900/10 to-orange-900/10 p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <span className="text-sm font-bold text-text-primary">Instagram Stories</span>
                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white">
                  VIA POSTFOR.ME
                </span>
              </div>

              {/* Story type selector */}
              <div className="flex gap-2">
                {([
                  { value: 'video', label: '📹 Vídeo', desc: 'usa o vídeo carregado' },
                  { value: 'image', label: '🖼️ Imagem', desc: 'upload de foto' },
                ] as { value: 'video' | 'image'; label: string; desc: string }[]).map(opt => (
                  <button key={opt.value} type="button"
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

              {/* ── Image mode ── */}
              {storyType === 'image' && (
                <>
                  {/* Upload or Preview */}
                  {!storyImageFile ? (
                    <div
                      onDragOver={e => { e.preventDefault(); setStoryDragOver(true); }}
                      onDragLeave={() => setStoryDragOver(false)}
                      onDrop={e => { e.preventDefault(); setStoryDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleStoryImage(f); }}
                      onClick={() => storyImageRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all py-8 ${storyDragOver ? 'border-pink-500 bg-pink-500/10' : 'border-border hover:border-pink-500/60 hover:bg-surface-hover'}`}
                    >
                      <span className="text-3xl mb-2">🖼️</span>
                      <p className="text-xs font-semibold text-text-primary">Arraste a imagem aqui</p>
                      <p className="text-[11px] text-text-muted mt-1">Qualquer formato → convertido para 9:16</p>
                    </div>
                  ) : (
                    /* ── Interactive Story Editor Preview ── */
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400 text-xs">✓</span>
                          <span className="text-xs font-semibold text-emerald-400">Editor interativo — arraste os textos</span>
                        </div>
                        <button
                          onClick={() => { setStoryImageFile(null); setStoryImagePreview(''); setStoryBgPreview(''); setStoryResult(null); rawStoryFileRef.current=null; setStoryTextPositions(DEFAULT_TEXT_POSITIONS); }}
                          className="text-[10px] text-red-400 border border-red-500/20 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                        >Trocar</button>
                      </div>

                      {/* ── 9:16 Interactive preview canvas ── */}
                      <div
                        ref={previewContainerRef}
                        onMouseMove={handleDragMove}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                        onTouchMove={handleDragMove}
                        onTouchEnd={handleDragEnd}
                        className={`relative overflow-hidden rounded-xl border-2 mx-auto select-none ${isDragging ? 'border-pink-500 cursor-grabbing' : 'border-pink-500/40 cursor-default'}`}
                        style={{ width: '100%', aspectRatio: '9/16', maxWidth: 240, touchAction: 'none' }}
                      >
                        {/* Background image */}
                        {storyBgPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={storyBgPreview} alt="bg" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                        ) : (
                          <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(${storyStyle.bgGradient[0]}, ${storyStyle.bgGradient[1]})` }} />
                        )}

                        {/* Generating overlay */}
                        {isGeneratingPreview && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20 pointer-events-none">
                            <svg className="animate-spin w-6 h-6 text-pink-400" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                          </div>
                        )}

                        {/* Horizontal guide lines */}
                        <div className="absolute left-0 right-0 border-t border-dashed border-white/15 pointer-events-none" style={{ top: '33%' }} />
                        <div className="absolute left-0 right-0 border-t border-dashed border-white/15 pointer-events-none" style={{ top: '66%' }} />

                        {/* Watermark indicator */}
                        <div className="absolute bottom-2 left-0 right-0 text-center text-[7px] text-white/30 font-semibold pointer-events-none">@manudaspromocoes</div>

                        {/* ── Draggable text blocks ── */}
                        {(['headline', 'subheadline', 'cta'] as const).map(block => {
                          const text = block==='headline' ? storyHeadline : block==='subheadline' ? storySubheadline : storyCta;
                          if (!text.trim()) return null;
                          const cfg     = blockConfigs[block];
                          const preset  = TEXT_STYLE_PRESETS.find(p => p.id === cfg.stylePresetId) ?? TEXT_STYLE_PRESETS[0];
                          const sizeMap = BLOCK_SIZES[block];
                          const pos     = storyTextPositions[block];
                          const previewW = previewContainerRef.current?.offsetWidth || 220;
                          const sc      = previewW / 1080;
                          const scaledFont = Math.max(7, Math.round(sizeMap[cfg.size] * sc));
                          const bgRgb   = hexToRgbStr(storyStyle.boxColor.startsWith('#') ? storyStyle.boxColor : '#000000');
                          const displayText = preset.uppercase ? text.toUpperCase() : text;

                          // Background style based on mode
                          const modeBg: React.CSSProperties =
                            cfg.mode === 'bg'        ? { backgroundColor: `rgba(${bgRgb},${storyStyle.boxOpacity})` }
                            : cfg.mode === 'box'     ? { backgroundColor: `rgba(${bgRgb},${storyStyle.boxOpacity})`, borderRadius: `${storyStyle.boxRadius * sc}px` }
                            : cfg.mode === 'highlight' ? { backgroundColor: `rgba(${hexToRgbStr(cfg.color.startsWith('#')?cfg.color:'#f0c040')},0.28)` }
                            : {};

                          return (
                            <div
                              key={block}
                              onMouseDown={e => handleDragStart(block, e)}
                              onTouchStart={e => handleDragStart(block, e)}
                              className={`absolute max-w-[90%] text-center cursor-grab active:cursor-grabbing z-10 ${isDragging===block ? 'ring-2 ring-white/60 shadow-lg' : 'hover:ring-1 hover:ring-white/30'}`}
                              style={{
                                left: `${pos.x * 100}%`,
                                top:  `${pos.y * 100}%`,
                                transform: 'translate(-50%, -50%)',
                                fontSize: `${scaledFont}px`,
                                fontFamily: preset.fontFamily === 'sans-serif' ? 'sans-serif' : `'${preset.fontFamily}', sans-serif`,
                                fontWeight: preset.fontWeight,
                                letterSpacing: `${preset.letterSpacing * sc}px`,
                                textShadow: preset.shadowBlur > 0 ? `0 0 ${preset.shadowBlur * sc}px ${preset.shadowColor}` : 'none',
                                color: cfg.color,
                                padding: `${4*sc}px ${10*sc}px`,
                                lineHeight: 1.38,
                                userSelect: 'none',
                                touchAction: 'none',
                                whiteSpace: 'nowrap',
                                ...modeBg,
                              }}
                            >
                              {displayText}
                            </div>
                          );
                        })}
                      </div>

                      {/* ── Snap controls ── */}
                      <div className="rounded-lg border border-border bg-background/40 p-2 space-y-1.5">
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">📍 Posicionamento rápido</p>
                        {([
                          { block: 'headline'    as const, label: 'Headline',    color: 'text-pink-400'   },
                          { block: 'subheadline' as const, label: 'Subheadline', color: 'text-blue-400'   },
                          { block: 'cta'         as const, label: 'CTA',         color: 'text-yellow-400' },
                        ]).map(({ block, label, color }) => (
                          <div key={block} className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-semibold w-16 flex-shrink-0 ${color}`}>{label}</span>
                            <div className="flex gap-1 flex-1">
                              {[
                                { label: '⬆ Topo',  y: 0.07,  x: null },
                                { label: '⬛ Meio',  y: 0.50,  x: null },
                                { label: '⬇ Base',  y: 0.90,  x: null },
                                { label: '◀ Esq',   y: null,  x: 0.15 },
                                { label: '⬛ Cent',  y: null,  x: 0.50 },
                                { label: '▶ Dir',   y: null,  x: 0.85 },
                              ].map(snap => (
                                <button key={snap.label}
                                  onClick={() => snapBlock(block, snap.x, snap.y)}
                                  className="flex-1 py-0.5 rounded text-[8px] border border-border text-text-muted hover:border-pink-500/40 hover:text-text-primary transition-colors"
                                >
                                  {snap.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => setStoryTextPositions(DEFAULT_TEXT_POSITIONS)}
                          className="w-full py-1 rounded-lg border border-border text-[9px] text-text-muted hover:border-pink-500/40 transition-colors"
                        >
                          ↩ Resetar posições
                        </button>
                      </div>
                    </div>
                  )}
                  <input ref={storyImageRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleStoryImage(f); e.target.value = ''; }} />

                  {/* ── 🎨 Estilo Visual ── */}
                  <div className="rounded-xl border border-pink-500/20 bg-black/20 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-pink-300 uppercase tracking-wider">🎨 Estilo Visual</p>
                      <button onClick={() => setShowStylePanel(p => !p)}
                        className="text-[10px] text-text-muted border border-border px-2 py-0.5 rounded hover:border-pink-500/40 transition-colors">
                        {showStylePanel ? '▲ Fechar' : '▼ Editor avançado'}
                      </button>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-5 gap-1">
                      {STORY_PRESETS.map(preset => (
                        <button key={preset.presetName}
                          onClick={() => setStoryStyle(preset)}
                          title={preset.presetName}
                          className={`py-2 px-1 rounded-lg border text-[9px] font-bold transition-all text-center leading-tight ${
                            storyStyle.presetName === preset.presetName
                              ? 'border-pink-500 ring-1 ring-pink-500/50 scale-105'
                              : 'border-transparent hover:border-white/20 hover:scale-105'
                          }`}
                          style={{
                            background: `linear-gradient(135deg, ${preset.bgGradient[0]}, ${preset.bgGradient[1]})`,
                            color: preset.textPrimaryColor,
                          }}
                        >
                          {preset.presetName}
                        </button>
                      ))}
                    </div>

                    {/* Advanced editor */}
                    {showStylePanel && (
                      <div className="space-y-3 pt-1 border-t border-border">
                        {/* Background */}
                        <div>
                          <p className="text-[10px] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Fundo (gradiente)</p>
                          <div className="flex gap-3 items-center">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] text-text-muted">Topo</label>
                              <input type="color" value={storyStyle.bgGradient[0]}
                                onChange={e => setStoryStyle(s => ({...s, bgGradient: [e.target.value, s.bgGradient[1]], bgColor: e.target.value, presetName: 'Custom'}))}
                                className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] text-text-muted">Base</label>
                              <input type="color" value={storyStyle.bgGradient[1]}
                                onChange={e => setStoryStyle(s => ({...s, bgGradient: [s.bgGradient[0], e.target.value], presetName: 'Custom'}))}
                                className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                            </div>
                          </div>
                        </div>

                        {/* Box */}
                        <div>
                          <p className="text-[10px] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Caixa de texto</p>
                          <div className="flex gap-3 items-center flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] text-text-muted">Cor</label>
                              <input type="color" value={storyStyle.boxColor}
                                onChange={e => setStoryStyle(s => ({...s, boxColor: e.target.value, presetName: 'Custom'}))}
                                className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                            </div>
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <label className="text-[10px] text-text-muted whitespace-nowrap">
                                Opac. {Math.round(storyStyle.boxOpacity * 100)}%
                              </label>
                              <input type="range" min={0} max={100} value={Math.round(storyStyle.boxOpacity * 100)}
                                onChange={e => setStoryStyle(s => ({...s, boxOpacity: parseInt(e.target.value) / 100, presetName: 'Custom'}))}
                                className="flex-1 accent-pink-500" />
                            </div>
                          </div>
                        </div>

                        {/* Cor do preço */}
                        <div>
                          <p className="text-[10px] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Cor do preço</p>
                          <div className="flex items-center gap-2">
                            <input type="color" value={storyStyle.priceColor}
                              onChange={e => setStoryStyle(s => ({...s, priceColor: e.target.value, presetName: 'Custom'}))}
                              className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                            <span className="text-[10px] text-text-muted">Aparece abaixo da imagem do produto</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setStoryStyle(STORY_PRESETS[0])}
                            className="flex-1 py-1.5 rounded-lg border border-border text-[10px] text-text-muted hover:border-pink-500/40 transition-colors">
                            ↩ Resetar
                          </button>
                          <button onClick={() => { localStorage.setItem('manu_story_style', JSON.stringify(storyStyle)); }}
                            className="flex-1 py-1.5 rounded-lg border border-emerald-500/30 text-[10px] text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                            💾 Salvar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── ✏️ Texto do Story — editor visual por bloco ── */}
                  {([
                    { block: 'headline'    as const, label: 'HEADLINE',    hint: 'gancho principal', labelColor: 'text-pink-400',   text: storyHeadline,    setText: setStoryHeadline,    ph: '💀 ESSE TÊNIS TÁ DIFERENTE' },
                    { block: 'subheadline' as const, label: 'SUBHEADLINE', hint: 'comparação',       labelColor: 'text-blue-400',   text: storySubheadline, setText: setStorySubheadline, ph: 'DE R$ 389 → R$ 199' },
                    { block: 'cta'         as const, label: 'CTA',         hint: 'ação',             labelColor: 'text-yellow-400', text: storyCta,         setText: setStoryCta,         ph: '🔥 CORRE QUE ACABA' },
                  ]).map(({ block, label, hint, labelColor, text, setText, ph }) => {
                    const cfg = blockConfigs[block];
                    const activePreset = TEXT_STYLE_PRESETS.find(p => p.id === cfg.stylePresetId) ?? TEXT_STYLE_PRESETS[0];
                    const updateCfg = (patch: Partial<TextBlockConfig>) =>
                      setBlockConfigs(prev => ({ ...prev, [block]: { ...prev[block], ...patch } }));
                    return (
                      <div key={block} className="rounded-xl border border-border bg-background/40 p-3 space-y-2">
                        {/* Header */}
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${labelColor}`}>{label}</span>
                          <span className="text-[10px] text-text-muted opacity-60">({hint})</span>
                        </div>
                        {/* Text input */}
                        <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder={ph}
                          className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-text-primary text-xs placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-pink-500"
                          style={{ fontFamily: activePreset.fontFamily === 'sans-serif' ? 'sans-serif' : `'${activePreset.fontFamily}', sans-serif`, fontWeight: activePreset.fontWeight }} />
                        {/* Style presets */}
                        <div className="flex gap-1 overflow-x-auto pb-0.5">
                          {TEXT_STYLE_PRESETS.map(preset => (
                            <button key={preset.id}
                              onClick={() => updateCfg({ stylePresetId: preset.id })}
                              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] border transition-all ${
                                cfg.stylePresetId === preset.id
                                  ? 'border-pink-500 bg-pink-500/15 text-pink-400'
                                  : 'border-border text-text-muted hover:border-pink-400/40 hover:text-text-primary'
                              }`}
                              style={{ fontFamily: preset.fontFamily==='sans-serif'?'sans-serif':`'${preset.fontFamily}',sans-serif`, fontWeight: preset.fontWeight, letterSpacing:`${preset.letterSpacing}px`, textTransform: preset.uppercase?'uppercase':'none' }}
                            >
                              {preset.name}
                            </button>
                          ))}
                        </div>
                        {/* Mode + Color + Size */}
                        <div className="flex items-center gap-2">
                          {/* Modes */}
                          <div className="flex gap-0.5">
                            {TEXT_MODES.map(mode => (
                              <button key={mode.id} title={mode.label}
                                onClick={() => updateCfg({ mode: mode.id })}
                                className={`w-7 h-7 rounded text-[10px] font-bold flex items-center justify-center border transition-all ${
                                  cfg.mode === mode.id
                                    ? 'border-pink-500 bg-pink-500/15 text-pink-400'
                                    : 'border-border text-text-muted hover:border-pink-400/40'
                                }`}
                              >{mode.icon}</button>
                            ))}
                          </div>
                          {/* Color swatches */}
                          <div className="flex gap-1 flex-1 items-center">
                            {QUICK_COLORS.map(c => (
                              <button key={c}
                                onClick={() => updateCfg({ color: c })}
                                className={`w-4 h-4 rounded-full flex-shrink-0 border-2 transition-all ${cfg.color===c?'border-pink-500 scale-125':'border-transparent hover:border-white/40'}`}
                                style={{ background: c, outline: c==='#ffffff'?'1px solid rgba(255,255,255,0.2)':'none' }}
                              />
                            ))}
                            <input type="color" value={cfg.color} onChange={e => updateCfg({ color: e.target.value })}
                              className="w-4 h-4 rounded cursor-pointer border-0 p-0 flex-shrink-0" />
                          </div>
                          {/* Size S/M/L */}
                          <div className="flex gap-0.5 flex-shrink-0">
                            {(['S','M','L'] as const).map(s => (
                              <button key={s}
                                onClick={() => updateCfg({ size: s })}
                                className={`w-6 h-6 rounded text-[9px] font-bold border transition-all ${
                                  cfg.size===s ? 'border-pink-500 bg-pink-500/15 text-pink-400' : 'border-border text-text-muted hover:border-pink-400/40'
                                }`}
                              >{s}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Video story status */}
              {storyType === 'video' && !hasVideo && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  ⚠️ Faça upload de um vídeo (seção à esquerda) para publicar como Story
                </p>
              )}
              {storyType === 'video' && hasVideo && (
                <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  ✓ Vídeo pronto — será publicado como Story
                </p>
              )}

              {/* Publish button */}
              <button onClick={handlePostStory}
                disabled={postingStory || (storyType === 'image' && !storyImageFile) || (storyType === 'video' && !hasVideo)}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white font-bold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
              >
                {postingStory
                  ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Publicando Story...</>
                  : '✨ Publicar Story'}
              </button>

              {storyResult && (
                <div className={`p-2 rounded-lg text-xs ${storyResult.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                  {storyResult.error ? `✗ ${storyResult.error}` : `✓ Story publicado! (ID: ${storyResult.url})`}
                </div>
              )}

              {/* Divisor */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">ou</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Compartilhar */}
              <button onClick={handleShareToInstagram}
                disabled={sharing || (storyType === 'image' && !storyImageFile) || (storyType === 'video' && !hasVideo)}
                className="w-full py-2.5 rounded-lg border-2 border-pink-500/50 bg-pink-500/5 text-pink-400 font-bold text-sm hover:bg-pink-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {sharing
                  ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Preparando...</>
                  : <><span>📲</span> Enviar para o Instagram (com sticker de link)</>}
              </button>
              <p className="text-[10px] text-text-muted text-center -mt-1">
                Abre o compartilhamento do celular → escolha Instagram → adicione o sticker de link
              </p>

              {shareStatus === 'shared' && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                  ✓ Mídia enviada! Agora escolha o Instagram, adicione o sticker de link e publique.
                </div>
              )}

              {shareStatus === 'unsupported' && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs space-y-2">
                  <p className="text-blue-400 font-semibold">📱 Abra esta página no celular para compartilhar</p>
                  <p className="text-text-muted">No computador, baixe a mídia e envie para o celular via WhatsApp ou AirDrop.</p>
                  {shareDownloadUrl && (
                    <a href={shareDownloadUrl} download={storyType === 'video' ? 'story.mp4' : 'story.jpg'}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-blue-500/20 text-blue-400 font-semibold hover:bg-blue-500/30 transition-colors">
                      ⬇️ Baixar mídia do Story
                    </a>
                  )}
                  {effectiveProduct?.affiliateUrl && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-text-muted">Link para o sticker (copie e cole no Instagram):</p>
                      <div className="flex items-center gap-2 bg-background rounded-lg px-2 py-1.5 border border-border">
                        <p className="text-xs text-text-primary font-mono flex-1 truncate">{effectiveProduct.affiliateUrl}</p>
                        <button onClick={() => navigator.clipboard.writeText(effectiveProduct!.affiliateUrl)}
                          className="text-[10px] text-blue-400 hover:text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded whitespace-nowrap">
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
