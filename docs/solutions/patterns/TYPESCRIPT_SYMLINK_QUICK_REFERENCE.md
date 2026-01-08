---
title: TypeScript Symlink Resolution - Quick Reference
date: 2026-01-08
category: patterns
severity: P1
component: Build System
tags: [typescript, symlinks, quick-reference, cheat-sheet]
---

# TypeScript Symlink - Quick Reference

**Print this page and pin it to your monitor!**

## The Rule (30 seconds)

```
NEVER put symlinks inside TypeScript source directories.

Symlink in src/ = same file via 2 paths = DOUBLE COMPILATION

Solution: Use tsconfig paths or workspace packages instead
```

## Decision Tree

```
Need to share code between packages?
|
+-- Use tsconfig.json "paths" --> Preferred
|
+-- Use npm/pnpm workspaces --> Also good
|
+-- Create a symlink --> NEVER IN SRC DIRECTORIES
```

## The Problem

```
src/
  shared -> ../packages/shared  <-- SYMLINK = BAD

import from '../packages/shared/utils'  --> /packages/shared/utils.ts
import from './shared/utils'            --> /src/shared/utils.ts (symlink)

Same file, two paths = TypeScript treats as different modules
```

## The Solution

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../packages/shared/src/*"]
    }
  }
}
```

```typescript
// ✅ Import via path alias
import { utils } from '@shared/utils';
```

## Before Adding a Symlink

- [ ] Can tsconfig paths solve this?
- [ ] Can workspace packages solve this?
- [ ] Is symlink OUTSIDE src directories?
- [ ] Have I tested `npm run build`?

## Find Symlinks

```bash
# Find symlinks in source directories
find apps/*/src server/src packages/*/src -type l 2>/dev/null
```

If this returns anything, you have a problem.

## Quick Fixes

| Want To | Wrong Way | Right Way |
|---------|-----------|-----------|
| Share utils | `ln -s ../shared src/shared` | `paths: {"@shared/*": [...]}` |
| Import package | `ln -s pkg node_modules/pkg` | Add to package.json dependencies |
| Local dev link | `ln -s ../pkg packages/` | `npm link` or workspaces |

## ESLint/TypeScript Config

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@macon/*": ["../../packages/*/src/index.ts"]
    },
    "moduleResolution": "bundler"
  }
}
```

## CI Check (Add to Pipeline)

```yaml
- name: Check for symlinks
  run: |
    SYMLINKS=$(find apps/*/src server/src -type l 2>/dev/null || true)
    if [ -n "$SYMLINKS" ]; then
      echo "ERROR: Symlinks in src:"
      echo "$SYMLINKS"
      exit 1
    fi
```

## Code Review Check

When you see file structure changes:

1. Run: `find . -type l -not -path "./node_modules/*"`
2. Any symlinks in src/? --> Request changes
3. Suggest tsconfig paths instead

## Copy-Paste Review Comment

```
Symlinks in TypeScript source directories cause double compilation.
Use tsconfig.json paths instead:

{
  "compilerOptions": {
    "paths": { "@shared/*": ["../packages/shared/src/*"] }
  }
}

Then import as: import { x } from '@shared/utils';
```

## Quick Reference Card

```
+------------------------------------------+
|     TYPESCRIPT SYMLINK PREVENTION        |
+------------------------------------------+
|  NEVER: ln -s ../pkg src/pkg             |
|  NEVER: symlink inside src/              |
|  NEVER: manual node_modules links        |
+------------------------------------------+
|  ALWAYS: tsconfig.json paths             |
|  ALWAYS: npm workspaces                  |
|  ALWAYS: proper package.json deps        |
+------------------------------------------+
|  CHECK: find apps/*/src -type l          |
+------------------------------------------+
```

## Error Messages to Watch For

| Error | Likely Cause |
|-------|--------------|
| "Duplicate identifier" | Symlink double compilation |
| Same file, different behaviors | Symlink path ambiguity |
| Module singleton not working | Same file = two instances |

## Pre-commit Hook

```bash
#!/bin/bash
# .husky/pre-commit
SYMLINKS=$(find apps/*/src server/src packages/*/src -type l 2>/dev/null || true)
if [ -n "$SYMLINKS" ]; then
  echo "ERROR: Symlinks in src not allowed"
  echo "$SYMLINKS"
  exit 1
fi
```

---

Full documentation: `TYPESCRIPT_SYMLINK_RESOLUTION_PREVENTION.md`
