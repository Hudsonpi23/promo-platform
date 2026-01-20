import { Metadata } from 'next';
import { Suspense } from 'react';
import { getPostsByNiche, getNiches, Niche, PublicPost } from '@/lib/api';
import { OfferGrid } from '@/components/OfferGrid';
import { FiltersBar } from '@/components/FiltersBar';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 60;

// Gerar páginas estáticas para cada nicho
export async function generateStaticParams() {
  const niches = await getNiches();
  return niches.map((niche) => ({
    slug: niche.slug,
  }));
}

// SEO dinâmico
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPostsByNiche(params.slug);
  
  if (!data) {
    return {
      title: 'Categoria não encontrada',
    };
  }

  const { niche, posts } = data;

  return {
    title: `${niche.name} - Ofertas e Promoções`,
    description: `Encontre as melhores ofertas de ${niche.name}. ${posts.length} promoções disponíveis com descontos imperdíveis!`,
    openGraph: {
      title: `${niche.icon || '📦'} ${niche.name} - Ofertas do Dia`,
      description: `${posts.length} ofertas de ${niche.name} com até 70% de desconto!`,
    },
  };
}

interface Props {
  params: { slug: string };
  searchParams: { sort?: string; q?: string };
}

// Dados demo para quando a API não está rodando
const DEMO_NICHES: Record<string, { niche: Niche; posts: PublicPost[] }> = {
  eletronicos: {
    niche: { id: '1', name: 'Eletrônicos', slug: 'eletronicos', icon: '📱' },
    posts: [
      {
        id: 'demo-e1',
        goCode: 'demoe1',
        title: 'iPhone 15 Pro Max 256GB',
        price: 7499,
        originalPrice: 9999,
        discount: 25,
        affiliateUrl: '#',
        niche: 'Eletrônicos',
        nicheIcon: '📱',
        store: 'Amazon',
        urgency: 'HOJE',
        publishedAt: new Date().toISOString(),
      },
      {
        id: 'demo-e2',
        goCode: 'demoe2',
        title: 'Smart TV Samsung 65" 4K',
        price: 3299,
        originalPrice: 5499,
        discount: 40,
        affiliateUrl: '#',
        niche: 'Eletrônicos',
        nicheIcon: '📱',
        store: 'Magazine Luiza',
        urgency: 'ULTIMAS_UNIDADES',
        publishedAt: new Date().toISOString(),
      },
      {
        id: 'demo-e3',
        goCode: 'demoe3',
        title: 'Notebook Lenovo IdeaPad 3i Core i5',
        price: 2199,
        originalPrice: 3299,
        discount: 33,
        affiliateUrl: '#',
        niche: 'Eletrônicos',
        nicheIcon: '📱',
        store: 'Dell',
        urgency: 'HOJE',
        publishedAt: new Date().toISOString(),
      },
    ],
  },
  moda: {
    niche: { id: '2', name: 'Moda', slug: 'moda', icon: '👗' },
    posts: [
      {
        id: 'demo-m1',
        goCode: 'demom1',
        title: 'Tênis Nike Air Max 90',
        price: 449,
        originalPrice: 799,
        discount: 44,
        affiliateUrl: '#',
        niche: 'Moda',
        nicheIcon: '👗',
        store: 'Netshoes',
        urgency: 'HOJE',
        publishedAt: new Date().toISOString(),
      },
    ],
  },
  casa: {
    niche: { id: '3', name: 'Casa', slug: 'casa', icon: '🏠' },
    posts: [
      {
        id: 'demo-c1',
        goCode: 'democ1',
        title: 'Air Fryer Philips Walita 4.1L',
        price: 299,
        originalPrice: 599,
        discount: 50,
        affiliateUrl: '#',
        niche: 'Casa',
        nicheIcon: '🏠',
        store: 'Casas Bahia',
        urgency: 'LIMITADO',
        publishedAt: new Date().toISOString(),
      },
    ],
  },
};

export default async function NichePage({ params, searchParams }: Props) {
  // Buscar dados
  const [data, niches] = await Promise.all([
    getPostsByNiche(params.slug, { limit: 50 }),
    getNiches(),
  ]);

  // Tentar usar dados demo se API não retornar
  const demoData = DEMO_NICHES[params.slug];
  
  if (!data && !demoData) {
    notFound();
  }

  const niche = data?.niche || demoData?.niche;
  const posts = data?.posts || demoData?.posts || [];
  const displayNiches = niches.length > 0 ? niches : Object.values(DEMO_NICHES).map(d => d.niche);
  const isDemo = !data;

  // Filtrar por busca se necessário
  let filteredPosts = posts;
  if (searchParams.q) {
    const query = searchParams.q.toLowerCase();
    filteredPosts = posts.filter(p => 
      p.title.toLowerCase().includes(query) ||
      p.store.toLowerCase().includes(query)
    );
  }

  // Ordenar
  if (searchParams.sort === 'discount') {
    filteredPosts = [...filteredPosts].sort((a, b) => b.discount - a.discount);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner Demo */}
      {isDemo && (
        <div className="bg-amber-500 text-white text-center py-2 text-sm font-medium">
          🎭 Modo Demo — Exibindo ofertas de exemplo.
        </div>
      )}

      {/* Hero do Nicho */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="mb-6">
            <ol className="flex items-center gap-2 text-sm text-gray-400">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Nichos
                </Link>
              </li>
              <li>/</li>
              <li className="text-white font-medium">{niche?.name}</li>
            </ol>
          </nav>
          
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl md:text-6xl">{niche?.icon || '📦'}</span>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">
                {niche?.name}
              </h1>
              <p className="text-gray-400 mt-1">
                {filteredPosts.length} ofertas disponíveis
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="max-w-7xl mx-auto px-4 py-6">
        <Suspense fallback={<div className="h-20 bg-gray-100 rounded-xl animate-pulse" />}>
          <FiltersBar 
            niches={displayNiches}
            activeNiche={params.slug}
            totalCount={filteredPosts.length}
            showSearch
            showSort
          />
        </Suspense>
      </section>

      {/* Grid de Ofertas */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <OfferGrid 
          posts={filteredPosts}
          emptyMessage={`Nenhuma oferta em ${niche?.name} no momento`}
          emptyIcon={niche?.icon || '📦'}
        />
      </section>
    </div>
  );
}
