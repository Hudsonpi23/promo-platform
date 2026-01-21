const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Gerenciamento de token
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
}

// Login automático
export async function ensureAuth(): Promise<string> {
  // Verificar se já tem token válido
  const existingToken = getToken();
  if (existingToken) {
    return existingToken;
  }

  // Fazer login automático com credenciais do admin
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'password',
      }),
    });

    if (!response.ok) {
      throw new Error('Falha no login automático');
    }

    const data = await response.json();
    const token = data.data?.accessToken;
    
    if (!token) {
      console.error('Resposta do login:', data);
      throw new Error('Token não encontrado na resposta');
    }

    setToken(token);
    return token;
  } catch (error) {
    console.error('Erro ao fazer login automático:', error);
    throw error;
  }
}

// Fazer requisição autenticada
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await ensureAuth();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  // Se retornar 401, limpar token e tentar novamente
  if (response.status === 401) {
    clearToken();
    const newToken = await ensureAuth();
    
    const retryResponse = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        ...headers,
        'Authorization': `Bearer ${newToken}`,
      },
    });
    
    return retryResponse;
  }

  return response;
}
