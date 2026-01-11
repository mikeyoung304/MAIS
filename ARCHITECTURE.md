# Architecture

## Platform Status

**Current Version:** Next.js Migration Complete (December 2025)
**Maturity Level:** 9.9/10 (Production-Ready)
**Deployment Status:** Tenant storefronts deployed on Vercel

**Recent Milestones:**

- ✅ Next.js 14 Migration: Complete (6 phases, 14 code review fixes) - December 2025
- ✅ Tenant Storefronts: SSR-enabled at `/t/[slug]` with custom domain support
- ✅ NextAuth.js v5: Credentials Provider with backend token isolation
- ✅ ISR: 60-second revalidation with on-demand cache invalidation
- ✅ Sprint 10: Technical excellence (test stability, security hardening)
- 🚀 Next: Scale to production tenants

**Test Coverage:**

- 771 server tests passing (100%)
- 114 E2E tests (22 passing post-migration)
- Test infrastructure: Retry helpers with exponential backoff
- Next.js E2E: Playwright tests for tenant storefronts, booking flow

**Security Posture:**

- OWASP Top 10 compliance: 70%
- Input sanitization: 100% coverage (all routes except webhooks)
- Custom CSP with 8 strict directives
- Defense-in-depth: Zod validation → Sanitization → Prisma parameterization

**Performance:**

- Cache hit response time: ~5ms (97.5% faster than database queries)
- Database load reduction: 70% (with Redis caching enabled)
- 16 performance indexes across 6 models

## Overview

MAIS is a **modular monolith**: one API process with clear service boundaries, a thin HTTP layer, and vendor integrations behind adapters. The front‑end consumes a generated client from the contracts package. Internal events decouple modules without microservices.

## Config-Driven Architecture (2025 Platform Transformation)

Starting Sprint 2 (January 2025), MAIS is transitioning to a **config-driven, agent-powered platform** that enables both human admins and AI agents to manage tenant configurations through versioned, auditable changes.

### Core Principles

**Configuration as Source of Truth**

Every visual element, workflow, and business logic setting is controlled by central, versioned configuration:

- **Branding**: Colors, fonts, logos (existing, to be moved to ConfigVersion)
- **Package Display**: Visibility, ordering, featured status, custom descriptions
- **Display Rules**: Conditional visibility, tier grouping, seasonal promotions
- **Widget Layout**: Component ordering, feature toggles, customization

**Agent-Admin Collaboration**

Both human admins and AI agents can propose configuration changes:

- **Agent Proposals**: AI analyzes context and proposes config updates (e.g., seasonal pricing, promotional visibility)
- **Admin Review**: All agent proposals require human approval via dashboard UI with diff view
- **Audit Trail**: Every change logged with before/after snapshots, user/agent attribution, timestamps
- **Rollback**: One-click rollback to any previous configuration version

**Versioned Configuration System**

Configuration changes use preview/publish workflow:

```typescript
// Draft mode: Test changes without affecting production
GET /v1/config?versionId=draft_abc123

// Published mode: Live configuration served to widgets
GET /v1/config (returns latest published version)
```

**Widget Dynamic Hydration**

Embedded widgets fetch configuration at runtime:

- **Initial Load**: Widget fetches tenant config via authenticated API
- **Live Updates**: Parent window triggers refresh via PostMessage
- **Graceful Fallback**: Default theme/layout if config unavailable
- **Zero Code Changes**: Tenant config updates instantly reflect in all embedded widgets

### Migration Strategy

**Sprint 2: Foundation (Security & Type Safety)**

- Build ConfigChangeLog table and audit service (full before/after snapshots)
- Remove all `as any` casts, add Zod schemas for config types
- Build core test suite (unit + integration + E2E, 70% coverage target)

**Sprint 3: Versioning Infrastructure**

- Create ConfigVersion database schema (draft/published states)
- Build config versioning API endpoints (create, publish, rollback)
- Implement backward compatibility layer with feature flags
- Add widget config hydration via PostMessage

**Sprint 4: Agent Interface**

- Create AgentProposal table (pending/approved/rejected states)
- Build agent API endpoints with rate limiting and authentication
- Create admin proposal review UI with diff view and inline approval
- Implement display rules configuration (visibility, ordering, grouping)
- Build end-to-end agent workflow tests

**See Also:** `docs/archive/planning/2025-01-analysis/CONFIG_DRIVEN_PIVOT_MASTER_ANALYSIS.md` for complete technical specification.

## Components

### Frontend - Tenant Storefronts (apps/web)

**Next.js 14 App Router** with React Server Components:

- **Rendering:** ISR with 60-second revalidation
- **Auth:** NextAuth.js v5 with Credentials Provider
- **Custom Domains:** Middleware-based resolution
- **API:** ts-rest client calling Express backend

Key directories:

- `app/t/[slug]/` - Tenant landing pages
- `app/(protected)/` - Admin routes (auth-required)
- `lib/auth.ts` - NextAuth configuration
- `lib/tenant.ts` - Tenant data fetching with `cache()`
- `middleware.ts` - Custom domain resolution

### Locked Template System

The tenant storefronts use a **section-based locked template architecture** that provides flexibility within controlled boundaries. Tenants can customize content but cannot break the layout or inject arbitrary code.

**Architecture:**

- **7 Page Types:** home, about, services, faq, contact, gallery, testimonials
- **7 Section Types:** hero, text, gallery, testimonials, faq, contact, cta
- **Home page is always enabled** (enforced by schema: `enabled: z.literal(true)`)
- **Dynamic navigation** updates based on which pages are enabled

**Section Components:**

Each section is a self-contained component that receives typed props from the configuration:

```typescript
// SectionRenderer uses discriminated union for type-safe rendering
switch (section.type) {
  case 'hero':
    return <HeroSection {...section} tenant={tenant} basePath={basePath} />;
  case 'text':
    return <TextSection {...section} tenant={tenant} />;
  case 'gallery':
    return <GallerySection {...section} tenant={tenant} />;
  // ... exhaustive matching
}
```

**Key Files:**

- `components/tenant/sections/` - Section components (HeroSection, TextSection, etc.)
- `components/tenant/SectionRenderer.tsx` - Discriminated union renderer
- `packages/contracts/src/landing-page.ts` - Zod schemas for all section types

**Security:**

- All URLs validated with `SafeUrlSchema` (blocks `javascript:`, `data:` protocols)
- Instagram handles validated with regex pattern
- Max length constraints prevent DoS via oversized content

### AI Assistant Panel & Build Mode

**Agent-First Admin Interface** for tenant configuration management:

**Desktop (≥1024px):**

- Fixed aside panel (400px width) at right edge
- Always visible by default (collapsible)
- Persistent localStorage state

**Mobile (<768px):**

- Vaul bottom sheet drawer (85vh height)
- FAB (Floating Action Button) trigger at bottom-right
- Gesture-based: drag-to-dismiss, snap points
- Platform-specific keyboard handling:
  - **iOS**: `visualViewport` API for keyboard detection
  - **Android**: Natural viewport resize + padding

**WCAG AA Accessibility (Phase 4 Implementation):**

All 7 critical requirements implemented:

1. ✅ **Dialog semantics**: `role="dialog"` + `aria-modal="true"` (WCAG 4.1.2)
2. ✅ **Focus management**: `onOpenAutoFocus` / `onCloseAutoFocus` (WCAG 2.4.3)
3. ✅ **Background inert**: Main content marked `inert` when drawer open (WCAG 2.4.3)
4. ✅ **Screen reader announcements**: `aria-live="polite"` announcer (WCAG 4.1.3)
5. ✅ **Touch target compliance**: 24px drag handle (WCAG 2.5.8 Level AA)
6. ✅ **iOS keyboard fix**: `repositionInputs={false}` prevents scroll-trigger-focus bug
7. ✅ **Focus trap**: `modal={true}` keeps Tab within drawer (WCAG 2.1.2)

**Bundle Impact:**

- Vaul: ~6.3 KB gzipped
- Reuses existing `@radix-ui/react-dialog` dependency (no duplication)
- Named imports enable tree-shaking

**Key Files:**

- `apps/web/src/components/agent/AgentPanel.tsx` - Responsive panel/drawer
- `apps/web/src/components/agent/PanelAgentChat.tsx` - Chat UI with platform-specific keyboard handling
- `e2e/tests/build-mode-mobile.spec.ts` - 10 mobile accessibility tests

**Performance Optimizations (Phases 1-3):**

- Phase 1: 60% latency reduction via optimistic updates + connection pooling
- Phase 2: 85% test coverage for race conditions
- Phase 3: Advisory locks for TOCTOU prevention (6/7 executors)

**Reference:** See `docs/architecture/BUILD_MODE_VISION.md` and `docs/architecture/PHASE_4_5_BUNDLE_ANALYSIS.md`

### Dual Routing Pattern

Tenant storefronts support two access methods: slug-based routes and custom domain routes.

**Slug-Based Routes (`/t/[slug]/`):**

Standard routing using tenant slug in the URL path:

```
/t/jane-photography/           → Home page
/t/jane-photography/about      → About page
/t/jane-photography/services   → Services page
```

**Custom Domain Routes (`/t/_domain/`):**

Custom domains are rewritten by middleware to a special `_domain` route:

```
janephotography.com/           → /t/_domain?domain=janephotography.com
janephotography.com/about      → /t/_domain/about?domain=janephotography.com
```

**Middleware Resolution:**

```typescript
// middleware.ts - Custom domain detection
if (!isKnownDomain) {
  // Rewrite custom domain to _domain route
  url.pathname = `/t/_domain${tenantPath}`;
  url.searchParams.set('domain', hostname);
  return NextResponse.rewrite(url);
}
```

**Component Props:**

Page components receive routing context via props:

- `basePath`: Link prefix (`/t/slug` for slug routes, empty for custom domains)
- `domainParam`: Custom domain hostname (only present for custom domain requests)

```tsx
// Example page component
export default async function AboutPage({ searchParams }: Props) {
  const domainParam = searchParams.domain;
  const basePath = domainParam ? '' : `/t/${slug}`;

  return <SectionRenderer sections={sections} tenant={tenant} basePath={basePath} />;
}
```

**Known Domains:**

The middleware maintains a list of MAIS domains that bypass custom domain resolution:

- `maconaisolutions.com`, `www.maconaisolutions.com`, `app.maconaisolutions.com`
- `*.vercel.app` (preview deployments)
- `localhost` (development)

### Frontend - Legacy Admin (client/)

React 18 + Vite, feature‑based (catalog, booking, admin). Uses a generated ts‑rest client and TanStack Query. Being gradually migrated to Next.js.

### Backend (server/)

- **routes/** — HTTP routes using @ts-rest/express, bound to contracts
- **services/** — Business logic: catalog, booking, availability, identity, commission
- **adapters/** — Prisma repos, Stripe, Postmark, Google Calendar. Also `adapters/mock/` for in‑memory.
- **middleware/** — Auth, error handling, request logging, rate limiting, **tenant resolution**
- **lib/core/** — config (zod‑parsed env), logger, error mapping, event bus
- **lib/ports.ts** — Repository and provider interfaces
- **lib/entities.ts** — Domain entities (Package, AddOn, Booking, Blackout, Tenant)
- **lib/errors.ts** — Domain-specific errors
- **di.ts** — composition root: choose mock vs real adapters via env and wire services

### Contracts (packages/contracts)

Zod schemas + endpoint definitions (@ts-rest).

### Shared (packages/shared)

DTOs, money/date helpers, small types.

## Service map

- **Catalog** — packages & add‑ons. Uses: `CatalogRepository`. **All queries scoped by tenantId**.
- **Availability** — `isDateAvailable`: bookings + blackout + Google busy. Uses: `BookingRepository`, `BlackoutRepository`, `CalendarProvider`. **All queries scoped by tenantId**.
- **Booking** — create checkout, handle payment completion, unique‑per‑date guarantee. Uses: `PaymentProvider`, `BookingRepository`, `EmailProvider`, `CommissionService`; emits `BookingPaid`, `BookingFailed`. **Commission calculated server-side per tenant**.
- **Commission** — calculate platform commission based on tenant's commission rate (10-15%). Uses: `TenantRepository`. **Always rounds UP to protect platform revenue**.
- **Payments** — abstract payment operations (Stripe adapter in real mode, supports Stripe Connect).
- **Notifications** — email templates + sending (Postmark adapter in real mode).
- **Identity** — admin login (bcrypt) + JWT.

## Concurrency Control

### Double-Booking Prevention

The platform uses a **three-layer defense** against double-booking (mission-critical for wedding business):

**Layer 1: Database Unique Constraint**

```prisma
model Booking {
  tenantId String
  date     DateTime

  @@unique([tenantId, date])  // Enforces one booking per date PER TENANT
}
```

Primary defense: PostgreSQL ensures only one booking per date per tenant at database level.

**Layer 2: Advisory Locks**

```typescript
await prisma.$transaction(async (tx) => {
  // Acquire advisory lock (automatically released on commit/abort)
  const lockId = hashTenantDate(tenantId, date);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  // Check if date is already booked
  const existing = await tx.booking.findFirst({
    where: { tenantId, date: new Date(date) }
  });
  if (existing) throw new BookingConflictError(date);

  // Create booking within same transaction
  await tx.booking.create({ data: { tenantId, date, ... } });
});
```

Application-level defense: First request acquires lock, second request waits. See **ADR-013** for rationale (supersedes ADR-008).

**Layer 3: Graceful Error Handling**

```typescript
try {
  await bookingRepo.create(booking);
} catch (error) {
  if (error.code === 'P2002') {
    // Unique constraint violation
    throw new BookingConflictError(date);
  }
}
```

Fallback defense: If both layers fail, catch Prisma error and convert to domain error.

### Race Condition Handling

**Problem:** Two users can both pass availability check, then both attempt booking.

**Solution:** Wrap availability check + booking creation in database transaction with advisory lock.

**Files:**

- `server/src/services/availability.service.ts` - Transaction-aware availability check
- `server/src/services/booking.service.ts` - Transaction wrapper
- `server/src/adapters/prisma/booking.repository.ts` - Advisory lock implementation

**See Also:** ADR-013 (Advisory Locks)

## Webhook Processing

### Idempotency Strategy

**Problem:** Stripe retries webhooks on failure. Duplicate webhooks could create duplicate bookings.

**Solution:** Database-based webhook event tracking with idempotency checks.

```prisma
model WebhookEvent {
  id          String   @id @default(cuid())
  eventId     String   @unique  // Stripe event ID
  eventType   String
  payload     Json
  status      String   // "pending", "processed", "failed"
  attempts    Int      @default(0)
  lastError   String?
  processedAt DateTime?
  createdAt   DateTime @default(now())

  @@index([status, createdAt])
}
```

**Webhook Handler Flow:**

1. Verify Stripe webhook signature (prevent fraud)
2. Store webhook event in database (with `eventId` unique constraint)
3. Check if already processed (idempotency)
4. Process webhook (create booking)
5. Mark as processed or failed
6. Return 200 (success) or 500 (retry)

**Error Handling:**

- Return 500 on failure → triggers Stripe retry
- Store error message in `lastError` for debugging
- Failed webhooks remain in database for manual recovery

**Files:**

- `server/src/routes/webhooks.routes.ts` - Webhook handler with DLQ logic
- `server/prisma/schema.prisma` - WebhookEvent model
- `server/src/adapters/prisma/webhook.repository.ts` - Webhook persistence

**See Also:** DECISIONS.md ADR-002 (Webhook DLQ), DECISIONS.md ADR-004 (Test Coverage)

### Transaction Safety

**BookingService.onPaymentCompleted()** uses transactions to ensure atomicity:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Check availability WITH lock
  const isAvailable = await availabilityService.isDateAvailableWithLock(date, tx);
  if (!isAvailable) throw new BookingConflictError(date);

  // 2. Create booking (within same transaction)
  await bookingRepo.createWithTransaction(booking, tx);

  // 3. Emit event for email notification
  eventEmitter.emit('BookingPaid', { ... });
});
```

**Guarantees:**

- Availability check and booking creation are atomic
- If either fails, entire transaction rolls back
- No partial state (booking created but date unavailable)

**See Also:** ADR-013 (Advisory Locks)

## Multi-Tenant Data Isolation

The platform supports up to 50 independent wedding businesses with complete data isolation:

### Tenant Resolution Middleware

**File:** `server/src/middleware/tenant.ts`

All public API routes (`/v1/packages`, `/v1/bookings`, `/v1/availability`) require the `X-Tenant-Key` header:

```typescript
// Example request
GET /v1/packages
X-Tenant-Key: pk_live_bella-weddings_abc123xyz
```

**Middleware Flow:**

1. Extract `X-Tenant-Key` from request headers
2. Validate API key format: `pk_live_{slug}_{random}` or `sk_live_{slug}_{random}`
3. Look up tenant in database (indexed query on `apiKeyPublic`)
4. Verify tenant exists and `isActive === true`
5. Inject `tenantId` into request context (`req.tenantId`)
6. Continue to route handler

**Error Responses:**

- `401 TENANT_KEY_REQUIRED`: Missing X-Tenant-Key header
- `401 INVALID_TENANT_KEY`: Invalid format or tenant not found
- `403 TENANT_INACTIVE`: Tenant exists but account disabled

**Performance:** ~6ms overhead per request (acceptable for multi-tenant isolation)

### Row-Level Data Isolation

All database queries are automatically scoped by `tenantId`:

```typescript
// CORRECT - Tenant-scoped query
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});

// WRONG - Would return data from all tenants (security vulnerability)
const packages = await prisma.package.findMany({
  where: { active: true },
});
```

**Repository Pattern:**

- All repository methods require `tenantId` as first parameter
- Example: `catalogRepo.getPackageBySlug(tenantId, slug)`
- Impossible to query cross-tenant data without explicit tenantId

### API Key Format

**Public Keys** (safe to embed in client-side code):

- Format: `pk_live_{slug}_{random32chars}`
- Example: `pk_live_bella-weddings_7a9f3c2e1b4d8f6a`
- Used in X-Tenant-Key header for API authentication

**Secret Keys** (server-side only, encrypted in database):

- Format: `sk_live_{slug}_{random32chars}`
- Example: `sk_live_bella-weddings_9x2k4m8p3n7q1w5z`
- Used for admin operations and Stripe Connect configuration
- Stored encrypted with AES-256-GCM using `TENANT_SECRETS_ENCRYPTION_KEY`

### Cache Isolation Patterns

Application cache keys MUST include tenantId to prevent cross-tenant data leakage:

```typescript
// CORRECT - Tenant-scoped cache key
const cacheKey = `catalog:${tenantId}:packages`;

// WRONG - Would leak data between tenants
const cacheKey = 'catalog:packages';
```

**Critical Security Note:** HTTP-level cache middleware was removed in Phase 1 (commit `efda74b`) due to P0 security vulnerability. HTTP cache generated keys without tenantId, causing Tenant A's data to be served to Tenant B. Application-level cache (CacheService) provides performance benefits while maintaining tenant isolation.

### Commission Calculation

Each tenant has a configurable commission rate (10-15%):

```typescript
// CommissionService calculates platform revenue server-side
const commission = await commissionService.calculateCommission(tenantId, bookingTotal);

// Stripe Connect PaymentIntent includes commission as application fee
const paymentIntent = await stripe.paymentIntents.create(
  {
    amount: bookingTotal,
    application_fee_amount: commission.amount, // Platform commission
    currency: 'usd',
  },
  {
    stripeAccount: tenant.stripeAccountId, // Tenant's Connected Account
  }
);
```

**Rounding:** Commission always rounds UP to protect platform revenue (e.g., 12.5% of $100.01 = $13, not $12).

**See Also:** [MULTI_TENANT_IMPLEMENTATION_GUIDE.md](./docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md), [PHASE_1_COMPLETION_REPORT.md](./docs/phases/PHASE_1_COMPLETION_REPORT.md)

## Contracts (v1)

**Public Endpoints (Require X-Tenant-Key header):**

- `GET /v1/packages` — List packages for tenant
- `GET /v1/packages/:slug` — Get package details for tenant
- `GET /v1/availability?date=YYYY‑MM‑DD` — Check availability for tenant
- `POST /v1/bookings/checkout` → `{ checkoutUrl }` — Create checkout for tenant

**Webhook Endpoints (Require Stripe signature):**

- `POST /v1/webhooks/stripe` (raw body) — payment completed

**Admin Endpoints (Require JWT token):**

- `POST /v1/admin/login` → `{ token }` — Admin authentication
- `GET /v1/admin/bookings` — List all bookings
- `GET|POST /v1/admin/blackouts` — Manage blackout dates
- `GET|POST|PATCH|DELETE /v1/admin/packages` — Manage packages
- `POST|PATCH|DELETE /v1/admin/packages/:id/addons` — Manage add-ons
- `GET|POST|PATCH /v1/admin/tenants` — Manage tenants (platform admin)

## Events (in‑proc)

- `BookingPaid { bookingId, eventDate, email, lineItems }`
- `BookingFailed { reason, eventDate, sessionId }`

## Data model (Multi-Tenant)

- **Tenant**(id, name, slug\*, apiKeyPublic\*, apiKeySecret [encrypted], commissionPercent, stripeAccountId?, isActive, createdAt)
- **Package**(id, tenantId, slug, name, description, basePrice, active, photoUrl) — **Unique constraint: [tenantId, slug]**
- **AddOn**(id, tenantId, slug, name, description, price, active, photoUrl?)
- **BlackoutDate**(id, tenantId, date [UTC midnight]) — **Unique constraint: [tenantId, date]**
- **Booking**(id, tenantId, customerId, packageId, venueId?, date [UTC midnight], status, totalPrice, commissionAmount, commissionPercent, notes?) — **Unique constraint: [tenantId, date]**
- **Customer**(id, tenantId, email, name, phone?)
- **User**(id, email\*, passwordHash, role)
- **WebhookEvent**(id, tenantId, eventId\*, eventType, payload, status, attempts, lastError?, processedAt?)

### Landing Page Configuration (Tenant.landingPageConfig JSON)

**PagesConfig Schema:**

The `pages` field in `landingPageConfig` controls which pages are enabled and their section content:

```typescript
// PagesConfig - 7 page types with enabled toggles
{
  home: { enabled: true, sections: [...] },     // Always enabled (literal true)
  about: { enabled: boolean, sections: [...] },
  services: { enabled: boolean, sections: [...] },
  faq: { enabled: boolean, sections: [...] },
  contact: { enabled: boolean, sections: [...] },
  gallery: { enabled: boolean, sections: [...] },
  testimonials: { enabled: boolean, sections: [...] },
}
```

**Section Discriminated Union:**

Each section has a `type` field that determines its shape:

```typescript
// Section types (discriminated by 'type' field)
type Section =
  | {
      type: 'hero';
      headline: string;
      subheadline?: string;
      ctaText: string;
      backgroundImageUrl?: string;
    }
  | {
      type: 'text';
      headline?: string;
      content: string;
      imageUrl?: string;
      imagePosition: 'left' | 'right';
    }
  | {
      type: 'gallery';
      headline: string;
      images: { url: string; alt: string }[];
      instagramHandle?: string;
    }
  | {
      type: 'testimonials';
      headline: string;
      items: { quote: string; authorName: string; rating: number }[];
    }
  | { type: 'faq'; headline: string; items: { question: string; answer: string }[] }
  | {
      type: 'contact';
      headline: string;
      email?: string;
      phone?: string;
      address?: string;
      hours?: string;
    }
  | { type: 'cta'; headline: string; subheadline?: string; ctaText: string };
```

**Key Constraints:**

- Home page `enabled` must be `true` (enforced by Zod schema)
- Navigation dynamically renders links only for enabled pages
- Default configuration provided for new tenants (`DEFAULT_PAGES_CONFIG`)

## Backing services

- **Mock mode:** in‑memory repos, console "emails", fake checkout URL.
- **Real mode:**
  - **Database:** Supabase PostgreSQL with Prisma ORM (connection pooling, automatic backups)
  - **Payments:** Stripe Checkout + webhook signature verification
  - **Email:** Postmark (with file-sink fallback if token not configured)
  - **Calendar:** Google Calendar freeBusy API (with mock fallback if credentials not configured)

See `SUPABASE.md` for database setup details.
See `DECISIONS.md` for architectural decision records (ADRs) explaining key design choices.

## Production Deployment

### Deployment Status: Demo Users (January 2025)

**Target Environment:** Production deployment for initial demo users
**Infrastructure:** Supabase (PostgreSQL), Upstash (Redis), Render (API + cron jobs), Vercel (Next.js storefronts)
**Readiness:** Platform is production-ready (9.8/10 maturity)

### Production Requirements

**Environment Variables (Required):**

```bash
# Database
DATABASE_URL=postgresql://...      # Supabase connection string
DIRECT_URL=postgresql://...         # Direct connection for migrations

# Authentication
JWT_SECRET=<64-char-hex>            # Generate: openssl rand -hex 32
TENANT_SECRETS_ENCRYPTION_KEY=<64-char-hex>

# Stripe
STRIPE_SECRET_KEY=sk_live_...       # Live mode secret key
STRIPE_WEBHOOK_SECRET=whsec_...     # Webhook endpoint secret
STRIPE_SUCCESS_URL=https://app.maconaisolutions.com/success
STRIPE_CANCEL_URL=https://app.maconaisolutions.com

# Performance (Recommended)
REDIS_URL=rediss://...              # Upstash Redis URL (enables caching)
NODE_ENV=production
ADAPTERS_PRESET=real
```

**Environment Variables (Optional - Graceful Fallback):**

```bash
# Email (falls back to file-sink in tmp/emails/)
POSTMARK_SERVER_TOKEN=...
POSTMARK_FROM_EMAIL=bookings@maconaisolutions.com

# Calendar (falls back to mock calendar)
GOOGLE_CALENDAR_ID=...
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=...

# Monitoring (recommended for production)
SENTRY_DSN=...                      # Error tracking
```

### Pre-Deployment Checklist

**1. Infrastructure Setup**

- [ ] Supabase project created with connection pooling enabled
- [ ] Upstash Redis instance created (for caching)
- [ ] DNS records configured (app.maconaisolutions.com)
- [ ] SSL certificates provisioned (automatic with Render/Vercel)

**2. Database Migration**

```bash
cd server
npm exec prisma migrate deploy    # Apply all migrations
npm exec prisma db seed           # Seed initial data
```

**3. Environment Configuration**

- [ ] All required environment variables set in hosting platform
- [ ] JWT secrets generated (never reuse between environments)
- [ ] Stripe webhook endpoint registered (https://app.maconaisolutions.com/v1/webhooks/stripe)
- [ ] CORS origins configured for widget embeds

**4. Security Verification**

- [ ] CSP directives reviewed for production domains
- [ ] Rate limiting enabled (5 attempts/15min/IP for auth endpoints)
- [ ] Tenant secrets encryption key secured (use secret manager)
- [ ] API keys validated (pk*live* format enforced)

**5. Monitoring Setup**

- [ ] Sentry error tracking configured
- [ ] Health check endpoint monitored (/health)
- [ ] Cache metrics endpoint monitored (/health/cache)
- [ ] Database connection pool monitored

**6. Performance Validation**

- [ ] Redis caching enabled (verify REDIS_URL set)
- [ ] Database indexes applied (16 performance indexes)
- [ ] Load testing completed (target: 100 concurrent users)
- [ ] Response times validated (<500ms p99 without cache)

### Post-Deployment Validation

**Health Checks:**

```bash
# API health
curl https://app.maconaisolutions.com/health

# Cache health
curl https://app.maconaisolutions.com/health/cache

# Database connectivity
curl https://app.maconaisolutions.com/v1/packages \
  -H "X-Tenant-Key: pk_live_demo_..."
```

**Expected Responses:**

```json
// /health
{
  "status": "healthy",
  "timestamp": "2025-01-21T...",
  "uptime": 3600
}

// /health/cache
{
  "connected": true,
  "hits": 0,
  "misses": 0,
  "keys": 0,
  "totalRequests": 0,
  "hitRate": "0%",
  "efficiency": "optimal"
}
```

### Demo User Onboarding

**Initial Tenants:**

1. Create demo tenant via admin CLI: `npm run create-tenant`
2. Configure branding (colors, logo) via tenant admin dashboard
3. Add 3-5 packages with photos
4. Configure Stripe Connect for payment processing
5. Test booking flow end-to-end

**Widget Embed:**

```html
<!-- Client website integration -->
<iframe
  src="https://app.maconaisolutions.com/widget?tenant=demo-tenant"
  width="100%"
  height="800px"
  frameborder="0"
></iframe>
```

### Rollback Plan

**If issues detected post-deployment:**

1. **Immediate:** Revert to previous Git commit

   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Database:** Roll back migration if needed

   ```bash
   npm exec prisma migrate resolve --rolled-back <migration-name>
   ```

3. **Cache:** Flush Redis cache to clear corrupted data

   ```bash
   redis-cli FLUSHALL  # Only if cache corruption suspected
   ```

4. **Monitoring:** Check Sentry for error patterns before full rollback

### Known Limitations (Demo Phase)

- **Concurrent Bookings:** 2 intermittent test failures under extreme load (retry logic reduces frequency)
- **Email Delivery:** Postmark required for production emails (graceful fallback to file-sink)
- **Calendar Sync:** Google Calendar integration optional (falls back to mock)
- **APM:** Sentry Performance not yet enabled (planned for next sprint)

### Support Contacts

- **Platform Issues:** mike@maconaisolutions.com
- **Security Issues:** security@maconaisolutions.com (see `/SECURITY.md`)
- **Emergency Rollback:** Follow rollback plan above, notify team immediately

**Next Phase:** After successful demo user deployment, expand to 10+ production tenants with full feature set.

## Migration History

**Locked Template System (December 2025)**: Implemented section-based tenant storefronts:

- Added 7 page types (home, about, services, faq, contact, gallery, testimonials) with enabled toggles
- Implemented 7 section types (hero, text, gallery, testimonials, faq, contact, cta) as discriminated union
- Created SectionRenderer component for type-safe section rendering
- Added dual routing pattern: slug-based (`/t/[slug]/`) and custom domain (`/t/_domain/`)
- Middleware rewrites custom domains to `_domain` route with domain query parameter
- Zod schemas with SafeUrlSchema for XSS prevention on all URL fields
- Home page enforced as always-enabled via `z.literal(true)` constraint
- Dynamic navigation based on enabled pages
- Default configuration (`DEFAULT_PAGES_CONFIG`) for new tenant onboarding

**Phase 2B (2024-10-29)**: Integrated Supabase as production database:

- Added `directUrl` to Prisma schema for migration support
- Deployed schema with critical constraints (`Booking.date @unique`, `Payment.processorId @unique`)
- Configured connection pooling via Supabase
- Seeded production database with admin user and sample packages

**Phase 2A (2024-10-23)**: Restored core functionality post-migration:

- Fixed TypeScript errors from Phase 1 restructuring
- Restored Stripe payment integration
- Added `User.passwordHash` field for admin authentication

**Phase 1 (2024-10-23)**: Migrated from hexagonal to layered architecture:

- apps/api → server
- apps/web → client
- domains/ → services/
- http/v1/_.http.ts → routes/_.routes.ts
- Consolidated ports/entities/errors into lib/
- pnpm → npm workspaces
- Express 5 → 4, React 19 → 18
