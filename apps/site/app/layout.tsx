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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.manu-promocoes.com.br';

export const metadata: Metadata = {
  title: {
    default: 'Manu das Promoções - As Melhores Ofertas do Brasil',
    template: '%s | Manu das Promoções',
  },
  description: 'Manu das Promoções: as melhores ofertas e promoções do Brasil em eletrônicos, moda, casa, beleza e muito mais. Descontos verificados diariamente no Mercado Livre, Amazon, Shopee e Magalu!',
  keywords: [
    'ofertas', 'promoções', 'descontos', 'cupom desconto',
    'melhores ofertas', 'achadinhos', 'promoções do dia',
    'eletrônicos baratos', 'moda promoção', 'mercado livre promoção',
    'amazon ofertas', 'shopee desconto', 'manu das promoções',
  ],
  authors: [{ name: 'Manu das Promoções' }],
  creator: 'Manu das Promoções',
  publisher: 'Manu das Promoções',
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'Manu das Promoções',
    title: 'Manu das Promoções - As Melhores Ofertas do Brasil',
    description: 'Manu encontra as melhores promoções do Brasil pra você economizar de verdade!',
    images: [
      {
        url: `${SITE_URL}/manu-banner.png`,
        width: 1200,
        height: 630,
        alt: 'Manu das Promoções - Ofertas Imperdíveis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@manupromocao',
    creator: '@manupromocao',
    title: 'Manu das Promoções - As Melhores Ofertas',
    description: 'Ofertas incríveis com descontos de verdade! Acompanhe as promoções do dia.',
    images: [`${SITE_URL}/manu-banner.png`],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || '',
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
