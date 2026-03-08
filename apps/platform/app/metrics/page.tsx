'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from 'recharts';
import { fetchWithAuth } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────
interface MetricsSummary {
  totalPosts:    number;
  totalClicks:   number;
  postsThisWeek: number;
  avgDiscount:   number;
  totalSavings:  number;
}
interface NicheItem    { name: string; icon: string; color: string; posts: number }
interface DiscountItem { label: string; count: number }
interface TopProduct {
  title: string;
  discountPct: number;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
}
interface MetricsData {
  summary: MetricsSummary;
  charts:  { activityByDay: unknown[]; postsByNiche: NicheItem[]; discountDist: DiscountItem[] };
  tables:  { topByDiscount: TopProduct[]; topByClicks: unknown[] };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

const TOOLTIP = {
  backgroundColor: '#12121f',
  border: '1px solid #2d2d44',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
};

// ── Export helper ──────────────────────────────────────────────────────────
async function exportCard(el: HTMLElement, filename: string) {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(el, {
    backgroundColor: '#0f0f1a',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ── Card wrapper ──────────────────────────────────────────────────────────
function ChartCard({
  id, time, title, emoji, children, gradient,
}: {
  id: string; time: string; title: string; emoji: string;
  children: React.ReactNode; gradient: string;
}) {
  const ref  = useRef<HTMLDivElement>(null);
  const [exp, setExp] = useState(false);

  const handleExport = useCallback(async () => {
    if (!ref.current) return;
    setExp(true);
    try {
      await exportCard(ref.current, `manu-${id}-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.png`);
    } finally {
      setExp(false);
    }
  }, [id]);

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-muted bg-surface px-2 py-0.5 rounded-lg border border-border">
            {time}
          </span>
          <span className="text-sm font-semibold text-text-primary">{emoji} {title}</span>
        </div>
        <button
          onClick={handleExport}
          disabled={exp}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 disabled:opacity-40 transition-all"
        >
          {exp ? '⏳' : '📥'} {exp ? 'Exportando…' : 'Exportar'}
        </button>
      </div>

      {/* Exportable area */}
      <div ref={ref} className={`p-6 ${gradient}`}>
        {/* Branding sempre visível na imagem exportada */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-black text-white/90 tracking-tight">MANU</span>
            <span className="text-xs text-white/50 font-medium">PROMOÇÕES</span>
          </div>
          <span className="text-xs text-white/40 font-mono">{time} · sexta</span>
        </div>

        {children}

        {/* Rodapé */}
        <p className="text-center text-[10px] text-white/30 mt-4">
          🌐 manu-promocoes.com.br
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function MetricsPage() {
  const [data, setData]       = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetchWithAuth('/api/metrics/summary')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <p className="text-text-muted text-sm">Carregando métricas…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">{error}</div>
    </div>
  );

  if (!data) return null;

  const { summary, charts } = data;

  // Cálculo da simulação de economia
  const avgSavingPerPurchase = summary.totalPosts > 0
    ? Math.round(summary.totalSavings / summary.totalPosts)
    : 86;

  const simulationData = [1, 2, 3].map(n => ({
    label: `${n} compra${n > 1 ? 's' : ''}`,
    value: avgSavingPerPurchase * n,
  }));

  // Gauge data (RadialBar)
  const gaugeData = [
    { name: 'Desconto', value: summary.avgDiscount, fill: '#8b5cf6' },
    { name: 'Restante', value: 100 - summary.avgDiscount, fill: '#1e1e2e' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-text-primary flex items-center gap-2">
          📊 Relatório Semanal
        </h1>
        <p className="text-text-muted text-sm mt-0.5">
          6 cards independentes — exporte cada um separadamente para postar nas redes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── 1. 07:00 — Promoções encontradas ───────────────────────────── */}
        <ChartCard id="promocoes" time="07:00" emoji="🔍" title="Promoções encontradas"
          gradient="bg-gradient-to-br from-[#0f0f1a] via-[#1a1035] to-[#0f0f1a]"
        >
          <div className="text-center py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">
              Promoções encontradas esta semana
            </p>
            <p className="text-7xl font-black text-white leading-none">
              {summary.postsThisWeek}
            </p>
            <p className="text-2xl font-bold text-purple-400 mt-1">promoções</p>
            <div className="mt-5 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
              <p className="text-xs text-white/50 leading-relaxed">
                promoções encontradas pela Manu<br/>
                nas principais plataformas
              </p>
            </div>
            <p className="text-xs text-white/30 mt-3 italic">
              Trabalhando o tempo todo para encontrar as melhores ofertas para você.
            </p>
          </div>
        </ChartCard>

        {/* ── 2. 11:00 — Desconto médio (gauge) ──────────────────────────── */}
        <ChartCard id="desconto-medio" time="11:00" emoji="💰" title="Desconto médio da semana"
          gradient="bg-gradient-to-br from-[#0f0f1a] via-[#1a1a10] to-[#0f0f1a]"
        >
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2">
              Desconto médio
            </p>
            <div className="relative flex justify-center">
              <ResponsiveContainer width={200} height={120}>
                <RadialBarChart
                  cx="50%" cy="100%"
                  innerRadius={60} outerRadius={90}
                  startAngle={180} endAngle={0}
                  data={gaugeData}
                >
                  <RadialBar dataKey="value" cornerRadius={8} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center pb-1">
                <p className="text-4xl font-black text-amber-400 leading-none">
                  {summary.avgDiscount}%
                </p>
                <p className="text-xs text-white/50">OFF</p>
              </div>
            </div>
            <div className="mt-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
              <p className="text-xs text-white/50 leading-relaxed">
                média das promoções encontradas na semana<br/>
                <span className="text-amber-400 font-semibold">As promoções são realmente boas.</span>
              </p>
            </div>
          </div>
        </ChartCard>

        {/* ── 3. 14:00 — Distribuição de descontos ───────────────────────── */}
        <ChartCard id="distribuicao" time="14:00" emoji="🔥" title="Distribuição de descontos"
          gradient="bg-gradient-to-br from-[#0f0f1a] via-[#1a1010] to-[#0f0f1a]"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3 text-center">
            Distribuição dos descontos
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={charts.discountDist} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fill: '#ffffffaa', fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
              <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="count" name="Posts" radius={[0, 6, 6, 0]} maxBarSize={20}>
                {charts.discountDist.map((_, i) => (
                  <Cell key={i} fill={['#fbbf24','#f97316','#ef4444','#dc2626','#991b1b'][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-white/30 text-center mt-2">
            Quantas promoções são realmente fortes.
          </p>
        </ChartCard>

        {/* ── 4. 16:00 — Categorias (pizza) ──────────────────────────────── */}
        <ChartCard id="categorias" time="16:00" emoji="🏷️" title="Categorias com mais promoções"
          gradient="bg-gradient-to-br from-[#0f0f1a] via-[#0f1a1a] to-[#0f0f1a]"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2 text-center">
            Categorias com mais promoções
          </p>
          {charts.postsByNiche.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-8">Sem dados ainda</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={charts.postsByNiche}
                    dataKey="posts" nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={65} innerRadius={30}
                    paddingAngle={3}
                  >
                    {charts.postsByNiche.map((entry, i) => (
                      <Cell key={i} fill={entry.color || `hsl(${i * 50}, 70%, 55%)`} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legenda manual */}
              <div className="grid grid-cols-2 gap-1 mt-1">
                {charts.postsByNiche.slice(0, 6).map((n, i) => {
                  const total = charts.postsByNiche.reduce((a, b) => a + b.posts, 0);
                  const pct   = total > 0 ? Math.round((n.posts / total) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: n.color }} />
                      <span className="text-[11px] text-white/70 truncate">{n.icon} {n.name}</span>
                      <span className="text-[11px] text-white/40 ml-auto">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </ChartCard>

        {/* ── 5. 19:00 — Economia potencial ──────────────────────────────── */}
        <ChartCard id="economia" time="19:00" emoji="💸" title="Economia potencial gerada"
          gradient="bg-gradient-to-br from-[#0f0f1a] via-[#0a1a10] to-[#0f0f1a]"
        >
          <div className="text-center py-2">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3">
              Economia Gerada
            </p>
            <div className="relative inline-block">
              <p className="text-6xl font-black text-emerald-400 leading-none">
                {fmtCurrency(summary.totalSavings)}
              </p>
              <div className="absolute -top-2 -right-3 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                REAL
              </div>
            </div>
            <p className="text-white/50 text-sm mt-3 leading-relaxed">
              valor potencial economizado<br/>nas promoções encontradas esta semana
            </p>
            <div className="mt-4 flex justify-center gap-6">
              <div className="text-center">
                <p className="text-xl font-black text-white">{summary.postsThisWeek}</p>
                <p className="text-[10px] text-white/40">promoções</p>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center">
                <p className="text-xl font-black text-white">{summary.avgDiscount}%</p>
                <p className="text-[10px] text-white/40">desc. médio</p>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center">
                <p className="text-xl font-black text-white">{summary.totalClicks}</p>
                <p className="text-[10px] text-white/40">cliques</p>
              </div>
            </div>
          </div>
        </ChartCard>

        {/* ── 6. 21:00 — Simulação de economia ───────────────────────────── */}
        <ChartCard id="simulacao" time="21:00" emoji="🧮" title="Simulação de economia"
          gradient="bg-gradient-to-br from-[#0f0f1a] via-[#1a0f1a] to-[#0f0f1a]"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-1 text-center">
            Se você aproveitasse as promoções da Manu
          </p>
          <p className="text-[10px] text-white/30 text-center mb-4">
            baseado na média de descontos desta semana
          </p>
          <div className="space-y-3">
            {simulationData.map((s, i) => {
              const maxVal = simulationData[simulationData.length - 1].value;
              const pct    = Math.round((s.value / maxVal) * 100);
              const colors = ['#8b5cf6', '#ec4899', '#f59e0b'];
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/60">{s.label}</span>
                    <span className="text-sm font-black" style={{ color: colors[i] }}>
                      {fmtCurrency(s.value)}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: colors[i] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 bg-white/5 rounded-xl px-4 py-3 border border-white/10 text-center">
            <p className="text-xs text-white/50 leading-relaxed italic">
              "Se eu tivesse seguido esse perfil, teria economizado dinheiro."
            </p>
          </div>
        </ChartCard>

        {/* ── 7. PROMOÇÃO MAIS ABSURDA DA SEMANA — full width ────────────── */}
        {(() => {
          if (!data.tables.topByDiscount.length) return null;

          // Pegar o maior desconto e todos os produtos empatados nesse %
          // Desempate: maior economia em R$ primeiro — máx 3 exibidos
          const maxPct = data.tables.topByDiscount[0].discountPct;
          const winners = data.tables.topByDiscount
            .filter(p => p.discountPct === maxPct)
            .map(p => ({
              ...p,
              saved: p.originalPrice ? Number(p.originalPrice) - Number(p.price) : 0,
            }))
            .sort((a, b) => b.saved - a.saved)
            .slice(0, 3);

          const medals = ['🥇', '🥈', '🥉'];
          const isSolo = winners.length === 1;

          return (
            <div className="lg:col-span-2">
              <ChartCard id="absurda" time="20:00" emoji="🚨" title="Promoção mais absurda da semana"
                gradient="bg-gradient-to-br from-[#1a0000] via-[#2d0a00] to-[#1a0000]"
              >
                {/* Badges topo */}
                <div className="flex items-center justify-between mb-5">
                  {/* Badge pulsante */}
                  <span className="animate-pulse inline-flex items-center gap-1.5 bg-red-600/30 border border-red-500/40 text-red-400 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
                    🚨 OFERTA ABSURDA · {new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }).toUpperCase()}
                  </span>

                  {/* Selo CAÇADO PELA MANU */}
                  <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-full">
                    <span className="text-xs">🎯</span>
                    <div className="text-right">
                      <p className="text-[9px] text-amber-400/70 uppercase tracking-[0.15em] leading-none">caçado pela</p>
                      <p className="text-xs font-black text-amber-400 uppercase tracking-wide leading-none mt-0.5">MANU</p>
                    </div>
                  </div>
                </div>

                {/* Desconto em destaque — igual para todos os empatados */}
                <div className="flex justify-center mb-5">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500 blur-2xl opacity-25 rounded-2xl" />
                    <div className="relative bg-gradient-to-r from-red-600 to-orange-500 rounded-2xl px-12 py-4 text-center shadow-2xl">
                      <p className="text-7xl font-black text-white leading-none tracking-tighter">
                        -{maxPct}%
                      </p>
                      <p className="text-sm font-bold text-white/80 uppercase tracking-widest mt-1">
                        DE DESCONTO
                      </p>
                    </div>
                  </div>
                </div>

                {/* Produto único — layout centralizado */}
                {isSolo ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-white font-bold text-base leading-snug text-center line-clamp-2 max-w-sm">
                      {winners[0].title}
                    </p>
                    <div className="flex items-end gap-4 justify-center">
                      {winners[0].originalPrice && (
                        <div className="text-center">
                          <p className="text-[10px] text-white/40 uppercase">Era</p>
                          <p className="text-lg font-bold text-white/30 line-through">
                            {fmtCurrency(Number(winners[0].originalPrice))}
                          </p>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-[10px] text-white/40 uppercase">Agora</p>
                        <p className="text-4xl font-black text-white leading-none">
                          {fmtCurrency(Number(winners[0].price))}
                        </p>
                      </div>
                    </div>
                    {winners[0].saved > 0 && (
                      <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-2 text-center">
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Economia real</p>
                        <p className="text-xl font-black text-emerald-400">
                          {fmtCurrency(winners[0].saved)}{' '}
                          <span className="text-sm text-white/40">economizados</span>
                        </p>
                      </div>
                    )}
                  </div>

                ) : (
                  /* Múltiplos empatados — ranking */
                  <div className="space-y-3">
                    <p className="text-center text-xs text-white/40 uppercase tracking-widest mb-1">
                      {winners.length} produtos empatados · ordenados por maior economia
                    </p>
                    {winners.map((p, i) => (
                      <div key={i}
                        className={`flex items-center gap-4 rounded-xl px-4 py-3 border ${
                          i === 0
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        {/* Medalha */}
                        <span className="text-2xl flex-shrink-0">{medals[i]}</span>

                        {/* Info produto */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white leading-snug line-clamp-1">
                            {p.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {p.originalPrice && (
                              <span className="text-xs text-white/30 line-through">
                                {fmtCurrency(Number(p.originalPrice))}
                              </span>
                            )}
                            <span className="text-sm font-black text-white">
                              {fmtCurrency(Number(p.price))}
                            </span>
                          </div>
                        </div>

                        {/* Economia */}
                        {p.saved > 0 && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] text-white/30 uppercase">economia</p>
                            <p className="text-sm font-black text-emerald-400">
                              {fmtCurrency(p.saved)}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <p className="text-white/40 text-xs text-center mt-5">
                  👉 Acesse{' '}
                  <span className="text-white/70 font-semibold">manu-promocoes.com.br</span>
                  {' '}e aproveite agora
                </p>
              </ChartCard>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
