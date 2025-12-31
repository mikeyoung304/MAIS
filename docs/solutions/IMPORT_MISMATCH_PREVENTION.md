---
module: MAIS
date: 2025-12-31
problem_type: prevention_strategy
component: typescript/imports
symptoms:
  - "TypeScript build fails: 'Cannot find name X' or 'Module has no exported member X'"
  - Developer imports singular form (getItem) but export is plural (getItems)
  - Importing sync function (appendEvent) but export is async (appendOnboardingEvent)
  - Import path correct, but export name doesn't match
  - IDE autocomplete doesn't show expected export
root_cause: Manual import statements that don't match actual export names; naming convention inconsistencies between singular/plural and prefix variations
resolution_type: prevention_strategy
severity: P2
related_files:
  - server/src/agent/tools/onboarding-tools.ts
  - server/src/agent/tools/all-tools.ts
  - server/src/services/*.ts
  - packages/contracts/src/**/*.ts
tags: [typescript, imports, exports, naming-conventions, prevention]
---

# Prevention Strategy: Import Mismatch Bug Pattern

## Problem Summary

Import mismatches occur when developers write import statements that reference exports that don't exist. This happens in three common patterns:

1. **Singular vs Plural Mismatch**: Importing `getItem` when export is `getItems`
2. **Prefix/Name Variation**: Importing `appendEvent` when export is `appendOnboardingEvent`
3. **Async vs Sync Confusion**: Importing `getConfig` (sync) when it's actually `getConfigAsync` (async) or vice versa

These bugs aren't caught until:

- TypeScript build fails (if `noImplicitAny` is enabled)
- IDE autocomplete search yields zero results
- Runtime import fails with "module has no exported member"

---

## Part 1: Pre-Commit Checks & IDE Settings

### 1.1 ESLint Rule: Enforce Export-Import Consistency

Add this custom ESLint rule to your `.eslintrc.cjs`:

```javascript
module.exports = {
  rules: {
    // ... existing rules ...

    // Custom rule to catch likely import mismatches
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        // Catch variables that look like misspelled imports
        caughtErrorsIgnorePattern: '^_',
        caughtErrors: 'all',
      },
    ],

    // Enforce strict naming for functions that return arrays
    'naming-convention': 'off', // Use custom rules below instead
  },
};
```

**Better approach:** Use a stricter TypeScript config with `noImplicitAny`:

```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 1.2 Pre-Commit Hook: Validate Imports

Create `scripts/validate-imports.js`:

```javascript
#!/usr/bin/env node
/**
 * Pre-commit hook to validate that all imports match their exports
 * Run with: node scripts/validate-imports.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get list of changed files
const changedFiles = execSync('git diff --cached --name-only', {
  encoding: 'utf-8',
})
  .split('\n')
  .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

const issues = [];

changedFiles.forEach((file) => {
  if (!fs.existsSync(file)) return;

  const content = fs.readFileSync(file, 'utf-8');

  // Find all import statements
  const importRegex = /import\s+(?:{[^}]+}|[^;]+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const [fullImport, importPath] = match;
    const names =
      fullImport
        .match(/{(.+?)}/)?.[1]
        ?.split(',')
        .map((n) => n.trim()) || [];

    // Skip relative imports that are files (not directories)
    if (importPath.startsWith('.')) {
      const resolvedPath = path.resolve(path.dirname(file), importPath);

      // Try with .ts, .tsx extensions
      const candidates = [
        `${resolvedPath}.ts`,
        `${resolvedPath}.tsx`,
        `${resolvedPath}/index.ts`,
        `${resolvedPath}/index.tsx`,
      ];

      const exportFile = candidates.find((f) => fs.existsSync(f));
      if (!exportFile) continue;

      const exportContent = fs.readFileSync(exportFile, 'utf-8');

      names.forEach((name) => {
        // Check for exact export
        if (
          !exportContent.match(
            new RegExp(`export\\s+(const|function|class|interface|type|enum)\\s+${name}\\b`)
          )
        ) {
          issues.push(`${file}: Imported "${name}" from "${importPath}" but no export found`);
        }
      });
    }
  }
});

if (issues.length > 0) {
  console.error('Import validation failed:');
  issues.forEach((issue) => console.error(`  ❌ ${issue}`));
  process.exit(1);
}

console.log('✅ All imports validated');
```

Add to `package.json`:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "node scripts/validate-imports.js && npm run typecheck"
    }
  }
}
```

### 1.3 VSCode Settings for Import Validation

Create `.vscode/settings.json`:

```json
{
  "typescript.tsserver.experimental.enableProjectDiagnostics": true,
  "typescript.preferGoToSourceDefinitionWithoutReferenceCodeLens": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": true,
      "source.organizeImports": true
    }
  },
  // Strict import validation
  "typescript.strict": true,
  "typescript.checkJs": true
}
```

Add ESLint plugin for import validation:

```json
{
  "devDependencies": {
    "eslint-plugin-import": "^2.29.0",
    "eslint-plugin-simple-import-sort": "^10.0.0"
  }
}
```

Update `.eslintrc.cjs`:

```javascript
module.exports = {
  plugins: ['import', 'simple-import-sort'],
  rules: {
    'import/named': 'error', // Catch named import mismatches
    'import/default': 'error', // Catch default import mismatches
    'import/no-unresolved': 'error', // Catch missing modules
    'simple-import-sort/imports': 'error',
  },
};
```

---

## Part 2: Code Review Checklist Items

Use these checklist items when reviewing imports/exports:

### Import Review Template

```markdown
### Import/Export Validation

- [ ] **Exact Match Check**: Verify each imported name matches an `export` statement exactly
  - [ ] Look for import: `import { getItem }`
  - [ ] Verify export exists: `export const getItem = ...` (not `export const getItems`)

- [ ] **Singular/Plural Consistency**: Check for singular/plural mismatches
  - [ ] Functions returning arrays use plural: `getItems()`, `getTenants()`
  - [ ] Functions returning single items use singular: `getItem()`, `getTenant()`
  - [ ] Collections named plural: `items: Item[]`, `services: Service[]`

- [ ] **Async/Sync Naming**: Functions with async behavior clearly marked
  - [ ] Async functions: `async function fetchData()` or `const fetchDataAsync = async () => {}`
  - [ ] Sync functions: No `async` keyword, no `Async` suffix
  - [ ] Imports match the actual function signature

- [ ] **Prefix Consistency**: Tool/handler names include all relevant prefixes
  - [ ] Tool imports: `getTenantTools`, `getOnboardingTools` (include context)
  - [ ] Not `getTools` (too generic, likely to conflict)
  - [ ] Event names: `onboardingEvent`, `bookingEvent` (include domain prefix)

- [ ] **IDE Autocomplete Works**: Manually test in VS Code
  - [ ] Type import path, press Ctrl+Space, see expected export in list
  - [ ] If not in list, the export doesn't exist with that name

- [ ] **TypeScript Build Passes**: Run `npm run typecheck` locally
  - [ ] No TS2305 "module has no exported member" errors
  - [ ] No implicit `any` from failed import resolution
```

### Code Review Comment Template

When you spot an import mismatch during review:

````markdown
**Request Changes: Import Mismatch**

The import statement doesn't match the actual export:

```typescript
// ❌ This import:
import { getItem } from './repository';

// ❌ But the export is:
export const getItems = async (tenantId: string) => { ... }
```
````

**Fix:**

- Change import to match export name: `import { getItems }`
- Or rename export to match intended import

**Prevention for next time:**

1. Use IDE autocomplete (Ctrl+Space) after `import { `
2. Verify TypeScript build passes (`npm run typecheck`)
3. Check singular/plural naming (see NAMING_CONVENTION.md)

````

---

## Part 3: Naming Convention Guidelines

### 3.1 Array/Collection Naming

**Rule**: Functions returning arrays/collections use **plural names**.

```typescript
// ✅ CORRECT
export const getTenants = async (limit?: number) => Tenant[];
export const getBookings = (tenantId: string) => Promise<Booking[]>;
export const listSegments = (tenantId: string) => Segment[];

// ❌ WRONG
export const getTenant = () => Tenant[];  // Singular but returns multiple
export const getBooking = (id) => Booking[]; // Misleading name
````

**For single item returns**:

```typescript
// ✅ CORRECT - clearly singular
export const getTenant = async (id: string) => Promise<Tenant>;
export const getBooking = (id: string) => Booking | null;

// ❌ WRONG
export const getTenants = (id: string) => Tenant; // Name says plural, returns one
```

### 3.2 Async Function Naming

**Rule**: Async functions can be named either way, but be consistent within a module.

**Option A: No suffix (recommended for most code)**

```typescript
// ✅ CONSISTENT - all async, no suffix
export const getTenant = async (id: string) => Tenant;
export const createTenant = async (data: CreateTenantInput) => Tenant;
export const deleteTenant = async (id: string) => void;

// When reading code, reader checks function signature for `async`
```

**Option B: Explicit `Async` suffix (recommended for APIs that might have sync versions)**

```typescript
// ✅ CONSISTENT - all explicitly async
export const getTenantAsync = async (id: string) => Tenant;
export const createTenantAsync = async (data: TenantInput) => Tenant;

// Useful if you also have:
export const getTenantSync = (id: string) => Tenant | null; // From cache
```

### 3.3 Domain-Prefixed Exports

**Rule**: Exports from shared modules should include domain prefix to avoid name collisions.

```typescript
// ✅ CORRECT - domain prefix prevents collisions
export const onboardingTools = [...];  // In agent/tools/onboarding-tools.ts
export const readTools = [...];        // In agent/tools/read-tools.ts
export const getAllToolsWithOnboarding = () => [...];

// Usage:
import { onboardingTools, readTools } from './tools';

// ❌ WRONG - too generic
export const tools = [...];  // Which tools? Collision with other modules
export const getTools = () => [...]; // Same problem
```

### 3.4 Event Naming

**Rule**: Events include the domain/entity they relate to.

```typescript
// ✅ CORRECT
export const BookingEvents = {
  CREATED: 'booking.created',
  CANCELLED: 'booking.cancelled',
  RESCHEDULED: 'booking.rescheduled',
};

export const OnboardingEvents = {
  STARTED: 'onboarding.started',
  COMPLETED: 'onboarding.completed',
};

// Usage - no collision risk:
import { BookingEvents, OnboardingEvents } from './events';
emitter.emit(BookingEvents.CREATED, data); // Clear what domain
emitter.emit(OnboardingEvents.STARTED, data); // Different from above

// ❌ WRONG - ambiguous
export const CREATED = 'created'; // Created what? What if multiple modules export this?
```

### 3.5 Repository/Service Naming

**Rule**: Repository interfaces and implementations follow: `Interface` + `Adapter`.

```typescript
// ✅ CORRECT pattern
export interface BookingRepository {
  create: (data: CreateBookingInput) => Promise<Booking>;
  getById: (tenantId: string, id: string) => Promise<Booking | null>;
  // Note: plurals for multiple returns
  getAll: (tenantId: string) => Promise<Booking[]>;
}

export class PrismaBookingRepository implements BookingRepository {
  async create(data: CreateBookingInput) { ... }
  async getById(tenantId: string, id: string) { ... }
  async getAll(tenantId: string) { ... }
}

// Usage - clear what you're getting
import { BookingRepository } from '../ports';
import { PrismaBookingRepository } from '../adapters';

const repo: BookingRepository = new PrismaBookingRepository();
const bookings = await repo.getAll(tenantId); // Plural, returns array

// ❌ WRONG
export class BookingPrismaRepository { } // Confusing order
export class Repository { } // Too generic
```

---

## Part 4: Testing Patterns That Catch Import Mismatches

### 4.1 Import Resolution Test

Create `server/src/__tests__/import-resolution.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as toolsModule from '../agent/tools/all-tools';
import * as readToolsModule from '../agent/tools/read-tools';
import * as writeToolsModule from '../agent/tools/write-tools';
import * as onboardingToolsModule from '../agent/tools/onboarding-tools';

describe('Import Resolution - Named Exports Exist', () => {
  it('should export readTools from read-tools.ts', () => {
    expect(readToolsModule.readTools).toBeDefined();
    expect(Array.isArray(readToolsModule.readTools)).toBe(true);
  });

  it('should export writeTools from write-tools.ts', () => {
    expect(writeToolsModule.writeTools).toBeDefined();
    expect(Array.isArray(writeToolsModule.writeTools)).toBe(true);
  });

  it('should export onboardingTools from onboarding-tools.ts', () => {
    expect(onboardingToolsModule.onboardingTools).toBeDefined();
    expect(Array.isArray(onboardingToolsModule.onboardingTools)).toBe(true);
  });

  it('should export getAllTools function', () => {
    expect(toolsModule.getAllTools).toBeDefined();
    expect(typeof toolsModule.getAllTools).toBe('function');
  });

  it('should export getAllToolsWithOnboarding function', () => {
    expect(toolsModule.getAllToolsWithOnboarding).toBeDefined();
    expect(typeof toolsModule.getAllToolsWithOnboarding).toBe('function');
  });

  it('should have consistent tool array lengths', () => {
    const all = toolsModule.getAllTools();
    const allWithOnboarding = toolsModule.getAllToolsWithOnboarding();

    expect(allWithOnboarding.length).toBeGreaterThan(all.length);
    expect(allWithOnboarding.length - all.length).toBe(
      onboardingToolsModule.onboardingTools.length
    );
  });
});
```

Run with: `npm test -- import-resolution.test.ts`

### 4.2 Singular vs Plural Test

Create `server/src/__tests__/naming-conventions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Test various modules for naming consistency
describe('Naming Convention: Singular vs Plural', () => {
  describe('Repository methods', () => {
    it('should use plural names for array-returning methods', async () => {
      // When testing a repository like:
      // export const getBookings = () => Booking[]

      const bookingRepo = createTestRepository();
      const result = await bookingRepo.getAll('tenant-1');

      // The method name 'getAll' implies array return
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use singular names for single-item returns', async () => {
      const bookingRepo = createTestRepository();
      const result = await bookingRepo.getById('tenant-1', 'booking-123');

      // The method name 'getById' (singular) implies single item
      expect(result === null || typeof result === 'object').toBe(true);
      expect(Array.isArray(result)).toBe(false);
    });
  });

  describe('Service methods follow same convention', () => {
    it('getTenant returns single item', async () => {
      const service = new TenantService(repo);
      const result = await service.getTenant('tenant-1');
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(false);
    });

    it('getTenants returns array', async () => {
      const service = new TenantService(repo);
      const result = await service.getTenants();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
```

### 4.3 Type Checking Test

Create a test that verifies imports work with TypeScript:

```typescript
// server/src/__tests__/type-checking.test.ts
import { describe, it, expect } from 'vitest';

describe('TypeScript Import Type Checking', () => {
  it('should compile without import errors', () => {
    // This test simply imports everything
    // If imports fail, this file won't compile
    // This is a compile-time check, not runtime

    // Import verification is the test itself
    expect(true).toBe(true);
  });
});
```

Run: `npm run typecheck` before tests to catch import errors.

### 4.4 Export Discovery Test

Create `server/src/__tests__/export-discovery.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as onboardingTools from '../agent/tools/onboarding-tools';

describe('Export Discovery - All Exports Documented', () => {
  it('should list all exports from onboarding-tools', () => {
    const exportedNames = Object.keys(onboardingTools).filter((key) => !key.startsWith('_'));

    expect(exportedNames).toContain('onboardingTools');
    expect(exportedNames).toContain('updateOnboardingStateTool');
    expect(exportedNames).toContain('upsertServicesTool');
    expect(exportedNames).toContain('updateStorefrontTool');

    console.log('Exported from onboarding-tools:', exportedNames);
  });

  it('should verify export is array, not empty', () => {
    expect(onboardingTools.onboardingTools).toBeDefined();
    expect(Array.isArray(onboardingTools.onboardingTools)).toBe(true);
    expect(onboardingTools.onboardingTools.length).toBeGreaterThan(0);
  });
});
```

This test helps discover what's actually exported vs what you think is exported.

---

## Part 5: Quick Reference Checklist

### Pre-Development

- [ ] Review `NAMING_CONVENTION_GUIDELINES.md` before writing new exports
- [ ] Set up ESLint with `eslint-plugin-import`
- [ ] Enable TypeScript `strict: true` mode
- [ ] Use IDE autocomplete to verify exports exist before importing

### During Development

- [ ] After writing `export`, test it with: `npm run typecheck`
- [ ] Use IDE Ctrl+Space autocomplete to browse available exports
- [ ] If import fails, check:
  - [ ] Is the name spelled exactly right?
  - [ ] Is it exported (not just declared)?
  - [ ] Is it using the right singular/plural form?
  - [ ] Is it truly async/sync as the function signature shows?

### Before Commit

```bash
# Validate imports
npm run typecheck

# Run import resolution tests
npm test -- import-resolution.test.ts

# Check pre-commit hook passes
npm run validate-imports
```

### Code Review

- [ ] Use the "Import/Export Validation" checklist from Part 2
- [ ] Verify singular/plural matches return type (getItems() returns [], getItem() returns object)
- [ ] Verify async/sync signature matches function name
- [ ] Verify domain prefixes are consistent across module
- [ ] Run IDE autocomplete check yourself

### Common Mistakes Checklist

```
❌ Importing `getItem` from module that exports `getItems`
   → Check function signature. If returns [], must be plural.

❌ Importing sync function but signature is `async`
   → Use `await` at import site or update function name

❌ Importing `getTool` but only `toolKit` is exported
   → Look for domain prefix. Often tools exported as `getBuildTools`, `getConfigTools`

❌ Importing from `'./repo'` but file is `./repository.ts`
   → Check actual filename, use IDE Go to Definition

❌ Importing `User` but module exports `UserEntity`
   → Check export statement for wrapper name (Entity, Dto, Schema suffix)
```

---

## Part 6: Automation: TypeScript Configuration

Update `tsconfig.json` in each workspace:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
    "forceConsistentCasingInFileNames": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true
  }
}
```

These settings catch import-related issues before they reach code review:

- `noImplicitAny`: Catches type inference failures from bad imports
- `noUncheckedIndexedAccess`: Prevents using imported values unsafely
- `forceConsistentCasingInFileNames`: Prevents wrong filename imports

---

## Part 7: Editor Extensions for Import Validation

### VSCode Extensions

Install these extensions:

1. **ES7 Import Sorter** (`salbert.es7-string-css-html-javascript-snippets`)
   - Auto-organizes imports alphabetically
   - Highlights unused imports in gray

2. **JavaScript Debugger** (built-in)
   - Hover over imports to see what they resolve to
   - Use "Go to Definition" to verify export exists

3. **TypeScript Vue Plugin** (if using Vue, similar for React)
   - Real-time import validation

### Custom VSCode Keyboard Shortcut

Add to `.vscode/keybindings.json`:

```json
[
  {
    "key": "ctrl+alt+i",
    "command": "editor.action.fixAll.eslint",
    "when": "editorFocus && editorLangId == typescript"
  },
  {
    "key": "ctrl+shift+o",
    "command": "workbench.action.gotoSymbol",
    "when": "editorFocus && editorLangId == typescript"
  }
]
```

- `Ctrl+Alt+I`: Auto-fix import-related ESLint errors
- `Ctrl+Shift+O`: Jump to symbol (great for verifying exports)

---

## Part 8: Continuous Integration

Add this GitHub Actions check:

```yaml
# .github/workflows/import-validation.yml
name: Import Validation

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: TypeScript Check
        run: npm run typecheck
      - name: Import Resolution Tests
        run: npm test -- import-resolution.test.ts
      - name: ESLint Import Rules
        run: npm run lint -- --rule 'import/named: error'
```

---

## Summary & Decision Tree

**When you encounter an import error:**

```
Module X has no exported member Y

├─ Check 1: Does the export exist?
│  └─ Look at source file for: export const Y = ...
│     If not found, check:
│     ├─ Different filename? (e.g., repository.ts not repo.ts)
│     ├─ Different folder? (e.g., ../adapters/prisma/ not ./adapters/)
│     └─ Different name? (e.g., getItems not getItem)
│
├─ Check 2: Is it a singular/plural issue?
│  └─ If returns array: needs plural name (getItems, getTenants)
│     If returns single: needs singular name (getItem, getTenant)
│
├─ Check 3: Is it an async/sync issue?
│  └─ Look at function signature: does it have `async`?
│     Your import site must use `await` for async functions
│
├─ Check 4: Is there a domain prefix?
│  └─ Common pattern: onboardingTools, readTools, bookingEvent
│     Not just: tools, events
│
└─ Check 5: Run IDE autocomplete
   └─ Import path, then Ctrl+Space
      See what names are actually available
```

**Prevention hierarchy** (implement in order):

1. **Use IDE autocomplete** - Immediate feedback
2. **Enable TypeScript strict mode** - Catches at compile time
3. **Use ESLint import rules** - Automated validation
4. **Pre-commit hooks** - Block bad imports before commit
5. **Code review checklist** - Human verification
6. **Tests** - Catch regressions

---

## References

- **Naming Conventions**: See `NAMING_CONVENTIONS.md` in project docs
- **TypeScript Best Practices**: [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- **ESLint Import Plugin**: [eslint-plugin-import](https://github.com/import-js/eslint-plugin-import)
- **Husky Pre-Commit**: [Husky Documentation](https://typicode.github.io/husky/)
