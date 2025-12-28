---
title: Code Review Prevention - Quick Checklist
category: prevention
tags: [code-review, quick-reference, checklist, naming, security, react]
priority: P2
date: 2025-12-24
---

# Code Review Prevention - Quick Checklist

**Print this and pin it at your desk!** Quick 2-minute checklist for reviewing code changes.

---

## Pre-Review (30 seconds)

- [ ] Run `npm run typecheck` on the branch
- [ ] Check git diff size (if >500 lines, request smaller PR)
- [ ] Verify tests pass: `npm test`

---

## Naming & Routes (1 minute)

When you see `useParams`, `getBy...`, or API calls:

```bash
# Ask these questions:
```

**Question 1: Does the parameter name match the API contract?**

```typescript
// CORRECT ✅
useParams<{ packageSlug: string }>(); // Matches API parameter name
api.getPackageBySlug({ params: { slug } });

// WRONG ❌
useParams<{ packageId: string }>(); // API expects 'slug'
api.getPackageBySlug({ params: { packageId } }); // Type mismatch!
```

**Question 2: Is the intent clear from the variable name?**

```typescript
// CLEAR ✅
const databaseId = pkg.id; // Integer primary key
const urlSlug = pkg.slug; // User-friendly URL
const bookingToken = pkg.tokenId;

// CONFUSED ❌
const packageId = pkg.id; // Which kind of ID?
const identifier = pkg.slug; // Slug is NOT an identifier
```

**Action Items:**

- [ ] Route param name matches API contract
- [ ] No `packageId` used for URL slug (use `packageSlug`)
- [ ] Variable names are context-specific (databaseId, urlSlug)

---

## Error Messages (1 minute)

When you see `throw new Error()` or error messages:

**Question: Could an attacker use this message to enumerate resources?**

```typescript
// DANGEROUS ❌
throw new Error(`Package ${packageId} not found`); // Confirms ID exists
throw new Error(`Tenant ${tenantId} not active`); // Reveals structure
throw new Error(`Unique constraint failed on 'slug'`); // Shows schema

// SAFE ✅
throw new PackageNotAvailableError(); // Generic
logger.warn('Package not found', { packageId, tenantId }); // Log details
```

**Safe vs Unsafe Information:**

| SAFE (show to client)                    | UNSAFE (log only)             |
| ---------------------------------------- | ----------------------------- |
| "The requested package is not available" | "Package ID abc123 not found" |
| "You don't have permission"              | "Tenant xyz not active"       |
| "Invalid email format"                   | "Unique constraint on slug"   |

**Action Items:**

- [ ] Error message is generic (no IDs, columns)
- [ ] Sensitive details logged separately
- [ ] HTTP status code is correct (404, 403, 422, 500)
- [ ] Error class inherits from AppError

---

## React Performance (1 minute)

When you see objects/arrays in components:

**Question: Will this cause unnecessary re-renders?**

```typescript
// PROBLEM ❌
const config = { size: 'large' };  // New object every render
const tiers = extractTiers(data);   // New array every render
return <Child config={config} />;   // Child re-renders

// SOLUTION ✅
const config = useMemo(() => ({ size: 'large' }), []);
const tiers = useMemo(() => extractTiers(data), [data]);
return <Child config={config} />;   // Child receives stable object
```

**Quick Decision Tree:**

1. Is it a **constant** (never changes)?
   - Move outside component: `const TIER_LEVELS = [...]`

2. Is it an **object/array** created in render?
   - Wrap with `useMemo`: `const value = useMemo(() => {...}, [deps])`

3. Is the child **memoized** (wrapped with `memo`)?
   - If YES → parent must stabilize object props
   - If NO → memo on parent provides no benefit

4. Is it a **function** passed to memo'ed child?
   - Wrap with `useCallback`: `const fn = useCallback(() => {...}, [deps])`
   - Otherwise → remove useCallback

**Action Items:**

- [ ] Constants moved outside component
- [ ] Objects/arrays passed to memo'ed children use `useMemo`
- [ ] All wrapper components wrapped with `React.memo`
- [ ] useMemo dependency arrays are correct
- [ ] No premature memo on components with only primitive props

---

## Cleanup & Code Quality (30 seconds)

- [ ] No unused imports (ESLint will catch)
- [ ] No dead code
- [ ] No hardcoded magic values (use constants)
- [ ] Comments explain "why", not "what"
- [ ] TypeScript strict: no unchecked `any`

---

## Red Flags 🚩 (Stop & Investigate)

| Found                                    | Action                        |
| ---------------------------------------- | ----------------------------- |
| `packageId` in route params              | Ask: Is this actually a slug? |
| Error with database ID in message        | Request fix                   |
| Error reveals schema details             | Request fix                   |
| Object created in render                 | Add useMemo or move to module |
| `memo` without prop stabilization        | Ask parent to use useMemo     |
| `useCallback` without memo child         | Remove useCallback            |
| Magic number/string duplicated 2+ places | Move to constant              |
| Component >100 lines                     | Break into smaller pieces     |

---

## Approval Criteria

Approve when **ALL** of these are true:

- [ ] ✅ Naming is clear and consistent (no confusion between id/slug)
- [ ] ✅ Error messages are safe (no IDs, columns, tenant info)
- [ ] ✅ React props are stable (objects wrapped with useMemo)
- [ ] ✅ Memo is used correctly (only when beneficial)
- [ ] ✅ No unused imports or dead code
- [ ] ✅ TypeScript strict mode passes
- [ ] ✅ Tests pass: `npm test`

---

## Terminal Commands (Paste & Run)

```bash
# Find naming issues
grep -rn "packageId.*slug\|slug.*packageId" server/src client/src

# Find unsafe error messages
grep -rn "Package \${packageId}\|Tenant \${tenantId}" server/src

# Find objects in render
grep -rn "const.*=.*{.*}\|const.*=.*\[" client/src/features/ \
  | grep -v useMemo | grep -v "const {" | head -20

# Find missing memo
grep "^export function" client/src/features/storefront/*.tsx | grep -v memo

# Run type check
npm run typecheck

# Run tests
npm test

# Auto-fix linting issues
npm run lint -- --fix
```

---

## 30-Second Version (Print & Pin!)

```
┌──────────────────────────────────────────┐
│ CODE REVIEW - 30 SECOND CHECKLIST        │
├──────────────────────────────────────────┤
│ 1. Route param = API contract name?      │
│ 2. Error msg generic (no IDs)?           │
│ 3. Objects in render? → use useMemo      │
│ 4. Memo without stable props?            │
│ 5. Constants in utils.ts?                │
│ 6. No unused imports                     │
│ 7. Tests pass                            │
└──────────────────────────────────────────┘
```

---

## Related Documents

- **Full Guide:** CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md
- **Error Pattern:** server/src/lib/errors/business.ts
- **React Patterns:** REACT-COMPONENT-REVIEW-QUICK-REF.md
- **Type Safety:** CODE-REVIEW-ANY-TYPE-CHECKLIST.md
