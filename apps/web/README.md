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
│   ├── app/                        # Next.js App Router
│   │   ├── (marketing)/            # MAIS platform pages
│   │   ├── t/                      # Tenant storefront pages
│   │   │   ├── [slug]/             # Slug-based routes (/t/jane-photography)
│   │   │   │   ├── (site)/         # Site pages with shared layout
│   │   │   │   │   ├── page.tsx        # Homepage
│   │   │   │   │   ├── layout.tsx      # Shared nav/footer
│   │   │   │   │   ├── error.tsx       # Error boundary
│   │   │   │   │   ├── loading.tsx     # Loading state
│   │   │   │   │   ├── about/          # About page
│   │   │   │   │   ├── services/       # Services page
│   │   │   │   │   ├── gallery/        # Gallery page
│   │   │   │   │   ├── testimonials/   # Testimonials page
│   │   │   │   │   ├── faq/            # FAQ page
│   │   │   │   │   └── contact/        # Contact page
│   │   │   │   └── book/           # Booking flow (no shared layout)
│   │   │   │       ├── [packageSlug]/
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   ├── error.tsx
│   │   │   │       │   └── loading.tsx
│   │   │   │       └── success/
│   │   │   └── _domain/            # Custom domain routes
│   │   │       ├── page.tsx        # Homepage
│   │   │       ├── layout.tsx      # Shared nav/footer
│   │   │       ├── error.tsx       # Error boundary
│   │   │       ├── loading.tsx     # Loading state
│   │   │       ├── about/          # About page
│   │   │       ├── services/       # Services page
│   │   │       ├── gallery/        # Gallery page
│   │   │       ├── testimonials/   # Testimonials page
│   │   │       ├── faq/            # FAQ page
│   │   │       ├── contact/        # Contact page (with error/loading)
│   │   │       └── book/           # Booking flow
│   │   ├── (admin)/                # Protected admin pages
│   │   ├── api/                    # API routes (BFF)
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Homepage
│   │   └── providers.tsx           # Client providers
│   │
│   ├── components/
│   │   ├── ui/                     # Shared UI components (Button, Card, etc.)
│   │   ├── auth/                   # Auth components (ProtectedRoute)
│   │   ├── layouts/                # Layout components (AdminSidebar)
│   │   ├── booking/                # Booking components (DateBookingWizard)
│   │   └── tenant/                 # Tenant storefront components
│   │       ├── TenantNav.tsx           # Navigation bar
│   │       ├── TenantFooter.tsx        # Footer
│   │       ├── TenantLandingPage.tsx   # Main landing page
│   │       ├── SectionRenderer.tsx     # Dynamic section rendering
│   │       ├── ContactForm.tsx         # Contact form
│   │       ├── FAQAccordion.tsx        # FAQ accordion
│   │       ├── pages/                  # Page content components
│   │       │   ├── AboutPageContent.tsx
│   │       │   ├── ContactPageContent.tsx
│   │       │   ├── FAQPageContent.tsx
│   │       │   └── ServicesPageContent.tsx
│   │       └── sections/               # Section components
│   │           ├── HeroSection.tsx
│   │           ├── TextSection.tsx
│   │           ├── GallerySection.tsx
│   │           ├── TestimonialsSection.tsx
│   │           ├── FAQSection.tsx
│   │           ├── ContactSection.tsx
│   │           └── CTASection.tsx
│   │
│   ├── lib/
│   │   ├── api.ts              # SSR-aware ts-rest client
│   │   ├── auth.ts             # NextAuth.js v5 configuration
│   │   ├── auth-client.ts      # Client-side auth utilities
│   │   ├── tenant.ts           # Tenant data fetching (SSR-safe)
│   │   ├── packages.ts         # Package utilities
│   │   ├── logger.ts           # Structured logging utility
│   │   ├── errors.ts           # Error handling utilities
│   │   ├── format.ts           # Formatting utilities
│   │   ├── query-client.ts     # React Query setup
│   │   └── utils.ts            # General utility functions
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

| Variable              | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Express API URL (default: http://localhost:3001)          |
| `NEXTAUTH_URL`        | NextAuth.js base URL                                      |
| `NEXTAUTH_SECRET`     | NextAuth.js secret (generate with `openssl rand -hex 32`) |

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

Dynamic tenant pages with SSR and ISR (60-second revalidation):

**Slug-based routes** (`/t/[slug]`):

| Route                          | Description                  |
| ------------------------------ | ---------------------------- |
| `/t/[slug]`                    | Homepage with hero, packages |
| `/t/[slug]/about`              | About page                   |
| `/t/[slug]/services`           | Services/packages page       |
| `/t/[slug]/gallery`            | Photo gallery                |
| `/t/[slug]/testimonials`       | Client testimonials          |
| `/t/[slug]/faq`                | Frequently asked questions   |
| `/t/[slug]/contact`            | Contact form                 |
| `/t/[slug]/book/[packageSlug]` | Booking wizard               |
| `/t/[slug]/book/success`       | Booking confirmation         |

**Custom domain routes** (`/t/_domain`):

| Route                 | Description                       |
| --------------------- | --------------------------------- |
| `/`                   | Homepage (via middleware rewrite) |
| `/about`              | About page                        |
| `/services`           | Services/packages page            |
| `/gallery`            | Photo gallery                     |
| `/testimonials`       | Client testimonials               |
| `/faq`                | Frequently asked questions        |
| `/contact`            | Contact form                      |
| `/book/[packageSlug]` | Booking wizard                    |
| `/book/success`       | Booking confirmation              |

Features:

- SEO metadata generation per page
- Error boundaries on all dynamic routes
- Loading states with skeleton UI
- Mobile-responsive design

### Custom Domains

Tenants can use custom domains (requires Vercel Pro):

1. Tenant adds domain in admin dashboard
2. Tenant updates DNS records
3. Middleware routes custom domain to tenant page

See: `docs/operations/VERCEL_CUSTOM_DOMAINS.md`

### Section-Based Page Rendering

Tenant pages use a section-based architecture for flexible content composition.

**SectionRenderer Component:**

The `SectionRenderer` component dynamically renders an array of sections based on their type:

```tsx
import { SectionRenderer } from '@/components/tenant/SectionRenderer';

// In a page component
<SectionRenderer sections={config.pages.home.sections} tenant={tenant} basePath="/t/my-studio" />;
```

**Available Section Types:**

| Type           | Component             | Description                                       |
| -------------- | --------------------- | ------------------------------------------------- |
| `hero`         | `HeroSection`         | Hero banner with headline, CTA, background image  |
| `text`         | `TextSection`         | Rich text content with optional image             |
| `gallery`      | `GallerySection`      | Photo grid with lightbox, optional Instagram link |
| `testimonials` | `TestimonialsSection` | Client testimonials with star ratings             |
| `faq`          | `FAQSection`          | Accordion-style FAQ items                         |
| `contact`      | `ContactSection`      | Contact form with validation                      |
| `cta`          | `CTASection`          | Call-to-action banner                             |

**normalizeToPages() Helper:**

Converts legacy landing page config to the new pages-based format:

```tsx
import { normalizeToPages } from '@/lib/tenant';

// In a Server Component
const config = tenant.branding?.landingPage as LandingPageConfig | undefined;
const pages = normalizeToPages(config);

// Access page-specific sections
const heroSection = pages.home.sections[0];
const galleryData = pages.gallery.sections[0];
```

**Tenant Library (`lib/tenant.ts`) Exports:**

| Export                                 | Description                                    |
| -------------------------------------- | ---------------------------------------------- |
| `getTenantBySlug(slug)`                | Fetch tenant by slug (cached, ISR 60s)         |
| `getTenantByDomain(domain)`            | Fetch tenant by custom domain                  |
| `getTenantStorefrontData(slug)`        | Fetch tenant + packages + segments in parallel |
| `isPageEnabled(config, pageName)`      | Check if a page is enabled in config           |
| `normalizeToPages(config)`             | Convert legacy config to pages format          |
| `validateDomain(domain)`               | Validate and sanitize domain parameter         |
| `getTenantPackages(apiKey)`            | Fetch tenant packages                          |
| `getTenantSegments(apiKey)`            | Fetch tenant segments                          |
| `getTenantPackageBySlug(apiKey, slug)` | Fetch single package by slug                   |

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

| Aspect       | Vite Client      | Next.js App         |
| ------------ | ---------------- | ------------------- |
| Rendering    | CSR only         | SSR + CSR           |
| Auth storage | localStorage     | HTTP-only cookies   |
| API client   | Global singleton | Factory per request |
| Routing      | React Router     | App Router          |
| SEO          | Limited          | Full SSR metadata   |

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
