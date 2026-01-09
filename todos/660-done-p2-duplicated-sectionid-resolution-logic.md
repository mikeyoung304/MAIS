---
status: done
priority: p2
issue_id: '660'
tags:
  - code-review
  - quality
  - dry
  - storefront-section-ids
dependencies: []
---

# Duplicated Section ID Resolution Logic

## Problem Statement

The logic for resolving `sectionId` to `sectionIndex` is duplicated between `updatePageSectionTool` and `removePageSectionTool`. Both contain ~70 lines of identical logic for finding sections, cross-page error messaging, and listing available IDs.

**Why it matters:** Code duplication violates DRY principle. If the resolution logic needs to be updated, it must be changed in two places, increasing bug risk.

## Findings

**Locations:**

- `server/src/agent/tools/storefront-tools.ts` lines 184-218 (update tool)
- `server/src/agent/tools/storefront-tools.ts` lines 364-399 (remove tool)

**Duplicated Pattern:**

```typescript
// Both tools have this identical logic:
if (sectionId && sectionIndex === undefined) {
  const foundIndex = page.sections.findIndex(
    (s) => 'id' in s && s.id === sectionId
  );

  if (foundIndex === -1) {
    // Check other pages for helpful error
    for (const [otherPage, otherConfig] of Object.entries(pages)) {
      // ... cross-page check
    }
    // List available IDs
    const availableIds = page.sections.filter(...).map(...);
    return { success: false, error: `Section not found...` };
  }
  sectionIndex = foundIndex;
}
```

## Proposed Solutions

### Option A: Extract to Shared Helper (Recommended)

**Pros:** Clean separation, reusable for future tools
**Cons:** Slightly more indirection
**Effort:** Small (1 hour)
**Risk:** Low

```typescript
// server/src/agent/tools/utils.ts
export function resolveSectionIdToIndex(
  pages: PagesConfig,
  pageName: PageName,
  sectionId: string
): { index: number } | { error: string } {
  const page = pages[pageName];
  const foundIndex = page.sections.findIndex((s) => 'id' in s && s.id === sectionId);

  if (foundIndex !== -1) {
    return { index: foundIndex };
  }

  // Cross-page check for helpful error
  for (const [otherPage, config] of Object.entries(pages)) {
    // ...
  }

  return { error: `Section "${sectionId}" not found...` };
}
```

### Option B: Keep Duplicated (Not Recommended)

**Pros:** No refactoring needed
**Cons:** Maintenance burden, divergence risk
**Effort:** None
**Risk:** High (bugs from inconsistent updates)

## Recommended Action

**Option A: Extract to Shared Helper** - Create `resolveSectionIdToIndex()` in `server/src/agent/utils/section-utils.ts`. Both update and remove tools import from there. DRY violation fixed at source.

## Technical Details

**Affected Files:**

- `server/src/agent/tools/storefront-tools.ts` - Both tools
- `server/src/agent/tools/utils.ts` - Add new helper

## Acceptance Criteria

- [x] Single source of truth for sectionId → index resolution
- [x] Both tools use shared helper
- [x] Error messages remain identical
- [x] All existing tests pass

## Work Log

| Date       | Action                   | Learnings                                                                                                                             |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-08 | Created from code review | Identified by code-simplicity-reviewer agent                                                                                          |
| 2026-01-08 | Approved for work        | Quality triage: DRY violation = divergence bugs. Extract now, not later.                                                              |
| 2026-01-08 | Resolved via #661        | Shared helper `resolveSectionIndex()` implemented in utils.ts. All 3 tools (update, remove, reorder) now use it. DRY violation fixed. |

## Resources

- Similar pattern: `getDraftConfigWithSlug` helper in utils.ts
