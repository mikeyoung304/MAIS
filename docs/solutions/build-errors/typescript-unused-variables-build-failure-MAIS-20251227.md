---
module: MAIS
date: 2025-12-27
problem_type: build_failure
component: TypeScript configuration
symptoms:
  - Local typecheck passes but Render build fails
  - 49 unused variables across 20 files
  - Error TS6133: 'x' is declared but its value is never read
root_cause: TypeScript config mismatch between local (noUnusedLocals: false) and production (Next.js defaults to true)
resolution_type: prevention_strategy
severity: P1
tags: [typescript, build-errors, noUnusedLocals, noUnusedParameters, underscore-prefix, pre-commit]
---

# TypeScript Unused Variable Build Failure Prevention

## Problem Summary

Local `npm run typecheck` passed but Render/Vercel production build failed with 49 unused variable errors across 20 files. Root cause: mismatched TypeScript strictness settings between local development and production build environments.

## Critical Lesson Learned

**Only prefix with `_` if the variable is TRULY unused in the function body.**

Variables that ARE used (do NOT prefix with `_`):

- Variables passed to logger calls: `logger.info({ error }, 'message')`
- Variables used in assignments: `const result = error.message`
- Variables used in conditionals: `if (error instanceof SomeError)`
- Variables in template literals: `` `Error: ${error}` ``

Variables that are truly unused (OK to prefix with `_`):

- Destructured values you don't need: `const { used, _unused } = obj`
- Callback parameters required by signature: `arr.map((_item, index) => index)`
- Catch block errors when only logging generic message: `catch (_e) { return 'failed' }`

## Configuration Analysis

### Current State (After Fix)

| File                     | noUnusedLocals          | noUnusedParameters      |
| ------------------------ | ----------------------- | ----------------------- |
| `tsconfig.base.json`     | `true`                  | `true`                  |
| `server/tsconfig.json`   | **`false`** (known gap) | `true`                  |
| `client/tsconfig.json`   | `true`                  | `true`                  |
| `apps/web/tsconfig.json` | `true` (explicitly set) | `true` (explicitly set) |
| Next.js production build | `true` (default)        | `true` (default)        |

**The Problem:** `server/tsconfig.json` still has `noUnusedLocals: false` which is looser than other workspaces. This was intentionally kept to avoid disrupting server development, but `apps/web` is now strictly aligned with production.

**The Fix Applied:** Added explicit `noUnusedLocals: true` and `noUnusedParameters: true` to `apps/web/tsconfig.json` to catch issues locally before they reach production.

## Prevention Strategy 1: Align Local TypeScript Configuration

### Option A: Enable in server/tsconfig.json (Recommended)

```json
// server/tsconfig.json
{
  "compilerOptions": {
    "noUnusedLocals": true, // Change from false to true
    "noUnusedParameters": true // Already true, verify
  }
}
```

**Impact:** ~49 errors to fix initially, but prevents future accumulation.

### Option B: Add to apps/web/tsconfig.json

```json
// apps/web/tsconfig.json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Note:** Next.js enables these by default in production builds, but adding explicitly ensures consistency.

## Prevention Strategy 2: Pre-commit Hook Enhancement

Update `.husky/pre-commit` to run typecheck with production strictness:

```bash
#!/bin/sh
set -e

# ... existing checks ...

# Run TypeScript type checking with production strictness
echo "Running TypeScript type check (production mode)..."
npm run typecheck

# Specifically check for unused variables in apps/web
echo "Checking Next.js build compatibility..."
cd apps/web && npx tsc --noEmit --noUnusedLocals --noUnusedParameters

echo "Pre-commit checks passed!"
```

## Prevention Strategy 3: CI/CD Pipeline Check

Add a build verification step to catch unused variables before merge:

```yaml
# .github/workflows/ci.yml or render.yaml enhancement
- name: TypeScript Strict Check
  run: |
    # Check all workspaces with production settings
    npm run typecheck
    # Verify Next.js build will succeed
    cd apps/web && npx next build --no-lint
```

## Prevention Strategy 4: Decision Tree for Underscore Prefix

```
Is the variable used ANYWHERE in the function body?
│
├── YES (used in logger, assignment, conditional, template, etc.)
│   └── DO NOT prefix with _
│       The variable is used. TypeScript won't complain.
│
└── NO (truly never referenced)
    │
    ├── Is it a required function parameter?
    │   ├── YES (callback signature requirement)
    │   │   └── Prefix with _
    │   │       Example: arr.map((_item, index) => index)
    │   │
    │   └── NO (you declared it but don't use it)
    │       └── REMOVE IT
    │           Don't declare variables you don't use.
    │
    └── Is it a destructured value you don't need?
        ├── YES
        │   └── Use rest pattern or prefix with _
        │       Example: const { needed, ..._ } = obj
        │       Example: const { needed, _unneeded } = obj
        │
        └── NO
            └── REMOVE IT
```

## Prevention Strategy 5: Code Review Checklist Addition

Add to PR template:

```markdown
## TypeScript Strictness

- [ ] All declared variables are used (no unused locals)
- [ ] All function parameters are used (or prefixed with `_` if truly unused)
- [ ] Ran `npm run typecheck` locally before pushing
- [ ] Verified `apps/web && npx tsc --noEmit` passes
```

## Quick Fix Script

When encountering unused variable errors, use this analysis script:

```bash
#!/bin/bash
# scripts/find-unused-variables.sh

echo "Finding unused variable declarations..."

# Run TypeScript with strict settings and capture output
npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1 | \
  grep "TS6133\|TS6196" | \
  sort -u | \
  while read -r line; do
    echo "$line"
  done

echo ""
echo "Total unused variables: $(npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1 | grep -c 'TS6133\|TS6196' || echo 0)"
```

## Common Fixes

### Fix 1: Remove truly unused variable

```typescript
// Before (unused)
const { data, error } = await fetchData();
if (data) return data;

// After (error was never used, remove it)
const { data } = await fetchData();
if (data) return data;
```

### Fix 2: Use the variable (don't just prefix)

```typescript
// Before (error is used in logger - NOT unused!)
catch (error) {
  logger.error({ error }, 'Failed to process');
  throw new Error('Processing failed');
}

// This is CORRECT - error IS used (passed to logger)
// Do NOT change to _error - that's wrong
```

### Fix 3: Prefix truly unused callback parameter

```typescript
// Before (index is not used, but item is required by signature)
array.forEach((item, index) => {
  process(item);
});

// After (prefix unused parameter)
array.forEach((item, _index) => {
  process(item);
});

// Or better, if you don't need the parameter at all:
array.forEach((item) => {
  process(item);
});
```

### Fix 4: Use rest pattern for unused destructured values

```typescript
// Before (unneeded values cause unused variable warning)
const { id, name, createdAt, updatedAt, deletedAt } = entity;
// Only using id and name

// After (rest pattern captures unused)
const { id, name, ..._ } = entity;
// Or be explicit
const { id, name } = entity; // Just don't destructure what you don't need
```

## Implementation Checklist

- [ ] Update `server/tsconfig.json` to set `noUnusedLocals: true`
- [ ] Update `apps/web/tsconfig.json` to explicitly set strict unused checks
- [ ] Fix existing 49 unused variable errors
- [ ] Update `.husky/pre-commit` to check Next.js build compatibility
- [ ] Add code review checklist item
- [ ] Document in CLAUDE.md Prevention Strategies section

## Related Documentation

- [TypeScript Build and Seed Drift Prevention](../TYPESCRIPT-BUILD-AND-SEED-DRIFT-PREVENTION.md)
- [Code Quality Prevention Strategies](../CODE-QUALITY-PREVENTION-STRATEGIES.md)
- [ts-rest any type library limitations](../best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md)

## Verification Commands

```bash
# Check for unused variables in entire codebase
npm run typecheck

# Check specifically in apps/web
cd apps/web && npx tsc --noEmit --noUnusedLocals --noUnusedParameters

# Simulate production build
cd apps/web && npm run build

# Count current violations (before fixing)
npx tsc --noEmit --noUnusedLocals 2>&1 | grep -c "TS6133" || echo 0
```
