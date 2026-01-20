import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-8xl mb-6">🔍</div>
      <h1 className="text-4xl font-extrabold text-gray-800 mb-4">
        Página não encontrada
      </h1>
      <p className="text-lg text-gray-500 mb-8 max-w-md">
        Ops! A página que você está procurando não existe ou foi removida.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/"
          className="px-6 py-3 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold hover:shadow-lg hover:scale-105 transition-all"
        >
          Ver Ofertas
        </Link>
        <Link
          href="/"
          className="px-6 py-3 rounded-full border-2 border-gray-300 text-gray-600 font-bold hover:border-red-500 hover:text-red-500 transition-all"
        >
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
}
