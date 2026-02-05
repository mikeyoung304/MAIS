# Fix 21 Failing Test Suites: @macon/contracts Resolution

**ID:** contracts-test-resolution
**Status:** complete
**Priority:** p2
**Created:** 2026-02-04
**Completed:** 2026-02-05

## Problem

21 test suites consistently fail with:

```
Error: Failed to resolve entry for package "@macon/contracts".
The package may have incorrect main/module/exports specified in its package.json.
```

## Root Cause

Vitest resolves `@macon/contracts` to `packages/contracts/dist/index.js`, but `dist/` is gitignored. Fresh clones, CI environments, and stale builds have no `dist/` → 21 suites fail at import time.

## Fix Applied

Added Vite aliases in `server/vitest.config.ts` to resolve workspace packages from TypeScript source instead of compiled dist/:

```typescript
{ find: '@macon/contracts', replacement: path.resolve(__dirname, '../packages/contracts/src/index.ts') },
{ find: '@macon/shared', replacement: path.resolve(__dirname, '../packages/shared/src/index.ts') },
```

## Result

- **Before:** 79 passed / 21 failed (1,704 tests)
- **After:** 99 passed / 0 failed (2,109 tests — 405 recovered)

## Solution Doc

- `docs/solutions/build-errors/WORKSPACE_PACKAGE_VITEST_RESOLUTION.md`
