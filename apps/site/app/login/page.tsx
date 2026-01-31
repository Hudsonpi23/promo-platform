'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const loginUrl = `${apiUrl}/auth/login`;
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!response) {
        throw new Error('Não foi possível conectar ao servidor. Verifique se a API está rodando.');
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        if (!response.ok) {
          throw new Error(`Erro ${response.status}: ${response.statusText || 'Erro ao conectar com o servidor'}`);
        }
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        const errorMessage = data?.error?.message || data?.message || 'Email ou senha incorretos';
        throw new Error(errorMessage);
      }

      const token = data.data?.accessToken || data.accessToken;

      if (!token) {
        throw new Error('Token não recebido do servidor');
      }

      // Verificar se é admin
      if (data.data?.user?.role !== 'ADMIN') {
        throw new Error('Apenas administradores podem fazer login no site.');
      }

      // Salvar token
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(data.data?.user || {}));

      // Redirecionar para home
      router.push('/');
      router.refresh();
    } catch (err: any) {
      console.error('Erro no login:', err);
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card de Login */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-4">
              <div className="relative w-20 h-20 mx-auto rounded-full overflow-hidden border-4 border-blue-500 shadow-lg">
                <Image
                  src="/manu-avatar.png"
                  alt="Manu das Promoções"
                  fill
                  className="object-cover object-top"
                  priority
                />
              </div>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Manu das Promoções
            </h1>
            <p className="text-gray-600">
              Login Administrativo
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@example.com"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                required
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Digite sua senha"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900"
                required
              />
            </div>

            {/* Botão para preencher automaticamente */}
            <button
              type="button"
              onClick={() => setForm({ email: 'admin@example.com', password: 'password' })}
              className="w-full text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Usar credenciais padrão
            </button>

            {/* Erro */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                ❌ {error}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {isLoading ? '⏳ Entrando...' : '🚀 Entrar'}
            </button>
          </form>

          {/* Link para voltar */}
          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-gray-600 hover:text-blue-600">
              ← Voltar para o site
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-white text-sm opacity-75">
            © 2026 Manu das Promoções - Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
