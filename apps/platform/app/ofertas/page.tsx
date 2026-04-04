'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, Offer, publishToSite } from '@/lib/api';
import { fetchWithAuth } from '@/lib/auth';
import { cn, formatCurrency, getUrgencyLabel } from '@/lib/utils';

export default function OfertasPage() {
  const [showForm, setShowForm] = useState(false);

  // Buscar ofertas
  const { data: offers, mutate } = useSWR<(Offer & { _count: { drafts: number; offerPublications: number } })[]>(
    '/api/offers?active=true',
    fetcher
  );

  // Buscar nichos e lojas para o formulário
  const { data: niches } = useSWR('/api/offers/niches', fetcher);
  const { data: stores } = useSWR('/api/offers/stores', fetcher);
  const { data: batches } = useSWR('/api/batches', fetcher);

  type PaymentMethod = 'pix' | 'avista' | 'parcelado';

  // Estado do formulário
  const [form, setForm] = useState({
    title: '',
    originalPrice: '',
    finalPrice: '',
    affiliateUrl: '',
    nicheId: '',
    storeId: '',
    urgency: 'NORMAL',
    mainImage: '', // 🤖 v2.0: Imagem obrigatória
    images: [] as string[], // 🎠 Galeria de imagens (carrossel)
    paymentMethod: 'avista' as PaymentMethod,
    installments: 12,
    couponCode: '', // 🏷️ Cupom de desconto (opcional)
  });

  // Estado de forma de pagamento por card (para publicação)
  const [cardPayment, setCardPayment] = useState<Record<string, PaymentMethod>>({});
  const [cardInstallments, setCardInstallments] = useState<Record<string, number>>({});
  // Valor por parcela inserido manualmente pelo usuário
  const [cardInstallmentValue, setCardInstallmentValue] = useState<Record<string, string>>({});
  // Modo de frase: 'brand' usa frases da marca detectada | 'generic' usa frases genéricas do tipo
  const [cardPhraseMode, setCardPhraseMode] = useState<Record<string, 'brand' | 'generic'>>({});

  // ── FEATURE 1: Filtro por nicho ──────────────────────────────────────────
  const [filterNiche, setFilterNiche] = useState<string | null>(null);

  // ── FEATURE 2: Preview do post ───────────────────────────────────────────
  const [previewModal, setPreviewModal] = useState<{
    offerId: string;
    offer: any;
    previewText: string | null;
    loadingPreview: boolean;
  } | null>(null);
  const [previewEditing, setPreviewEditing] = useState(false);
  const [previewEditText, setPreviewEditText] = useState('');
  const [creativePhrase, setCreativePhrase] = useState('');
  const [generatingAiPhrase, setGeneratingAiPhrase] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponType, setCouponType] = useState<'percent' | 'fixed'>('percent');
  const [couponValue, setCouponValue] = useState('');
  const [autoCoupon, setAutoCoupon] = useState<{ available: boolean; percentage: number | null; savings: number | null; isAutomatic: boolean } | null>(null);
  const [loadingAutoCoupon, setLoadingAutoCoupon] = useState(false);

  const generateAiPhrase = async (offer: any) => {
    setGeneratingAiPhrase(true);
    try {
      const title = offer.title || '';
      const price = offer.finalPrice || offer.price || 0;
      const oldPrice = offer.originalPrice || offer.oldPrice || null;
      const discount = offer.discount || offer.discountPct || 0;
      const store = offer.store?.name || '';
      const niche = offer.niche?.name || '';

      const prompt = `Você é a Manu, do canal "manu das promoções". Crie UMA frase de abertura para um post de promoção no X (Twitter).

PRODUTO: ${title}
PREÇO: R$ ${Number(price).toFixed(2)}${oldPrice ? ` (de R$ ${Number(oldPrice).toFixed(2)})` : ''}${discount > 0 ? ` — ${Math.round(discount)}% OFF` : ''}${store ? `\nLOJA: ${store}` : ''}${niche ? `\nNICHO: ${niche}` : ''}

PERSONALIDADE DA FRASE:
- Criativa, divertida, com humor leve (levemente ácido mas nunca ofensivo)
- INTERATIVA: fale direto com o seguidor, como se tivesse conversando
- CONEXÃO COM O PRODUTO: a frase PRECISA ter relação direta ou indireta com o produto/nicho. O leitor deve entender que a frase se refere àquele produto
- Pode ser sutil/subentendida, mas precisa ter nexo
- Nunca use frases genéricas que servem pra qualquer produto
- 1-2 emojis no máximo
- Máximo 70 caracteres
- NÃO repita o nome do produto na frase
- NÃO use hashtags
- Gere APENAS a frase, sem explicação

EXEMPLOS DE ESTILO (para diferentes nichos):
- Notebook gamer: "🎮 Seu PC chorando de vergonha em 3, 2, 1..."
- Fone bluetooth: "👂 Seus ouvidos vão te agradecer (ou não)"
- Smartphone: "📱 Teu celular atual tá pedindo aposentadoria"
- Panela elétrica: "🍳 Cozinhar igual chef sem saber fritar ovo?"
- Tênis: "👟 Correr da promoção é pior que correr na esteira"
- TV: "📺 Seu sofá merece essa atualização"
- Aspirador: "🤖 Pra quem odeia varrer (ou seja, todo mundo)"
- Desconto grande: "💸 A loja tá bem? Esse preço tá ok?"

Gere uma frase ÚNICA e ORIGINAL que se conecte especificamente com "${title.substring(0, 50)}":`;

      const res = await fetchWithAuth('/api/ai/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 100 }),
      });
      const data = await res.json();
      if (data.text) {
        const phrase = data.text.trim().replace(/^["']|["']$/g, '').replace(/\n.*/g, '').substring(0, 80);
        setCreativePhrase(phrase);
      }
    } catch (err) {
      console.error('Erro ao gerar frase IA:', err);
    } finally {
      setGeneratingAiPhrase(false);
    }
  };

  const getCouponLine = () => {
    const code = couponCode.trim().toUpperCase();
    const val = parseFloat(couponValue);
    // Manual coupon takes priority
    if (code && val && val > 0) {
      if (couponType === 'percent') {
        return `CUPOM #${code} ➡️ Aplicar ${val}% OFF.`;
      }
      return `CUPOM #${code} ➡️ R$${val.toFixed(0)} de desconto.`;
    }
    // Auto-detected coupon from product page
    if (autoCoupon?.available) {
      if (autoCoupon.percentage && autoCoupon.percentage > 0) {
        return `🎟️ Cupom automático de ${autoCoupon.percentage}% OFF no checkout — só clicar em Aplicar!`;
      }
      if (autoCoupon.savings && autoCoupon.savings > 0) {
        return `🎟️ Cupom automático de R$${autoCoupon.savings.toFixed(0)} OFF no checkout — só clicar em Aplicar!`;
      }
    }
    return '';
  };

  const getFullPreviewText = (baseText: string | null) => {
    if (!baseText) return '';
    const couponLine = getCouponLine();
    let text = baseText;
    if (couponLine) {
      const linkMatch = text.match(/(👉\s*https?:\/\/\S+)/);
      if (linkMatch) {
        text = text.replace(linkMatch[0], `${couponLine}\n${linkMatch[0]}`);
      } else {
        text = `${text}\n${couponLine}`;
      }
    }
    if (!creativePhrase.trim()) return text;
    return `${creativePhrase.trim()}\n\n${text}`;
  };

  // X (Twitter) counts every URL as exactly 23 chars (t.co shortening)
  // This is the correct way to count tweet length
  const getXCharCount = (text: string) => {
    const URL_REGEX = /https?:\/\/\S+/g;
    const X_URL_LENGTH = 23;
    const replaced = text.replace(URL_REGEX, '_'.repeat(X_URL_LENGTH));
    return replaced.length;
  };

  // Detecta cupom automático via scraping da URL do ML
  const detectAutoCoupon = async (affiliateUrl: string | null) => {
    if (!affiliateUrl) return;
    const isML = affiliateUrl.includes('mercadolivre') || affiliateUrl.includes('mercadolibre') || affiliateUrl.includes('meli.la');
    if (!isML) return;

    setLoadingAutoCoupon(true);
    try {
      const res = await fetchWithAuth('/api/affiliates/generate', {
        method: 'POST',
        body: JSON.stringify({ url: affiliateUrl }),
      });
      const data = await res.json();
      if (data.success && data.data?.product?.coupon?.available) {
        setAutoCoupon(data.data.product.coupon);
      } else {
        setAutoCoupon(null);
      }
    } catch {
      setAutoCoupon(null);
    } finally {
      setLoadingAutoCoupon(false);
    }
  };

  // Carrega o preview real do servidor
  const loadPreview = async (offerId: string, offer: any) => {
    setCreativePhrase('');
    setCouponCode('');
    setCouponValue('');
    setAutoCoupon(null);
    setPreviewModal({ offerId, offer, previewText: null, loadingPreview: true });

    // Detectar cupom automático em paralelo
    detectAutoCoupon(offer.affiliateUrl);

    try {
      const pm = cardPayment[offerId] || 'avista';
      const inst = cardInstallments[offerId] ?? 12;
      const instValRaw = cardInstallmentValue[offerId];
      const instVal = instValRaw ? parseFloat(instValRaw.replace(',', '.')) : undefined;
      const phraseMode = cardPhraseMode[offerId] ?? 'generic';

      const params = new URLSearchParams({
        paymentMethod: pm,
        installments: String(inst),
        phraseMode,
        ...(instVal ? { installmentValue: String(instVal) } : {}),
      });

      const res = await fetchWithAuth(`/api/twitter/preview/${offerId}?${params}`);
      const data = await res.json();
      setPreviewModal(prev => prev ? { ...prev, previewText: data.preview || 'Erro ao gerar preview', loadingPreview: false } : null);
    } catch {
      setPreviewModal(prev => prev ? { ...prev, previewText: 'Erro ao carregar preview', loadingPreview: false } : null);
    }
  };

  // ── FEATURE 4: Indicador de qualidade ───────────────────────────────────
  const getQualityIndicator = (offer: any) => {
    let score = 0;
    const discount = Number(offer.discount || offer.discountPct || 0);
    if (discount >= 40) score += 3;
    else if (discount >= 25) score += 2;
    else if (discount >= 10) score += 1;
    if (offer.mainImage || offer.imageUrl) score += 1;
    if (offer.aiPriorityScore && Number(offer.aiPriorityScore) >= 7) score += 1;
    if (score >= 4) return { label: '🔥 Quente', cls: 'bg-orange-500/20 text-orange-400' };
    if (score >= 2) return { label: '✅ Boa', cls: 'bg-green-500/20 text-green-400' };
    return { label: '⚠️ Fraca', cls: 'bg-yellow-500/20 text-yellow-400' };
  };

  // Estado para criar post manual
  const [createManualPost, setCreateManualPost] = useState(false);
  const [manualCopyText, setManualCopyText] = useState({
    copyText: '',
    copyTextTelegram: '',
    copyTextSite: '',
    copyTextX: '',
  });

  // 🤖 v2.0: Estado de upload de imagem
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  // 🔍 Busca de imagens (Google B + Scraper A como fallback)
  const [searchingImages, setSearchingImages] = useState(false);
  const [imageResults, setImageResults] = useState<{ url: string; thumbnail: string; title: string }[]>([]);
  const [imageSearchMode, setImageSearchMode] = useState<'google' | 'scraper' | null>(null);
  const [scraperImages, setScraperImages] = useState<string[]>([]);

  // Estado de loading
  const [isCreating, setIsCreating] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [productUrl, setProductUrl] = useState('');

  // 🔍 Buscar dados do produto automaticamente via URL
  const handleScrapeProduct = async () => {
    if (!productUrl) {
      alert('Cole a URL do produto primeiro!');
      return;
    }

    setIsScraping(true);

    try {
      // Verificar se a API está acessível antes de fazer a requisição
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      console.log('[Scraper] Fazendo requisição para:', `${API_URL}/api/scraper/product`);
      console.log('[Scraper] URL do produto:', productUrl);
      
      // Criar AbortController para timeout de 60 segundos (scraping pode demorar)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetchWithAuth('/api/scraper/product', {
        method: 'POST',
        body: JSON.stringify({ url: productUrl }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Erro desconhecido' } }));
        throw new Error(error.error?.message || `Erro HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const productData = data.data;

      console.log('[Scraper] Dados recebidos:', productData);

      // Formatar preços para exibição (com vírgula brasileira)
      // O scraper agora retorna valores já em reais (não em centavos)
      const formatPriceForInput = (price: number | null | undefined): string => {
        if (!price || price === 0) return '';
        
        // O scraper já retorna valores em reais (ex: 36.90, 54.90)
        // Apenas formatar com vírgula (formato brasileiro)
        return price.toFixed(2).replace('.', ',');
      };

      console.log('[Scraper] Dados recebidos do scraper:', {
        finalPrice: productData.finalPrice,
        originalPrice: productData.originalPrice,
        finalPriceFormatted: formatPriceForInput(productData.finalPrice),
        originalPriceFormatted: formatPriceForInput(productData.originalPrice),
      });

      // Preencher formulário automaticamente
      setForm(prev => ({
        ...prev,
        title: productData.title || prev.title,
        finalPrice: formatPriceForInput(productData.finalPrice),
        originalPrice: formatPriceForInput(productData.originalPrice),
        affiliateUrl: productData.affiliateUrl || prev.affiliateUrl,
        mainImage: productData.mainImage || prev.mainImage,
        images: productData.images || prev.images,
      }));

      // Preview da imagem
      if (productData.mainImage) {
        setImagePreview(productData.mainImage);
      }

      // Preview da galeria
      if (productData.images && productData.images.length > 1) {
        setGalleryPreviews(productData.images.slice(1));
      }

      // 🔍 Disparar busca de imagens automaticamente (B primeiro, A como fallback)
      const allScraperImgs = productData.images ?? (productData.mainImage ? [productData.mainImage] : []);
      handleSearchImages(productData.title || '', allScraperImgs);

      alert(`✅ Dados extraídos!\n\n📦 ${productData.title}\n💰 R$ ${productData.finalPrice}\n🔍 Buscando imagens reais...`);

    } catch (error: any) {
      console.error('Erro ao buscar dados:', error);
      
      // Mensagem de erro mais detalhada
      let errorMessage = error.message || 'Erro desconhecido';
      
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        errorMessage = 'A requisição demorou muito. O produto pode estar indisponível ou a conexão está lenta.';
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        errorMessage = 'Não foi possível conectar à API. Verifique se a API está rodando em http://localhost:3001';
      } else if (error.message?.includes('401') || error.message?.includes('Não autenticado')) {
        errorMessage = 'Sessão expirada. Faça login novamente.';
      }
      
      alert(`❌ Erro ao buscar dados do produto:\n\n${errorMessage}\n\nTente colar manualmente os dados.`);
    } finally {
      setIsScraping(false);
    }
  };

  // 🔍 Buscar imagens — B (Google) primeiro, A (scraper) como fallback
  const handleSearchImages = async (title: string, scraperImgs?: string[]) => {
    if (!title) return;
    setSearchingImages(true);
    setImageResults([]);
    setImageSearchMode(null);

    // Guardar imagens do scraper para fallback
    if (scraperImgs && scraperImgs.length > 0) {
      setScraperImages(scraperImgs);
    }

    try {
      const response = await fetchWithAuth(`/api/images/search?q=${encodeURIComponent(title)}`);
      const data = await response.json();

      if (response.ok && data.images && data.images.length > 0) {
        setImageResults(data.images);
        setImageSearchMode('google');
      } else {
        // Google falhou → fallback para imagens do anúncio
        loadScraperFallback(scraperImgs);
      }
    } catch {
      loadScraperFallback(scraperImgs);
    } finally {
      setSearchingImages(false);
    }
  };

  const loadScraperFallback = (imgs?: string[]) => {
    const all = imgs ?? scraperImages;
    if (all.length > 0) {
      setImageResults(all.map(url => ({ url, thumbnail: url, title: 'Foto do anúncio' })));
      setImageSearchMode('scraper');
    }
  };

  const handleSelectImage = async (imageUrl: string) => {
    setUploadingImage(true);
    try {
      const response = await fetchWithAuth('/api/upload/url', {
        method: 'POST',
        body: JSON.stringify({ imageUrl, folder: 'promo-platform/offers' }),
      });
      const data = await response.json();
      if (response.ok && data.data?.url) {
        setForm(prev => ({ ...prev, mainImage: data.data.url }));
        setImagePreview(data.data.url);
        setImageResults([]);
        setImageSearchMode(null);
      } else {
        alert('❌ Não foi possível usar essa imagem. Tente outra.');
      }
    } catch {
      alert('❌ Erro ao carregar imagem. Tente outra.');
    } finally {
      setUploadingImage(false);
    }
  };

  // 🤖 v2.0: Upload de imagem para Cloudinary
  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetchWithAuth('/api/upload/file', {
        method: 'POST',
        body: formData,
        headers: {}, // Deixar o browser setar o content-type com boundary
      });
      
      const data = await response.json();
      
      // Verificar ambos formatos de resposta (data.url ou data.data.url)
      const imageUrl = data.url || data.data?.url;
      
      if (imageUrl) {
        setForm({ ...form, mainImage: imageUrl });
        setImagePreview(imageUrl);
      } else {
        throw new Error(data.message || data.error || 'Erro no upload');
      }
    } catch (error: any) {
      console.error('Erro no upload:', error);
      alert(`❌ Erro no upload: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  // 🤖 v2.0: Upload via URL
  const handleImageUrlUpload = async (url: string) => {
    if (!url) return;
    
    console.log('[Upload URL] Iniciando upload de:', url);
    setUploadingImage(true);
    
    try {
      const response = await fetchWithAuth('/api/upload/url', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: url }), // Corrigido: usar imageUrl
      });
      
      const data = await response.json();
      console.log('[Upload URL] Resposta:', data);
      
      // Verificar ambos formatos de resposta (data.url ou data.data.url)
      const imageUrl = data.url || data.data?.url;
      
      if (imageUrl) {
        console.log('[Upload URL] ✅ Imagem carregada:', imageUrl);
        setForm({ ...form, mainImage: imageUrl });
        setImagePreview(imageUrl);
        alert('✅ Imagem carregada com sucesso!');
      } else {
        console.error('[Upload URL] ❌ Formato inválido:', data);
        throw new Error(data.message || data.error || data.hint || 'Erro no upload - URL não retornada');
      }
    } catch (error: any) {
      console.error('[Upload URL] Erro:', error);
      alert(`❌ Erro no upload: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  // Criar oferta
  const handleCreate = async () => {
    // 🤖 v2.0: Validação com imagem OBRIGATÓRIA
    if (!form.title || !form.finalPrice) {
      alert('Preencha pelo menos: Título e Preço Final');
      return;
    }

    if (!form.mainImage) {
      alert('⚠️ IMAGEM OBRIGATÓRIA!\n\nA imagem é necessária para criar a oferta.\nFaça upload de uma imagem ou cole uma URL.');
      return;
    }

    setIsCreating(true);

    try {
      // Converter preços (aceitar vírgula ou ponto)
      const parsePrice = (priceStr: string): number => {
        if (!priceStr) return 0;
        // Remover espaços e caracteres não numéricos exceto vírgula e ponto
        let normalized = priceStr.toString().trim().replace(/[^\d,.-]/g, '');
        
        // Formato brasileiro: 483,18 ou 483.18
        // Se tiver vírgula, assumir formato brasileiro (vírgula = decimal)
        if (normalized.includes(',')) {
          // Remover pontos (separadores de milhar) e trocar vírgula por ponto
          normalized = normalized.replace(/\./g, '').replace(',', '.');
        }
        // Se não tiver vírgula mas tiver ponto, verificar se é decimal ou milhar
        else if (normalized.includes('.')) {
          // Se tiver mais de 2 dígitos após o ponto, provavelmente é separador de milhar
          const parts = normalized.split('.');
          if (parts.length > 2 || (parts[1] && parts[1].length > 2)) {
            // É separador de milhar, remover
            normalized = normalized.replace(/\./g, '');
          }
          // Caso contrário, manter como decimal
        }
        
        return parseFloat(normalized) || 0;
      };
      
      const finalPriceValue = parsePrice(form.finalPrice);
      const originalPriceValue = form.originalPrice ? parsePrice(form.originalPrice) : null;
      
      // Se os preços forem iguais ou não houver original, não há desconto
      const hasDiscount = originalPriceValue && originalPriceValue > finalPriceValue;
      
      const response = await fetchWithAuth('/api/offers', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          originalPrice: hasDiscount ? originalPriceValue : null,
          finalPrice: finalPriceValue,
          affiliateUrl: form.affiliateUrl || undefined,
          nicheId: form.nicheId || undefined,
          storeId: form.storeId || undefined,
          urgency: form.urgency || 'NORMAL',
          status: 'ACTIVE',
          // 🤖 v2.0: Campos de imagem
          mainImage: form.mainImage,
          imageUrl: form.mainImage, // Compatibilidade
          images: form.images, // 🎠 Galeria de imagens (carrossel)
          curationStatus: 'DRAFT', // Começa como rascunho
          couponCode: form.couponCode || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[Ofertas] Erro detalhado:', error);
        const errorMsg = error.error?.message || error.message || JSON.stringify(error);
        throw new Error(errorMsg);
      }

      // Limpar formulário
      setForm({
        title: '',
        originalPrice: '',
        finalPrice: '',
        affiliateUrl: '',
        nicheId: '',
        storeId: '',
        urgency: 'NORMAL',
        mainImage: '',
        images: [],
        paymentMethod: 'avista',
        installments: 12,
        couponCode: '',
      });
      setImagePreview(null);
      setGalleryPreviews([]);
      
      const createdOffer = await response.json();
      const offerId = createdOffer.data?.id || createdOffer.id;

      // Pré-popular forma de pagamento e parcelas do card com os valores do formulário,
      // evitando que a publicação use os defaults (avista / 12x) ao invés do que foi escolhido.
      if (offerId && form.paymentMethod !== 'avista') {
        setCardPayment(prev => ({ ...prev, [offerId]: form.paymentMethod }));
        if (form.paymentMethod === 'parcelado') {
          setCardInstallments(prev => ({ ...prev, [offerId]: form.installments }));
        }
      }

      // Se marcou para criar post manual, criar o draft com status PENDING
      if (createManualPost && offerId) {
        try {
          const draftResponse = await fetchWithAuth(`/api/offers/${offerId}/create-draft`, {
            method: 'POST',
            body: JSON.stringify({
              copyText: manualCopyText.copyText || undefined,
              copyTextTelegram: manualCopyText.copyTextTelegram || undefined,
              copyTextSite: manualCopyText.copyTextSite || undefined,
              copyTextX: manualCopyText.copyTextX || undefined,
              channels: ['TELEGRAM', 'SITE'],
              priority: 'NORMAL',
              createManual: true, // Flag para indicar que é manual
            }),
          });

          if (draftResponse.ok) {
            const draftData = await draftResponse.json();
            // Salvar frases personalizadas no banco
            if (draftData.data?.id) {
              try {
                await fetchWithAuth('/api/custom-phrases/save', {
                  method: 'POST',
                  body: JSON.stringify({
                    draftId: draftData.data.id,
                    phrases: {
                      copyText: manualCopyText.copyText,
                      copyTextTelegram: manualCopyText.copyTextTelegram,
                      copyTextSite: manualCopyText.copyTextSite,
                      copyTextX: manualCopyText.copyTextX,
                    },
                    productTitle: form.title,
                    category: form.nicheId,
                  }),
                });
              } catch (phraseError) {
                console.error('Erro ao salvar frases personalizadas:', phraseError);
              }
            }
          }
        } catch (error) {
          console.error('Erro ao criar post manual:', error);
        }
      }

      // Limpar formulário
      setForm({
        title: '',
        originalPrice: '',
        finalPrice: '',
        affiliateUrl: '',
        nicheId: '',
        storeId: '',
        urgency: 'NORMAL',
        mainImage: '',
        images: [],
        paymentMethod: 'avista',
        installments: 12,
        couponCode: '',
      });
      setImagePreview(null);
      setGalleryPreviews([]);
      setCreateManualPost(false);
      setManualCopyText({
        copyText: '',
        copyTextTelegram: '',
        copyTextSite: '',
        copyTextX: '',
      });
      
      setShowForm(false);
      mutate();
      
      if (createManualPost) {
        alert('✅ Oferta criada com sucesso!\n\n📝 Post manual criado com status PENDING\n\nVocê pode editar as frases no Dashboard.');
      } else {
        alert('✅ Oferta criada com sucesso!\n\n📌 Status: RASCUNHO\n\nAprove a oferta para ativar o processamento da IA.');
      }
    } catch (error: any) {
      console.error('Erro ao criar oferta:', error);
      alert(`❌ Erro: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Estado de loading para X
  const [postingToX, setPostingToX] = useState<string | null>(null);
  
  // Estado de loading para Site
  const [publishingToSite, setPublishingToSite] = useState<string | null>(null);
  
  // Estado de loading para Telegram
  const [postingToTelegram, setPostingToTelegram] = useState<string | null>(null);
  
  // Estado de loading para Facebook
  const [postingToFacebook, setPostingToFacebook] = useState<string | null>(null);

  // 🤖 v2.0: Estados de IA
  const [approvingOffer, setApprovingOffer] = useState<string | null>(null);
  const [processingAI, setProcessingAI] = useState<string | null>(null);

  // 🤖 v2.0: Aprovar oferta para IA
  const handleApproveOffer = async (offerId: string) => {
    if (approvingOffer) return;
    setApprovingOffer(offerId);

    try {
      const response = await fetchWithAuth(`/api/offers/${offerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          curationStatus: 'APPROVED',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao aprovar');
      }

      alert('✅ Oferta aprovada!\n\nAgora clique em "Enviar para IA" para processar.');
      mutate();
    } catch (error: any) {
      console.error('Erro ao aprovar:', error);
      alert(`❌ Erro: ${error.message}`);
    } finally {
      setApprovingOffer(null);
    }
  };

  // 🤖 v2.0: Processar oferta com IA
  const handleProcessAI = async (offerId: string) => {
    if (processingAI) return;
    setProcessingAI(offerId);

    try {
      const response = await fetchWithAuth('/api/ai/process', {
        method: 'POST',
        body: JSON.stringify({ offerId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro no processamento');
      }

      const jobsInfo = data.jobs?.map((j: any) => `• ${j.network}: ${j.agentName}`).join('\n') || '';
      
      alert(`✅ IA processou a oferta!\n\nScore: ${data.curadora?.priorityScore || '-'}\nRisco: ${data.curadora?.riskLevel || '-'}\n\nJobs criados:\n${jobsInfo}`);
      mutate();
    } catch (error: any) {
      console.error('Erro no processamento IA:', error);
      alert(`❌ Erro: ${error.message}`);
    } finally {
      setProcessingAI(null);
    }
  };

  // Publicar no site
  const handlePublishToSite = async (offerId: string) => {
    if (publishingToSite) return;
    
    setPublishingToSite(offerId);
    
    try {
      const result = await publishToSite(offerId);
      
      if (result.success) {
        alert(`✅ Publicado no site com sucesso!\n\n🔗 ${result.siteUrl || 'Publicação criada!'}`);
        mutate();
      } else {
        alert(`❌ Erro ao publicar no site:\n${result.error}`);
      }
    } catch (error: any) {
      console.error('Erro ao publicar no site:', error);
      alert(`❌ Erro ao publicar no site:\n${error.message}`);
    } finally {
      setPublishingToSite(null);
    }
  };

  // Postar diretamente no X (Twitter) — abre preview primeiro
  const handlePostToX = (offerId: string, offer: any) => {
    loadPreview(offerId, offer);
  };

  // Confirmar postagem no X após preview
  const handleConfirmPostToX = async () => {
    if (!previewModal || postingToX || !previewModal.previewText) return;
    const { offerId } = previewModal;
    const previewText = getFullPreviewText(previewModal.previewText);
    setPostingToX(offerId);

    try {
      const statusResponse = await fetchWithAuth('/api/twitter/status');
      const statusData = await statusResponse.json();

      if (!statusData.configured) {
        alert('⚠️ Twitter API não configurada.\n\nConfigure as variáveis de ambiente:\n- TWITTER_API_KEY\n- TWITTER_API_SECRET\n- TWITTER_ACCESS_TOKEN\n- TWITTER_ACCESS_TOKEN_SECRET');
        return;
      }

      const pm = cardPayment[offerId] || 'avista';
      const inst = cardInstallments[offerId] ?? 12;
      const instValRaw = cardInstallmentValue[offerId];
      const instVal = instValRaw
        ? parseFloat(instValRaw.replace(',', '.'))
        : undefined;

      const phraseMode = cardPhraseMode[offerId] ?? 'generic';

      // Passa o texto exato do preview — garante que o post sai igual ao preview
      const response = await fetchWithAuth(`/api/twitter/post-offer/${offerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: pm, installments: inst, installmentValue: instVal, phraseMode, customText: previewText }),
      });

      const data = await response.json();

      if (data.success) {
        setPreviewModal(null);
        alert(`✅ Postado no X com sucesso!\n\n🔗 ${data.tweetUrl || 'Tweet criado!'}`);
        mutate();
      } else {
        alert(`❌ Erro ao postar no X:\n${data.error}`);
      }
    } catch (error: any) {
      console.error('Erro ao postar no X:', error);
      alert(`❌ Erro ao postar no X:\n${error.message}`);
    } finally {
      setPostingToX(null);
    }
  };

  // Criar draft a partir de oferta
  // Estado de loading para criar draft
  const [creatingDraft, setCreatingDraft] = useState<string | null>(null);

  const handleCreateDraft = async (offerId: string) => {
    if (creatingDraft) return; // Evitar duplo clique
    
    setCreatingDraft(offerId);

    try {
      const response = await fetchWithAuth(`/api/offers/${offerId}/create-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channels: ['TELEGRAM', 'SITE'],
          priority: 'NORMAL',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao criar draft');
      }

      // Mostrar sucesso
      alert('✅ Post criado com sucesso!\n\nEle está pendente de aprovação no Dashboard.');
      
      // Atualizar lista de ofertas
    } catch (error: any) {
      console.error('Erro ao criar draft:', error);
      alert(`❌ Erro ao criar post:\n${error.message}`);
    } finally {
      setCreatingDraft(null);
    }
  };
  
  // 🗑️ Deletar oferta
  const [deletingOffer, setDeletingOffer] = useState<string | null>(null);
  
  const handleDeleteOffer = async (offerId: string, offerTitle: string) => {
    // Confirmar antes de deletar
    const confirmDelete = confirm(`🗑️ Tem certeza que deseja DELETAR esta oferta?\n\n"${offerTitle}"\n\n⚠️ Esta ação não pode ser desfeita!`);
    
    if (!confirmDelete) return;
    
    setDeletingOffer(offerId);
    
    try {
      const response = await fetchWithAuth(`/api/offers/${offerId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Erro ao deletar oferta');
      }
      
      alert('✅ Oferta deletada com sucesso!');
      
      // Atualizar lista de ofertas
      await mutate();
    } catch (error: any) {
      console.error('Erro ao deletar oferta:', error);
      alert(`❌ Erro ao deletar oferta:\n${error.message}`);
    } finally {
      setDeletingOffer(null);
    }
  };

  // Postar diretamente no Telegram
  const handlePostToTelegram = async (offerId: string) => {
    if (postingToTelegram) return;
    
    setPostingToTelegram(offerId);
    
    try {
      const pm   = cardPayment[offerId] || 'avista';
      const inst = cardInstallments[offerId] ?? 12;
      const instValRaw = cardInstallmentValue[offerId];
      const instVal = instValRaw
        ? parseFloat(instValRaw.replace(',', '.'))
        : undefined;

      const phraseModeT = cardPhraseMode[offerId] ?? 'generic';
      const response = await fetchWithAuth(`/api/telegram/post-offer/${offerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: pm, installments: inst, installmentValue: instVal, phraseMode: phraseModeT }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao postar no Telegram');
      }
      
      // Mensagem customizada se enviou só texto
      if (data.sentTextOnly) {
        alert(`⚠️ Postado no Telegram (apenas texto)\n\nA foto não pôde ser enviada, mas o texto com link de afiliado foi postado com sucesso!\n\n📱 Message ID: ${data.messageId || 'Enviado'}`);
      } else {
        alert(`✅ Postado no Telegram com sucesso!\n\n📱 Message ID: ${data.messageId || 'Enviado'}`);
      }
      
      mutate();
    } catch (error: any) {
      console.error('Erro ao postar no Telegram:', error);
      alert(`❌ Erro ao postar no Telegram:\n${error.message}`);
    } finally {
      setPostingToTelegram(null);
    }
  };
  
  // Postar diretamente no Facebook
  const handlePostToFacebook = async (offerId: string) => {
    if (postingToFacebook) return;
    
    setPostingToFacebook(offerId);
    
    try {
      const response = await fetchWithAuth(`/api/facebook/post-offer/${offerId}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        // Extrair mensagem de erro corretamente
        const errorMessage = data.error?.message || data.error || data.message || 'Erro ao postar no Facebook';
        throw new Error(errorMessage);
      }
      
      // Exibir resumo de postagem em múltiplas páginas
      const summary = data.data?.summary;
      if (summary) {
        alert(`✅ Postado no Facebook!\n\n📊 Páginas: ${summary.success}/${summary.total} com sucesso\n${summary.failed > 0 ? `⚠️ ${summary.failed} falharam` : '✅ Todas postaram!'}`);
      } else {
        alert(`✅ Postado no Facebook com sucesso!`);
      }
      
      mutate();
    } catch (error: any) {
      console.error('Erro ao postar no Facebook:', error);
      alert(`❌ Erro ao postar no Facebook:\n${error.message}`);
    } finally {
      setPostingToFacebook(null);
    }
  };

  const offersData: any[] = (Array.isArray(offers) ? offers : (offers as any)?.data || []);
  const filteredOffers = offersData.filter((offer: any) =>
    !filterNiche || offer.niche?.id === filterNiche
  );

  return (
    <div className="p-6 space-y-6">
      {/* ── FEATURE 2: Modal de Preview ─────────────────────────────────── */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">
                🐦 Preview do Post no X
                {previewEditing && <span className="ml-2 text-xs text-yellow-400 font-normal">✏️ Modo Edição</span>}
              </h2>
              <button onClick={() => { setPreviewModal(null); setPreviewEditing(false); setCreativePhrase(''); setCouponCode(''); setCouponValue(''); setAutoCoupon(null); }} className="text-text-muted hover:text-text-primary text-xl">✕</button>
            </div>

            {/* Corpo */}
            <div className="p-5 space-y-4">
              {previewModal.loadingPreview ? (
                <div className="flex items-center justify-center py-8 text-text-muted">
                  <span className="text-sm">⏳ Gerando preview...</span>
                </div>
              ) : previewEditing ? (
                /* ── MODO EDIÇÃO LIVRE ── */
                <>
                  <p className="text-xs text-yellow-400">✏️ Edite o texto completo. O post sairá exatamente como você escrever.</p>
                  <textarea
                    value={previewEditText}
                    onChange={e => setPreviewEditText(e.target.value)}
                    rows={10}
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl bg-background border border-yellow-500/40 text-text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between">
                    <span className={cn('text-xs font-medium', getXCharCount(previewEditText) > 280 ? 'text-red-400' : getXCharCount(previewEditText) > 240 ? 'text-yellow-400' : 'text-green-400')}>
                      {getXCharCount(previewEditText)}/280 chars (X) {getXCharCount(previewEditText) > 280 ? `(${getXCharCount(previewEditText) - 280} a mais — o X vai rejeitar)` : '✅'}
                    </span>
                    <button
                      onClick={() => setPreviewEditing(false)}
                      className="text-xs text-text-muted hover:text-text-primary transition-all"
                    >
                      ← Voltar ao preview
                    </button>
                  </div>
                </>
              ) : (
                /* ── MODO PREVIEW COM FRASE CRIATIVA ── */
                <>
                  {/* Frase Criativa */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-text-primary">✨ Frase Criativa (abertura do post)</label>
                      <button
                        onClick={() => generateAiPhrase(previewModal.offer)}
                        disabled={generatingAiPhrase}
                        className="text-xs px-3 py-1 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300 font-medium transition-all disabled:opacity-50"
                      >
                        {generatingAiPhrase ? '⏳ Gerando...' : '🤖 Gerar com IA'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={creativePhrase}
                      onChange={e => setCreativePhrase(e.target.value)}
                      placeholder="Digite uma frase ou clique em Gerar com IA..."
                      maxLength={80}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-purple-500/30 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder:text-text-muted/50"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">{creativePhrase.length}/80 chars</span>
                      {creativePhrase && (
                        <button
                          onClick={() => setCreativePhrase('')}
                          className="text-xs text-red-400/70 hover:text-red-400 transition-all"
                        >
                          ✕ Limpar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Separador */}
                  <div className="border-t border-border/50" />

                  {/* Cupom automático detectado */}
                  {loadingAutoCoupon && (
                    <div className="bg-blue-950/30 border border-blue-700/40 rounded-lg px-3 py-2">
                      <p className="text-xs text-blue-300">🔍 Detectando cupom automático do produto...</p>
                    </div>
                  )}
                  {autoCoupon?.available && !couponCode.trim() && (
                    <div className="bg-green-950/30 border border-green-700/40 rounded-lg px-3 py-3 space-y-1">
                      <p className="text-xs font-bold text-green-300">🎟️ Cupom automático detectado!</p>
                      <p className="text-xs text-green-200">
                        {autoCoupon.percentage ? `${autoCoupon.percentage}% OFF` : `R$ ${autoCoupon.savings?.toFixed(0)} OFF`}
                        {' '}— aplicação automática no checkout (1 clique)
                      </p>
                      {autoCoupon.savings && (
                        <p className="text-xs text-green-400/80">Economia estimada: R$ {autoCoupon.savings.toFixed(2)}</p>
                      )}
                      <p className="text-[10px] text-green-400/60 mt-1">Será incluído automaticamente no post</p>
                    </div>
                  )}

                  {/* Cupom manual (código) */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-text-primary">
                      🏷️ Cupom com código <span className="text-text-muted font-normal">(manual — sobrepõe o automático)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {(['percent', 'fixed'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setCouponType(t)}
                          className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            couponType === t
                              ? 'border-amber-500 bg-amber-950/40 text-amber-300'
                              : 'border-border bg-background text-text-muted hover:border-text-muted'
                          }`}
                        >
                          {t === 'percent' ? '% Percentual' : 'R$ Valor fixo'}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Código do cupom"
                        className="px-3 py-2 rounded-lg bg-background border border-border text-text-primary text-sm font-mono tracking-wider uppercase focus:outline-none focus:border-amber-500 placeholder:text-text-muted/50"
                      />
                      <input
                        type="number"
                        value={couponValue}
                        onChange={e => setCouponValue(e.target.value)}
                        placeholder={couponType === 'percent' ? 'Ex: 15' : 'Ex: 30'}
                        min={0}
                        className="px-3 py-2 rounded-lg bg-background border border-border text-text-primary text-sm focus:outline-none focus:border-amber-500 placeholder:text-text-muted/50"
                      />
                    </div>
                    {getCouponLine() && (
                      <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg px-3 py-2">
                        <p className="text-xs text-amber-300 font-mono">{getCouponLine()}</p>
                      </div>
                    )}
                  </div>

                  {/* Separador */}
                  <div className="border-t border-border/50" />

                  {/* Preview combinado */}
                  <div>
                    <p className="text-xs text-text-muted mb-2">Preview final:</p>
                    <div className="bg-background rounded-xl border border-border p-4 font-mono text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                      {getFullPreviewText(previewModal.previewText)}
                    </div>
                    {(() => {
                      const fullXLen = getXCharCount(getFullPreviewText(previewModal.previewText));
                      return (
                        <div className="flex items-center justify-between mt-2">
                          <span className={cn('text-xs font-medium', fullXLen > 280 ? 'text-red-400' : fullXLen > 240 ? 'text-yellow-400' : 'text-green-400')}>
                            {fullXLen}/280 chars (X) {fullXLen > 280 ? `(${fullXLen - 280} a mais — use ✏️ Editar Tudo)` : '✅ Pode postar!'}
                          </span>
                          <div className="flex gap-3">
                            <button
                              onClick={() => loadPreview(previewModal.offerId, previewModal.offer)}
                              className="text-xs text-primary hover:text-primary/80 font-medium transition-all"
                            >
                              🔄 Nova Base
                            </button>
                            <button
                              onClick={() => { setPreviewEditText(getFullPreviewText(previewModal.previewText)); setPreviewEditing(true); }}
                              className="text-xs text-yellow-400 hover:text-yellow-300 font-medium transition-all"
                            >
                              ✏️ Editar Tudo
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>

            {/* Botões */}
            <div className="p-5 border-t border-border flex gap-3">
              <button
                onClick={() => { setPreviewModal(null); setPreviewEditing(false); setCreativePhrase(''); setCouponCode(''); setCouponValue(''); setAutoCoupon(null); }}
                className="flex-1 py-2 rounded-lg border border-border text-text-muted hover:text-text-primary transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (previewEditing && previewEditText.trim()) {
                    const editedText = previewEditText.trim();
                    setPreviewModal(prev => prev ? { ...prev, previewText: editedText } : null);
                    setCreativePhrase('');
                    setPreviewEditing(false);
                  } else {
                    handleConfirmPostToX();
                  }
                }}
                disabled={
                  previewModal.loadingPreview ||
                  !!postingToX ||
                  generatingAiPhrase ||
                  (previewEditing ? previewEditText.trim().length < 5 : !previewModal.previewText) ||
                  (!previewEditing && getXCharCount(getFullPreviewText(previewModal.previewText)) > 280) ||
                  (previewEditing && getXCharCount(previewEditText) > 280)
                }
                className={cn(
                  'flex-1 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                  previewEditing
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                )}
              >
                {postingToX ? '⏳ Postando...' : previewEditing ? '✅ Aplicar Edição' : '✅ Confirmar e Postar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">🏷️ Ofertas</h1>
          <p className="text-text-muted text-sm">
            Gerencie ofertas e crie posts
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition-all"
        >
          {showForm ? '✕ Cancelar' : '+ Nova Oferta'}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-surface rounded-xl border border-border p-6 animate-slide-in">
          <h3 className="text-lg font-semibold text-text-primary mb-4">🤖 Criar Oferta (v2.0 IA)</h3>
          <p className="text-sm text-text-muted mb-4">
            ✅ Campos obrigatórios: <strong>Título</strong>, <strong>Preço Final</strong> e <strong>Imagem</strong>.
          </p>
          
          {/* 🔍 AUTO-PREENCHIMENTO: Cole a URL do produto */}
          <div className="mb-6 p-4 rounded-lg border-2 border-dashed border-blue-500/50 bg-blue-500/5">
            <label className="block text-sm font-medium text-text-primary mb-2">
              🔗 Auto-Preencher com URL <span className="text-blue-400 text-xs">(Mercado Livre, Magalu, Amazon, Shark, etc.)</span>
            </label>
            <p className="text-xs text-text-muted mb-3">
              💡 Cole o link do produto e clique em <strong>"Buscar Dados"</strong> para preencher automaticamente: título, preços, imagem e desconto!
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://www.mercadolivre.com.br/produto/..."
                className="flex-1 px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleScrapeProduct();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleScrapeProduct}
                disabled={isScraping || !productUrl}
                className={cn(
                  "px-6 py-2 rounded-lg font-medium transition-all",
                  isScraping || !productUrl
                    ? "bg-gray-400 cursor-not-allowed text-white"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                )}
              >
                {isScraping ? '⏳ Buscando...' : '🔍 Buscar Dados'}
              </button>
            </div>
          </div>
          
          {/* 🔍 Grade de Busca de Imagens */}
          {(searchingImages || imageResults.length > 0) && (
            <div className="mb-6 p-4 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {searchingImages
                      ? '🔍 Buscando imagens reais...'
                      : imageSearchMode === 'google'
                        ? '🌐 Imagens encontradas no Google'
                        : '📦 Fotos do anúncio'}
                  </p>
                  {!searchingImages && imageSearchMode === 'scraper' && (
                    <p className="text-xs text-text-muted mt-0.5">Google não retornou imagens — usando fotos do anúncio</p>
                  )}
                  {!searchingImages && imageSearchMode === 'google' && (
                    <button
                      type="button"
                      onClick={() => loadScraperFallback()}
                      className="text-xs text-primary underline mt-0.5"
                    >
                      Ver fotos do anúncio
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setImageResults([]); setImageSearchMode(null); }}
                  className="text-xs text-text-muted hover:text-error transition-colors"
                >
                  ✕ Fechar
                </button>
              </div>

              {searchingImages ? (
                <div className="flex items-center justify-center py-8 text-text-muted text-sm">
                  <span className="animate-pulse">Buscando imagens lifestyle...</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {imageResults.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectImage(img.url)}
                      disabled={uploadingImage}
                      className="relative group rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all aspect-square"
                      title={img.title}
                    >
                      <img
                        src={img.thumbnail}
                        alt={img.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-lg">✓</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!searchingImages && form.title && (
                <button
                  type="button"
                  onClick={() => handleSearchImages(form.title, scraperImages)}
                  className="mt-3 text-xs text-primary underline"
                >
                  🔄 Buscar novamente
                </button>
              )}
            </div>
          )}

          {/* 🤖 v2.0: Upload de Imagem */}
          <div className="mb-6 p-4 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-text-primary">
                📷 Imagem Principal <span className="text-error">* OBRIGATÓRIO</span>
              </label>
              {form.title && !searchingImages && imageResults.length === 0 && (
                <button
                  type="button"
                  onClick={() => handleSearchImages(form.title, scraperImages)}
                  className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-all"
                >
                  🔍 Buscar imagens reais
                </button>
              )}
            </div>
            
            {imagePreview ? (
              <div className="flex items-start gap-4">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-32 h-32 object-cover rounded-lg border border-border"
                />
                <div className="flex-1">
                  <p className="text-sm text-success mb-2">✅ Imagem carregada!</p>
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setForm({ ...form, mainImage: '' });
                    }}
                    className="px-3 py-1 rounded bg-error/20 text-error text-sm hover:bg-error/30 transition-all"
                  >
                    🗑️ Remover
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-4">
                {/* Upload de arquivo */}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-lg cursor-pointer transition-all",
                      "bg-primary/20 hover:bg-primary/30 text-primary font-medium",
                      uploadingImage && "opacity-50 cursor-wait"
                    )}
                  >
                    {uploadingImage ? '⏳ Enviando...' : '📤 Upload de Arquivo'}
                  </label>
                </div>
                
                {/* Ou URL */}
                <div className="flex-1">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Ou cole a URL da imagem"
                      id="image-url-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleImageUrlUpload((e.target as HTMLInputElement).value);
                        }
                      }}
                      className="flex-1 px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('image-url-input') as HTMLInputElement;
                        if (input?.value) handleImageUrlUpload(input.value);
                      }}
                      disabled={uploadingImage}
                      className={cn(
                        "px-4 py-2 rounded-lg bg-primary text-white font-medium text-sm transition-all",
                        uploadingImage ? "opacity-50 cursor-wait" : "hover:bg-primary/90"
                      )}
                    >
                      {uploadingImage ? '⏳' : '✓'}
                    </button>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    Cole a URL e pressione Enter ou clique no ✓
                  </p>
                </div>
              </div>
            )}
          </div>
          
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm text-text-secondary mb-2">
                Título <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Celular Samsung Galaxy A16..."
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Nicho <span className="text-text-muted text-xs">(opcional)</span>
              </label>
              <select
                value={form.nicheId}
                onChange={(e) => setForm({ ...form, nicheId: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecione...</option>
                {niches?.map((n: any) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Preço Original <span className="text-text-muted text-xs">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.originalPrice}
                onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                placeholder="Ex: 483,18 ou 483.18"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Preço Final <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={form.finalPrice}
                onChange={(e) => setForm({ ...form, finalPrice: e.target.value })}
                placeholder="Ex: 256,41 ou 256.41"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Loja <span className="text-text-muted text-xs">(opcional)</span>
              </label>
              <select
                value={form.storeId}
                onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecione...</option>
                {stores?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {/* 💳 Forma de Pagamento */}
            <div className="lg:col-span-3">
              <label className="block text-sm text-text-secondary mb-2">
                💳 Forma de Pagamento
              </label>
              <div className="flex gap-2">
                {([
                  { value: 'pix',       label: '💸 PIX',       desc: 'Desconto no PIX' },
                  { value: 'avista',    label: '💵 À vista',   desc: 'Cartão / Boleto' },
                  { value: 'parcelado', label: '📅 Parcelado', desc: 'Sem desconto' },
                ] as { value: PaymentMethod; label: string; desc: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, paymentMethod: opt.value })}
                    className={cn(
                      'flex-1 py-2 px-2 rounded-lg border text-xs font-semibold transition-all text-center',
                      form.paymentMethod === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-text-muted hover:border-primary/40'
                    )}
                  >
                    <div>{opt.label}</div>
                    <div className="font-normal text-[10px] mt-0.5 opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>
              {form.paymentMethod === 'parcelado' && (
                <div className="mt-2 flex items-center gap-3">
                  <label className="text-xs text-text-muted whitespace-nowrap">Parcelas:</label>
                  <select
                    value={form.installments}
                    onChange={(e) => setForm({ ...form, installments: Number(e.target.value) })}
                    className="px-3 py-1.5 rounded-lg bg-background border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <option key={n} value={n}>{n}x</option>
                    ))}
                  </select>
                  {form.finalPrice && (
                    <span className="text-xs text-text-muted">
                      ≈ R$ {(parseFloat(form.finalPrice.replace(',', '.')) / form.installments).toFixed(2).replace('.', ',')}/parcela
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm text-text-secondary mb-2">
                Link Afiliado <span className="text-text-muted text-xs">(opcional)</span>
              </label>
              <input
                type="url"
                value={form.affiliateUrl}
                onChange={(e) => setForm({ ...form, affiliateUrl: e.target.value })}
                placeholder="https://mercadolivre.com/sec/2RaCjWg"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {!form.affiliateUrl && (
                <p className="mt-2 text-xs text-blue-400 flex items-center gap-1">
                  💡 <span><strong>Mercado Livre:</strong> busque o produto com o link direto, depois cole aqui o link <strong>meli.la</strong> ou o link completo com <strong>matt_word</strong> gerado no portal de afiliados.</span>
                </p>
              )}
              {form.affiliateUrl && form.affiliateUrl.includes('meli.la') && (
                <p className="mt-2 text-xs text-green-500 flex items-center gap-1">
                  ✅ Link curto meli.la detectado. Afiliado confirmado — será usado exatamente como está.
                </p>
              )}
              {form.affiliateUrl && (form.affiliateUrl.includes('mercadolivre') || form.affiliateUrl.includes('mercadolibre')) && !form.affiliateUrl.includes('meli.la') && !form.affiliateUrl.includes('matt_word') && (
                <p className="mt-2 text-xs text-yellow-500 flex items-center gap-1">
                  ⚠️ Link do ML sem afiliado. Use o link <strong>meli.la</strong> ou o link completo com <strong>matt_word</strong> gerado no portal de afiliados.
                </p>
              )}
              {form.affiliateUrl && (form.affiliateUrl.includes('mercadolivre') || form.affiliateUrl.includes('mercadolibre')) && !form.affiliateUrl.includes('meli.la') && form.affiliateUrl.includes('matt_word') && (
                <p className="mt-2 text-xs text-green-500 flex items-center gap-1">
                  ✅ Link de afiliado do ML confirmado. Será usado exatamente como está.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                🏷️ Cupom de desconto <span className="text-text-muted text-xs">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.couponCode}
                onChange={(e) => setForm({ ...form, couponCode: e.target.value.toUpperCase() })}
                placeholder="Ex: PROMO10, AUTOCUIDADO, 20% OFF"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary font-mono tracking-wider"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Urgência <span className="text-text-muted text-xs">(opcional)</span>
              </label>
              <select
                value={form.urgency}
                onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="NORMAL">Normal</option>
                <option value="HOJE">Acaba Hoje</option>
                <option value="ULTIMAS_UNIDADES">Últimas Unidades</option>
                <option value="LIMITADO">Limitado</option>
              </select>
            </div>
          </div>

          {/* 📝 Opção para criar post manual */}
          <div className="mt-6 p-4 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createManualPost}
                onChange={(e) => setCreateManualPost(e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-2 focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-text-primary">
                  📝 Criar Post Manual
                </span>
                <p className="text-xs text-text-muted mt-1">
                  Cria um post com status PENDING para você digitar as frases manualmente
                </p>
              </div>
            </label>

            {createManualPost && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Frase Genérica (opcional)
                  </label>
                  <textarea
                    value={manualCopyText.copyText}
                    onChange={(e) => setManualCopyText({ ...manualCopyText, copyText: e.target.value })}
                    placeholder="Digite a frase genérica aqui..."
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Frase para Telegram (opcional)
                  </label>
                  <textarea
                    value={manualCopyText.copyTextTelegram}
                    onChange={(e) => setManualCopyText({ ...manualCopyText, copyTextTelegram: e.target.value })}
                    placeholder="Digite a frase para Telegram aqui..."
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Frase para Site (opcional)
                  </label>
                  <textarea
                    value={manualCopyText.copyTextSite}
                    onChange={(e) => setManualCopyText({ ...manualCopyText, copyTextSite: e.target.value })}
                    placeholder="Digite a frase para Site aqui..."
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Frase para X/Twitter (opcional)
                  </label>
                  <textarea
                    value={manualCopyText.copyTextX}
                    onChange={(e) => setManualCopyText({ ...manualCopyText, copyTextX: e.target.value })}
                    placeholder="Digite a frase para X/Twitter aqui..."
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <p className="text-xs text-text-muted">
                  💡 As frases digitadas aqui serão salvas no banco de dados para reutilização futura
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="mt-4 px-6 py-2 rounded-lg bg-success hover:bg-success/90 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? '⏳ Criando...' : '✅ Criar Oferta'}
          </button>
        </div>
      )}

      {/* ── FEATURE 1: Filtro por nicho ─────────────────────────────────── */}
      {niches && niches.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-text-muted font-medium">🔍 Filtrar:</span>
          <button
            onClick={() => setFilterNiche(null)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-all border',
              !filterNiche
                ? 'bg-primary text-white border-primary'
                : 'border-border text-text-muted hover:border-primary/50'
            )}
          >
            Todos ({offersData.length})
          </button>
          {niches.map((niche: any) => {
            const count = offersData.filter((o: any) => o.niche?.id === niche.id).length;
            if (count === 0) return null;
            return (
              <button
                key={niche.id}
                onClick={() => setFilterNiche(filterNiche === niche.id ? null : niche.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-all border',
                  filterNiche === niche.id
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-text-muted hover:border-primary/50'
                )}
              >
                {niche.icon && `${niche.icon} `}{niche.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Lista de Ofertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOffers.map((offer: any) => (
          <div
            key={offer.id}
            className="bg-surface rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-all"
          >
            {/* 🤖 v2.0: Imagem */}
            {(offer.mainImage || offer.imageUrl) && (
              <div className="relative w-full h-40 bg-background">
                <img 
                  src={offer.mainImage || offer.imageUrl} 
                  alt={offer.title}
                  className="w-full h-full object-cover"
                />
                {/* 🤖 Badge de Status da IA */}
                {offer.curationStatus && offer.curationStatus !== 'DRAFT' && (
                  <div className={cn(
                    "absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-medium",
                    offer.curationStatus === 'AI_PROCESSING' && "bg-yellow-500/90 text-black",
                    offer.curationStatus === 'AI_READY' && "bg-green-500/90 text-white",
                    offer.curationStatus === 'AI_BLOCKED' && "bg-red-500/90 text-white",
                    offer.curationStatus === 'APPROVED' && "bg-blue-500/90 text-white",
                    offer.curationStatus === 'PENDING_REVIEW' && "bg-purple-500/90 text-white",
                  )}>
                    {offer.curationStatus === 'AI_PROCESSING' && '🧠 IA Processando'}
                    {offer.curationStatus === 'AI_READY' && '✅ IA Pronta'}
                    {offer.curationStatus === 'AI_BLOCKED' && '⚠️ Bloqueado'}
                    {offer.curationStatus === 'APPROVED' && '✓ Aprovada'}
                    {offer.curationStatus === 'PENDING_REVIEW' && '👁️ Aguardando'}
                  </div>
                )}
              </div>
            )}
            
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-medium">
                    {offer.niche?.name || 'Sem nicho'}
                  </span>
                  {/* ── FEATURE 4: Indicador de qualidade ── */}
                  {(() => {
                    const q = getQualityIndicator(offer);
                    return (
                      <span className={cn('px-2 py-1 rounded-md text-xs font-medium', q.cls)}>
                        {q.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  {offer.aiPriorityScore && (
                    <span className="px-2 py-1 rounded-md bg-yellow-500/20 text-yellow-400 text-xs font-medium">
                      ⭐ {offer.aiPriorityScore}
                    </span>
                  )}
                  <span className="text-xs text-text-muted">
                    {offer.store?.name || 'Sem loja'}
                  </span>
                </div>
              </div>

              {/* Título */}
              <h3 className="font-semibold text-text-primary mb-2 line-clamp-2">
                {offer.title}
              </h3>

            {/* Preços */}
            <div className="flex items-baseline gap-2 mb-2">
              {offer.originalPrice && (
                <span className="text-text-muted line-through text-sm">
                  {formatCurrency(Number(offer.originalPrice))}
                </span>
              )}
              <span className="text-xl font-bold text-success">
                {formatCurrency(Number(offer.finalPrice))}
              </span>
              {offer.discount && (
                <span className="text-xs text-success font-medium">
                  -{offer.discount}%
                </span>
              )}
            </div>

            {/* Urgência */}
            {offer.urgency && offer.urgency !== 'NORMAL' && (
              <div className="text-warning text-xs font-medium mb-3">
                {getUrgencyLabel(offer.urgency)}
              </div>
            )}

              {/* 💳 Forma de Pagamento do card */}
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">💳 Pagamento ao publicar</p>
                <div className="flex gap-1">
                  {(['pix', 'avista', 'parcelado'] as PaymentMethod[]).map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setCardPayment(prev => ({ ...prev, [offer.id]: pm }))}
                      className={cn(
                        'flex-1 py-1 rounded text-[10px] font-semibold transition-all border',
                        (cardPayment[offer.id] || 'avista') === pm
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-text-muted hover:border-primary/30'
                      )}
                    >
                      {pm === 'pix' ? '💸 PIX' : pm === 'avista' ? '💵 À vista' : '📅 Parc.'}
                    </button>
                  ))}
                </div>
                {(cardPayment[offer.id] || 'avista') === 'parcelado' && (
                  <div className="mt-1.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-muted whitespace-nowrap">Nº parcelas:</span>
                      <select
                        value={cardInstallments[offer.id] ?? 12}
                        onChange={e => {
                          const n = Number(e.target.value);
                          setCardInstallments(prev => ({ ...prev, [offer.id]: n }));
                          // Recalcula o valor sugerido ao trocar o número
                          const suggested = (Number(offer.finalPrice) / n).toFixed(2).replace('.', ',');
                          setCardInstallmentValue(prev => ({ ...prev, [offer.id]: suggested }));
                        }}
                        className="w-16 px-2 py-1 rounded bg-background border border-border text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                          <option key={n} value={n}>{n}x</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-muted whitespace-nowrap">Valor/parcela:</span>
                      <div className="flex items-center border border-border rounded bg-background px-2 py-1 gap-1">
                        <span className="text-[10px] text-text-muted">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={(Number(offer.finalPrice) / (cardInstallments[offer.id] ?? 12)).toFixed(2).replace('.', ',')}
                          value={cardInstallmentValue[offer.id] ?? ''}
                          onChange={e => setCardInstallmentValue(prev => ({ ...prev, [offer.id]: e.target.value }))}
                          className="w-16 bg-transparent text-text-primary text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modo de frase */}
              <div className="mt-2">
                <span className="text-[10px] text-text-muted block mb-1">Tipo de frase:</span>
                <div className="flex gap-1">
                  {(['brand', 'generic'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setCardPhraseMode(prev => ({ ...prev, [offer.id]: mode }))}
                      className={`flex-1 py-1 rounded text-[11px] font-medium transition-all border ${
                        (cardPhraseMode[offer.id] ?? 'generic') === mode
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'border-border text-text-muted hover:border-primary/30'
                      }`}
                    >
                      {mode === 'brand' ? '🏷️ Marca' : '✨ Genérica'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div className="flex flex-col gap-2 pt-3 border-t border-border">
                {/* 🤖 v2.0: Botão Aprovar (se DRAFT) */}
                {(!offer.curationStatus || offer.curationStatus === 'DRAFT') && (
                  <button
                    onClick={() => handleApproveOffer(offer.id)}
                    disabled={approvingOffer === offer.id}
                    className="w-full py-2 rounded-lg bg-success/20 hover:bg-success/30 text-success text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {approvingOffer === offer.id ? '⏳ Aprovando...' : '✅ Aprovar para IA'}
                  </button>
                )}
                
                {/* 🤖 v2.0: Botão Processar IA (se APPROVED) */}
                {offer.curationStatus === 'APPROVED' && (
                  <button
                    onClick={() => handleProcessAI(offer.id)}
                    disabled={processingAI === offer.id}
                    className="w-full py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingAI === offer.id ? '🧠 Processando...' : '🤖 Enviar para IA'}
                  </button>
                )}
                
                {/* Linha 1: Criar Post (modo legado) */}
                {offer.curationStatus !== 'AI_READY' && (
                  <button
                    onClick={() => handleCreateDraft(offer.id)}
                    disabled={creatingDraft === offer.id}
                    className="w-full py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingDraft === offer.id ? '⏳ Criando...' : '📝 Criar Post Manual'}
                  </button>
                )}
                
                {/* Linha 2: Enviar direto - Linha 1 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePublishToSite(offer.id)}
                    disabled={publishingToSite === offer.id}
                    className="py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Publicar diretamente no site"
                  >
                    {publishingToSite === offer.id ? '⏳' : '🌐'} Site
                  </button>
                  <button
                    onClick={() => handlePostToX(offer.id, offer)}
                    disabled={postingToX === offer.id}
                    className="py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Pré-visualizar e postar no X (Twitter)"
                  >
                    {postingToX === offer.id ? '⏳' : '🐦'} X
                  </button>
                </div>
                
                {/* Linha 3: Telegram e Facebook */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePostToTelegram(offer.id)}
                    disabled={postingToTelegram === offer.id}
                    className="py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Postar diretamente no Telegram"
                  >
                    {postingToTelegram === offer.id ? '⏳' : '📱'} Telegram
                  </button>
                  <button
                    onClick={() => handlePostToFacebook(offer.id)}
                    disabled={postingToFacebook === offer.id}
                    className="py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Postar diretamente no Facebook"
                  >
                    {postingToFacebook === offer.id ? '⏳' : '👤'} Facebook
                  </button>
                </div>
                
                {/* 🗑️ Botão DELETAR */}
                <button
                  onClick={() => handleDeleteOffer(offer.id, offer.title)}
                  disabled={deletingOffer === offer.id}
                  className="w-full py-2 rounded-lg bg-error/20 hover:bg-error/30 text-error text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Deletar esta oferta permanentemente"
                >
                  {deletingOffer === offer.id ? '⏳ Deletando...' : '🗑️ Deletar'}
                </button>
                
                {/* ── FEATURE 3: Histórico de posts ── */}
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>
                    📊 {offer._count?.offerPublications || 0} publicaç{(offer._count?.offerPublications || 0) !== 1 ? 'ões' : 'ão'}
                  </span>
                  {(offer._count?.offerPublications || 0) > 0 && (
                    <a
                      href={`/historico?offerId=${offer.id}`}
                      className="text-primary hover:underline text-xs"
                    >
                      ver histórico →
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredOffers.length === 0 && (
        <div className="text-center py-20 text-text-muted">
          <span className="text-6xl mb-4 block">{filterNiche ? '🔍' : '📭'}</span>
          <p className="text-lg">
            {filterNiche ? 'Nenhuma oferta neste nicho' : 'Nenhuma oferta cadastrada'}
          </p>
          <p className="text-sm">
            {filterNiche
              ? <button onClick={() => setFilterNiche(null)} className="text-primary hover:underline">Limpar filtro</button>
              : 'Clique em "+ Nova Oferta" para começar'
            }
          </p>
        </div>
      )}
    </div>
  );
}
