# Fix 21 Failing Test Suites: @macon/contracts Resolution

**ID:** contracts-test-resolution
**Status:** pending
**Priority:** p2
**Created:** 2026-02-04

## Problem

21 test suites consistently fail with:

```
Error: Failed to resolve entry for package "@macon/contracts".
The package may have incorrect main/module/exports specified in its package.json.
```

This affects ALL test files that import from `@macon/contracts`:

- `test/contracts/section-id.test.ts`
- `test/http/*.test.ts` (8 files)
- `test/integration/*.spec.ts` (3 files)
- `test/schemas/*.test.ts` (3 files)
- `test/routes/*.spec.ts`
- `test/adapters/prisma/tenant.repository.spec.ts`
- `test/prevention/deployment-prevention.test.ts`
- `src/services/section-content.service.test.ts`

## Root Cause

Vitest resolves `@macon/contracts` to `packages/contracts/dist/index.js`, but when `dist/` is stale or missing, resolution fails. The `package.json` exports are correct, but the compiled artifacts need to exist.

## Existing Documentation

- `docs/solutions/deployment-issues/vercel-vite-monorepo-typescript-incremental-cache.md`

## Proposed Fix

1. Add `npm run --workspace=packages/contracts build` as a `pretest` script in root `package.json`
2. OR configure Vitest to resolve `@macon/contracts` via source (`src/index.ts`) instead of `dist/`
3. Verify all 21 suites pass after fix

## Impact

- 21 test suites (out of 100) always fail
- 1704 individual tests still pass (these suites fail at import, not at test level)
- CI may be using `continue-on-error` to mask this (Pitfall #58)
