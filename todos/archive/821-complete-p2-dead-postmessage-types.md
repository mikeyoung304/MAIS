---
status: pending
priority: p2
issue_id: 821
tags: [code-review, tech-debt, build-mode, dead-code]
dependencies: []
---

# Tech Debt: Dead PostMessage Types in Build Mode Protocol

## Problem Statement

The Build Mode PostMessage protocol defines multiple message types that are never used in production code. This bloats the codebase and confuses future developers.

**Why it matters:**

- ~40% of protocol.ts appears to be dead code
- Developers must read and understand unused features
- Maintenance burden for code that doesn't run

## Findings

**From code-simplicity-reviewer agent:**

### Dead Message Types (Never Called)

| Type                              | Defined In      | Exported | Called | Status     |
| --------------------------------- | --------------- | -------- | ------ | ---------- |
| `BUILD_MODE_SECTION_EDIT`         | protocol.ts:138 | ✅       | ❌     | DEAD       |
| `BUILD_MODE_SECTION_RENDERED`     | protocol.ts:178 | ✅       | ❌     | DEAD       |
| `BUILD_MODE_HIGHLIGHT_SECTION`    | protocol.ts:45  | ✅       | ❌     | DEPRECATED |
| `BUILD_MODE_SECTION_UPDATE`       | protocol.ts:81  | ✅       | ❌     | DEAD       |
| `BUILD_MODE_PUBLISH_NOTIFICATION` | protocol.ts:99  | ✅       | ❌     | DEAD       |

**Verification:**

```bash
# editSection exported but never called
git grep "\.editSection" apps/web/**/*.tsx apps/web/**/*.ts
# Returns: 0 results

# notifySectionRendered exported but never called
git grep "\.notifySectionRendered" apps/web/**/*.tsx apps/web/**/*.ts
# Returns: 0 results
```

### Duplicate Highlighting Systems

Two complete implementations for the same feature:

1. **Index-based (deprecated):** `BUILD_MODE_HIGHLIGHT_SECTION` with `sectionIndex`
2. **ID-based (current):** `BUILD_MODE_HIGHLIGHT_SECTION_BY_ID` with `sectionId`

The ID-based handler still maintains index state for "backward compat" (lines 276-280), but no code uses the old format.

## Proposed Solutions

### Option A: Delete Dead Code (Recommended)

**Pros:** 30% reduction in protocol code, clearer API surface
**Cons:** Loses "Phase 4/5" features that may have been planned
**Effort:** Small (30 minutes)
**Risk:** Low (verify no usage first)

Delete:

- `BUILD_MODE_SECTION_EDIT` schema and handler
- `BUILD_MODE_SECTION_RENDERED` schema and handler
- `BUILD_MODE_HIGHLIGHT_SECTION` schema and handler (keep ID-based only)
- `editSection` and `notifySectionRendered` from hook exports
- Remove `highlightedSection` state (keep only `highlightedSectionId`)

### Option B: Mark as Future/Planned

**Pros:** Keeps code for potential future use
**Cons:** Technical debt remains
**Effort:** Small (10 minutes)
**Risk:** None

Add clear comments marking these as "NOT YET IMPLEMENTED".

## Recommended Action

Implement Option A after confirming with product that Phase 4/5 inline editing features are not planned.

**Question for product:** Were `BUILD_MODE_SECTION_EDIT` and `BUILD_MODE_SECTION_RENDERED` intended for inline editing? If yes, keep. If speculative, delete.

## Technical Details

**Affected files:**

- `apps/web/src/lib/build-mode/protocol.ts` (260 lines → ~150 lines)
- `apps/web/src/hooks/useBuildModeSync.ts` (482 lines → ~350 lines)
- `apps/web/src/lib/build-mode/types.ts` (if exists)

**Lines removable:** ~150 lines

## Acceptance Criteria

- [ ] Confirm with product that features are not planned
- [ ] Remove unused schemas from protocol.ts
- [ ] Remove unused handlers from useBuildModeSync.ts
- [ ] Remove unused exports from hook
- [ ] TypeScript compiles without errors
- [ ] Build Mode preview still works

## Work Log

| Date       | Action                 | Learnings                                          |
| ---------- | ---------------------- | -------------------------------------------------- |
| 2026-02-04 | Code simplicity review | Phase 4/5 features built speculatively, never used |

## Resources

- `apps/web/src/lib/build-mode/protocol.ts` - Message type definitions
- `apps/web/src/hooks/useBuildModeSync.ts` - Message handlers
