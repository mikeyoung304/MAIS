---
status: ready
priority: p3
issue_id: '5214'
tags: [code-review, dead-code, cleanup, section-content-migration]
dependencies: []
---

# P3: Unused Version History Methods

## Problem Statement

The `SectionContentService` includes version history methods (`getVersionHistory()`, `restoreVersion()`) that are not called from any routes or agent tools.

**Why it matters:** Dead code increases cognitive load and maintenance burden. If undo functionality is needed, it should be wired up; if not, it should be removed.

## Findings

**Source:** Code Simplicity Agent Review

**Location:** `server/src/services/section-content.service.ts`

**Evidence:**

```bash
# Search for usage of version history methods
grep -rn "getVersionHistory\|restoreVersion" server/src/ --include="*.ts" | grep -v ".test." | grep -v ".d.ts"
# Result: Only the service definition, no callers
```

**Methods affected:**

- `getVersionHistory(tenantId, sectionId)` - ~15 lines
- `restoreVersion(tenantId, sectionId, versionIndex)` - ~20 lines

## Proposed Solutions

### Option A: Delete unused methods (Recommended)

**Approach:** Remove the dead code

```typescript
// DELETE these methods from section-content.service.ts:
// - getVersionHistory()
// - restoreVersion()
```

**Pros:** Reduces complexity, follows YAGNI
**Cons:** Need to re-implement if undo is needed later
**Effort:** Small (15 minutes)
**Risk:** Low

### Option B: Wire up to agent tools

**Approach:** Add `undo_section_edit` tool that uses these methods

**Pros:** Enables undo functionality
**Cons:** More work, may not be needed
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Option C: Keep but mark as internal

**Approach:** Add `@internal` JSDoc tag, keep for future use

**Pros:** Available when needed
**Cons:** Still dead code
**Effort:** Small
**Risk:** Low

## Recommended Action

**Option A: Delete unused methods** - Remove `getVersionHistory()` and `restoreVersion()` from service and repository. YAGNI - can re-implement if undo feature is requested later.

**Triaged:** 2026-02-02 | **Decision:** Delete (YAGNI) | **Rationale:** Dead code removal improves maintainability

## Technical Details

**Affected Files:**

- `server/src/services/section-content.service.ts`
- `server/src/services/section-content.service.test.ts` (if tests exist)

**Database Changes:** None

## Acceptance Criteria

- [ ] Methods removed or wired up
- [ ] No broken imports
- [ ] Tests still pass

## Work Log

| Date       | Action                   | Learnings                           |
| ---------- | ------------------------ | ----------------------------------- |
| 2026-02-02 | Created from code review | Identified by code-simplicity agent |

## Resources

- PR: `feat/section-content-migration`
