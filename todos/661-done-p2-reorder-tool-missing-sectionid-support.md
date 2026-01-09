---
status: done
priority: p2
issue_id: '661'
tags:
  - code-review
  - agent-native
  - consistency
  - storefront-section-ids
dependencies: ['660']
---

# reorder_page_sections Missing sectionId Support

## Problem Statement

While `update_page_section` and `remove_page_section` support targeting by `sectionId` (preferred) or `sectionIndex` (fallback), the `reorder_page_sections` tool only accepts `fromIndex`/`toIndex`. This breaks the "sectionId is PREFERRED" pattern.

**Why it matters:** The agent must mentally map section IDs back to indices to reorder, increasing cognitive load and error potential. Inconsistent API makes the agent experience worse.

## Findings

**Location:** `server/src/agent/tools/storefront-tools.ts` lines 466-563

**Current Schema:**

```typescript
inputSchema: {
  properties: {
    pageName: { ... },
    fromIndex: { type: 'number', description: 'Current position...' },
    toIndex: { type: 'number', description: 'Target position...' },
  },
  required: ['pageName', 'fromIndex', 'toIndex'],
}
```

**Missing:** `fromSectionId`, `toSectionId` or `toPosition: 'before' | 'after'`

## Proposed Solutions

### Option A: Add fromSectionId Parameter (Recommended)

**Pros:** Consistent with other tools, agent can use IDs
**Cons:** Increases tool complexity slightly
**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
inputSchema: {
  properties: {
    pageName: { ... },
    fromSectionId: {
      type: 'string',
      description: 'PREFERRED: Section ID to move (e.g., "home-hero-main")'
    },
    fromIndex: {
      type: 'number',
      description: 'FALLBACK: Current position (0-based)'
    },
    toIndex: { type: 'number', description: 'Target position' },
  },
  required: ['pageName', 'toIndex'], // Only toIndex required, either from* works
}
```

### Option B: Accept sectionId for "After" Positioning

**Pros:** More intuitive ("move hero after testimonials")
**Cons:** More complex to implement
**Effort:** Medium (3-4 hours)
**Risk:** Low

```typescript
toSectionId: { type: 'string', description: 'Move after this section' }
toPosition: { enum: ['before', 'after'], description: 'Place before or after target' }
```

## Recommended Action

**Option A: Add fromSectionId Parameter** - Consistent API across all tools. Agent shouldn't need to map IDs back to indices. Use shared resolver from #660. Depends on #660 completion first.

## Technical Details

**Affected Files:**

- `server/src/agent/tools/storefront-tools.ts` - reorder_page_sections tool
- System prompt may need update for consistency

## Acceptance Criteria

- [x] `fromSectionId` parameter added and works
- [x] Resolution logic uses shared helper (from #660)
- [x] Error messages include available section IDs
- [x] Tool description updated
- [x] Tests added for sectionId path

## Work Log

| Date       | Action                   | Learnings                                                                                                                                                      |
| ---------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-08 | Created from code review | Identified by agent-native-reviewer and architecture-strategist                                                                                                |
| 2026-01-08 | Approved for work        | Quality triage: API consistency is UX quality. Depends on #660.                                                                                                |
| 2026-01-08 | Completed implementation | Added `fromSectionId` param, extracted DRY `resolveSectionIndex` helper, updated existing tools to use shared helper, added 6 new tests for fromSectionId path |

## Implementation Summary

**Changes Made:**

1. **New shared helper** (`server/src/agent/tools/utils.ts`):
   - Added `resolveSectionIndex()` function for DRY sectionId-to-index resolution
   - Returns discriminated union for type-safe error handling
   - Includes cross-page detection and available IDs in error messages

2. **Updated `reorder_page_sections` tool** (`server/src/agent/tools/storefront-tools.ts`):
   - Added `fromSectionId` parameter (PREFERRED path)
   - Made `fromIndex` optional (FALLBACK path)
   - Updated required fields: `['pageName', 'toIndex']`
   - Uses shared `resolveSectionIndex` helper

3. **Refactored existing tools** to use shared helper:
   - `update_page_section` now uses `resolveSectionIndex`
   - `remove_page_section` now uses `resolveSectionIndex`
   - Reduced ~50 lines of duplicated resolution logic

4. **Added tests** (`server/test/agent/storefront/storefront-tools.test.ts`):
   - 6 new tests for reorder tool's fromSectionId path
   - 6 new tests for shared `resolveSectionIndex` helper

## Resources

- Pattern to follow: `update_page_section` sectionId handling
