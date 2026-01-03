# Turbopack HMR Cache Conflict After Production Build

**Date:** 2026-01-02
**Severity:** P1 (appears as "app broken" but is recoverable)
**Category:** Build Errors / Development Environment

## Problem

After running `npm run build` (production build) and then switching back to `npm run dev` (Turbopack dev mode), the app appears completely broken with errors like:

```
Error: ENOENT: no such file or directory, open '.next/server/app/page/app-build-manifest.json'
```

Or HMR errors in the browser:

```
Error: Module [...] was instantiated because it was required from [...], but the module factory is not available. It might have been deleted in an HMR update.
```

The page may show "missing required error components, refreshing..." and never load.

## Root Cause

Turbopack (used in `next dev --turbo`) and the production builder create **different `.next` folder structures**:

| Mode                           | Manifest Location                               | Structure              |
| ------------------------------ | ----------------------------------------------- | ---------------------- |
| Production (`next build`)      | `.next/server/app-build-manifest.json`          | Optimized, bundled     |
| Turbopack (`next dev --turbo`) | `.next/server/app/page/app-build-manifest.json` | Per-route, incremental |

When you run `npm run build` then `npm run dev`:

1. Production build creates its `.next` structure
2. Turbopack starts and finds some cached files
3. Turbopack tries to read manifests from its expected locations
4. File not found → ENOENT error → app appears broken

Additionally, if you removed a dependency (like `@tanstack/react-query-devtools`), the browser's cached module graph may still reference it, causing HMR hydration errors.

## Solution

### Quick Fix (Local Development)

```bash
# Kill all node processes
pkill -f "next dev" 2>/dev/null

# Delete all caches
cd apps/web && rm -rf .next .turbo node_modules/.cache

# Restart dev server fresh
npm run dev
```

### Full Recovery (If Quick Fix Doesn't Work)

```bash
# Nuclear option: kill all node and clear everything
pkill -9 -f node
cd apps/web && rm -rf .next .turbo node_modules/.cache
npm run dev
```

### Browser Cache Issues

If the dev server works but browser shows HMR errors:

1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Open DevTools → Application → Clear Site Data
3. Close and reopen the browser tab

## Prevention

### Do Not Mix Build Modes Carelessly

```bash
# BAD: Running build then dev without clearing
npm run build
npm run dev  # Will likely break

# GOOD: Clear .next before switching modes
npm run build
rm -rf .next  # Clear before dev
npm run dev
```

### Separate Build Testing

If you need to test production builds locally:

```bash
# Test production in isolation
npm run build && npm run start

# When done, clear before returning to dev
rm -rf .next
npm run dev
```

### Add to Package Scripts (Optional)

```json
{
  "scripts": {
    "dev:clean": "rm -rf .next && npm run dev",
    "build:clean": "rm -rf .next && npm run build"
  }
}
```

## Detection

Signs this is happening:

- App worked before, suddenly "broken"
- You recently ran `npm run build` or `npm run typecheck`
- Error mentions `app-build-manifest.json` or similar manifests
- Browser shows HMR module errors after removing a dependency

## Related Issues

- **Removing devDependencies:** When removing a devDependency (like React Query devtools), the browser's cached module graph may still reference it. The fix is the same: clear caches and restart.

- **VS Code TypeScript Errors:** VS Code may cache old types. Run "TypeScript: Restart TS Server" from command palette.

## Key Insight

The `.next` folder is **mode-specific**. Turbopack and production builds are not compatible - never assume you can switch between them without clearing the cache.

## References

- Next.js Turbopack docs: https://nextjs.org/docs/architecture/turbopack
- Commit that triggered this: `07746140` (removing React Query devtools)
