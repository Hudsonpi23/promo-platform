import Link from 'next/link';
import Image from 'next/image';
import { getNiches } from '@/lib/api';

export async function Footer() {
  const niches = await getNiches().catch(() => []);

  return (
    <footer className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Descrição */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4 group">
              <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-white/30 shadow-lg group-hover:scale-110 transition-transform">
                <Image
                  src="/manu-avatar.png"
                  alt="Manu das Promoções"
                  fill
                  className="object-cover object-top"
                />
              </div>
              <div>
                <span className="text-xl font-extrabold text-white">Manu</span>
                <span className="text-xl font-extrabold text-blue-300"> das Promoções</span>
              </div>
            </Link>
            <p className="text-blue-200 text-sm leading-relaxed mb-6">
              A Manu encontra as melhores ofertas e promoções da internet para você economizar nas suas compras. 
              Todos os preços são verificados em tempo real.
            </p>
            
            {/* Redes Sociais */}
            <div className="flex gap-3">
              <a
                href="https://t.me/manupromocao"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-xl bg-white/10 hover:bg-blue-500 flex items-center justify-center transition-all"
                aria-label="Telegram"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
              </a>
              <a
                href="https://instagram.com/manupromocao"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-xl bg-white/10 hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-500 flex items-center justify-center transition-all"
                aria-label="Instagram"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href="https://twitter.com/manupromocao"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-xl bg-white/10 hover:bg-black flex items-center justify-center transition-all"
                aria-label="Twitter/X"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Categorias */}
          <div>
            <h4 className="text-white font-extrabold mb-4 text-lg">Categorias</h4>
            <ul className="space-y-2">
              {niches.slice(0, 6).map((niche) => (
                <li key={niche.id}>
                  <Link 
                    href={`/nicho/${niche.slug}`}
                    className="text-blue-200 hover:text-white transition-colors font-medium text-sm flex items-center gap-2"
                  >
                    {niche.icon && <span>{niche.icon}</span>}
                    {niche.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-extrabold mb-4 text-lg">Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-blue-200 hover:text-white transition-colors font-medium text-sm">
                  🏠 Início
                </Link>
              </li>
              <li>
                <a 
                  href="https://t.me/manupromocao" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-200 hover:text-white transition-colors font-medium text-sm"
                >
                  📲 Canal Telegram
                </a>
              </li>
              <li>
                <a 
                  href="https://instagram.com/manupromocao" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-200 hover:text-white transition-colors font-medium text-sm"
                >
                  📸 Instagram
                </a>
              </li>
              <li>
                <a 
                  href="https://twitter.com/manupromocao" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-200 hover:text-white transition-colors font-medium text-sm"
                >
                  🐦 Twitter/X
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-blue-700/50 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-blue-300 text-sm font-medium">
            © {new Date().getFullYear()} Manu das Promoções. Todos os direitos reservados.
          </p>
          <p className="text-blue-400 text-xs">
            Os preços podem variar. Sempre confirme no site da loja.
          </p>
        </div>
      </div>
    </footer>
  );
}
