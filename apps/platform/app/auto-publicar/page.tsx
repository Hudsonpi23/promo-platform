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
  paymentMethod?: string;
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

function PaymentBadge({ method }: { method?: string }) {
  if (!method) return null;
  if (method === 'pix') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
      🏦 PIX
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
      💵 À Vista
    </span>
  );
}

const parseUrls = (raw: string) =>
  raw.split('\n').map(u => u.trim()).filter(u => u.length > 0);

interface LinkBoxProps {
  id: string;
  label: string;
  icon: string;
  borderColor: string;
  headerColor: string;
  badgeClass: string;
  value: string;
  onChange: (v: string) => void;
  coupon?: string;
  onCouponChange?: (v: string) => void;
  placeholder?: string;
  disabled: boolean;
}

function LinkBox({
  label, icon, borderColor, headerColor, badgeClass,
  value, onChange, coupon, onCouponChange, disabled,
}: LinkBoxProps) {
  const count = parseUrls(value).length;
  return (
    <div className={`rounded-xl border-2 ${borderColor} bg-background/40 overflow-hidden transition-all`}>
      <div className={`px-4 py-3 ${headerColor} flex items-center justify-between`}>
        <span className="font-semibold text-sm flex items-center gap-2">
          {icon} {label}
        </span>
        {count > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
            {count} link{count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          rows={5}
          placeholder={`Cole os links aqui\n(um por linha)`}
          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs resize-none"
        />
        {onCouponChange !== undefined && (
          <input
            type="text"
            value={coupon ?? ''}
            onChange={e => onCouponChange(e.target.value.toUpperCase())}
            disabled={disabled}
            placeholder="Código do cupom  (ex: MELIMERCADO)"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs uppercase tracking-widest"
          />
        )}
      </div>
    </div>
  );
}

export default function AutoPublicarPage() {
  // ── Caixa 1: À Vista (sem cupom) ──────────────────────────────────────────
  const [urlsAvista, setUrlsAvista] = useState('');
  // ── Caixa 2: PIX (sem cupom) ──────────────────────────────────────────────
  const [urlsPix, setUrlsPix] = useState('');
  // ── Caixa 3: PIX + Cupom ──────────────────────────────────────────────────
  const [urlsPixCupom, setUrlsPixCupom] = useState('');
  const [couponPix, setCouponPix] = useState('');
  // ── Caixa 4: À Vista + Cupom ──────────────────────────────────────────────
  const [urlsAvistaCupom, setUrlsAvistaCupom] = useState('');
  const [couponAvista, setCouponAvista] = useState('');

  // ── Opções globais ────────────────────────────────────────────────────────
  const [postTelegram, setPostTelegram] = useState(true);
  const [postTwitter, setPostTwitter] = useState(true);
  const [isFlash, setIsFlash] = useState(false);
  const [flashHours, setFlashHours] = useState(3);
  const [flashMins, setFlashMins] = useState(0);

  // ── Estado de execução ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PublishResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; successCount: number; errorCount: number } | null>(null);
  const [currentStep, setCurrentStep] = useState('');

  const totalLinks =
    parseUrls(urlsAvista).length +
    parseUrls(urlsPix).length +
    parseUrls(urlsPixCupom).length +
    parseUrls(urlsAvistaCupom).length;

  const handlePublish = async () => {
    if (totalLinks === 0) {
      alert('Cole ao menos um link em qualquer caixa.');
      return;
    }

    const groups = [
      { urls: parseUrls(urlsAvista),      paymentMethod: 'avista' as const },
      { urls: parseUrls(urlsPix),         paymentMethod: 'pix'    as const },
      { urls: parseUrls(urlsPixCupom),    paymentMethod: 'pix'    as const, couponCode: couponPix.trim()    || undefined },
      { urls: parseUrls(urlsAvistaCupom), paymentMethod: 'avista' as const, couponCode: couponAvista.trim() || undefined },
    ].filter(g => g.urls.length > 0);

    setLoading(true);
    setResults(null);
    setSummary(null);
    setCurrentStep(`Processando ${totalLinks} link(s)... isso pode levar alguns minutos.`);

    try {
      const flashMinutes = flashHours * 60 + flashMins;
      const response = await fetchWithAuth('/api/auto-publish/publish', {
        method: 'POST',
        body: JSON.stringify({
          groups,
          postTelegram,
          postTwitter,
          isFlash,
          flashMinutes: isFlash ? flashMinutes : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`Erro: ${data.error || 'Falha desconhecida'}`);
        return;
      }

      setResults(data.results);
      setSummary({ total: data.total, successCount: data.successCount, errorCount: data.errorCount });

      // Limpar todas as caixas após sucesso
      setUrlsAvista('');
      setUrlsPix('');
      setUrlsPixCupom('');
      setCouponPix('');
      setUrlsAvistaCupom('');
      setCouponAvista('');
    } catch (err: any) {
      alert(`Erro de conexão: ${err.message}`);
    } finally {
      setLoading(false);
      setCurrentStep('');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          ⚡ Auto Publicar
        </h1>
        <p className="text-text-secondary mt-1">
          Cole os links nas caixas de acordo com o tipo de pagamento. A IA cria os posts e publica automaticamente.
        </p>
      </div>

      {/* 4 Caixas de Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <LinkBox
          id="avista"
          label="À Vista"
          icon="💵"
          borderColor="border-blue-500/40 hover:border-blue-500/70"
          headerColor="bg-blue-500/10 text-blue-400"
          badgeClass="bg-blue-500/30 text-blue-300"
          value={urlsAvista}
          onChange={setUrlsAvista}
          disabled={loading}
        />
        <LinkBox
          id="pix"
          label="PIX"
          icon="🏦"
          borderColor="border-emerald-500/40 hover:border-emerald-500/70"
          headerColor="bg-emerald-500/10 text-emerald-400"
          badgeClass="bg-emerald-500/30 text-emerald-300"
          value={urlsPix}
          onChange={setUrlsPix}
          disabled={loading}
        />
        <LinkBox
          id="avista-cupom"
          label="À Vista + Cupom"
          icon="🎟️"
          borderColor="border-violet-500/40 hover:border-violet-500/70"
          headerColor="bg-violet-500/10 text-violet-400"
          badgeClass="bg-violet-500/30 text-violet-300"
          value={urlsAvistaCupom}
          onChange={setUrlsAvistaCupom}
          coupon={couponAvista}
          onCouponChange={setCouponAvista}
          disabled={loading}
        />
        <LinkBox
          id="pix-cupom"
          label="PIX + Cupom"
          icon="🏷️"
          borderColor="border-teal-500/40 hover:border-teal-500/70"
          headerColor="bg-teal-500/10 text-teal-400"
          badgeClass="bg-teal-500/30 text-teal-300"
          value={urlsPixCupom}
          onChange={setUrlsPixCupom}
          coupon={couponPix}
          onCouponChange={setCouponPix}
          disabled={loading}
        />
      </div>

      {/* Opções globais */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-5 space-y-4">
        {/* Canais */}
        <div className="flex gap-6 flex-wrap">
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
        <div className={`rounded-xl border-2 transition-all ${
          isFlash ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-background/40'
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
                    type="number" min={0} max={23} value={flashHours}
                    onChange={e => setFlashHours(Number(e.target.value))}
                    disabled={loading}
                    className="w-16 px-2 py-1.5 rounded-lg bg-background border border-amber-500/40 text-text-primary text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-text-muted">horas</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={59} value={flashMins}
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

        {/* Botão Publicar */}
        <button
          onClick={handlePublish}
          disabled={loading || totalLinks === 0}
          className="w-full py-3 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
            <>{isFlash ? '⚡ Publicar Relâmpago' : '🚀 Processar e Publicar'}{' '}
              ({totalLinks} link{totalLinks !== 1 ? 's' : ''})
            </>
          )}
        </button>

        {loading && currentStep && (
          <p className="text-xs text-text-muted text-center animate-pulse">{currentStep}</p>
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
                r.status === 'success' ? 'border-emerald-500/30' : 'border-red-500/30'
              }`}
            >
              <div className="flex gap-4">
                {r.image && (
                  <img src={r.image} alt={r.title} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {r.status === 'success' ? (
                    <>
                      <p className="font-medium text-text-primary text-sm leading-tight mb-1 truncate">{r.title}</p>
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="text-emerald-400 font-bold text-sm">{formatPrice(r.finalPrice)}</span>
                        {r.originalPrice && r.originalPrice > (r.finalPrice || 0) && (
                          <span className="text-text-muted text-xs line-through">{formatPrice(r.originalPrice)}</span>
                        )}
                        {r.discountPct && r.discountPct > 0 ? (
                          <span className="bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded font-bold">
                            -{r.discountPct}% OFF
                          </span>
                        ) : null}
                        <PaymentBadge method={r.paymentMethod} />
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
