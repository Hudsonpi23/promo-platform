/**
 * Metrics Routes
 * GET /api/metrics/summary  → KPIs gerais + dados para gráficos
 */

import { FastifyInstance } from 'fastify';
import { authGuard } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

export async function metricsRoutes(app: FastifyInstance) {

  app.get('/summary', { preHandler: [authGuard] }, async (_req, reply) => {
    try {
      const now   = new Date();
      const day7  = new Date(now); day7.setDate(day7.getDate() - 6);
      day7.setHours(0, 0, 0, 0);

      // ── 1. Totais gerais ─────────────────────────────────────────────────
      // PostHistory cobre todos os canais (SITE, TELEGRAM, TWITTER)
      // PublishedPost é exclusivo do site (usado para vitrine e descontos)
      const [totalPosts, totalClicks, postsThisWeek] = await Promise.all([
        prisma.postHistory.count(),
        prisma.click.count(),
        prisma.postHistory.count({ where: { postedAt: { gte: day7 } } }),
      ]);

      // ── 2. Desconto médio e economia total ───────────────────────────────
      const priceData = await prisma.publishedPost.findMany({
        select: { price: true, originalPrice: true, discountPct: true },
      });

      const totalSavings = priceData.reduce((acc, p) => {
        if (p.originalPrice && Number(p.originalPrice) > Number(p.price)) {
          return acc + (Number(p.originalPrice) - Number(p.price));
        }
        return acc;
      }, 0);

      const avgDiscount = priceData.length > 0
        ? Math.round(priceData.reduce((a, p) => a + p.discountPct, 0) / priceData.length)
        : 0;

      // Desconto mediano e médio para simulação de economia (sem distorção por produtos caros)
      const discountValues = priceData
        .map(p => p.discountPct)
        .filter(d => d > 0)
        .sort((a, b) => a - b);
      const medianDiscount = (() => {
        if (!discountValues.length) return 0;
        const mid = Math.floor(discountValues.length / 2);
        return discountValues.length % 2 === 0
          ? Math.round((discountValues[mid - 1] + discountValues[mid]) / 2)
          : discountValues[mid];
      })();
      const meanDiscount = avgDiscount;

      // ── 3. Posts por dia (últimos 7 dias) — todos os canais ─────────────
      const postsByDayRaw = await prisma.postHistory.findMany({
        where:  { postedAt: { gte: day7 } },
        select: { postedAt: true },
        orderBy: { postedAt: 'asc' },
      });

      const dayMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(day7);
        d.setDate(d.getDate() + i);
        const key = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
        dayMap[key] = 0;
      }
      postsByDayRaw.forEach(p => {
        const key = p.postedAt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
        if (key in dayMap) dayMap[key]++;
      });
      const postsByDay = Object.entries(dayMap).map(([day, posts]) => ({ day, posts }));

      // ── 4. Posts por nicho ───────────────────────────────────────────────
      const nicheGroups = await prisma.publishedPost.groupBy({
        by:      ['nicheId'],
        _count:  { _all: true },
        orderBy: { _count: { nicheId: 'desc' } },
        take:    7,
      });

      const nicheIds = nicheGroups.map(g => g.nicheId);
      const niches   = await prisma.niche.findMany({
        where:  { id: { in: nicheIds } },
        select: { id: true, name: true, icon: true, color: true },
      });
      const nicheMap = Object.fromEntries(niches.map(n => [n.id, n]));

      const postsByNiche = nicheGroups.map(g => ({
        name:  nicheMap[g.nicheId]?.name  || 'Outros',
        icon:  nicheMap[g.nicheId]?.icon  || '🏷️',
        color: nicheMap[g.nicheId]?.color || '#6366F1',
        posts: g._count._all,
      }));

      // ── 5. Top produtos por desconto ─────────────────────────────────────
      const topByDiscount = await prisma.publishedPost.findMany({
        where:   { discountPct: { gt: 0 } },
        orderBy: { discountPct: 'desc' },
        take:    5,
        select:  { title: true, discountPct: true, price: true, originalPrice: true, imageUrl: true },
      });

      // ── 6. Top produtos por cliques ──────────────────────────────────────
      const clickGroups = await prisma.click.groupBy({
        by:      ['publishedPostId'],
        _count:  { _all: true },
        orderBy: { _count: { publishedPostId: 'desc' } },
        take:    5,
        where:   { publishedPostId: { not: null } },
      });

      const topPostIds = clickGroups
        .map(g => g.publishedPostId)
        .filter((id): id is string => id !== null);

      const topPosts = await prisma.publishedPost.findMany({
        where:  { id: { in: topPostIds } },
        select: { id: true, title: true, discountPct: true, price: true },
      });
      const postClickMap = Object.fromEntries(clickGroups.map(g => [g.publishedPostId, g._count._all]));
      const topByClicks = topPosts
        .map(p => ({ ...p, clicks: postClickMap[p.id] || 0 }))
        .sort((a, b) => b.clicks - a.clicks);

      // ── 7. Métricas completas por canal (PostHistory manual-*) ───────────
      const publishedByChannel: Record<string, number> = {
        SITE: 0, TWITTER: 0, TELEGRAM: 0, FACEBOOK: 0, INSTAGRAM: 0, WHATSAPP: 0,
      };
      let totalPublications = 0;

      type ChannelStat = {
        totalPosts: number; postsThisWeek: number;
        avgDiscount: number; totalSavings: number;
        discountDist: { label: string; count: number }[];
        postsByNiche: { name: string; icon: string; color: string; posts: number }[];
        topByDiscount: { title: string; discountPct: number; price: number; originalPrice?: number; imageUrl?: string }[];
        activityByDay: { day: string; posts: number; clicks: number }[];
      };
      const channelStats: Record<string, ChannelStat> = {};

      try {
        const allManualPosts = await prisma.postHistory.findMany({
          where: { uniqueHash: { startsWith: 'manual-' } },
          select: { channel: true, offerId: true, postedAt: true, copyText: true },
        });

        const realOfferIds = [...new Set(
          allManualPosts.filter(p => p.offerId !== 'video-standalone').map(p => p.offerId)
        )];
        const fullOffers = await prisma.offer.findMany({
          where: { id: { in: realOfferIds } },
          select: { id: true, title: true, finalPrice: true, originalPrice: true, discountPct: true, imageUrl: true, mainImage: true, nicheId: true },
        });
        const offerMap = Object.fromEntries(fullOffers.map(o => [o.id, o]));

        const nicheIds = [...new Set(fullOffers.map(o => o.nicheId).filter(Boolean))] as string[];
        const nicheList = await prisma.niche.findMany({
          where: { id: { in: nicheIds } },
          select: { id: true, name: true, icon: true, color: true },
        });
        const nicheMap = Object.fromEntries(nicheList.map(n => [n.id, n]));

        const DISC_RANGES = [
          { label: '10-19%', min: 10, max: 19 }, { label: '20-29%', min: 20, max: 29 },
          { label: '30-39%', min: 30, max: 39 }, { label: '40-49%', min: 40, max: 49 },
          { label: '50%+',   min: 50, max: 100 },
        ];

        const SOCIAL_CHANNELS = ['TWITTER', 'TELEGRAM', 'FACEBOOK', 'INSTAGRAM'];
        for (const ch of SOCIAL_CHANNELS) {
          const posts = allManualPosts.filter(p => (p.channel as string) === ch);
          const thisWeek = posts.filter(p => p.postedAt >= day7);
          publishedByChannel[ch] = posts.length;

          // Resolver dados de oferta para cada post
          const chOffers = posts.map(p => {
            if (p.offerId === 'video-standalone') {
              try { const d = JSON.parse(p.copyText); return { id: 'video', title: d.title || '', finalPrice: d.price || 0, originalPrice: d.originalPrice || 0, discountPct: d.discountPct || 0, imageUrl: null, mainImage: null, nicheId: null }; } catch { return null; }
            }
            return offerMap[p.offerId] || null;
          }).filter(Boolean) as typeof fullOffers[number][];

          // Stats básicas
          let savings = 0, discountSum = 0, discountCount = 0;
          for (const o of chOffers) {
            const price = Number(o.finalPrice), orig = Number(o.originalPrice || 0), disc = o.discountPct || 0;
            if (orig > price) savings += orig - price;
            if (disc > 0) { discountSum += disc; discountCount++; }
          }

          // Distribuição de descontos
          const discountDist = DISC_RANGES.map(r => ({
            label: r.label,
            count: chOffers.filter(o => (o.discountPct || 0) >= r.min && (o.discountPct || 0) <= r.max).length,
          }));

          // Posts por nicho
          const nicheCount: Record<string, number> = {};
          chOffers.forEach(o => { if (o.nicheId) nicheCount[o.nicheId] = (nicheCount[o.nicheId] || 0) + 1; });
          const postsByNiche = Object.entries(nicheCount)
            .map(([nId, c]) => ({ name: nicheMap[nId]?.name || 'Outros', icon: nicheMap[nId]?.icon || '🏷️', color: nicheMap[nId]?.color || '#6366F1', posts: c }))
            .sort((a, b) => b.posts - a.posts).slice(0, 7);

          // Top por desconto
          const topByDiscount = [...chOffers]
            .filter(o => (o.discountPct || 0) > 0)
            .sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0))
            .slice(0, 5)
            .map(o => ({ title: o.title, discountPct: o.discountPct || 0, price: Number(o.finalPrice), originalPrice: o.originalPrice ? Number(o.originalPrice) : undefined, imageUrl: (o as any).mainImage || o.imageUrl || undefined }));

          // Atividade por dia
          const dayMapCh: Record<string, number> = {};
          for (let i = 0; i < 7; i++) {
            const d = new Date(day7); d.setDate(d.getDate() + i);
            dayMapCh[d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })] = 0;
          }
          thisWeek.forEach(p => {
            const k = p.postedAt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
            if (k in dayMapCh) dayMapCh[k]++;
          });

          channelStats[ch] = {
            totalPosts: posts.length, postsThisWeek: thisWeek.length,
            avgDiscount: discountCount > 0 ? Math.round(discountSum / discountCount) : 0,
            totalSavings: Math.round(savings * 100) / 100,
            discountDist, postsByNiche, topByDiscount,
            activityByDay: Object.entries(dayMapCh).map(([day, p]) => ({ day, posts: p, clicks: 0 })),
          };
        }
        totalPublications = allManualPosts.length;
      } catch (e) {
        console.error('[Metrics] Erro ao calcular métricas por canal:', e);
      }

      // ── 8. Distribuição de descontos ─────────────────────────────────────
      const discountRanges = [
        { label: '10-19%', min: 10, max: 19 },
        { label: '20-29%', min: 20, max: 29 },
        { label: '30-39%', min: 30, max: 39 },
        { label: '40-49%', min: 40, max: 49 },
        { label: '50%+',   min: 50, max: 100 },
      ];
      const discountDist = await Promise.all(
        discountRanges.map(async r => ({
          label: r.label,
          count: await prisma.publishedPost.count({
            where: { discountPct: { gte: r.min, lte: r.max } },
          }),
        }))
      );

      // ── 8. Cliques por dia (últimos 7 dias) ──────────────────────────────
      const clicksByDayRaw = await prisma.click.findMany({
        where:  { createdAt: { gte: day7 } },
        select: { createdAt: true },
      });

      const clickDayMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(day7);
        d.setDate(d.getDate() + i);
        const key = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
        clickDayMap[key] = 0;
      }
      clicksByDayRaw.forEach(c => {
        const key = c.createdAt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
        if (key in clickDayMap) clickDayMap[key]++;
      });
      const clicksByDay = Object.entries(clickDayMap).map(([day, clicks]) => ({ day, clicks }));

      // ── Combinar postsByDay + clicksByDay ────────────────────────────────
      const activityByDay = postsByDay.map((d, i) => ({
        day:    d.day,
        posts:  d.posts,
        clicks: clicksByDay[i]?.clicks || 0,
      }));

      return reply.send({
        summary: {
          totalPosts,
          totalClicks,
          postsThisWeek,
          avgDiscount,
          totalSavings: Math.round(totalSavings * 100) / 100,
          medianDiscount,
          meanDiscount,
          totalPublications,
          publishedByChannel,
          channelStats,
        },
        charts: {
          activityByDay,
          postsByNiche,
          discountDist,
        },
        tables: {
          topByDiscount,
          topByClicks,
        },
      });

    } catch (err: any) {
      console.error('[Metrics]', err.message);
      return reply.status(500).send({ error: err.message });
    }
  });
}
