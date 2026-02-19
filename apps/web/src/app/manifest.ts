import type { MetadataRoute } from 'next';

/**
 * Next.js Web App Manifest
 *
 * Enables PWA functionality: Add to Home Screen, standalone mode, themed UI.
 * Icons must exist in /public/icons/ - create placeholder icons if missing.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HANDLED - Your Business, Handled',
    short_name: 'HANDLED',
    description: 'Professional websites, booking, and AI chatbots for service professionals',
    start_url: '/',
    display: 'standalone',
    // Note: hardcoded to HANDLED marketing dark. Tenant storefronts added to
    // homescreen will show this splash color. Low priority — few users install PWA.
    background_color: '#18181B', // graphite dark
    theme_color: '#45B37F', // Electric Sage
    orientation: 'portrait-primary',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
