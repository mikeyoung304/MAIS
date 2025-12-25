import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Providers } from './providers';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
});

export const metadata: Metadata = {
  title: {
    default: 'Macon AI Solutions - Business Growth Platform',
    template: '%s | Macon AI Solutions',
  },
  description:
    'Partner with entrepreneurs through AI consulting, seamless booking, professional websites, and marketing automation.',
  keywords: ['business growth', 'AI consulting', 'booking platform', 'small business'],
  authors: [{ name: 'Macon AI Solutions' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Macon AI Solutions',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-background font-body antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Providers>
          <main id="main-content">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
