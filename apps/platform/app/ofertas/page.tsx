'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, Offer } from '@/lib/api';
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
  });

  // Criar oferta
  const handleCreate = async () => {
    // Validação mínima - apenas título e preço final são obrigatórios
    if (!form.title || !form.finalPrice) {
      alert('Preencha pelo menos: Título e Preço Final');
      return;
    }

    await fetch('http://localhost:3001/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        originalPrice: form.originalPrice ? parseFloat(form.originalPrice) : parseFloat(form.finalPrice),
        finalPrice: parseFloat(form.finalPrice),
      }),
    });

    setForm({
      title: '',
      originalPrice: '',
      finalPrice: '',
      affiliateUrl: '',
      nicheId: '',
      storeId: '',
      urgency: 'NORMAL',
    });
    setShowForm(false);
    mutate();
  };

  // Criar draft a partir de oferta
  const handleCreateDraft = async (offerId: string) => {
    const offer = offers?.find((o) => o.id === offerId);
    if (!offer || !batches?.length) return;

    const copyText = `🔥 OFERTA IMPERDÍVEL!\n\n${offer.title}\n\nDe R$ ${offer.originalPrice} por apenas R$ ${offer.finalPrice}!\n\n⚡ ${offer.discount}% de desconto\n\n👉 Aproveite agora antes que acabe!`;

    await fetch(`http://localhost:3001/api/offers/${offerId}/create-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        copyText,
        batchId: batches[0].id, // Primeira carga disponível
        channels: ['TELEGRAM', 'SITE'],
      }),
    });

    mutate();
    alert('Draft criado com sucesso!');
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
          <h3 className="text-lg font-semibold text-text-primary mb-4">Criar Oferta Manual</h3>
          <p className="text-sm text-text-muted mb-4">
            ✅ Campos obrigatórios: <strong>Título</strong> e <strong>Preço Final</strong>. Os demais são opcionais.
          </p>
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
            className="mt-4 px-6 py-2 rounded-lg bg-success hover:bg-success/90 text-white font-medium transition-all"
          >
            ✅ Criar Oferta
          </button>
        </div>
      )}

      {/* Lista de Ofertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offers?.map((offer) => (
          <div
            key={offer.id}
            className="bg-surface rounded-xl border border-border p-4 hover:border-primary/50 transition-all"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-medium">
                {offer.niche.name}
              </span>
              <span className="text-xs text-text-muted">
                {offer.store.name}
              </span>
            </div>

            {/* Título */}
            <h3 className="font-semibold text-text-primary mb-2 line-clamp-2">
              {offer.title}
            </h3>

            {/* Preços */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-text-muted line-through text-sm">
                {formatCurrency(Number(offer.originalPrice))}
              </span>
              <span className="text-xl font-bold text-success">
                {formatCurrency(Number(offer.finalPrice))}
              </span>
              <span className="text-xs text-success font-medium">
                -{offer.discount}%
              </span>
            </div>

            {/* Urgência */}
            {offer.urgency !== 'NORMAL' && (
              <div className="text-warning text-xs font-medium mb-3">
                {getUrgencyLabel(offer.urgency)}
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <button
                onClick={() => handleCreateDraft(offer.id)}
                className="flex-1 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-sm font-medium transition-all"
              >
                📝 Criar Post
              </button>
              <span className="text-xs text-text-muted">
                {offer._count.drafts} posts
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {offers?.length === 0 && (
        <div className="text-center py-20 text-text-muted">
          <span className="text-6xl mb-4 block">📭</span>
          <p className="text-lg">Nenhuma oferta cadastrada</p>
          <p className="text-sm">Clique em "+ Nova Oferta" para começar</p>
        </div>
      )}
    </div>
  );
}
