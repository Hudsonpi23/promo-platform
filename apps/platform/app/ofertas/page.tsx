'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, Offer, publishToSite } from '@/lib/api';
import { fetchWithAuth } from '@/lib/auth';
import { cn, formatCurrency, getUrgencyLabel } from '@/lib/utils';

export default function OfertasPage() {
  const [showForm, setShowForm] = useState(false);

  // Buscar ofertas
  const { data: offers, mutate } = useSWR<(Offer & { _count: { drafts: number } })[]>(
    '/api/offers?active=true',
    fetcher
  );

  // Buscar nichos e lojas para o formulário
  const { data: niches } = useSWR('/api/offers/niches', fetcher);
  const { data: stores } = useSWR('/api/offers/stores', fetcher);
  const { data: batches } = useSWR('/api/batches', fetcher);

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
  });

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
        setGalleryPreviews(productData.images.slice(1)); // Pular a primeira (mainImage)
      }

      alert(`✅ Dados extraídos com sucesso!\n\n📦 Produto: ${productData.title}\n💰 Preço: R$ ${productData.finalPrice}\n🏪 Loja: ${data.store}\n\nConfira os dados e adicione mais imagens se quiser!`);

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
        images: [], // 🎠 Limpar galeria
      });
      setImagePreview(null);
      setGalleryPreviews([]); // 🎠 Limpar preview da galeria
      
      const createdOffer = await response.json();
      const offerId = createdOffer.data?.id || createdOffer.id;

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
        images: [], // 🎠 Limpar galeria
      });
      setImagePreview(null);
      setGalleryPreviews([]); // 🎠 Limpar preview da galeria
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

  // Postar diretamente no X (Twitter)
  const handlePostToX = async (offerId: string) => {
    if (postingToX) return; // Evitar duplo clique
    
    setPostingToX(offerId);
    
    try {
      // Primeiro verificar se Twitter está configurado
      const statusResponse = await fetchWithAuth('/api/twitter/status');
      const statusData = await statusResponse.json();
      
      if (!statusData.configured) {
        alert('⚠️ Twitter API não configurada.\n\nConfigure as variáveis de ambiente:\n- TWITTER_API_KEY\n- TWITTER_API_SECRET\n- TWITTER_ACCESS_TOKEN\n- TWITTER_ACCESS_TOKEN_SECRET');
        return;
      }
      
      // Postar no Twitter
      const response = await fetchWithAuth(`/api/twitter/post-offer/${offerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Postado no X com sucesso!\n\n🔗 ${data.tweetUrl || 'Tweet criado!'}`);
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
      const response = await fetchWithAuth(`/api/telegram/post-offer/${offerId}`, {
        method: 'POST',
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

  return (
    <div className="p-6 space-y-6">
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
          
          {/* 🤖 v2.0: Upload de Imagem */}
          <div className="mb-6 p-4 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5">
            <label className="block text-sm font-medium text-text-primary mb-3">
              📷 Imagem Principal <span className="text-error">* OBRIGATÓRIO</span>
            </label>
            
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
                placeholder="Ex: 1.299,00 ou 1299,00"
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
                placeholder="Ex: 999,90 ou 1.169,10"
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

      {/* Lista de Ofertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Array.isArray(offers) ? offers : (offers as any)?.data || []).map((offer: any) => (
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
                <span className="px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-medium">
                  {offer.niche?.name || 'Sem nicho'}
                </span>
                <div className="flex items-center gap-2">
                  {/* 🤖 Score da IA */}
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
                    onClick={() => handlePostToX(offer.id)}
                    disabled={postingToX === offer.id}
                    className="py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Postar diretamente no X (Twitter)"
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
                
                <span className="text-xs text-text-muted text-center">
                  {offer._count?.drafts || 0} posts criados
                  {offer.aiPriorityScore && ` • Score IA: ${offer.aiPriorityScore}`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {((Array.isArray(offers) ? offers : (offers as any)?.data || []).length === 0) && (
        <div className="text-center py-20 text-text-muted">
          <span className="text-6xl mb-4 block">📭</span>
          <p className="text-lg">Nenhuma oferta cadastrada</p>
          <p className="text-sm">Clique em "+ Nova Oferta" para começar</p>
        </div>
      )}
    </div>
  );
}
