---
status: pending
priority: p3
issue_id: '636'
tags: [code-review, testing, tenant-provisioning]
dependencies: []
---

# Missing Unit Tests for TenantProvisioningService

## Problem Statement

The new `TenantProvisioningService` doesn't have dedicated unit tests. Coverage is only via integration tests in `auth-signup.test.ts`.

**Why it matters:**

- Edge cases (partial failures) not tested directly
- Service behavior harder to verify in isolation
- Regression risk if service is modified

## Findings

### Evidence from Data Integrity Reviewer

"Missing test coverage for TenantProvisioningService unit tests: The service is tested via integration tests in `auth-signup.test.ts`. Consider adding unit tests for edge cases (partial failure scenarios)"

### Current Test Coverage

Integration test (`auth-signup.test.ts`) verifies:

- Tenant created with correct values
- Default segment created with slug 'general'
- 3 default packages created
- All packages linked to segment

**Not tested:**

- Rollback behavior if segment creation fails
- Rollback behavior if package creation fails
- Error messages for various failure modes
- API key generation correctness

## Proposed Solutions

### Option A: Add Unit Test File (Recommended)

**Pros:** Isolated testing, fast, covers edge cases
**Cons:** Need to mock Prisma
**Effort:** Medium
**Risk:** Low

Create `server/test/services/tenant-provisioning.service.test.ts`

### Option B: Extend Integration Tests

**Pros:** Uses real database, simpler setup
**Cons:** Slower, harder to trigger failure scenarios
**Effort:** Small
**Risk:** Low

## Recommended Action

**Option A** - Add dedicated unit test file

## Technical Details

**Test Cases to Add:**

1. `createFullyProvisioned()` - success path
2. `createFullyProvisioned()` - rollback on segment failure
3. `createFullyProvisioned()` - rollback on package failure
4. `createFromSignup()` - success path
5. `createFromSignup()` - rollback on failure
6. API key format validation

**Affected Files:**

- `server/test/services/tenant-provisioning.service.test.ts` - New file

## Acceptance Criteria

- [ ] Unit test file created
- [ ] Success paths tested for both methods
- [ ] Rollback behavior verified with mocked failures
- [ ] Error messages validated
- [ ] All tests pass

## Work Log

| Date       | Action                          | Learnings                         |
| ---------- | ------------------------------- | --------------------------------- |
| 2026-01-05 | Created from multi-agent review | Data integrity reviewer noted gap |

## Resources

- Code Review: Tenant Provisioning Integrity PR
- Example: Other service tests in `server/test/services/`
