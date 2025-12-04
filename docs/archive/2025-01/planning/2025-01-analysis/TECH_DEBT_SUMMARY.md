# Technical Debt Summary - Quick Reference

## Critical Issues (Blocking Config Pivot)

### Issue 1: Hardcoded Environment Values

- **Files:** `app.ts`, `config.ts`, `di.ts`
- **Problem:** CORS origins, Stripe URLs, domain names hardcoded
- **Impact:** Cannot implement dynamic tenant-specific configurations
- **Fix:** Move to environment variables + database ConfigService
- **Effort:** 2-4 hours

### Issue 2: Type-Unsafe JSON Columns

- **Files:** `tenant-admin.routes.ts`, `stripe-connect.service.ts`
- **Problem:** 13+ instances of `as any` casting for JSON data
- **Impact:** No type safety for config/branding/photo data
- **Fix:** Create TypeScript types + Zod schemas + parser helpers
- **Effort:** 4-6 hours

---

## High Priority Issues (Operational Risk)

### Issue 3: Deprecated Dependencies

- **Package:** `node-cache@5.1.2` - **MEMORY LEAK RISK** ⚠️
- **Package:** `bcryptjs@3.0.2` - Deprecated (use bcrypt)
- **Fix:** Replace immediately before scaling
- **Effort:** 1-2 hours

### Issue 4: Missing Error Context

- **Files:** Multiple route handlers
- **Problem:** Generic error handling loses request context
- **Impact:** Cannot debug production issues effectively
- **Fix:** Add request ID + error context wrapper
- **Effort:** 3-4 hours

### Issue 5: Direct Prisma Access

- **File:** `tenant-admin.routes.ts:562`
- **Problem:** Routes bypass repository abstraction
- **Impact:** Tight coupling to database layer, hard to test
- **Fix:** Add repository methods
- **Effort:** 2-3 hours

### Issue 6: Magic Numbers & Constants

- **Files:** Throughout codebase
- **Problem:** File size limits, cache TTLs, rate limits hardcoded
- **Impact:** Cannot configure per-tenant, no A/B testing
- **Fix:** Create ConfigurationService
- **Effort:** 2-3 hours

---

## Medium Priority Issues (Maintainability)

### Issue 7: Duplicate Auth Logic

- **Pattern:** Repeated in 8+ places
- **Problem:** DRY violation, maintenance burden
- **Fix:** Create centralized auth middleware
- **Effort:** 3-4 hours

### Issue 8: Type-Unsafe Error Handlers

- **File:** `tenant-admin.routes.ts:49-54`
- **Problem:** `error: any` parameter, no type narrowing
- **Fix:** Add proper type unions and guards
- **Effort:** 2-3 hours

### Issue 9: Missing Refund Implementation

- **File:** `stripe.adapter.ts`
- **Problem:** Refunds throw "not implemented" error
- **Impact:** Cannot process refund requests
- **Fix:** Implement idempotent refund processor
- **Effort:** 2-3 hours

### Issue 10: No Request Correlation

- **Problem:** Cannot trace requests through system
- **Impact:** Difficult production debugging
- **Fix:** Add request ID middleware + correlation context
- **Effort:** 4-5 hours

---

## Low Priority Issues (Code Quality)

### Issue 11: Singleton Pattern for UploadService

- **File:** `upload.service.ts:236`
- **Problem:** Makes testing difficult
- **Fix:** Inject via DI container
- **Effort:** 1-2 hours

### Issue 12: Console Methods Not Using Logger

- **Locations:** 17 instances
- **Fix:** Replace with logger calls
- **Effort:** 1-2 hours

### Issue 13: Documentation Gaps

- **Missing:** Cache strategy, transaction rationale, error patterns
- **Fix:** Add inline documentation
- **Effort:** 2-3 hours

---

## Dependency Status

| Package    | Current | Latest | Status         | Action     |
| ---------- | ------- | ------ | -------------- | ---------- |
| node-cache | 5.1.2   | -      | **DEPRECATED** | ❌ REPLACE |
| bcryptjs   | 3.0.2   | -      | **DEPRECATED** | ⚠️ REPLACE |
| typescript | 5.3.3   | 5.9.3  | Outdated       | ℹ️ Update  |
| prisma     | 6.17.1  | 6.18.0 | Outdated       | ℹ️ Update  |
| vite       | 6.0.7   | 6.4.1  | Outdated       | ℹ️ Update  |

---

## Recommended Phase Implementation

### Phase 1: Critical (Week 1) - 8-10 hours

- [ ] Extract hardcoded environment values
- [ ] Fix JSON column type safety
- [ ] Replace node-cache with lru-cache

### Phase 2: High (Week 2) - 10-12 hours

- [ ] Create ConfigurationService
- [ ] Fix Prisma access patterns
- [ ] Centralize auth middleware

### Phase 3: Medium (Week 3) - 8-10 hours

- [ ] Add error context + request ID
- [ ] Implement refund logic
- [ ] Update deprecated dependencies

### Phase 4: Low (Week 4) - 4-6 hours

- [ ] Fix UploadService singleton
- [ ] Replace console with logger
- [ ] Add documentation

---

## Production Readiness Checklist

Before config-driven pivot, ensure:

- [ ] Zero hardcoded environment values
- [ ] All JSON columns type-safe
- [ ] ConfigurationService implemented
- [ ] No deprecated dependencies active
- [ ] All routes use centralized auth
- [ ] Error context in all error paths
- [ ] Request correlation IDs functional
- [ ] Refund logic implemented

---

## Quick Stats

| Metric                     | Value           |
| -------------------------- | --------------- |
| Total Tech Debt Items      | 13              |
| Critical (Pivot Blocking)  | 2               |
| High (Operational Risk)    | 4               |
| Medium (Maintainability)   | 5               |
| Low (Code Quality)         | 2               |
| **Total Estimated Effort** | **32-46 hours** |
| **Priority Timeline**      | **4 weeks**     |

---

## File Locations Reference

### Primary Files with Issues

**Hardcoded Values:**

- `/Users/mikeyoung/CODING/Elope/server/src/app.ts` - CORS whitelist
- `/Users/mikeyoung/CODING/Elope/server/src/di.ts` - Stripe URLs
- `/Users/mikeyoung/CODING/Elope/server/src/lib/core/config.ts` - Default values

**Type Safety Issues:**

- `/Users/mikeyoung/CODING/Elope/server/src/routes/tenant-admin.routes.ts` (5 instances)
- `/Users/mikeyoung/CODING/Elope/server/src/services/stripe-connect.service.ts` (3 instances)
- `/Users/mikeyoung/CODING/Elope/server/src/controllers/tenant-admin.controller.ts` (5 instances)

**Deprecated Dependencies:**

- `/Users/mikeyoung/CODING/Elope/server/src/lib/cache.ts` - Uses node-cache
- `/Users/mikeyoung/CODING/Elope/server/package.json` - bcryptjs dependency

**Other Issues:**

- `/Users/mikeyoung/CODING/Elope/server/src/adapters/stripe.adapter.ts` - Missing refund implementation
- `/Users/mikeyoung/CODING/Elope/server/src/adapters/prisma/booking.repository.ts` - Type-unsafe isolation level
- `/Users/mikeyoung/CODING/Elope/server/src/services/upload.service.ts` - Singleton pattern

---

## Next Steps

1. **Review** this audit with the team
2. **Prioritize** issues based on your timeline
3. **Schedule** Phase 1 work before config-driven pivot
4. **Track** progress using provided phase breakdown
5. **Reference** TECHNICAL_DEBT_AUDIT.md for detailed recommendations

**See:** `/Users/mikeyoung/CODING/Elope/TECHNICAL_DEBT_AUDIT.md` for full audit report
