# Workspace Package Resolution Failure in Vitest

**Category:** Build Errors / Test Infrastructure
**Severity:** P2 (21 test suites silently broken)
**Date:** 2026-02-05

## Problem

Monorepo workspace packages (`@macon/contracts`, `@macon/shared`) have their `package.json` exports pointing to `dist/index.js`. Since `dist/` is gitignored, tests fail with:

```
Error: Failed to resolve entry for package "@macon/contracts".
The package may have incorrect main/module/exports specified in its package.json.
```

### Why It's Insidious

- Tests fail at **import time**, not test time — the entire suite is skipped
- Individual test counts look healthy (1,704 passing!) but 405 tests never run
- The issue is **intermittent**: passes locally if you've ever built, fails on fresh clone or CI
- `continue-on-error` in CI can mask this entirely (Pitfall #58)

## Root Cause

```
Import chain:
  test file → import '@macon/contracts'
            → node_modules/@macon/contracts (symlink → ../../packages/contracts)
            → packages/contracts/package.json → exports → dist/index.js
            → dist/index.js MISSING → ❌ resolution error
```

The `dist/` folder is a build artifact (`tsc -b --force`), but it's gitignored. npm workspaces creates a symlink that points to the package root, and Node's resolution reads `package.json` exports pointing to `dist/`.

## Solution

Add Vite aliases in `server/vitest.config.ts` to resolve from TypeScript source:

```typescript
resolve: {
  alias: [
    // ... existing Prisma alias ...
    {
      find: '@macon/contracts',
      replacement: path.resolve(__dirname, '../packages/contracts/src/index.ts'),
    },
    {
      find: '@macon/shared',
      replacement: path.resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  ],
},
```

### Why This Works

- Vite aliases take precedence over Node's `package.json` resolution
- Vitest handles TypeScript natively — no compilation needed
- Tests are now **completely decoupled** from the build step
- Production builds still use `dist/` via the `vercel-build` script

### Why NOT `pretest` Script

The alternative (`"pretest": "npm run build -w @macon/contracts"`) was rejected because:

1. Adds 2-3 seconds to every test run
2. Hides the real design problem (coupling tests to build artifacts)
3. Still fails if build has errors — cascading failure
4. Source aliases are the idiomatic Vite/Vitest approach

## Impact

| Metric            | Before                | After                  |
| ----------------- | --------------------- | ---------------------- |
| Test suites       | 79 passed / 21 failed | 99 passed / 0 failed   |
| Individual tests  | 1,704                 | 2,109 (+405 recovered) |
| Requires `dist/`  | Yes                   | No                     |
| Fresh clone tests | ❌ Broken             | ✅ Works               |

## Detection

If you see this error pattern in the future:

```bash
# Check if dist/ exists
ls packages/contracts/dist/index.js
ls packages/shared/dist/index.js

# Check Vitest aliases
grep -A 5 '@macon/contracts' server/vitest.config.ts
```

## Prevention

1. **Vitest aliases for all workspace packages** — always resolve from source in tests
2. **Never rely on `dist/` for dev/test workflows** — only production builds should use compiled output
3. **Monitor test suite count** — if total suites drops, import-time failures are likely hiding tests
4. **CI must NOT use `continue-on-error` on test steps** (Pitfall #58)

## Related

- `docs/solutions/deployment-issues/vercel-vite-monorepo-typescript-incremental-cache.md` — same root cause on Vercel
- Pitfall #58: Silent CI failures via `continue-on-error`
- `server/vitest.config.ts` — the fix location
