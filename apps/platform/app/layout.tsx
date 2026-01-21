import type { Metadata } from 'next';
import './globals.css';
import { LayoutContent } from '@/components/LayoutContent';

export const metadata: Metadata = {
  title: 'Promo Platform - Painel do Operador',
  description: 'Sistema de gerenciamento de promoções para afiliados',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background">
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  );
}
