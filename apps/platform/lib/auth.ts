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

  // Verificar se é FormData (upload de arquivo)
  const isFormData = options.body instanceof FormData;
  
  // Não definir Content-Type para FormData (deixar o browser definir automaticamente)
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
  };
  
  // Só adiciona Content-Type: application/json se não for FormData
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Merge com headers customizados (exceto se vazio para FormData)
  const customHeaders = options.headers as Record<string, string> || {};
  Object.keys(customHeaders).forEach(key => {
    if (customHeaders[key]) {
      headers[key] = customHeaders[key];
    }
  });

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  // Se retornar 401, limpar token e tentar novamente
  if (response.status === 401) {
    clearToken();
    const newToken = await ensureAuth();
    
    const retryHeaders = { ...headers, 'Authorization': `Bearer ${newToken}` };
    
    const retryResponse = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: retryHeaders,
    });
    
    return retryResponse;
  }

  return response;
}
