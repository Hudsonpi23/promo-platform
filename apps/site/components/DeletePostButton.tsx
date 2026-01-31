'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeletePostButtonProps {
  postId: string;
  postTitle: string;
}

export default function DeletePostButton({ postId, postTitle }: DeletePostButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    // Confirmar antes de deletar
    const confirmDelete = confirm(
      `🗑️ Tem certeza que deseja DELETAR este post?\n\n"${postTitle}"\n\n⚠️ Esta ação não pode ser desfeita!`
    );

    if (!confirmDelete) return;

    setIsDeleting(true);

    try {
      // Pegar token do localStorage (se existir)
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('🔒 Você precisa estar logado como admin para deletar posts.');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Erro ao deletar post');
      }

      alert('✅ Post deletado com sucesso!');
      
      // Apenas recarregar a página atual (sem push)
      window.location.reload();
    } catch (error: any) {
      console.error('Erro ao deletar post:', error);
      alert(`❌ Erro ao deletar post:\n${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Só mostrar o botão se houver token (usuário logado)
  const isLoggedIn = typeof window !== 'undefined' && localStorage.getItem('token');

  if (!isLoggedIn) {
    return null; // Não mostrar botão se não estiver logado
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg shadow-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed z-50 flex items-center gap-2"
    >
      {isDeleting ? (
        <>
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Deletando...
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          🗑️ Deletar Post
        </>
      )}
    </button>
  );
}
