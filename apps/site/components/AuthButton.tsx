'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAdmin, logout, getUser } from '@/lib/auth';

export function AuthButton() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    // Verificar se está logado
    const checkAuth = () => {
      const admin = isAdmin();
      const userData = getUser();
      setIsLoggedIn(admin);
      setUser(userData);
    };

    checkAuth();

    // Escutar mudanças no localStorage
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Verificar periodicamente (para mudanças na mesma aba)
    const interval = setInterval(checkAuth, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    if (confirm('Deseja fazer logout?')) {
      logout();
      router.refresh();
    }
  };

  if (isLoggedIn) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-xs text-gray-600">
          {user?.email}
        </span>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all shadow-md hover:shadow-lg"
          title="Sair"
        >
          <span className="hidden sm:inline">Sair</span>
          <span className="sm:hidden">🚪</span>
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-all shadow-md hover:shadow-lg"
    >
      <span className="hidden sm:inline">Login</span>
      <span className="sm:hidden">🔐</span>
    </Link>
  );
}
