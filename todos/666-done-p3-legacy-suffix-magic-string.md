---
status: done
priority: p3
issue_id: '666'
tags:
  - code-review
  - quality
  - storefront-section-ids
dependencies: []
---

# Legacy Suffix Magic String Repeated

## Problem Statement

The `-legacy` suffix for sections without IDs is hardcoded in multiple places. Should be extracted to a shared constant for consistency.

**Why it matters:** Magic strings are error-prone. If the suffix needs to change, it must be updated in 4+ places.

## Findings

**Locations in** `server/src/agent/tools/storefront-tools.ts`:

- Line 1140-1142
- Line 1231-1234
- Line 1254-1257
- Line 1334-1337

**Pattern:**

```typescript
const sectionId =
  'id' in section && typeof section.id === 'string' ? section.id : `${page}-${section.type}-legacy`;
```

## Proposed Solutions

### Option A: Extract to Constant (Recommended)

**Pros:** Single source of truth
**Cons:** Minor refactor
**Effort:** Tiny (15 min)
**Risk:** Very low

```typescript
// In utils.ts or contracts
export const LEGACY_ID_SUFFIX = 'legacy';

export function getLegacySectionId(page: PageName, type: SectionTypeName): string {
  return `${page}-${type}-${LEGACY_ID_SUFFIX}`;
}
```

### Option B: Keep Inline

**Pros:** No change needed
**Cons:** Drift risk
**Effort:** None
**Risk:** Low

## Recommended Action

**Option A: Extract to Constant** - Create `getLegacySectionId(page, type)` helper and `LEGACY_ID_SUFFIX` constant. All 4 usages use the helper. Magic strings eliminated.

## Technical Details

**Affected Files:**

- `server/src/agent/tools/storefront-tools.ts`
- Optionally `server/src/agent/tools/utils.ts`

## Acceptance Criteria

- [x] Single constant/function for legacy ID generation
- [x] All 4 usages updated
- [x] Tests still pass

## Work Log

| Date       | Action                   | Learnings                                                                                                                                   |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-08 | Created from code review | Identified by data-integrity-guardian and code-simplicity agents                                                                            |
| 2026-01-08 | Approved for work        | Quality triage: Magic strings are maintainability debt. Extract now.                                                                        |
| 2026-01-08 | Completed                | Added LEGACY_ID_SUFFIX constant and getLegacySectionId helper to utils.ts. Updated 4 occurrences in storefront-tools.ts. All 71 tests pass. |

## Resources

- None
