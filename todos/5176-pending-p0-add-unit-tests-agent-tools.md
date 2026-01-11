---
status: pending
priority: p0
issue_id: '5176'
tags: [code-review, testing, technical-debt, agent-system]
dependencies: []
---

# Zero Unit Tests for Agent Tools (Critical Testing Gap)

## Problem Statement

The agent tools subsystem has **0 unit tests** despite being the primary interface between AI agents and business logic. With 8 tool files and 38+ tools handling sensitive operations (package updates, bookings, draft modifications), this is a critical maintainability and reliability concern.

**Why it matters:** Untested code leads to:

- Regression bugs during refactoring
- Unknown edge case behavior
- Difficulty validating security claims (e.g., "all queries filter by tenantId")
- Slower development (manual testing for every change)

## Findings

**Source:** Code Quality Review agent (agent ID: af5de52)

**Test Coverage Analysis:**

| Component            | Files | Tests       | Coverage   |
| -------------------- | ----- | ----------- | ---------- |
| **Agent Tools**      | 8     | **0 tests** | ❌ 0%      |
| Proposals            | 3     | 0 tests     | ❌ 0%      |
| Context              | 2     | 0 tests     | ❌ 0%      |
| Base Orchestrator    | 1     | 56 tests    | ✅ Good    |
| Storefront Executors | 1     | 38 tests    | ✅ Good    |
| Other Orchestrators  | 3     | 0 tests     | ⚠️ Partial |

**Critical Untested Components:**

1. **`read-tools.ts`** (1,514 LOC):
   - `get_packages`, `get_bookings`, `get_customers`
   - Query construction and tenant filtering
   - Error handling for missing resources

2. **`write-tools.ts`** (1,861 LOC):
   - `upsert_package`, `upsert_services`, `update_branding`
   - Trust tier enforcement
   - Proposal creation logic

3. **`storefront-tools.ts`** (1,200+ LOC):
   - 7 draft modification tools
   - Section ID resolution
   - Page navigation logic

4. **`ui-tools.ts`** (500+ LOC):
   - `toggle_panel`, `show_publish_dialog`
   - State indicators (`hasDraft`, `hasChanges`)

## Proposed Solutions

### Solution 1: Phased Testing Implementation (Recommended)

**Approach:** Add tests incrementally by priority

**Phase 1 (Week 1): High-Risk Write Tools**

- Target: `write-tools.ts` → 70% coverage
- Tests: Trust tier enforcement, tenant isolation, proposal creation
- Effort: 2 days

**Phase 2 (Week 2): Storefront Tools**

- Target: `storefront-tools.ts` → 70% coverage
- Tests: Section ID resolution, page switching, error scenarios
- Effort: 2 days

**Phase 3 (Week 3): Read Tools**

- Target: `read-tools.ts` → 60% coverage
- Tests: Query construction, sanitization, pagination
- Effort: 1 day

**Phase 4 (Week 4): UI Tools + Others**

- Target: `ui-tools.ts`, `booking-link-tools.ts` → 50% coverage
- Effort: 1 day

**Pros:**

- Systematic approach
- Tests highest-risk code first
- Builds momentum

**Cons:**

- Takes 4 weeks to complete

**Effort:** 6 days spread over 4 weeks
**Risk:** LOW - Doesn't touch production code

### Solution 2: Template-Driven Test Generation

**Approach:** Create test templates, generate tests for each tool

**Test Template Pattern:**

```typescript
describe('Tool: upsert_package', () => {
  describe('Tenant Isolation', () => {
    it('should filter packages by tenantId');
    it('should reject cross-tenant package updates');
  });

  describe('Trust Tier Enforcement', () => {
    it('should create T2 proposal for price changes >20%');
    it('should create T1 proposal for small edits');
  });

  describe('Input Validation', () => {
    it('should validate required fields via Zod');
    it('should sanitize user input before storage');
  });

  describe('Error Handling', () => {
    it('should return user-friendly errors for missing resources');
    it('should handle Prisma errors gracefully');
  });
});
```

**Pros:**

- Consistent test structure
- Faster to write (template-driven)
- Easy to review

**Cons:**

- Requires upfront template design

**Effort:** 1 day (template) + 3 days (tests)
**Risk:** LOW

### Solution 3: TDD for New Tools Only

**Approach:** Don't backfill tests, only test new/modified tools going forward

**Pros:**

- Zero upfront effort
- Tests accumulate naturally

**Cons:**

- Existing tools remain untested
- Doesn't solve immediate problem

**Effort:** Ongoing
**Risk:** HIGH - Leaves critical gaps

## Recommended Action

**Implement Solution 1 (Phased Approach)** with template from Solution 2.

**Rationale:**

- Addresses highest-risk code first (write tools with trust tiers)
- Template ensures consistency
- Incremental progress visible each week

## Technical Details

**Affected Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/read-tools.ts` (1,514 LOC)
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/write-tools.ts` (1,861 LOC)
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/storefront-tools.ts` (~1,200 LOC)
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/ui-tools.ts` (~500 LOC)
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/onboarding-tools.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/booking-link-tools.ts`

**Test File Locations:**

- Create `/Users/mikeyoung/CODING/MAIS/server/test/agent/tools/` directory
- Follow pattern: `{tool-file}.test.ts`

**Test Utilities Needed:**

- Mock Prisma client
- Mock tenant context
- Fixture data for packages, bookings, customers

## Acceptance Criteria

**Phase 1 Complete:**

- [ ] `write-tools.test.ts` exists with 70%+ coverage
- [ ] All trust tier enforcement tested
- [ ] All tenant isolation paths tested
- [ ] CI pipeline runs tests on every commit

**Phase 2 Complete:**

- [ ] `storefront-tools.test.ts` exists with 70%+ coverage
- [ ] Section ID resolution tested (happy + error paths)
- [ ] Page switching logic tested

**Phase 3 Complete:**

- [ ] `read-tools.test.ts` exists with 60%+ coverage
- [ ] Query construction tested
- [ ] Sanitization tested

**Phase 4 Complete:**

- [ ] UI tools tested (50%+ coverage)
- [ ] Overall agent/ directory: 60%+ coverage
- [ ] No critical paths untested

## Work Log

| Date       | Action                                      | Learnings                                |
| ---------- | ------------------------------------------- | ---------------------------------------- |
| 2026-01-11 | Code quality review identified 0 unit tests | Critical gap for 8,000+ LOC of tool code |

## Resources

- **Code Review:** Code Quality agent (ID: af5de52)
- **Test Pattern Reference:** `/Users/mikeyoung/CODING/MAIS/server/test/agent/orchestrator/base-orchestrator.test.ts` (56 tests)
- **Similar Pattern:** `/Users/mikeyoung/CODING/MAIS/server/test/agent/storefront/storefront-executors.test.ts` (38 tests)
- **Documentation:** Consider creating `docs/solutions/patterns/AGENT_TOOL_TEST_PATTERNS.md`
