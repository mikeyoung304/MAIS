---
title: ESLint Dead Code Prevention Strategy
date: 2026-01-05
category: patterns
severity: P1
component: Code Quality, Linting
tags:
  - eslint
  - dead-code
  - unused-imports
  - yagni
  - pre-commit
  - code-review
  - type-safety
---

# ESLint Dead Code Prevention Strategy

## Executive Summary

Recent linting fixes (commit 764b9132) revealed a pattern of dead code accumulation that ESLint alone cannot catch. This document provides a multi-layer prevention strategy combining:

1. **Pre-commit hooks** - Catch unused imports before they reach CI
2. **Code review checklist** - Enforce YAGNI principle
3. **Decision tree** - When to delete vs prefix with underscore
4. **TypeScript type-checking** - Complement ESLint's limitations
5. **IDE configuration** - Catch issues at development time

## Problem Summary

### The 25 ESLint Errors (Commit 764b9132)

| Category             | Count | Examples                                                | Root Cause                                |
| -------------------- | ----- | ------------------------------------------------------- | ----------------------------------------- |
| Type-only imports    | 8     | `PrismaClient`, `ContextCache`, `ConversationTracer`    | Imported as values but used as types only |
| Unused imports       | 7     | `SOFT_CONFIRM_WINDOWS`, `stateToPhase`, `MarketingData` | Imported but never referenced             |
| Dead code functions  | 2     | `_getMachineEventForPhase`, `getStartedEventType`       | Functions for "future use"                |
| Unused variables     | 5     | `softConfirmWindow`, `_tenant`, `_sessionId`            | Declared but not referenced               |
| Missing scope braces | 3     | Switch case blocks without `{}`                         | TypeScript strictness                     |

### Why ESLint Alone Is Insufficient

```
ESLint Catches:           TypeScript Catches:           Requires Code Review:
├─ unused-vars            ├─ type mismatches           ├─ YAGNI violations
├─ no-unused-vars         ├─ missing imports           ├─ functions "for future use"
├─ consistent-type-       ├─ unused local variables    ├─ dead code patterns
│  imports                └─ (when noUnusedLocals:     └─ architectural debt
└─ Other syntax rules        true)

ESLint is a linter        TypeScript is a type         Code review is
(syntax/pattern checker)  checker (correctness         domain analysis
                          validator)
```

## Prevention Strategy 1: Enhanced Pre-commit Hook

### Current State

The `.husky/pre-commit` hook runs:

1. Prettier formatting
2. Documentation validation
3. Unit tests
4. TypeScript type checking
5. Next.js unused variable check

**Gap:** ESLint is NOT run in pre-commit, only in CI.

### Implementation: Add ESLint to Pre-commit

**File: `.husky/pre-commit`**

```bash
#!/bin/sh
set -e  # Exit on first error

# ... existing checks ...

# NEW: Run ESLint on staged files before TypeScript check
echo "Running ESLint on staged files..."
if git diff --cached --name-only | grep -qE '\.(ts|tsx)$'; then
  npx eslint $(git diff --cached --name-only | grep -E '\.(ts|tsx)$') \
    --fix \
    --max-warnings 0 || {
    echo ""
    echo "ERROR: ESLint errors detected"
    echo ""
    echo "Common fixes:"
    echo "  1. Remove unused imports: grep 'no-unused-vars' output"
    echo "  2. Convert to type imports: import type { X } instead of import { X }"
    echo "  3. Remove dead code: delete _prefixed functions not referenced"
    echo ""
    echo "See: docs/solutions/patterns/ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md"
    exit 1
  }
fi

# Run TypeScript type checking (catches missed imports)
echo "Running TypeScript type check..."
npm run typecheck || {
  echo ""
  echo "ERROR: TypeScript compilation failed"
  echo "Likely causes:"
  echo "  1. Missing type imports (use 'import type')"
  echo "  2. Incorrect import names (check actual exports)"
  echo "  3. Removed variables still referenced"
  exit 1
}

# Verify Next.js build compatibility
echo "Checking Next.js unused variable strictness..."
if git diff --cached --name-only | grep -q "apps/web/"; then
  (cd apps/web && npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1) || {
    echo ""
    echo "ERROR: Unused variables detected in apps/web/"
    exit 1
  }
fi

echo "Pre-commit checks passed!"
```

### Key Benefits

✅ **Immediate feedback** - Developers see errors before committing
✅ **Prevents CI failures** - Catches 90% of linting issues locally
✅ **Auto-fix some issues** - ESLint with `--fix` auto-fixes many problems
✅ **Type safety layer** - TypeScript catch missed imports
✅ **Fast** - Only runs on staged files, not entire codebase

## Prevention Strategy 2: Decision Tree for Code Cleanup

### When to Delete vs When to Prefix with Underscore

```
Does the code serve a current purpose?
│
├─ YES (used by other code, tests rely on it, etc.)
│   └─ KEEP IT - Remove the _prefix if it has one
│
└─ NO (never called, never referenced)
    │
    ├─ Is it a function parameter you're required to accept?
    │   ├─ YES (callback signature, interface implementation)
    │   │   └─ PREFIX WITH _ (shows intentional, not a bug)
    │   │       Example: arr.forEach((_item, index) => {})
    │   │
    │   └─ NO (you created this variable)
    │       └─ DELETE IT
    │           Don't keep "dead weight" - git preserves history
    │
    ├─ Is it a helper function you wrote "for future use"?
    │   ├─ YES (no calls to this function exist)
    │   │   └─ DELETE IT
    │   │       Future-proofing creates technical debt
    │   │       When you need it, git history has it
    │   │
    │   └─ NO
    │
    └─ Is it a destructured value you don't use?
        ├─ YES (const { used, unused } = obj)
        │   └─ OPTION A: Delete the destructure
        │       const { used } = obj;
        │   OR OPTION B: Use rest pattern
        │       const { used, ..._ } = obj;
        │
        └─ NO
            └─ INVESTIGATE - Why does TypeScript think it's unused?
                (Might be a legitimate use case)
```

### Real Examples from Commit 764b9132

**Example 1: Type-only import (Convert to import type)**

```typescript
// BEFORE - ESLint error: "ContextCache imported but not used as a value"
import { ContextCache, defaultContextCache } from './context-cache';

// AFTER - Split imports by usage
import type { ContextCache } from './context-cache';
import { defaultContextCache } from './context-cache';

// Why: ContextCache is used as a type annotation, not instantiated
```

**Example 2: Unused import (Delete)**

```typescript
// BEFORE - Imported but never referenced
import { SOFT_CONFIRM_WINDOWS } from './types';

// AFTER - Remove it
// (Deleted entirely)

// Why: Code was refactored but import wasn't cleaned up
```

**Example 3: Dead code function (Delete)**

```typescript
// BEFORE - Function exists but is never called
function _getMachineEventForPhase(phase): OnboardingMachineEvent | null {
  // 20 lines of logic
  return mapping[phase] || null;
}

// AFTER - Replace with comment
// Note: getMachineEventForPhase was removed
// Events are now handled in state-machine.ts

// Why: YAGNI - Code was written for future feature that never materialized
//       Git history preserves the function if it becomes needed
```

**Example 4: Unused parameter (Prefix with underscore)**

```typescript
// BEFORE - Parameter required by signature but not used
async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
  const { tenantId, prisma, sessionId } = context;
  // ... sessionId is extracted but never used
}

// AFTER - Prefix with underscore or remove from destructure
async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
  const { tenantId, prisma } = context; // Removed sessionId
}

// Why: ESLint rule requires either use or prefix. Removal is cleaner here.
```

## Prevention Strategy 3: Code Review Checklist

### Add to PR/MR Template

````markdown
## Code Quality Checklist

### ESLint & Type Safety

- [ ] Ran `npm run lint` locally - no new warnings/errors
- [ ] Ran `npm run typecheck` - passes without errors
- [ ] All imports are necessary (no dead imports)
- [ ] Type-only imports use `import type` syntax
- [ ] No unused variables (remove or prefix with `_`)
- [ ] No functions/code kept "for future use"
- [ ] Switch case blocks have scope braces when needed

### YAGNI Principle

- [ ] Code implements current requirements only
- [ ] No placeholder/future-proof functions added
- [ ] No "just in case" parameters or exports
- [ ] Removed code is better than dormant code

### Common Patterns to Reject

When reviewing PRs, flag these patterns:

```typescript
// ❌ REJECT: Function with no callers
function _unusedHelper() {
  // This function is for future use...
}

// ❌ REJECT: Imported but unused
import { unusedConstant } from './module';

// ❌ REJECT: Type imported as value
import { MyType } from './types';
// Only used as: const x: MyType = ...

// ❌ REJECT: Declared but unused
const unusedVariable = calculateSomething();

// ✅ ACCEPT: Prefix unused parameter
arr.forEach((_item, index) => {
  console.log(index); // item not needed
});

// ✅ ACCEPT: Type-only import
import type { MyType } from './types';
```
````

````

## Prevention Strategy 4: ESLint Rule Configuration

### Verify Server ESLint Configuration

**File: `server/.eslintrc.json`**

Key rules that catch dead code:

```json
{
  "rules": {
    // Catch unused variables (requires _ prefix to ignore)
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "destructuredArrayIgnorePattern": "^_"
      }
    ],

    // Enforce type imports for type-only usage
    "@typescript-eslint/consistent-type-imports": [
      "error",
      {
        "prefer": "type-imports",
        "disallowTypeAnnotations": false,
        "fixStyle": "separate-type-imports"
      }
    ],

    // Catch console.log usage (use logger instead)
    "no-console": ["error", { "allow": ["warn", "error"] }]
  }
}
````

### Enable Stricter TypeScript Checks

**File: `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    // Catch truly unused local variables
    "noUnusedLocals": true,

    // Catch truly unused function parameters
    "noUnusedParameters": true,

    // Require explicit type when inference isn't clear
    "noImplicitAny": true
  }
}
```

**Why both ESLint and TypeScript?**

- **ESLint** catches syntax patterns (unused-vars rule)
- **TypeScript** catches semantic issues (type mismatches, noUnusedLocals)
- Together they provide comprehensive coverage

## Prevention Strategy 5: IDE Configuration

### VSCode Settings

**File: `.vscode/settings.json`**

```json
{
  // ESLint integration
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],

  // Show lint errors as you type
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },

  // TypeScript strict mode
  "typescript.tsserver.watchOptions": {
    "watchFile": "useFsEvents",
    "watchDirectory": "useFsEvents"
  }
}
```

### IntelliJ IDEA Settings

Enable in Settings → Languages & Frameworks → TypeScript:

- ✅ Strict mode
- ✅ Recompile on changes
- ✅ Enable ESLint

## Prevention Strategy 6: Automated Checks Script

### Script: `scripts/check-dead-code.sh`

```bash
#!/bin/bash
# Find and report dead code patterns

set -e

echo "=== Dead Code Detection ==="
echo ""

# 1. Find unused imports
echo "Scanning for unused imports..."
npx eslint server/src --format json 2>/dev/null | \
  jq '.[] | select(.messages[].ruleId == "@typescript-eslint/no-unused-vars") | .filePath' | \
  sort | uniq | wc -l | xargs echo "Files with unused variables:"

# 2. Find unused types in type imports
echo ""
echo "Checking type import usage..."
grep -r "^import.*from" server/src --include="*.ts" | \
  grep -E "import \{ [A-Z].*\}" | head -5

# 3. Find functions with no callers
echo ""
echo "Scanning for potentially unused functions..."
grep -r "^function _" server/src --include="*.ts" | \
  sed 's/:.*function /: /' | head -10

echo ""
echo "Run 'npm run lint' to auto-fix many of these issues"
```

**Usage:**

```bash
chmod +x scripts/check-dead-code.sh
./scripts/check-dead-code.sh
```

## Prevention Strategy 7: Build-Time Verification

### Stricter CI Build

**File: `.github/workflows/ci.yml` or `render.yaml`**

```yaml
# Example for GitHub Actions
- name: ESLint Check
  run: npm run lint -- --max-warnings 0

- name: TypeScript Check
  run: npm run typecheck

- name: Type-safe imports
  run: npm run lint -- --rule '@typescript-eslint/consistent-type-imports: error'
```

## Quick Reference: When to Delete vs Prefix

| Situation                       | Action          | Example                                          |
| ------------------------------- | --------------- | ------------------------------------------------ |
| Function never called           | DELETE          | `function _unused() { ... }` → delete it         |
| Parameter required by signature | PREFIX with `_` | `map((_item, idx) => idx)`                       |
| Imported but not used           | DELETE          | `import { unused } from '...'` → remove line     |
| Type imported as value          | SPLIT           | `import type { Type }` separate from values      |
| Variable never referenced       | DELETE          | `const x = fn();` (x unused) → remove line       |
| Destructured value unused       | DELETE or REST  | `const { a, _b } = obj;` or `const { a } = obj;` |
| Function for "future use"       | DELETE          | Comment like `// Removed - git has history`      |

## Implementation Checklist

- [ ] **Update `.husky/pre-commit`** to add ESLint check with `--max-warnings 0`
- [ ] **Verify `server/.eslintrc.json`** has correct rules configured
- [ ] **Enable `noUnusedLocals` in `server/tsconfig.json`** (or keep at workspace level)
- [ ] **Add PR template** with code quality checklist (see Strategy 3)
- [ ] **Create `.vscode/settings.json`** with ESLint auto-fix on save
- [ ] **Add `scripts/check-dead-code.sh`** for manual detection
- [ ] **Document in CLAUDE.md** (Common Pitfalls section)
- [ ] **Add to onboarding docs** - New developers should know these patterns

## Common Fixes Cheat Sheet

### Fix 1: Type-only import

```bash
# ESLint error: "@typescript-eslint/no-unused-vars: 'Type' is defined but never used"
# Cause: Type imported as value but only used in type annotations

# Before:
import { MyType } from './types';

# After:
import type { MyType } from './types';
```

### Fix 2: Remove unused import

```bash
# ESLint error: "@typescript-eslint/no-unused-vars: 'constant' is defined but never used"

# Before:
import { constant, anotherConstant } from './constants';

# After (if constant is unused):
import { anotherConstant } from './constants';
```

### Fix 3: Remove unused variable

```bash
# ESLint error: "@typescript-eslint/no-unused-vars: 'result' is assigned a value but never used"

# Before:
const result = processData();
const nextValue = 42;

# After:
const nextValue = 42;
```

### Fix 4: Delete dead code function

```bash
# ESLint error: "@typescript-eslint/no-unused-vars: '_helper' is defined but never used"

# Before:
function _helper() {
  // 15 lines of code written "just in case"
}

# After (replace with comment):
// Note: helper function was removed
// (Git history preserves the implementation)
```

## Verification Commands

```bash
# Check for ESLint violations
npm run lint -- --max-warnings 0

# Check for TypeScript issues
npm run typecheck

# Check specifically for unused variables
npm run typecheck -- --noUnusedLocals --noUnusedParameters

# Auto-fix safe issues
npm run lint -- --fix

# Show detailed output for one file
npx eslint server/src/agent/tools/onboarding-tools.ts --format=compact
```

## Related Documentation

- **[typescript-unused-variables-build-failure-MAIS-20251227.md](../build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md)** - TypeScript strictness configuration
- **[import-name-mismatch-onboarding-tools-MAIS-20251231.md](../build-errors/import-name-mismatch-onboarding-tools-MAIS-20251231.md)** - Import validation patterns
- **[CLAUDE.md Prevention Strategies](../../CLAUDE.md#prevention-strategies-read-these)** - Link to all prevention docs

## Lessons Learned from Commit 764b9132

1. **ESLint limitations** - ESLint catches syntax, TypeScript catches semantics. Use both.
2. **Type imports matter** - `import type` prevents value imports of types, reducing bundle size
3. **Delete > Prefix** - Remove unused code rather than prefix with `_`. Use `_` only for required parameters.
4. **YAGNI principle** - Code written "for future use" becomes technical debt. Git has history.
5. **Pre-commit is critical** - Run linting locally before commit to fail fast

## Anti-Pattern: The Fake Function

```typescript
// ❌ BAD - Fake function to satisfy linter
function _unusedTypeReference(): SomeType {
  // Never called, exists only to prevent "type not used" warning
  return {} as SomeType;
}

// ✅ GOOD - Delete it
// If needed later, git history has the implementation
// If it's truly only needed as a type check, use as const assertion instead:
const x = {} as SomeType; // Type check only, no runtime cost
```

## Success Metrics

After implementing these strategies, you should see:

- ✅ **Zero ESLint errors in pre-commit** - Developers fix issues before committing
- ✅ **Reduced CI build time** - No wasted time on linting failures
- ✅ **Cleaner code reviews** - Reviewers focus on logic, not dead code cleanup
- ✅ **Less technical debt** - Dead code doesn't accumulate
- ✅ **Better type safety** - Type imports prevent accidental value usage
