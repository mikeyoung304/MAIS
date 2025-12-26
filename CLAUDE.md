# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MAIS (Macon AI Solutions) is a business growth club platform that partners with entrepreneurs and small business owners through revenue-sharing partnerships. Built as a multi-tenant modular monolith with Express + React, featuring complete data isolation, config-driven architecture, and mock-first development. The platform provides AI consulting, seamless booking/scheduling, professional websites, and marketing automation.

**Tech Stack:**

- Backend: Express 4, TypeScript 5.9.3 (strict), Prisma 6, PostgreSQL
- Frontend (Admin): React 18, Vite 6, TailwindCSS, Radix UI, TanStack Query
- Frontend (Storefronts): Next.js 14 App Router, NextAuth.js v5, ISR
- API: ts-rest + Zod for type-safe contracts
- Testing: Vitest (unit/integration), Playwright (E2E)

**Current Status:**

- Next.js migration: COMPLETE (6 phases, 14 code review fixes applied)
- Tenant storefronts: SSR-enabled at `/t/[slug]` with custom domain support
- 771 server tests + 114 E2E tests (22 passing after migration fixes)
- Tenant self-signup: Backend + Frontend complete (`/signup` → `/tenant/dashboard`)
- Password reset flow: Complete with Postmark email integration
- Stripe Connect onboarding: Backend routes + StripeConnectCard.tsx
- Multi-tenant architecture: 100% complete
- Current branch: `main` (production-ready)

## Monorepo Structure

This is an npm workspace monorepo. Key points:

- **Root commands** run across all workspaces: `npm run typecheck`
- **Workspace-specific:** `npm run --workspace=server test`
- **Shared packages:** `@macon/contracts` and `@macon/shared` are internal
- **Import pattern:** `import { contract } from '@macon/contracts'`
- **Building:** Run `npm run build` at root to build all packages

## Essential Commands

### Development

```bash
npm run dev:api                    # Start API server (mock mode default)
npm run dev:client                 # Start React client (Vite, legacy admin)
npm run dev:web                    # Start Next.js storefronts (port 3000)
npm run dev:all                    # API + client + Stripe webhooks

# Environment modes
ADAPTERS_PRESET=mock npm run dev:api   # In-memory, no external services
ADAPTERS_PRESET=real npm run dev:api   # PostgreSQL, Stripe, Postmark, GCal

# Next.js specific
cd apps/web && npm run dev         # Next.js dev server (port 3000)
cd apps/web && npm run build       # Production build
cd apps/web && npm run start       # Production server
```

### Testing

```bash
npm test                           # Run all server tests
npm run test:unit                  # Unit tests only
npm run test:integration           # Integration tests (requires DB)
npm run test:watch                 # Watch mode
npm run test:coverage              # With coverage report
npm run test:e2e                   # Playwright E2E (requires API + client running)
npm run test:e2e:ui                # Interactive E2E mode
npm run test:e2e:headed            # E2E with visible browser
```

### Database (Prisma)

```bash
cd server
npm exec prisma studio             # Visual DB browser
npm exec prisma generate           # Regenerate Prisma Client after schema changes
npm exec prisma migrate dev --name migration_name  # Create new migration
npm exec prisma migrate deploy     # Apply migrations (production)
npm exec prisma db seed            # Seed database with test data
npm run create-tenant              # Create new club member with API keys
```

### Code Quality

```bash
npm run typecheck                  # TypeScript validation (all workspaces)
npm run lint                       # ESLint
npm run format                     # Prettier auto-fix
npm run format:check               # Prettier check only
npm run doctor                     # Environment health check
```

### Single Test Execution

```bash
# Run specific test file
npm test -- test/services/booking.service.test.ts

# Run tests matching pattern
npm test -- --grep "double-booking"

# Run single E2E test
npm run test:e2e -- e2e/tests/booking-mock.spec.ts
```

## File Naming Conventions

### Backend (server/)

- **Routes:** `*.routes.ts` (e.g., `packages.routes.ts`)
- **Services:** `*.service.ts` (e.g., `booking.service.ts`)
- **Adapters:** `*.adapter.ts` or `*.repository.ts`
- **Tests:** `*.test.ts` or `*.spec.ts`
- **Contracts:** Match route names in `packages/contracts/`

### Frontend - Legacy (client/)

- **Components:** PascalCase (e.g., `BookingForm.tsx`)
- **Utilities:** camelCase (e.g., `formatMoney.ts`)

### Frontend - Next.js (apps/web/)

- **Pages:** `page.tsx` (Next.js App Router convention)
- **Layouts:** `layout.tsx` (shared layouts per route segment)
- **Error Boundaries:** `error.tsx` (required for all dynamic routes)
- **Loading States:** `loading.tsx` (Suspense boundary)
- **Not Found:** `not-found.tsx` (404 page)
- **Route Handlers:** `route.ts` (API routes in `app/api/`)
- **Server Components:** Default, no directive needed
- **Client Components:** `'use client'` directive at top
- **Section Components:** PascalCase with Section suffix (e.g., `HeroSection.tsx`)

## Architecture Patterns

### Multi-Tenant Data Isolation

**CRITICAL:** All database queries MUST be scoped by `tenantId` to prevent data leakage.

```typescript
// ✅ CORRECT - Tenant-scoped
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});

// ❌ WRONG - Returns data from all tenants (security vulnerability)
const packages = await prisma.package.findMany({
  where: { active: true },
});
```

**Tenant Resolution Flow:**

1. Client sends `X-Tenant-Key` header (format: `pk_live_{slug}_{random}`)
2. Tenant middleware validates key and resolves tenant
3. Middleware injects `tenantId` into `req.tenantId`
4. All subsequent queries use `req.tenantId` for filtering

**Key Files:**

- `server/src/middleware/tenant.ts` - Tenant resolution middleware
- `server/src/lib/ports.ts` - Repository interfaces (all require tenantId)

### Layered Architecture

```
routes/          → HTTP handlers (thin, validation only)
  ↓
services/        → Business logic (catalog, booking, availability)
  ↓
adapters/        → External integrations (prisma, stripe, postmark)
  ↓
ports.ts         → Repository/provider interfaces
```

**Dependency Injection:** All wiring happens in `server/src/di.ts` based on `ADAPTERS_PRESET` (mock vs real).

**Mock-First Development:** Build features with in-memory adapters (`adapters/mock/`), then swap to real providers. All services depend on interfaces, not implementations.

### Type-Safe API Contracts

All API endpoints defined in `packages/contracts/` using Zod + ts-rest:

```typescript
// Define contract
export const getPackages = {
  method: 'GET',
  path: '/packages',
  responses: {
    200: z.array(PackageSchema),
  },
};

// Backend implements contract
const packagesRouter = tsRestExpress(contract.getPackages, async (req) => {
  const packages = await catalogService.getActivePackages(req.tenantId);
  return { status: 200, body: packages };
});

// Frontend gets type-safe client
const packages = await apiClient.getPackages();
```

**Rule:** Never define response types in routes or client. Always import from contracts.

### Double-Booking Prevention

Three-layer defense (see ADR-013 for current implementation):

1. **Database constraint:** `@@unique([tenantId, date])` on Booking model
2. **Advisory locks:** `pg_advisory_xact_lock()` for transaction serialization
3. **Graceful errors:** Catch unique violation, return clear error

```typescript
// Wrap availability check + booking creation in transaction with advisory lock
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

**Key Files:**

- `server/src/services/booking.service.ts` - Transaction wrapper
- `server/src/services/availability.service.ts` - Lock-aware availability

### Webhook Idempotency

Stripe webhooks use database-based deduplication (see DECISIONS.md ADR-002):

```typescript
// Store webhook event with unique eventId
await prisma.webhookEvent.create({
  data: {
    eventId: event.id, // Unique constraint prevents duplicates
    eventType: event.type,
    payload: event,
    status: 'pending',
  },
});

// Process only if not already processed
if (event.status === 'processed') {
  return; // Idempotent - safe to retry
}
```

**Key Files:**

- `server/src/routes/webhooks.routes.ts` - Webhook handler
- `server/prisma/schema.prisma` - WebhookEvent model

### Cache Isolation

Application cache keys MUST include `tenantId`:

```typescript
// ✅ CORRECT - Tenant-scoped cache key
const key = `catalog:${tenantId}:packages`;

// ❌ WRONG - Leaks data between tenants
const key = 'catalog:packages';
```

**Note:** HTTP-level cache middleware was removed (security vulnerability). Only use `CacheService` for application-level caching.

### Page-Based Landing Page Configuration

Tenant landing pages use a config-driven page and section system for flexible content management.

**7 Page Types:**

- `home` - Main landing page
- `about` - About the business
- `services` - Service offerings
- `faq` - Frequently asked questions
- `contact` - Contact information
- `gallery` - Portfolio/gallery
- `testimonials` - Customer testimonials

**7 Section Types:**

- `hero` - Hero banner with CTA
- `text` - Rich text content block
- `gallery` - Image gallery grid
- `testimonials` - Customer testimonial carousel
- `faq` - Accordion FAQ list
- `contact` - Contact form/info
- `cta` - Call-to-action banner

**Key Files:**

- `packages/contracts/src/schemas/landing-page.schema.ts` - Page and section Zod schemas
- `apps/web/src/lib/tenant.ts` - `normalizeToPages()` helper for legacy config migration
- `apps/web/src/components/tenant/SectionRenderer.tsx` - Dynamic section component dispatcher
- `apps/web/src/components/tenant/sections/` - Modular section components

**Usage Pattern:**

```typescript
// In tenant.ts - normalize config to pages
import { normalizeToPages } from '@/lib/tenant';

const pages = normalizeToPages(tenant.landingPageConfig);
const homePage = pages.find(p => p.type === 'home');

// In page component - render sections dynamically
import { SectionRenderer } from '@/components/tenant/SectionRenderer';

export default function TenantHomePage({ sections }) {
  return (
    <main>
      {sections.map((section, i) => (
        <SectionRenderer key={i} section={section} tenant={tenant} />
      ))}
    </main>
  );
}
```

## Development Workflow

### When Adding Multi-Tenant Features

1. **Tenant Scoping:** All queries filter by `tenantId`
2. **Ownership Verification:** Verify tenant owns resource before mutations
3. **JWT Authentication:** Use `res.locals.tenantAuth.tenantId` from middleware
4. **Consistent Patterns:** Follow existing tenant-admin route patterns
5. **Cache Keys:** Include `tenantId` in all cache keys

### When Modifying Database Schema

MAIS uses a **hybrid migration system** with two patterns. Choose the right one:

**Pattern A: Prisma Migrations** (for tables/columns)

```bash
1. Edit server/prisma/schema.prisma
2. npm exec prisma migrate dev --name descriptive_name
3. Prisma auto-generates migration.sql and applies it
4. Update repository implementations if needed
5. npm test to verify
```

**Pattern B: Manual Raw SQL** (for enums, indexes, extensions, RLS)

```bash
1. Edit server/prisma/schema.prisma
2. Find next migration number: ls server/prisma/migrations/ | grep '^[0-9]' | tail -1
3. Create: server/prisma/migrations/NN_name.sql (idempotent SQL with IF EXISTS)
4. Apply: psql $DATABASE_URL < migrations/NN_name.sql
5. npm exec prisma generate
6. npm test to verify
```

**Decision Guide:**
| Change | Pattern | Example |
|--------|---------|---------|
| Add column | A | `newField String?` |
| Add table | A | `model NewTable { ... }` |
| Create enum | B | `CREATE TYPE MyEnum AS ENUM (...)` |
| Add index | B | `CREATE INDEX on Table(col)` |
| Add constraint | A | `@@unique([tenantId, slug])` |
| RLS policy | B | `ALTER TABLE ... ENABLE ROW SECURITY` |

**Critical Rules:**

- Never modify applied migrations (they're part of git history)
- Always use idempotent SQL (IF EXISTS, IF NOT EXISTS, DO $$ blocks)
- Test on dev database before committing
- Commit schema.prisma + migrations together

**Reference:** See `docs/solutions/SCHEMA_DRIFT_PREVENTION.md` for detailed migration patterns and decision tree.

### Test Strategy

- **Unit tests:** Pure services with mock repositories (no HTTP/network)
- **Integration tests:** Database-backed, use test isolation patterns
- **E2E tests:** Playwright, mock mode for speed
- **Coverage target:** 70% (current: 100% pass rate, 752 passing tests)

**Integration Test Pattern:**

```typescript
// Use helper for tenant isolation
import { createTestTenant } from '../helpers/test-tenant';

test('should create booking', async () => {
  const { tenantId, cleanup } = await createTestTenant();
  try {
    // Test with isolated tenant
    await bookingService.create({ tenantId, ... });
  } finally {
    await cleanup();
  }
});
```

## Critical Security Rules

1. **Never skip tenant validation:** All queries must filter by `tenantId`
2. **Encrypt tenant secrets:** Use `TENANT_SECRETS_ENCRYPTION_KEY` for sensitive data
3. **Validate API keys:** Check format `pk_live_{slug}_{random}` or `sk_live_{slug}_{random}`
4. **No cross-tenant queries:** Repository methods require `tenantId` parameter
5. **Rate limit auth endpoints:** Login protected at 5 attempts/15min/IP

## Environment Setup

Required secrets (generate with `openssl rand -hex 32`):

- `JWT_SECRET` - JWT signing key
- `TENANT_SECRETS_ENCRYPTION_KEY` - Encrypt tenant-specific secrets

Database (required for real mode):

- `DATABASE_URL` - Supabase or local PostgreSQL
- `DIRECT_URL` - Same as DATABASE_URL (for migrations)

Optional (graceful fallbacks in real mode):

- `POSTMARK_SERVER_TOKEN` - Email (falls back to file-sink in `tmp/emails/`)
- `GOOGLE_CALENDAR_ID` - Calendar (falls back to mock calendar)
- `STRIPE_SECRET_KEY` - Payments (required for real mode)
- `STRIPE_WEBHOOK_SECRET` - Webhook validation (required for real mode)

## Key Documentation

- **ARCHITECTURE.md** - System design, multi-tenant patterns, config-driven pivot
- **DEVELOPING.md** - Development workflow, commands, database setup
- **TESTING.md** - Test strategy, running tests, E2E setup
- **DECISIONS.md** - Architectural Decision Records (ADRs)
- **docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md** - Multi-tenant patterns
- **docs/security/SECRET_ROTATION_GUIDE.md** - Secret rotation procedures
- **docs/solutions/PREVENTION-STRATEGIES-INDEX.md** - Prevention strategies for avoiding critical issues
- **docs/solutions/PREVENTION-QUICK-REFERENCE.md** - Quick reference cheat sheet (print and pin!)
- **docs/design/BRAND_VOICE_GUIDE.md** - Brand voice, copy patterns, and UI/UX design system (MUST READ for any UI work)
- **docs/adrs/ADR-014-nextjs-app-router-migration.md** - Next.js migration architecture decisions
- **apps/web/README.md** - Next.js app setup, environment variables, architecture

## Documentation Conventions

### Directory Structure

- `docs/guides/` - How-to guides (task-oriented)
- `docs/reference/` - API, architecture, ADRs (information-oriented)
- `docs/solutions/` - Patterns, prevention strategies (understanding-oriented)
- `docs/operations/` - Runbooks, monitoring (operational)
- `docs/archive/YYYY-MM/` - Historical documents by month

### When Adding Documentation

- **New feature guide**: Add to `docs/guides/`
- **API or architecture**: Add to `docs/reference/`
- **Pattern or solution**: Add to `docs/solutions/`
- **ADR**: Add to `docs/adrs/` using ADR template, update DECISIONS.md index

### When Archiving

- Move completed phase/sprint docs to `docs/archive/YYYY-MM/`
- Use date prefix: `YYYY-MM-DD_original-filename.md`
- Never delete historical docs - archive them

### Naming Conventions

- Use SCREAMING_SNAKE_CASE for documentation files (e.g., `SETUP_GUIDE.md`)
- Use kebab-case for directories (e.g., `design-system/`)
- ADRs: `ADR-NNN-short-title.md` (e.g., `ADR-013-advisory-locks.md`)

## Code Patterns to Follow

### Error Handling Pattern

```typescript
// Service throws domain error
throw new BookingConflictError(date);

// Route catches and maps to HTTP
try {
  await bookingService.create(data);
} catch (error) {
  if (error instanceof BookingConflictError) {
    return { status: 409, body: { error: error.message } };
  }
  throw error; // Let error middleware handle unknown errors
}
```

### Repository Pattern with TenantId

```typescript
// All repository methods require tenantId as first parameter
interface CatalogRepository {
  getPackages(tenantId: string): Promise<Package[]>;
  getPackageBySlug(tenantId: string, slug: string): Promise<Package>;
}
```

### Service Constructor Pattern

```typescript
export class BookingService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly paymentProvider: PaymentProvider,
    private readonly eventEmitter: EventEmitter
  ) {}
}
```

## UI/UX Standards (Apple-Quality)

**IMPORTANT:** Before any UI work, read `docs/design/BRAND_VOICE_GUIDE.md`.

### Voice Principles

- Lead with **transformation**, not features ("Book more clients" not "Automated invoicing")
- Speak to **identity**, not pain ("You're a photographer, not a bookkeeper")
- Be **specific** ("Instagram DM to final gallery" not "client communications")
- **Confidence without arrogance** - no hype words (revolutionary, amazing, game-changing)

### Design Principles

- **Generous whitespace:** `py-32 md:py-40` section padding minimum
- **80% neutral, 20% accent:** Sage is precious—use sparingly
- **Typography:** Serif headlines (`font-serif`), tight tracking, light subheadlines
- **Elevation:** Cards use `rounded-3xl shadow-lg`, buttons use `rounded-full`
- **Hover states:** Always include `hover:shadow-xl hover:-translate-y-1 transition-all duration-300`
- **When in doubt, remove** - Apple's mantra

### Quick Reference

```tsx
// Section spacing
<section className="py-32 md:py-40">

// Card pattern
<div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100
                transition-all duration-300 hover:shadow-xl hover:-translate-y-1">

// Button pattern
<Button className="bg-sage hover:bg-sage-hover text-white rounded-full px-10 py-4
                   transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5">

// Headline pattern
<h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary
               leading-[1.1] tracking-tight">
```

## Common Pitfalls

1. **Forgetting tenant scoping:** Always filter by `tenantId` in queries
2. **Cache key collisions:** Include `tenantId` in all cache keys
3. **Skipping transaction locks:** Use pessimistic locking for booking creation
4. **Webhook replay attacks:** Check idempotency before processing
5. **Removing ts-rest `any` types:** Do NOT remove `{ req: any }` in route handlers - it's a library limitation (see Prevention Strategy section)
6. **Type safety bypass with `as any`:** Never use `as any` to bypass checks - use type guards or `as unknown as Type` instead
7. **Missing error handling:** Services should throw domain errors, routes catch and map to HTTP
8. **Direct Prisma usage in routes:** Always go through services/repositories
9. **Hardcoded values:** Use config or environment variables
10. **Exposing backend tokens to client:** Use `getBackendToken()` server-side only, never include in NextAuth session
11. **Missing Next.js error boundaries:** Every dynamic route needs `error.tsx`
12. **Console.log in Next.js:** Use `logger` utility from `@/lib/logger`
13. **Duplicate data fetching:** Wrap shared SSR functions with React `cache()`

## Prevention Strategies (Read These!)

The following links prevent common mistakes from recurring:

- **[ts-rest-any-type-library-limitations](docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md)** - When `any` is acceptable (library limitations)
- **[any-types-quick-reference](docs/solutions/best-practices/any-types-quick-reference-MAIS-20251204.md)** - 30-second decision tree
- **[CODE-REVIEW-ANY-TYPE-CHECKLIST.md](docs/solutions/CODE-REVIEW-ANY-TYPE-CHECKLIST.md)** - Detailed code review process
- **[cascading-entity-type-errors](docs/solutions/logic-errors/cascading-entity-type-errors-MAIS-20251204.md)** - Preventing cascading type errors
- **[database-client-mismatch](docs/solutions/database-issues/database-client-mismatch-MAIS-20251204.md)** - Database/client mismatch prevention
- **[schema-drift-prevention](docs/solutions/database-issues/schema-drift-prevention-MAIS-20251204.md)** - Schema drift prevention (P0)
- **[nextjs-migration-lessons-learned](docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)** - 10 lessons from the Next.js migration

**Key insight from Commit 417b8c0:** ts-rest has type compatibility issues with Express 4.x/5.x. The `{ req: any }` in route handlers is REQUIRED and must not be removed. Document library limitations instead of trying to "fix" them.

## Quick Start Checklist

When starting work on this codebase:

1. Check environment: `npm run doctor`
2. Start API in mock mode: `ADAPTERS_PRESET=mock npm run dev:api`
3. Start Next.js storefronts: `cd apps/web && npm run dev`
4. Verify tenant isolation in all queries
5. Run tests before committing: `npm test`
6. Use contracts for all API changes

**For Next.js work specifically:**

- Read `apps/web/README.md` for Next.js patterns
- Use `cache()` wrapper for shared data fetching
- Add `error.tsx` to all dynamic route folders
- Never expose backend tokens in session callbacks

## Project Structure

```
apps/
└── web/                        # Next.js 14 App Router (port 3000)
    └── src/
        ├── app/                # App Router pages
        │   ├── t/
        │   │   ├── [slug]/     # Tenant storefronts by slug
        │   │   └── _domain/    # Custom domain routes
        │   ├── (protected)/    # Admin routes (NextAuth middleware)
        │   └── api/            # Next.js API routes
        ├── components/         # React components
        │   ├── ui/            # Shared UI (Button, Card, etc.)
        │   └── tenant/        # Tenant-specific components
        │       ├── sections/  # Modular section components
        │       └── SectionRenderer.tsx
        ├── lib/
        │   ├── auth.ts        # NextAuth.js v5 config
        │   ├── tenant.ts      # Tenant data fetching (with cache(), normalizeToPages())
        │   ├── api.ts         # ts-rest client for Express backend
        │   └── logger.ts      # Structured logging utility
        └── middleware.ts       # Custom domain resolution

server/                         # Express API (port 3001)
├── src/
│   ├── routes/                # HTTP handlers (@ts-rest/express)
│   ├── services/              # Business logic
│   ├── adapters/              # External integrations
│   │   ├── prisma/            # Database repositories
│   │   ├── mock/              # In-memory implementations
│   │   └── *.adapter.ts       # Stripe, Postmark, GCal
│   ├── middleware/            # Auth, tenant, error handling
│   ├── lib/
│   │   ├── core/              # Config, logger, events
│   │   ├── ports.ts           # Repository interfaces
│   │   └── entities.ts        # Domain models
│   └── di.ts                  # Dependency injection container

client/                         # Vite SPA (port 5173) - legacy admin
├── src/
│   ├── features/              # Feature modules
│   ├── pages/                 # Route components
│   ├── ui/                    # Shared components
│   └── lib/                   # API client, utilities

packages/
├── contracts/                  # API contracts (Zod + ts-rest)
└── shared/                     # Shared utilities
```

## Current Sprint Goals

**MVP Sprint Status:** Day 4 Complete (5-day aggressive timeline)

**Day 1 Status:** ✅ COMPLETE (November 25, 2025)

- ✅ Tenant self-signup backend (`POST /v1/auth/signup`)
- ✅ Password reset scaffolding (forgot-password, reset-password endpoints)
- ✅ Schema updates: emailVerified, passwordResetToken, passwordResetExpires
- ✅ API contracts: TenantSignupDto, TenantSignupResponse, ForgotPasswordDto, ResetPasswordDto
- ✅ Rate limiting: signupLimiter (5/hour per IP)
- ✅ 759 tests passing (up from 752)

**Day 2 Status:** ✅ COMPLETE

- ✅ Password reset email flow with Postmark (HTML template, SHA-256 token hashing)
- ✅ Stripe Connect onboarding backend routes (`/v1/tenant-admin/stripe/*`)
- ✅ StripeConnectCard.tsx component with status dashboard
- ✅ 14 password reset tests added
- ✅ 771 tests passing

**Day 3 Status:** ✅ COMPLETE

- ✅ SignupPage.tsx at `/signup` route
- ✅ SignupForm.tsx with full validation (business name, email, password)
- ✅ AuthContext integration with signup() method
- ✅ Success flow: JWT storage → redirect to tenant dashboard

**Day 4 Status:** ✅ COMPLETE

- ✅ tenant-signup.spec.ts (12 E2E test cases)
- ✅ password-reset.spec.ts (9 E2E test cases)
- ✅ Total: 771 server tests + 21 new E2E tests

**Day 5 Goals:** Deploy + Documentation

- Production deployment
- User documentation
- Monitoring setup

**Known Issues:**

- Pre-existing TypeScript compilation errors in contracts (Zod/ts-rest version mismatch, no runtime impact)

## Troubleshooting Guide

### Common Issues

**Port already in use:**

```bash
lsof -i :3001  # Find process using port
kill -9 <PID>  # Kill the process
```

**Database connection errors:**

```bash
# Check if PostgreSQL is running
psql $DATABASE_URL -c "SELECT 1;"

# Reset database if corrupted
cd server && npm exec prisma migrate reset
```

**Supabase "Can't reach database" (IPv6 issue):**

If you get `P1001: Can't reach database server` or `ENETUNREACH` errors with Supabase, your network likely doesn't support IPv6. Supabase direct connections (`db.*.supabase.co`) are IPv6-only.

**Fix:** Use Session Pooler instead of Direct Connection:

1. Supabase Dashboard → Connect → Session Pooler
2. Update `DATABASE_URL` in `.env` to use `*.pooler.supabase.com`

See: `docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md`

**Test failures after schema change:**

```bash
cd server
npm exec prisma generate  # Regenerate Prisma Client
npm exec prisma migrate dev  # Apply migrations
```

**Stripe webhook not working:**

```bash
stripe listen --forward-to localhost:3001/v1/webhooks/stripe
# Copy the webhook secret to .env
```

**Mock vs Real mode issues:**

```bash
# Explicitly set mode
export ADAPTERS_PRESET=mock  # or 'real'
npm run dev:api
```
