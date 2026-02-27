'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/auth';

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
      
      console.log('Tentando fazer login em:', loginUrl);

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      // Verificar se conseguiu conectar
      if (!response) {
        throw new Error('Não foi possível conectar ao servidor. Verifique se a API está rodando na porta 3001.');
      }

      // Tentar parsear resposta mesmo se der erro
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
        if (response.status === 500) {
          throw new Error(`${errorMessage}. Verifique se o banco está conectado e execute "npm run db:seed" em packages/api.`);
        }
        throw new Error(errorMessage);
      }

      const token = data.data?.accessToken || data.accessToken;

      if (!token) {
        throw new Error('Token não recebido do servidor');
      }

      // Salvar token
      setToken(token);

      // Redirecionar para dashboard
      router.push('/');
    } catch (err: any) {
      console.error('Erro no login:', err);
      
      // Mensagens de erro mais específicas
      let errorMessage = err.message || 'Erro ao fazer login';
      
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        errorMessage = 'Não foi possível conectar ao servidor. Verifique se a API está rodando:\n\n1. Abra um terminal\n2. Execute: cd packages/api && npm run dev\n3. Aguarde a mensagem "API rodando em http://localhost:3001"';
      } else if (err.message?.includes('ECONNREFUSED') || err.message?.includes('connection')) {
        errorMessage = 'Servidor não está respondendo. Certifique-se de que a API está rodando na porta 3001.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card de Login */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <span className="text-3xl">🎯</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Promo Platform
            </h1>
            <p className="text-gray-600">
              Painel Administrativo
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
                type="text"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Digite seu email"
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
              onClick={() => setForm({ email: 'admin@local.dev', password: 'admin123' })}
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

          {/* Credenciais de Teste */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600 font-medium mb-2">
              📋 Credenciais padrão:
            </p>
            <p className="text-xs text-gray-500 font-mono">
              Email: admin@local.dev
            </p>
            <p className="text-xs text-gray-500 font-mono">
              Senha: admin123
            </p>
            <p className="text-xs text-amber-600 mt-2">
              Execute &quot;npm run db:seed&quot; em packages/api se não tiver usuários.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-white text-sm opacity-75">
            © 2026 Promo Platform - Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
