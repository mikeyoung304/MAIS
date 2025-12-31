/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@macon/contracts', '@macon/shared'],

  // Custom domain resolution happens in middleware
  async rewrites() {
    return [];
  },

  // Redirect old domain to new domain
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'maconaisolutions.com',
          },
        ],
        destination: 'https://gethandled.ai/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.maconaisolutions.com',
          },
        ],
        destination: 'https://gethandled.ai/:path*',
        permanent: true,
      },
    ];
  },

  // Environment variables exposed to client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

module.exports = nextConfig;
