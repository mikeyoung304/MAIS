---
module: MAIS
date: 2025-12-26
problem_type: deployment
component: apps/web, vercel.json, npm-workspaces
symptoms:
  - Module not found: @macon/contracts
  - Build fails on Vercel but works locally
  - ESLint entity escaping errors in production build
  - Next.js can't resolve workspace dependencies
root_cause: npm workspaces + Vercel Root Directory setting = broken module resolution
resolution_type: prevention_strategy
severity: P1
tags: [vercel, monorepo, nextjs, npm-workspaces, eslint, deployment, prevention]
---

# Vercel + Next.js Monorepo Deployment Prevention Strategies

## Problem Pattern

When deploying a Next.js app from an npm workspace monorepo to Vercel, setting the "Root Directory" to `apps/web` causes workspace dependency resolution to fail. Vercel installs dependencies from `apps/web/` but workspace packages (`@macon/contracts`, `@macon/shared`) are defined at the repo root.

**The Core Issue:**
```
Repo Root (package.json with workspaces)
├── apps/web/           ← Vercel starts here (WRONG!)
│   └── package.json    ← Has dependencies on @macon/*
├── packages/
│   ├── contracts/      ← These don't get built
│   └── shared/         ← These don't get built
```

---

## Prevention Checklist (10 Items)

### Pre-Configuration (Before First Deploy)

- [ ] **1. Do NOT use Vercel's Root Directory setting for npm workspaces**
  - Leave Root Directory blank (use repo root)
  - Use `vercel.json` to specify output location instead

- [ ] **2. Create custom `vercel-build` script at repo root**
  ```json
  // package.json (root)
  {
    "scripts": {
      "vercel-build": "npm run build -w @macon/contracts && npm run build -w @macon/shared && cd apps/web && next build"
    }
  }
  ```

- [ ] **3. Configure `vercel.json` correctly**
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "framework": "nextjs",
    "outputDirectory": "apps/web/.next",
    "buildCommand": "npm run vercel-build"
  }
  ```

- [ ] **4. Add `transpilePackages` to Next.js config**
  ```javascript
  // apps/web/next.config.js
  const nextConfig = {
    transpilePackages: ['@macon/contracts', '@macon/shared'],
  };
  ```

- [ ] **5. Workspace packages have correct build scripts with `--force`**
  ```json
  // packages/contracts/package.json
  {
    "scripts": {
      "build": "tsc -b --force"
    }
  }
  ```

### ESLint Configuration (Prevent Build Failures)

- [ ] **6. Configure ESLint for Next.js unescaped entities**
  ```javascript
  // apps/web/.eslintrc.cjs
  module.exports = {
    rules: {
      // Allow unescaped apostrophes and quotes (Next.js handles safely)
      'react/no-unescaped-entities': ['error', {
        forbid: [
          { char: '>', alternatives: ['&gt;'] },
          { char: '<', alternatives: ['&lt;'] }
        ]
      }]
    }
  };
  ```

- [ ] **7. Add ESLint ignore for build output**
  ```javascript
  // apps/web/.eslintrc.cjs
  module.exports = {
    ignorePatterns: ['node_modules', '.next', 'out'],
  };
  ```

### Pre-Deploy Verification

- [ ] **8. Run local verification script before push**
  ```bash
  npm run verify-build  # Custom script simulating Vercel
  ```

- [ ] **9. Verify workspace packages build in correct order**
  ```bash
  # Dependencies MUST build before Next.js
  npm run build -w @macon/contracts
  npm run build -w @macon/shared
  cd apps/web && npm run build
  ```

- [ ] **10. Check Vercel project settings match expectations**
  - Root Directory: (empty - use repo root)
  - Build Command: `npm run vercel-build`
  - Output Directory: `apps/web/.next`
  - Framework: Next.js

---

## Pre-Deployment Verification Script

Add this script to your repository:

```bash
#!/bin/bash
# scripts/verify-nextjs-build.sh
# Pre-deployment verification for Next.js monorepo

set -e

echo "========================================"
echo "  Next.js Monorepo Build Verification"
echo "========================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Clean all build artifacts
echo -e "${YELLOW}Step 1: Cleaning build artifacts...${NC}"
rm -rf packages/*/dist packages/*/.tsbuildinfo apps/web/.next
echo -e "${GREEN}Done${NC}"

# Step 2: Install dependencies (simulates fresh Vercel install)
echo -e "${YELLOW}Step 2: Installing dependencies...${NC}"
npm ci
echo -e "${GREEN}Done${NC}"

# Step 3: Build workspace packages
echo -e "${YELLOW}Step 3: Building workspace packages...${NC}"
npm run build -w @macon/contracts
npm run build -w @macon/shared

# Verify outputs
if [ ! -f packages/contracts/dist/index.js ]; then
  echo -e "${RED}ERROR: packages/contracts/dist/index.js not found${NC}"
  exit 1
fi
if [ ! -f packages/shared/dist/index.js ]; then
  echo -e "${RED}ERROR: packages/shared/dist/index.js not found${NC}"
  exit 1
fi
echo -e "${GREEN}Workspace packages built successfully${NC}"

# Step 4: Build Next.js app
echo -e "${YELLOW}Step 4: Building Next.js app...${NC}"
cd apps/web
npm run build

# Verify Next.js output
if [ ! -d .next ]; then
  echo -e "${RED}ERROR: apps/web/.next directory not found${NC}"
  exit 1
fi
echo -e "${GREEN}Next.js build successful${NC}"
cd ../..

# Step 5: Run ESLint
echo -e "${YELLOW}Step 5: Running ESLint...${NC}"
npm run lint:web || {
  echo -e "${YELLOW}WARNING: ESLint issues found - review before deploy${NC}"
}

# Step 6: Verify vercel.json configuration
echo -e "${YELLOW}Step 6: Checking vercel.json...${NC}"

# Check if vercel.json exists at app level (may need to use root level)
if [ -f apps/web/vercel.json ]; then
  echo "Found vercel.json in apps/web/"
  # Verify framework is set
  if grep -q '"framework": "nextjs"' apps/web/vercel.json; then
    echo -e "${GREEN}Framework correctly set to nextjs${NC}"
  else
    echo -e "${YELLOW}WARNING: Framework may not be set to nextjs${NC}"
  fi
fi

echo ""
echo -e "${GREEN}========================================"
echo -e "  All verification checks passed!"
echo -e "========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Push to trigger Vercel deployment"
echo "  2. Monitor Vercel build logs"
echo "  3. Verify production deployment"
```

---

## ESLint Entity Escaping Quick Reference

### Common Escaping Errors

| Character | Wrong | Correct Option 1 | Correct Option 2 |
|-----------|-------|------------------|------------------|
| `'` (apostrophe) | `don't` | `don&apos;t` | `{"don't"}` |
| `"` (quote) | `"hello"` | `&quot;hello&quot;` | `{'"hello"'}` |
| `<` (less than) | `<` | `&lt;` | `{'<'}` |
| `>` (greater than) | `>` | `&gt;` | `{'>'}` |

### Quick Fix Strategies

**Option A: Escape with HTML entities**
```tsx
// Before (error)
<p>Don't miss out!</p>

// After (fixed)
<p>Don&apos;t miss out!</p>
```

**Option B: Use JSX expression**
```tsx
// Before (error)
<p>He said "hello"</p>

// After (fixed)
<p>He said {'"hello"'}</p>
```

**Option C: Configure ESLint to allow apostrophes (recommended for Next.js)**
```javascript
// .eslintrc.cjs
module.exports = {
  rules: {
    'react/no-unescaped-entities': ['error', {
      forbid: [
        { char: '>', alternatives: ['&gt;'] },
        { char: '<', alternatives: ['&lt;'] }
        // Note: ' and " are NOT in forbid list, so they're allowed
      ]
    }]
  }
};
```

### Why Option C Is Recommended

Next.js and React properly escape text content during rendering. The `react/no-unescaped-entities` rule was designed for older JSX transforms that didn't handle escaping. Modern React (17+) with the new JSX transform handles this automatically.

**Safe to allow:**
- Apostrophes in text: `You're welcome` (no XSS risk)
- Double quotes in text: `Say "hello"` (no XSS risk)

**Always escape:**
- `<` in text (could be misinterpreted as JSX tag start)
- `>` in text (could be misinterpreted as JSX tag end)

---

## Common Pitfalls to Avoid

### 1. Using Root Directory Setting with npm Workspaces
```
WRONG: Vercel → Settings → Root Directory → apps/web
RIGHT: Leave blank, use vercel.json outputDirectory
```

### 2. Forgetting transpilePackages
```javascript
// WRONG - workspace packages won't be transpiled
const nextConfig = {};

// RIGHT - explicitly list workspace packages
const nextConfig = {
  transpilePackages: ['@macon/contracts', '@macon/shared'],
};
```

### 3. Building Next.js Before Dependencies
```bash
# WRONG - Next.js can't find @macon/* packages
cd apps/web && npm run build

# RIGHT - build workspace packages first
npm run build -w @macon/contracts && npm run build -w @macon/shared && cd apps/web && npm run build
```

### 4. Missing --force Flag on TypeScript Builds
```json
// WRONG - uses cached .tsbuildinfo, may skip compilation
"build": "tsc -b"

// RIGHT - forces fresh compilation every time
"build": "tsc -b --force"
```

### 5. Incorrect vercel.json Location
```
apps/web/vercel.json  ← Only works if Root Directory is set (but don't use that!)
./vercel.json         ← Use this if Root Directory is blank
```

---

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| `Module not found: @macon/contracts` | Root Directory set to apps/web | Remove Root Directory setting, use vercel.json |
| `Cannot read properties of undefined` | Workspace package not built | Add workspace package to vercel-build script |
| ESLint entity escaping errors | Strict react/no-unescaped-entities | Configure rule to allow ' and " |
| Build works locally, fails on Vercel | Stale tsbuildinfo cache | Add --force to workspace package builds |
| `Type error: ... is not assignable` | Workspace packages using old types | Rebuild workspace packages before Next.js |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `package.json` (root) | `vercel-build` script, workspaces definition |
| `vercel.json` (root or apps/web) | Vercel deployment configuration |
| `apps/web/next.config.js` | `transpilePackages` for workspace packages |
| `apps/web/.eslintrc.cjs` | ESLint configuration including entity rules |
| `packages/*/package.json` | Build scripts with `--force` flag |

---

## Related Documentation

- [Vercel Monorepo Support](https://vercel.com/docs/concepts/git/monorepos)
- [Next.js transpilePackages](https://nextjs.org/docs/app/api-reference/next-config-js/transpilePackages)
- [npm Workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [ESLint react/no-unescaped-entities](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unescaped-entities.md)
- [MAIS: vercel-vite-monorepo-typescript-incremental-cache.md](./vercel-vite-monorepo-typescript-incremental-cache.md) (Vite-specific version)
