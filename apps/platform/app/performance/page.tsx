'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface OfferWithCount {
  id: string;
  title: string;
  finalPrice: number;
  originalPrice?: number;
  discount?: number;
  discountPct?: number;
  mainImage?: string;
  imageUrl?: string;
  niche?: { id: string; name: string; icon?: string };
  store?: { name: string };
  _count?: { offerPublications: number; drafts: number };
}

export default function PerformancePage() {
  const { data: offersRaw } = useSWR<OfferWithCount[]>('/api/offers?active=true', fetcher);
  const { data: metrics } = useSWR('/api/metrics/summary', fetcher);

  const offers: OfferWithCount[] = Array.isArray(offersRaw)
    ? offersRaw
    : (offersRaw as any)?.data || [];

  // ── Cálculos de performance ──────────────────────────────────────────────
  const totalPublications = offers.reduce((s, o) => s + (o._count?.offerPublications || 0), 0);
  const totalOffers = offers.length;
  const neverPublished = offers.filter(o => !o._count?.offerPublications).length;
  const avgDiscount = offers.length
    ? Math.round(offers.reduce((s, o) => s + Number(o.discount || o.discountPct || 0), 0) / offers.length)
    : 0;

  // Top 5 por publicações
  const topByPublications = [...offers]
    .sort((a, b) => (b._count?.offerPublications || 0) - (a._count?.offerPublications || 0))
    .slice(0, 5);

  // Top 5 por desconto
  const topByDiscount = [...offers]
    .sort((a, b) => Number(b.discount || b.discountPct || 0) - Number(a.discount || a.discountPct || 0))
    .slice(0, 5);

  // Agrupamento por nicho
  const nicheMap: Record<string, { name: string; icon?: string; count: number; publications: number }> = {};
  offers.forEach(o => {
    const key = o.niche?.id || 'sem-nicho';
    if (!nicheMap[key]) {
      nicheMap[key] = { name: o.niche?.name || 'Sem nicho', icon: o.niche?.icon, count: 0, publications: 0 };
    }
    nicheMap[key].count++;
    nicheMap[key].publications += o._count?.offerPublications || 0;
  });
  const nicheStats = Object.values(nicheMap)
    .sort((a, b) => b.publications - a.publications)
    .slice(0, 8);

  // Oportunidades: ofertas com bom desconto mas poucas publicações
  const opportunities = [...offers]
    .filter(o => Number(o.discount || o.discountPct || 0) >= 20 && (o._count?.offerPublications || 0) === 0)
    .sort((a, b) => Number(b.discount || b.discountPct || 0) - Number(a.discount || a.discountPct || 0))
    .slice(0, 5);

  const fmt = (v: number) => formatCurrency(v);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">📈 Performance por Produto</h1>
        <p className="text-text-muted text-sm">Quais produtos estão gerando mais resultados</p>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Ofertas', value: totalOffers, icon: '🏷️', color: 'text-blue-400' },
          { label: 'Publicações Totais', value: totalPublications, icon: '📤', color: 'text-green-400' },
          { label: 'Nunca Publicadas', value: neverPublished, icon: '⏳', color: 'text-yellow-400' },
          { label: 'Desconto Médio', value: `${avgDiscount}%`, icon: '💰', color: 'text-orange-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-text-muted text-xs mb-1">{kpi.icon} {kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Métricas do canal (X + Telegram) ─────────────────────────────── */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: 'TWITTER', label: 'X (Twitter)', icon: '🐦', color: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
            { key: 'TELEGRAM', label: 'Telegram', icon: '📱', color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' },
            { key: 'SITE', label: 'Site', icon: '🌐', color: 'bg-green-500/10 border-green-500/30 text-green-400' },
          ].map(ch => {
            const stat = metrics.channelStats?.[ch.key];
            if (!stat) return null;
            return (
              <div key={ch.key} className={`border rounded-xl p-4 ${ch.color}`}>
                <p className="font-semibold text-sm mb-3">{ch.icon} {ch.label}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Posts totais</span>
                    <span className="font-bold">{stat.totalPosts || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Esta semana</span>
                    <span className="font-bold">{stat.postsThisWeek || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Desconto médio</span>
                    <span className="font-bold">{stat.avgDiscount || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Economia gerada</span>
                    <span className="font-bold">{fmt(stat.totalSavings || 0)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Top por publicações ───────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="font-bold text-text-primary mb-4">🏆 Mais Publicados</h2>
          {topByPublications.length === 0 ? (
            <p className="text-text-muted text-sm">Nenhuma publicação ainda</p>
          ) : (
            <div className="space-y-3">
              {topByPublications.map((offer, i) => {
                const pubs = offer._count?.offerPublications || 0;
                const maxPubs = topByPublications[0]._count?.offerPublications || 1;
                return (
                  <div key={offer.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-text-muted text-xs w-4">#{i + 1}</span>
                        <span className="text-sm text-text-primary truncate">{offer.title}</span>
                      </div>
                      <span className="text-green-400 font-bold text-sm ml-2 shrink-0">{pubs} posts</span>
                    </div>
                    <div className="h-1.5 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${Math.round((pubs / maxPubs) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Top por desconto ─────────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="font-bold text-text-primary mb-4">🔥 Maiores Descontos</h2>
          {topByDiscount.length === 0 ? (
            <p className="text-text-muted text-sm">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {topByDiscount.map((offer, i) => {
                const disc = Number(offer.discount || offer.discountPct || 0);
                return (
                  <div key={offer.id} className="flex items-center gap-3">
                    <span className="text-text-muted text-xs w-4">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{offer.title}</p>
                      <p className="text-xs text-text-muted">{offer.niche?.name} • {offer.store?.name}</p>
                    </div>
                    <span className={`font-bold text-sm shrink-0 ${disc >= 40 ? 'text-orange-400' : disc >= 25 ? 'text-yellow-400' : 'text-text-muted'}`}>
                      -{disc}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Engajamento por categoria ─────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="font-bold text-text-primary mb-4">📂 Categorias com Mais Publicações</h2>
          {nicheStats.length === 0 ? (
            <p className="text-text-muted text-sm">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {nicheStats.map(n => {
                const maxPubs = nicheStats[0].publications || 1;
                return (
                  <div key={n.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text-primary">{n.icon && `${n.icon} `}{n.name}</span>
                      <div className="flex gap-3 text-xs text-text-muted">
                        <span>{n.count} ofertas</span>
                        <span className="text-primary font-bold">{n.publications} posts</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.round((n.publications / maxPubs) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Oportunidades ─────────────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="font-bold text-text-primary mb-1">⚡ Oportunidades</h2>
          <p className="text-xs text-text-muted mb-4">Ofertas com bom desconto que ainda não foram publicadas</p>
          {opportunities.length === 0 ? (
            <p className="text-text-muted text-sm">Todas as boas ofertas já foram publicadas! 🎉</p>
          ) : (
            <div className="space-y-3">
              {opportunities.map(offer => {
                const disc = Number(offer.discount || offer.discountPct || 0);
                return (
                  <div key={offer.id} className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                    {(offer.mainImage || offer.imageUrl) && (
                      <img
                        src={offer.mainImage || offer.imageUrl}
                        alt={offer.title}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{offer.title}</p>
                      <p className="text-xs text-text-muted">{fmt(Number(offer.finalPrice))}</p>
                    </div>
                    <span className="text-orange-400 font-bold text-sm shrink-0">-{disc}%</span>
                  </div>
                );
              })}
              <a
                href="/ofertas"
                className="block text-center text-xs text-primary hover:underline mt-2"
              >
                Publicar no painel de ofertas →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
