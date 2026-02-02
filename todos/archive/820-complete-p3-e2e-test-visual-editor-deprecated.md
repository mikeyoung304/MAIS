---
status: pending
priority: p3
issue_id: 820
tags: [code-review, testing, e2e, cleanup]
dependencies: []
---

# E2E Test References Deleted Visual Editor Endpoints

## Problem Statement

The E2E test `e2e/tests/landing-page-editor.spec.ts` references `PUT /landing-page/draft` for autosave operations, which was deleted as part of the Visual Editor deprecation.

**Why it matters:**

- E2E test will fail when run
- CI/CD may be broken if this test is in the suite
- Misleading test code

## Findings

**From Breaking Changes Review:**

E2E test references deleted endpoint (`e2e/tests/landing-page-editor.spec.ts:36`):

```typescript
response.url().includes('/landing-page/draft') && response.request().method() === 'PUT';
```

This will never match because the `PUT /draft` route was deleted.

## Proposed Solutions

### Option A: Skip Test with Deprecation Comment (Recommended)

**Pros:**

- Quick fix
- Documents the deprecation
- Can be re-enabled if needed

**Cons:**

- Reduces test coverage temporarily

**Effort:** Small (5 minutes)
**Risk:** Low

```typescript
test.skip('Visual Editor autosave - DEPRECATED: Visual Editor routes deleted in favor of AI agent', async () => {
  // Test code...
});
```

### Option B: Rewrite for Build Mode

**Pros:**

- Maintains E2E coverage for storefront editing

**Cons:**

- More effort
- Need to understand Build Mode flow

**Effort:** Medium (1-2 hours)
**Risk:** Low

## Recommended Action

Implement Option A for now. The Build Mode flow should have its own dedicated E2E tests.

## Technical Details

**File to modify:**

- `e2e/tests/landing-page-editor.spec.ts`

## Acceptance Criteria

- [ ] Test skipped with clear deprecation comment
- [ ] CI passes without test failures
- [ ] Consider creating Build Mode E2E tests separately

## Work Log

| Date       | Action                          | Learnings                                         |
| ---------- | ------------------------------- | ------------------------------------------------- |
| 2026-02-01 | Code review identified test gap | E2E tests need updates when routes are deprecated |

## Resources

- PR: feat/realtime-storefront-preview branch
- Related: docs/plans/2026-02-01-realtime-preview-handoff.md
