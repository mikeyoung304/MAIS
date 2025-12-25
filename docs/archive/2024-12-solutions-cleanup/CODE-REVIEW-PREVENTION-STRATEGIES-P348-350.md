---
title: Prevention Strategies - Code Review Findings (P348-350)
category: prevention
tags: [code-review, naming-conventions, security, react-performance, checklist]
priority: P2
date: 2025-12-24
---

# Prevention Strategies - Code Review Findings (P348-350)

This document provides actionable prevention strategies based on code review findings:

- **P1-348**: packageId vs slug naming confusion
- **P2-349**: Security info disclosure in error messages
- **P2-350**: Object recreation on every render
- **P3-352-356**: Various cleanup (unused imports, premature memo, redundant vars)

---

## 1. Naming Convention Prevention (P348: packageId vs slug)

### Problem Statement

The codebase has confusion between `packageId` (database identifier) and `slug` (user-friendly URL parameter):

```typescript
// ❌ CONFUSING - Are these the same thing?
const { packageId } = useParams();  // Actually expects 'slug'
const pkg = await api.getPackageBySlug({ params: { id: packageId } });

// ❌ INCONSISTENT - Different names, same data
getPackageBySlug(tenantId, packageId)  // Backend expects slug
getPackageById(tenantId, slug)         // Frontend passes slug
```

### Root Cause

- No consistent naming pattern for "identifier vs URL-friendly name"
- Mixed usage: `id`, `packageId`, `slug` used interchangeably
- API contracts and implementation use different names

### Prevention Strategy 1.1: Naming Convention Rules

**RULE 1: Use context-specific names**

```typescript
// ✅ CORRECT
interface RouteParams {
  packageSlug: string;  // URL parameter - always 'slug'
}

interface PackageQuery {
  slug: string;  // Lookup by slug
  id: string;    // Never use packageId in queries
}

// ❌ WRONG
interface RouteParams {
  packageId: string;  // This is actually a slug!
}
```

**RULE 2: Prefix identifiers with context**

```typescript
// ✅ CLEAR intent
const databaseId = pkg.id;           // Integer primary key
const urlSlug = pkg.slug;            // User-friendly URL
const bookingToken = pkg.tokenId;    // Special token identifier

// ❌ AMBIGUOUS
const packageId = pkg.id;            // Which kind of ID?
const identifier = pkg.slug;         // Slug is NOT an identifier
```

**RULE 3: Route params must match what API expects**

```typescript
// ✅ CORRECT - Parameter name matches API contract
// Contract: GET /v1/packages/{slug}
const { slug } = useParams<{ slug: string }>();
const pkg = await api.getPackageBySlug({ params: { slug } });

// ❌ WRONG - Parameter name doesn't match contract
// Contract expects 'slug', but we're passing 'id'
const { id } = useParams<{ id: string }>();
const pkg = await api.getPackageBySlug({ params: { id } });  // Runtime error!
```

### Prevention Strategy 1.2: Code Review Checklist

**When reviewing any route parameter handling:**

- [ ] Route param name matches API contract
- [ ] No use of `packageId` for URL slug (use `packageSlug`)
- [ ] Function signature makes intent clear
- [ ] If passing to API, verify parameter name matches contract

```typescript
// REVIEW CHECKLIST EXAMPLE
// File: DateBookingPage.tsx
- Line 19: const { packageSlug } = useParams()  ✅ Matches route definition
- Line 30: api.getPackageBySlug({ params: { slug: packageSlug } })  ✅ Correct param
- Line 86: const bookingLink = `../book/date/${pkg.slug}`  ✅ Uses pkg.slug, not id
```

### Prevention Strategy 1.3: Refactoring Guide

**Search and replace patterns to fix existing code:**

```bash
# Find confusing usage
grep -rn "packageId.*slug\|slug.*packageId" server/src client/src

# Find route params that might be confused
grep -rn "useParams.*Id.*slug\|useParams.*Slug.*Id" client/src

# Find API calls with wrong param names
grep -rn "getPackageBySlug.*packageId\|getPackageById.*slug" client/src
```

**Before and After:**

```typescript
// BEFORE - Confusing
function getTierBookingLink(pkgId: string) {
  return `../book/date/${pkgId}`;  // Is this a slug?
}

// AFTER - Clear
function getTierBookingLink(packageSlug: string) {
  return `../book/date/${packageSlug}`;  // Obviously a slug
}
```

---

## 2. Error Message Security Prevention (P349: Info Disclosure)

### Problem Statement

Error messages leak sensitive information that helps attackers enumerate resources:

```typescript
// ❌ DANGEROUS - Leaks whether package exists
throw new Error(`Package ${packageId} not found`);  // Confirms ID format, helps enumeration

// ❌ DANGEROUS - Reveals internal database column names
throw new Error(`Database column 'slug' cannot be null`);

// ❌ DANGEROUS - Leaks tenant isolation info
throw new Error(`Package ${packageId} does not belong to tenant ${tenantId}`);
```

### Root Cause

- Error messages show internal details (database columns, ID values, tenant structure)
- Developers copy error format without thinking about security
- No consistent pattern for safe vs unsafe errors

### Prevention Strategy 2.1: Error Message Security Pattern

**RULE 1: Generic public messages vs internal logs**

```typescript
// ✅ CORRECT - Two-tier error pattern
try {
  const pkg = await catalogRepo.getPackage(tenantId, packageId);
  if (!pkg) {
    // Internal log (never sent to client)
    logger.warn(`Package not found`, {
      packageId,
      tenantId,
      source: 'catalog.service',
    });
    // Public message (safe for client)
    throw new PackageNotAvailableError();  // Generic, no details
  }
} catch (error) {
  if (error instanceof PackageNotAvailableError) {
    return { status: 404, body: { error: 'The requested package is not available' } };
  }
  // Unexpected errors get generic message
  logger.error('Unexpected error', { originalError: error });
  return { status: 500, body: { error: 'Something went wrong' } };
}
```

**RULE 2: Never include in error message:**

```typescript
// ❌ DON'T DO THESE
throw new Error(`Package ${packageId} not found`);           // ← Shows ID value
throw new Error(`Tenant ${tenantId} is not active`);        // ← Shows tenant structure
throw new Error(`Database unique constraint failed on slug`);  // ← Shows schema
throw new Error(`SELECT failed: invalid column 'x'`);        // ← Shows SQL structure

// ✅ DO THIS INSTEAD
throw new PackageNotAvailableError();  // Generic
throw new TenantNotActiveError();      // Business error, no details
logger.error('Schema validation failed', { column: 'slug', reason });  // Log details
```

**RULE 3: Safe vs unsafe information**

```typescript
// SAFE - Can show to client
- "The requested package is not available"
- "You don't have permission to perform this action"
- "Your password must be at least 8 characters"
- "Invalid email format"

// UNSAFE - Log only, never send to client
- "Package ID: abc123 not found in database"
- "Tenant ID xyz not active"
- "Unique constraint violation on column 'slug'"
- "SELECT * FROM packages WHERE id = $1 failed"
```

### Prevention Strategy 2.2: Code Review Checklist for Errors

**When reviewing error handling:**

- [ ] Error message is generic (doesn't leak IDs, columns, tenant info)
- [ ] Sensitive details logged separately (logger.warn/error)
- [ ] Error status code is appropriate (404, 403, 422, 500)
- [ ] Error code is business-level (not database error)

```typescript
// REVIEW EXAMPLE - DateBookingPage error handling
try {
  const pkg = await api.getPackageBySlug({ params: { slug: packageSlug } });
  if (!pkg) {
    // ✅ PASS: Generic message, safe for client
    return <div>The package you're looking for doesn't exist or has been removed.</div>;
  }
} catch (error) {
  // ✅ PASS: Generic error UI, no details shown
  return <div>Package not found. <Link>Back to Packages</Link></div>;
}
```

### Prevention Strategy 2.3: Error Class Pattern (P1-172 Reference)

See `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/business.ts` for the implemented pattern:

```typescript
/**
 * PackageNotAvailableError
 *
 * P2-344 FIX: Generic message to prevent package ID enumeration
 * - Never includes packageId in message
 * - Safe to return to client
 * - Sensitive details logged separately
 */
export class PackageNotAvailableError extends PackageError {
  constructor() {
    super(
      'The requested package is not available for booking',  // Generic
      'PACKAGE_NOT_AVAILABLE'
    );
    this.name = 'PackageNotAvailableError';
  }
}
```

**Use this pattern for all business errors:**

```typescript
// DO THIS
export class BookingConflictError extends AppError {
  constructor(date: string, message?: string) {
    super(
      message ?? `Date is already booked`,  // Generic, no details
      'BOOKING_CONFLICT',
      409,
      true
    );
  }
}

// NOT THIS
export class BookingConflictError extends AppError {
  constructor(date: string, tenantId: string) {
    super(
      `Date ${date} is already booked for tenant ${tenantId}`,  // ❌ Leaks info
      'BOOKING_CONFLICT'
    );
  }
}
```

---

## 3. React Performance Prevention (P350: Object Recreation)

### Problem Statement

Objects and arrays created on every render cause unnecessary re-renders of memoized children:

```typescript
// ❌ PROBLEM - New object every render
export function TierDetail({ allPackages }) {
  const navigation = useMemo(() => {
    const tiers = extractTiers(allPackages);  // New object
    return { prev: tiers[0], next: tiers[1] };  // New object every render!
  }, [allPackages]);

  // Child component receives new object, re-renders even if content unchanged
  return <ChildComponent nav={navigation} />;
}
```

### Root Cause

- `useMemo` doesn't preserve object identity between renders
- Objects/arrays created inside render without `useMemo`
- Constants defined inside components instead of module level

### Prevention Strategy 3.1: When to Use Memoization

**Decision Tree:**

```typescript
// QUESTION 1: Is this a constant that never changes?
const TIER_LEVELS = ['tier_1', 'tier_2', 'tier_3'];  // → Move outside component
const COLOR_MAP = { tier_1: 'blue', tier_2: 'orange' };  // → Move outside component

// QUESTION 2: Is this an object/array created in render?
const config = { size: 'large' };  // → Needs useMemo if passed to child
const items = data.filter(x => x.active);  // → Needs useMemo if passed to child

// QUESTION 3: Is the child component memoized?
export const Card = memo(function Card({ config }) { ... });  // → Parent needs useMemo
export function Card({ config }) { ... };  // → Parent doesn't need useMemo

// QUESTION 4: Does dependency array make sense?
const value = useMemo(() => expensive(), [dep1, dep2]);  // → Only if deps actually change
const value = useMemo(() => stable, []);  // → Safe, never changes
const value = useMemo(() => data.map(...), [data]);  // → OK, rememo on data change
```

### Prevention Strategy 3.2: Code Patterns

**Pattern 1: Module-level constants**

```typescript
// ✅ CORRECT - Defined once, reused always
const TIER_LEVELS: TierLevel[] = ['tier_1', 'tier_2', 'tier_3'];
const TIER_DISPLAY_NAMES: Record<TierLevel, string> = {
  tier_1: 'Essential',
  tier_2: 'Popular',
  tier_3: 'Premium',
};

export function TierSelector() {
  return (
    <div>
      {TIER_LEVELS.map(level => (
        <div key={level}>{TIER_DISPLAY_NAMES[level]}</div>
      ))}
    </div>
  );
}

// ❌ WRONG - New array every render
export function TierSelector() {
  const levels = ['tier_1', 'tier_2', 'tier_3'];  // New array!
  return <div>{levels.map(...)}</div>;
}
```

**Pattern 2: Memoize computed values**

```typescript
// ✅ CORRECT
export function TierDetail({ allPackages }) {
  // Only recompute when allPackages changes
  const tiers = useMemo(() => extractTiers(allPackages), [allPackages]);

  // Only recompute when tiers changes
  const navigation = useMemo(() => {
    const currentIndex = TIER_LEVELS.indexOf(tierLevel);
    return {
      prev: tiers[TIER_LEVELS[currentIndex - 1]],
      next: tiers[TIER_LEVELS[currentIndex + 1]],
    };
  }, [tiers, tierLevel]);

  return <ChildComponent nav={navigation} />;  // Child receives stable object
}

// ❌ WRONG - navigation recreated every render
export function TierDetail({ allPackages }) {
  const tiers = extractTiers(allPackages);  // New object every render
  const navigation = {  // New object every render
    prev: tiers[TIER_LEVELS[0]],
    next: tiers[TIER_LEVELS[1]],
  };
  return <ChildComponent nav={navigation} />;  // Child re-renders unnecessarily
}
```

**Pattern 3: Memo requirements**

```typescript
// ✅ ALWAYS wrap with memo if receiving object props
export const TierCard = memo(function TierCard({ tier }) {
  // tier is stable reference from parent
  return <div>{tier.title}</div>;
});

// ✅ ALWAYS wrap with memo if used in list
export const SegmentCard = memo(function SegmentCard({ segment }) {
  return <Card {...segment} />;
});

// ❌ DON'T wrap if only receiving primitives
export function TierBadge({ level }: { level: string }) {
  // level is primitive string, memo provides no benefit
  return <span>{level}</span>;
}

// ❌ DON'T wrap if parent doesn't stabilize props
export const TierCard = memo(function TierCard({ tier }) {
  return <div>{tier.title}</div>;
});

// Parent still creates new tier object
export function Parent() {
  return <TierCard tier={{ title: 'New' }} />;  // New object every render!
}
```

### Prevention Strategy 3.3: Code Review Checklist

**When reviewing React components:**

- [ ] Constants moved outside component (TIER_LEVELS, COLOR_MAP)
- [ ] Objects/arrays passed to memo'ed children use `useMemo`
- [ ] `useMemo` dependency array is correct
- [ ] All wrapper components wrapped with `React.memo`
- [ ] No `useCallback` without reason (only if passed as prop to memo'ed child)

```typescript
// CHECKLIST EXAMPLE - TierDetail.tsx
const TIER_LEVELS = ...  // ✅ Outside component
const TIER_DISPLAY_NAMES = ...  // ✅ Outside component

export function TierDetail({ allPackages }) {
  const tiers = useMemo(() => extractTiers(allPackages), [allPackages]);  // ✅ Stable
  const navigation = useMemo(() => ({ prev, next }), [tierLevel, tiers]);  // ✅ Deps correct
  const getDisplayName = (level: TierLevel) => ...;  // ✅ Function, not memo needed

  return <ChildComponent nav={navigation} />;  // ✅ Child receives stable object
}
```

### Prevention Strategy 3.4: Common Pitfalls

**Pitfall 1: Unnecessary useCallback**

```typescript
// ❌ WRONG - useCallback not needed
export function Card({ onClick }) {
  const handleClick = useCallback(() => {
    onClickData();
  }, []);  // No benefit, parent will still recreate

  return <button onClick={handleClick}>Click</button>;
}

// ✅ CORRECT - useCallback only if child is memo'ed AND receives this callback
export const Button = memo(function Button({ onClick }) {
  return <button onClick={onClick}>Click</button>;
});

export function Card() {
  const handleClick = useCallback(() => {
    doSomething();
  }, []);  // Benefit: Button doesn't re-render

  return <Button onClick={handleClick} />;
}
```

**Pitfall 2: Too many useMemo**

```typescript
// ❌ WRONG - Over-memoization
export function Card({ title, description }) {
  const memoTitle = useMemo(() => title, [title]);  // Unnecessary!
  const memoDesc = useMemo(() => description, [description]);  // Unnecessary!

  return <div>{memoTitle} {memoDesc}</div>;
}

// ✅ CORRECT - Only memoize expensive or object-typed values
export function Card({ title, description }) {
  return <div>{title} {description}</div>;  // Primitives don't need memo
}

export function Card({ config }) {
  const memoConfig = useMemo(() => config, [config]);  // ✅ Objects need memo
  return <Child config={memoConfig} />;
}
```

**Pitfall 3: Broken dependency arrays**

```typescript
// ❌ WRONG - Missing dependency
export function Component({ data }) {
  const filtered = useMemo(
    () => data.filter(x => x.active),
    []  // ❌ Missing 'data' - stale closure!
  );
  return <div>{filtered}</div>;
}

// ✅ CORRECT - All dependencies included
export function Component({ data }) {
  const filtered = useMemo(
    () => data.filter(x => x.active),
    [data]  // ✅ Includes 'data'
  );
  return <div>{filtered}</div>;
}
```

---

## 4. Code Review Checklist (Combined)

Use this when reviewing code that touches naming, errors, or React performance:

### Pre-Review Checklist

- [ ] Check git diff for naming changes (`packageId` vs `slug`)
- [ ] Check error messages for sensitive info (IDs, columns, tenant info)
- [ ] Check for objects created in render without `useMemo`
- [ ] Check for `memo` components without object prop stabilization
- [ ] Run `npm run typecheck` to catch type errors early

### Naming Review

- [ ] All route params match API contract names
- [ ] No confusion between `id` (database) and `slug` (URL)
- [ ] Function signatures make intent clear (param names specific)
- [ ] If touching package lookup, verify: `getPackageBySlug(slug)` not `getPackageById(slug)`

### Error Message Review

- [ ] Error messages are generic (no IDs, columns, tenant info)
- [ ] Sensitive details logged separately with context
- [ ] Error HTTP status code is correct (404, 403, 422, 500)
- [ ] Error code is business-level, not database-level
- [ ] Error class inherits from AppError, not custom classes

### React Performance Review

- [ ] Constants moved outside component (no module scope violations)
- [ ] All memo'ed children receive stable props via `useMemo`
- [ ] useMemo dependency arrays are correct
- [ ] No unnecessary useCallback (only if child is memo'ed)
- [ ] No premature optimization (memo on wrapper with no object props)

### Final Checks

- [ ] No unused imports
- [ ] No dead code
- [ ] No hardcoded magic values (use constants)
- [ ] TypeScript strict: no unchecked `any` types
- [ ] Comments explain "why", not "what"

---

## 5. Quick Reference

### Red Flags - Stop and Investigate

| Finding | Action | Example |
|---------|--------|---------|
| `packageId` used as route param | Ask: Is this actually a slug? | `useParams<{ packageId }>` |
| Error includes database ID in message | Request changes | `"Package ${packageId} not found"` |
| Error reveals schema/tenant structure | Request changes | `"Unique constraint failed on slug"` |
| Object created in render without memo | Add useMemo or move to module | `const config = { size: 'large' }` |
| Memo wrapper receives object prop from parent | Ask parent to stabilize with useMemo | `<Card config={{ size }}/>` |
| Component has 15+ props | Too many responsibilities | Break into smaller components |
| Constants duplicated in 2+ files | Move to utils.ts | `TIER_LEVELS` definition |
| `useCallback` without memo'ed child | Remove useCallback | Optimization not needed |

### Terminal Commands

```bash
# Find naming confusion
grep -rn "packageId.*slug\|slug.*packageId" server/src client/src

# Find unsafe error messages
grep -rn "Package ${packageId}\|Tenant ${tenantId}\|unique constraint" server/src

# Find objects created in render
grep -rn "const.*=.*{.*}\|const.*=.*\[" client/src/features/ | grep -v useMemo

# Find components missing memo
grep "^export function" client/src/features/storefront/*.tsx | grep -v memo

# Find unused imports
npm run lint -- --fix  # ESLint will remove them
```

---

## 6. References

- **Error Handling Pattern:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/business.ts`
- **React Component Review:** REACT-COMPONENT-REVIEW-QUICK-REF.md
- **TypeScript Type Safety:** CODE-REVIEW-ANY-TYPE-CHECKLIST.md
- **Architecture Patterns:** /Users/mikeyoung/CODING/MAIS/CLAUDE.md (Naming Conventions section)

---

## 7. Related Code Review Findings

- **P1-348:** packageId vs slug naming confusion
- **P2-349:** Security info disclosure in error messages
- **P2-350:** Object recreation on every render (React)
- **P3-352-356:** Cleanup items (unused imports, premature memo, redundant vars)

All findings should be resolved using patterns in this document. Future code reviews should reference these prevention strategies to avoid recurrence.
