---
status: done
priority: p3
issue_id: '664'
tags:
  - code-review
  - yagni
  - storefront-section-ids
dependencies: []
---

# Unused isSectionWithId Type Guard

## Problem Statement

The `isSectionWithId()` type guard is exported and tested but appears unused in actual tool code. Tools use inline checks instead. This could be YAGNI (You Aren't Gonna Need It).

**Why it matters:** Dead code adds maintenance burden. However, type guards are generally good practice for type narrowing.

## Findings

**Location:** `packages/contracts/src/landing-page.ts` lines 100-108

**Exported but unused:**

```typescript
export function isSectionWithId(section: Section): section is SectionWithId {
  return (
    'id' in section &&
    typeof section.id === 'string' &&
    SectionIdSchema.safeParse(section.id).success
  );
}
```

**Tools use inline checks:**

```typescript
// In tools (line 189):
(s) => 'id' in s && s.id === sectionId

// Type guard would be cleaner:
(s) => isSectionWithId(s) && s.id === sectionId
```

## Proposed Solutions

### Option A: Use Type Guard Consistently (Recommended)

**Pros:** Better type narrowing, cleaner code, validates ID format
**Cons:** Slight performance overhead (Zod validation)
**Effort:** Small (1 hour)
**Risk:** Low

### Option B: Remove Type Guard (YAGNI)

**Pros:** Less code to maintain
**Cons:** Loses type narrowing benefits
**Effort:** Tiny (15 min)
**Risk:** Low

## Recommended Action

**Option A: Use Type Guard Consistently** - Quality demands using proper type narrowing. Replace inline `'id' in s` checks with `isSectionWithId(s)`. Better TypeScript inference, validates ID format, cleaner code.

## Technical Details

**Affected Files:**

- `packages/contracts/src/landing-page.ts` (keep or remove)
- `server/src/agent/tools/storefront-tools.ts` (use if kept)
- `server/src/agent/tools/utils.ts` (use if kept)

## Acceptance Criteria

- [x] Decision made: use or remove
- [x] If use: all inline ID checks replaced with type guard
- [ ] ~~If remove: function and tests deleted~~ (N/A - using, not removing)

## Work Log

| Date       | Action                   | Learnings                                                                                                                          |
| ---------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-08 | Created from code review | Identified by code-simplicity-reviewer agent                                                                                       |
| 2026-01-08 | Approved for work        | Quality triage: Use it or delete it. Type guards improve quality - use it.                                                         |
| 2026-01-08 | Completed                | Replaced 10 inline checks with isSectionWithId() type guard across storefront-tools.ts and utils.ts. All 74 storefront tests pass. |

## Implementation Summary

**Changes made:**

1. **storefront-tools.ts:**
   - Added `isSectionWithId` to imports from `executor-schemas`
   - Replaced inline `'id' in section && typeof section.id === 'string'` checks with `isSectionWithId(section)` in:
     - `removePageSectionTool` (removedId extraction)
     - `reorderPageSectionsTool` (movedId extraction)
     - `collectSectionIds()` helper function
     - `listSectionIdsTool` (sectionId resolution)
     - `getSectionByIdTool` (currentId and availableIds)
     - `getUnfilledPlaceholdersTool` (sectionId for unfilled items)

2. **utils.ts:**
   - Added `isSectionWithId` to imports from `@macon/contracts`
   - Updated `resolveSectionIndex()` helper to use type guard in:
     - Section ID lookup (`findIndex` calls)
     - Available IDs filtering

**Benefits achieved:**

- Better TypeScript type narrowing (no more `as { id: string }` casts)
- Consistent ID validation (validates format via Zod schema)
- DRY code (single source of truth for ID detection logic)
- Cleaner, more readable code

## Resources

- Test file: `server/test/contracts/section-id.test.ts`
