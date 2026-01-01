import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Providers } from './providers';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
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
  keywords: [
    'service professionals',
    'AI',
    'booking platform',
    'photographers',
    'coaches',
    'therapists',
  ],
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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HANDLED',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#8B9E86',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        {/* PWA meta tags for iOS */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-screen bg-background font-body antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Providers>
          <main id="main-content">{children}</main>
        </Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
