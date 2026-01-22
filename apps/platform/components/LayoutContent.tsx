'use client';

import { usePathname, useRouter } from 'next/navigation';
import { AuthGuard } from './AuthGuard';
import { clearToken } from '@/lib/auth';

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  // Se for página de login, renderizar sem sidebar
  if (isLoginPage) {
    return <AuthGuard>{children}</AuthGuard>;
  }

  // Página normal com sidebar
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-surface border-r border-border p-4 flex flex-col">
          <div className="mb-8">
            <h1 className="text-xl font-bold text-primary">PROMO</h1>
            <p className="text-xs text-text-muted">Platform v1.0</p>
          </div>
          
          <nav className="flex-1 space-y-1">
            {/* PRINCIPAL */}
            <p className="text-xs text-text-muted uppercase tracking-wider px-3 pt-2 pb-1">Principal</p>
            
            <a 
              href="/" 
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                pathname === '/' 
                  ? 'bg-primary/20 text-primary border border-primary/30' 
                  : 'hover:bg-surface-hover text-text-secondary'
              }`}
            >
              <span className="text-lg">🔵</span>
              <span>Ações Pendentes</span>
            </a>
            
            <a 
              href="/execucoes" 
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                pathname === '/execucoes' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'hover:bg-surface-hover text-text-secondary'
              }`}
            >
              <span className="text-lg">🟢</span>
              <span>Execuções do Dia</span>
            </a>
            
            <a 
              href="/erros" 
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                pathname === '/erros' 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'hover:bg-surface-hover text-text-secondary'
              }`}
            >
              <span className="text-lg">🔴</span>
              <span>Erros</span>
            </a>

            {/* OPERADOR MANUAL */}
            <p className="text-xs text-text-muted uppercase tracking-wider px-3 pt-4 pb-1">Operador Manual</p>
            
            <a 
              href="/manual/facebook" 
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                pathname === '/manual/facebook' 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                  : 'hover:bg-surface-hover text-text-secondary'
              }`}
            >
              <span className="text-lg">📘</span>
              <span>Facebook</span>
            </a>
            
            <a 
              href="/manual/instagram" 
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                pathname === '/manual/instagram' 
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' 
                  : 'hover:bg-surface-hover text-text-secondary'
              }`}
            >
              <span className="text-lg">📸</span>
              <span>Instagram</span>
            </a>
            
            <a 
              href="/manual/whatsapp" 
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                pathname === '/manual/whatsapp' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'hover:bg-surface-hover text-text-secondary'
              }`}
            >
              <span className="text-lg">💬</span>
              <span>WhatsApp</span>
            </a>

            {/* GESTÃO */}
            <p className="text-xs text-text-muted uppercase tracking-wider px-3 pt-4 pb-1">Gestão</p>
            
            <a 
              href="/ofertas" 
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                pathname === '/ofertas' 
                  ? 'bg-surface-hover text-text-primary' 
                  : 'hover:bg-surface-hover text-text-secondary'
              }`}
            >
              <span className="text-lg">🏷️</span>
              <span>Ofertas</span>
            </a>
            
            <a 
              href="/cargas" 
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                pathname === '/cargas' 
                  ? 'bg-surface-hover text-text-primary' 
                  : 'hover:bg-surface-hover text-text-secondary'
              }`}
            >
              <span className="text-lg">📦</span>
              <span>Cargas (Legado)</span>
            </a>
            
            <a 
              href="/config" 
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                pathname === '/config' 
                  ? 'bg-surface-hover text-text-primary' 
                  : 'hover:bg-surface-hover text-text-secondary'
              }`}
            >
              <span className="text-lg">⚙️</span>
              <span>Configurações</span>
            </a>
          </nav>

          <div className="pt-4 border-t border-border space-y-2">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-success"></span>
              <span>Sistema Online</span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-500 text-sm transition-all"
            >
              <span>🚪</span>
              <span>Sair</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
