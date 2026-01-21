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

// Verificar autenticação
export async function ensureAuth(): Promise<string> {
  const token = getToken();
  
  if (!token) {
    // Redirecionar para login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Não autenticado');
  }
  
  return token;
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
