---
status: ready
priority: p3
issue_id: '5215'
tags: [code-review, dead-code, cleanup, section-content-migration]
dependencies: []
---

# P3: Unused Block Type Mapper Functions

## Problem Statement

The `block-type-mapper.ts` file contains bidirectional conversion functions, but only one direction is used in production.

**Why it matters:** Unused exports increase bundle size and create maintenance burden.

## Findings

**Source:** Code Simplicity Agent Review

**Location:** `server/src/lib/block-type-mapper.ts`

**Evidence:**

```bash
# Check which functions are actually used
grep -rn "fromBlockType\|toBlockType" server/src/ --include="*.ts" | grep -v ".test." | grep -v "block-type-mapper.ts"
# Result: Only toBlockType is used in production
```

**Functions:**

- `toBlockType(sectionType)` - USED - converts frontend type to BlockType enum
- `fromBlockType(blockType)` - UNUSED - converts BlockType enum to frontend type

## Proposed Solutions

### Option A: Delete unused function (Recommended)

**Approach:** Remove `fromBlockType()` if not needed

```typescript
// DELETE from block-type-mapper.ts:
// export function fromBlockType(blockType: BlockType): string { ... }
```

**Pros:** Cleaner code, smaller bundle
**Cons:** Need to re-add if needed for future features
**Effort:** Small (10 minutes)
**Risk:** Low

### Option B: Keep for symmetry

**Approach:** Document as available for future use

**Pros:** Bidirectional mapping complete
**Cons:** Unused code
**Effort:** None
**Risk:** None

## Recommended Action

**Option A: Delete unused functions** - Remove `isValidSectionType()` and `getDefaultBlockTypesForPage()`. Keep the two functions that are actually used.

**Triaged:** 2026-02-02 | **Decision:** Delete unused | **Rationale:** Dead code removal improves maintainability

## Technical Details

**Affected Files:**

- `server/src/lib/block-type-mapper.ts`

**Database Changes:** None

## Acceptance Criteria

- [ ] Unused function removed or documented
- [ ] No broken imports
- [ ] Tests still pass

## Work Log

| Date       | Action                   | Learnings                           |
| ---------- | ------------------------ | ----------------------------------- |
| 2026-02-02 | Created from code review | Identified by code-simplicity agent |

## Resources

- PR: `feat/section-content-migration`
