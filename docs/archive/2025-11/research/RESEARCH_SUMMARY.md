# MAIS Documentation Research Summary

**Research Date:** 2025-12-02
**Status:** Complete - All key documentation reviewed
**Purpose:** Comprehensive reference for MVP gap implementation

---

## 1. Key Architecture Decision Records (ADRs)

### ADR-001: Pessimistic Locking (SUPERSEDED)

- **Status:** Superseded by ADR-006
- **Original Decision:** Use `SELECT FOR UPDATE` with database transactions
- **Outcome:** Worked but caused P2034 deadlock errors in high-concurrency scenarios
- **Key Issue:** Locking non-existent rows created predicate locks that conflicted even for different dates

### ADR-002: Database-Based Webhook Dead Letter Queue ✅

- **Status:** Accepted & Implemented
- **Decision:** Store webhook events in database with idempotency checks
- **Benefits:**
  - Every webhook attempt logged (auditability)
  - Automatic duplicate detection
  - Manual recovery path via admin dashboard
  - No additional infrastructure needed
  - Full payload + error messages stored for debugging
- **Implementation:**
  - `WebhookEvent` model: eventId (unique), status (pending/processed/failed), payload, attempts, lastError
  - Idempotency: Check status before processing
  - Retry: Return 500 to trigger Stripe retry
  - Archive old events (>90 days) to manage table growth
- **Files:** `server/src/routes/webhooks.routes.ts`, `server/prisma/schema.prisma`

### ADR-003: Git History Rewrite (PENDING)

- **Status:** Accepted, Implementation Pending
- **Decision:** Rewrite git history to remove exposed secrets
- **Timeline:** Week 1 (rotate), Week 2 (test), Week 3 (execute), Week 4 (verify)
- **Communication:** Requires team notification + re-clone instructions
- **Risk Mitigation:** Full mirror backup before rewrite, 90-day retention

### ADR-004: 100% Test Coverage for Webhook Handler ✅

- **Status:** Accepted
- **Decision:** Mandatory 100% coverage for critical payment flows
- **Rationale:**
  - Wedding bookings: reputation risk if webhook fails
  - Failure = customer charged but no booking
  - Errors hard to reproduce in production
  - Small, focused code path (reasonable scope)
- **Testing Strategy:**
  - Unit tests: Signature verification, metadata parsing, idempotency, error handling
  - Integration tests: Real Stripe signatures, DB transactions, email notifications
  - Contract tests: Stripe webhook schema validation
- **Target Coverage:** 100% line + 100% branch for webhook handler

### ADR-005: PaymentProvider Interface ✅

- **Status:** Accepted & Implemented
- **Decision:** Abstract payment operations behind interface
- **Benefits:**
  - Vendor-agnostic booking service
  - Mock payment flows for development
  - Testable without real Stripe credentials
  - Future payment provider migration path
- **Interface Methods:**
  - `createCheckoutSession()` - Returns { url, sessionId }
  - `verifyWebhook()` - Verify Stripe signature
  - `refundPayment()` (optional) - Handle refunds
- **Implementations:**
  - `StripePaymentAdapter` (real mode)
  - `MockPaymentProvider` (dev/test mode)
- **Dependency Injection:** Wired in `server/src/di.ts` based on `ADAPTERS_PRESET`

### ADR-006: PostgreSQL Advisory Locks ✅ (CURRENT)

- **Status:** Accepted & Implemented
- **Supersedes:** ADR-001
- **Decision:** Use `pg_advisory_xact_lock()` for booking serialization
- **Root Cause Fix:** Eliminated P2034 deadlock errors by:
  - Avoiding non-existent row locks (predicate locks in SERIALIZABLE)
  - Using deterministic hash function: `hashTenantDate(tenantId, date)`
  - Changing to READ COMMITTED isolation level
  - Allowing different dates to not block each other
- **Test Results:**
  - Before: 747/767 passing (97.4%), 5 P2034 failures
  - After: 752/752 passing (100%), 0 P2034 failures
- **Implementation:**

  ```typescript
  async create(tenantId: string, booking: Booking): Promise<Booking> {
    return await this.prisma.$transaction(async (tx) => {
      const lockId = hashTenantDate(tenantId, booking.eventDate);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

      // Check + create atomically
      const existing = await tx.booking.findFirst({
        where: { tenantId, date: new Date(booking.eventDate) }
      });

      if (existing) throw new BookingConflictError(booking.eventDate);
      await tx.booking.create({ data: { tenantId, ... } });
    }, {
      timeout: 5000,
      isolationLevel: 'ReadCommitted'
    });
  }
  ```

- **Hash Algorithm:** FNV-1a (chosen for low collision rate)
- **Safety Net:** Unique constraint on `(tenantId, date)` prevents failures

---

## 2. Multi-Tenant Architecture Requirements

### Core Principles

1. **Row-Level Data Isolation**
   - All queries MUST filter by `tenantId`
   - Repository methods require `tenantId` as first parameter
   - Impossible to query cross-tenant data without explicit tenantId

2. **Tenant Resolution Flow**
   - Client sends `X-Tenant-Key` header (format: `pk_live_{slug}_{random}`)
   - Middleware validates key and resolves to tenantId
   - Middleware injects `tenantId` into `req.tenantId`
   - All downstream code uses `req.tenantId` for filtering

3. **Cache Isolation**
   - All cache keys MUST include tenantId: `catalog:${tenantId}:packages`
   - HTTP-level cache removed (CRITICAL SECURITY FIX in Phase 1)
   - Application-level cache (CacheService) provides performance with isolation
   - No cross-tenant data leakage possible

4. **Commission Calculation**
   - Server-side calculation: Never trust client for amount
   - Per-tenant commission rate (10-15%)
   - Stripe Connect: `application_fee_amount` set server-side
   - Rounding: Always round UP to protect platform revenue

### Database Schema Requirements

- **Tenant model:** API keys (public + encrypted secret), commission %, stripeAccountId, isActive
- **Unique Constraints:** `[tenantId, slug]` for packages, `[tenantId, date]` for bookings
- **Performance Indexes:** 16 indexes across 6 models for tenant-scoped queries
- **Booking Model:** Include commissionAmount, commissionPercent for audit trail

### API Key Format

- **Public Keys:** `pk_live_{slug}_{random32chars}` - Safe for client-side
- **Secret Keys:** `sk_live_{slug}_{random32chars}` - Encrypted in DB with AES-256-GCM
- **Encryption:** Use `TENANT_SECRETS_ENCRYPTION_KEY` (generate: `openssl rand -hex 32`)

### Critical Security Rules

1. Never skip tenant validation - all queries filter by tenantId
2. Encrypt tenant secrets with TENANT_SECRETS_ENCRYPTION_KEY
3. Validate API key format (pk*live* or sk*live*)
4. No cross-tenant queries - repository methods require tenantId
5. Cache keys include tenantId

---

## 3. Testing Strategy & Requirements

### Test Pyramid

```
E2E Tests (Playwright)
    ↑
Integration Tests (Database + Services)
    ↑
Unit Tests (Pure Services + Mocks)
```

### Unit Tests (Target: 70% coverage)

- **Pattern:** Pure services with fake repositories (no HTTP/network)
- **Tools:** Vitest, test doubles (mocks/stubs)
- **Coverage Areas:**
  - Availability service: busy/booked/blackout cases
  - Booking service: unique date constraint, refunds, idempotent webhooks
  - Catalog service: package/add-on CRUD
  - Identity service: login success/fail
  - Commission service: calculation accuracy, rounding rules
- **Current:** 752 tests passing (100% pass rate)

### Integration Tests

- **Pattern:** Database-backed, use test isolation helpers
- **Tools:** Vitest + PostgreSQL test database
- **Helpers:**
  - `createTestTenant()` - Isolated tenant with auto-cleanup
  - `queryCountTracker()` - Detect N+1 query patterns
  - `mockStripeWebhook()` - Webhook testing
  - `calculateTimeout()` - Dynamic timeout for bulk operations
- **Critical Patterns:**
  - Sequential execution (not parallel) for transaction contention
  - DI container completeness checks (prevent undefined adapters)
  - Timeout configuration for bulk operations (30000ms+)
- **Recent Additions:** 42 new tests in Sprint 10 (race conditions + security)

### E2E Tests (Playwright)

- **Pattern:** Happy path in mock mode, one Stripe test in real mode
- **Setup:** Mock API server on :3001, Playwright auto-starts web server
- **Key Files:**
  - `e2e/playwright.config.ts` - Config with E2E_TEST flag
  - `e2e/tests/` - Test files
- **Test Scenarios:**
  - Mock booking flow (2 tests)
  - Complete booking journey (2 tests)
  - Admin flow (5 tests: auth, packages, blackouts, bookings, logout)
- **Rate Limiting Solution:**
  - Environment detection: `E2E_TEST=1` flag
  - Rate limiter: `max: isTestEnvironment ? 100 : 5`
  - Token caching: Cache auth token, restore per test
  - Serial execution: `test.describe.configure({ mode: 'serial' })`

### Commands

```bash
npm test                           # All unit tests
npm run test:integration           # Integration only
npm run test:watch                 # Watch mode
npm run test:coverage              # Coverage report
npm run test:e2e                   # E2E headless
npm run test:e2e:ui                # E2E interactive UI
npm run test:e2e:headed            # E2E with visible browser
```

### Test Coverage Targets

- **Overall:** 70% (currently 100% pass rate, 752 tests)
- **Critical Paths:** 100% (webhooks, payments, availability, booking)
- **New Features:** 90% minimum

---

## 4. Multi-Tenant Implementation Patterns

### Phase 1: Foundation (COMPLETE ✅)

**Commit:** efda74b
**Timeline:** Weeks 1-4

**Deliverables:**

- [x] Tenant model with API keys + encryption
- [x] Multi-tenant fields in all models
- [x] Commission calculation engine
- [x] All services tenant-scoped
- [x] Migration applied (zero data loss)
- [x] **CRITICAL FIX:** Removed HTTP cache (was leaking data cross-tenant)
- [x] 3 test tenants created
- [x] Comprehensive testing

**Validation:**

- Tenant isolation verified (no data leakage)
- Commission tested (10%, 12.5%, 15%)
- Cache scoping verified
- Performance impact: <2% (target: <5%)

**Key Security Fix:** HTTP cache middleware removed from `app.ts` because cache keys lacked tenantId - was causing Tenant A's data to be visible to Tenant B.

### Phase 2: Embeddable Widget (NEXT)

**Timeline:** Weeks 5-8

**Key Components:**

- SDK loader (`mais-sdk.js`) - Lightweight vanilla JS (<3KB)
- Widget application (`client/src/widget/`) - React app with tenant branding
- postMessage communication - Secure cross-origin messaging
- Auto-resize iframe - Responsive to content changes

**Tenant Integration:**

```html
<script
  src="https://widget.mais.com/sdk/mais-sdk.js"
  data-tenant="bellaweddings"
  data-api-key="pk_live_bellaweddings_xxx"
></script>
<div id="mais-widget"></div>
```

### Phase 3: Stripe Connect & Payments

**Timeline:** Weeks 9-12

**Components:**

- StripeConnectService: Account creation, onboarding links, status checks
- Booking service: PaymentIntent with commission
- Webhook handler: Payment success/failure
- Commission tracking: Per-booking audit trail

### Phase 4: Admin Tools

**Timeline:** Weeks 13-16

**Features:**

- Tenant CRUD (create, list, update)
- Commission rate editor
- Branding manager (logo, colors)
- Tenant statistics dashboard
- Stripe onboarding tracker

### Phase 5: Production Hardening

**Timeline:** Weeks 17-20

**Security Checklist:**

- [ ] CSP headers: `frame-ancestors` whitelist
- [ ] postMessage origin validation (never `'*'`)
- [ ] CORS configured for known tenant domains
- [ ] Rate limiting (express-rate-limit)
- [ ] Encrypted secrets with key rotation
- [ ] Stripe webhook signature validation
- [ ] SQL injection prevention (Prisma)
- [ ] Admin JWT expiration
- [ ] HTTPS enforced

**Performance:**

- [ ] PostgreSQL indexes verified
- [ ] Cache hit rate monitoring
- [ ] Stripe API deduplication
- [ ] Connection pooling
- [ ] Widget CDN caching

### Phase 6: Scale to 10+ Tenants

**Timeline:** Weeks 21-24

**Tenant Onboarding Checklist:**

1. Admin creates tenant
2. Tenant completes Stripe Connect onboarding
3. Tenant creates 3-5 packages with images
4. Tenant integrates SDK on website
5. Test booking flow end-to-end
6. Verify commission calculation
7. Go live!

---

## 5. Concurrency Control Patterns

### Double-Booking Prevention (3-Layer Defense)

**Layer 1: Database Unique Constraint** ✅

```prisma
model Booking {
  tenantId String
  date     DateTime
  @@unique([tenantId, date])  // Enforces one booking per date per tenant
}
```

**Layer 2: PostgreSQL Advisory Locks** ✅ (Current implementation)

```typescript
await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
// Seriali access per tenant+date combination
// No phantom read problems like SELECT FOR UPDATE
```

**Layer 3: Graceful Error Handling** ✅

```typescript
try {
  await bookingRepo.create(booking);
} catch (error) {
  if (error.code === 'P2002') {
    throw new BookingConflictError(date);
  }
}
```

### Webhook Idempotency Pattern

**Strategy:** Database-based deduplication with status tracking

```typescript
// 1. Store webhook event with unique eventId
await prisma.webhookEvent.upsert({
  where: { eventId: event.id },
  create: { eventId: event.id, eventType: event.type, payload: event },
  update: { attempts: { increment: 1 } }
});

// 2. Check if already processed
if (webhookEvent.status === 'processed') return { duplicate: true };

// 3. Process and mark status
await bookingService.onPaymentCompleted(...);
await prisma.webhookEvent.update({
  where: { id: webhookEvent.id },
  data: { status: 'processed', processedAt: new Date() }
});
```

### Transaction Safety Pattern

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Check availability WITH advisory lock
  const isAvailable = await availabilityService.isDateAvailableWithLock(date, tx);
  if (!isAvailable) throw new BookingConflictError(date);

  // 2. Create booking (same transaction)
  await bookingRepo.createWithTransaction(booking, tx);

  // 3. Emit event for notifications
  eventEmitter.emit('BookingPaid', { ... });
});
```

---

## 6. Prevention Strategies & Common Pitfalls

### Critical Security Patterns ✅

**Pattern 1: Tenant-Scoped Queries**

```typescript
// ❌ WRONG - Returns all tenant data
const packages = await prisma.package.findMany({ where: { active: true } });

// ✅ CORRECT - Tenant isolated
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});
```

**Pattern 2: Tenant-Scoped Cache Keys**

```typescript
// ❌ WRONG - Leaks data between tenants
const cacheKey = 'catalog:packages';

// ✅ CORRECT - Tenant isolated
const cacheKey = `catalog:${tenantId}:packages`;
```

**Pattern 3: Server-Side Commission Calculation**

```typescript
// ❌ WRONG - Trust client for amount
const commission = req.body.commission;

// ✅ CORRECT - Calculate server-side
const commission = await commissionService.calculateCommission(tenantId, price);
```

### Common Pitfalls to Avoid

1. **Forgetting tenant scoping** - Always filter by tenantId
2. **Cache key collisions** - Include tenantId in all cache keys
3. **Skipping transaction locks** - Use advisory locks for booking creation
4. **Webhook replay attacks** - Check idempotency before processing
5. **Type safety bypass** - Never use `as any` - fix types instead
6. **Missing error handling** - Services throw domain errors, routes catch and map
7. **Direct Prisma in routes** - Always use services/repositories
8. **Hardcoded values** - Use config or environment variables

### Email Case-Sensitivity Prevention

```typescript
// ❌ WRONG - Case-sensitive lookup
const user = await prisma.user.findUnique({ where: { email } });

// ✅ CORRECT - Normalize to lowercase
const email = inputEmail.toLowerCase().trim();
const user = await prisma.user.findUnique({ where: { email } });
```

### Input Validation for Foreign Keys

```typescript
// ❌ WRONG - Don't validate ownership
if (data.packageId) {
  // Just get the package...
}

// ✅ CORRECT - Validate tenant ownership
if (data.packageId) {
  await catalogService.getPackageById(tenantId, data.packageId);
  // Throws if package doesn't belong to tenant
}
```

### Webhook Error Logging

```typescript
// ❌ WRONG - Store PII in persistent logs
await repo.markFailed(tenantId, id, JSON.stringify(result.error));

// ✅ CORRECT - Separate logging layers
logger.error({ errors: result.error.flatten() }, 'Validation failed'); // Ephemeral
await repo.markFailed(tenantId, id, 'Validation failed'); // Persistent (sanitized)
```

---

## 7. Development Workflow

### Environment Setup

```bash
# Mock mode (no external services)
ADAPTERS_PRESET=mock npm run dev:api

# Real mode (Stripe, Postmark, GCal)
ADAPTERS_PRESET=real npm run dev:api

# Both servers
npm run dev:all
```

### Database Operations

```bash
cd server

# Apply migrations
npm exec prisma migrate dev --name migration_name

# Reset database (dev only)
npm exec prisma migrate reset

# Open visual browser
npm exec prisma studio

# Seed test data
npm exec prisma db seed

# Create tenant
npm run create-tenant
```

### Code Quality

```bash
npm run typecheck      # TypeScript validation (all workspaces)
npm run lint           # ESLint
npm run format         # Prettier auto-fix
npm run format:check   # Prettier check only
npm run doctor         # Environment health check
```

---

## 8. Production Deployment

### Pre-Deployment Checklist

**Infrastructure:**

- [ ] Supabase project with connection pooling
- [ ] Upstash Redis instance (for caching)
- [ ] DNS records configured
- [ ] SSL certificates provisioned

**Database:**

```bash
cd server
npm exec prisma migrate deploy    # Apply all migrations
npm exec prisma db seed           # Seed initial data
```

**Environment Variables (Required):**

```bash
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=<64-char-hex>
TENANT_SECRETS_ENCRYPTION_KEY=<64-char-hex>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NODE_ENV=production
ADAPTERS_PRESET=real
```

**Environment Variables (Optional with Fallback):**

```bash
POSTMARK_SERVER_TOKEN=...         # Falls back to file-sink
GOOGLE_CALENDAR_ID=...             # Falls back to mock
REDIS_URL=rediss://...             # Enables caching
```

**Security Verification:**

- [ ] CSP directives reviewed
- [ ] Rate limiting enabled (5 attempts/15min/IP auth endpoints)
- [ ] Tenant secrets encryption secured
- [ ] API key format enforced (pk*live*)

**Performance Validation:**

- [ ] Redis caching enabled
- [ ] Database indexes applied (16 indexes)
- [ ] Load testing completed (100 concurrent users)
- [ ] Response times validated (<500ms p99 uncached)

### Post-Deployment Health Checks

```bash
# API health
curl https://app.maconaisolutions.com/health

# Cache health
curl https://app.maconaisolutions.com/health/cache

# Database connectivity
curl https://app.maconaisolutions.com/v1/packages \
  -H "X-Tenant-Key: pk_live_demo_..."
```

### Rollback Plan

1. Revert to previous Git commit
2. Reapply previous database migration if needed
3. Flush Redis cache if corrupted
4. Check Sentry for error patterns

---

## 9. Key Files Reference

### Architecture & Design

- **ARCHITECTURE.md** - System overview, multi-tenant patterns, deployment
- **DECISIONS.md** - ADRs (006 current, 001 superseded, 002-005 accepted)
- **TESTING.md** - Test strategy, E2E setup, commands
- **CLAUDE.md** - Global project guidelines, patterns, examples

### Multi-Tenant Implementation

- **docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md** - 6-phase rollout plan
- **docs/multi-tenant/MULTI_TENANT_READINESS_REPORT.md** - Architecture assessment

### Prevention & Quality

- **docs/solutions/PREVENTION-STRATEGIES-INDEX.md** - Complete reference index
- **docs/solutions/PREVENTION-QUICK-REFERENCE.md** - Cheat sheet
- **docs/solutions/COMPREHENSIVE-PREVENTION-STRATEGIES.md** - Full guide
- **docs/solutions/TEST-FAILURE-PREVENTION-STRATEGIES.md** - Flaky test patterns
- **docs/solutions/PRISMA-TYPESCRIPT-BUILD-PREVENTION.md** - Build error patterns

### Security & Monitoring

- **docs/security/SECRET_ROTATION_GUIDE.md** - Secret management
- **docs/solutions/E2E-TESTING-ADVANCED-PATTERNS.md** - Advanced test patterns

### Code

- **server/src/middleware/tenant.ts** - Tenant resolution
- **server/src/lib/ports.ts** - Repository/provider interfaces (tenantId required)
- **server/src/di.ts** - Dependency injection container
- **server/prisma/schema.prisma** - Database schema with multi-tenant fields

---

## 10. Current Sprint Status (Day 4 Complete)

### Completed (✅)

- **Backend MVP:** Tenant signup, password reset, Stripe Connect scaffolding
- **Frontend:** SignupPage, SignupForm, AuthContext integration
- **E2E Tests:** 21 new tests (tenant-signup + password-reset scenarios)
- **Total Tests:** 771 server + 21 E2E (100% pass rate)

### Day 5 Goals (Pending)

- Production deployment
- User documentation
- Monitoring setup

### Known Issues

- Pre-existing TypeScript compilation errors (Zod/ts-rest version mismatch, no runtime impact)
- 2 intermittent test failures under extreme load (rare, retry logic handles)

---

## 11. Implementation Priorities for MVP Gaps

### P0 (Critical - Unblock other work)

1. **Webhook Idempotency (ADR-002)** ✅ Accepted
   - Database DLQ pattern
   - Status tracking for manual recovery
   - Files: webhooks.routes.ts, webhook.repository.ts

2. **Advisory Locks (ADR-006)** ✅ Implemented
   - Replaces pessimistic locking (ADR-001)
   - Eliminates P2034 deadlock errors
   - Uses deterministic hash function

3. **100% Webhook Test Coverage (ADR-004)** ✅ Accepted
   - Unit + integration + contract tests
   - Signature verification, idempotency, error handling
   - CI/CD enforcement

4. **Multi-Tenant Isolation** ✅ Accepted
   - All queries filter by tenantId
   - Repository pattern enforcement
   - Cache key isolation

### P1 (Important - Needed for Phase 2)

1. **PaymentProvider Interface (ADR-005)** ✅ Implemented
2. **Admin Dashboard** - Phase 4 deliverable
3. **Widget SDK** - Phase 2 deliverable

### P2 (Nice-to-have)

1. **Secret History Rewrite (ADR-003)** - Pending
2. **Performance monitoring** - Phase 5 deliverable

---

## 12. Success Metrics

### Current Status (Sprint 10 Complete)

- **Test Pass Rate:** 100% (752/752 passing)
- **Test Coverage:** 70%+ (target met)
- **P2034 Errors:** 0 (fixed with ADR-006)
- **Security Issues:** Fixed all discovered (1 critical cache leak)
- **Performance:** <5% impact from multi-tenancy (target: <5%)

### Target Metrics for MVP Deployment

- Test pass rate: 100%
- Critical paths: 100% test coverage
- Zero cross-tenant data leaks
- Zero unhandled webhook failures
- <500ms response time (p99) uncached

---

## Summary

This research has documented:

1. **6 major ADRs** - Current guidance is ADR-006 (advisory locks), with ADR-001 superseded
2. **Multi-tenant architecture** - Complete implementation guide with 6-phase rollout
3. **Testing strategy** - Unit (70%+), integration, E2E patterns with new rate limit solutions
4. **Prevention patterns** - Comprehensive guides for security, performance, quality
5. **Concurrency control** - Three-layer defense against double-booking + webhook idempotency
6. **Deployment readiness** - Production checklist + health verification

**All resources point to implementation-ready patterns for MVP gap closure.**

---

**Maintainer:** Mike Young
**Last Updated:** 2025-12-02
**Status:** Complete - Ready for MVP Gap Implementation
