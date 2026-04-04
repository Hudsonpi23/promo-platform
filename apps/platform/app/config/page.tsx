'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { fetchWithAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface ChannelConfig {
  id: string;
  channel: string;
  name: string;
  config: Record<string, any>;
  isActive: boolean;
}

interface Niche {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  isActive: boolean;
}

interface Store {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  isActive: boolean;
}

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<'canais' | 'nichos' | 'lojas' | 'ml-session'>('canais');

  // Buscar dados
  const { data: channels, mutate: mutateChannels } = useSWR<ChannelConfig[]>(
    '/api/channels',
    fetcher
  );
  const { data: niches, mutate: mutateNiches } = useSWR<Niche[]>(
    '/api/offers/niches',
    fetcher
  );
  const { data: stores, mutate: mutateStores } = useSWR<Store[]>(
    '/api/offers/stores',
    fetcher
  );

  // Estados para formulários
  const [newNiche, setNewNiche] = useState({ name: '', slug: '', icon: '' });
  const [newStore, setNewStore] = useState({ name: '', slug: '' });

  // ML Session state
  const [mlCookie, setMlCookie] = useState('');
  const [mlCsrf, setMlCsrf] = useState('');
  const [mlStatus, setMlStatus] = useState<{ configured: boolean; cookieLength: number; cookiePreview?: string } | null>(null);
  const [mlSaving, setMlSaving] = useState(false);
  const [mlTesting, setMlTesting] = useState(false);
  const [mlTestResult, setMlTestResult] = useState<{ success: boolean; message: string; shortUrl?: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'ml-session') {
      fetchWithAuth('/api/affiliates/ml-session')
        .then(r => r.json())
        .then(d => { if (d.success) setMlStatus(d.data); })
        .catch(() => {});
    }
  }, [activeTab]);

  const saveMLSession = async () => {
    if (!mlCookie || !mlCsrf) return;
    setMlSaving(true);
    try {
      const res = await fetchWithAuth('/api/affiliates/ml-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: mlCookie, csrfToken: mlCsrf }),
      });
      const data = await res.json();
      if (data.success) {
        setMlStatus({ configured: true, cookieLength: mlCookie.length });
        setMlCookie('');
        setMlCsrf('');
        setMlTestResult({ success: true, message: 'Cookies salvos com sucesso!' });
      }
    } catch {
      setMlTestResult({ success: false, message: 'Erro ao salvar cookies' });
    }
    setMlSaving(false);
  };

  const testMLSession = async () => {
    setMlTesting(true);
    setMlTestResult(null);
    try {
      const res = await fetchWithAuth('/api/affiliates/ml-session/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMlTestResult({ success: true, message: 'Funcionando! Link gerado.', shortUrl: data.data.short_url });
      } else {
        setMlTestResult({ success: false, message: data.error?.message || 'Sessao expirada' });
      }
    } catch {
      setMlTestResult({ success: false, message: 'Erro ao testar sessao' });
    }
    setMlTesting(false);
  };

  // Salvar canal
  const saveChannel = async (channel: string, config: Record<string, any>) => {
    await fetch(`http://localhost:3001/api/channels/${channel}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Canal ${channel}`,
        config,
        isActive: true,
      }),
    });
    mutateChannels();
  };

  // Criar nicho
  const createNiche = async () => {
    if (!newNiche.name || !newNiche.slug) return;
    await fetch('http://localhost:3001/api/offers/niches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNiche),
    });
    setNewNiche({ name: '', slug: '', icon: '' });
    mutateNiches();
  };

  // Criar loja
  const createStore = async () => {
    if (!newStore.name || !newStore.slug) return;
    await fetch('http://localhost:3001/api/offers/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newStore),
    });
    setNewStore({ name: '', slug: '' });
    mutateStores();
  };

  const tabs = [
    { id: 'canais', label: '📡 Canais', icon: '📡' },
    { id: 'nichos', label: '🏷️ Nichos', icon: '🏷️' },
    { id: 'lojas', label: '🏪 Lojas', icon: '🏪' },
    { id: 'ml-session', label: '🔗 ML Afiliado', icon: '🔗' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">⚙️ Configurações</h1>
        <p className="text-text-muted text-sm">
          Configure canais de disparo, nichos e lojas
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-secondary hover:text-text-primary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {activeTab === 'canais' && (
        <div className="space-y-6">
          {/* Telegram */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📱</span>
              <h3 className="text-lg font-semibold text-text-primary">Telegram</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">Bot Token</label>
                <input
                  type="password"
                  placeholder="123456:ABC..."
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Channel ID</label>
                <input
                  type="text"
                  placeholder="-100123456789"
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <button className="mt-4 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-all">
              Salvar Telegram
            </button>
          </div>

          {/* WhatsApp */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">💬</span>
              <h3 className="text-lg font-semibold text-text-primary">WhatsApp (Evolution API)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">API URL</label>
                <input
                  type="text"
                  placeholder="http://localhost:8080"
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">API Key</label>
                <input
                  type="password"
                  placeholder="sua_api_key"
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Instance</label>
                <input
                  type="text"
                  placeholder="promo"
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <button className="mt-4 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-all">
              Salvar WhatsApp
            </button>
          </div>

          {/* Facebook */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">👤</span>
              <h3 className="text-lg font-semibold text-text-primary">Facebook</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">Page ID</label>
                <input
                  type="text"
                  placeholder="123456789"
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Access Token</label>
                <input
                  type="password"
                  placeholder="EAABx..."
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <button className="mt-4 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-all">
              Salvar Facebook
            </button>
          </div>
        </div>
      )}

      {activeTab === 'nichos' && (
        <div className="space-y-6">
          {/* Criar Nicho */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Criar Nicho</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">Nome</label>
                <input
                  type="text"
                  value={newNiche.name}
                  onChange={(e) => setNewNiche({ ...newNiche, name: e.target.value })}
                  placeholder="Eletrônicos"
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Slug</label>
                <input
                  type="text"
                  value={newNiche.slug}
                  onChange={(e) => setNewNiche({ ...newNiche, slug: e.target.value })}
                  placeholder="eletronicos"
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Ícone</label>
                <input
                  type="text"
                  value={newNiche.icon}
                  onChange={(e) => setNewNiche({ ...newNiche, icon: e.target.value })}
                  placeholder="📱"
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={createNiche}
                  className="w-full px-4 py-2 rounded-lg bg-success hover:bg-success/90 text-white font-medium transition-all"
                >
                  + Criar
                </button>
              </div>
            </div>
          </div>

          {/* Lista de Nichos */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Nichos Cadastrados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {niches?.map((niche) => (
                <div
                  key={niche.id}
                  className="flex items-center gap-3 p-4 rounded-lg bg-background border border-border"
                >
                  <span className="text-2xl">{niche.icon || '📦'}</span>
                  <div>
                    <p className="font-medium text-text-primary">{niche.name}</p>
                    <p className="text-xs text-text-muted">/{niche.slug}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lojas' && (
        <div className="space-y-6">
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Criar Loja</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">Nome</label>
                <input
                  type="text"
                  value={newStore.name}
                  onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                  placeholder="Magazine Luiza"
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Slug</label>
                <input
                  type="text"
                  value={newStore.slug}
                  onChange={(e) => setNewStore({ ...newStore, slug: e.target.value })}
                  placeholder="magalu"
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={createStore}
                  className="w-full px-4 py-2 rounded-lg bg-success hover:bg-success/90 text-white font-medium transition-all"
                >
                  + Criar
                </button>
              </div>
            </div>
          </div>
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Lojas Cadastradas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores?.map((store) => (
                <div key={store.id} className="flex items-center gap-3 p-4 rounded-lg bg-background border border-border">
                  <span className="text-2xl">🏪</span>
                  <div>
                    <p className="font-medium text-text-primary">{store.name}</p>
                    <p className="text-xs text-text-muted">/{store.slug}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ml-session' && (
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔗</span>
              <h3 className="text-lg font-semibold text-text-primary">Mercado Livre — Link Oficial de Afiliado</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Para gerar links oficiais (meli.la) que rastreiam comissões corretamente, a plataforma precisa dos cookies da sua sessão no ML.
            </p>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-background border border-border mb-4">
              <div className={cn('w-3 h-3 rounded-full', mlStatus?.configured ? 'bg-green-500' : 'bg-red-500')} />
              <div>
                <p className="font-medium text-text-primary">
                  {mlStatus?.configured ? 'Sessão ML ativa' : 'Sessão ML não configurada'}
                </p>
                {mlStatus?.configured && (
                  <p className="text-xs text-text-muted">Cookie: {mlStatus.cookieLength} chars</p>
                )}
              </div>
              {mlStatus?.configured && (
                <button
                  onClick={testMLSession}
                  disabled={mlTesting}
                  className="ml-auto px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-all disabled:opacity-50"
                >
                  {mlTesting ? 'Testando...' : 'Testar Sessao'}
                </button>
              )}
            </div>

            {mlTestResult && (
              <div className={cn('p-3 rounded-lg text-sm mb-4', mlTestResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30')}>
                <p className="font-medium">{mlTestResult.message}</p>
                {mlTestResult.shortUrl && (
                  <p className="mt-1 text-xs">Link gerado: <a href={mlTestResult.shortUrl} target="_blank" rel="noopener noreferrer" className="underline">{mlTestResult.shortUrl}</a></p>
                )}
              </div>
            )}
          </div>

          {/* Atualizar cookies */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Atualizar Cookies</h3>
            <p className="text-sm text-text-secondary mb-4">
              No Chrome, acesse <code className="bg-background px-2 py-0.5 rounded text-xs">mercadolivre.com.br/afiliados/linkbuilder</code>, gere um link, depois F12 &gt; Network &gt; clique em <code className="bg-background px-2 py-0.5 rounded text-xs">createLink</code> &gt; Headers &gt; copie Cookie e x-csrf-token.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">Cookie (Request Headers)</label>
                <textarea
                  value={mlCookie}
                  onChange={(e) => setMlCookie(e.target.value)}
                  placeholder="Cole aqui o valor completo do Cookie..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">x-csrf-token</label>
                <input
                  type="text"
                  value={mlCsrf}
                  onChange={(e) => setMlCsrf(e.target.value)}
                  placeholder="Cole aqui o x-csrf-token..."
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                />
              </div>
              <button
                onClick={saveMLSession}
                disabled={mlSaving || !mlCookie || !mlCsrf}
                className="px-6 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition-all disabled:opacity-50"
              >
                {mlSaving ? 'Salvando...' : 'Salvar e Ativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
