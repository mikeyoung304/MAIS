---
title: Code Review Prevention - Summary & Quick Start
category: prevention
tags: [code-review, summary, quick-start, findings]
priority: P2
date: 2025-12-24
---

# Code Review Prevention - Summary & Quick Start

Generated prevention strategies based on code review findings P348-350.

---

## What Was Generated

Four comprehensive prevention documents to prevent recurrence of code review findings:

### 1. Quick Checklist (2 min read)

**[CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md](CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md)**

Print and pin at your desk. Use during every code review.

- Naming conventions checklist (packageId vs slug)
- Error message security checklist
- React performance checklist
- 30-second approval criteria

### 2. Detailed Strategies (10-15 min read)

**[CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md](CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md)**

Full explanation of each issue with decision trees and prevention strategies.

- Root causes of each problem
- Prevention strategy 1-4 with detailed examples
- Code review checklist items
- Red flags and terminal commands

### 3. Implementation Patterns (Reference)

**[IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md](IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md)**

Complete working examples ready to use.

- Pattern 1: Correct naming in routes
- Pattern 2: Secure error handling
- Pattern 3: React performance
- Before/after comparisons

### 4. Index & Navigation (This)

**[CODE-REVIEW-PREVENTION-INDEX.md](CODE-REVIEW-PREVENTION-INDEX.md)**

Complete reference and quick links.

---

## Code Review Findings - Quick Reference

### Finding P1-348: Naming Confusion (packageId vs slug)

**What's the problem?**

Route parameters and API calls confuse between database IDs and URL slugs:

```typescript
// ❌ WRONG - API expects 'slug', param is 'packageId'
const { packageId } = useParams();
await api.getPackageBySlug({ params: { packageId } });
```

**What's the solution?**

Match parameter names to API contract and use context-specific names:

```typescript
// ✅ CORRECT
const { packageSlug } = useParams();
await api.getPackageBySlug({ params: { slug: packageSlug } });
```

**Prevention Strategy:** [See Section 1 in Prevention Strategies](CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md#1-naming-convention-prevention-p348-packageid-vs-slug)

**Implementation Guide:** [See Pattern 1 in Implementation Patterns](IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md#pattern-1-correct-naming-in-routes--api-calls)

---

### Finding P2-349: Security - Error Message Info Disclosure

**What's the problem?**

Error messages leak sensitive information that helps attackers enumerate resources:

```typescript
// ❌ WRONG - Reveals internal info
throw new Error(`Package ${packageId} not found`);
throw new Error(`Unique constraint failed on column 'slug'`);
```

**What's the solution?**

Use generic messages for clients, log sensitive details separately:

```typescript
// ✅ CORRECT
throw new PackageNotAvailableError(); // Generic message
logger.warn('Package not found', { packageId, tenantId }); // Details logged
```

**Prevention Strategy:** [See Section 2 in Prevention Strategies](CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md#2-error-message-security-prevention-p349-info-disclosure)

**Implementation Guide:** [See Pattern 2 in Implementation Patterns](IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md#pattern-2-secure-error-handling)

---

### Finding P2-350: React Performance - Object Recreation

**What's the problem?**

Objects created in render without memoization cause unnecessary re-renders:

```typescript
// ❌ WRONG - New object every render
const navigation = { prev: tiers[0], next: tiers[1] };
return <Child nav={navigation} />;  // Child re-renders
```

**What's the solution?**

Move constants to module level, memoize computed objects:

```typescript
// ✅ CORRECT - Module level
const TIER_LEVELS = ['tier_1', 'tier_2', 'tier_3'];

// In component
const navigation = useMemo(() => ({ prev: tiers[0], next: tiers[1] }), [tiers]);
return <Child nav={navigation} />;  // Child doesn't re-render
```

**Prevention Strategy:** [See Section 3 in Prevention Strategies](CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md#3-react-performance-prevention-p350-object-recreation)

**Implementation Guide:** [See Pattern 3 in Implementation Patterns](IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md#pattern-3-react-performance---constants--memoization)

---

### Finding P3-352-356: Code Cleanup

**What's the problem?**

Various cleanup items: unused imports, premature optimizations, redundant variables.

**What's the solution?**

Run linting, remove unnecessary code, use consistent patterns.

```bash
npm run lint -- --fix          # Remove unused imports
npm test                        # Verify tests still pass
git diff                        # Review what was cleaned up
```

---

## Quick Start Guide

### For Code Reviewers

**Step 1:** Open the quick checklist

```bash
# Print the quick checklist
open docs/solutions/CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md
```

**Step 2:** Use during code review

- Ask naming questions
- Check error messages
- Review React performance
- Flag red flags

**Step 3:** If you need more detail

Reference the detailed strategies document.

### For Developers

**Before committing code:**

1. Check naming conventions match API contracts
2. Ensure error messages are generic (no IDs/columns)
3. Move constants to module level
4. Wrap computed values with useMemo
5. Run tests and type check

```bash
npm test && npm run typecheck
```

### For Code Reviewers (Detailed)

**Pre-review (2 min):**

```bash
npm run typecheck
npm test
git diff --stat HEAD
```

**During review (use quick checklist):**

- [ ] Naming conventions correct
- [ ] Error messages safe
- [ ] React performance optimized
- [ ] No unused imports
- [ ] Tests pass

---

## Approval Criteria

Approve code when **ALL** of these are true:

- [ ] Naming clear and consistent (no packageId for slug)
- [ ] Error messages safe (no IDs, columns, tenant info)
- [ ] React props stable (objects wrapped with useMemo)
- [ ] Memo used correctly (only when beneficial)
- [ ] No unused imports or dead code
- [ ] TypeScript strict mode passes
- [ ] Tests pass
- [ ] No hardcoded magic values

---

## Key Takeaways

### 1. Naming Conventions

**Rule:** Parameter names = API contract names

```typescript
// API defines: path: '/packages/:slug'
// Frontend must use: useParams<{ slug: string }>()
// NOT: useParams<{ packageId: string }>()
```

### 2. Error Security

**Rule:** Generic to client, detailed logging

```typescript
try {
  await service.doSomething();
} catch (error) {
  logger.error('Error details', { sensitive: true }); // ← Log
  return { status: 500, body: { error: 'Something went wrong' } }; // ← Generic
}
```

### 3. React Performance

**Rule:** Constants module-level, objects use useMemo

```typescript
// ✅ Module level (not in render)
const TIER_LEVELS = ['tier_1', 'tier_2'];

// ✅ Memoize computed objects
const nav = useMemo(() => ({ prev, next }), [deps]);
```

### 4. Code Quality

**Rule:** Consistent patterns, no dead code

```bash
npm run lint -- --fix  # Fix imports and formatting
npm test               # Verify everything works
```

---

## Common Questions Answered

**Q: When should I use useMemo?**

A: When you create an object/array in render and pass it to a memo'ed child component. If the child is not memoized, useMemo provides no benefit.

**Q: How do I know my error message is safe?**

A: Ask: "Could an attacker use this info to enumerate resources?" If yes, make it generic.

**Q: Should route params be packageId or packageSlug?**

A: Match what your API contract defines. If API says `:slug`, route param should be `slug`.

**Q: What's premature optimization?**

A: Using `memo` on a component that receives only primitive props, or using `useMemo` on primitive values. Only optimize when it provides real benefit.

**Q: Why move constants to module level?**

A: Every time the component renders, module-level constants are reused. In-render constants are recreated, causing unnecessary re-renders of memoized children.

---

## Red Flags During Review

Stop and investigate if you see:

| Flag                             | Why It Matters             | Reference |
| -------------------------------- | -------------------------- | --------- |
| `packageId` used as route param  | Doesn't match API contract | P348      |
| Error includes database ID       | Security vulnerability     | P349      |
| Error reveals schema/columns     | Security vulnerability     | P349      |
| Object created in render         | Breaks memo optimization   | P350      |
| Memo on primitive-only component | Waste of optimization      | P350      |
| Magic number/string in 2+ files  | Maintenance issue          | P3        |
| Unused imports                   | Code quality               | P3        |

---

## Terminal Commands

### Check for Common Issues

```bash
# Find naming confusion
grep -rn "packageId.*slug\|slug.*packageId" server/src client/src

# Find unsafe error messages
grep -rn "Package \${packageId}\|Tenant \${tenantId}" server/src

# Find objects created in render
grep -rn "const.*=.*{.*}\|const.*=.*\[" client/src/features/ \
  | grep -v useMemo | head -20

# Find missing memo
grep "^export function" client/src/features/storefront/*.tsx | grep -v memo

# Auto-fix issues
npm run lint -- --fix
npm test
npm run typecheck
```

---

## Next Steps

1. **Today:** Open and skim the Quick Checklist
   - Takes 2 minutes
   - Print it

2. **This Week:** Use it during your first code review
   - Reference the checklist
   - Apply the patterns

3. **Going Forward:** Reference these docs when questions arise
   - Detailed strategies for understanding
   - Implementation patterns for working examples

---

## Document Map

```
CODE-REVIEW-PREVENTION-INDEX.md (START HERE FOR NAVIGATION)
│
├─ CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md (2 min - PRINT THIS)
│  └─ Use during every code review
│
├─ CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md (15 min - REFERENCE)
│  └─ Full explanations and decision trees
│
├─ IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md (WORKING EXAMPLES)
│  └─ Copy-paste ready code patterns
│
└─ CODE-REVIEW-PREVENTION-SUMMARY.md (THIS FILE)
   └─ Overview and quick start
```

---

## Files Changed in Codebase

These are the good examples that follow the prevention strategies:

- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/TierDetail.tsx`
  - ✅ Correct useMemo usage
  - ✅ Constants at module level
  - ✅ packageSlug parameter naming

- `/Users/mikeyoung/CODING/MAIS/client/src/pages/DateBookingPage.tsx`
  - ✅ Correct parameter naming
  - ✅ Safe error handling
  - ✅ Proper error message text

- `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/business.ts`
  - ✅ Generic error messages
  - ✅ Proper error class hierarchy
  - ✅ Security-aware implementation

---

## Getting Help

If you're unsure:

1. **Check the Quick Checklist**
   - Does your change match the patterns?

2. **Read the Detailed Strategies**
   - Need more context?

3. **Copy the Implementation Patterns**
   - Need working code?

4. **Ask in code review comments**
   - Reference the specific prevention strategy

---

## Prevention Strategies Generated

| Issue                         | Priority | Document                       | Status   |
| ----------------------------- | -------- | ------------------------------ | -------- |
| P1-348: Naming confusion      | P1       | PREVENTION-STRATEGIES-P348-350 | Complete |
| P2-349: Error info disclosure | P2       | PREVENTION-STRATEGIES-P348-350 | Complete |
| P2-350: React performance     | P2       | PREVENTION-STRATEGIES-P348-350 | Complete |
| P3-352-356: Code cleanup      | P3       | PREVENTION-QUICK-CHECKLIST     | Complete |

**Total Documents Created:** 4

- CODE-REVIEW-PREVENTION-QUICK-CHECKLIST.md (6.7 KB)
- CODE-REVIEW-PREVENTION-STRATEGIES-P348-350.md (20 KB)
- IMPLEMENTATION-PATTERNS-NAMING-ERRORS-REACT.md (16 KB)
- CODE-REVIEW-PREVENTION-INDEX.md (10 KB)

**Total Size:** ~53 KB of comprehensive prevention strategies

---

## Success Criteria

You'll know these strategies are working when:

1. Code reviewers ask naming questions before approving
2. No more errors with database IDs in messages
3. React components properly memoized with stable props
4. Unused imports automatically fixed by linter
5. Code review times decrease (clearer guidelines)
6. Fewer rounds of revisions needed

---

**Last Generated:** 2025-12-24
**For Questions:** Reference the specific prevention document or the detailed strategies.
