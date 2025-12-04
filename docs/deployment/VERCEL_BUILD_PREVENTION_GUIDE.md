# Vercel Build Prevention Guide

**Version:** 1.0
**Last Updated:** November 26, 2025
**Status:** Active
**Owner:** Platform Engineering
**Audience:** DevOps, Platform Engineers, CI/CD Maintainers

---

## Executive Summary

This guide documents prevention strategies for the critical Vercel/Vite monorepo build failure that occurred when TypeScript incremental builds cached compilation results, causing Vercel to skip compilation and leaving no `dist/` folder for Vite to resolve.

**Root Cause:** TypeScript's `.tsbuildinfo` cache files caused `tsc -b` to skip compilation on Vercel, breaking Vite's package resolution.

**Impact Prevention Strategies:**

1. Force compilation in CI/CD with `--force` flag
2. Use explicit file paths in Vite aliases (not directories)
3. Implement pre-deployment verification
4. Configure Vercel build cache appropriately

---

## 1. Build Script Best Practices

### 1.1 When to Use `--force` Flag

**Critical Rule:** Always use `--force` in CI/CD environments to bypass incremental compilation cache.

#### Current Implementation (Correct)

```json
// packages/contracts/package.json
{
  "scripts": {
    "build": "tsc -b --force",
    "typecheck": "tsc -b --noEmit"
  }
}
```

```json
// packages/shared/package.json
{
  "scripts": {
    "build": "tsc -b --force",
    "typecheck": "tsc -b --noEmit"
  }
}
```

**Why This Works:**

- `--force` rebuilds all projects regardless of cache state
- Guarantees `dist/` folders exist with fresh compilation
- Prevents stale `.tsbuildinfo` from causing false cache hits
- Minimal performance impact on CI (clean environment each time)

#### Anti-Pattern (Previous Broken Implementation)

```json
// ❌ WRONG - No --force flag
{
  "scripts": {
    "build": "tsc -b"
  }
}
```

**What Happens:**

1. Vercel caches `packages/*/tsconfig.tsbuildinfo` between builds
2. TypeScript sees cached `.tsbuildinfo` and thinks compilation is up-to-date
3. Skips compilation, no `dist/` folder created
4. Vite fails to resolve `@macon/contracts` → build failure

### 1.2 Alternatives to `--force`

If you need to avoid `--force` for performance reasons (rare), use these alternatives:

#### Option 1: Clean `.tsbuildinfo` Files

```json
{
  "scripts": {
    "clean": "rm -f tsconfig.tsbuildinfo",
    "build": "npm run clean && tsc -b"
  }
}
```

#### Option 2: Environment-Specific Scripts

```json
{
  "scripts": {
    "build": "tsc -b --force", // CI/CD
    "build:dev": "tsc -b", // Local development (fast)
    "typecheck": "tsc -b --noEmit"
  }
}
```

#### Option 3: Vercel Build Command Override

```json
// vercel.json
{
  "buildCommand": "rm -rf packages/*/dist packages/*/.tsbuildinfo && npm run build --workspace=@macon/contracts && npm run build --workspace=@macon/shared && npm run build --workspace=@macon/web"
}
```

**Recommendation:** Stick with `--force` unless you have proven performance bottlenecks (build times > 5 minutes).

---

## 2. Monorepo Package Resolution

### 2.1 Vite Alias Configuration Best Practices

**Critical Rule:** Point Vite aliases to specific `.js` files, NOT directories.

#### Current Implementation (Correct)

```typescript
// client/vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // ✅ Point to specific index.js files
      '@macon/contracts': path.resolve(__dirname, '../packages/contracts/dist/index.js'),
      '@macon/shared': path.resolve(__dirname, '../packages/shared/dist/index.js'),
    },
  },
});
```

**Why This Works:**

- Vite resolves directly to compiled JavaScript (no module resolution ambiguity)
- Fails fast if `dist/index.js` doesn't exist (clear error)
- ESM modules require `.js` extension for explicit imports
- No reliance on `package.json` `exports` field during Vite dev

#### Anti-Pattern (Previous Broken Implementation)

```typescript
// ❌ WRONG - Points to directory, relies on implicit resolution
{
  alias: {
    "@macon/contracts": path.resolve(__dirname, "../packages/contracts/dist"),
    "@macon/shared": path.resolve(__dirname, "../packages/shared/dist"),
  }
}
```

**What Happens:**

1. Vite tries to resolve directory → checks `package.json` `main` → ambiguous
2. If `dist/` doesn't exist, error is delayed until import time
3. Module format mismatches (CommonJS vs ESM) can cause silent failures

### 2.2 Package.json `exports` Field Configuration

While Vite aliases point to `.js` files, `package.json` should still define proper `exports` for Node.js resolution:

```json
// packages/contracts/package.json
{
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

**Key Points:**

- `"type": "module"` declares ESM package
- `exports` field provides explicit entry points
- `types` ensures TypeScript finds `.d.ts` files
- `default` catches any resolution fallback

### 2.3 TypeScript Composite Project Configuration

```json
// packages/contracts/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true // Enables TypeScript project references
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Composite Projects:**

- `"composite": true` enables `.tsbuildinfo` generation
- Required for `tsc -b` (build mode)
- Enables incremental compilation for faster local dev
- **Must use `--force` in CI to bypass cache**

---

## 3. Testing & Verification

### 3.1 Local Build Simulation

**Before deploying to Vercel, always test the build locally:**

```bash
# Simulate Vercel's clean build environment
rm -rf packages/*/dist packages/*/.tsbuildinfo client/dist

# Run the exact build sequence Vercel uses
npm run build --workspace=@macon/contracts
npm run build --workspace=@macon/shared
npm run build --workspace=@macon/web

# Verify dist folders exist
ls -la packages/contracts/dist/index.js
ls -la packages/shared/dist/index.js
ls -la client/dist/index.html
```

**Expected Output:**

```
packages/contracts/dist/index.js    (exists)
packages/shared/dist/index.js       (exists)
client/dist/index.html              (exists)
```

**If any file is missing:**

1. Check package build script has `--force` flag
2. Verify `tsconfig.json` has correct `outDir`
3. Check for TypeScript compilation errors

### 3.2 Pre-Deployment Checklist

Before every Vercel deployment:

- [ ] **Build scripts use `--force` flag**

  ```bash
  grep -r '"build":.*--force' packages/*/package.json
  ```

- [ ] **Vite aliases point to `.js` files**

  ```bash
  grep 'alias:' client/vite.config.ts | grep '\.js'
  ```

- [ ] **Local clean build succeeds**

  ```bash
  rm -rf packages/*/dist client/dist && npm run build
  ```

- [ ] **All dist folders exist**

  ```bash
  [ -f packages/contracts/dist/index.js ] && echo "✅ contracts"
  [ -f packages/shared/dist/index.js ] && echo "✅ shared"
  [ -f client/dist/index.html ] && echo "✅ client"
  ```

- [ ] **TypeScript types resolve correctly**
  ```bash
  npm run typecheck  # Should pass with no errors
  ```

### 3.3 Automated Verification Script

Create a pre-commit or CI script:

```bash
#!/bin/bash
# scripts/verify-build.sh

set -e

echo "🧹 Cleaning build artifacts..."
rm -rf packages/*/dist packages/*/.tsbuildinfo client/dist

echo "🔨 Building packages..."
npm run build --workspace=@macon/contracts
npm run build --workspace=@macon/shared

echo "✅ Verifying dist folders..."
if [ ! -f packages/contracts/dist/index.js ]; then
  echo "❌ ERROR: contracts/dist/index.js not found"
  exit 1
fi

if [ ! -f packages/shared/dist/index.js ]; then
  echo "❌ ERROR: shared/dist/index.js not found"
  exit 1
fi

echo "🔨 Building client..."
npm run build --workspace=@macon/web

if [ ! -f client/dist/index.html ]; then
  echo "❌ ERROR: client/dist/index.html not found"
  exit 1
fi

echo "✅ All builds verified successfully!"
```

**Usage:**

```bash
chmod +x scripts/verify-build.sh
./scripts/verify-build.sh
```

**Add to package.json:**

```json
{
  "scripts": {
    "verify-build": "bash scripts/verify-build.sh"
  }
}
```

---

## 4. Vercel-Specific Considerations

### 4.1 Build Cache Behavior

**How Vercel Caching Works:**

1. Vercel caches `node_modules/` between builds (controlled by `package-lock.json` hash)
2. Vercel does NOT cache `dist/` folders by default
3. Vercel MAY cache `.tsbuildinfo` files if not in `.gitignore`

**Current .gitignore (Correct):**

```gitignore
# Build outputs
dist
build

# (No .tsbuildinfo entry - files get committed/cached)
```

**Issue:** `.tsbuildinfo` files are NOT ignored, so they can be cached by Vercel.

**Solution:** Build scripts use `--force` to bypass cache (preferred over adding to `.gitignore`).

### 4.2 When to Disable Vercel Build Cache

**Disable cache if:**

- Experiencing intermittent build failures
- Deploying after major dependency updates
- Debugging monorepo build issues

**How to Disable:**

#### Option 1: Via Vercel Dashboard

1. Go to Project Settings → Build & Development Settings
2. Disable "Use Build Cache"

#### Option 2: Via `vercel.json`

```json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "cache": false // ⚠️ Increases build time
      }
    }
  ]
}
```

**Recommendation:** Keep cache enabled, rely on `--force` flag instead.

### 4.3 Vercel.json Best Practices for Monorepos

#### Current Configuration (Production-Ready)

```json
// vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "npm ci --workspaces --include-workspace-root",
  "buildCommand": "npm run build --workspace=@macon/contracts && npm run build --workspace=@macon/shared && npm run build --workspace=@macon/web",
  "outputDirectory": "client/dist",
  "rewrites": [
    { "source": "/widget/(.*)", "destination": "/widget/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Key Points:**

1. **`installCommand`**: Use `npm ci` (not `npm install`) for reproducible builds
   - `--workspaces` installs all workspace dependencies
   - `--include-workspace-root` installs root devDependencies

2. **`buildCommand`**: Sequential workspace builds (dependency order)
   - Build `@macon/contracts` first (no dependencies)
   - Build `@macon/shared` second (may depend on contracts)
   - Build `@macon/web` last (depends on both)

3. **`outputDirectory`**: Points to Vite's `client/dist` output
   - Vercel serves static files from this directory
   - Must match `client/vite.config.ts` `build.outDir`

4. **`rewrites`**: SPA routing
   - All routes fallback to `index.html` (React Router)
   - Widget routes preserved for iframe embedding

#### Anti-Pattern

```json
// ❌ WRONG - Uses npm install, incorrect output directory
{
  "installCommand": "npm install", // Non-deterministic
  "buildCommand": "npm run build", // Ambiguous
  "outputDirectory": "dist" // Incorrect path
}
```

### 4.4 Build Command Optimization

**Current (Sequential Build):**

```bash
npm run build --workspace=@macon/contracts && npm run build --workspace=@macon/shared && npm run build --workspace=@macon/web
```

**Alternative (Parallel Build):**

```bash
npm run build --workspaces --if-present
```

**Pros of Parallel:**

- Faster builds if packages are independent
- Simpler command

**Cons of Parallel:**

- No dependency ordering guarantee
- Can fail if `@macon/web` builds before `@macon/contracts`

**Recommendation:** Use sequential build for safety (current implementation).

### 4.5 Environment Variable Configuration

Vercel requires environment variables to be set in the dashboard or `vercel.json`:

```json
// vercel.json (NOT recommended for secrets)
{
  "env": {
    "NODE_ENV": "production",
    "VITE_API_URL": "https://api.maconaisolutions.com"
  }
}
```

**Best Practice:** Set secrets via Vercel Dashboard

1. Project Settings → Environment Variables
2. Add `VITE_*` prefixed variables for client-side access
3. Never commit secrets to `vercel.json`

---

## 5. Troubleshooting Checklist

### Symptom: "Cannot resolve @macon/contracts"

**Diagnosis Steps:**

1. **Verify dist folder exists:**

   ```bash
   ls -la packages/contracts/dist/index.js
   ```

   - If missing: Build script didn't run or failed
   - Check Vercel build logs for compilation errors

2. **Check Vite alias configuration:**

   ```bash
   grep '@macon/contracts' client/vite.config.ts
   ```

   - Should point to `../packages/contracts/dist/index.js`
   - NOT to directory: `../packages/contracts/dist`

3. **Verify build script has `--force`:**

   ```bash
   grep '"build"' packages/contracts/package.json
   ```

   - Should include: `"build": "tsc -b --force"`

4. **Check for TypeScript errors:**

   ```bash
   npm run typecheck
   ```

   - Fix any errors before deploying

### Symptom: "Build succeeds locally, fails on Vercel"

**Diagnosis Steps:**

1. **Simulate clean build:**

   ```bash
   rm -rf packages/*/dist client/dist node_modules package-lock.json
   npm ci --workspaces --include-workspace-root
   npm run build --workspace=@macon/contracts
   npm run build --workspace=@macon/shared
   npm run build --workspace=@macon/web
   ```

2. **Check Node.js version mismatch:**

   ```json
   // package.json
   "engines": {
     "node": ">=20.0.0"  // Must match Vercel runtime
   }
   ```

3. **Verify workspace configuration:**

   ```bash
   npm ls --workspaces
   ```

   - Should list: `@macon/contracts`, `@macon/shared`, `@macon/web`

4. **Check Vercel build logs:**
   - Look for "Skipping compilation" messages
   - Check for missing environment variables

### Symptom: "Vite build fails with module format errors"

**Diagnosis Steps:**

1. **Verify package.json `type` field:**

   ```json
   // packages/contracts/package.json
   {
     "type": "module" // Must be ESM
   }
   ```

2. **Check TypeScript module config:**

   ```json
   // tsconfig.base.json
   {
     "compilerOptions": {
       "module": "ESNext", // Must be ESNext for Vite
       "moduleResolution": "Bundler" // Vite-compatible
     }
   }
   ```

3. **Verify imports use `.js` extension:**
   ```typescript
   // In Vite config
   "@macon/contracts": "../packages/contracts/dist/index.js"
   // NOT: "../packages/contracts/dist/index"
   ```

---

## 6. Prevention Strategies Summary

### 6.1 Code-Level Prevention

- ✅ **Use `--force` in all package build scripts**
- ✅ **Point Vite aliases to `.js` files, not directories**
- ✅ **Define `exports` field in package.json**
- ✅ **Use `"type": "module"` for ESM packages**
- ✅ **Enable TypeScript composite projects**

### 6.2 Process-Level Prevention

- ✅ **Run clean build simulation before deploying**
- ✅ **Add pre-deployment verification script**
- ✅ **Document build sequence in vercel.json**
- ✅ **Set up automated build verification in CI**

### 6.3 Infrastructure-Level Prevention

- ✅ **Use sequential builds (not parallel) for dependencies**
- ✅ **Keep Vercel cache enabled, rely on `--force`**
- ✅ **Monitor build logs for "Skipping compilation" warnings**
- ✅ **Maintain consistent Node.js versions (local + CI + Vercel)**

---

## 7. Quick Reference

### Good Build Script Pattern

```json
{
  "scripts": {
    "build": "tsc -b --force", // CI/CD
    "build:dev": "tsc -b", // Local dev (fast)
    "typecheck": "tsc -b --noEmit",
    "clean": "rm -rf dist tsconfig.tsbuildinfo"
  }
}
```

### Good Vite Alias Pattern

```typescript
{
  alias: {
    "@macon/contracts": path.resolve(__dirname, "../packages/contracts/dist/index.js"),
    "@macon/shared": path.resolve(__dirname, "../packages/shared/dist/index.js"),
  }
}
```

### Good Vercel.json Pattern

```json
{
  "framework": "vite",
  "installCommand": "npm ci --workspaces --include-workspace-root",
  "buildCommand": "npm run build --workspace=@macon/contracts && npm run build --workspace=@macon/shared && npm run build --workspace=@macon/web",
  "outputDirectory": "client/dist"
}
```

---

## 8. Related Documentation

- [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md) - Full deployment checklist
- [/docs/operations/PRODUCTION_DEPLOYMENT_GUIDE.md](../operations/PRODUCTION_DEPLOYMENT_GUIDE.md) - Deployment procedures
- [CLAUDE.md](/CLAUDE.md) - Project structure and commands
- [/docs/operations/INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md) - Production incident response

---

## 9. Version History

| Version | Date       | Author               | Changes                                              |
| ------- | ---------- | -------------------- | ---------------------------------------------------- |
| 1.0     | 2025-11-26 | Platform Engineering | Initial guide based on Vercel build failure analysis |

---

**Maintainer:** Platform Engineering Team
**Review Frequency:** After each major build system change
**Last Security Review:** N/A (No sensitive data)
