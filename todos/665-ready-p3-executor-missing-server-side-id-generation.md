---
status: done
priority: p3
issue_id: '665'
tags:
  - code-review
  - defense-in-depth
  - storefront-section-ids
dependencies: []
---

# Executor Missing Server-Side ID Generation

## Problem Statement

The `update_page_section` executor trusts that the tool has already assigned a proper ID when appending new sections. As defense-in-depth, the executor could generate IDs server-side for sections without IDs.

**Why it matters:** Defense-in-depth pattern. If a tool bug passes a section without an ID, the executor would catch it and assign one.

## Findings

**Location:** `server/src/agent/executors/storefront-executors.ts` lines 119-125

**Current:**

```typescript
// Determine operation: append or update
if (sectionIndex === -1 || sectionIndex >= newSections.length) {
  // Append new section - trusts ID is already set
  newSections.push(sectionData as Section);
}
```

**Could Add:**

```typescript
if (sectionIndex === -1 || sectionIndex >= newSections.length) {
  // Defense-in-depth: ensure section has ID
  if (!('id' in sectionData) || !sectionData.id) {
    const existingIds = collectAllIds(pages);
    sectionData.id = generateSectionId(pageName, sectionData.type, existingIds);
  }
  newSections.push(sectionData as Section);
}
```

## Proposed Solutions

### Option A: Add Server-Side ID Generation (Recommended)

**Pros:** Defense-in-depth, catches tool bugs
**Cons:** Slight overhead collecting existing IDs
**Effort:** Small (1 hour)
**Risk:** Very low

### Option B: Keep Current (Tool Responsibility)

**Pros:** Clear separation of concerns
**Cons:** No defense-in-depth
**Effort:** None
**Risk:** Low (tools are tested)

## Recommended Action

**Option A: Add Server-Side ID Generation** - Defense-in-depth catches tool bugs. If section arrives without ID, generate one using `generateSectionId`. Log warning when fallback triggered. Resilience over trust.

## Technical Details

**Affected Files:**

- `server/src/agent/executors/storefront-executors.ts`

## Acceptance Criteria

- [x] Executor generates ID if section has none
- [x] Generated ID uses monotonic counter correctly
- [x] Existing tests still pass
- [x] New test for ID generation fallback

## Work Log

| Date       | Action                   | Learnings                                                                       |
| ---------- | ------------------------ | ------------------------------------------------------------------------------- |
| 2026-01-08 | Created from code review | Identified by architecture-strategist agent                                     |
| 2026-01-08 | Approved for work        | Quality triage: Defense-in-depth is quality. Catch tool bugs at executor level. |
| 2026-01-08 | Implemented              | Added server-side ID generation with monotonic counter. 3 new tests added.      |

## Resources

- `generateSectionId` in `@macon/contracts`

## Implementation Summary

Added defense-in-depth server-side ID generation to `update_page_section` executor:

1. **New helper functions:**
   - `collectAllSectionIds(pages)` - Collects all existing section IDs across all pages
   - `isValidSectionType(type)` - Type guard for valid section types

2. **Executor change:** In the append path (sectionIndex === -1 or >= length):
   - Check if section has an ID
   - If no ID, generate one using `generateSectionId` from `@macon/contracts`
   - Log warning when fallback triggers (indicates tool bug)

3. **New tests (3 added):**
   - Should generate ID for section without ID when appending
   - Should use monotonic counter for generated IDs
   - Should not overwrite existing ID on section

All 23 tests pass.
