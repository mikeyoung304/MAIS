---
title: CI Test Discovery Failure and Per-Directory Coverage Thresholds
category: ci-cd
severity: P2
date_solved: 2026-02-06
related_pitfalls: [79, 84]
related_commits: [6be2c6da, 91eb6801]
tags: [vitest, coverage, ci, test-discovery, thresholds]
---

# CI Test Discovery Failure and Per-Directory Coverage Thresholds

## Symptom

CI coverage check fails with:

```
ERROR: Coverage for lines (27.42%) does not meet global threshold (28%)
ERROR: Coverage for statements (27.42%) does not meet global threshold (28%)
```

Despite having written 15 new tests locally that pass and improve coverage to ~32%.

## Investigation

1. Tests pass locally with `npm run test:coverage` — coverage shows 32%+
2. CI shows identical 27.42% before AND after adding tests
3. The new test file was at `server/src/lib/slot-machine.test.ts`

## Root Cause (Two Issues)

### Issue 1: CI `test:unit` Only Scans `test/` Directory

The root `package.json` defines:

```json
"test:unit": "npm run test --workspace=server -- test/ --exclude=\"test/integration/**\" --exclude=\"test/http/**\""
```

The `test/` positional argument tells vitest to **only discover tests** inside `server/test/`. Any test file placed in `server/src/` is invisible to CI, even though `npm run test:coverage` (which runs ALL tests) picks it up locally.

**Why local looked different:** `npm run test:coverage` in the server workspace runs vitest without a path filter, scanning both `src/` and `test/`. CI's `test:unit` restricts to `test/` only.

### Issue 2: Single Global Threshold Is Meaningless

After moving the test file to `server/test/lib/`, coverage went from 27.42% to 27.44%. The 15 tests improved the slot-machine module significantly, but the global average barely moved because it's diluted across the entire codebase.

A single global threshold (28%) creates two bad outcomes:

- **Too high:** Forces writing low-value tests just to hit an arbitrary number
- **Too low:** Well-tested modules (validation at 100%, LLM at 87%) get no protection against regression

## Solution

### Fix 1: Move Test Files to `test/` Directory

```bash
# Move to follow CI convention
mkdir -p server/test/lib/
mv server/src/lib/slot-machine.test.ts server/test/lib/slot-machine.test.ts
```

Update import paths from relative to project-relative:

```typescript
// Before (in src/lib/)
import { computeSlotMachine } from './slot-machine';

// After (in test/lib/)
import { computeSlotMachine } from '../../src/lib/slot-machine';
```

### Fix 2: Per-Directory Coverage Thresholds

Replace the single global threshold with risk-based per-directory thresholds in `server/vitest.config.ts`:

```typescript
thresholds: {
  // Global floor — catches new directories without explicit thresholds
  lines: 25,
  branches: 55,
  functions: 30,
  statements: 25,

  // Business logic — highest standards
  'src/services/**': { lines: 33, branches: 75, functions: 45, statements: 33 },

  // Core library
  'src/lib/**': { lines: 50, branches: 80, functions: 40, statements: 50 },

  // LLM utilities — well-tested, protect against regression
  'src/llm/**': { lines: 80, branches: 85, functions: 70, statements: 80 },

  // Middleware
  'src/middleware/**': { lines: 50, branches: 60, functions: 15, statements: 50 },

  // Validation — perfect, keep it
  'src/validation/**': { lines: 95, branches: 95, functions: 95, statements: 95 },
},
```

**Setting thresholds:** Measure current coverage from a CI run (not local), then set ~5% below current. Ratchet UP as tests are added, never down.

**Important:** CI runs `test:unit` (unit tests only) and `test:integration` separately. Thresholds must be achievable by `test:unit` alone, not the aggregate. Local `npm run test:coverage` runs everything and reports inflated numbers.

## Prevention

### Before Writing Tests

1. **Place test files in `server/test/`**, not `server/src/`
2. Mirror the source path: `src/lib/foo.ts` → `test/lib/foo.test.ts`
3. Verify discovery: `npm run test:unit 2>&1 | grep "your-test-file"`

### Before Adjusting Thresholds

1. Get coverage from CI, not local (CI runs unit tests only)
2. Set threshold ~5% below current CI value
3. Add a comment with the measurement date and actual value
4. New directories get explicit thresholds when they have meaningful tests

### Detection Checklist

```bash
# Verify a test file is discovered by CI's test:unit
npm run --workspace=server test -- test/ --exclude="test/integration/**" --exclude="test/http/**" --reporter=verbose 2>&1 | grep "slot-machine"

# Check per-directory coverage locally (approximates CI)
npm run --workspace=server test -- test/ --exclude="test/integration/**" --exclude="test/http/**" --coverage
```

## Cross-References

- `QUALITY-GATES-QUICK-START.md` — Overall quality gate documentation (thresholds may be outdated)
- `SILENT_CI_FAILURES_PREVENTION.md` — Related CI failure patterns (Pitfall #52)
- `ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md` — Clean build before committing (Pitfall #79)
- Pitfall #84 — Root-level typecheck passes but workspace fails
