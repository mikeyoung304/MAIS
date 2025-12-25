---
title: Code Review Prevention Strategies - Index
category: prevention
tags: [code-review, prevention, index, quick-start]
priority: P2
date: 2025-12-24
---

# Code Review Prevention Strategies - Index

Complete set of prevention strategies for code review findings P348-350.

---

## Quick Links

### For Code Reviewers (Start Here!)

1. **[CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md](CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md)** (2 minutes)
   - Print and pin at your desk
   - Use during every code review
   - Covers naming, errors, React performance

### For Implementation

2. **[IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md](IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md)** (Reference)
   - Complete working examples
   - Copy-paste ready code
   - Before/after comparisons

### For Deep Understanding

3. **[CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md](CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md)** (Detailed)
   - Full explanation of each issue
   - Decision trees
   - Terminal commands

---

## Code Review Findings Overview

### P1-348: Naming Confusion (packageId vs slug)

**Problem:** Route parameters and API calls confuse between `packageId` (database) and `slug` (URL).

**Solution:** Use context-specific names and verify parameter names match API contracts.

**Key Document:** [IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md](IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md#pattern-1-correct-naming-in-routes--api-calls)

**Quick Fix:**
```typescript
// WRONG ❌
const { packageId } = useParams();
await api.getPackageBySlug({ params: { packageId } });

// CORRECT ✅
const { packageSlug } = useParams();
await api.getPackageBySlug({ params: { slug: packageSlug } });
```

---

### P2-349: Security - Error Message Info Disclosure

**Problem:** Error messages leak sensitive information (IDs, database columns, tenant structure) that helps attackers enumerate resources.

**Solution:** Use generic messages for client, log details separately.

**Key Document:** [IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md](IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md#pattern-2-secure-error-handling)

**Quick Fix:**
```typescript
// WRONG ❌
throw new Error(`Package ${packageId} not found`);
throw new Error(`Unique constraint failed on 'slug'`);

// CORRECT ✅
throw new PackageNotAvailableError();  // Generic
logger.warn('Package not found', { packageId, tenantId });  // Details logged
```

---

### P2-350: React Performance - Object Recreation

**Problem:** Objects and arrays created in render without memoization cause unnecessary re-renders of memoized children.

**Solution:** Move constants to module level, wrap computed values with `useMemo`.

**Key Document:** [IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md](IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md#pattern-3-react-performance---constants--memoization)

**Quick Fix:**
```typescript
// WRONG ❌
const TIER_LEVELS = ['tier_1', 'tier_2', 'tier_3'];  // New array every render!
const nav = { prev: tiers[0], next: tiers[1] };  // New object every render!

// CORRECT ✅
// Module level:
const TIER_LEVELS = ['tier_1', 'tier_2', 'tier_3'];

// In component:
const nav = useMemo(() => ({ prev: tiers[0], next: tiers[1] }), [tiers]);
```

---

### P3-352-356: Code Cleanup

**Problem:** Various cleanup items: unused imports, premature memo, redundant variables.

**Solution:** Run ESLint, remove unnecessary optimizations, use consistent patterns.

**Quick Commands:**
```bash
npm run lint -- --fix          # Remove unused imports
npm test                        # Verify cleanup doesn't break anything
npm run typecheck              # Check for unused variables
```

---

## When to Use Each Document

### Before Starting a Code Review Session

1. Open **[CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md](CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md)**
2. Print it and keep it visible
3. Run the pre-review commands

### While Reviewing Code

Use the **Quick Checklist** to:
- Ask naming questions
- Check error message safety
- Review React performance
- Flag red flags

### If You Need More Detail

Look up the specific issue in **[CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md](CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md)**

### If You're Implementing the Fix

Use **[IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md](IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md)** for working code examples.

---

## Checklists by Role

### Code Reviewers

- [ ] Have Quick Checklist open during review
- [ ] Check naming (packageId vs slug)
- [ ] Check error messages (no sensitive info)
- [ ] Check React performance (memo, useMemo)
- [ ] Run pre-review checks

**Reference:** [CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md](CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md)

### Developers (Before Committing)

- [ ] Parameter names match API contracts
- [ ] Error messages are generic (no IDs)
- [ ] Constants at module level (not in render)
- [ ] Objects/arrays wrapped with useMemo if passed to memo'ed children
- [ ] Run `npm test && npm run typecheck`

**Reference:** [IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md](IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md)

### Team Leads (Policy)

- [ ] All code reviews use the Quick Checklist
- [ ] Prevention strategies documented in CLAUDE.md
- [ ] Team trained on naming conventions
- [ ] Error handling follows the secure pattern
- [ ] React components follow memo/useMemo patterns

**Reference:** [CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md](CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md)

---

## Prevention Strategy Summary

### Naming Conventions (P348)

| Aspect | Rule |
|--------|------|
| Route parameters | Name must match API contract |
| Variable names | Use context-specific names (databaseId, urlSlug) |
| Function signatures | Parameter names clarify intent |
| API calls | Verify parameter name matches before submitting PR |

### Error Message Security (P349)

| Aspect | Rule |
|--------|------|
| Public message | Generic (no IDs, columns, tenant info) |
| Details logging | Log sensitive info with context |
| Error classes | Inherit from AppError, use domain-specific types |
| Status codes | Use correct HTTP status (404, 403, 422, 500) |

### React Performance (P350)

| Aspect | Rule |
|--------|------|
| Constants | Define at module level (not in render) |
| Computed values | Wrap with useMemo if passed to memo'ed children |
| Memo usage | Only use if component receives object props or used in lists |
| useCallback | Only if callback passed to memo'ed child |

### Code Cleanup (P3-352-356)

| Aspect | Rule |
|--------|------|
| Unused imports | Run `npm run lint -- --fix` |
| Dead code | Remove before commit |
| Magic values | Move to constants |
| Comments | Explain "why", not "what" |

---

## Common Patterns (Cheat Sheet)

### Naming Pattern

```typescript
// Parameter name = API contract name
interface Params { packageSlug: string; }
const { packageSlug } = useParams<Params>();
await api.getPackageBySlug({ params: { slug: packageSlug } });
```

### Error Pattern

```typescript
// Generic message to client, details logged
try {
  const pkg = await service.getPackage(id);
} catch (error) {
  if (error instanceof PackageNotAvailableError) {
    logger.warn('Package not found', { id });
    return { status: 404, body: { error: error.message } };
  }
}
```

### React Pattern

```typescript
// Constants module-level, objects use useMemo, memo on wrappers
const TIER_LEVELS = ['tier_1', 'tier_2', 'tier_3'];

export const TierCard = memo(function TierCard({ tier }) {
  return <Base {...tier} />;
});

export function Parent({ tiers }) {
  const nav = useMemo(() => calculateNav(tiers), [tiers]);
  return <TierCard nav={nav} />;
}
```

---

## Next Steps

1. **Read the Quick Checklist** (2 min)
   - [CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md](CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md)
   - Print it

2. **Review the Detailed Strategies** (when needed)
   - [CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md](CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md)
   - Bookmark for reference

3. **Use Implementation Patterns** (when coding)
   - [IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md](IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md)
   - Copy working examples

4. **Practice on Next PR**
   - Use Quick Checklist during review
   - Apply patterns from Implementation doc
   - Reference full strategies if needed

---

## Related Codebase References

### Error Handling

- **Location:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/business.ts`
- **Pattern:** Generic public messages, detailed logging
- **Example:** `PackageNotAvailableError` (line 174-178)

### API Contracts

- **Location:** `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/api.v1.ts`
- **Pattern:** Parameter names in contract
- **Example:** `getPackageBySlug` route definition

### React Components

- **Good Example:** `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/TierDetail.tsx`
  - Correct use of `useMemo`
  - Proper memo patterns
  - Good naming (packageSlug)

- **Good Example:** `/Users/mikeyoung/CODING/MAIS/client/src/pages/DateBookingPage.tsx`
  - Correct parameter naming
  - Proper API contract usage
  - Safe error handling

---

## Questions & Answers

**Q: When should I use useMemo?**
A: When you create an object/array in render and pass it to a memo'ed child component.

**Q: When should I add memo to a component?**
A: When the component receives object/array props OR is rendered in a list.

**Q: How do I know if my error message is safe?**
A: Ask: "Could an attacker use this to enumerate resources?" If yes, it's unsafe.

**Q: What's the difference between packageId and packageSlug?**
A: `packageId` = database primary key (integer), `packageSlug` = user-friendly URL (string).

**Q: Should I commit constants to utils.ts if only one file uses them?**
A: If it's a magic number/string that might change later, yes. If truly unique to one component, no.

---

## Feedback & Updates

These prevention strategies are based on code review findings:

- **P1-348:** packageId vs slug naming confusion
- **P2-349:** Security info disclosure in error messages
- **P2-350:** Object recreation on every render
- **P3-352-356:** Code cleanup items

Future code reviews should reference these documents to prevent recurrence.

---

## Document Versions

| Document | Version | Date | Status |
|----------|---------|------|--------|
| CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md | 1.0 | 2025-12-24 | Active |
| CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md | 1.0 | 2025-12-24 | Active |
| IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md | 1.0 | 2025-12-24 | Active |
| CODE-REVIEW-PREVENTION-INDEX.md | 1.0 | 2025-12-24 | Active |

Last updated: 2025-12-24
