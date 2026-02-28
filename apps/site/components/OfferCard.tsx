'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PublicPost } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { isAdmin } from '@/lib/auth';

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
  const router = useRouter();
  const urgencyInfo = getUrgencyInfo(post.urgency);
  const hasDiscount = Boolean(post.discount && post.discount > 0);
  const slug = post.slug || post.id;
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Verificar se usuário admin está logado
    setIsLoggedIn(isAdmin());
    
    // Escutar mudanças no localStorage
    const handleStorageChange = () => {
      setIsLoggedIn(isAdmin());
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Verificar periodicamente
    const interval = setInterval(() => {
      setIsLoggedIn(isAdmin());
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmDelete = confirm(
      `🗑️ Deletar este post?\n\n"${post.title}"\n\n⚠️ Não pode ser desfeito!`
    );

    if (!confirmDelete) return;

    setIsDeleting(true);

    try {
      // Usar a mesma constante de API_URL do lib/api.ts
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = `${apiUrl}/public/posts/${post.id}`;
      
      console.log('Deletando post:', { url, postId: post.id });

      // Tentar primeiro com token (se existir)
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      // Tentar parsear a resposta mesmo se não for ok
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        responseData = { error: { message: 'Erro ao processar resposta do servidor' } };
      }

      if (!response.ok) {
        const errorMessage = responseData?.error?.message || responseData?.message || `Erro ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Sucesso - remover o card da tela imediatamente
      const cardElement = (e.target as HTMLElement).closest('article');
      if (cardElement) {
        cardElement.style.opacity = '0';
        cardElement.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          cardElement.remove();
        }, 300);
      }
      
      // Mostrar mensagem de sucesso
      alert('✅ Post deletado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao deletar post:', error);
      const errorMessage = error.message || 'Erro desconhecido ao deletar post';
      alert(`❌ Erro: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <article className={`bg-white rounded-2xl border-2 border-blue-100 hover:border-blue-300 shadow-md hover:shadow-xl transition-all group relative overflow-hidden ${featured ? 'md:p-5' : ''}`}>
      {/* Badge de desconto */}
      {hasDiscount && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-lg border-2 border-white transform rotate-3 group-hover:rotate-0 transition-transform">
            -{post.discount}%
          </div>
        </div>
      )}

      {/* Imagem do produto */}
      {post.imageUrl && (
        <Link href={`/oferta/${slug}`} className="block">
          <div className={`relative w-full bg-gray-50 overflow-hidden ${featured ? 'h-56' : 'h-44'}`}>
            <Image
              src={post.imageUrl}
              alt={post.title}
              fill
              className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          </div>
        </Link>
      )}

      <div className="p-4">
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
      <a
        href={post.affiliateUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block w-full text-center py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg mb-2"
      >
        VER OFERTA →
      </a>

      {/* Botão deletar - apenas para admin */}
      {isLoggedIn && (
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-full text-center py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          title="Deletar post"
        >
          {isDeleting ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>Deletando...</span>
            </>
          ) : (
            <>
              <span>🗑️</span>
              <span>Deletar</span>
            </>
          )}
        </button>
      )}
      </div>
    </article>
  );
}

export function OfferCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border-2 border-blue-100 overflow-hidden animate-pulse">
      <div className="w-full h-44 bg-gray-100"></div>
      <div className="p-4">
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
    </div>
  );
}
