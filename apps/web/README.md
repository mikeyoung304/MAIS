# @macon/web-next

Next.js 14 frontend for MAIS (Macon AI Solutions) - SEO-optimized tenant websites with custom domain support.

## Quick Start

```bash
# From repo root
npm install

# Start development server (port 3000)
npm run --workspace=@macon/web-next dev

# Build for production
npm run --workspace=@macon/web-next build

# Start production server
npm run --workspace=@macon/web-next start
```

## Architecture

```
apps/web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (marketing)/        # MAIS platform pages
│   │   ├── (tenant)/           # Tenant storefront pages
│   │   │   └── t/[slug]/       # Dynamic tenant routes
│   │   ├── (admin)/            # Protected admin pages
│   │   ├── api/                # API routes (BFF)
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Homepage
│   │   └── providers.tsx       # Client providers
│   │
│   ├── components/
│   │   ├── ui/                 # Shared UI components
│   │   └── tenant-site/        # Tenant-specific components
│   │
│   ├── lib/
│   │   ├── api.ts              # SSR-aware ts-rest client
│   │   ├── query-client.ts     # React Query setup
│   │   └── utils.ts            # Utility functions
│   │
│   ├── styles/
│   │   ├── globals.css         # Global styles
│   │   └── design-tokens.css   # CSS custom properties
│   │
│   └── middleware.ts           # Custom domain resolution
│
├── public/                     # Static assets
├── next.config.js              # Next.js configuration
├── tailwind.config.js          # Tailwind configuration
└── package.json
```

## Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Express API URL (default: http://localhost:3001) |
| `NEXTAUTH_URL` | NextAuth.js base URL |
| `NEXTAUTH_SECRET` | NextAuth.js secret (generate with `openssl rand -hex 32`) |

## Key Features

### SSR-Aware API Client

The ts-rest client (`src/lib/api.ts`) works in both Server and Client Components:

```typescript
// Server Component
import { createServerApiClient } from '@/lib/api';

export default async function Page() {
  const api = await createServerApiClient();
  const packages = await api.getPackages();
  // ...
}

// Client Component ('use client')
import { createClientApiClient } from '@/lib/api';

function ClientComponent() {
  const api = createClientApiClient();
  // Use with React Query
}
```

### Tenant Landing Pages

Dynamic tenant pages at `/t/[slug]`:

- SSR with ISR (60-second revalidation)
- SEO metadata generation
- Custom domain support via middleware
- Mobile-responsive design

### Custom Domains

Tenants can use custom domains (requires Vercel Pro):

1. Tenant adds domain in admin dashboard
2. Tenant updates DNS records
3. Middleware routes custom domain to tenant page

See: `docs/operations/VERCEL_CUSTOM_DOMAINS.md`

## Development

### Running with Express API

```bash
# Terminal 1: Start Express API
npm run dev:api

# Terminal 2: Start Next.js
npm run --workspace=@macon/web-next dev
```

### TypeScript

```bash
# Type checking
npm run --workspace=@macon/web-next typecheck

# Full monorepo typecheck
npm run typecheck
```

### Building

```bash
# Build Next.js app
npm run --workspace=@macon/web-next build

# Build all packages (including @macon/contracts, @macon/shared)
npm run build
```

## Migration from Vite Client

This app is the Next.js replacement for the Vite client (`client/`). Key differences:

| Aspect | Vite Client | Next.js App |
|--------|-------------|-------------|
| Rendering | CSR only | SSR + CSR |
| Auth storage | localStorage | HTTP-only cookies |
| API client | Global singleton | Factory per request |
| Routing | React Router | App Router |
| SEO | Limited | Full SSR metadata |

## Dependencies

Uses shared packages from monorepo:

- `@macon/contracts` - API contracts and types
- `@macon/shared` - Shared utilities

These are linked via npm workspaces and must be built before running:

```bash
npm run build --workspace=@macon/contracts
npm run build --workspace=@macon/shared
```

## Related Documentation

- [Implementation Plan](../../plans/hosted-website-template-plan.md)
- [Brand Voice Guide](../../docs/design/BRAND_VOICE_GUIDE.md)
- [Vercel Custom Domains](../../docs/operations/VERCEL_CUSTOM_DOMAINS.md)
