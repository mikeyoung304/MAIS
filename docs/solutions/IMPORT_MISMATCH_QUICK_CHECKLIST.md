---
module: MAIS
date: 2025-12-31
problem_type: quick_reference
severity: P2
---

# Quick Checklist: Import Mismatch Prevention

> **TL;DR**: Use IDE autocomplete, verify singular/plural, check for async/sync, enable TypeScript strict mode.

---

## Development Checklist (Before Writing Imports)

```
❏ Review naming conventions for the module
  - Arrays exported with plural: getItems, getTenants
  - Single items with singular: getItem, getTenant
  - Domain-prefixed exports: onboardingTools, bookingEvent (not just tools/event)

❏ Use IDE autocomplete to find export
  - Type: import { [press Ctrl+Space]
  - See what's actually exported in the list
  - Don't guess at names

❏ Check function signature for async/sync
  - Has `async` keyword? Must use `await` at import site
  - No `async`? Call synchronously
  - Exported as `getDataAsync()`? Import that exact name

❏ Run TypeScript check after writing import
  - npm run typecheck
  - Should see 0 errors for import-related issues
  - If "Cannot find name X" appears, export doesn't exist
```

---

## Code Review Checklist (When Reviewing PRs)

### Exact Match

- [ ] Imported name matches export exactly (character-by-character)
  - ❌ `import { getItem }` but `export const getItems`
  - ✅ `import { getItems }`

### Singular/Plural

- [ ] Functions returning arrays use plural
  - ❌ `const item = getItem()` if it returns `Item[]`
  - ✅ `const items = getItems()` if it returns `Item[]`

### Async/Sync

- [ ] Function signature matches usage
  - ❌ `const data = getConfig()` if function is `async getConfig()`
  - ✅ `const data = await getConfig()`

### Domain Prefix

- [ ] Tools/events/handlers use domain prefix
  - ❌ `import { tools }` (too generic, likely collision)
  - ✅ `import { onboardingTools, readTools }`

### IDE Verification

- [ ] Test autocomplete yourself (Ctrl+Space)
  - If import name isn't in the autocomplete list, it doesn't exist

### TypeScript Build

- [ ] TypeScript build passes locally
  ```bash
  npm run typecheck
  # No TS2305 "module has no exported member" errors
  ```

---

## Pre-Commit Checklist

```bash
# Run TypeScript check
npm run typecheck
# ✓ No TS errors
# ✓ No "Cannot find name" messages

# Run import tests (if available)
npm test -- import-resolution.test.ts
# ✓ All exports resolved correctly

# Run full linter
npm run lint
# ✓ No ESLint import/named errors
```

---

## Common Mistakes (Don't Do These)

| Mistake                        | Symptom                                                 | Fix                                          |
| ------------------------------ | ------------------------------------------------------- | -------------------------------------------- |
| Singular form for array return | `getItem()` returns `Item[]`                            | Use plural: `getItems()`                     |
| Plural form for single return  | `getItems()` returns `Item`                             | Use singular: `getItem()`                    |
| Missing async keyword          | `const x = fetchData()` but it's async                  | Add: `const x = await fetchData()`           |
| Wrong module name              | `import { tools }` from shared                          | Include domain: `import { onboardingTools }` |
| Typo in name                   | `import { getTenants }` but exports `getTenant`         | Use IDE autocomplete, don't guess            |
| Case sensitivity               | `import { GetItems }` vs `export const getItems`        | JavaScript is case-sensitive, match exactly  |
| Wrong import path              | `import from './repo'` but file is `./repository.ts`    | Use IDE "Go to Definition" to verify         |
| Default vs named               | `import Tools from...` but exports `export const tools` | Use curly braces: `import { tools }`         |

---

## 30-Second Decision Tree

```
Finding an import statement?

├─ Does it have curly braces { }?
│  └─ Named import: verify export name matches exactly
│
├─ No curly braces?
│  └─ Default import: verify export default { name }
│
├─ Function name sounds plural (getItems, getTenants)?
│  └─ Check return type: should be Array or Promise<Array>
│
├─ Function name sounds singular (getItem, getTenant)?
│  └─ Check return type: should NOT be Array
│
├─ Function name includes "Async" suffix?
│  └─ Must use: const x = await functionName()
│
├─ Function has no Async suffix but imports seem async?
│  └─ Check source: does it have `async` keyword?
│
└─ Still unsure?
   └─ Use IDE: Ctrl+Space in import brackets to see available exports
```

---

## One-Line Prevention Rules

1. **Autocomplete is your friend**: `import { [Ctrl+Space]` - use it every time
2. **Singular = one, Plural = many**: Match function name to return type
3. **Check the build**: `npm run typecheck` before pushing
4. **Domain prefixes prevent collisions**: Use `onboardingTools` not `tools`
5. **TypeScript is your guard rail**: Enable `strict: true` in tsconfig

---

## Files to Check When Adding Imports

```
server/src/
├── agent/
│   └── tools/
│       ├── onboarding-tools.ts          ← Domain-prefixed exports
│       ├── read-tools.ts                ← Domain-prefixed exports
│       ├── write-tools.ts               ← Domain-prefixed exports
│       └── all-tools.ts                 ← Combines above
│
├── services/
│   ├── booking.service.ts               ← Singular & plural consistency
│   └── [name].service.ts                ← Follow same pattern
│
├── adapters/
│   └── prisma/
│       └── [entity].repository.ts       ← Repository pattern
│
└── lib/
    ├── ports.ts                         ← Interface definitions
    └── entities.ts                      ← Type definitions
```

**When adding imports from these, use IDE autocomplete to verify names.**

---

## Eslint Commands for Import Validation

```bash
# Fix auto-fixable import issues
npm run lint -- --fix

# Check for import/named mismatches
npm run lint -- --rule 'import/named: error'

# Check for unresolved imports
npm run lint -- --rule 'import/no-unresolved: error'

# See all import-related rules
npm run lint -- --help | grep import
```

---

## TypeScript Commands for Validation

```bash
# Full strict type checking (catches import errors)
npm run typecheck

# More strict checking (if you enable noUncheckedIndexedAccess)
npm run typecheck -- --strict

# Show all TypeScript errors (including imports)
npm run typecheck -- --noEmit
```

---

## IDE Quick Actions

### VSCode

| Action           | Keyboard    | What it does                        |
| ---------------- | ----------- | ----------------------------------- |
| Go to Definition | F12         | Jump to where export is defined     |
| Find References  | Shift+F12   | See all imports of this export      |
| Rename Symbol    | F2          | Rename export (updates all imports) |
| Autocomplete     | Ctrl+Space  | Show available exports to import    |
| Organize Imports | Shift+Alt+O | Sort and dedupe imports             |
| Fix All ESLint   | Ctrl+Alt+I  | Auto-fix import errors              |

---

## Test It Before Committing

```typescript
// In any test file, this validates imports work:
import { getItems } from './module';

describe('Import Validation', () => {
  it('should import successfully', () => {
    // If this test runs, the import is valid
    expect(getItems).toBeDefined();
  });
});
```

**Quick test command:**

```bash
npm test -- import-resolution.test.ts 2>&1 | head -20
```

If you see "Cannot find module", imports failed before tests even ran.

---

## Checklist for This PR

- [ ] All imports use IDE autocomplete (Ctrl+Space)
- [ ] No singular/plural mismatches (getItem vs getItems)
- [ ] All async functions imported with `await`
- [ ] Domain prefixes consistent (onboardingTools, not tools)
- [ ] `npm run typecheck` passes locally
- [ ] `npm test` passes locally
- [ ] No ESLint import/named warnings

---

## When You're Stuck

1. **Run autocomplete**: Press Ctrl+Space after `import {` to see what actually exists
2. **Use Go to Definition**: F12 to jump to the export and see exact name/signature
3. **Check TypeScript errors**: `npm run typecheck` - read the error message carefully
4. **Search the file**: Ctrl+F for `export const` to manually find what's exported
5. **Ask in code review**: "What's the correct import for X?" - reviewers can verify

**If none of these work, the export probably doesn't exist and needs to be created.**

---

## Prevention Quick Start (5 minutes)

1. Enable TypeScript strict mode in `tsconfig.json` (2 min)
2. Install ESLint import plugin: `npm install --save-dev eslint-plugin-import` (1 min)
3. Update `.eslintrc.cjs` to include import rules (1 min)
4. Run `npm run lint` to see any existing issues (1 min)

That's it. Now import mismatches will be caught automatically.

---

## Related Documents

- **Full Guide**: [IMPORT_MISMATCH_PREVENTION.md](IMPORT_MISMATCH_PREVENTION.md)
- **Naming Conventions**: Check your project's NAMING_CONVENTIONS.md
- **TypeScript Strict Mode**: [TypeScript Configuration Reference](https://www.typescriptlang.org/tsconfig)
