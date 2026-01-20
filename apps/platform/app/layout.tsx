import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Promo Platform - Painel do Operador',
  description: 'Sistema de gerenciamento de promoções para afiliados',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-surface border-r border-border p-4 flex flex-col">
            <div className="mb-8">
              <h1 className="text-xl font-bold text-primary">PROMO</h1>
              <p className="text-xs text-text-muted">Platform v1.0</p>
            </div>
            
            <nav className="flex-1 space-y-2">
              <a href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-hover text-text-primary">
                <span className="text-lg">📊</span>
                <span>Dashboard</span>
              </a>
              <a href="/cargas" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover text-text-secondary">
                <span className="text-lg">📦</span>
                <span>Cargas</span>
              </a>
              <a href="/ofertas" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover text-text-secondary">
                <span className="text-lg">🏷️</span>
                <span>Ofertas</span>
              </a>
              <a href="/erros" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover text-text-secondary">
                <span className="text-lg">🧯</span>
                <span>Setor de Erros</span>
              </a>
              <a href="/config" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover text-text-secondary">
                <span className="text-lg">⚙️</span>
                <span>Configurações</span>
              </a>
            </nav>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="w-2 h-2 rounded-full bg-success"></span>
                <span>Sistema Online</span>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
