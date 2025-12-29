---
module: MAIS
date: 2025-12-29
problem_type: build_error
component: server/src, apps/web/src
symptoms:
  - TS1259: Module can only be default imported using 'import express from "express"'
  - Module does not have an export named 'X'
  - Cannot find module 'package-name/wrong-path'
  - Default import from module that only has named exports
root_cause: Importing from wrong module path or using wrong import syntax (default vs named imports)
resolution_type: code_review_pattern
severity: P2
related_files:
  - server/src/**/*.ts (all server imports)
  - apps/web/src/**/*.tsx (all client imports)
  - packages/contracts/src/**/*.ts (package exports)
tags: [typescript, imports, modules, build-errors, esm-cjs]
---

# Prevention Strategy: Import Source Errors

## Problem Summary

**Issue:** TypeScript compilation fails when code imports from wrong module path or uses wrong import style (default vs named).

**Root Causes:**

1. Importing from wrong subpath (e.g., importing from 'lodash' instead of 'lodash-es')
2. Using default import for named export module
3. Using named import for default export module
4. Importing from internal package with wrong path
5. Path doesn't exist or was moved

**Impact:**

- Build fails with TS1259 or "Module not found" errors
- Cannot deploy to production
- Runtime behavior would also fail

**Example:**

```typescript
// ❌ WRONG - Multiple import errors

// Wrong subpath (Node doesn't expose this)
import { createReadStream } from 'fs/promises'; // ← Wrong path

// Default import from named exports module
import contract from '@macon/contracts'; // ← Should use named import

// Wrong module completely
import type { Package } from 'prisma'; // ← Should be '@prisma/client'

// Non-existent export
import { nonExistentFunction } from '@macon/shared'; // ← Doesn't exist

// Build errors:
// TS1259: Module can only be default imported using 'import'
// TS2307: Cannot find module
// TS2614: Has no exported member
```

---

## Prevention Strategy

### 1. Import Standards for MAIS

**Document in CLAUDE.md:**

````markdown
## Import Standards and Best Practices

### TypeScript Imports

Always use named imports by default:

```typescript
// ✅ PREFERRED: Named imports
import { createBooking, getBooking } from '../services/booking.service';
import type { Booking, CreateBookingInput } from '../lib/entities';
import { logger } from '../lib/core/logger';

// ❌ AVOID: Default imports (unless required by library)
import BookingService from '../services/booking.service';

// ❌ NEVER: Mixed imports without organization
import { createBooking } from '../services/booking.service';
import bookingModule from '../services/booking.service';
```
````

### Default vs Named Exports

**Use named exports by default:**

```typescript
// ✅ CORRECT: Named exports (more modular)
export class BookingService {
  // ...
}

export interface CreateBookingInput {
  // ...
}

// ✅ CORRECT: Import them
import { BookingService } from '../services/booking.service';
import type { CreateBookingInput } from '../services/booking.service';
```

**Use default export only for:**

1. Class libraries (Express, etc. - library convention)
2. React components in separate files
3. Page components in Next.js

```typescript
// ✅ CORRECT: React component file gets default export
export default function BookingPage() {
  // ...
}

// Import it:
import BookingPage from './BookingPage';

// ✅ CORRECT: Express app as default
export default function createApp() {
  const app = express();
  // ...
  return app;
}

// Import it:
import createApp from './app.factory';
```

### Internal Package Imports

**Always use full import paths from packages:**

```typescript
// For @macon/contracts
import { contract } from '@macon/contracts';
import type { BookingResponse } from '@macon/contracts';

// For @macon/shared
import { formatCurrency } from '@macon/shared';
import { logger } from '@macon/shared';

// Never abbreviate paths:
// ❌ DON'T: import { contract } from '@macon/contracts/dist';
// ✅ DO:   import { contract } from '@macon/contracts';
// The 'dist' export is handled in package.json "exports" field
```

### Relative vs Absolute Imports

**In Next.js (apps/web):**

```typescript
// ✅ CORRECT: Use alias from tsconfig
import { Button } from '@/components/ui/Button';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { logger } from '@/lib/logger';

// ❌ AVOID: Relative paths (hard to refactor)
import { Button } from '../../components/ui/Button';
import { useTenantAuth } from '../../../../hooks/useTenantAuth';
```

**In Express server (server/):**

```typescript
// ✅ CORRECT: Relative paths are fine for server
import { BookingService } from './booking.service';
import type { BookingRepository } from '../lib/ports';

// ✅ ALSO OK: Absolute from workspace
import { logger } from '@macon/shared';
```

### Type-Only Imports

**Always use `import type` for TypeScript types:**

```typescript
// ✅ CORRECT: Separates types from values
import { BookingService } from './booking.service';
import type { Booking, CreateBookingInput } from '../lib/entities';

// Benefits:
// - TypeScript will strip type-only imports at compile time
// - Prevents circular dependencies in some cases
// - Makes it clear what's a type vs runtime value

// ❌ AVOID: Mixing type and value imports
import { BookingService, Booking } from './booking.service';
// ^ Booking is a type, BookingService is a class
```

### ESM vs CommonJS

**MAIS is pure ESM (import/export syntax):**

```typescript
// ✅ CORRECT: ESM syntax
import express from 'express';
import type { Request, Response } from 'express';
export class BookingService {}
export type Booking = {};

// ❌ NEVER: CommonJS require/module.exports
const express = require('express');
module.exports = BookingService;
```

### Monorepo Package Imports

**When importing from other workspaces:**

```typescript
// ✅ CORRECT: Use @macon package name
import { contract } from '@macon/contracts';
import type { Booking } from '@macon/contracts';
import { logger } from '@macon/shared';

// DO NOT import from relative paths:
// ❌ DON'T: import { contract } from '../../../packages/contracts/src';
// ✅ DO:   import { contract } from '@macon/contracts';
//
// The package.json "exports" field handles the mapping
```

### Third-Party Library Imports

**Check package.json "exports" or documentation:**

```typescript
// ✅ CORRECT: Follow the library's recommended import path
import type Stripe from 'stripe';
import { z } from 'zod';
import { prisma } from '@prisma/client';

// ❌ WRONG: Guessing subpaths
import Stripe from 'stripe/index.js';
import { z } from 'zod/lib';

// Each library defines its import paths in package.json
// Always check the official documentation
```

### When in Doubt

1. Check the library's package.json "exports" field
2. Read the official README/docs for import examples
3. Check an existing import in your codebase
4. Let TypeScript's error message guide you

```bash
# Common error messages and meanings:

# TS2307 - Cannot find module 'X'
#   → Module path is wrong or package not installed
#   → Check package.json, npm install

# TS2614 - Module has no export named 'X'
#   → Export doesn't exist, use different name
#   → Check library docs or inspect the module

# TS1259 - Module can only be default imported
#   → Using named import on default-only module
#   → Change to: import X from 'package'

# TS2300 - Duplicate identifier 'X'
#   → Importing same thing twice with different names
#   → Remove duplicate import
```

````

### 2. Import Path Validation Tools

**Use ESLint to catch common import issues:**

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/errors",
    "plugin:import/warnings"
  ],
  "rules": {
    "import/no-unresolved": "error",
    "import/no-relative-packages": "error",
    "import/no-default-export": ["error", {
      "allowSingleDefault": true
    }],
    "import/order": [
      "error",
      {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
        "alphabeticalOrder": true
      }
    ]
  },
  "settings": {
    "import/resolver": {
      "typescript": {
        "alwaysTryTypes": true,
        "project": ["./tsconfig.json", "./server/tsconfig.json", "./apps/web/tsconfig.json"]
      }
    }
  }
}
````

### 3. TypeScript Configuration for Import Resolution

**In `tsconfig.json` (server):**

```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": {
      "@macon/*": ["packages/*/src"]
    }
  }
}
```

**In `apps/web/tsconfig.json` (Next.js):**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@macon/*": ["../../packages/*/src"]
    }
  }
}
```

---

## Code Review Checklist

### When Reviewing Import Statements

```yaml
Import Source Review:
  □ Are all imports using correct syntax?
    └─ Type imports: import type { X } from 'y'
    └─ Value imports: import { X } from 'y'
    └─ Default imports: import X from 'y' (only when appropriate)

  □ Do all module paths exist and are valid?
    └─ Check @macon/contracts exists
    └─ Verify tsconfig paths are correct
    └─ Ensure imports from @/ or relative paths

  □ Are third-party imports using documented paths?
    └─ Check library README for recommended imports
    └─ Verify no hardcoded subpaths
    └─ Follow package.json "exports" field

  □ Are monorepo imports using package names?
    └─ Using @macon/contracts not ../../../packages/contracts
    └─ No importing from src directories
    └─ Using index exports properly

  □ Is import order consistent?
    └─ External imports first
    └─ Internal imports second
    └─ Type imports separated with other types
    └─ Alphabetically ordered within sections

  □ No circular dependencies?
    └─ Check for A imports B, B imports A
    └─ Verify dependency graph is acyclic
    └─ Consider extracting shared module
```

### Pull Request Template Addition

```markdown
## Import Statement Checklist

- [ ] All TypeScript types use `import type` syntax
- [ ] All third-party imports follow official documentation
- [ ] All internal package imports use @macon/ paths (not relative)
- [ ] No circular imports (verify with `npm run lint`)
- [ ] Imports are ordered: external → internal → types
- [ ] No default imports except where appropriate (React components, etc.)
- [ ] All import paths resolve: `npm run typecheck`
- [ ] ESLint passes on imports: `npm run lint`

### If adding new internal package:

- [ ] Package has proper package.json with "exports" field
- [ ] Exports defined in tsconfig.json "paths"
- [ ] Examples added to this checklist for future PRs
```

---

## IDE Configuration to Catch This

### VSCode Extensions

**Install import-related extensions:**

```bash
code --install-extension alexcvzz.vscode-sqlite
code --install-extension wix.vscode-import-cost
code --install-extension simonhe.github-gitignore
```

**Key extension: ESLint**

```bash
code --install-extension dbaeumer.vscode-eslint
```

### VSCode Settings

**Add to `.vscode/settings.json`:**

```json
{
  "[typescript]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit",
      "source.organizeImports": "explicit"
    }
  },
  "import-cost.showInline": true,
  "import-cost.debug": false,
  "eslint.run": "onSave"
}
```

---

## Quick Reference: Import Path Decision Tree

```
Need to import a value from module X?
├─ Is it a class/function/const?
│  └─ Use named import: import { X } from 'module'
└─ NO, continue

Need to import a TypeScript type?
├─ YES → Use type import: import type { X } from 'module'
└─ NO, continue

Is this from an internal package (@macon/)?
├─ YES
│  ├─ Use full package path: import { X } from '@macon/contracts'
│  └─ NO relative paths: NO '../../../packages'
└─ NO, continue

Is this from a third-party library?
├─ YES
│  ├─ Check library documentation for import path
│  └─ Use recommended path from docs
└─ NO, continue

Is this from same workspace (server, apps/web)?
├─ YES
│  ├─ Use relative path: import { X } from '../services/booking'
│  └─ Or absolute with alias: import { X } from '@/components'
└─ Can't determine...

Is it a React component?
├─ YES
│  ├─ Can use default export: export default Component
│  └─ Import it: import Component from './Component'
└─ NO, use named exports

Can the module only be imported one way?
├─ YES
│  └─ Follow that pattern (check library docs)
└─ NO, prefer named exports
```

---

## Real-World Examples from MAIS

### ✅ CORRECT Pattern

**In `server/src/routes/bookings.routes.ts`:**

```typescript
// Type imports grouped at top
import type { BookingRepository } from '../lib/ports';
import type { Booking, CreateBookingInput } from '../lib/entities';

// External library imports
import express from 'express';

// Internal service imports
import { BookingService } from '../services/booking.service';
import { logger } from '../lib/core/logger';

// Monorepo package imports
import { contract } from '@macon/contracts';
import type { CreateBookingResponse } from '@macon/contracts';

export const bookingsRouter = express.Router();

bookingsRouter.post('/', async (req, res) => {
  const bookingService = new BookingService(bookingRepository);
  const booking = await bookingService.create(req.body);
  res.json(booking);
});
```

**In `apps/web/src/pages/booking/BookingForm.tsx`:**

```typescript
'use client';

// Type imports
import type { Booking } from '@macon/contracts';

// External library imports
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// Internal imports using alias
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useApiClient } from '@/hooks/useApiClient';
import { formatDate } from '@/lib/formatting';
import { logger } from '@/lib/logger';

export default function BookingForm() {
  const [formData, setFormData] = useState<CreateBookingInput>({
    eventDate: new Date(),
  });

  return (
    <Card>
      <Button>Submit</Button>
    </Card>
  );
}
```

**In `packages/contracts/src/index.ts`:**

```typescript
// Contract definitions - uses named exports
export { Contracts } from './api.v1';
export type { BookingResponse, CreateBookingInput } from './bookings.contract';
export { bookingSchema, createBookingSchema } from './schemas/booking.schema';
```

### ❌ INCORRECT Pattern (What to Avoid)

```typescript
// ❌ WRONG: Default import from named exports
import contract from '@macon/contracts';
// Should be: import { contract } from '@macon/contracts'

// ❌ WRONG: Relative path in monorepo
import { BookingService } from '../../../packages/contracts/src';
// Should be: import { BookingService } from '@macon/contracts'

// ❌ WRONG: Mixing type and value imports
import { BookingService, Booking } from './booking.service';
// Should be:
// import { BookingService } from './booking.service';
// import type { Booking } from './booking.service';

// ❌ WRONG: CommonJS in ESM codebase
const { BookingService } = require('../services/booking.service');
// Should be: import { BookingService } from '../services/booking.service'

// ❌ WRONG: Module doesn't exist
import { nonExistentFunction } from '@macon/shared';
// Check what's actually exported from @macon/shared

// ❌ WRONG: Hardcoded subpaths
import type Stripe from 'stripe/lib/StripeResource';
// Should be: import type Stripe from 'stripe'
```

---

## Testing Import Resolution

### Unit Test for Import Sources

```typescript
import { describe, it, expect } from 'vitest';

describe('Import Resolution', () => {
  it('should have all internal packages available', () => {
    // This test will fail if imports don't exist
    expect(() => {
      require('@macon/contracts');
      require('@macon/shared');
    }).not.toThrow();
  });

  it('should not allow importing from relative package paths', () => {
    // This is a lint check, but can verify in tests too
    const importPath = '../../../packages/contracts';
    expect(importPath).not.toContain('packages/');
  });
});
```

### Automated Import Validation

```bash
#!/bin/bash
# scripts/validate-imports.sh

echo "Checking for incorrect import patterns..."

# Check for relative imports to packages/
BAD_IMPORTS=$(grep -r "from ['\"].*packages/" server/src apps/web/src --include="*.ts" --include="*.tsx" || true)
if [ ! -z "$BAD_IMPORTS" ]; then
  echo "ERROR: Found relative imports to packages/ directory:"
  echo "$BAD_IMPORTS"
  exit 1
fi

# Check for CommonJS imports in ESM code
COMMONJS=$(grep -r "require(" server/src apps/web/src --include="*.ts" --include="*.tsx" || true)
if [ ! -z "$COMMONJS" ]; then
  echo "ERROR: Found CommonJS requires in ESM code:"
  echo "$COMMONJS"
  exit 1
fi

echo "✓ Import validation passed"
```

---

## Deployment Verification

### Before Deploying to Render/Production

```bash
# 1. Run ESLint (catches import issues)
npm run lint

# 2. Run TypeScript typecheck (catches unresolvable imports)
npm run typecheck

# 3. Build project (will fail if imports are wrong)
npm run build

# 4. Check that no relative package imports exist
grep -r "from ['\"].*packages/" server/src apps/web/src --include="*.ts" --include="*.tsx" || echo "✓ No relative package imports"

# 5. Verify monorepo packages are importable
npm exec -w packages/contracts -- npm run build
npm exec -w packages/shared -- npm run build
```

### CI/CD Check (GitHub Actions)

**Add to `.github/workflows/ci.yml`:**

```yaml
- name: Validate Import Sources
  run: |
    # Check for relative imports to packages/
    grep -r "from ['\"].*packages/" server/src apps/web/src --include="*.ts" --include="*.tsx" && {
      echo "ERROR: Found relative imports to packages/"
      exit 1
    } || true

    # Check for CommonJS imports
    grep -r "require(" server/src apps/web/src --include="*.ts" --include="*.tsx" && {
      echo "ERROR: Found CommonJS imports in ESM code"
      exit 1
    } || true

- name: Lint (catches import errors)
  run: npm run lint

- name: TypeScript Check
  run: npm run typecheck

- name: Build All Workspaces
  run: npm run build
```

---

## Summary

**Key Takeaway:** Import errors are preventable with:

1. **Clear conventions** documented in CLAUDE.md
2. **ESLint rules** to catch bad imports
3. **IDE support** - proper tsconfig and extensions
4. **Pre-commit hook** - validate before pushing
5. **Code review** - check import sources

**Prevention Checklist:**

- [ ] All type imports use `import type` syntax
- [ ] All third-party imports follow official docs
- [ ] All internal packages use @macon/ paths (not relative)
- [ ] No circular dependencies
- [ ] Imports ordered: external → internal → types
- [ ] ESLint passes: `npm run lint`
- [ ] TypeScript typecheck passes: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] Code review verifies import paths
