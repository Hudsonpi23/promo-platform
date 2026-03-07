import { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.manu-promocoes.com.br';
const API_URL  = process.env.NEXT_PUBLIC_API_URL  || 'https://promo-platform-api.onrender.com';

async function getAllPosts(): Promise<{ slug: string; updatedAt?: string }[]> {
  try {
    const res = await fetch(`${API_URL}/api/posts?limit=500`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || data || [];
  } catch {
    return [];
  }
}

async function getNiches(): Promise<{ slug: string }[]> {
  try {
    const res = await fetch(`${API_URL}/api/niches`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, niches] = await Promise.all([getAllPosts(), getNiches()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  const nicheRoutes: MetadataRoute.Sitemap = niches.map((n) => ({
    url: `${SITE_URL}/nicho/${n.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/oferta/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  return [...staticRoutes, ...nicheRoutes, ...postRoutes];
}
