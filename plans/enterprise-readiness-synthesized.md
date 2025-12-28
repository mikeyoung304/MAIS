# MAIS Enterprise Readiness Plan (Synthesized)

**Source:** Reviewer consensus from DHH-style, Pragmatic, and Simplicity perspectives
**Created:** 2024-12-24
**Status:** Ready for execution

---

## Executive Summary

The original 20-area audit was **over-scoped by 70%**. After multi-agent review:

- 12 areas already solved or YAGNI
- 3 areas need immediate execution (not research)
- 5 areas deferred until actual pain occurs

**Key Finding:** 208 markdown files in `docs/solutions/` is documentation obesity. Phase 1 archives redundant docs.

---

## Phase 1: Documentation Cleanup (Day 1)

### Problem

- 208 files in `docs/solutions/`
- Multiple INDEX/SUMMARY/PREVENTION/QUICK-REFERENCE versions of same topic
- Reviewers unanimous: "Delete documentation, don't add more"

### Files to Archive

**Pattern 1: Redundant Prevention Guides (20 files)**

```
docs/solutions/*-PREVENTION-*.md
```

**Pattern 2: Index Files (14 files)**

```
docs/solutions/*-INDEX*.md
```

**Pattern 3: Summary Files (15 files)**

```
docs/solutions/*-SUMMARY*.md
```

**Pattern 4: Quick Reference Duplicates (17 files)**

```
docs/solutions/*-QUICK-*.md
```

**Pattern 5: Checklist Files (6 files)**

```
docs/solutions/*-CHECKLIST*.md
```

### What to Keep

- `docs/adrs/` - Architecture Decision Records (immutable)
- `docs/solutions/best-practices/` - Consolidated best practices
- `docs/guides/` - How-to guides
- Root docs: ARCHITECTURE.md, CLAUDE.md, DEVELOPING.md, TESTING.md

### Archive Script

```bash
#!/bin/bash
# Run from MAIS root directory

ARCHIVE_DIR="docs/archive/2024-12-solutions"
mkdir -p "$ARCHIVE_DIR"

# Archive redundant patterns
for pattern in "*-PREVENTION-*" "*-INDEX*" "*-SUMMARY*" "*-QUICK-*" "*-CHECKLIST*"; do
  find docs/solutions -maxdepth 1 -name "$pattern.md" -exec mv {} "$ARCHIVE_DIR/" \;
done

# Keep essential files by moving back
# (best-practices subdirectory is untouched)

echo "Archived $(ls -1 $ARCHIVE_DIR | wc -l) files"
echo "Remaining in docs/solutions: $(find docs/solutions -name '*.md' | wc -l)"
```

---

## Phase 2: Immediate Fixes (Days 2-3)

### 2.1 Fix Failing Tests

**Priority:** P0 | **Effort:** 2-4 hours

```bash
# Identify failures
npm test 2>&1 | grep -E "FAIL|Error" | head -20

# Fix incrementally
npm test -- --watch
```

### 2.2 ESLint Rules

**Priority:** P1 | **Effort:** 30 minutes

```bash
# Add to .eslintrc or package.json eslintConfig
{
  "rules": {
    "no-console": ["error", { "allow": ["warn", "error"] }],
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

```bash
# Auto-fix what's possible
npm run lint -- --fix
```

### 2.3 Error Boundary

**Priority:** P1 | **Effort:** 30 minutes

Create `client/src/components/ErrorBoundary.tsx` if not exists, wrap App root.

### 2.4 Accessibility Quick Pass

**Priority:** P1 | **Effort:** 4 hours

```bash
# Install axe-core for Playwright
npm install -D @axe-core/playwright

# Add to E2E tests
import { injectAxe, checkA11y } from '@axe-core/playwright';
```

Run on 5 critical pages: homepage, booking, checkout, admin dashboard, login.

---

## Phase 3: Frontend Test Coverage (Days 4-5)

### Critical Flows to Test

1. **Auth flow:** signup → login → logout
2. **Booking flow:** select package → choose date → checkout
3. **Admin flow:** login → manage packages → view bookings

### Test Pattern

```typescript
// client/src/features/auth/__tests__/auth-flow.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../AuthContext';
import LoginForm from '../LoginForm';

describe('Auth Flow', () => {
  it('logs in with valid credentials', async () => {
    // Test implementation
  });
});
```

### Coverage Target

- 3 integration tests for critical user journeys
- Focus on flow coverage, not line coverage

---

## Phase 4: Database Constraints (Day 6)

### Add Missing FK Constraints

```bash
cd server
npm exec prisma migrate dev --name add-cascade-constraints
```

### Verify Cascade Behavior

```sql
-- Test tenant deletion cascades
BEGIN;
DELETE FROM "Tenant" WHERE id = 'test-tenant-id';
-- Verify child records deleted
SELECT COUNT(*) FROM "Booking" WHERE "tenantId" = 'test-tenant-id';
ROLLBACK;
```

---

## Deferred (Do When It Hurts)

| Area                    | Trigger                  | Action                   |
| ----------------------- | ------------------------ | ------------------------ |
| Type Safety             | Touch file with `as any` | Fix that instance        |
| Performance             | Lighthouse score < 80    | Run bundle analysis      |
| Index Optimization      | Query > 100ms            | Add specific index       |
| Component Deduplication | 3rd copy created         | Extract shared component |
| API Versioning          | Breaking change needed   | Add /v2 endpoint         |

---

## Deleted from Original Plan

| Area                        | Reason                            |
| --------------------------- | --------------------------------- |
| God Component Decomposition | Already refactored (git: dd59512) |
| Cascade Deletion Research   | Already implemented               |
| Webhook Reliability         | Already built (ADR-009)           |
| API Documentation           | Already exists (api-docs.ts)      |
| Error Boundaries            | Already implemented               |
| Distributed Tracing         | YAGNI - monolith architecture     |
| File Size Limits            | Cargo cult engineering            |
| Contract Versioning         | No external consumers             |
| Documentation Gap Analysis  | Need less docs, not more          |
| Metrics Dashboard           | Premature - no production traffic |

---

## Success Criteria

- [ ] docs/solutions reduced from 208 to <50 files
- [ ] All tests passing (currently some failing)
- [ ] ESLint no-console rule active
- [ ] axe-core in E2E pipeline
- [ ] 3 frontend integration tests for critical flows
- [ ] FK constraints verified

---

## Timeline

| Day | Focus           | Deliverable               |
| --- | --------------- | ------------------------- |
| 1   | Doc cleanup     | 70+ files archived        |
| 2-3 | Immediate fixes | Tests green, ESLint rules |
| 4-5 | Frontend tests  | 3 integration tests       |
| 6   | DB constraints  | Migration applied         |

**Total:** 6 days of focused execution, not 20 research areas.

---

## Appendix: Archive Script (Full)

```bash
#!/bin/bash
# archive-redundant-docs.sh
# Run from MAIS root: ./scripts/archive-redundant-docs.sh

set -e

ARCHIVE_DIR="docs/archive/2024-12-solutions-cleanup"
SOLUTIONS_DIR="docs/solutions"

echo "=== MAIS Documentation Cleanup ==="
echo "Archiving redundant documentation patterns..."

# Create archive directory
mkdir -p "$ARCHIVE_DIR"

# Count before
BEFORE=$(find "$SOLUTIONS_DIR" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')
echo "Files before: $BEFORE"

# Patterns to archive (redundant meta-documentation)
PATTERNS=(
  "*-PREVENTION-*.md"
  "*-INDEX.md"
  "*-SUMMARY.md"
  "*-QUICK-*.md"
  "*-CHECKLIST*.md"
  "*-PATTERN*.md"
)

ARCHIVED=0
for pattern in "${PATTERNS[@]}"; do
  for file in $SOLUTIONS_DIR/$pattern; do
    if [[ -f "$file" ]]; then
      filename=$(basename "$file")
      # Skip if it's the main prevention index (keep one reference)
      if [[ "$filename" == "PREVENTION-STRATEGIES-INDEX.md" ]]; then
        continue
      fi
      mv "$file" "$ARCHIVE_DIR/"
      ((ARCHIVED++))
      echo "  Archived: $filename"
    fi
  done
done

# Count after
AFTER=$(find "$SOLUTIONS_DIR" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')

echo ""
echo "=== Summary ==="
echo "Archived: $ARCHIVED files"
echo "Before: $BEFORE files"
echo "After: $AFTER files"
echo "Archive location: $ARCHIVE_DIR"
echo ""
echo "To undo: mv $ARCHIVE_DIR/*.md $SOLUTIONS_DIR/"
```

---

_Synthesized from 3 expert reviews. Ship the product._
