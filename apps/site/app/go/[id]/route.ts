import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// GET /go/[id] - Redirect com tracking
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // Chamar backend para registrar clique e obter URL final
    const res = await fetch(`${API_URL}/public/posts/${id}/click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('user-agent') || '',
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
      },
    });

    if (!res.ok) {
      // Se falhar, redirecionar para home
      return NextResponse.redirect(new URL('/', request.url));
    }

    const data = await res.json();
    
    if (data.url) {
      // Redirect 302 para o destino (URL de afiliado)
      return NextResponse.redirect(data.url, { status: 302 });
    }

    // Fallback: redirecionar para home
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Erro no redirect:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}
