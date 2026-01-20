import { PublicPost } from '@/lib/api';
import { OfferCard, OfferCardSkeleton } from './OfferCard';

interface OfferGridProps {
  posts: PublicPost[];
  emptyMessage?: string;
  loading?: boolean;
}

export function OfferGrid({ posts, emptyMessage = 'Nenhuma oferta encontrada', loading = false }: OfferGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <OfferCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-blue-100 py-16 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-bold text-blue-800 mb-2">{emptyMessage}</h3>
        <p className="text-gray-500">Tente ajustar os filtros ou volte mais tarde.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {posts.map((post, index) => (
        <div
          key={post.id}
          className="animate-fade-in"
          style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
        >
          <OfferCard post={post} featured={index === 0} />
        </div>
      ))}
    </div>
  );
}
