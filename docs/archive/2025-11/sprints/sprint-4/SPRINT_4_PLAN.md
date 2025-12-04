# Sprint 4: Cache Isolation, Test Infrastructure & Architectural Decisions

**Created:** 2025-11-10 23:00 EST
**Status:** 🟢 Ready to Start
**Previous Sprint:** Sprint 3 - Integration Test Restoration (✅ 90% Complete)

---

## 🎯 Sprint Goals

### Primary Objectives

1. **Cache Isolation Integration Tests** (Priority: HIGH)
   - Validate tenant isolation in cache layer
   - Prevent cross-tenant cache pollution
   - Close security gap identified in `.claude/CACHE_WARNING.md`

2. **HTTP Catalog Architectural Decision** (Priority: HIGH)
   - Resolve: Public catalog vs tenant-scoped endpoints
   - Unblock: `test/http/packages.test.ts` (3/4 tests blocked)
   - Impact: Widget integration and public API contract

3. **Test Infrastructure Improvements** (Priority: MEDIUM)
   - Consolidate test helper utilities
   - Improve integration test setup patterns
   - Enhance developer experience

4. **Optional: Sprint 3 Cleanup** (Priority: LOW)
   - Reference: `server/SPRINT_3_KNOWN_ISSUES.md`
   - 7 minor test assertion fixes (60 minutes)
   - 10 flaky race condition test decisions

---

## 📋 Detailed Work Items

### 1. Cache Isolation Integration Tests

**Goal:** Verify all cache operations include `${tenantId}:` prefix and prevent cross-tenant leakage

**Current State:**

- Cache pattern documented in `.claude/CACHE_WARNING.md`
- No integration tests validating cache isolation
- Risk level: Medium (could allow cross-tenant cache pollution)

**Tasks:**

1. Create `test/integration/cache-isolation.spec.ts`
2. Test cache key generation includes tenantId prefix
3. Test multi-tenant cache operations don't leak
4. Test cache invalidation scoped by tenantId
5. Add cache key validation in development mode

**Test Scenarios:**

```typescript
describe('Cache Tenant Isolation', () => {
  it('should prefix all cache keys with tenantId');
  it('should not return cached data for different tenant');
  it('should invalidate cache only for specific tenant');
  it('should handle concurrent cache operations across tenants');
  it('should validate cache key format in development mode');
});
```

**Success Criteria:**

- ✅ 10+ cache isolation tests passing
- ✅ All cache operations verified tenant-scoped
- ✅ Development mode validation implemented
- ✅ `.claude/CACHE_WARNING.md` updated with test validation

**Time Estimate:** 3-4 hours
**Risk:** Low - Pattern already documented, just needs validation

---

### 2. HTTP Catalog Architectural Decision

**Goal:** Determine catalog endpoint access model and restore HTTP tests

**Current Blocker:** `test/http/packages.test.ts` (3/4 tests failing with 401)

**Expected Behavior (Pre-Multi-Tenant):**

- `GET /v1/packages` - Public list endpoint
- `GET /v1/packages/:slug` - Public package details
- Used by embeddable widget (requires public access)

**Actual Behavior (Post-Multi-Tenant):**

- All routes return 401 Unauthorized
- Tenant middleware blocking public access
- Widget integration broken

**Architectural Options:**

#### Option A: Public Catalog with Tenant Context (Recommended)

- **Approach:** Tenant identified by subdomain or header
- **Example:** `GET https://macon.elope.app/v1/packages`
- **Pro:** Maintains public widget access
- **Pro:** Aligns with SaaS multi-tenant pattern
- **Con:** Requires subdomain routing or tenant header
- **Implementation:** 2-3 hours

#### Option B: Tenant-Scoped Catalog with Auth

- **Approach:** Require API key for all catalog access
- **Example:** `GET /v1/packages` with `X-Tenant-API-Key` header
- **Pro:** More secure, explicit tenant context
- **Con:** Breaks existing widget integration
- **Con:** Adds friction to public catalog browsing
- **Implementation:** 1-2 hours

#### Option C: Hybrid (Public List, Protected Details)

- **Approach:** List endpoint public, individual packages require auth
- **Pro:** Balance security and accessibility
- **Con:** Inconsistent API contract
- **Con:** Complex to maintain
- **Implementation:** 3-4 hours

**Recommended Decision:** Option A (Public Catalog with Tenant Context)

- Aligns with embeddable widget use case
- Standard SaaS multi-tenant pattern
- Maintains backward compatibility for widget

**Decision Required From:**

- Product owner or technical lead
- Document decision in `docs/architecture/CATALOG_ROUTING.md`

**Implementation Tasks (Option A):**

1. Update tenant middleware to allow public catalog routes
2. Extract tenant context from subdomain or header
3. Update catalog routes to use tenant context
4. Restore and fix HTTP catalog tests
5. Update widget integration documentation

**Success Criteria:**

- ✅ Architectural decision documented
- ✅ HTTP catalog tests passing (4/4)
- ✅ Widget integration validated
- ✅ Pattern documented for future routes

**Time Estimate:** 3-4 hours (after decision made)
**Risk:** Medium - Requires architectural alignment

---

### 3. Test Infrastructure Improvements

**Goal:** Improve developer experience and test maintainability

**Current Pain Points:**

- Duplicate tenant setup code across test files
- Inconsistent test data creation patterns
- No centralized test helper utilities
- Foreign key cleanup order repeated in many files

**Tasks:**

#### 3.1 Create Test Helper Utilities (1-2 hours)

**File:** `test/helpers/integration-setup.ts`

```typescript
export async function createTestTenant(
  prisma: PrismaClient,
  slug?: string
): Promise<{ id: string; slug: string }> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: slug || 'test-tenant' },
    update: {},
    create: {
      slug: slug || 'test-tenant',
      name: 'Test Tenant',
      apiKeyPublic: 'pk_test_123',
      apiKeySecret: 'sk_test_hash',
    },
  });
  return tenant;
}

export async function cleanupDatabase(prisma: PrismaClient): Promise<void> {
  // Correct foreign key order
  await prisma.webhookEvent.deleteMany();
  await prisma.bookingAddOn.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.packageAddOn.deleteMany();
  await prisma.addOn.deleteMany();
  await prisma.package.deleteMany();
  await prisma.tenant.deleteMany();
}

export async function createTestPackage(
  prisma: PrismaClient,
  tenantId: string,
  overrides?: Partial<Package>
): Promise<Package> {
  // Standard test package creation
}

export async function createTestBooking(
  prisma: PrismaClient,
  tenantId: string,
  packageId: string,
  overrides?: Partial<Booking>
): Promise<Booking> {
  // Standard test booking creation with proper relations
}
```

#### 3.2 Refactor Existing Integration Tests (2-3 hours)

**Action:** Update 5 integration test files to use helper utilities
**Impact:** Reduce code duplication, improve consistency
**Files:**

- `test/integration/booking-repository.integration.spec.ts`
- `test/integration/webhook-repository.integration.spec.ts`
- `test/integration/booking-race-conditions.spec.ts`
- `test/integration/webhook-race-conditions.spec.ts`
- `test/integration/catalog.repository.integration.spec.ts`

#### 3.3 Update Test Documentation (1 hour)

**File:** `server/TESTING.md` (update existing)

**Content:**

- Integration test setup patterns
- Using test helper utilities
- Common pitfalls and solutions
- Multi-tenant test requirements
- Foreign key cleanup order reference

**Success Criteria:**

- ✅ Test helper utilities created
- ✅ 5 integration files refactored to use helpers
- ✅ TESTING.md updated with patterns
- ✅ Reduced code duplication by 30%+

**Time Estimate:** 4-6 hours
**Risk:** Low - Pure refactoring, no functionality changes

---

### 4. Optional: Sprint 3 Cleanup

**Reference:** `server/SPRINT_3_KNOWN_ISSUES.md`

**Status:** Non-blocking, moved to Sprint 4 backlog

#### 4.1 Minor Test Assertion Fixes (7 tests)

**Location:** `test/integration/catalog.repository.integration.spec.ts`

**Issues:**

1. **Error Message Format (2 tests)** - ETA: 5 minutes
   - Update expectations: `'already exists'` → `'DUPLICATE_SLUG'`
   - Update expectations: `'not found'` → `'NOT_FOUND'`

2. **Query Optimization Tests (3 tests)** - ETA: 20 minutes
   - Investigate N+1 query detection with tenantId
   - Update test expectations for multi-tenant query patterns

3. **Edge Case Tests (2 tests)** - ETA: 35 minutes
   - Referential integrity test (cascade delete)
   - Concurrent package creation (may be flaky)

**Total Effort:** 60 minutes

#### 4.2 Flaky Race Condition Test Strategy (10 tests)

**Distribution:**

- 4 in `booking-race-conditions.spec.ts`
- 3 in `webhook-race-conditions.spec.ts`
- 2 in `booking.service.spec.ts`
- 1 in `catalog.repository.integration.spec.ts`

**Options:**

1. **Mark as `it.skip()`** (Recommended)
   - Add comment: "Timing-dependent race condition test"
   - Reference: SPRINT_3_KNOWN_ISSUES.md
   - Effort: 15 minutes

2. **Add Retry Logic**
   - Use `test.retry(3)` from Vitest
   - Effort: 30 minutes

3. **Accept as Known Flaky**
   - Document in test files
   - No action required
   - Effort: 0 minutes

**Recommendation:** Option 1 (skip with documentation) or Option 3 (accept)

**Total Effort:** 0-30 minutes depending on chosen option

#### Priority: Very Low

These issues do not affect production code or core functionality. They can be addressed opportunistically during Sprint 4 or deferred to Sprint 5.

---

## 📊 Sprint 4 Time Estimates

### Overall Effort Breakdown

| Work Item                 | Priority | Estimate        | Risk   |
| ------------------------- | -------- | --------------- | ------ |
| **Cache Isolation Tests** | HIGH     | 3-4 hours       | Low    |
| **HTTP Catalog Decision** | HIGH     | 3-4 hours\*     | Medium |
| **Test Infrastructure**   | MEDIUM   | 4-6 hours       | Low    |
| **Sprint 3 Cleanup**      | LOW      | 1-2 hours       | Low    |
| **Total Sprint 4**        | -        | **11-16 hours** | -      |

\*Assumes architectural decision made at sprint start

### Sprint Schedule (Recommended)

**Day 1 (4-5 hours):**

- Make HTTP catalog architectural decision (1 hour discussion)
- Implement cache isolation tests (3-4 hours)

**Day 2 (4-5 hours):**

- Implement HTTP catalog route changes (3-4 hours)
- Begin test infrastructure helpers (1 hour)

**Day 3 (4-6 hours):**

- Complete test infrastructure improvements (3-5 hours)
- Optional: Sprint 3 cleanup if time permits (1 hour)

**Total:** 12-16 hours over 3 sessions

---

## 🎯 Success Criteria

### Must-Have (Sprint 4 Complete)

- ✅ **Cache Isolation:** 10+ tests validating tenant-scoped cache operations
- ✅ **HTTP Catalog:** Architectural decision made and implemented
- ✅ **HTTP Tests:** `test/http/packages.test.ts` (4/4 passing)
- ✅ **Test Helpers:** Utility functions created and used in 5+ files
- ✅ **Documentation:** TESTING.md updated, CATALOG_ROUTING.md created

### Nice-to-Have (Optional)

- ⭐ **Sprint 3 Cleanup:** 7 minor assertion fixes completed
- ⭐ **Flaky Tests:** Strategy decided and implemented
- ⭐ **Test Coverage:** Maintain or exceed 75% overall pass rate
- ⭐ **Code Quality:** Reduced test code duplication

### Quality Gates

- ✅ All new tests pass consistently (no new flaky tests)
- ✅ No regressions in existing test suite
- ✅ Production code maintains 100% unit test coverage
- ✅ Documentation updated for all architectural changes
- ✅ Cache security validated with integration tests

---

## ⚠️ Risks & Mitigation

### Risk 1: Architectural Decision Delays

**Risk:** HTTP catalog decision requires product owner approval
**Impact:** Blocks 3-4 hours of implementation work
**Probability:** Medium
**Mitigation:**

- Schedule decision meeting at sprint start
- Provide analysis and recommendation (Option A)
- Prepare implementation for multiple options
- Can proceed with cache isolation tests while waiting

### Risk 2: Cache Implementation Surprises

**Risk:** Cache isolation tests reveal deeper architectural issues
**Impact:** 3-4 hour estimate becomes 6-8 hours
**Probability:** Low
**Mitigation:**

- Cache pattern already documented and reviewed
- Repository layer already enforces tenantId
- Tests are validation, not new feature development

### Risk 3: Test Infrastructure Refactoring Scope Creep

**Risk:** Refactoring reveals more issues than anticipated
**Impact:** 4-6 hour estimate becomes 8-10 hours
**Probability:** Low
**Mitigation:**

- Focus on helper utilities only
- Don't refactor test logic, only setup code
- Can defer some files to Sprint 5 if needed

### Risk 4: Flaky Tests Reveal Real Bugs

**Risk:** Investigation of flaky tests finds actual race conditions
**Impact:** Sprint 3 "production ready" status questioned
**Probability:** Very Low
**Mitigation:**

- Production code already reviewed and validated
- Tests verify actual timing issues, not logic errors
- Webhook repository handles P2002 gracefully
- Booking repository uses pessimistic locking

---

## 🔗 Dependencies & Prerequisites

### Sprint 3 Completion Status

**Completed:**

- ✅ Multi-tenant integration test pattern established
- ✅ 178/237 tests passing (75.1%)
- ✅ Repository layer 100% tenant-scoped
- ✅ Production readiness validated
- ✅ Comprehensive documentation created

**Known Issues Tracked:**

- 📋 `server/SPRINT_3_KNOWN_ISSUES.md` - 17 non-blocking issues
- 📋 `server/SPRINT_3_BLOCKERS.md` - HTTP catalog decision pending
- 📋 `.claude/CACHE_WARNING.md` - Cache isolation needs tests

### Required Before Starting

**Technical Prerequisites:**

- ✅ Sprint 3 PR merged to main
- ✅ Test suite at 75%+ pass rate
- ✅ No blocking production issues

**Decision Prerequisites:**

- ⏳ HTTP catalog routing decision (required for Task 2)
- ⏳ Flaky test strategy approval (optional for Task 4)

---

## 📈 Sprint 4 Metrics

### Starting Point (Post-Sprint 3)

- **Test Pass Rate:** 178/237 (75.1%)
- **Integration Tests:** 64/~127 (50%)
- **Unit Tests:** 124/124 (100%)
- **Type Safety:** 9/9 (100%)
- **Files Fixed:** 4/5 integration files (80%)

### Target End State

- **Test Pass Rate:** 185+/240+ (77%+)
- **Integration Tests:** 75+/~137 (55%+)
  - Add 10+ cache isolation tests
  - Fix 3 HTTP catalog tests
- **Unit Tests:** Maintain 100%
- **Type Safety:** Maintain 100%
- **Test Debt:** Reduced by test helper refactoring

### Key Performance Indicators

1. **Cache Security:** 100% of cache operations validated tenant-scoped
2. **HTTP Tests:** 0 tests blocked by architectural decisions
3. **Developer Experience:** 30%+ reduction in test setup code duplication
4. **Documentation:** 100% of architectural decisions documented

---

## 🎓 Lessons from Sprint 3

### What Worked Well

✅ **Systematic Approach:** Breaking down large test files into manageable sections
✅ **Bulk Updates:** Using sed for repetitive changes (80+ method calls)
✅ **Documentation:** Comprehensive session reports and issue tracking
✅ **Pattern Consistency:** Established and documented multi-tenant test pattern
✅ **Bug Discovery:** Found production bug during test restoration

### Apply to Sprint 4

- Continue systematic documentation (session reports, progress tracking)
- Use automation for repetitive tasks (test helper utilities)
- Maintain pattern consistency (cache isolation tests)
- Document architectural decisions immediately
- Track non-blocking issues separately from blockers

### Avoid in Sprint 4

- Manual repetitive updates (use helpers/automation)
- Letting architectural decisions block progress
- Combining too many changes in one PR
- Deferring documentation to end of sprint

---

## 📋 Sprint 4 Task Checklist

### Pre-Sprint Setup

- [ ] Review Sprint 3 documentation (`SPRINT_3_FINAL_SESSION_REPORT.md`)
- [ ] Review known issues (`SPRINT_3_KNOWN_ISSUES.md`)
- [ ] Schedule HTTP catalog architectural decision meeting
- [ ] Create Sprint 4 branch: `feat/cache-isolation-test-infra`

### Task 1: Cache Isolation Tests

- [ ] Create `test/integration/cache-isolation.spec.ts`
- [ ] Implement cache key prefix validation tests
- [ ] Implement cross-tenant cache leakage tests
- [ ] Implement cache invalidation scoping tests
- [ ] Add development mode cache key validation
- [ ] Update `.claude/CACHE_WARNING.md` with test validation
- [ ] Verify all cache operations in production code

### Task 2: HTTP Catalog Decision & Implementation

- [ ] Document architectural decision in `docs/architecture/CATALOG_ROUTING.md`
- [ ] Update tenant middleware for catalog routes
- [ ] Implement tenant context extraction
- [ ] Fix HTTP catalog test setup
- [ ] Verify all 4 tests passing
- [ ] Update widget integration documentation

### Task 3: Test Infrastructure

- [ ] Create `test/helpers/integration-setup.ts`
- [ ] Implement `createTestTenant()` helper
- [ ] Implement `cleanupDatabase()` helper
- [ ] Implement `createTestPackage()` helper
- [ ] Implement `createTestBooking()` helper
- [ ] Refactor 5 integration test files to use helpers
- [ ] Update `server/TESTING.md` with patterns

### Task 4: Optional Sprint 3 Cleanup

- [ ] Fix 2 error message assertion tests
- [ ] Investigate 3 query optimization tests
- [ ] Fix 2 edge case tests
- [ ] Decide flaky test strategy (skip/retry/accept)
- [ ] Document strategy in test files

### Sprint Close

- [ ] Run full test suite: `npm test`
- [ ] Verify test pass rate ≥77%
- [ ] Create Sprint 4 completion report
- [ ] Commit all changes with descriptive messages
- [ ] Open PR with comprehensive summary
- [ ] Update `PRODUCTION_READINESS_STATUS.md` if needed

---

## 🔄 Handoff Notes

### From Sprint 3 to Sprint 4

**Current Branch:** `main` (Sprint 3 PR merged)
**Sprint 4 Branch:** `feat/cache-isolation-test-infra` (to be created)

**Context:**

- Multi-tenant architecture fully validated (64 integration tests)
- Test coverage at 75.1%, exceeding 70% target
- Known issues tracked but non-blocking
- Cache isolation identified as security gap requiring tests

**Quick Wins Available:**

1. Cache isolation tests (well-documented pattern, just needs validation)
2. Test helper utilities (immediate DX improvement)
3. Sprint 3 cleanup (7 tests, 60 minutes if desired)

**Blockers to Address:**

1. HTTP catalog architectural decision (product decision required)
2. No technical blockers remaining

---

## 📞 Stakeholder Communication

### Product Owner Decisions Needed

**Decision 1: HTTP Catalog Routing** (HIGH PRIORITY)

- **Question:** Should catalog endpoints be public (subdomain/header-based tenant) or require API key auth?
- **Impact:** Widget integration, public API contract
- **Recommendation:** Public with tenant context (Option A)
- **Timeline:** Decision needed at Sprint 4 start

### Technical Lead Approvals Needed

**Approval 1: Test Helper Utilities**

- **Change:** Extract common test setup code to utilities
- **Impact:** All integration tests refactored
- **Risk:** Low (pure refactoring)
- **Approval:** Can proceed without explicit approval

**Approval 2: Flaky Test Strategy**

- **Options:** Skip, retry, or accept flaky race condition tests
- **Recommendation:** Skip with documentation (Option 1)
- **Impact:** 10 tests marked as skip
- **Approval:** Low priority, can decide during sprint

### Status Reporting

**Weekly Status Update Format:**

- Test coverage metrics (pass rate, new tests added)
- Tasks completed vs planned
- Blockers and decisions needed
- Risk status updates

---

## 🎉 Sprint 4 Success Definition

**Sprint 4 is considered successful when:**

1. ✅ **Security Gap Closed:** Cache isolation validated with 10+ integration tests
2. ✅ **Architectural Clarity:** HTTP catalog routing decision made and documented
3. ✅ **Tests Unblocked:** All HTTP catalog tests passing (4/4)
4. ✅ **Developer Experience:** Test helper utilities in use across 5+ files
5. ✅ **Quality Maintained:** Test pass rate ≥77% (no regressions)
6. ✅ **Documentation Complete:** All decisions and patterns documented

**Stretch Goals:**

- ⭐ Sprint 3 cleanup completed (7 tests fixed)
- ⭐ Flaky test strategy decided and implemented
- ⭐ Test coverage reaches 80%+
- ⭐ Zero test infrastructure debt

---

## 🔗 Related Documentation

### Sprint 3 References

- **Main Report:** `server/SPRINT_3_FINAL_SESSION_REPORT.md`
- **Known Issues:** `server/SPRINT_3_KNOWN_ISSUES.md`
- **Blockers:** `server/SPRINT_3_BLOCKERS.md`
- **Webhook Progress:** `server/SPRINT_3_WEBHOOK_RACE_CONDITIONS_PROGRESS.md`

### Architecture & Patterns

- **Multi-Tenant Patterns:** `.claude/PATTERNS.md`
- **Cache Warning:** `.claude/CACHE_WARNING.md`
- **Database Schema:** `server/prisma/schema.prisma`
- **Production Readiness:** `PRODUCTION_READINESS_STATUS.md`

### Testing Documentation

- **Testing Guide:** `server/TESTING.md`
- **Test Helpers:** `test/helpers/fakes.ts` (existing)
- **Integration Patterns:** See Sprint 3 reports for examples

---

**Sprint 4 Status:** 🟢 **READY TO START**

**Recommended Start Date:** Immediate (post Sprint 3 merge)

**Estimated Completion:** 12-16 hours (3 sessions)

---

_Created: 2025-11-10 23:00 EST_
_Sprint: Sprint 4 - Cache Isolation & Test Infrastructure_
_Previous: Sprint 3 - Integration Test Restoration (✅ Complete)_
_Next: Sprint 5 - E2E Tests & Production Hardening_
