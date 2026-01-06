---
title: ESLint Dead Code Prevention - Quick Reference
date: 2026-01-05
category: patterns
severity: P1
component: Code Quality
tags: [eslint, dead-code, quick-reference, cheat-sheet]
---

# ESLint Dead Code Prevention - Quick Reference

**Print this page and pin it to your monitor!**

## The Four Types of Dead Code

| Type                 | Example                                                 | Fix                              | Time |
| -------------------- | ------------------------------------------------------- | -------------------------------- | ---- |
| **Unused Import**    | `import { X } from './m'` (X never used)                | Delete the import line           | 5s   |
| **Type-Only Import** | `import { Type } from './m'` (only used in annotations) | Change to `import type { Type }` | 5s   |
| **Unused Variable**  | `const x = fn();` (x never referenced)                  | Delete the variable              | 5s   |
| **Dead Function**    | `function _helper() { ... }` (never called)             | Delete function + add comment    | 10s  |

## Decision Tree (30 seconds)

```
Code causing ESLint warning?
│
├─ "is defined but never used"
│   └─ Is it a function parameter? (like arr.map((_x, idx) => idx))
│       ├─ YES → Prefix with _ and move on
│       └─ NO → DELETE IT (including the line it's in)
│
└─ "imported but not used" or "is defined but never used"
    └─ What is it?
        ├─ Type (Type annotation only?) → import type { X }
        ├─ Value (never referenced) → Delete import line
        └─ Function (nothing calls it) → Delete entire function
```

## Three-Second Fixes

### Type-Only Import

```diff
- import { Type, value } from './module';
+ import type { Type } from './module';
+ import { value } from './module';
```

### Remove Unused Import

```diff
- import { unused, needed } from './module';
+ import { needed } from './module';
```

### Remove Unused Variable

```diff
- const unused = expensive();
  const result = process();
```

### Prefix Unused Parameter

```diff
- array.forEach((item, index) => {
+ array.forEach((item, _index) => {
    process(item);
  });
```

### Delete Dead Function

```diff
- function _helper() {
-   // 20 lines of code for "future use"
-   return mapping[phase] || null;
- }
+ // Note: helper was removed (git has history)
```

## Pre-Commit Checks That Catch Dead Code

Run these locally BEFORE committing:

```bash
# See what's wrong
npm run lint

# Auto-fix what's fixable
npm run lint -- --fix

# Verify TypeScript (catches import mismatches)
npm run typecheck

# Final check before committing
npm run lint -- --max-warnings 0
```

If pre-commit hook fails, git won't let you commit. Fix the issues:

1. Delete unused imports/variables
2. Convert types to `import type`
3. Remove dead functions
4. Run `npm run lint -- --fix` to auto-fix remaining issues
5. Commit again

## ESLint Rules That Catch Dead Code

| Rule                                         | Catches                          | Fix                       |
| -------------------------------------------- | -------------------------------- | ------------------------- |
| `@typescript-eslint/no-unused-vars`          | Variables, imports, parameters   | Delete or prefix with `_` |
| `@typescript-eslint/consistent-type-imports` | Type values imported as `import` | Convert to `import type`  |
| `no-console`                                 | console.log (use logger instead) | Replace with logger calls |

## The Underscore Prefix Rule

**ONLY use `_` for function parameters you're required to accept:**

```typescript
// ✅ OK - arr.map signature requires (item, index, array)
arr.map((_item, index) => index)

// ✅ OK - catch block error you don't need
try {
  something();
} catch (_e) {
  return 'failed';
}

// ❌ WRONG - unused variable you created
const _unused = expensive(); // DELETE this line

// ❌ WRONG - variable used in logger (NOT unused!)
catch (error) {
  logger.info({ error }, 'failed'); // error IS used, remove the _
}
```

## Common ESLint Error → Fix Map

```
ERROR: "'Type' is defined but never used"
CAUSE: Type imported with import { }, used only in type annotations
FIX:   import type { Type } from '...'

ERROR: "'unused' is assigned a value but never used"
CAUSE: Variable declared, value never referenced
FIX:   Delete the entire line

ERROR: "'_handler' is defined but never used"
CAUSE: Function declared with _, nothing calls it
FIX:   Delete the function

ERROR: "'ConversationTracer' is defined but never used"
CAUSE: Type imported as value
FIX:   import type { ConversationTracer } from '...'

ERROR: "Unexpected var 'SOFT_CONFIRM_WINDOWS' defined but not used"
CAUSE: Imported, code was refactored but import wasn't cleaned up
FIX:   Delete the import line
```

## Dead Code Detection (30-second scan)

Look for these patterns in your code:

```typescript
// ❌ Dead function (never called)
function _something() {
  // ... code ...
}

// ❌ Unused variable (declared but never referenced)
const result = expensiveOperation();
const nextValue = 42; // only nextValue is used

// ❌ Unused import
import { importedButNeverUsed } from './module';

// ❌ Type as value import
import { MyInterface } from './types';
// MyInterface used only in: const x: MyInterface = ...

// ✅ Required parameter marked intentional
array.forEach((_unused, index) => {
  return index * 2;
});
```

## Before You Commit

Checklist (takes 30 seconds):

- [ ] Ran `npm run lint` - no new warnings
- [ ] Ran `npm run lint -- --fix` - fixed what's fixable
- [ ] Ran `npm run typecheck` - passes
- [ ] No unused imports remain
- [ ] No `import type` issues
- [ ] No dead functions added
- [ ] No code "for future use" added

## Git Won't Let You Commit? Here's Why

The pre-commit hook runs these checks:

1. **ESLint** - Catches unused variables, wrong imports
2. **TypeScript typecheck** - Catches import mismatches
3. **Unit tests** - Verifies code still works

If any fail, fix them:

```bash
# See the specific errors
npm run lint
npm run typecheck

# Auto-fix easy issues
npm run lint -- --fix

# If auto-fix isn't enough, manually fix:
# - Delete unused imports
# - Delete unused variables
# - Convert types to import type

# Try committing again
git add .
git commit -m "message"
```

## The Golden Rule

**Delete > Prefix > Keep**

In that order:

1. **DELETE** - Remove unused code (git preserves history)
2. **PREFIX with `_`** - Only for required parameters you don't use
3. **KEEP** - Only if it's actually used

Never keep code "for future use". Future you can get it from git.

## 60-Second Problem Solving

Problem → Solution → Time:

| Problem                              | Solution                      | Time |
| ------------------------------------ | ----------------------------- | ---- |
| "X is defined but never used"        | Delete the line               | 5s   |
| "X imported but not used"            | Delete import line            | 5s   |
| "Type is used but imported as value" | Change to `import type`       | 5s   |
| "Function never called"              | Delete function + add comment | 10s  |
| Multiple unused in file              | Run `npm run lint -- --fix`   | 30s  |

## Red Flags (Things That Indicate Dead Code)

If you see these, investigate:

- `_` prefix on functions or variables YOU created (not parameters)
- Comments like "// unused for now" or "// TODO: use this later"
- Functions that start with `_`
- Imports that appear once at top, never used again
- Empty catch blocks or variable definitions
- Code paths that look suspicious in code review

## Resources

- Full guide: `docs/solutions/patterns/ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md`
- TypeScript strictness: `docs/solutions/build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md`
- Import issues: `docs/solutions/build-errors/import-name-mismatch-onboarding-tools-MAIS-20251231.md`
