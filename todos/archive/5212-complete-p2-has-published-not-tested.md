---
status: ready
priority: p2
issue_id: '5212'
tags: [code-review, testing, section-content-migration]
dependencies: []
---

# P2: hasPublished() Method Not Tested

## Problem Statement

The `hasPublished()` method in SectionContentService was added during Phase 5.2 but lacks unit test coverage.

**Why it matters:** This method is used to determine if a tenant has any published content (for preview/publish logic). Untested code in critical paths is a reliability risk.

## Findings

**Source:** Test Coverage Agent Review

**Location:** `server/src/services/section-content.service.ts`

**Evidence:**

```typescript
// Method exists but no tests
async hasPublished(tenantId: string): Promise<boolean> {
  const published = await this.repository.findAllForTenant(tenantId, { publishedOnly: true });
  return published.length > 0;
}
```

**Test file:** `server/src/services/section-content.service.test.ts` - 64 tests, none for `hasPublished()`

## Proposed Solutions

### Option A: Add unit tests (Recommended)

**Approach:** Add test cases for both true and false scenarios

```typescript
describe('hasPublished', () => {
  it('should return true when tenant has published sections', async () => {
    await service.addSection(tenantId, 'home', 'hero', defaultContent, 0);
    await service.publishAll(tenantId, true);

    expect(await service.hasPublished(tenantId)).toBe(true);
  });

  it('should return false when tenant has only drafts', async () => {
    await service.addSection(tenantId, 'home', 'hero', defaultContent, 0);
    // Not published - still draft

    expect(await service.hasPublished(tenantId)).toBe(false);
  });

  it('should return false for new tenant with no sections', async () => {
    expect(await service.hasPublished('new-tenant-id')).toBe(false);
  });
});
```

**Pros:** Complete coverage, documents expected behavior
**Cons:** None
**Effort:** Small (30 minutes)
**Risk:** None

## Recommended Action

**Option A: Add unit tests** - Add 3 test cases: returns true with published sections, returns false with only drafts, returns false for empty tenant.

**Triaged:** 2026-02-02 | **Decision:** Fix before merge | **Rationale:** Test coverage quality improvement

## Technical Details

**Affected Files:**

- `server/src/services/section-content.service.test.ts`

**Database Changes:** None

## Acceptance Criteria

- [ ] Test: returns true when published sections exist
- [ ] Test: returns false when only drafts exist
- [ ] Test: returns false for empty tenant
- [ ] All 67+ tests pass (64 existing + 3 new)

## Work Log

| Date       | Action                   | Learnings                         |
| ---------- | ------------------------ | --------------------------------- |
| 2026-02-02 | Created from code review | Identified by test-coverage agent |

## Resources

- PR: `feat/section-content-migration`
