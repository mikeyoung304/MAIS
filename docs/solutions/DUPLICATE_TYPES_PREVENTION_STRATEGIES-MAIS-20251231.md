---
module: MAIS
date: 2025-12-31
problem_type: prevention_strategy
component: apps/web/src, packages/contracts/src
phase: Frontend Development
symptoms:
  - Developer defines local type instead of importing from contracts
  - Type duplication across components
  - Schema and API contract mismatch
  - Refactoring burden increases with each duplicate
severity: P1
related_files:
  - packages/contracts/src/index.ts
  - packages/contracts/src/landing-page.ts
  - packages/contracts/src/dto.ts
  - apps/web/src/app/signup/page.tsx
tags: [types, contracts, duplication, schema-alignment, code-quality]
---

# Duplicate Types Prevention Strategies

This document captures the root causes of type duplication in the MAIS codebase and provides prevention patterns to eliminate regressions in future development.

## Executive Summary

Type duplication occurs when developers create local type definitions instead of importing from the centralized `@macon/contracts` package. This creates three categories of problems:

**P1 Issues (Product Impact):**

1. API contracts and frontend types diverge (data mismatch bugs)
2. Schema updates require manual synchronization across multiple files
3. Components receive incorrect data shapes at runtime

**P2 Issues (Maintainability):**

1. Single source of truth is lost (why define `SignupTier` twice?)
2. Refactoring requires updating multiple locations
3. Code review burden increases (reviewers must check all imports)

---

## Issue 1: Local Type Definition Instead of Contract Import

### The Problem

When a developer needs a type, they have two choices:

**WRONG:**

```typescript
// apps/web/src/app/signup/page.tsx
type SignupTier = (typeof SIGNUP_TIERS)[number]; // Local type definition
```

**RIGHT:**

```typescript
// apps/web/src/app/signup/page.tsx
import type { SignupTier } from '@macon/contracts'; // Import from central source
```

### Why This Matters

The `@macon/contracts` package is the **single source of truth** for all data shapes:

1. **Schema Alignment** - Contracts are generated from Prisma schema
2. **API Safety** - Backend validates against the same type
3. **Consistency** - All consumers (React, Next.js, mobile) use same types
4. **Refactoring** - Change type in one place, all imports update automatically

### Code Review Finding

**File:** `apps/web/src/app/signup/page.tsx` (before pattern enforcement)

```typescript
// Problem: This type is defined locally instead of imported
const SIGNUP_TIERS = ['TIER_1', 'TIER_2', 'TIER_3'] as const;
type SignupTier = (typeof SIGNUP_TIERS)[number];

// Later in component:
const [selectedTier, setSelectedTier] = useState<SignupTier>('TIER_1');
```

**Issue:** If the contract defines 4 tiers, this component still only knows about 3.

### The Fix

**Step 1: Check if type exists in contracts**

```bash
# Search contracts for type definition
grep -r "SignupTier\|TierConfig\|TierOption" packages/contracts/src/
```

**Step 2: If it exists, import it**

```typescript
// apps/web/src/app/signup/page.tsx
import type { Tenant, TierDisplayNames } from '@macon/contracts';

export default function SignupPage() {
  // Use tenant config to determine available tiers
  const availableTiers = Object.keys(tenant.tierDisplayNames || {});

  return (
    <TierSelect
      tiers={availableTiers}
      value={selectedTier}
      onChange={setSelectedTier}
    />
  );
}
```

**Step 3: If type doesn't exist, add it to contracts**

```typescript
// packages/contracts/src/schemas/tier.schema.ts (new file)
import { z } from 'zod';

export const TierSchema = z.enum(['TIER_1', 'TIER_2', 'TIER_3']);
export type Tier = z.infer<typeof TierSchema>;

// Export from index
// packages/contracts/src/index.ts
export * from './schemas/tier.schema';
```

### Prevention Checklist

**Before committing new component code:**

- [ ] Component uses types from `@macon/contracts` or `Contracts` contract
- [ ] No `type ComponentType = typeof LOCAL_CONSTANT` definitions
- [ ] All data structures match backend response shapes
- [ ] If new type needed, it's been added to contracts package first
- [ ] IDE autocomplete shows types from `@macon/contracts` in imports
- [ ] Run `npm run typecheck` passes (catches import errors)

**During code review:**

- [ ] **Question:** "Why isn't this type imported from contracts?"
- [ ] **Check:** `grep -r "^type " apps/web/src` doesn't reveal duplicates
- [ ] **Verify:** Contract exports match what component is importing
- [ ] **Test:** Change contract type, verify compilation fails if not imported

### Code Pattern to Follow

**GOOD: Type-safe, contract-backed, single source of truth**

```typescript
// packages/contracts/src/dto.ts
export interface SignupRequest {
  email: string;
  password: string;
  selectedTier: 'TIER_1' | 'TIER_2' | 'TIER_3';
}

export type SignupTier = SignupRequest['selectedTier'];

// apps/web/src/app/signup/page.tsx
import type { SignupRequest, SignupTier } from '@macon/contracts';

export default function SignupPage() {
  const [formData, setFormData] = useState<SignupRequest>({
    email: '',
    password: '',
    selectedTier: 'TIER_1',
  });

  // Type is now automatically synchronized with backend
  const handleTierChange = (tier: SignupTier) => {
    setFormData(prev => ({ ...prev, selectedTier: tier }));
  };

  return (
    <TierSelect
      value={formData.selectedTier}
      onChange={handleTierChange}
    />
  );
}
```

**Key advantages:**

- Type change in contracts automatically propagates
- Backend and frontend always synchronized
- IDE shows what fields API expects
- No redundant definitions

### Testing Recommendation

**Unit test: Type synchronization**

```typescript
// apps/web/__tests__/types.test.ts
import type { SignupRequest, SignupTier } from '@macon/contracts';

describe('Type Imports from Contracts', () => {
  it('should reject invalid tier values at compile time', () => {
    // This should have a TypeScript error:
    const _invalid: SignupTier = 'TIER_99'; // Error!
  });

  it('should accept valid tier values', () => {
    // These should pass:
    const tier1: SignupTier = 'TIER_1';
    const tier2: SignupTier = 'TIER_2';
    const tier3: SignupTier = 'TIER_3';

    expect([tier1, tier2, tier3]).toBeDefined();
  });

  it('should enforce SignupRequest shape', () => {
    // Must match contract exactly
    const request: SignupRequest = {
      email: 'test@example.com',
      password: 'secure',
      selectedTier: 'TIER_1',
    };

    expect(request).toBeDefined();
  });
});
```

**Integration test: API data shape matches frontend types**

```typescript
// apps/web/e2e/tests/signup.contract.spec.ts
import type { SignupRequest, SignupTier } from '@macon/contracts';

test('API response matches SignupRequest type', async ({ page }) => {
  // Intercept API response
  const signupResponse = await page.evaluate(async () => {
    const res = await fetch('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'secure',
        selectedTier: 'TIER_1',
      } as SignupRequest),
    });
    return res.json();
  });

  // Response shape should match contract
  expect(signupResponse).toMatchObject({
    success: true,
    data: expect.any(Object),
  });
});
```

---

## Issue 2: Derived Types Without Core Import

### The Problem

Components derive types from constants instead of importing the core type:

```typescript
// BAD: Derives type from constant, not contract
const TIER_OPTIONS = ['TIER_1', 'TIER_2', 'TIER_3'] as const;
type TierOption = (typeof TIER_OPTIONS)[number];

// What if contracts define 4 tiers? This component still has 3.
// What if contracts rename TIER_1 to BASIC? This constant is stale.
```

### The Fix

```typescript
// GOOD: Core type from contract
import type { SignupTier } from '@macon/contracts';

// Constants are derived FROM the type, not the other way around
const TIER_OPTIONS: SignupTier[] = ['TIER_1', 'TIER_2', 'TIER_3'];

// Even better: Get options from API
const getTierOptions = async (): Promise<SignupTier[]> => {
  const tenantConfig = await fetch('/api/tenant-config');
  const data = await tenantConfig.json();
  return Object.keys(data.tierDisplayNames) as SignupTier[];
};
```

### Prevention Checklist

- [ ] Types are imported from `@macon/contracts`, never derived locally
- [ ] Constants are derived FROM types, not vice versa
- [ ] If type is an enum, it exists in contracts as `Zod.enum()` or TypeScript enum
- [ ] TypeScript strict mode catches any violations

---

## Issue 3: Component-Scoped vs Global Types

### The Problem

Some types should be global (contracts), others can be component-scoped. Knowing the difference prevents duplication:

**Global (belongs in contracts):**

- API request/response DTOs
- Tenant configuration shapes
- Domain entities (Package, Booking, Tenant)
- Shared enums (TierStatus, BookingStatus)

**Component-scoped (can be local):**

- UI state machines (loading, error, success)
- Form validation errors
- Component props/children types
- Temporary UI transformations

### The Decision Tree

```
Do I define this type?
│
├─ "Is it a database entity?" → YES → Add to contracts ✓
├─ "Does the API return this shape?" → YES → Add to contracts ✓
├─ "Will other components need this?" → YES → Add to contracts ✓
├─ "Is it just this component's state?" → YES → Keep it local ✓
├─ "Is it a UI transformation?" → YES → Keep it local ✓
└─ "Is it internal form validation?" → YES → Keep it local ✓
```

### Examples

**GOOD: Contract type (global)**

```typescript
// packages/contracts/src/dto.ts
export interface Package {
  id: string;
  tenantId: string;
  name: string;
  basePrice: number;
  description: string;
}

// apps/web/src/app/tenant/packages/page.tsx
import type { Package } from '@macon/contracts';

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
}
```

**GOOD: Component-scoped type (local)**

```typescript
// apps/web/src/components/PackageForm.tsx
'use client';

import type { Package } from '@macon/contracts';

// This is just for form state, doesn't need to be global
interface FormState {
  isDirty: boolean;
  isSaving: boolean;
  validationErrors: Record<string, string>;
}

export function PackageForm({ package: initialPackage }: { package: Package }) {
  const [formState, setFormState] = useState<FormState>({
    isDirty: false,
    isSaving: false,
    validationErrors: {},
  });
  // ...
}
```

### Prevention Checklist

- [ ] Types used in API calls are in contracts
- [ ] Types passed between components are in contracts
- [ ] UI state machines (loading/error) are component-scoped
- [ ] Form validation schemas are colocated with forms
- [ ] Request/response types match backend contracts exactly

---

## Preventing Regressions: Code Review Checklist

### For All Components/Pages

**Imports Section:**

- [ ] No `type X = ...` declarations (except UI state)
- [ ] Data types imported from `@macon/contracts`
- [ ] All imports resolved without TypeScript errors
- [ ] `npm run typecheck` passes

**Component Props:**

- [ ] Props types imported from contracts if they're API-related
- [ ] Props types defined locally if they're component-specific
- [ ] Prop shape matches API response/request contracts

**API Calls:**

- [ ] Request body type matches contract request DTO
- [ ] Response type matches contract response DTO
- [ ] No `any` type assertions on API data
- [ ] Response validated before use

### Review Questions to Ask

1. **"Is this type defined elsewhere in contracts?"**
   - If yes: Ask developer to import it
   - If no: Ask developer to add it to contracts first

2. **"Would another component need this type?"**
   - If yes: It belongs in contracts
   - If no: It can be component-scoped

3. **"Does this type match what the API actually returns?"**
   - If unsure: Check the backend contract
   - If mismatch: This is a data synchronization bug

4. **"Could a contract update break this component?"**
   - If yes: The component isn't properly importing from contracts

### Pre-Commit Checklist for Developers

Before pushing code:

```bash
# 1. Check for local type definitions
grep -n "^type " apps/web/src/**/*.tsx | grep -v "use client"

# 2. Run type checking
npm run typecheck

# 3. Search for any 'as any' assertions
grep -rn "as any\|as unknown as" apps/web/src --include="*.tsx"

# 4. Verify contract imports
grep -n "from '@macon/contracts'" apps/web/src/**/*.tsx | wc -l
# Should be > 0 for any data-driven component
```

---

## Quick Reference: Import Paths

**Always import from:**

```typescript
import type {
  Package,
  Tenant,
  SignupRequest,
  // etc
} from '@macon/contracts';
```

**Never create local versions of:**

- Any entity type (Package, Tenant, User, Booking, etc.)
- Any DTO type (SignupRequest, SignupResponse, etc.)
- Any enum (BookingStatus, TierStatus, etc.)

**Can create local types for:**

- Form state machines (`FormState`, `FormErrors`)
- Component UI state (`LoadingState`, `ErrorState`)
- Component-specific props not used elsewhere

---

## Summary

| Pattern         | Location  | Example                                                |
| --------------- | --------- | ------------------------------------------------------ |
| Entity types    | Contracts | `Package`, `Tenant`, `Booking`                         |
| API DTOs        | Contracts | `SignupRequest`, `SignupResponse`                      |
| Enums/Constants | Contracts | `TierStatus`, `BookingStatus`                          |
| Form state      | Component | `FormState`, `ValidationErrors`                        |
| UI state        | Component | `LoadingState`, `UIFlags`                              |
| Props types     | Mixed     | Global if used by multiple components, local otherwise |

**Golden Rule:** If the backend knows about it, it's in contracts. If the backend doesn't care, it can be local.
