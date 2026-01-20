import { MetadataRoute } from 'next';
import { getPosts, getNiches } from '@/lib/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3003';

  // Buscar dados da API
  const [postsData, niches] = await Promise.all([
    getPosts({ limit: 100 }).catch(() => ({ items: [] })),
    getNiches().catch(() => []),
  ]);

  const posts = postsData.items;

  // Páginas estáticas
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
  ];

  // Páginas de nicho
  const nichePages: MetadataRoute.Sitemap = niches.map((niche) => ({
    url: `${baseUrl}/nicho/${niche.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Páginas de oferta
  const offerPages: MetadataRoute.Sitemap = posts
    .filter(post => post.slug || post.id)
    .map((post) => ({
      url: `${baseUrl}/oferta/${post.slug || post.id}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

  return [...staticPages, ...nichePages, ...offerPages];
}
