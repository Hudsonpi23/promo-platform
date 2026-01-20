import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { TopNav } from '@/components/TopNav';
import { Footer } from '@/components/Footer';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Manu das Promoções - As Melhores Ofertas do Dia',
    template: '%s | Manu das Promoções',
  },
  description: 'A Manu encontra as melhores ofertas e promoções em eletrônicos, moda, casa, beleza e muito mais. Descontos de verdade verificados diariamente!',
  keywords: ['ofertas', 'promoções', 'descontos', 'cupom', 'eletrônicos', 'moda', 'casa', 'beleza', 'manu das promoções'],
  authors: [{ name: 'Manu das Promoções' }],
  creator: 'Manu das Promoções',
  publisher: 'Manu das Promoções',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3003',
    siteName: 'Manu das Promoções',
    title: 'Manu das Promoções - As Melhores Ofertas do Dia',
    description: 'A Manu encontra as melhores ofertas e promoções pra você economizar!',
    images: [
      {
        url: '/manu-banner.png',
        width: 1200,
        height: 630,
        alt: 'Manu das Promoções - Ofertas Imperdíveis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manu das Promoções - As Melhores Ofertas',
    description: 'Ofertas incríveis com descontos de verdade!',
    images: ['/manu-banner.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ef4444',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <head>
        <link rel="icon" href="/manu-avatar.png" sizes="any" />
        <link rel="apple-touch-icon" href="/manu-avatar.png" />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <TopNav />
        <main className="min-h-[calc(100vh-200px)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
