---
status: ready
priority: p2
issue_id: '662'
tags:
  - code-review
  - testing
  - storefront-section-ids
dependencies: []
---

# Missing Test Coverage for Edge Cases

## Problem Statement

Critical error handling paths in storefront tools are not tested. The cross-page section ID detection and legacy ID fallback are untested, meaning regressions could go unnoticed.

**Why it matters:** Tests document expected behavior. Without them, future refactoring could break helpful error messages or backward compatibility.

## Findings

**Location:** `server/test/agent/storefront/storefront-tools.test.ts`

**Missing Tests:**

1. **Section ID on wrong page** (lines 194-206 in storefront-tools.ts)
   - User provides `sectionId` that exists but on different page than `pageName`
   - Should return helpful error: "Section exists on page X, not Y"

2. **Legacy ID fallback** (lines 1140-1142 in storefront-tools.ts)
   - Sections without IDs get `${page}-${section.type}-legacy` format
   - Should verify discovery tools handle legacy IDs correctly

3. **Cross-page collision detection** (lines 99-113 in executors)
   - Executor should reject ID that exists on any page, not just target page

## Proposed Solutions

### Option A: Add Missing Tests (Recommended)

**Pros:** Complete coverage, prevents regressions
**Cons:** Time investment
**Effort:** Medium (2-3 hours)
**Risk:** Low

```typescript
// Test 1: Wrong page error
it('should return helpful error when sectionId exists on different page', async () => {
  mockPrisma.tenant.findUnique.mockResolvedValue({
    landingPageConfigDraft: {
      pages: {
        home: { enabled: true, sections: [] },
        about: { enabled: true, sections: [{ id: 'about-hero-main', type: 'hero' }] },
      },
    },
  });

  const result = await updatePageSectionTool.execute(mockContext, {
    pageName: 'home',
    sectionId: 'about-hero-main', // Exists on about, not home
    sectionType: 'hero',
  });

  expect(result.success).toBe(false);
  expect(result.error).toContain('exists on page "about"');
});

// Test 2: Legacy ID format
it('should generate legacy ID for sections without ID', async () => {
  mockPrisma.tenant.findUnique.mockResolvedValue({
    landingPageConfig: {
      pages: {
        home: { sections: [{ type: 'hero', headline: 'Test' }] }, // No ID
      },
    },
  });

  const result = await listSectionIdsTool.execute(mockContext, {});
  expect(result.data.sections[0].id).toBe('home-hero-legacy');
});
```

## Recommended Action

**Option A: Add Missing Tests** - Complete coverage prevents regressions. Tests document expected behavior. Cross-page errors + legacy ID fallback + collision detection all need coverage.

## Technical Details

**Affected Files:**

- `server/test/agent/storefront/storefront-tools.test.ts`

## Acceptance Criteria

- [ ] Test for cross-page sectionId error message
- [ ] Test for legacy ID generation in discovery tools
- [ ] Test for executor cross-page collision detection
- [ ] All tests documented with why they exist

## Work Log

| Date       | Action                   | Learnings                                                            |
| ---------- | ------------------------ | -------------------------------------------------------------------- |
| 2026-01-08 | Created from code review | Identified by code-simplicity-reviewer agent                         |
| 2026-01-08 | Approved for work        | Quality triage: Untested code is unverified code. Edge cases matter. |

## Resources

- Existing test patterns in the file
