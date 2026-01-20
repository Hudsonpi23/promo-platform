'use client';

import Link from 'next/link';
import { PublicPost } from '@/lib/api';

interface OfferCardProps {
  post: PublicPost;
  featured?: boolean;
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function getUrgencyInfo(urgency: string) {
  switch (urgency) {
    case 'HOJE':
      return { label: '⚡ HOJE', bg: 'bg-blue-500', text: 'text-white' };
    case 'ULTIMAS_UNIDADES':
      return { label: '🔥 ÚLTIMAS!', bg: 'bg-red-500', text: 'text-white' };
    case 'LIMITADO':
      return { label: '⏰ LIMITADO', bg: 'bg-purple-500', text: 'text-white' };
    default:
      return null;
  }
}

export function OfferCard({ post, featured = false }: OfferCardProps) {
  const urgencyInfo = getUrgencyInfo(post.urgency);
  const hasDiscount = post.discount && post.discount > 0;
  const slug = post.slug || post.id;

  return (
    <article className={`bg-white rounded-2xl border-2 border-blue-100 hover:border-blue-300 shadow-md hover:shadow-xl transition-all group relative p-4 ${featured ? 'md:p-5' : ''}`}>
      {/* Badge de desconto */}
      {hasDiscount && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-lg border-2 border-white transform rotate-3 group-hover:rotate-0 transition-transform">
            -{post.discount}%
          </div>
        </div>
      )}

      {/* Urgência */}
      {urgencyInfo && (
        <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${urgencyInfo.bg} ${urgencyInfo.text} mb-3`}>
          {urgencyInfo.label}
        </div>
      )}

      {/* Nicho + Loja */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
          {post.nicheIcon && <span>{post.nicheIcon}</span>}
          {post.niche}
        </span>
        <span className="text-gray-400 text-xs">•</span>
        <span className="text-gray-500 text-xs font-medium">{post.store}</span>
      </div>

      {/* Headline estilo Manu (se disponível) */}
      {post.headline && (
        <p className="text-sm text-gray-600 italic mb-2">
          "{post.headline}"
        </p>
      )}

      {/* Título */}
      <Link href={`/oferta/${slug}`} className="block group/link">
        <h3 className={`font-bold text-blue-900 group-hover/link:text-blue-600 transition-colors line-clamp-2 mb-4 ${featured ? 'text-lg' : 'text-base'}`}>
          {post.title}
        </h3>
      </Link>

      {/* Preços */}
      <div className="mb-4">
        {post.originalPrice && post.originalPrice > post.price && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gray-400 text-sm line-through">
              {formatPrice(post.originalPrice)}
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <span className={`font-extrabold text-blue-600 ${featured ? 'text-2xl' : 'text-xl'}`}>
            {formatPrice(post.price)}
          </span>
          {hasDiscount && (
            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-md">
              ECONOMIA {formatPrice((post.originalPrice || post.price) - post.price)}
            </span>
          )}
        </div>
      </div>

      {/* Botão */}
      <Link
        href={`/go/${post.goCode || post.id}`}
        className="block w-full text-center py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
      >
        VER OFERTA →
      </Link>
    </article>
  );
}

export function OfferCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border-2 border-blue-100 p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-20 bg-blue-100 rounded-lg"></div>
        <div className="h-4 w-16 bg-gray-100 rounded"></div>
      </div>
      <div className="h-5 bg-gray-100 rounded mb-2"></div>
      <div className="h-5 bg-gray-100 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-100 rounded w-1/3 mb-1"></div>
      <div className="h-7 bg-blue-100 rounded w-1/2 mb-4"></div>
      <div className="h-12 bg-blue-200 rounded-xl"></div>
    </div>
  );
}
