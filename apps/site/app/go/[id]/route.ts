import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /go/[id] - Redirect com tracking
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  console.log('[GO] Redirecionando:', id);
  console.log('[GO] API_URL:', API_URL);

  try {
    // Chamar backend para registrar clique e obter URL final
    const apiUrl = `${API_URL}/public/posts/${id}/click`;
    console.log('[GO] Chamando:', apiUrl);
    
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('user-agent') || '',
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
      },
    });

    console.log('[GO] Status:', res.status);

    if (!res.ok) {
      console.error('[GO] Erro na API:', res.status, await res.text());
      // Se falhar, redirecionar para home
      return NextResponse.redirect(new URL('/', request.url));
    }

    const data = await res.json();
    console.log('[GO] Resposta:', data);
    
    if (data.url) {
      console.log('[GO] Redirecionando para:', data.url);
      // Redirect 302 para o destino (URL de afiliado)
      return NextResponse.redirect(data.url, { status: 302 });
    }

    console.error('[GO] Sem URL na resposta');
    // Fallback: redirecionar para home
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('[GO] Erro no redirect:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}
