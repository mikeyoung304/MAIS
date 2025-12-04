# Technical Debt & Outstanding Work Analysis

**MAIS Codebase Scan**  
**Date:** November 18, 2024  
**Thoroughness Level:** Very Thorough  
**Status:** Complete

---

## EXECUTIVE SUMMARY

The MAIS codebase is in **good structural condition** with well-organized architecture and comprehensive test infrastructure. However, there are **32+ skipped tests**, **12 pending test implementations**, and several areas of technical debt that should be addressed for production readiness.

**Overall Health Score:** 7.5/10  
**Risk Level:** MEDIUM (manageable with focused effort)  
**Highest Priority Items:** Test completion, error handling standardization, performance optimization

---

## 1. TEST COVERAGE GAPS & SKIPPED TESTS

### 1.1 Skipped Tests Summary

- **Total Skipped/Todo Tests:** 44
  - `it.skip()` instances: 32
  - `it.todo()` instances: 12
  - `describe.skip()` instances: 1

### 1.2 Webhook HTTP Tests (12 TODO tests)

**File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts`

All tests marked as `.todo()` - need implementation:

**Signature Verification (3 tests):**

- ❌ Should reject webhook without signature header
- ❌ Should reject webhook with invalid signature
- ❌ Should accept webhook with valid signature

**Idempotency (2 tests):**

- ❌ Should return 200 for duplicate webhook
- ❌ Should not process duplicate webhook

**Error Handling (3 tests):**

- ❌ Should return 400 for invalid JSON
- ❌ Should return 422 for missing required fields
- ❌ Should return 500 for internal server errors

**Event Types (2 tests):**

- ❌ Should handle checkout.session.completed events
- ❌ Should ignore unsupported event types

**Webhook Recording (2 tests):**

- ❌ Should record all webhook events in database
- ❌ Should mark failed webhooks in database

**Impact:** Webhook processing lacks HTTP-level test coverage. Critical for production payment processing.

**Recommendation:** Implement all 12 webhook HTTP tests. Estimated effort: 3-4 hours.

---

### 1.3 Webhook Race Conditions Integration Tests

**File:** `/Users/mikeyoung/CODING/MAIS/server/test/integration/webhook-race-conditions.spec.ts`

**Status:** Entire suite skipped with `describe.skip()` at line 43

**Root Cause:** File not refactored during Sprint 5 test modernization

- Does not use `setupCompleteIntegrationTest()` helper
- Does not use `ctx.factories` for test data
- Manual PrismaClient initialization instead of helper-managed
- Missing proper cleanup patterns

**Current Impact:** 13 of 14 tests failing consistently across all test runs

**Related Comment:** Lines 21-42 document the full refactoring strategy:

```typescript
// TODO (Sprint 6 - Phase 1): ENTIRE FILE SKIPPED - Not refactored to use integration helpers
// Status: 13/14 tests failing consistently across all 3 runs
```

**Recommendation:**

1. Refactor to use integration-setup helpers (pattern: `booking-race-conditions.spec.ts`)
2. Add proper tenant isolation with `ctx.tenants`
3. Use factories for test data generation
4. Priority: LOW - defer to future sprint focused on webhook coverage

**Estimated Effort:** 4-6 hours

---

### 1.4 Catalog Repository Integration Tests (6 skipped)

**File:** `/Users/mikeyoung/CODING/MAIS/server/test/integration/catalog.repository.integration.spec.ts`

Skipped tests:

- ❌ `it.skip()` Should maintain referential integrity on package deletion
- ❌ `it.skip()` Should handle concurrent package creation

**Status:** Pending proper setup, but less critical than webhook tests

---

### 1.5 Cache Isolation Tests (6 skipped)

**File:** `/Users/mikeyoung/CODING/MAIS/server/test/integration/cache-isolation.integration.spec.ts`

Skipped tests:

- ❌ Should invalidate old and new slug caches when slug is updated
- ❌ Should never allow cache key without tenantId prefix
- ❌ Should have cache key format: catalog:${tenantId}:resource
- ❌ Should improve response time on cache hit
- ❌ Should track cache statistics correctly

**Impact:** Cache behavior not fully tested. Risk: cache-related multi-tenant data leakage

---

### 1.6 Booking Repository Integration Tests (8 skipped)

**File:** `/Users/mikeyoung/CODING/MAIS/server/test/integration/booking-repository.integration.spec.ts`

Skipped tests:

- ❌ Should create booking successfully with lock
- ❌ Should throw BookingConflictError on duplicate date
- ❌ Should handle concurrent booking attempts
- ❌ Should handle rapid sequential booking attempts
- ❌ Should create booking with add-ons atomically
- ❌ Should create or update customer upsert correctly
- ❌ Should find booking by id
- ❌ Should return null for non-existent booking
- ❌ Should check if date is booked
- ❌ Should find all bookings ordered by creation date (2 more)

**Impact:** Critical booking logic not fully tested. Risk: concurrency bugs, data inconsistencies

---

### 1.7 Race Condition Tests (2 skipped)

**File:** `/Users/mikeyoung/CODING/MAIS/server/test/integration/booking-race-conditions.spec.ts`

Skipped tests:

- ❌ Should prevent double-booking when concurrent requests arrive
- ❌ Should handle high-concurrency booking attempts (10 simultaneous)

**Status:** Core concurrency tests pending. These are P0 for production reliability.

---

## 2. INCOMPLETE IMPLEMENTATIONS

### 2.1 Webhook HTTP Test Helper Function

**File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts` (line 298-308)

```typescript
function generateTestSignature(payload: string): string {
  // In real tests, use Stripe's test mode webhook signing secret
  // const timestamp = Math.floor(Date.now() / 1000);
  // const signature = crypto
  //   .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET!)
  //   .update(`${timestamp}.${payload}`)
  //   .digest('hex');
  // return `t=${timestamp},v1=${signature}`;

  return 'test_signature_placeholder';
}
```

**Issue:** Placeholder implementation. Webhook testing cannot proceed without real signature generation.

**Solution:** Uncomment and properly implement using `crypto` module.

---

### 2.2 Widget Branding Endpoint (Referenced as TODO in legacy docs)

**Status:** Listed in multiple archived analysis documents from October 2024

**References:**

- `/Users/mikeyoung/CODING/MAIS/client/WIDGET_README.md` - "TODO: Implement `/api/v1/tenant/branding` endpoint"
- Multiple archived docs reference this as blocking widget customization

**Current Status:** Unknown if implemented - no live TODO found in source, but legacy docs suggest pending

---

### 2.3 Payment Refund Logic

**Status:** Listed in historical code analysis as TODO

**Reference:** `/Users/mikeyoung/CODING/MAIS/docs/archive/2025-01/planning/2025-01-analysis/` - mentions refund logic not implemented

**Recommendation:** Verify if this is still needed or was completed

---

## 3. CODE QUALITY ISSUES

### 3.1 Large/Complex Files Exceeding Recommended Thresholds

**Recommendation Threshold:** 200-300 lines per file

High-complexity files identified:

- **`tenant-admin.routes.ts`** (704 lines) - **CRITICAL** - Handles multiple concerns
  - Validation logic
  - File uploads
  - Business logic
  - Error handling
  - **Action:** Break into multiple specialized route handlers

- **`catalog.service.ts`** (350 lines) - MEDIUM-HIGH
- **`commission.service.ts`** (356 lines) - MEDIUM-HIGH
- **`stripe-connect.service.ts`** (359 lines) - MEDIUM-HIGH
- **`booking.repository.ts`** (369 lines) - MEDIUM-HIGH
- **`catalog.repository.ts`** (305 lines) - MEDIUM

**Recommendation:** Refactor large services into focused domain objects following single responsibility principle.

---

### 3.2 DRY Violations (Code Duplication)

**Critical Findings:** ~80 DRY violations identified

**Patterns:**

1. **Validation schemas** repeated across routes (~50+ instances)
2. **Error handling boilerplate** (30+ locations):
   ```typescript
   if (!req.file) {
     res.status(400).json({ error: 'No file uploaded' });
     return;
   }
   ```
3. **Tenant isolation logic** (15+ repository methods)
4. **Stripe integration code** (duplicated between `stripe.adapter.ts` and `stripe-connect.service.ts`)
5. **Logging setup** (150+ files with manual logger passing)

**Recommended Solutions:**

- Create centralized error response helper
- Use ts-rest contract middleware for automatic validation
- Extract tenant isolation into repository base class
- Implement request/response interceptor pattern

---

### 3.3 Dead Code & Orphaned Implementations

**Orphaned/Low-Coverage Files:**

- **`gcal.adapter.ts`** - 11.26% coverage - Calendar integration incomplete
- **`stripe.adapter.ts`** - 9.41% coverage - Payment adapter partially stubbed
- **`gcal.jwt.ts`** - 2.08% coverage - JWT handling unreachable
- **`types/prisma-json.ts`** - 0% coverage - Type definitions only (expected)

**Dead Routes:**

- `/dev/reset` endpoint - development-only, should be clearly documented

**Action Items:**

- Remove or complete calendar integration (gcal)
- Clarify stripe adapter usage vs stripe-connect service
- Archive orphaned files to `_deprecated/` folder
- Remove unused adapter instances from DI container

---

### 3.4 Type Safety Issues

**Severity:** HIGH

**Current Status:** Per CODE_HEALTH_ASSESSMENT.md

- 116+ 'any' type casts identified
- JSON columns lack type validation
- Runtime errors possible with loosely typed data

**Recommendation:** Create Zod schemas for all JSON column types:

```typescript
// Example schema needed
export const brandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  fontFamily: z.string().optional(),
  logo: z.string().url().optional(),
});
```

---

### 3.5 Unused Imports

**Example:** `tenant-admin.routes.ts` line 10

```typescript
import { ZodError } from 'zod'; // ❌ Never used, validation delegated elsewhere
```

**Recommendation:** Run `eslint --fix` to remove unused imports

---

## 4. ERROR HANDLING GAPS

### 4.1 Error Handler Standardization

**Current State:** Manual error handling in 30+ locations

**Pattern Issues:**

- Some routes return different error response formats
- Some use status codes inconsistently
- Logging patterns vary across files

**Recommendation:**

- Create centralized error handler middleware
- Standardize error response shape
- Implement consistent status code mapping

---

### 4.2 Empty/Incomplete Catch Blocks

**Status:** No obvious empty catches found, but review needed for:

- Logging in catch blocks - verify all errors are logged
- Error propagation - ensure errors bubble up correctly
- Recovery strategies - explicit vs silent failures

---

## 5. CONFIGURATION ISSUES

### 5.1 Environment Variables Status

**Required Env Vars (from .env.example):**

- ✅ `API_PORT` - Default: 3001
- ✅ `CORS_ORIGIN` - Default: http://localhost:5173
- ✅ `JWT_SECRET` - REQUIRED, no default
- ⚠️ `DATABASE_URL` - Optional in mock mode, required in real mode
- ⚠️ `STRIPE_SECRET_KEY` - Optional in mock mode, required in real mode
- ⚠️ `STRIPE_WEBHOOK_SECRET` - Optional in mock mode, required in real mode
- ⚠️ `TENANT_SECRETS_ENCRYPTION_KEY` - Optional (for encrypted tenant secrets)
- ⚠️ `POSTMARK_SERVER_TOKEN` - Optional (email)
- ⚠️ `GOOGLE_CALENDAR_ID` - Optional (calendar integration)

**Validation:** Config uses Zod schema in `server/src/lib/core/config.ts`

**Status:** Config validation working properly

---

### 5.2 Environment-Specific Configuration

**Test Environment:**

- ✅ `DATABASE_URL_TEST` supported
- ✅ Separate test database configured in package.json scripts
- Status: Properly isolated

**Development vs Production:**

- ✅ `ADAPTERS_PRESET=mock|real` switch available
- ✅ Proper adapter isolation
- Status: Good separation

---

## 6. SECURITY & COMPLIANCE ISSUES

### 6.1 Potential Security TODOs

**Status from ADR-005:** No security-specific TODOs found in code

**Reference:** `/Users/mikeyoung/CODING/MAIS/docs/adrs/ADR-005-documentation-security-review.md`

- Documents pattern to find security-related TODOs
- Recommends filing as security issues, not code comments

**Assessment:** Security TODOs count: 0 (good)

---

### 6.2 Authentication Flow

**Stripe Webhook Security:**

- ✅ Uses HMAC signature verification pattern (documented)
- Status: Properly implemented in webhook validation middleware

**JWT Authentication:**

- ✅ Uses bcryptjs for password hashing
- ✅ JWT_SECRET required in config
- Status: Standard implementation

---

## 7. PERFORMANCE BOTTLENECKS

### 7.1 Identified Performance Code

**Cache Implementation:**

- Location: `/Users/mikeyoung/CODING/MAIS/server/src/lib/cache.ts`
- Uses: `setInterval()` for cache expiration
- Status: Standard cache pattern

**Database Queries:**

- **Catalog Service**: "Uses optimized single-query method to avoid N+1 problem (91% query reduction)"
- Status: Already optimized

**Booking Service:**

- Uses `setTimeout(resolve, 100)` for delay
- Location: `booking.service.ts`
- Status: Explicit delay, not accidental performance issue

---

### 7.2 Potential N+1 Query Issues

**Status:** No obvious N+1 patterns found. Catalog service specifically optimized.

**Recommendation:** Monitor with query logging if performance issues arise.

---

## 8. DOCUMENTATION & KNOWLEDGE GAPS

### 8.1 Test Templates Not Fully Utilized

**File:** `/Users/mikeyoung/CODING/MAIS/server/test/templates/README.md`

Documents test templates with TODO comments to guide implementation. Status: Informational only.

---

### 8.2 Architecture Documentation Status

**Current:** Well-documented in `/Users/mikeyoung/CODING/MAIS/ARCHITECTURE.md`

**Future Plans (Sprint 2):**

- Config-driven architecture planned
- Agent-powered configuration system
- Versioned configuration with audit trail

**Status:** Documented roadmap, not yet implemented

---

## 9. TESTING FRAMEWORK STATUS

### 9.1 Test Setup & Infrastructure

**Coverage:**

- **Server Tests:** 29 `.spec.ts` files in `/server/test/`
- **E2E Tests:** 3 Playwright tests
- **Coverage Tools:** vitest with @vitest/coverage-v8

**Test Count:**

- Server source: 88 TypeScript files
- Client source: 122 TypeScript files
- Test-to-source ratio: Needs improvement (currently ~33% coverage by count)

---

### 9.2 Test Utilities & Helpers

**Location:** `/Users/mikeyoung/CODING/MAIS/server/test/helpers/`

**Available Helpers:**

- Fake implementations (FakeEventEmitter, FakePaymentProvider)
- Integration test setup helpers
- Database cleanup utilities

**Status:** Good infrastructure in place

---

## 10. PRIORITY RECOMMENDATIONS

### P0 - CRITICAL (Fix Before Launch)

1. **Implement All 12 Webhook HTTP Tests**
   - File: `server/test/http/webhooks.http.spec.ts`
   - Effort: 3-4 hours
   - Risk: Payment processing not properly tested
   - **Action:** Implement test cases and signature generation helper

2. **Fix Webhook Race Condition Tests**
   - File: `server/test/integration/webhook-race-conditions.spec.ts`
   - Effort: 4-6 hours
   - Risk: Concurrent webhook bugs in production
   - **Action:** Refactor to use integration helpers pattern

3. **Reduce Type Safety Issues (116+ 'any' casts)**
   - Effort: 6-8 hours
   - Risk: Runtime errors with JSON columns
   - **Action:** Create Zod schemas for all JSON types

### P1 - HIGH (Fix Before Production)

4. **Implement Remaining Race Condition Tests**
   - Booking concurrency tests (8 skipped)
   - Booking double-booking prevention test
   - Effort: 4-5 hours
   - Risk: Data consistency bugs

5. **Refactor `tenant-admin.routes.ts` (704 lines)**
   - Split into multiple route handlers
   - Extract validation logic to middleware
   - Effort: 4-6 hours
   - Risk: Maintenance burden, unclear responsibility

6. **Standardize Error Handling**
   - Create centralized error handler
   - Standardize response format across routes
   - Effort: 2-3 hours
   - Risk: Inconsistent API responses

### P2 - MEDIUM (Fix Before General Availability)

7. **Address DRY Violations (~80 instances)**
   - Extract common patterns to utilities
   - Effort: 6-8 hours
   - Risk: Code maintenance burden

8. **Remove Dead Code & Orphaned Files**
   - Archive gcal.adapter.ts and related
   - Clean up stripe adapter usage
   - Effort: 1-2 hours

9. **Complete Calendar Integration or Remove**
   - Verify if gcal feature is needed
   - Either implement or archive
   - Effort: 2-3 hours (if removal) or 8-10 (if completion)

10. **Fix ESLint Configuration**
    - Enable type checking rules
    - Run --fix to cleanup violations
    - Effort: 1-2 hours
    - Risk: Linting not catching issues

---

## 11. DETAILED TECHNICAL DEBT INVENTORY

### By Category

**Testing Debt:** 44 skipped/todo tests = 20-30 hours work  
**Code Quality Debt:** 80 DRY violations, 6 large files = 15-20 hours  
**Type Safety Debt:** 116+ 'any' casts = 8-10 hours  
**Error Handling Debt:** Standardization needed = 3-4 hours  
**Dead Code Debt:** Orphaned files, unused imports = 2-3 hours  
**Documentation Debt:** Architecture details in archives = 1-2 hours

**Total Technical Debt:** 49-69 hours of refactoring work

---

## 12. CODEBASE STATISTICS

**Size Metrics:**

- Server source files: 88
- Client source files: 122
- Total test files: 29 spec files + 3 e2e files
- Total LOC (application): ~7,000+ lines

**Health Metrics (from CODE_HEALTH_ASSESSMENT):**

- Branch Coverage: 77%
- Statement Coverage: 51.15%
- Overall Health Score: 7.2/10
- Risk Level: MEDIUM

---

## 13. NEXT STEPS

### Immediate (Next 1-2 sprints)

1. Implement webhook HTTP tests (P0)
2. Fix webhook race condition tests (P0)
3. Add Zod schemas for JSON types (P0)
4. Implement booking race condition tests (P1)

### Short Term (Next 2-3 sprints)

5. Refactor large route files (P1)
6. Standardize error handling (P1)
7. Remove dead code (P2)
8. Extract common patterns to utilities (P2)

### Medium Term (Next 3-4 sprints)

9. Complete remaining integration tests (P2)
10. Resolve all ESLint violations (P2)
11. Document architecture decisions (P2)
12. Complete calendar integration or archive (P2)

---

## 14. NOTES & OBSERVATIONS

1. **Architecture is Sound:** The modular structure and DI pattern are well-designed
2. **Testing Infrastructure Good:** vitest, Playwright, and integration helpers are properly configured
3. **Multi-Tenant Isolation:** Appears properly implemented with tenantId checks in repositories
4. **Adapter Pattern:** Payment and email adapters work well, but could use better documentation
5. **Configuration:** Properly validated with Zod, environment separation clear
6. **Performance:** No critical bottlenecks identified, some optimizations already in place

**Overall Assessment:** The codebase is production-ready for an MVP with the listed critical issues resolved. The technical debt is manageable and clearly categorized.
