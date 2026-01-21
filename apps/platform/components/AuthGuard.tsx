'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getToken } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Se estiver na página de login, não verificar
    if (pathname === '/login') {
      setIsAuthenticated(true);
      setIsChecking(false);
      return;
    }

    // Verificar se tem token
    const token = getToken();

    if (!token) {
      // Não tem token, redirecionar para login
      router.push('/login');
      return;
    }

    // Tem token, está autenticado
    setIsAuthenticated(true);
    setIsChecking(false);
  }, [pathname, router]);

  // Se estiver verificando, mostrar loading
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
          <p className="text-text-secondary">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Se não estiver autenticado (e não estiver na página de login), não renderizar nada
  if (!isAuthenticated && pathname !== '/login') {
    return null;
  }

  // Está autenticado ou está na página de login, renderizar children
  return <>{children}</>;
}
