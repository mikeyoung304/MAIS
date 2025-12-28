# MAIS Reliability Report: Tests, Observability & Error Handling

**Agent:** D1 - Tests, Reliability & Observability Audit
**Date:** 2025-12-26
**Scope:** 771 server tests, 114 E2E tests, observability infrastructure

---

## Executive Summary

The MAIS test suite is **mature and well-structured** with strong multi-tenant isolation testing, robust race condition coverage, and comprehensive error handling. Key strengths include the retry helper infrastructure for flaky tests and excellent integration test helpers.

**Overall Health:** GOOD with areas for improvement

| Category          | Status    | Priority Issues                                   |
| ----------------- | --------- | ------------------------------------------------- |
| Test Coverage     | ADEQUATE  | 6 untested services, 10+ untested routes          |
| Test Quality      | GOOD      | Minor flaky patterns, strong assertions           |
| Test Organization | EXCELLENT | Well-documented helpers, clear naming             |
| E2E Health        | GOOD      | Some brittle selectors, good edge cases           |
| Observability     | ADEQUATE  | Missing distributed tracing, sparse metrics       |
| Error Handling    | EXCELLENT | Comprehensive error hierarchy, Sentry integration |

---

## 1. Test Coverage Gaps

### 1.1 Untested Services (HIGH PRIORITY)

These services have business logic without dedicated unit tests:

| Service                     | File                                                                              | Risk Level                                        |
| --------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| `ReminderService`           | `/Users/mikeyoung/CODING/MAIS/server/src/services/reminder.service.ts`            | MEDIUM - Only referenced in scheduler.test.ts     |
| `PackageDraftService`       | `/Users/mikeyoung/CODING/MAIS/server/src/services/package-draft.service.ts`       | HIGH - Visual editor functionality                |
| `TenantOnboardingService`   | `/Users/mikeyoung/CODING/MAIS/server/src/services/tenant-onboarding.service.ts`   | MEDIUM - Only integration via auth-signup.test.ts |
| `DomainVerificationService` | `/Users/mikeyoung/CODING/MAIS/server/src/services/domain-verification.service.ts` | HIGH - DNS verification logic                     |
| `LandingPageService`        | `/Users/mikeyoung/CODING/MAIS/server/src/services/landing-page.service.ts`        | MEDIUM - Sanitization & draft logic               |
| `WebhookDeliveryService`    | `/Users/mikeyoung/CODING/MAIS/server/src/services/webhook-delivery.service.ts`    | HIGH - HMAC signing, delivery logic               |

**Recommendation:** Create dedicated test files for:

- `package-draft.service.spec.ts`
- `domain-verification.service.spec.ts`
- `webhook-delivery.service.spec.ts`

### 1.2 Untested Routes (MEDIUM PRIORITY)

No HTTP-level tests found for these route files:

| Route                   | File                                                                               | Critical? |
| ----------------------- | ---------------------------------------------------------------------------------- | --------- |
| Blackouts               | `/Users/mikeyoung/CODING/MAIS/server/src/routes/blackouts.routes.ts`               | LOW       |
| CSP Violations          | `/Users/mikeyoung/CODING/MAIS/server/src/routes/csp-violations.routes.ts`          | LOW       |
| Public Date Booking     | `/Users/mikeyoung/CODING/MAIS/server/src/routes/public-date-booking.routes.ts`     | HIGH      |
| Tenant Admin Deposits   | `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-deposits.routes.ts`   | MEDIUM    |
| Tenant Admin Domains    | `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-domains.routes.ts`    | HIGH      |
| Tenant Admin Reminders  | `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-reminders.routes.ts`  | LOW       |
| Public Balance Payment  | `/Users/mikeyoung/CODING/MAIS/server/src/routes/public-balance-payment.routes.ts`  | HIGH      |
| Stripe Connect Webhooks | `/Users/mikeyoung/CODING/MAIS/server/src/routes/stripe-connect-webhooks.routes.ts` | MEDIUM    |
| Tenant Admin Calendar   | `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-calendar.routes.ts`   | LOW       |
| Tenant Admin Webhooks   | `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-webhooks.routes.ts`   | MEDIUM    |

**Recommendation:** Prioritize HTTP tests for:

1. `public-date-booking.routes.ts` - Customer-facing booking flow
2. `tenant-admin-domains.routes.ts` - Domain verification API
3. `public-balance-payment.routes.ts` - Payment processing

---

## 2. Test Quality Audit

### 2.1 Flaky Test Patterns (MEDIUM PRIORITY)

Found timing-sensitive patterns that could cause intermittent failures:

#### setTimeout/delay Usage (9 files)

| File                                                                                   | Line    | Pattern                                                    | Risk                                   |
| -------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------- | -------------------------------------- |
| `/Users/mikeyoung/CODING/MAIS/server/test/integration/webhook-race-conditions.spec.ts` | 408-411 | `await new Promise((resolve) => setTimeout(resolve, 100))` | LOW - Used for Stripe retry simulation |
| `/Users/mikeyoung/CODING/MAIS/server/test/services/health-check.service.test.ts`       | 106-109 | `setTimeout(resolve, 10000)` inside mock                   | GOOD - Tests timeout behavior          |
| `/Users/mikeyoung/CODING/MAIS/server/test/services/health-check.service.test.ts`       | 368     | `await new Promise((resolve) => setTimeout(resolve, 10))`  | LOW - Ensures timestamp difference     |

**Analysis:** The timing patterns are **well-implemented**. The codebase uses proper retry helpers:

```typescript
// /Users/mikeyoung/CODING/MAIS/server/test/helpers/retry.ts
withConcurrencyRetry(); // Retries on SERIALIZABLE conflicts
withDatabaseRetry(); // Retries on transient DB errors
withTimingRetry(); // Retries on timing-related failures
```

### 2.2 Weak Assertion Patterns (LOW PRIORITY)

Found some assertions that don't verify specific values:

| File                                  | Line     | Issue                                   |
| ------------------------------------- | -------- | --------------------------------------- |
| Templates in `server/test/templates/` | Multiple | `.expect(200);` without body validation |

**Analysis:** Template files are examples, not active tests. Production tests have strong assertions.

### 2.3 Strong Test Patterns (GOOD)

The codebase demonstrates excellent testing practices:

1. **Race Condition Testing** (`/Users/mikeyoung/CODING/MAIS/server/test/integration/booking-race-conditions.spec.ts`)
   - Tests 10 concurrent booking attempts
   - Verifies exactly 1 succeeds, 9 fail
   - Validates database has single booking

2. **Webhook Idempotency** (`/Users/mikeyoung/CODING/MAIS/server/test/integration/webhook-race-conditions.spec.ts`)
   - Tests 20 simultaneous duplicate webhooks
   - Verifies only 1 booking created
   - Tests Stripe retry simulation

3. **Error Handler Coverage** (`/Users/mikeyoung/CODING/MAIS/server/test/middleware/error-handler.spec.ts`)
   - Maps all domain errors to HTTP codes
   - Tests logging levels (info vs error)
   - Verifies response format consistency

---

## 3. Test Organization & Isolation

### 3.1 Test Structure (EXCELLENT)

**File Organization:**

```
server/test/
  adapters/         # Repository tests (prisma, mock)
  controllers/      # Controller unit tests
  helpers/          # Test utilities (fakes, factories, retry)
  http/             # HTTP endpoint tests
  integration/      # Cross-cutting integration tests
  lib/              # Utility library tests
  middleware/       # Middleware unit tests
  prevention/       # Regression prevention tests
  repositories/     # Repository-specific tests
  security/         # Security-focused tests
  services/         # Service unit tests
  templates/        # Test templates for new code
```

### 3.2 Test Isolation Helpers (EXCELLENT)

**`/Users/mikeyoung/CODING/MAIS/server/test/helpers/integration-setup.ts`:**

```typescript
// Creates isolated tenants per test file
const ctx = setupCompleteIntegrationTest('my-test-file');

// Provides:
// - Unique tenant slugs per test file
// - Automatic cleanup via cascade delete
// - Cache isolation utilities
// - Package/AddOn factories
```

**Key Features:**

- `createMultiTenantSetup()` - Unique tenant IDs per test file (line 136-279)
- `PackageFactory` - Generates unique slugs with timestamps (line 325-378)
- `createCacheTestUtils()` - Validates tenant-scoped cache keys (line 304-319)
- Proper cleanup: Deletes `BookingAddOn` before cascade (line 187-215)

### 3.3 Missing Test Utilities

| Utility             | Status  | Recommendation                              |
| ------------------- | ------- | ------------------------------------------- |
| Test data factories | GOOD    | `PackageFactory`, `AddOnFactory` exist      |
| Database reset      | GOOD    | Uses `cleanupTenants()` pattern             |
| Mock services       | GOOD    | `FakeEventEmitter`, `FakePaymentProvider`   |
| API test client     | MISSING | Consider adding ts-rest test client wrapper |

---

## 4. E2E Test Health

### 4.1 Selector Strategy (GOOD)

**Data-testid Usage:** 38 occurrences across 5 files

| File                            | Usage                         | Quality                |
| ------------------------------- | ----------------------------- | ---------------------- |
| `storefront.spec.ts`            | `[data-testid^="tier-card-"]` | GOOD - Prefix matching |
| `early-access-waitlist.spec.ts` | `data-testid` selectors       | GOOD                   |
| `booking-mock.spec.ts`          | Mix of testid and role        | GOOD                   |
| `accessibility.spec.ts`         | Semantic selectors            | EXCELLENT              |

**Problematic Patterns Found:**

| File                                                           | Line    | Issue                                                         |
| -------------------------------------------------------------- | ------- | ------------------------------------------------------------- |
| `/Users/mikeyoung/CODING/MAIS/e2e/tests/booking-flow.spec.ts`  | 56-57   | `.rdp-day:not([data-hidden])` - CSS class dependency          |
| `/Users/mikeyoung/CODING/MAIS/e2e/tests/booking-flow.spec.ts`  | 65      | `.rdp-day_selected` - CSS class dependency                    |
| `/Users/mikeyoung/CODING/MAIS/e2e/tests/tenant-signup.spec.ts` | 280-287 | `button[aria-label*="Show password"]` - Brittle aria selector |

**Recommendation:** Add `data-testid` attributes to:

- Date picker components
- Password visibility toggle buttons

### 4.2 Error State Testing (GOOD)

**Covered Error Scenarios:**

- `/Users/mikeyoung/CODING/MAIS/e2e/tests/storefront.spec.ts:78-86` - Invalid tenant slug
- `/Users/mikeyoung/CODING/MAIS/e2e/tests/storefront.spec.ts:146-161` - API failure error state
- `/Users/mikeyoung/CODING/MAIS/e2e/tests/tenant-signup.spec.ts:206-261` - Duplicate email conflict

**Missing Error Scenarios:**

1. Network timeout handling
2. Partial page load failures
3. Session expiration during form submission

### 4.3 Edge Case Coverage (GOOD)

**Covered Edge Cases:**

- Mobile/tablet/desktop viewport testing (`storefront.spec.ts:274-323`)
- Legacy URL redirects (`storefront.spec.ts:326-341`)
- Broken image handling (`storefront.spec.ts:385-413`)
- Loading state verification (`storefront.spec.ts:129-161`)

---

## 5. Observability Audit

### 5.1 Logging Coverage (ADEQUATE)

**Logger Usage:**

- **556 logger calls** across 71 files
- **40 console.log/warn/error** calls (mostly in generated Prisma code)

**Structured Logging Pattern:**

```typescript
// /Users/mikeyoung/CODING/MAIS/server/src/lib/core/logger.ts
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Pretty printing in development
});

export function createRequestLogger(requestId: string): Logger {
  return logger.child({ requestId });
}
```

**Logging Gaps:**

| Area         | File                                 | Issue                               |
| ------------ | ------------------------------------ | ----------------------------------- |
| Scheduling   | `scheduling-availability.service.ts` | Uses `console.log` (line varies)    |
| Calendar     | `google-calendar.service.ts`         | Uses `console.warn` (2 occurrences) |
| Catalog      | `catalog.service.ts`                 | Uses `console.log` (2 occurrences)  |
| Availability | `availability.service.ts`            | Uses `console.warn` (1 occurrence)  |

**Recommendation:** Replace remaining `console.*` calls with structured logger.

### 5.2 Metrics Infrastructure (MINIMAL)

**Current State:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/metrics.routes.ts`

```typescript
// Only basic process metrics:
{
  uptime_seconds,
  memory_usage: process.memoryUsage(),
  cpu_usage: process.cpuUsage(),
}
```

**Missing Metrics:**

1. Request latency histograms (P50, P95, P99)
2. Booking success/failure rates
3. Webhook delivery success rates
4. Cache hit/miss ratios
5. Database connection pool stats
6. Rate limiter trigger counts

**Recommendation:** Add Prometheus-compatible metrics:

```typescript
// Suggested additions
- http_request_duration_seconds (histogram)
- booking_created_total (counter)
- webhook_delivery_total{status="success|failure"} (counter)
- cache_operations_total{type="hit|miss"} (counter)
```

### 5.3 Tracing Infrastructure (MISSING)

**Current State:** No distributed tracing found.

**Sentry Integration:**

- `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/sentry.ts`
- Captures exceptions with context
- Scrubs sensitive data from breadcrumbs
- 50% traces sample rate

**Missing:**

1. Request tracing (OpenTelemetry/Jaeger)
2. Cross-service correlation IDs
3. Database query tracing

**Recommendation:** Consider OpenTelemetry integration for production debugging.

---

## 6. Error Handling Audit

### 6.1 Error Hierarchy (EXCELLENT)

**Base Error Classes:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/`

```
AppError (base)
  DomainError (legacy alias)
  DatabaseError
  ExternalServiceError
  ConfigurationError
  FileSystemError
  NetworkError
  TimeoutError

HTTP Errors:
  BadRequestError (400)
  ValidationError (400)
  UnauthorizedError (401)
  ForbiddenError (403)
  NotFoundError (404)
  ConflictError (409)
  UnprocessableEntityError (422)
  TooManyRequestsError (429)
  InternalServerError (500)

Business Errors:
  BookingConflictError
  BookingLockTimeoutError
  PaymentError
  IdempotencyError
  WebhookValidationError
```

### 6.2 Error Handler Middleware (EXCELLENT)

**`/Users/mikeyoung/CODING/MAIS/server/src/middleware/error-handler.ts`:**

```typescript
// Key behaviors (lines 30-102):
1. Maps DomainError to HTTP status codes
2. Logs operational errors at info level
3. Logs non-operational errors at error level
4. Reports to Sentry for non-operational errors
5. Hides error details in production
6. Includes requestId in all responses
```

### 6.3 Error Reporting (GOOD)

**Sentry Configuration:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/sentry.ts`

```typescript
// Key features (lines 38-83):
- beforeSend: Filters health checks, 404/429 responses
- beforeBreadcrumb: Scrubs password/token/key/secret params
- 50% traces sample rate
- 10% profiles sample rate
```

### 6.4 Graceful Degradation Patterns

**Found:**

- `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/sentry.ts:31-35` - Sentry gracefully disabled without DSN
- Health check service caches results to prevent repeated failures
- File sink fallback for email when Postmark unavailable

**Missing:**

1. Circuit breaker pattern for external services
2. Retry with exponential backoff for transient failures
3. Fallback responses for degraded states

---

## 7. Recommendations by Priority

### P0 - Critical (Do First)

1. **Add tests for `DomainVerificationService`**
   - DNS verification logic untested
   - Security-critical functionality
   - File: `/Users/mikeyoung/CODING/MAIS/server/src/services/domain-verification.service.ts`

2. **Add tests for `WebhookDeliveryService`**
   - HMAC signature generation/verification
   - Outbound webhook delivery
   - File: `/Users/mikeyoung/CODING/MAIS/server/src/services/webhook-delivery.service.ts`

3. **Add HTTP tests for `public-date-booking.routes.ts`**
   - Customer-facing booking flow
   - Critical path for revenue

### P1 - High (This Sprint)

4. **Add HTTP tests for `public-balance-payment.routes.ts`**
   - Payment processing route
   - File: `/Users/mikeyoung/CODING/MAIS/server/src/routes/public-balance-payment.routes.ts`

5. **Add tests for `PackageDraftService`**
   - Visual editor draft/publish logic
   - File: `/Users/mikeyoung/CODING/MAIS/server/src/services/package-draft.service.ts`

6. **Replace console.log calls with logger**
   - 8 non-generated files using console.\*
   - Breaks structured logging

7. **Add data-testid to date picker components**
   - E2E tests rely on CSS classes
   - Brittle selectors in `booking-flow.spec.ts`

### P2 - Medium (Next Sprint)

8. **Add application metrics**
   - Request latency histograms
   - Business event counters
   - Cache hit/miss ratios

9. **Add HTTP tests for remaining routes**
   - `tenant-admin-domains.routes.ts`
   - `tenant-admin-webhooks.routes.ts`
   - `stripe-connect-webhooks.routes.ts`

10. **Add E2E tests for network timeout handling**
    - No coverage for timeout scenarios
    - Important for user experience

### P3 - Low (Backlog)

11. **Consider OpenTelemetry integration**
    - Distributed tracing for production debugging
    - Cross-service correlation

12. **Add circuit breaker pattern**
    - For external service calls
    - Prevent cascade failures

13. **Add ts-rest test client wrapper**
    - Reduce boilerplate in HTTP tests
    - Type-safe request/response validation

---

## 8. Test Command Quick Reference

```bash
# Run all server tests
npm test

# Run specific test file
npm test -- test/services/booking.service.test.ts

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## Appendix A: Files Reviewed

**Test Files (65 files):**

- `/Users/mikeyoung/CODING/MAIS/server/test/**/*.{test,spec}.ts`
- `/Users/mikeyoung/CODING/MAIS/e2e/tests/*.spec.ts`

**Source Files:**

- All services in `/Users/mikeyoung/CODING/MAIS/server/src/services/`
- All routes in `/Users/mikeyoung/CODING/MAIS/server/src/routes/`
- Error infrastructure in `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/`
- Logging in `/Users/mikeyoung/CODING/MAIS/server/src/lib/core/logger.ts`
- Metrics in `/Users/mikeyoung/CODING/MAIS/server/src/routes/metrics.routes.ts`

**Test Helpers:**

- `/Users/mikeyoung/CODING/MAIS/server/test/helpers/integration-setup.ts`
- `/Users/mikeyoung/CODING/MAIS/server/test/helpers/retry.ts`
- `/Users/mikeyoung/CODING/MAIS/server/test/helpers/fakes.ts`
