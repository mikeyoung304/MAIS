---
module: MAIS
date: 2026-01-08
problem_type: build_failure
category: build-errors
component: TypeScript configuration, symlinks
symptoms:
  - TypeScript build fails with TS2307 Cannot find module
  - Error references path through symlinked directory
  - Same file compiles when accessed through real path but fails through symlink
root_cause: TypeScript resolves symlinked directories to real paths, causing relative imports to resolve incorrectly when accessed via symlink path
resolution_type: configuration_fix
severity: P1
tags: [typescript, symlinks, preserveSymlinks, tsconfig, path-resolution, build-errors, prisma]
---

# TypeScript Symlink Path Resolution Build Failure

## Problem Summary

TypeScript build fails with `TS2307: Cannot find module` when a source file contains relative imports and is accessed through a symlinked directory. The file compiles successfully when accessed through its real path but fails when TypeScript encounters it through the symlink.

## Exact Error

```
error TS2307: Cannot find module '../generated/prisma/client' or its corresponding type declarations.

  1 import { PrismaClient } from '../generated/prisma/client';
                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found in: server/src/adapters/lib/prisma.ts
```

## Directory Structure

```
server/src/
├── adapters/
│   ├── lib -> ../lib          # SYMLINK pointing to ../lib
│   ├── prisma/
│   │   └── *.repository.ts
│   └── *.adapter.ts
├── lib/
│   └── prisma.ts              # Contains: import from '../generated/prisma/client'
└── generated/
    └── prisma/
        └── client/
            └── index.ts
```

## Path Resolution Analysis

### Why It Fails

When TypeScript encounters the symlink `adapters/lib -> ../lib`, it processes files through BOTH paths:

**Path 1: Real Path (Works)**

```
File location:    server/src/lib/prisma.ts
Import:           '../generated/prisma/client'
Resolves to:      server/src/generated/prisma/client  ✓ EXISTS
```

**Path 2: Symlink Path (Fails)**

```
File location:    server/src/adapters/lib/prisma.ts (via symlink)
Import:           '../generated/prisma/client'
Resolves to:      server/src/adapters/generated/prisma/client  ✗ DOES NOT EXIST
```

### The Core Issue

By default, TypeScript resolves symlinks to their real paths for module resolution BUT still compiles the file from its symlink location. This creates a mismatch:

1. TypeScript sees `server/src/adapters/lib/prisma.ts` in its compilation list
2. It tries to resolve `../generated/prisma/client` relative to `adapters/lib/`
3. This resolves to `adapters/generated/prisma/client` which doesn't exist
4. Build fails with TS2307

## The Fix

Two changes to `server/tsconfig.json`:

### 1. Add preserveSymlinks Option

```json
{
  "compilerOptions": {
    "preserveSymlinks": true
    // ... other options
  }
}
```

**What `preserveSymlinks: true` does:**

- Tells TypeScript to NOT resolve symlinks to their real paths
- Module resolution happens relative to the symlink location
- Matches Node.js behavior when `--preserve-symlinks` flag is used
- Prevents duplicate compilation of the same file through different paths

### 2. Exclude Symlinked Directory

```json
{
  "exclude": [
    "node_modules",
    "dist",
    "test",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/adapters/lib" // ADD THIS: Exclude symlink target from compilation
  ]
}
```

**Why exclude is necessary:**

Even with `preserveSymlinks: true`, TypeScript may still try to include `src/adapters/lib` in the compilation if `include` uses a glob pattern like `src/**/*`. Explicitly excluding the symlink path prevents this.

## Complete Fix Applied

```json
// server/tsconfig.json
{
  "compilerOptions": {
    "preserveSymlinks": true,
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler"
    // ... rest of options
  },
  "include": ["src/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "test",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/adapters/lib"
  ]
}
```

## Why the Symlink Exists

The symlink `server/src/adapters/lib -> ../lib` was created to share utility code between adapters without duplicating it. Files in `adapters/` can import from `lib/` using the symlink, maintaining a clean dependency structure.

**Alternative Approaches (Not Used):**

1. **Path aliases** - Could use `@lib/*` alias but requires all imports to be updated
2. **Move shared code** - Would duplicate code or create circular dependencies
3. **Separate package** - Overkill for internal utilities

## Prevention Strategies

### Strategy 1: Check Before Adding Symlinks

Before creating a symlink in a TypeScript project:

```bash
# 1. Check if tsconfig already has preserveSymlinks
grep -q "preserveSymlinks" server/tsconfig.json && echo "Already configured" || echo "Need to add preserveSymlinks"

# 2. Add symlink path to exclude if using include globs
```

### Strategy 2: Document Symlinks

Add comment to tsconfig.json explaining why preserveSymlinks and exclude are needed:

```json
{
  "compilerOptions": {
    // Required for symlinks in src/adapters/lib -> ../lib
    // Without this, TypeScript resolves relative imports incorrectly
    "preserveSymlinks": true
  },
  "exclude": [
    // Symlink target - must be excluded to prevent duplicate compilation
    "src/adapters/lib"
  ]
}
```

### Strategy 3: CI Validation

Add to CI pipeline to catch symlink-related issues early:

```bash
# Check for untracked symlinks that might cause build issues
find server/src -type l -exec echo "Symlink: {}" \;

# Verify build succeeds
cd server && npx tsc --noEmit
```

## Verification Commands

```bash
# Verify TypeScript can find all modules
cd server && npx tsc --noEmit

# Check symlinks in source directory
find server/src -type l -ls

# Verify preserveSymlinks is set
grep "preserveSymlinks" server/tsconfig.json

# Verify exclude contains symlink path
grep "adapters/lib" server/tsconfig.json
```

## Common Mistakes

### Mistake 1: Only Adding preserveSymlinks

```json
// INCOMPLETE - May still fail
{
  "compilerOptions": {
    "preserveSymlinks": true
  }
  // Missing exclude for symlink path!
}
```

### Mistake 2: Wrong Exclude Path

```json
// WRONG - This excludes the real path, not the symlink
{
  "exclude": [
    "src/lib" // Wrong! Should be src/adapters/lib
  ]
}
```

### Mistake 3: Using Path Alias Without Updating Imports

If you add a path alias but don't update the imports, the build will still fail:

```json
// Added alias...
{
  "paths": {
    "@lib/*": ["./src/lib/*"]
  }
}

// But prisma.ts still has:
import { PrismaClient } from '../generated/prisma/client';
// Should be: import { PrismaClient } from '@generated/prisma';
```

## Related TypeScript Options

| Option             | Default  | Description                             |
| ------------------ | -------- | --------------------------------------- |
| `preserveSymlinks` | `false`  | Don't resolve symlinks to real path     |
| `baseUrl`          | `.`      | Base directory for non-relative imports |
| `paths`            | `{}`     | Path aliases for module resolution      |
| `rootDir`          | Inferred | Root directory of source files          |

## When to Use This Pattern

Use `preserveSymlinks: true` + `exclude` when:

- You have symlinks in your source directory (not just node_modules)
- Symlinked files contain relative imports
- You need to maintain backward compatibility with existing import paths

**Do NOT use if:**

- Symlinks are only in node_modules (TypeScript handles this automatically)
- You can refactor to use path aliases instead
- The symlinked directory doesn't contain TypeScript files

## Related Documentation

- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [Node.js --preserve-symlinks](https://nodejs.org/api/cli.html#--preserve-symlinks)
- [Prisma 7 Seed Module Resolution](../database-issues/prisma-7-seed-module-resolution-MAIS-20260105.md)
