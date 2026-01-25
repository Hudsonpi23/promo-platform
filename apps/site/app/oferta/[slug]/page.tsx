import { Metadata } from 'next';
import { getPost, getOferta, formatCurrency, getUrgencyInfo, getGoUrl, PublicPost } from '@/lib/api';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ImageCarousel from '@/components/ImageCarousel';

export const revalidate = 60;

// SEO dinâmico
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug) || await getOferta(params.slug);
  
  if (!post) {
    return {
      title: 'Oferta não encontrada',
    };
  }

  const discountText = post.discount > 0 ? ` com ${post.discount}% OFF` : '';

  return {
    title: `${post.title}${discountText}`,
    description: `${post.title} por ${formatCurrency(post.price)}${discountText}. Aproveite esta oferta na ${post.store}!`,
    openGraph: {
      title: `🔥 ${post.title}${discountText}`,
      description: `Oferta imperdível: ${post.title} por apenas ${formatCurrency(post.price)}!`,
      images: post.imageUrl ? [{ url: post.imageUrl }] : undefined,
    },
  };
}

interface Props {
  params: { slug: string };
}

// Dado demo para quando a API não está rodando
const DEMO_POST: PublicPost = {
  id: 'demo-1',
  slug: 'iphone-15-pro-max',
  goCode: 'demo123',
  title: 'iPhone 15 Pro Max 256GB Titânio Natural',
  copyText: '🔥 OFERTA IMPERDÍVEL!\n\nO iPhone mais avançado já criado. Com chip A17 Pro, câmera de 48MP e tela Super Retina XDR de 6,7 polegadas.\n\n✅ Frete Grátis\n✅ Garantia Apple de 1 ano\n✅ Até 12x sem juros',
  price: 7499,
  originalPrice: 9999,
  discount: 25,
  affiliateUrl: 'https://example.com/iphone',
  niche: 'Eletrônicos',
  nicheIcon: '📱',
  store: 'Amazon',
  urgency: 'HOJE',
  publishedAt: new Date().toISOString(),
};

export default async function OfertaPage({ params }: Props) {
  // Tentar buscar por ID/slug e depois por slug de oferta
  let post = await getPost(params.slug);
  if (!post) {
    post = await getOferta(params.slug);
  }

  // Usar demo se não encontrar e o slug parece ser demo
  const isDemo = !post;
  if (!post) {
    if (params.slug.includes('demo') || params.slug === 'iphone-15-pro-max') {
      post = DEMO_POST;
    } else {
      notFound();
    }
  }

  const urgencyInfo = getUrgencyInfo(post.urgency);
  const originalPrice = post.originalPrice || (post.price / (1 - post.discount / 100));
  const goUrl = getGoUrl(post);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Banner Demo */}
      {isDemo && (
        <div className="fixed top-16 left-0 right-0 bg-amber-500 text-white text-center py-2 text-sm font-medium z-40">
          🎭 Modo Demo — Esta é uma oferta de exemplo.
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-gray-500">
            <li>
              <Link href="/" className="hover:text-red-600 transition-colors">
                Home
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/" className="hover:text-red-600 transition-colors">
                Ofertas
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-800 font-medium truncate max-w-[200px]">
              {post.title}
            </li>
          </ol>
        </nav>

        {/* Card da Oferta */}
        <article className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          {/* Urgência Banner */}
          {urgencyInfo && (
            <div className={`${urgencyInfo.color} text-white text-center py-3 font-bold text-sm`}>
              {urgencyInfo.text}
            </div>
          )}

          {/* Header */}
          <div className="bg-gray-50 px-6 md:px-8 py-4 border-b border-gray-100">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gray-200 text-gray-700 text-sm font-semibold">
                {post.nicheIcon && <span>{post.nicheIcon}</span>}
                {post.niche}
              </span>
              <span className="px-4 py-1.5 rounded-full bg-white text-gray-600 text-sm border border-gray-200">
                🏪 {post.store}
              </span>
            </div>
          </div>

          {/* Imagem(ns) - Carrossel se houver múltiplas */}
          {(post.imageUrl || (post as any).images?.length > 0) && (
            <ImageCarousel
              images={(post as any).images && (post as any).images.length > 0 ? (post as any).images : [post.imageUrl]}
              alt={post.title}
            />
          )}

          {/* Conteúdo Principal */}
          <div className="p-6 md:p-8">
            {/* Título */}
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800 mb-6 leading-tight">
              {post.title}
            </h1>

            {/* Preço Box */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 mb-6 border border-green-100">
              {post.discount > 0 && (
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg text-gray-400 line-through">
                    {formatCurrency(originalPrice)}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-green-500 text-white text-sm font-bold">
                    -{post.discount}% OFF
                  </span>
                </div>
              )}
              <div className="text-4xl md:text-5xl font-extrabold text-green-600">
                {formatCurrency(post.price)}
              </div>
              <p className="text-green-700 text-sm mt-2">
                ✓ Melhor preço verificado
              </p>
            </div>

            {/* Descrição / Copy */}
            {post.copyText && (
              <div className="bg-gray-50 rounded-xl p-6 mb-8 border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-3">Sobre a oferta</h3>
                <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {post.copyText}
                </p>
              </div>
            )}

            {/* Botão Principal - Link direto para affiliateUrl */}
            <a
              href={post.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="block w-full py-5 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold text-xl text-center transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-red-500/30"
            >
              APROVEITAR OFERTA 🔥
            </a>

            <p className="text-center text-gray-400 text-sm mt-4">
              Você será redirecionado para o site da loja parceira
            </p>
          </div>
        </article>

        {/* Aviso */}
        <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
          <p className="text-sm text-amber-700">
            ⚠️ Preços e disponibilidade podem mudar sem aviso prévio. Verifique no site da loja.
          </p>
        </div>

        {/* Botão voltar */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors"
          >
            ← Voltar para ofertas
          </Link>
        </div>
      </div>
    </div>
  );
}
