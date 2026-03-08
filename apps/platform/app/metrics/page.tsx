'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
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
interface ActivityDay  { day: string; posts: number; clicks: number }
interface NicheItem    { name: string; icon: string; color: string; posts: number }
interface DiscountItem { label: string; count: number }
interface TopProduct   { title: string; discountPct: number; price: unknown; originalPrice?: unknown; clicks?: number }

interface MetricsData {
  summary: MetricsSummary;
  charts:  { activityByDay: ActivityDay[]; postsByNiche: NicheItem[]; discountDist: DiscountItem[] };
  tables:  { topByDiscount: TopProduct[]; topByClicks: TopProduct[] };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-5 relative overflow-hidden`}>
      <div className={`absolute inset-0 opacity-5 ${color}`} />
      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-black text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
      <span className="absolute top-4 right-4 text-2xl opacity-30">{icon}</span>
    </div>
  );
}

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: '#1a1a2e',
  border: '1px solid #2d2d44',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
};

// ── Page ───────────────────────────────────────────────────────────────────
export default function MetricsPage() {
  const [data, setData]       = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWithAuth('/api/metrics/summary')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#0f0f1a',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `manu-metricas-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  };

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
    <div className="p-6"><div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">{error}</div></div>
  );

  if (!data) return null;

  const { summary, charts, tables } = data;

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-text-primary flex items-center gap-2">
            📊 Dashboard de Métricas
          </h1>
          <p className="text-text-muted text-sm mt-0.5">
            Dados reais de performance da Manu Promoções
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          {exporting ? (
            <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Exportando…</>
          ) : '📥 Exportar como Imagem'}
        </button>
      </div>

      {/* Dashboard exportável */}
      <div ref={dashboardRef} className="space-y-5">

        {/* Marca d'água no topo */}
        <div className="bg-gradient-to-r from-purple-600/20 via-pink-500/10 to-orange-400/10 border border-purple-500/20 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <span className="font-bold text-text-primary">Manu Promoções</span>
            <span className="text-text-muted text-sm">— Relatório Semanal</span>
          </div>
          <span className="text-xs text-text-muted">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard icon="📢" label="Total de Posts"     value={summary.totalPosts.toString()}         sub="desde o início"            color="bg-purple-500" />
          <KpiCard icon="👆" label="Cliques Totais"     value={summary.totalClicks.toString()}        sub="nos links afiliados"       color="bg-blue-500" />
          <KpiCard icon="📅" label="Posts esta semana"  value={summary.postsThisWeek.toString()}      sub="últimos 7 dias"            color="bg-emerald-500" />
          <KpiCard icon="💰" label="Desconto Médio"     value={`${summary.avgDiscount}%`}             sub="em todos os posts"         color="bg-amber-500" />
          <KpiCard icon="💸" label="Economia Gerada"    value={fmtCurrency(summary.totalSavings)}     sub="potencial para seguidores" color="bg-rose-500" />
        </div>

        {/* Gráfico de Atividade: posts + cliques por dia */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-secondary mb-4 flex items-center gap-2">
            📈 Atividade nos últimos 7 dias
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.activityByDay} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d44" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#8b8ba8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b8ba8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#8b8ba8' }} />
              <Bar dataKey="posts"  name="Posts"   fill="#8b5cf6" radius={[4,4,0,0]} maxBarSize={36} />
              <Bar dataKey="clicks" name="Cliques" fill="#ec4899" radius={[4,4,0,0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Linha: Nicho + Desconto */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Posts por Nicho */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-secondary mb-4 flex items-center gap-2">
              🏷️ Posts por Nicho
            </h2>
            {charts.postsByNiche.length === 0 ? (
              <p className="text-center text-text-muted text-sm py-8">Sem dados ainda</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={charts.postsByNiche}
                    dataKey="posts"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={80}
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#4a4a6a' }}
                  >
                    {charts.postsByNiche.map((entry, i) => (
                      <Cell key={i} fill={entry.color || `hsl(${i * 50}, 70%, 55%)`} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Distribuição de Descontos */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-secondary mb-4 flex items-center gap-2">
              🔥 Distribuição de Descontos
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.discountDist} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d44" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#8b8ba8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fill: '#8b8ba8', fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar dataKey="count" name="Posts" radius={[0,4,4,0]} maxBarSize={22}>
                  {charts.discountDist.map((_, i) => (
                    <Cell key={i} fill={['#f59e0b','#f97316','#ef4444','#dc2626','#991b1b'][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabelas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Top produtos por desconto */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-secondary mb-4 flex items-center gap-2">
              🏆 Maiores Descontos
            </h2>
            {tables.topByDiscount.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-6">Sem dados ainda</p>
            ) : (
              <div className="space-y-2">
                {tables.topByDiscount.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-background">
                    <span className="text-xs font-black text-text-muted w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{p.title}</p>
                      <p className="text-xs text-text-muted">R$ {Number(p.price).toFixed(0)}</p>
                    </div>
                    <span className="bg-red-500/20 text-red-400 text-xs font-black px-2 py-1 rounded-lg flex-shrink-0">
                      -{p.discountPct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top produtos por cliques */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-secondary mb-4 flex items-center gap-2">
              👆 Mais Clicados
            </h2>
            {tables.topByClicks.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-6">Sem cliques registrados ainda</p>
            ) : (
              <div className="space-y-2">
                {tables.topByClicks.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-background">
                    <span className="text-xs font-black text-text-muted w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{p.title}</p>
                      <p className="text-xs text-text-muted">-{p.discountPct}% de desconto</p>
                    </div>
                    <span className="bg-blue-500/20 text-blue-400 text-xs font-black px-2 py-1 rounded-lg flex-shrink-0">
                      {p.clicks} cliques
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé da imagem exportada */}
        <div className="text-center py-2">
          <p className="text-xs text-text-muted">
            🌐 manu-promocoes.com.br · Dados gerados automaticamente pela Promo Platform
          </p>
        </div>

      </div>
    </div>
  );
}
