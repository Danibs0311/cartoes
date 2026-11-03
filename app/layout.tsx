import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cartões & Faturas - Gestão Compartilhada DGTECH',
  description: 'Gestão de múltiplos cartões, conciliação de faturas, identificação de compradores e cobrança rápida.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
