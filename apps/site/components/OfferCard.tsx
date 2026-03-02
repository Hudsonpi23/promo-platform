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

  const economy = hasDiscount && post.originalPrice && post.originalPrice > post.price
    ? post.originalPrice - post.price
    : null;

  return (
    <article className={`bg-white rounded-2xl border-2 border-blue-100 hover:border-blue-300 shadow-md hover:shadow-xl transition-all group relative flex flex-col`}>

      {/* ── Imagem — clique vai direto para o link afiliado ── */}
      <a
        href={post.affiliateUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block"
      >
        <div className={`relative w-full bg-gray-50 overflow-hidden rounded-t-2xl ${featured ? 'h-56' : 'h-44'}`}>
          {post.imageUrl && (
            <Image
              src={post.imageUrl}
              alt={post.title}
              fill
              className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          )}

          {/* Badge de desconto — canto superior esquerdo */}
          {hasDiscount && (
            <div className="absolute top-2 left-2 z-10 flex flex-col items-center bg-gradient-to-br from-red-500 to-orange-500 text-white rounded-xl shadow-lg px-2.5 py-1.5 leading-none">
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-90">OFF</span>
              <span className="text-xl font-black leading-none">{post.discount}%</span>
              <span className="text-[9px] font-bold opacity-80">🔥 queimado</span>
            </div>
          )}

          {/* Badge urgência — canto superior direito */}
          {urgencyInfo && (
            <div className={`absolute top-2 right-2 z-10 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold shadow-md ${urgencyInfo.bg} ${urgencyInfo.text}`}>
              {urgencyInfo.label}
            </div>
          )}
        </div>
      </a>

      <div className="p-4 flex flex-col flex-1">

        {/* Nicho + Loja */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
            {post.nicheIcon && <span>{post.nicheIcon}</span>}
            {post.niche}
          </span>
          <span className="text-gray-300 text-xs">•</span>
          <span className="text-gray-500 text-xs font-medium">{post.store}</span>
        </div>

        {/* Título — clique vai direto para o link afiliado */}
        <a
          href={post.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block mb-3"
        >
          <h3 className={`font-bold text-blue-900 hover:text-blue-600 transition-colors line-clamp-2 ${featured ? 'text-lg' : 'text-sm'}`}>
            {post.title}
          </h3>
        </a>

        {/* ── Preços — estilo página de detalhe ── */}
        <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 mb-3">
          {/* Linha: preço original riscado + badge desconto */}
          {post.originalPrice && post.originalPrice > post.price && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-400 text-xs line-through">
                {formatPrice(post.originalPrice)}
              </span>
              {hasDiscount && (
                <span className="bg-green-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">
                  -{post.discount}% OFF
                </span>
              )}
            </div>
          )}

          {/* Preço atual */}
          <div className={`font-extrabold text-green-600 leading-none ${featured ? 'text-2xl' : 'text-2xl'}`}>
            {formatPrice(post.price)}
          </div>

          {/* Melhor preço verificado */}
          <p className="text-green-600 text-[10px] font-semibold mt-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Melhor preço verificado
          </p>
        </div>

        {/* Economia */}
        {economy && economy > 0 && (
          <p className="text-red-500 text-xs font-bold mb-3">
            🔥 Economia de {formatPrice(economy)}
          </p>
        )}

        {/* Botão VER OFERTA — vai direto para o afiliado */}
        <a
          href={post.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-auto block w-full text-center py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg"
        >
          VER OFERTA →
        </a>

        {/* Botão deletar — apenas para admin */}
        {isLoggedIn && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full text-center py-2 mt-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {isDeleting ? (
              <><span className="animate-spin">⏳</span><span>Deletando...</span></>
            ) : (
              <><span>🗑️</span><span>Deletar</span></>
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
