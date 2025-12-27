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
    default: 'HANDLED - Stay Ahead Without the Overwhelm',
    template: '%s | HANDLED',
  },
  description:
    'Done-for-you tech plus done-with-you education for service professionals. We handle the tech so you can focus on what you do best.',
  keywords: ['service professionals', 'AI', 'booking platform', 'photographers', 'coaches', 'therapists'],
  authors: [{ name: 'HANDLED' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'HANDLED',
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
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
