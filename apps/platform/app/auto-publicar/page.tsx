'use client';

import { useState } from 'react';
import { fetchWithAuth } from '@/lib/auth';

interface PublishResult {
  url: string;
  status: 'success' | 'partial' | 'error';
  title?: string;
  finalPrice?: number;
  originalPrice?: number;
  discountPct?: number;
  image?: string;
  offerId?: string;
  telegram?: { success: boolean; error?: string };
  twitter?: { success: boolean; error?: string };
  site: boolean;
  error?: string;
}

function formatPrice(value?: number) {
  if (!value) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatusBadge({ ok, label }: { ok?: boolean; label: string }) {
  if (ok === undefined) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
      ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
    }`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

export default function AutoPublicarPage() {
  const [rawUrls, setRawUrls] = useState('');
  const [postTelegram, setPostTelegram] = useState(true);
  const [postTwitter, setPostTwitter] = useState(true);
  const [isFlash, setIsFlash] = useState(false);
  const [flashHours, setFlashHours] = useState(3);
  const [flashMins, setFlashMins] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PublishResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; successCount: number; errorCount: number } | null>(null);
  const [currentStep, setCurrentStep] = useState('');

  const urlList = rawUrls
    .split('\n')
    .map(u => u.trim())
    .filter(u => u.length > 0);

  const handlePublish = async () => {
    if (urlList.length === 0) {
      alert('Cole ao menos um link afiliado.');
      return;
    }

    setLoading(true);
    setResults(null);
    setSummary(null);
    setCurrentStep(`Processando ${urlList.length} link(s)... isso pode levar alguns minutos.`);

    try {
      const flashMinutes = flashHours * 60 + flashMins;
      const response = await fetchWithAuth('/api/auto-publish/publish', {
        method: 'POST',
        body: JSON.stringify({
          urls: urlList,
          postTelegram,
          postTwitter,
          isFlash,
          flashMinutes: isFlash ? flashMinutes : undefined,
          couponCode: couponCode.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`Erro: ${data.error || 'Falha desconhecida'}`);
        return;
      }

      setResults(data.results);
      setSummary({ total: data.total, successCount: data.successCount, errorCount: data.errorCount });
      setRawUrls('');
    } catch (err: any) {
      alert(`Erro de conexão: ${err.message}`);
    } finally {
      setLoading(false);
      setCurrentStep('');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          ⚡ Auto Publicar
        </h1>
        <p className="text-text-secondary mt-1">
          Cole os links afiliados abaixo. A IA vai criar os posts e publicar automaticamente no Telegram, X e site.
        </p>
      </div>

      {/* Form */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Links Afiliados <span className="text-text-muted">(um por linha, máx. 20)</span>
        </label>
        <textarea
          value={rawUrls}
          onChange={e => setRawUrls(e.target.value)}
          disabled={loading}
          rows={8}
          placeholder={`https://mercadolivre.com.br/produto/p/MLB123?matt_event_ts=...
https://mercadolivre.com.br/outro-produto/p/MLB456?matt_event_ts=...
https://amzn.to/xyz123`}
          className="w-full px-4 py-3 rounded-lg bg-background border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm resize-none"
        />
        {urlList.length > 0 && (
          <p className="text-xs text-text-muted mt-1">{urlList.length} link(s) detectado(s)</p>
        )}

        {/* Cupom de desconto */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            🏷️ Cupom de Desconto <span className="text-text-muted text-xs">(opcional — aplica a todos os links)</span>
          </label>
          <input
            type="text"
            value={couponCode}
            onChange={e => setCouponCode(e.target.value.toUpperCase())}
            disabled={loading}
            placeholder="Ex: OFERTA15"
            className="w-full px-4 py-2 rounded-lg bg-background border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm uppercase tracking-widest"
          />
        </div>

        {/* Canais */}
        <div className="flex gap-6 mt-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={postTelegram}
              onChange={e => setPostTelegram(e.target.checked)}
              className="w-4 h-4 accent-primary"
              disabled={loading}
            />
            <span className="text-sm text-text-secondary">📱 Telegram</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={postTwitter}
              onChange={e => setPostTwitter(e.target.checked)}
              className="w-4 h-4 accent-primary"
              disabled={loading}
            />
            <span className="text-sm text-text-secondary">𝕏 X (Twitter)</span>
          </label>
          <label className="flex items-center gap-2 select-none opacity-60">
            <input type="checkbox" checked disabled className="w-4 h-4 accent-primary" />
            <span className="text-sm text-text-secondary">🌐 Site</span>
          </label>
        </div>

        {/* ⚡ Oferta Relâmpago */}
        <div className={`mt-4 rounded-xl border-2 transition-all ${
          isFlash
            ? 'border-amber-500 bg-amber-500/10'
            : 'border-border bg-background/40'
        }`}>
          <label className="flex items-center gap-3 cursor-pointer select-none p-4">
            <div
              onClick={() => !loading && setIsFlash(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                isFlash ? 'bg-amber-500' : 'bg-border'
              } cursor-pointer`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                isFlash ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </div>
            <div>
              <p className={`font-semibold text-sm ${isFlash ? 'text-amber-400' : 'text-text-secondary'}`}>
                ⚡ Oferta Relâmpago
              </p>
              <p className="text-xs text-text-muted">
                Post diferenciado com urgência. Deletado automaticamente quando expirar.
              </p>
            </div>
          </label>

          {isFlash && (
            <div className="px-4 pb-4">
              <p className="text-xs font-medium text-amber-400 mb-2">⏰ Tempo até expirar:</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={flashHours}
                    onChange={e => setFlashHours(Number(e.target.value))}
                    disabled={loading}
                    className="w-16 px-2 py-1.5 rounded-lg bg-background border border-amber-500/40 text-text-primary text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-text-muted">horas</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={flashMins}
                    onChange={e => setFlashMins(Number(e.target.value))}
                    disabled={loading}
                    className="w-16 px-2 py-1.5 rounded-lg bg-background border border-amber-500/40 text-text-primary text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-text-muted">minutos</span>
                </div>
                <span className="text-xs text-amber-400/70 ml-1">
                  = {flashHours * 60 + flashMins} min total
                </span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handlePublish}
          disabled={loading || urlList.length === 0}
          className="mt-5 w-full py-3 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Processando...
            </>
          ) : (
            <>
              {isFlash ? '⚡ Publicar Relâmpago' : '🚀 Processar e Publicar'}
              {' '}({urlList.length} link{urlList.length !== 1 ? 's' : ''})
            </>
          )}
        </button>

        {loading && currentStep && (
          <p className="text-xs text-text-muted text-center mt-3 animate-pulse">{currentStep}</p>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-text-primary">{summary.total}</p>
            <p className="text-xs text-text-muted mt-1">Total processado</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{summary.successCount}</p>
            <p className="text-xs text-text-muted mt-1">Publicados com sucesso</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{summary.errorCount}</p>
            <p className="text-xs text-text-muted mt-1">Com erro</p>
          </div>
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Resultados</h2>
          {results.map((r, i) => (
            <div
              key={i}
              className={`bg-surface border rounded-xl p-4 ${
                r.status === 'success'
                  ? 'border-emerald-500/30'
                  : 'border-red-500/30'
              }`}
            >
              <div className="flex gap-4">
                {/* Imagem */}
                {r.image && (
                  <img
                    src={r.image}
                    alt={r.title}
                    className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  {r.status === 'success' ? (
                    <>
                      <p className="font-medium text-text-primary text-sm leading-tight mb-1 truncate">
                        {r.title}
                      </p>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-emerald-400 font-bold text-sm">{formatPrice(r.finalPrice)}</span>
                        {r.originalPrice && r.originalPrice > (r.finalPrice || 0) && (
                          <span className="text-text-muted text-xs line-through">{formatPrice(r.originalPrice)}</span>
                        )}
                        {r.discountPct && r.discountPct > 0 ? (
                          <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded font-bold">
                            -{r.discountPct}% OFF
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge ok={r.site} label="Site" />
                        <StatusBadge ok={r.telegram?.success} label="Telegram" />
                        <StatusBadge ok={r.twitter?.success} label="X" />
                      </div>
                      {(r.telegram?.error || r.twitter?.error) && (
                        <p className="text-xs text-text-muted mt-1">
                          {r.telegram?.error && `Telegram: ${r.telegram.error}`}
                          {r.twitter?.error && ` · X: ${r.twitter.error}`}
                        </p>
                      )}
                    </>
                  ) : (
                    <div>
                      <p className="text-xs text-text-muted truncate mb-1">{r.url.substring(0, 70)}...</p>
                      <p className="text-red-400 text-sm">✗ {r.error}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
