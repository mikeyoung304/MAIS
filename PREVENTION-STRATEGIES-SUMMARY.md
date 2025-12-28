# Prevention Strategies: Next.js ISR Cache & API Mismatch - Summary

**Date Created:** December 25, 2025
**Status:** Complete
**Total Documentation:** 4 comprehensive guides

---

## Overview

Comprehensive prevention strategies have been created for two critical issues encountered during Next.js storefront development:

1. **ISR Cache Showing Stale Data** - Next.js ISR caches served outdated package information beyond revalidation periods
2. **API URL Mismatches** - Client code calls endpoints with incorrect paths, causing 404 errors and routing failures

---

## Created Documentation

### 1. Main Prevention Strategy Document

**File:** `docs/solutions/NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md` (32 KB)

**Content:**

- **Issue 1: ISR Cache Stale Data** (4 strategies)
  - Problem description and root causes
  - Development workflow for detecting stale data
  - Three manual cache-busting strategies
  - When to use each strategy
  - ISR development workflow (3-phase approach)

- **Issue 2: API URL Mismatches** (4 strategies)
  - Root causes analysis
  - Code review checklist for verification
  - Automated contract validation script
  - E2E test patterns
  - Contract-first development workflow

- **Part 3: Quick Reference Checklists**
  - New endpoint checklist
  - Code review checklist

- **Part 4: Testing Patterns**
  - Integration tests for contract consistency
  - E2E tests for ISR timing and freshness

**Best For:** Complete understanding of both issues, implementation patterns, and testing strategies

---

### 2. Quick Reference Guide

**File:** `docs/solutions/PREVENTION-QUICK-REFERENCE-NEXTJS.md` (4.5 KB)

**Content:**

- Issue summaries (one paragraph each)
- Quick detection methods
- Quick fixes for both issues
- Development workflow overview
- Decision trees
- Common mistakes table
- Useful commands
- Quick links to detailed guides

**Best For:** Quick lookup during development, sharing with team, desk reference

---

### 3. Implementation Guide

**File:** `docs/guides/IMPLEMENTING-ISR-CACHE-STRATEGIES.md` (12 KB)

**Content:**

- **Strategy 1: Disable ISR During Development**
  - Step-by-step instructions
  - Verification steps

- **Strategy 2: On-Demand Revalidation**
  - Create server action for cache invalidation
  - Call from admin actions
  - Testing approach

- **Strategy 3: Query Parameter Cache Busting**
  - Add cache-disabled version
  - Testing with `?fresh=1` parameter

- **Strategy 4: Clear Local Cache**
  - Clear build cache between requests

- **Testing Your Implementation** (3 test examples with code)
  - ISR revalidation timing test
  - Cache invalidation test
  - Query parameter test

- **Monitoring & Debugging**
  - Debug logging setup
  - Cache header inspection
  - Server log analysis

- **Checklist: Implementation Complete**
- **Common Issues & Solutions**

**Best For:** Hands-on developers implementing cache strategies, working examples with full code

---

### 4. Code Review Checklist

**File:** `docs/guides/CODE-REVIEW-API-CONTRACTS-CHECKLIST.md` (16 KB)

**Content:**

- **Quick Start** - Copy-paste checklist for reviews
- **Section 1: Reviewing API Calls** (5 items with examples)
  - Verify contract exists
  - Verify HTTP method
  - Verify path matches exactly
  - Verify required headers
  - Verify response handling

- **Section 2: Reviewing ISR Changes** (3 items)
  - Verify ISR configuration
  - Verify cache tags (if used)
  - Verify React cache() wrapper

- **Section 3: Combined Checklist**
  - Full API + ISR checklist for comprehensive reviews

- **Section 4: Common Issues to Watch For** (3 patterns)
  - Path parameters not URL-encoded
  - ISR too aggressive/conservative
  - Missing type safety

- **How to Use This Checklist**
  - For code authors, reviewers, team leaders

**Best For:** Code reviewers, ensuring consistency during PR reviews, team onboarding

---

## Key Themes

### ISR Cache Prevention

**Core Concept:** ISR has multiple cache layers that can show stale data

**Main Strategies:**

1. **Disable** - Set `revalidate: 0` for instant feedback during development
2. **On-Demand** - Use `revalidatePath()` to invalidate after updates
3. **Query Param** - Add `?fresh=1` to bypass cache for debugging
4. **Clear Cache** - Remove `.next` folder when cache is stuck

**Decision Making:**

- Branding/rare changes: `revalidate: 3600` (1 hour)
- Package details/moderate changes: `revalidate: 300` (5 minutes)
- Availability/frequent changes: `revalidate: 60` (1 minute)
- Admin/always fresh: `revalidate: 0` (never cache)

### API Mismatch Prevention

**Core Concept:** Client URLs must match contract definitions exactly

**Main Strategies:**

1. **Contract First** - Define endpoint in contracts BEFORE implementing
2. **Verification** - Search contracts file and copy path exactly
3. **Automation** - Use validation script to catch mismatches
4. **Testing** - E2E tests verify endpoints are reachable

**Decision Making:**

- Always use ts-rest client when possible (type-safe)
- If manual fetch, copy path from contract file exactly
- Include required headers (X-Tenant-Key, Authorization)
- Handle all response status codes defined in contract

---

## How to Use This Documentation

### For Individual Developers

1. **Start with Quick Reference** - Get oriented in 5 minutes
   - Read: `PREVENTION-QUICK-REFERENCE-NEXTJS.md`

2. **When Implementing a Strategy** - Follow step-by-step guide
   - Read: `IMPLEMENTING-ISR-CACHE-STRATEGIES.md`

3. **When Reviewing Code** - Use the checklist
   - Read: `CODE-REVIEW-API-CONTRACTS-CHECKLIST.md`

4. **For Deep Dive** - Understand root causes and patterns
   - Read: `NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md`

### For Code Review Process

Include this in your PR template:

```markdown
## API & ISR Review

- [ ] Author: Self-review using Quick Reference guide
- [ ] Reviewer: Use Code Review Checklist guide
- [ ] Both: Reference common issues if problems found
```

### For Team Onboarding

1. Share Quick Reference with new developers
2. Link Code Review Checklist in PR template
3. Have them implement one strategy using Implementation Guide
4. Discuss Main Prevention document in team meeting

---

## Integration with CLAUDE.md

These prevention strategies complement the existing CLAUDE.md guidance:

**From CLAUDE.md (Multi-tenant isolation):**

```typescript
// All queries must filter by tenantId
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});
```

**This prevention strategy adds:**

```typescript
// For Next.js, ISR revalidation timing
export const revalidate = 60; // Prevents stale cache

// API contract validation
const url = `${API_BASE_URL}/v1/packages`; // Must match contract
```

---

## Quick Stats

| Document        | Size        | Read Time  | Best For                |
| --------------- | ----------- | ---------- | ----------------------- |
| Main Prevention | 32 KB       | 20 min     | Complete understanding  |
| Quick Reference | 4.5 KB      | 5 min      | Quick lookup            |
| Implementation  | 12 KB       | 15 min     | Hands-on implementation |
| Code Review     | 16 KB       | 10 min     | PR reviews              |
| **Total**       | **64.5 KB** | **50 min** | **Complete training**   |

---

## Key Files Referenced

**In MAIS Codebase:**

| File                                                    | Purpose                                    |
| ------------------------------------------------------- | ------------------------------------------ |
| `packages/contracts/src/api.v1.ts`                      | API contract definitions (source of truth) |
| `apps/web/src/lib/tenant.ts`                            | Tenant data fetching (SSR functions)       |
| `apps/web/src/lib/api.ts`                               | ts-rest API client (type-safe client)      |
| `apps/web/src/app/t/[slug]/(site)/page.tsx`             | Landing page with ISR                      |
| `apps/web/src/app/t/[slug]/book/[packageSlug]/page.tsx` | Booking page with ISR                      |

---

## Related Issues Prevented

### ISR Cache Issues

1. **Stale package data** - Tenant updates price, customer sees old price
2. **Stale availability** - Date was booked, customer still sees it available
3. **Stale branding** - Tenant updates logo, customer sees old logo
4. **Cache stuck** - Data updates but page never refreshes

### API Mismatch Issues

1. **404 errors** - Client calls wrong URL, gets not found
2. **Missing data** - Extra URL segment causes endpoint mismatch
3. **Auth failures** - Missing X-Tenant-Key header causes 401
4. **Type mismatches** - Response structure doesn't match contract

---

## Testing Coverage

### E2E Tests Recommended

```typescript
// ISR timing validation
test('ISR revalidates after 60 seconds');

// Cache invalidation validation
test('invalidateTenantCache works immediately');

// API contract validation
test('all contract paths exist on API');

// Client-contract consistency
test('storefront loads from correct endpoint');
```

### Integration Tests Recommended

```typescript
// Contract consistency
test('all contract paths have Express implementations');

// Endpoint availability
test('all Express routes have contract definitions');
```

---

## Maintenance & Updates

### When to Update This Documentation

1. **New ISR pattern discovered** - Add to common issues section
2. **New API contract endpoint** - Update verification checklist
3. **Team faces new error pattern** - Document root cause and solution
4. **Next.js version changes** - Review ISR behavior for breaking changes

### Version History

| Date         | Change                                                 |
| ------------ | ------------------------------------------------------ |
| Dec 25, 2025 | Initial creation (4 documents, comprehensive coverage) |

---

## Questions?

Refer to the appropriate guide:

- **"How do I fix stale cache?"** → Quick Reference → Issue 1
- **"How do I verify an API endpoint?"** → Code Review Checklist → Verify Contract Exists
- **"I'm getting 404s"** → Quick Reference → Issue 2 → Quick Diagnosis
- **"How should I implement revalidation?"** → Implementation Guide → Strategy 2

---

## Checklist: Team Rollout

Use this to share prevention strategies with your team:

- [ ] Share Quick Reference with all developers
- [ ] Add Code Review Checklist to PR template
- [ ] Schedule 30-min team meeting discussing issues + prevention
- [ ] Have each developer implement one ISR strategy
- [ ] Update team wiki/docs with links to guides
- [ ] Reference during code reviews for 2 weeks (build habit)
- [ ] Check in at 1 month - ask for feedback

---

## Summary

**Two critical issues have been comprehensively documented with prevention strategies, implementation guides, and code review checklists.**

Developers now have:

- Clear understanding of root causes
- Multiple concrete strategies to prevent each issue
- Step-by-step implementation guides with working examples
- Code review checklists to catch issues before deployment
- Quick reference materials for daily development

The prevention strategies are not theoretical - they include actual code examples, E2E tests, and integration tests that can be implemented immediately.
