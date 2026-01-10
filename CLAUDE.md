# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HANDLED (gethandled.ai) is a membership platform for service professionals — photographers, coaches, therapists, wedding planners — combining done-for-you tech with done-with-you education. Built as a multi-tenant modular monolith with Express + React, featuring complete data isolation, config-driven architecture, and mock-first development. Members get professional websites, booking/payments, AI chatbots, plus monthly newsletters and Zoom calls about what's worth knowing in AI.

**Tech Stack:**

- Backend: Express 4, TypeScript 5.9.3 (strict), Prisma 7, PostgreSQL
- Frontend (Admin): React 18, Vite 6, TailwindCSS, Radix UI, TanStack Query
- Frontend (Storefronts): Next.js 14 App Router, NextAuth.js v5, ISR
- API: ts-rest + Zod for type-safe contracts
- Testing: Vitest (unit/integration), Playwright (E2E)

**Current Status:**

- Next.js migration: COMPLETE (6 phases, 14 code review fixes applied)
- Tenant storefronts: SSR-enabled at `/t/[slug]` with custom domain support
- Agent-powered onboarding: COMPLETE (Phases 1-5, event sourcing, dual-mode orchestrator)
- Tenant self-signup: Backend + Frontend complete (`/signup` → `/tenant/build`)
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
npm run dev:web                    # Start Next.js app (port 3000)
npm run dev:all                    # API + Next.js + Stripe webhooks

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

### Segments and Tiers (Service Organization)

Tenants organize their services using **Segments** (categories) and **Tiers** (pricing levels within each category).

**Default Setup (1×3):** When a new tenant is created, the system automatically provisions:

| Default       | Name             | Slug               | Purpose                         |
| ------------- | ---------------- | ------------------ | ------------------------------- |
| **1 Segment** | General          | `general`          | Groups related service packages |
| **Tier 1**    | Basic Package    | `basic-package`    | Entry-level offering            |
| **Tier 2**    | Standard Package | `standard-package` | Most popular option             |
| **Tier 3**    | Premium Package  | `premium-package`  | Full experience                 |

**Data Model:**

- **Segments** = `Segment` model (1-10 per tenant) — e.g., "Family Photos", "Weddings", "Engagements"
- **Tiers** = `Package` model with `groupingOrder` field (1-10 per segment) — ordering determines display position
- All packages have `basePrice: 0` initially — tenants set their own pricing

**Example Structure for a Photographer:**

```
Tenant: Bella Weddings
├── Segment: "Family Photos" (segmentId: abc123)
│   ├── Package: "Mini Session" (groupingOrder: 1) ← Tier 1
│   ├── Package: "Standard Session" (groupingOrder: 2) ← Tier 2
│   └── Package: "Premium Session" (groupingOrder: 3) ← Tier 3
│
├── Segment: "Engagement Photos" (segmentId: def456)
│   ├── Package: "Essential" (groupingOrder: 1)
│   ├── Package: "Classic" (groupingOrder: 2)
│   └── Package: "Deluxe" (groupingOrder: 3)
│
└── Segment: "Wedding Photos" (segmentId: ghi789)
    ├── Package: "Coverage Only" (groupingOrder: 1)
    ├── Package: "Full Day" (groupingOrder: 2)
    └── Package: "Complete Experience" (groupingOrder: 3)
```

**Key Files:**

- `server/src/services/tenant-onboarding.service.ts` - Creates default segment + 3 packages
- `server/prisma/schema.prisma` - `Segment` and `Package` models
- `server/src/routes/tenant-admin-segments.routes.ts` - CRUD for segments

**Tier Display Names:** Tenants can customize tier labels via `Tenant.tierDisplayNames` JSON field:

```json
{
  "tier_1": "The Grounding Reset",
  "tier_2": "The Team Recharge",
  "tier_3": "The Executive Reset"
}
```

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

### Customer Chatbot (AI Agent System)

AI-powered booking assistant for tenant storefronts. Visitors browse services, check availability, and book through natural conversation.

**Architecture:** Widget (React) → `/v1/public/chat/message` → Orchestrator → Tools → Proposal Service

**Key Files:**

- `server/src/agent/customer/customer-tools.ts` - Tools: `get_services`, `check_availability`, `book_service` (T3), `get_business_info`
- `server/src/agent/customer/customer-orchestrator.ts` - Session management, tool dispatch
- `server/src/agent/customer/customer-booking-executor.ts` - Executes confirmed proposals
- `server/src/agent/proposals/executor-registry.ts` - Centralized executor registry (avoids circular deps)
- `server/src/routes/public-customer-chat.routes.ts` - Public API (tenant via `X-Tenant-Key` header)
- `apps/web/src/components/chat/CustomerChatWidget.tsx` - React widget

**Key Patterns:**

- Bookings use T3 trust tier (proposal → customer confirmation → execution)
- Sessions: tenant-scoped, `sessionType: 'CUSTOMER'`, 60-minute TTL
- All tools respect tenant data isolation

**Proposal State Machine:**

```
Tool creates proposal → PENDING → (T2: soft-confirm / T3: user-confirm) → CONFIRMED → Executor → EXECUTED
                                                                                     ↘ on error → FAILED
```

**Critical:** Every state transition to CONFIRMED must trigger executor invocation. Missing this bridge causes proposals to confirm but never execute.

### Business Advisor (Onboarding Agent)

AI-powered onboarding assistant that guides new tenants through initial setup. Collects business info, performs market research, suggests pricing, and configures services.

**Architecture:** GrowthAssistantPanel (React) → `/v1/agent/chat` → Orchestrator → Tools → Event Sourcing

**Dual Mode Orchestrator:**

- **Onboarding Mode:** Active when `tenant.onboardingPhase` is NOT `COMPLETED` or `SKIPPED`
- **Business Assistant Mode:** Regular chat for established tenants

**Onboarding Phases:**

```
NOT_STARTED → DISCOVERY → MARKET_RESEARCH → SERVICES → MARKETING → COMPLETED
                     ↘ (user skips) → SKIPPED
```

**Key Files:**

- `server/src/agent/onboarding/state-machine.ts` - XState v5 phase machine
- `server/src/agent/onboarding/event-sourcing.ts` - Event append with optimistic locking
- `server/src/agent/onboarding/advisor-memory.service.ts` - Session resumption context
- `server/src/agent/prompts/onboarding-system-prompt.ts` - Phase-specific guidance
- `server/src/agent/tools/onboarding-tools.ts` - Discovery, market research, upsert_services tools
- `server/src/agent/executors/onboarding-executors.ts` - Segment/package creation executors
- `apps/web/src/components/onboarding/OnboardingProgress.tsx` - Phase dots UI
- `apps/web/src/hooks/useOnboardingState.ts` - Frontend state management

**Trust Tiers:**

| Tool                      | Tier | Behavior                                  |
| ------------------------- | ---- | ----------------------------------------- |
| `update_onboarding_state` | T1   | Auto-confirms (metadata only)             |
| `get_market_research`     | T1   | Read-only, uses industry benchmarks       |
| `upsert_services`         | T2   | Soft-confirm (creates segment + packages) |
| `update_storefront`       | T2   | Soft-confirm (updates landing page)       |

**Event Sourcing Pattern:**

```typescript
// Append event with optimistic locking
const result = await appendEvent(
  prisma,
  tenantId,
  'DISCOVERY_COMPLETED',
  discoveryPayload,
  expectedVersion // Fails if version mismatch (concurrent modification)
);

// Project state from event history
const memory = await advisorMemoryRepo.projectFromEvents(tenantId);
```

**Session Resumption:**

- Events replayed to project current state on session start
- `isReturning` flag triggers contextual resume message
- Memory summary injected into system prompt for continuity

**Key Patterns:**

- All events validated by Zod schemas in `@macon/contracts`
- Tenant isolation enforced at event sourcing level (`tenantId` + `version`)
- Industry benchmarks (17+ business types) provide pricing guidance when web search unavailable
- Context caching (5-min TTL) reduces database load for repeated session access

**API Endpoints:**

| Endpoint                     | Method | Purpose                       |
| ---------------------------- | ------ | ----------------------------- |
| `/v1/agent/onboarding-state` | GET    | Get current phase + context   |
| `/v1/agent/skip-onboarding`  | POST   | Skip onboarding, update phase |
| `/v1/agent/chat`             | POST   | Chat with auto-mode detection |

**Testing:** See `server/test/agent/onboarding/` and `server/test/integration/onboarding-flow.spec.ts`

**Dual-Mode Consistency (P1 Prevention Strategy):**

When ALL methods that vary by onboarding phase must check mode consistently:

```typescript
// Extract mode check to one reusable method
protected async isOnboardingActive(): Promise<boolean> {
  const ctx = getRequestContext();
  return ctx?.isOnboardingMode && ACTIVE_ONBOARDING_PHASES.includes(tenant.onboardingPhase);
}

// Every mode-aware method calls it FIRST
protected async buildSystemPrompt(): Promise<string> {
  if (await this.isOnboardingActive()) {
    return buildOnboardingSystemPrompt(...);
  }
  return buildAdminSystemPrompt(...);
}
```

**Watch These Methods:** `getTools()`, `buildSystemPrompt()`, `getGreeting()`, `buildContext()` — if one checks mode, ALL must.

**Test:** buildSystemPrompt() must return different content for DISCOVERY phase vs COMPLETED phase, and tools/prompt must align.

**Reference:** `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_PREVENTION.md` (full strategy), `docs/solutions/patterns/DUAL_MODE_ORCHESTRATOR_QUICK_REFERENCE.md` (2 min cheat sheet)

### Agent Evaluation System

Automated quality assessment for AI agent conversations. Evaluates traces for safety, accuracy, and goal completion via Render cron job (every 15 min).

**Architecture:** Cron Job (Render) → `run-eval-batch.ts` → EvalPipeline → Evaluator (Claude Haiku 4.5)

**Key Files:**

- `server/src/agent/evals/pipeline.ts` - Batch processing pipeline
- `server/src/agent/evals/evaluator.ts` - LLM-based evaluator
- `server/scripts/run-eval-batch.ts` - CLI batch runner
- `render.yaml` - Cron job configuration

**Commands:**

```bash
npm run eval-batch                    # Run evaluation batch manually
npm run eval-batch -- --dry-run       # Preview without executing
npm run eval-batch -- --tenant-id=X   # Single tenant
```

**Environment:** Requires `ANTHROPIC_API_KEY` for evaluator LLM calls.

**Deployment:** See `docs/solutions/deployment-issues/agent-eval-cron-job-render-setup-MAIS-20260102.md`

## Domain Expertise (Auto-Load Skills)

This project uses the `compound-engineering` plugin. Before starting implementation, check these triggers and load the matching skill:

| When You're...               | Load This Skill             | Why                                   |
| ---------------------------- | --------------------------- | ------------------------------------- |
| Building UI/components/pages | `frontend-design`           | Distinctive design, avoid AI slop     |
| Adding AI/agent features     | `agent-native-architecture` | Action parity, prompt-native patterns |
| Creating skills/workflows    | `create-agent-skills`       | Proper skill structure                |
| Fixed a non-trivial bug      | Run `/workflows:compound`   | Capture solution for future agents    |

### How to Load Skills

Invoke the skill by name. The skill's SKILL.md loads automatically and provides:

- Essential principles (always applied)
- Router menu for specific guidance
- References that load on-demand
- Anti-patterns to avoid
- Success criteria checklist

### Skill + Project Docs Work Together

**For UI work (`apps/web/`, any component):**

1. FIRST: Load `frontend-design` skill (universal design excellence)
2. THEN: Read `docs/design/BRAND_VOICE_GUIDE.md` (HANDLED brand identity)
3. Apply both: distinctive design + sage green/serif/transformation voice

**For AI agent features:**

1. Load `agent-native-architecture` skill
2. Core principle: "Whatever the user can do, the agent can do"
3. Use primitive tools, not workflow tools

### Compound Engineering Workflows

Use these commands for structured development:

| Command               | When to Use                                       |
| --------------------- | ------------------------------------------------- |
| `/workflows:plan`     | Complex features needing research + design        |
| `/workflows:review`   | Multi-agent code review (8 reviewers in parallel) |
| `/workflows:work`     | Execute plans systematically with verification    |
| `/workflows:compound` | Document solved problems to `docs/solutions/`     |

**Workflow pattern:** `/workflows:plan` → get approval → `/workflows:work` → `/workflows:compound`

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
4. Apply: npx prisma db execute --file prisma/migrations/NN_name.sql
5. npm exec prisma generate
6. npm test to verify
```

> **Note:** Use `prisma db execute` instead of `psql` - it handles Supabase IPv6/pooler connections correctly. See `docs/solutions/database-issues/prisma-db-execute-supabase-migrations-MAIS-20251231.md`

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
- **Coverage target:** 70% (current: 99.7% pass rate, 1196/1200 tests)

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
- **docs/adrs/ADR-016-field-naming-conventions.md** - Database vs API field naming (title/name, priceCents/basePrice)
- **docs/adrs/ADR-017-dark-theme-auth-pages.md** - Dark theme for auth pages (signup, login) vs light marketing
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

**IMPORTANT:** Before any UI work:

1. Load `frontend-design` skill (distinctive design, avoid AI slop)
2. Read `docs/design/BRAND_VOICE_GUIDE.md` (MAIS brand identity)

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
14. **Vercel Root Directory setting:** Never set Root Directory for npm workspaces monorepos - it breaks dependency hoisting
15. **Wrong underscore prefix for unused vars:** Only prefix with `_` if variable is TRULY unused - variables passed to logger, used in assignments, or conditionals are NOT unused
16. **Circular dependencies in agent modules:** Use `npx madge --circular server/src/` before adding imports. Shared state (registries, maps) goes in dedicated modules, not routes
17. **T2 proposal confirms but never executes:** State transitions MUST have side effects. After CONFIRMED, always call the registered executor
18. **Proposal not in API response:** When tools return `requiresApproval: true`, verify proposal object propagates to final response
19. **Field name mismatches in DTOs:** Use canonical names from contracts package. Executor should accept both old and new field names for backward compatibility
20. **Test errors with retryable keywords:** Never use "timeout", "network", "503", "rate limit" in test error messages - they trigger retry logic
21. **Singleton caches prevent DI:** Export class + factory function, not just singleton, to enable test injection
22. **Missing cache invalidation after writes:** Write tools must invalidate context cache after modifying tenant data
23. **Logging full error objects:** Use `sanitizeError()` helper - never log full error objects (may contain API keys, headers)
24. **Early return before hooks:** Adding early returns to existing components BEFORE hooks violates Rules of Hooks. Move all hooks above returns.
25. **Symlinks in TypeScript src directories:** Symlinks cause double compilation. Use tsconfig paths or npm workspaces instead.
26. **TOCTOU on JSON field validation:** Read-validate-write on JSON fields (landingPageConfig, etc.) without transaction allows duplicate data. Wrap in `$transaction` + advisory lock.
27. **Duplicated tool logic:** Same validation logic in multiple tools diverges over time. Extract to `server/src/agent/utils/` immediately.
28. **Inconsistent tool parameters:** Related tools must support same patterns (e.g., all section tools should support sectionId, not just some).
29. **Dual-mode orchestrator method inconsistency:** If `getTools()` checks `isOnboardingMode`, then `buildSystemPrompt()` and `getGreeting()` MUST also check. Otherwise agent has right tools but wrong instructions.
30. **E2E rate limiter misses:** ALL rate limiters need `isTestEnvironment` check (not just some). New limiters often copy old code and forget the test bypass.
31. **Missing store window exposure:** Zustand stores need `if (typeof window !== 'undefined') { window.store = store }` for Playwright access.
32. **Form hydration race:** Next.js forms need `waitForTimeout(500)` after `waitForSelector` before filling - hydration clears values.
33. **Session leak in E2E:** Use `browser.newContext()` for session isolation, not `clearCookies()` - NextAuth httpOnly cookies don't clear reliably.
34. **UUID validation on CUID fields:** Zod `z.string().uuid()` fails on Prisma-generated CUIDs. Use `z.string()` or `z.string().cuid()` for database IDs.
35. **Multi-path data format mismatch:** When AI executor and admin API both write to same field, verify format matches what read paths expect. Reader expected `{published: config}`, writer stored raw config - silent failure.
36. **AI tool responses missing state guidance:** Tools returning draft/live content need `hasDraft` indicator AND `note` field with communication rules ("Say 'In your draft...'") to prevent AI from confusing states.

## Prevention Strategies (Read These!)

The following links prevent common mistakes from recurring:

- **[mais-critical-patterns](docs/solutions/patterns/mais-critical-patterns.md)** - Required reading for all agents (10 critical patterns)
- **[ts-rest-any-type-library-limitations](docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md)** - When `any` is acceptable (library limitations)
- **[any-types-quick-reference](docs/solutions/best-practices/any-types-quick-reference-MAIS-20251204.md)** - 30-second decision tree
- **[cascading-entity-type-errors](docs/solutions/logic-errors/cascading-entity-type-errors-MAIS-20251204.md)** - Preventing cascading type errors
- **[database-client-mismatch](docs/solutions/database-issues/database-client-mismatch-MAIS-20251204.md)** - Database/client mismatch prevention
- **[schema-drift-prevention](docs/solutions/database-issues/schema-drift-prevention-MAIS-20251204.md)** - Schema drift prevention (P0)
- **[nextjs-migration-lessons-learned](docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)** - 10 lessons from the Next.js migration
- **[vercel-nextjs-npm-workspaces](docs/solutions/deployment-issues/vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md)** - Vercel deployment fix for npm workspaces monorepos
- **[typescript-unused-variables-build-failure](docs/solutions/build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md)** - Unused variable build errors and underscore prefix decision tree
- **[chatbot-proposal-execution-flow](docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)** - T2 execution, field normalization, tenant validation security
- **[circular-dependency-executor-registry](docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md)** - Registry module pattern for breaking circular imports
- **[auth-form-accessibility-checklist](docs/solutions/patterns/auth-form-accessibility-checklist-MAIS-20251230.md)** - WCAG 2.1 AA checklist for auth forms (ARIA, keyboard, CLS)
- **[nextauth-v5-secure-cookie-prefix](docs/solutions/authentication-issues/nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md)** - NextAuth v5 HTTPS cookie prefix causing 401 on production
- **[phase-5-testing-and-caching-prevention](docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md)** - Retryable keyword conflicts, singleton cache DI, cache invalidation, error sanitization
- **[prisma-7-json-type-breaking-changes](docs/solutions/database-issues/prisma-7-json-type-breaking-changes-MAIS-20260102.md)** - Prisma 7 JSON field type casting patterns (`as unknown as Type`)
- **[prisma-7-seed-module-resolution](docs/solutions/database-issues/prisma-7-seed-module-resolution-MAIS-20260105.md)** - Prisma 7 seed script import paths (`/client` entry point), factory pattern, dotenv loading order
- **[express-route-ordering-auth-fallback](docs/solutions/code-review-patterns/express-route-ordering-auth-fallback-security-MAIS-20260102.md)** - Express route ordering (static before parameterized), auth fallback guards, tenant defense-in-depth
- **[vitest-skipif-collection-phase-timing](docs/solutions/test-failures/vitest-skipif-collection-phase-timing-MAIS-20260102.md)** - Vitest `skipIf` evaluates at collection time before `beforeAll`; use `describe.runIf` with sync checks
- **[turbopack-hmr-module-cache-staleness](docs/solutions/dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md)** - Stale HMR cache prevention (import removal, build mode switching, branch changes) + quick recovery scripts
- **[build-mode-storefront-editor-patterns](docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md)** - Agent parity, DRY schemas, PostMessage validation, draft system consistency, trust tiers
- **[agent-tools-prevention-index](docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md)** - Master index for agent tool patterns (tenant isolation, executor registry, TOCTOU prevention, DRY utilities)
- **[booking-links-phase-0-prevention](docs/solutions/patterns/BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md)** - 4 prevention patterns from booking links code review (P1 fixes)
- **[atomic-tenant-provisioning-defense-in-depth](docs/solutions/patterns/atomic-tenant-provisioning-defense-in-depth-MAIS-20260105.md)** - Multi-entity creation patterns: atomic transactions, shared provisioning service, DI container consistency, DRY constants, defense-in-depth validation (P1 issues #629-634)
- **[eslint-dead-code-prevention-index](docs/solutions/patterns/ESLINT_PREVENTION_INDEX.md)** - Complete prevention strategy for dead code (unused imports, unused variables, type-only imports, dead functions). Start here for decision trees, checklists, and implementation guides.
  - Quick reference: [ESLINT_DEAD_CODE_QUICK_REFERENCE.md](docs/solutions/patterns/ESLINT_DEAD_CODE_QUICK_REFERENCE.md) - Print & pin (2 min read)
  - Implementation: [ESLINT_PRE_COMMIT_IMPLEMENTATION_GUIDE.md](docs/solutions/patterns/ESLINT_PRE_COMMIT_IMPLEMENTATION_GUIDE.md) - Add ESLint to pre-commit hook
  - Strategy: [ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md](docs/solutions/patterns/ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md) - 7 comprehensive strategies
- **[react-hooks-early-return-prevention](docs/solutions/patterns/REACT_HOOKS_EARLY_RETURN_PREVENTION.md)** - React Rules of Hooks: early returns before hooks cause Vercel build failure (local passes, CI fails). Move ALL hooks above ANY returns.
  - Quick reference: [REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md](docs/solutions/patterns/REACT_HOOKS_EARLY_RETURN_QUICK_REFERENCE.md) - Print & pin (2 min read)
- **[typescript-symlink-resolution-prevention](docs/solutions/patterns/TYPESCRIPT_SYMLINK_RESOLUTION_PREVENTION.md)** - Symlinks in src cause double compilation. Use tsconfig paths or workspaces instead.
  - Quick reference: [TYPESCRIPT_SYMLINK_QUICK_REFERENCE.md](docs/solutions/patterns/TYPESCRIPT_SYMLINK_QUICK_REFERENCE.md) - Print & pin (2 min read)
- **[storefront-section-ids-prevention](docs/solutions/patterns/STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md)** - TOCTOU races on JSON fields, DRY for tool logic, API consistency across related tools, testing error paths
  - Quick reference: [STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md](docs/solutions/patterns/STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md) - Print & pin (2 min read)
- **[nextjs-server-client-boundary](docs/solutions/best-practices/nextjs-migration-audit-server-client-boundary-MAIS-20260108.md)** - Server/client import boundary pattern: files importing `next/headers` are "tainted" and cannot be imported by client components. Multi-reviewer audit methodology.
  - Quick reference: [NEXTJS_SERVER_CLIENT_BOUNDARY_QUICK_REFERENCE.md](docs/solutions/best-practices/NEXTJS_SERVER_CLIENT_BOUNDARY_QUICK_REFERENCE.md) - Print & pin (2 min read)
- **[onboarding-mode-orchestrator-system-prompt](docs/solutions/agent-issues/onboarding-mode-orchestrator-system-prompt-MAIS-20260108.md)** - Dual-mode orchestrator must check mode in ALL methods (getTools, buildSystemPrompt, getGreeting). If one checks but others don't, agent has right tools but wrong instructions.
- **[agent-ui-phase-5-patterns](docs/solutions/patterns/AGENT_UI_PHASE_5_CODE_REVIEW_PATTERNS.md)** - 5 critical patterns: FIFO buffer for unbounded arrays, cancelPendingSave for debounce races, async dialog handling, capability registry hygiene, singleton documentation.
  - Quick reference: [AGENT_UI_PHASE_5_QUICK_REFERENCE.md](docs/solutions/patterns/AGENT_UI_PHASE_5_QUICK_REFERENCE.md) - Print & pin (2 min read)
- **[e2e-nextjs-migration-prevention](docs/solutions/patterns/E2E_NEXTJS_MIGRATION_PREVENTION_STRATEGIES.md)** - 5 E2E test failure patterns after framework migrations: rate limiter test bypasses, Zustand store exposure, React effect order, Next.js hydration waits, NextAuth session isolation.
  - Quick reference: [E2E_NEXTJS_MIGRATION_QUICK_REFERENCE.md](docs/solutions/patterns/E2E_NEXTJS_MIGRATION_QUICK_REFERENCE.md) - Print & pin (2 min read)
- **[dual-draft-system-prevention](docs/solutions/patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md)** - Schema validation alignment (UUID vs CUID), read/write path consistency for multi-path data, AI tool communication clarity (draft vs live state guidance).
  - Quick reference: [DUAL_DRAFT_SYSTEM_QUICK_REFERENCE.md](docs/solutions/patterns/DUAL_DRAFT_SYSTEM_QUICK_REFERENCE.md) - Print & pin (2 min read)

**Key insight from Dual Draft System Bug (#697, #699):** When multiple code paths write the same data (AI executor vs admin API), ALL must agree on format. Zod `z.string().uuid()` fails on Prisma CUIDs - use `z.string()` for database IDs. Read path expected `{published: config}` wrapper but write path stored raw config - verify format matches before writing. AI tools need explicit state indicators (`hasDraft`) and communication notes ("Say 'In your draft...'") to prevent confusing draft with live content.

**Key insight from E2E Next.js Migration (Agent-First Phase 5):** Framework migrations (SPA to SSR) introduce systematic E2E failures. Rate limiters: ALL must use shared `isTestEnvironment` constant. Stores: expose on `window` for Playwright. Effects: child runs before parent - guard against undefined. Hydration: add 500ms wait after `waitForSelector`. Sessions: use `browser.newContext()` not `clearCookies()`.

**Key insight from Agent UI Phase 5 Code Review:** Arrays that grow over time (action logs, event queues) need MAX_SIZE + FIFO (shift oldest). Debounced operations need exported cancel methods called before critical operations (publish/discard). Dialogs with async callbacks must await before closing. Capability registries must match backend tools bidirectionally - add missing, remove dead.

**Key insight from Dual-Mode Orchestrator (Commit TBD):** When orchestrator has dual modes (onboarding vs admin), ALL methods must check mode consistently. Bug: `getTools()` checked `isOnboardingMode` but `buildSystemPrompt()` always returned admin template saying "connect Stripe first". Result: agent had onboarding tools but followed admin instructions, skipping discovery phase. Fix: Extract `isOnboardingActive()` method, call from getTools(), buildSystemPrompt(), AND getGreeting().

**Key insight from Next.js Server/Client Boundary (Commit 09230b16):** Files that import server-only modules (`next/headers`, `cookies`) "taint" the entire file - client components cannot import ANYTHING from it, even functions that don't use the server import. This means apparent "duplicate" code (like `api.client.ts` duplicating functions from `api.ts`) is often INTENTIONAL. Before deleting "dead code", check if the original file has server-only imports. Multi-reviewer validation (DHH, TypeScript, Simplicity personas) catches different issues.

**Key insight from Storefront Section IDs Code Review:** JSON field check-then-write patterns need transaction + advisory lock (TOCTOU). Extract shared resolution logic to `agent/utils/` - don't duplicate between tools. All related tools must support same parameters (sectionId preferred, sectionIndex fallback). Test cross-page errors and legacy data (sections without IDs).

**Key insight from Atomic Tenant Provisioning:** Multi-entity creation requires three defenses: (1) atomic transaction to prevent partial state, (2) centralized provisioning service to prevent logic duplication, (3) validation layer to catch regressions. Never have the same "create tenant + defaults" logic in multiple places. When service paths diverge (admin API vs signup), unify them immediately using shared provisioning service.

**Key insight from ESLint Dead Code Prevention (Commit 764b9132):** Dead code accumulates when only ESLint is used - it catches syntax patterns but misses semantic issues. Prevention requires: (1) pre-commit hooks running ESLint with `--max-warnings 0`, (2) decision tree for delete vs underscore prefix, (3) code review checklist enforcing YAGNI, (4) TypeScript strictness (noUnusedLocals + noUnusedParameters), (5) IDE integration for real-time feedback. Golden rule: **Delete > Prefix > Keep**. Use underscore prefix ONLY for required function parameters you don't use; delete everything else.

**Key insight from Booking Links Phase 0:** All agent write tools MUST be in `REQUIRED_EXECUTOR_TOOLS` for startup validation. Use `updateMany`/`deleteMany` with `tenantId` in where clause (defense-in-depth). Wrap check-then-act patterns in transactions with `FOR UPDATE` locks. Extract shared utilities to `agent/utils/` immediately (not "later").

**Key insight from Commit 417b8c0:** ts-rest has type compatibility issues with Express 4.x/5.x. The `{ req: any }` in route handlers is REQUIRED and must not be removed. Document library limitations instead of trying to "fix" them.

**Key insight from Unused Variables Fix:** Only prefix with `_` if the variable is TRULY unused. Variables passed to logger calls, used in assignments, or referenced in conditionals are NOT unused - they are used.

**Key insight from Proposal Execution Fix:** Circular dependencies between routes and orchestrators caused executor registry to fail. Solution: Extract shared state (executor registry) to dedicated module (`agent/proposals/executor-registry.ts`). Routes and orchestrators both import from this central module.

**Key insight from Phase 5 Testing/Caching:** Test error messages containing retryable keywords ("timeout", "network", "503") trigger retry logic and cause test failures. Use neutral error messages like "Request failed" in tests. Singleton cache patterns prevent dependency injection - export class + factory, not just instance.

**Key insight from Prisma 7 Upgrade:** Prisma 7 has stricter JSON field types. Use `as unknown as TargetType` for reads (not `as TargetType`), use `undefined` instead of `null` for optional JSON fields, and don't try to extract `$extends` return types - just alias to `PrismaClient`.

**Key insight from Agent-Eval Code Review:** Express matches routes in registration order. Static paths (`/stats`) must be defined BEFORE parameterized paths (`/:traceId`) or they become unreachable. Never use `|| 'system'` auth fallbacks - require authenticated user and return 401. Always include `tenantId` in queries even when IDs are pre-filtered (defense-in-depth).

**Key insight from Turbopack HMR Cache Issues:** Turbopack maintains an in-memory module graph that becomes stale when removing imports or switching build modes. Recovery is always the same: clear caches (`rm -rf .next .turbo`) and restart. Prevention: proactively clear after branch switches, npm installs, and dependency removals. Use `npm run dev:fresh` script (added to apps/web/package.json) for one-liner recovery.

**Key insight from Uncommitted Next.js Changes (Commit b87da8bb):** When code changes don't take effect in Next.js despite file edits, check if changes are COMMITTED. Next.js compiles from HEAD, not working directory. Diagnosis: `git show HEAD:path/to/file` vs `cat path/to/file`. Solution: Commit → Clear cache (`rm -rf .next .turbo`) → Restart. See `docs/solutions/dev-workflow/uncommitted-nextjs-changes-not-reflected-MAIS-20260109.md`.

**Key insight from Build Mode Code Review:** Agent parity is critical - every UI action needs a corresponding tool (publish_draft, discard_draft, get_draft were missing). Zod schemas MUST live in `@macon/contracts` and be imported in both tools AND executors (not duplicated). All visual changes (including branding) must go to draft, not live. PostMessage handlers must validate origin AND parse through Zod before processing - never cast `event.data as SomeType`.

**Key insight from React Hooks Early Return:** Adding an early return BEFORE existing hooks violates React's Rules of Hooks (hooks must be called in the same order every render). Build passes locally but fails on Vercel due to different ESLint strictness. Solution: Move ALL hooks above ANY early returns, use optional chaining (`?.`) and nullish coalescing (`??`) in hook initializers. Always run `npm run build` locally before pushing.

**Key insight from TypeScript Symlinks:** Symlinks in TypeScript source directories cause double compilation - same file resolved via two different paths is treated as two different modules. This breaks `instanceof` checks, creates duplicate singletons, and causes "duplicate identifier" errors. Solution: Never put symlinks in src directories. Use tsconfig.json `paths` or npm workspaces instead. Detect with: `find apps/*/src server/src -type l`.

**Key insight from Section ID Pattern:** Array indices are fragile for AI chatbot references - they drift on delete/reorder. Solution: Human-readable IDs (`{page}-{type}-{qualifier}` like `home-hero-main`) with monotonic counter (never reuse deleted IDs). TOCTOU prevention: wrap uniqueness checks in transactions with advisory locks. DRY: extract shared ID resolution logic to `agent/utils/`. See `docs/solutions/patterns/STOREFRONT_SECTION_ID_PATTERN-MAIS-20260108.md`.

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

**For agent/chatbot work specifically:**

- Check for circular deps: `npx madge --circular server/src/`
- Verify executor registered for tool in `registerAllExecutors()`
- Test full proposal lifecycle (create → confirm → execute)
- Ensure proposal object propagates to API response for T3 tools

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

packages/
├── contracts/                  # API contracts (Zod + ts-rest)
└── shared/                     # Shared utilities
```

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
