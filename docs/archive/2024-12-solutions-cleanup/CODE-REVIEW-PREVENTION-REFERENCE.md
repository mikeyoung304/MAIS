---
title: Code Review Prevention - Reference Guide
category: prevention
tags: [code-review, reference, prevention, quick-lookup]
priority: P2
date: 2025-12-24
---

# Code Review Prevention - Reference Guide

Quick lookup guide for all code review prevention strategies.

---

## Naming Conventions (P348)

### Rule 1: Parameter Names Must Match API Contract

```typescript
// ✅ CORRECT
// API: GET /packages/:slug
const { packageSlug } = useParams<{ packageSlug: string }>();
await api.getPackageBySlug({ params: { slug: packageSlug } });

// ❌ WRONG
const { packageId } = useParams<{ packageId: string }>(); // API expects 'slug'
```

### Rule 2: Use Context-Specific Names

```typescript
// ✅ CORRECT
const databaseId = pkg.id; // Integer primary key from database
const urlSlug = pkg.slug; // User-friendly URL string
const bookingToken = pkg.tokenId; // Special token identifier

// ❌ WRONG
const packageId = pkg.id; // Which kind of ID? Ambiguous
const identifier = pkg.slug; // Slug is NOT an identifier
```

### Rule 3: Function Signatures Make Intent Clear

```typescript
// ✅ CORRECT
async function getPackageBySlug(slug: string): Promise<PackageDto> {}
async function getPackageById(id: number): Promise<PackageDto> {}

// ❌ WRONG
async function getPackage(identifier: any): Promise<PackageDto> {} // What is identifier?
```

### Review Checklist

- [ ] Route param name matches API contract definition
- [ ] No use of `packageId` for URL parameters (use `packageSlug`)
- [ ] Variable names are context-specific (not just `id`)
- [ ] Function parameters have clear names
- [ ] If calling API, verify parameter name in contract

---

## Error Message Security (P349)

### Rule 1: Generic Message to Client, Details in Logs

```typescript
// ✅ CORRECT - Two-tier error pattern
try {
  const pkg = await catalogService.getPackage(id);
  if (!pkg) {
    // Log details (never shown to client)
    logger.warn('Package not found', {
      packageId: id,
      tenantId: req.tenantId,
      timestamp: new Date(),
    });

    // Generic message (safe for client)
    throw new PackageNotAvailableError();
  }
} catch (error) {
  if (error instanceof PackageNotAvailableError) {
    return {
      status: 404,
      body: { error: 'The requested package is not available for booking' }
    };
  }
}

// ❌ WRONG - Leaks information
catch (error) {
  return {
    status: 404,
    body: { error: `Package ${packageId} not found` }  // Reveals ID
  };
}
```

### Rule 2: Never Include in Error Message

```typescript
❌ Database IDs:
   throw new Error(`Package ${packageId} not found`);

❌ Tenant information:
   throw new Error(`Tenant ${tenantId} is not active`);

❌ Database column names:
   throw new Error(`Unique constraint failed on column 'slug'`);

❌ SQL queries:
   throw new Error(`SELECT failed: invalid column 'x'`);

✅ Generic messages instead:
   throw new PackageNotAvailableError();
   throw new TenantNotActiveError();
   throw new BookingConflictError(date);
```

### Rule 3: Error Classes Follow Pattern

```typescript
// ✅ CORRECT - Inherits from AppError, generic message
export class PackageNotAvailableError extends PackageError {
  constructor() {
    super('The requested package is not available for booking', 'PACKAGE_NOT_AVAILABLE');
    this.name = 'PackageNotAvailableError';
  }
}

// ❌ WRONG - Includes details
export class PackageNotFoundError extends Error {
  constructor(packageId: string) {
    super(`Package ${packageId} not found`); // Reveals ID
  }
}
```

### Safe vs Unsafe Information

```typescript
SAFE (show to client):
- "The requested package is not available"
- "You don't have permission to perform this action"
- "Invalid email format"
- "Your password is too short"

UNSAFE (log only, never send to client):
- "Package ID abc123 not found in database"
- "Tenant ID xyz not active"
- "Unique constraint violation on column 'slug'"
- "SELECT * FROM packages WHERE id = $1 failed"
```

### Review Checklist

- [ ] Error message is generic (no IDs, columns, tenant info)
- [ ] Sensitive details logged separately with `logger.warn/error`
- [ ] HTTP status code is correct (404, 403, 422, 500)
- [ ] Error code is business-level (not database error)
- [ ] Error class inherits from AppError

---

## React Performance (P350)

### Rule 1: Constants at Module Level

```typescript
// ✅ CORRECT - Defined once, reused always
const TIER_LEVELS = ['tier_1', 'tier_2', 'tier_3'] as const;
const TIER_DISPLAY_NAMES: Record<TierLevel, string> = {
  tier_1: 'Essential',
  tier_2: 'Popular',
  tier_3: 'Premium',
};

export function TierSelector() {
  return TIER_LEVELS.map(level => <span>{level}</span>);
}

// ❌ WRONG - New array every render
export function TierSelector() {
  const levels = ['tier_1', 'tier_2', 'tier_3'];  // ❌ New array every render
  return levels.map(level => <span>{level}</span>);
}
```

### Rule 2: Memoize Computed Objects/Arrays

```typescript
// ✅ CORRECT - Object memoized
export function TierDetail({ allPackages }) {
  const tiers = useMemo(() => extractTiers(allPackages), [allPackages]);
  const navigation = useMemo(() => ({
    prev: tiers['tier_1'],
    next: tiers['tier_2'],
  }), [tiers]);

  return <Child nav={navigation} />;  // Stable object reference
}

// ❌ WRONG - New object every render
export function TierDetail({ allPackages }) {
  const tiers = extractTiers(allPackages);  // New object every render
  const navigation = {  // New object every render
    prev: tiers['tier_1'],
    next: tiers['tier_2'],
  };

  return <Child nav={navigation} />;  // Child re-renders every time
}
```

### Rule 3: Memo Only When Beneficial

```typescript
// ✅ CORRECT - Memo on component receiving object props
export const TierCard = memo(function TierCard({ tier }) {
  return <Base {...tier} />;
});

// ✅ CORRECT - Memo on component used in list
export const Item = memo(function Item({ item }) {
  return <div>{item.name}</div>;
});

// ❌ WRONG - Memo on component with only primitive props (no benefit)
export const Badge = memo(function Badge({ level }: { level: string }) {
  return <span>{level}</span>;  // Primitives don't need memo
});

// ❌ WRONG - Parent doesn't stabilize props
export const TierCard = memo(function TierCard({ tier }) { ... });
export function Parent() {
  return <TierCard tier={{ title: 'New' }} />;  // ❌ New object every render!
}
```

### Rule 4: useCallback Only with Memo'ed Children

```typescript
// ✅ CORRECT - useCallback beneficial with memo'ed child
const Button = memo(function Button({ onClick }) {
  return <button onClick={onClick}>Click</button>;
});

export function Parent() {
  const handleClick = useCallback(() => doSomething(), []);
  return <Button onClick={handleClick} />;  // Memo'ed child, stable callback
}

// ❌ WRONG - useCallback without memo'ed child (no benefit)
export function Parent() {
  const handleClick = useCallback(() => doSomething(), []);
  return <button onClick={handleClick}>Click</button>;  // Not memoized
}
```

### Decision Tree

```
Is it a constant that never changes?
├─ YES → Define at module level
└─ NO → Is it an object/array created in render?
   ├─ YES → Does it get passed to a memo'ed child?
   │  ├─ YES → Wrap with useMemo
   │  └─ NO → Don't memo
   └─ NO → Is it a primitive? Don't memo
```

### Review Checklist

- [ ] Constants moved outside component (TIER_LEVELS, COLOR_MAP)
- [ ] Objects/arrays passed to memo'ed children use `useMemo`
- [ ] `useMemo` dependency arrays are correct and complete
- [ ] All wrapper components wrapped with `React.memo` (if receiving objects)
- [ ] No unnecessary `useCallback` (only for memo'ed children)
- [ ] No premature memo on components with only primitive props

---

## Code Cleanup (P3)

### Rule 1: No Unused Imports

```typescript
// ✅ CORRECT - Only import what you use
import { useQuery } from '@tanstack/react-query';
import { Container } from '@/ui/Container';

// ❌ WRONG - Unused imports
import { useQuery, useMutation } from '@tanstack/react-query'; // useMutation not used
import { Container, Grid } from '@/ui/Container'; // Grid not used
```

### Rule 2: No Dead Code

```typescript
// ✅ CORRECT - No unused variables
function Component() {
  const result = expensive();  // Used below
  return <div>{result}</div>;
}

// ❌ WRONG - Unused variable
function Component() {
  const result = expensive();  // Never used
  return <div>Nothing</div>;
}
```

### Rule 3: No Hardcoded Magic Values

```typescript
// ✅ CORRECT - Constants defined
const MAX_DESCRIPTION_LENGTH = 150;
const TIER_NAMES = { tier_1: 'Essential' };

function Card({ description }) {
  return <p>{truncate(description, MAX_DESCRIPTION_LENGTH)}</p>;
}

// ❌ WRONG - Magic values scattered
function Card({ description }) {
  return <p>{description.slice(0, 150)}...</p>;  // Magic number!
}

function Other() {
  return <p>{description.slice(0, 150)}...</p>;  // Duplicated!
}
```

### Review Checklist

- [ ] No unused imports (ESLint will flag)
- [ ] No dead code or unused variables
- [ ] No hardcoded magic numbers/strings (use constants)
- [ ] Comments explain "why", not "what"

---

## Approval Checklist

**Approve when ALL are true:**

- [ ] ✅ Naming conventions correct
  - Route params = API contract names
  - Variables context-specific

- [ ] ✅ Error messages safe
  - No database IDs in messages
  - No column/schema names
  - Generic to client, detailed logging

- [ ] ✅ React performance correct
  - Constants at module level
  - Objects wrapped with useMemo
  - Memo used appropriately

- [ ] ✅ Code quality
  - No unused imports
  - No dead code
  - No hardcoded values
  - TypeScript strict: no any

- [ ] ✅ Tests pass
  - `npm test` passes
  - `npm run typecheck` passes

---

## Red Flags

Stop and investigate if you see any of these:

| Flag                             | Why                        | Action           |
| -------------------------------- | -------------------------- | ---------------- |
| `packageId` in route params      | Doesn't match API contract | Ask about intent |
| Error includes `${packageId}`    | Security vulnerability     | Request fix      |
| Error reveals schema/columns     | Security vulnerability     | Request fix      |
| Object created in render         | Breaks memo optimization   | Add useMemo      |
| `memo` without object props      | Premature optimization     | Remove memo      |
| Magic number in 2+ places        | Maintenance issue          | Move to constant |
| Unused import                    | Code quality               | Remove           |
| `useCallback` without memo child | Wasted optimization        | Remove           |

---

## Terminal Commands

```bash
# Find potential issues
grep -rn "packageId.*slug\|slug.*packageId" server/src client/src
grep -rn "Package \${packageId}\|Tenant \${tenantId}" server/src
grep -rn "const.*=.*{.*}" client/src/features/ | grep -v useMemo | head -10

# Auto-fix linting issues
npm run lint -- --fix

# Run tests and type check
npm test
npm run typecheck

# Check for component sizes
wc -l client/src/features/**/*.tsx | sort -rn | head -10

# Find potential memo issues
grep "^export function" client/src/features/storefront/*.tsx | grep -v memo
```

---

## Quick Decision Matrix

### When Should I Use X?

| Question                          | Answer                 | Usage                            |
| --------------------------------- | ---------------------- | -------------------------------- |
| Constant that never changes?      | YES                    | Module level constant            |
| Object created in render?         | YES                    | Check if passes to memo'ed child |
| → Passes to memo'ed child?        | YES                    | Wrap with useMemo                |
| → Doesn't pass to memo child?     | NO                     | Don't wrap                       |
| Function passed to memo'ed child? | YES                    | Wrap with useCallback            |
| Component gets memo'ed?           | Gets object props      | YES, add memo                    |
|                                   | Gets only primitives   | NO, no benefit                   |
|                                   | Used in list           | YES, add memo                    |
| Is this error message safe?       | No sensitive info      | YES, okay to send                |
|                                   | Has IDs/columns/schema | NO, log only                     |

---

## References in Codebase

### Error Handling Example

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/business.ts`

- Generic error messages (line 176)
- No IDs in messages (line 68)
- Proper error hierarchy (class extends AppError)

### API Contracts Example

**File:** `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/api.v1.ts`

- Parameter names in contracts
- Clear endpoint definitions

### React Pattern Example

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/TierDetail.tsx`

- Correct useMemo usage (line 55)
- Constants from utils (line 24)
- Memoized navigation (line 58)

### Safe Error Example

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/pages/DateBookingPage.tsx`

- Safe error messages (line 61)
- Correct parameter naming (line 19)
- Proper error handling (line 51)

---

## Prevention Documents

| Document                                       | Size      | Purpose               | Read Time |
| ---------------------------------------------- | --------- | --------------------- | --------- |
| CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md      | 6.7 KB    | Use during review     | 2 min     |
| CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md  | 20 KB     | Detailed explanations | 15 min    |
| IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md | 16 KB     | Working code examples | 10 min    |
| CODE-REVIEW-PREVENTION-INDEX.md                | 10 KB     | Navigation & links    | 5 min     |
| CODE-REVIEW-PREVENTION-REFERENCE.md            | This file | Quick lookup          | 3 min     |

---

## Next Steps

1. **Print the Quick Checklist** - Keep at your desk
2. **Read this Reference** - Bookmark for quick lookup
3. **Use during code reviews** - Reference specific sections
4. **Share with team** - Make sure everyone knows about these patterns

---

**Last Updated:** 2025-12-24

For detailed explanations, see CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md
For working examples, see IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md
For navigation, see CODE-REVIEW-PREVENTION-INDEX.md
