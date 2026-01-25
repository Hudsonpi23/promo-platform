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
  });

  // 🤖 v2.0: Estado de upload de imagem
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Estado de loading
  const [isCreating, setIsCreating] = useState(false);

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
    
    setUploadingImage(true);
    
    try {
      const response = await fetchWithAuth('/api/upload/url', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: url }), // Corrigido: usar imageUrl
      });
      
      const data = await response.json();
      
      // Verificar ambos formatos de resposta (data.url ou data.data.url)
      const imageUrl = data.url || data.data?.url;
      
      if (imageUrl) {
        setForm({ ...form, mainImage: imageUrl });
        setImagePreview(imageUrl);
      } else {
        throw new Error(data.message || data.error || data.hint || 'Erro no upload');
      }
    } catch (error: any) {
      console.error('Erro no upload:', error);
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
      const response = await fetchWithAuth('/api/offers', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          originalPrice: form.originalPrice ? parseFloat(form.originalPrice) : parseFloat(form.finalPrice),
          finalPrice: parseFloat(form.finalPrice),
          affiliateUrl: form.affiliateUrl || undefined,
          nicheId: form.nicheId || undefined,
          storeId: form.storeId || undefined,
          urgency: form.urgency || 'NORMAL',
          status: 'ACTIVE',
          // 🤖 v2.0: Campos de imagem
          mainImage: form.mainImage,
          imageUrl: form.mainImage, // Compatibilidade
          curationStatus: 'DRAFT', // Começa como rascunho
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao criar oferta');
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
      });
      setImagePreview(null);
      
      setShowForm(false);
      mutate();
      
      alert('✅ Oferta criada com sucesso!\n\n📌 Status: RASCUNHO\n\nAprove a oferta para ativar o processamento da IA.');
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
                      onBlur={(e) => handleImageUrlUpload(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
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
                type="number"
                step="0.01"
                value={form.originalPrice}
                onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                placeholder="1429 (se tiver)"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Preço Final <span className="text-error">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={form.finalPrice}
                onChange={(e) => setForm({ ...form, finalPrice: e.target.value })}
                placeholder="798"
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
                
                {/* Linha 2: Enviar direto */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePublishToSite(offer.id)}
                    disabled={publishingToSite === offer.id}
                    className="flex-1 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Publicar diretamente no site"
                  >
                    {publishingToSite === offer.id ? '⏳' : '🌐'} Site
                  </button>
                  <button
                    onClick={() => handlePostToX(offer.id)}
                    disabled={postingToX === offer.id}
                    className="flex-1 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Postar diretamente no X (Twitter)"
                  >
                    {postingToX === offer.id ? '⏳' : '🐦'} X
                  </button>
                </div>
                
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
