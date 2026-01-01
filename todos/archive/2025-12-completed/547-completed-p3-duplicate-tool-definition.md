---
status: completed
priority: p3
issue_id: "547"
tags: [code-review, dry, cleanup]
dependencies: []
completed_at: "2026-01-01"
---

# Duplicate Tool Definition (getBlackoutsTool)

## Problem Statement

`getBlackoutsTool` and `getBlackoutDatesTool` in read-tools.ts are functionally identical but have different names. This creates confusion and maintenance burden.

## Findings

**Pattern Recognition Specialist:**
> "`getBlackoutsTool` (line 532) and `getBlackoutDatesTool` (line 1399) are functionally identical. Comment on line 1472 acknowledges this (TODO #452)."

**Evidence:**
```typescript
// Lines 557-564 vs 1425-1432: Identical queries
// Lines 568-572 vs 1435-1439: Identical formatting
```

**Impact:**
- DRY violation
- Maintenance burden (changes need to be made twice)
- Confusion about which tool to use

## Proposed Solutions

### Option A: Remove getBlackoutsTool (Recommended)
Keep only `getBlackoutDatesTool` (more descriptive name).

**Pros:** Simplest fix
**Cons:** May break references (unlikely)
**Effort:** Small (10 min)
**Risk:** Low

### Option B: Create alias
Export both names pointing to same implementation.

**Pros:** Backwards compatible
**Cons:** Still confusing
**Effort:** Small (5 min)
**Risk:** Low

## Recommended Action

Option A - Remove duplicate, keep getBlackoutDatesTool

## Technical Details

**Affected Files:**
- `server/src/agent/tools/read-tools.ts:532-580` - Remove getBlackoutsTool

## Acceptance Criteria

- [x] Only one blackout tool exists
- [x] All references updated
- [x] Tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-01 | Created from code review | Check for duplicates during review |
| 2026-01-01 | Completed - removed getBlackoutsTool (lines 532-588) | getBlackoutDatesTool was already the only one in readTools array |
