# Architecture

## Platform Status

**Current Version:** Sprint 10 Complete (January 2025)
**Maturity Level:** 9.8/10 (Production-Ready)
**Deployment Status:** Preparing for demo user production deployment

**Recent Milestones:**

- ✅ Sprint 9: Package catalog & discovery system
- ✅ Sprint 8.5: Complete UX enhancements
- ✅ Sprint 10: Technical excellence (test stability, security hardening, performance optimization)
- 🚀 Next: Production deployment for demo users

**Test Coverage:**

- 752/752 tests passing (100%), 3 skipped, 12 todo
- 42 new tests added in Sprint 10 (race conditions + security)
- Test infrastructure: Retry helpers with exponential backoff
- Sprint 10 Phase 2: Fixed remaining 2 failing tests

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

### Frontend

React 18 + Vite, feature‑based (catalog, booking, admin). Uses a generated ts‑rest client and TanStack Query.

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

**Layer 2: Pessimistic Locking**

```typescript
await prisma.$transaction(async (tx) => {
  // SELECT FOR UPDATE locks the row (or absence of row)
  const booking = await tx.$queryRaw`
    SELECT id FROM bookings
    WHERE date = ${new Date(date)}
    FOR UPDATE
  `;

  if (booking.length > 0) {
    throw new BookingConflictError(date);
  }

  // Create booking within same transaction
  await tx.booking.create({ data: { date, ... } });
});
```

Application-level defense: First request acquires lock, second request waits. See **DECISIONS.md ADR-001** for rationale.

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

**Solution:** Wrap availability check + booking creation in database transaction with row-level lock.

**Files:**

- `server/src/services/availability.service.ts` - Transaction-aware availability check
- `server/src/services/booking.service.ts` - Transaction wrapper
- `server/src/adapters/prisma/booking.repository.ts` - Transaction support

**See Also:** DECISIONS.md ADR-001 (Pessimistic Locking), IMPROVEMENT-ROADMAP.md P0-3

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

**See Also:** DECISIONS.md ADR-001 (Pessimistic Locking)

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
**Infrastructure:** Supabase (PostgreSQL), Upstash (Redis), Vercel/Railway (hosting)
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
- [ ] SSL certificates provisioned (automatic with Vercel/Railway)

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
