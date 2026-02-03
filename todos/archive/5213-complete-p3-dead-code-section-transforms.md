---
status: ready
priority: p3
issue_id: '5213'
tags: [code-review, dead-code, cleanup, section-content-migration]
dependencies: []
---

# P3: Dead Code - section-transforms.ts (274 lines)

## Problem Statement

The file `server/src/lib/section-transforms.ts` (274 lines) is only imported by tests, not by production code. It appears to be a transitional file from the migration that was never integrated.

**Why it matters:** Dead code increases maintenance burden, confuses developers, and inflates bundle size.

## Findings

**Source:** Code Simplicity Agent Review

**Location:** `server/src/lib/section-transforms.ts`

**Evidence:**

```bash
# Production imports - none found
grep -rn "section-transforms" server/src/ --include="*.ts" | grep -v test | grep -v ".d.ts"
# Result: 0 matches

# Test imports only
grep -rn "section-transforms" server/src/ --include="*.ts"
# Result: Only test files import this module
```

**Functions in file:**

- `transformSectionToLegacy()` - Never called in production
- `transformLegacyToSection()` - Never called in production
- `migrateLandingPageConfig()` - Never called in production

## Proposed Solutions

### Option A: Delete the file (Recommended)

**Approach:** Remove the unused file entirely

```bash
rm server/src/lib/section-transforms.ts
# Update any test files that import it
```

**Pros:** Reduces codebase by 274 lines, removes confusion
**Cons:** None - code is unused
**Effort:** Small (15 minutes)
**Risk:** None

### Option B: Keep for future migration tooling

**Approach:** Move to scripts/migrations/ directory

**Pros:** Available if needed for data migration
**Cons:** YAGNI - migration is complete
**Effort:** Small
**Risk:** None

## Recommended Action

**Option A: Delete the file** - Remove `section-transforms.ts` and its test file. Migration is complete, backward compatibility utilities are no longer needed.

**Triaged:** 2026-02-02 | **Decision:** Delete | **Rationale:** Dead code removal, ~420 lines cleaned up

## Technical Details

**Affected Files:**

- `server/src/lib/section-transforms.ts` - DELETE
- Any test files importing it - UPDATE

**Database Changes:** None

## Acceptance Criteria

- [ ] File deleted
- [ ] No broken imports
- [ ] Tests still pass
- [ ] grep confirms no orphan references

## Work Log

| Date       | Action                   | Learnings                           |
| ---------- | ------------------------ | ----------------------------------- |
| 2026-02-02 | Created from code review | Identified by code-simplicity agent |

## Resources

- PR: `feat/section-content-migration`
