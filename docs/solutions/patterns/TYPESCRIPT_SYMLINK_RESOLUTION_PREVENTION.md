---
title: TypeScript Symlink Resolution Prevention
date: 2026-01-08
category: patterns
severity: P1
component: Build System
symptoms:
  - Files compiled twice (double compilation)
  - "Duplicate identifier" TypeScript errors
  - Relative imports resolve to different paths
  - Build outputs inconsistent between machines
  - Module not found errors for files that exist
root_cause: Symlinks in TypeScript source directories cause path resolution ambiguity
resolution_type: prevention_strategy
tags: [typescript, symlinks, build-errors, path-resolution, monorepo]
---

# TypeScript Symlink Resolution Prevention

**Impact:** P1 - Build instability, double compilation, inconsistent behavior between environments

**Root Cause:** When a symlink exists in a TypeScript source directory, imports can resolve through two different paths (real path vs symlink path), causing TypeScript to treat the same file as two different modules.

---

## The Problem Explained

```
src/
  components/
    Button.tsx          # Real file at /src/components/Button.tsx
  shared -> ../shared   # Symlink to /shared directory

shared/
  utils.ts              # File at /shared/utils.ts
```

When `Button.tsx` imports from `../shared/utils`:
- TypeScript may resolve to `/src/shared/utils.ts` (via symlink)
- Or to `/shared/utils.ts` (via real path)
- These are treated as DIFFERENT modules

**Result:**
- Same file compiled twice
- Type definitions don't match
- `instanceof` checks fail
- Module singletons create duplicates

---

## Patterns That Cause This

### Pattern A: Symlink for Shared Code

```bash
# ❌ WRONG - Symlink in src directory
cd apps/web/src
ln -s ../../packages/shared shared
```

### Pattern B: Development Convenience Links

```bash
# ❌ WRONG - Symlink for easier imports
cd server/src
ln -s ../../node_modules/@types types
```

### Pattern C: Monorepo Package Links

```bash
# ❌ WRONG - Manual symlinks instead of proper workspace setup
cd apps/web/node_modules
ln -s ../../packages/contracts @macon/contracts
```

---

## Correct Patterns

### Pattern A: Use TypeScript Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../../packages/shared/src/*"],
      "@macon/contracts": ["../../packages/contracts/src/index.ts"]
    }
  }
}
```

```typescript
// ✅ CORRECT - Import via path alias
import { utils } from '@shared/utils';
import { contract } from '@macon/contracts';
```

### Pattern B: Use Workspace Packages (npm/pnpm/yarn)

```json
// package.json (root)
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}

// apps/web/package.json
{
  "dependencies": {
    "@macon/contracts": "*",
    "@macon/shared": "*"
  }
}
```

```typescript
// ✅ CORRECT - Import from workspace package
import { contract } from '@macon/contracts';
```

### Pattern C: Use preserveSymlinks Carefully

```json
// tsconfig.json - ONLY if symlinks are unavoidable
{
  "compilerOptions": {
    "preserveSymlinks": true
  }
}
```

**Warning:** `preserveSymlinks: true` tells TypeScript to NOT resolve symlinks to their real paths. This can fix double compilation but may cause other issues. Test thoroughly.

---

## Quick Checklist

Before adding any symlink in a TypeScript project:

- [ ] Can this be solved with `paths` in tsconfig.json instead?
- [ ] Can this be solved with workspace packages instead?
- [ ] Is the symlink OUTSIDE of any `include`d directories?
- [ ] Have you tested `npm run build` after adding the symlink?
- [ ] Have you tested on a clean checkout (no existing build cache)?

---

## ESLint/TypeScript Rules

### tsconfig.json Settings

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@macon/*": ["../../packages/*/src/index.ts"]
    },
    // Only enable if you MUST use symlinks
    // "preserveSymlinks": true,

    // Strict module resolution catches issues
    "moduleResolution": "bundler",
    "strict": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### ESLint Import Rules

```json
{
  "rules": {
    "import/no-unresolved": "error",
    "import/no-relative-parent-imports": "warn"
  },
  "settings": {
    "import/resolver": {
      "typescript": {
        "alwaysTryTypes": true
      }
    }
  }
}
```

---

## Code Review Checklist

When reviewing PRs that add symlinks or modify path structure:

- [ ] **No symlinks in src/:** `find src -type l` should return empty
- [ ] **Path aliases configured:** Check tsconfig.json `paths` for shared code
- [ ] **Workspace packages used:** Check package.json dependencies
- [ ] **Build tested:** PR author ran `npm run build` from clean state
- [ ] **Cross-platform:** Symlinks may behave differently on Windows

### Copy-Paste Review Comment

```markdown
**Symlink in Source Directory**

This PR adds a symlink in the TypeScript source directory, which can cause:
- Double compilation of the same files
- "Duplicate identifier" errors
- Inconsistent builds between machines

**Fix:** Use TypeScript path aliases instead:

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../../packages/shared/src/*"]
    }
  }
}
```

Then import as: `import { x } from '@shared/utils'`
```

---

## Test Strategies

### 1. Build Verification

```bash
# Clean build test
rm -rf dist .tsbuildinfo node_modules/.cache
npm run build

# Check for duplicate outputs
find dist -name "*.js" | xargs md5sum | sort | uniq -d -w32
```

### 2. Symlink Detection in CI

```yaml
# .github/workflows/ci.yml
- name: Check for symlinks in src
  run: |
    SYMLINKS=$(find apps/*/src packages/*/src -type l 2>/dev/null || true)
    if [ -n "$SYMLINKS" ]; then
      echo "ERROR: Symlinks found in source directories:"
      echo "$SYMLINKS"
      exit 1
    fi
```

### 3. Pre-commit Hook

```bash
#!/bin/bash
# .husky/pre-commit

# Check for symlinks in TypeScript source directories
SYMLINKS=$(find apps/*/src server/src packages/*/src -type l 2>/dev/null || true)
if [ -n "$SYMLINKS" ]; then
  echo "ERROR: Symlinks in source directories are not allowed"
  echo "$SYMLINKS"
  echo ""
  echo "Use tsconfig.json paths or workspace packages instead."
  exit 1
fi
```

### 4. Import Resolution Test

```typescript
// test/build/import-resolution.test.ts
import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';

describe('Import Resolution', () => {
  it('should not have symlinks in src directories', () => {
    const srcDirs = ['apps/web/src', 'server/src', 'packages/contracts/src'];

    for (const dir of srcDirs) {
      const symlinks = findSymlinks(dir);
      expect(symlinks).toEqual([]);
    }
  });

  it('should resolve @macon/contracts to single location', async () => {
    const import1 = await import('@macon/contracts');
    const import2 = await import('@macon/contracts');
    expect(import1).toBe(import2); // Same module instance
  });
});

function findSymlinks(dir: string): string[] {
  const symlinks: string[] = [];
  if (!fs.existsSync(dir)) return symlinks;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      symlinks.push(fullPath);
    } else if (entry.isDirectory()) {
      symlinks.push(...findSymlinks(fullPath));
    }
  }
  return symlinks;
}
```

---

## Debugging Symlink Issues

### Step 1: Find All Symlinks

```bash
# Find symlinks in entire project
find . -type l -not -path "./node_modules/*" -not -path "./.git/*"

# Find symlinks in source directories only
find apps/*/src server/src packages/*/src -type l 2>/dev/null
```

### Step 2: Check What They Point To

```bash
# Show symlink targets
find . -type l -not -path "./node_modules/*" -exec ls -la {} \;
```

### Step 3: Check TypeScript Resolution

```bash
# See what TypeScript thinks about imports
npx tsc --traceResolution 2>&1 | grep -A5 "Loading module"
```

### Step 4: Check for Duplicate Compilation

```bash
# Look for same file compiled multiple times
npm run build 2>&1 | grep -E "Compiling|Building" | sort | uniq -c | sort -rn
```

---

## Migration: Removing Existing Symlinks

If you already have symlinks causing issues:

### Step 1: Document Current Symlinks

```bash
find . -type l -not -path "./node_modules/*" > symlinks-to-remove.txt
```

### Step 2: Create Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../../packages/shared/src/*"]
    }
  }
}
```

### Step 3: Update Imports

```bash
# Find files using the symlink path
grep -rn "from ['\"].*shared" apps/web/src --include="*.ts" --include="*.tsx"

# Update to use path alias
# from '../../../shared/utils' -> '@shared/utils'
```

### Step 4: Remove Symlinks

```bash
# Remove symlink (keeps target intact)
rm apps/web/src/shared  # This just removes the symlink, not the target
```

### Step 5: Verify Build

```bash
rm -rf dist .tsbuildinfo
npm run build
npm run typecheck
npm test
```

---

## Common Error Messages and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Duplicate identifier 'X'" | Same file via two paths | Remove symlink, use path alias |
| "Cannot find module 'X'" | Symlink target missing | Check symlink target exists |
| "Module 'X' has no exported member 'Y'" | Different version via symlink | Use workspace package |
| Build output differs between machines | Symlink resolved differently | Remove symlink, use path alias |

---

## Platform-Specific Notes

### Windows
- Symlinks require admin privileges or Developer Mode
- May fail silently, creating empty files instead
- Git may not preserve symlinks (depends on `core.symlinks` setting)

### macOS/Linux
- Symlinks work as expected
- Be careful with case sensitivity differences

### Docker
- Symlinks may not work across volume mounts
- Use path aliases instead for containerized builds

### CI/CD (GitHub Actions, etc.)
- Symlinks may or may not be preserved in checkout
- Always test build in CI, not just locally

---

## Related Documentation

- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [npm Workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [Vercel Monorepo Deployment](../deployment-issues/vercel-nextjs-npm-workspaces-root-directory-MAIS-20251226.md)

---

**Last Updated:** 2026-01-08
**Maintainer:** MAIS Engineering
