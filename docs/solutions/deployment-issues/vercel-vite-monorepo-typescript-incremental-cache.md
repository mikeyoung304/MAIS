# Vercel Deployment Failure: Vite Monorepo TypeScript Incremental Build Cache

---

title: "Vercel Deployment Failure: Vite Monorepo TypeScript Incremental Build Cache"
date: 2025-11-26
category: deployment-issues
tags:

- vercel
- monorepo
- typescript
- build-errors
- vite
- npm-workspaces
- tsbuildinfo
- incremental-build
  components:
- vercel.json
- packages/contracts
- packages/shared
- client/vite.config.ts
- TypeScript build system
  symptoms:
- "Failed to resolve entry for package @macon/contracts"
- "EISDIR: illegal operation on a directory, read"
- "ENOENT: no such file or directory, open '.../dist/index.js'"
- Build succeeds locally but fails on Vercel
- Missing dist/ directories after TypeScript compilation
  severity: high
  time_to_resolve: "2-3 hours"
  related:
- build-errors/typescript-incremental-compilation
- configuration-issues/vite-monorepo-vercel-setup

---

## Problem Summary

Vercel deployment fails for a Vite + React monorepo with npm workspaces. TypeScript's incremental build cache (`.tsbuildinfo`) causes `tsc -b` to skip compilation in CI environments, leaving `dist/` folders empty.

## Error Progression

Three distinct errors appeared during debugging:

### 1. Initial Error: Module Resolution Failure

```
[commonjs--resolver] Failed to resolve entry for package "@macon/contracts".
The package may have incorrect main/module/exports specified in its package.json.
```

### 2. Second Error: Directory Read Failure

```
[vite:load-fallback] Could not load /vercel/path0/packages/contracts/dist
(imported by src/lib/api.ts): EISDIR: illegal operation on a directory, read
```

### 3. Final Error: Missing Files

```
[vite:load-fallback] Could not load /vercel/path0/packages/contracts/dist/index.js
(imported by src/lib/api.ts): ENOENT: no such file or directory
```

## Root Cause Analysis

### The Problem Chain

1. **TypeScript Incremental Builds**: `tsc -b` (build mode) uses `.tsbuildinfo` files to track compilation state
2. **Stale Cache on Vercel**: In Vercel's build environment, these cache files caused `tsc -b` to incorrectly assume no compilation was needed
3. **Missing Output Files**: TypeScript skipped compilation, leaving `dist/index.js` files non-existent
4. **Vite Resolution Failure**: Vite's bundler couldn't find the workspace package entry points

### Why It Worked Locally

- Local builds had existing `dist/` folders from previous compilations
- The `.tsbuildinfo` cache was in sync with source files
- npm workspaces created symlinks in `node_modules/` pointing to package directories

### Why It Failed on Vercel

- Fresh clone has no `dist/` folders
- Vercel's build cache restored stale `.tsbuildinfo` files
- `tsc -b` checked cache, saw "up to date", skipped compilation
- No `dist/` output was generated

## Solution

### Step 1: Force TypeScript Compilation

**File:** `packages/contracts/package.json`

```json
{
  "scripts": {
    "build": "tsc -b --force",
    "typecheck": "tsc -b --noEmit"
  }
}
```

**File:** `packages/shared/package.json`

```json
{
  "scripts": {
    "build": "tsc -b --force",
    "typecheck": "tsc -b --noEmit"
  }
}
```

**Why:** The `--force` flag tells TypeScript to ignore `.tsbuildinfo` cache and unconditionally recompile all files.

### Step 2: Point Vite Aliases to Specific Files

**File:** `client/vite.config.ts`

```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Point to specific .js files, NOT directories
      '@macon/contracts': path.resolve(__dirname, '../packages/contracts/dist/index.js'),
      '@macon/shared': path.resolve(__dirname, '../packages/shared/dist/index.js'),
    },
  },
});
```

**Why:** Vite's module resolution in production builds requires explicit file paths. Directory references work in Node.js but fail in Vite's optimized bundling.

### Step 3: Configure Package Exports (Already Correct)

**File:** `packages/contracts/package.json`

```json
{
  "name": "@macon/contracts",
  "type": "module",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

## Prevention Strategies

### 1. Always Use `--force` in CI/CD

```json
{
  "scripts": {
    "build": "tsc -b --force",
    "build:dev": "tsc -b"
  }
}
```

### 2. Test Clean Builds Locally

```bash
# Simulate Vercel's clean environment
rm -rf packages/*/dist packages/*/.tsbuildinfo client/dist

# Run the exact Vercel build command
npm run build --workspace=@macon/contracts && \
npm run build --workspace=@macon/shared && \
npm run build --workspace=@macon/web

# Verify outputs exist
ls packages/contracts/dist/index.js
ls packages/shared/dist/index.js
ls client/dist/index.html
```

### 3. Pre-Deployment Checklist

- [ ] Build scripts use `--force` flag
- [ ] Vite aliases point to `.js` files (not directories)
- [ ] Local clean build succeeds
- [ ] All `dist/` folders contain expected files
- [ ] TypeScript type checking passes

### 4. Vercel Build Cache

If experiencing intermittent failures, disable Vercel's build cache:

- Vercel Dashboard → Project → Settings → Build & Development Settings
- Uncheck "Use Build Cache"

## Key Files Reference

| File                              | Purpose                            |
| --------------------------------- | ---------------------------------- |
| `packages/contracts/package.json` | Build script with `--force`        |
| `packages/shared/package.json`    | Build script with `--force`        |
| `client/vite.config.ts`           | Vite aliases to `.js` files        |
| `vercel.json`                     | Sequential workspace build command |

## Troubleshooting Quick Reference

### Symptom → Solution

| Symptom                           | Likely Cause                   | Solution                        |
| --------------------------------- | ------------------------------ | ------------------------------- |
| "Cannot resolve @macon/contracts" | Missing `dist/`                | Add `--force` to build script   |
| "EISDIR: illegal operation"       | Alias points to directory      | Change alias to `dist/index.js` |
| "ENOENT: no such file"            | TypeScript skipped compilation | Add `--force` to build script   |
| Works locally, fails on Vercel    | Stale `.tsbuildinfo` cache     | Add `--force` to build script   |

## Related Documentation

- [Vite Troubleshooting Guide](https://vitejs.dev/guide/troubleshooting.html)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Vercel Monorepo Support](https://vercel.com/docs/concepts/git/monorepos)
- [npm Workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)

## Commits That Fixed This

- `e9354f7` - fix(packages): add --force flag to tsc -b for clean Vercel builds
- `4dcc992` - fix(client): point alias to dist/index.js instead of dist directory
- `7b1bc08` - fix(packages): improve ESM exports for Vercel build compatibility
