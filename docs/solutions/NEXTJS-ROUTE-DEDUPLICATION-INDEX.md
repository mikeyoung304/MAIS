# Next.js Route Deduplication: Complete Resource Index

**Problem:** Multi-route Next.js projects duplicate page implementations across different route types (e.g., [slug] vs \_domain routes)

**Solution:** Use TenantIdentifier union type + shared utilities to keep both routes in sync

**Impact:** ~60% reduction in code duplication, ~50% faster feature implementation, easier maintenance

---

## For Different Audiences

### Developers Adding New Pages

Start here:

1. **[Quick Checklist](nextjs-route-duplication-quick-checklist.md)** (10 minutes)
   - Step-by-step template for new pages
   - Common mistakes reference
   - Testing checklist

2. **[Full Prevention Strategy](nextjs-route-duplication-prevention-MAIS-20251228.md)** (Background reading)
   - Why the pattern exists
   - When to apply it
   - Detailed checklist with explanations
   - Real examples from MAIS codebase

### Code Reviewers

Start here:

1. **[Review Guidelines](code-review-patterns/nextjs-route-review-guidelines.md)** (5 minutes per PR)
   - 7 critical checks
   - Copy-paste review comments
   - Decision tree for approval
   - Red flags to watch for

2. **[Prevention Strategy - Code Review Flags Section](nextjs-route-duplication-prevention-MAIS-20251228.md#code-review-flags)**
   - Detailed explanation of each flag
   - Before/after code examples

### Architects/Team Leads

Start here:

1. **[Prevention Strategy - When to Apply Section](nextjs-route-duplication-prevention-MAIS-20251228.md#when-to-apply-this-pattern)**
   - Decision tree
   - Cost-benefit analysis
   - Signs you need this pattern

2. **[Prevention Strategy - Testing Approach](nextjs-route-duplication-prevention-MAIS-20251228.md#testing-approach)**
   - Unit testing strategy
   - E2E testing strategy
   - Manual testing checklist

---

## Document Breakdown

### 1. Quick Checklist (2 pages)

**File:** `nextjs-route-duplication-quick-checklist.md`

**Purpose:** Developer reference card - copy/paste ready

**Contains:**

- 10-minute implementation checklist
- Code templates for [slug] and \_domain routes
- Mistake/fix reference table
- Code review red flags (5-second version)
- Testing checklist
- File structure diagram
- Common page names list
- Troubleshooting Q&A

**Use when:**

- Adding a new page to both routes
- Need quick reference during implementation
- Writing tests for both routes

**Not suitable for:**

- Understanding the pattern deeply
- Learning why this approach
- Code review training

---

### 2. Full Prevention Strategy (12 pages)

**File:** `nextjs-route-duplication-prevention-MAIS-20251228.md`

**Purpose:** Comprehensive guide with rationale, patterns, examples

**Contains:**

- Problem statement with impact analysis
- Solution pattern explanation (with code)
- **When to Apply** - decision tree + red flags
- **7-Step Checklist** - detailed walkthrough with explanations
- **Code Review Flags** - 7 critical patterns with examples
- **Testing Approach** - unit, integration, E2E, manual
- **Common Mistakes** - 5 mistakes with wrong/right examples
- **Quick Reference Template** - minimal copy-paste template
- **Decision Tree** - should I use this pattern?
- **Maintenance Guide** - updating both routes
- **Related Prevention Strategies** - cross-references

**Use when:**

- First time learning the pattern
- Explaining pattern to team members
- Training new developers
- Understanding why code review flags matter

**Best for:**

- Learning and reference
- Training
- Justifying the pattern to stakeholders

---

### 3. Code Review Guidelines (8 pages)

**File:** `code-review-patterns/nextjs-route-review-guidelines.md`

**Purpose:** Reviewer checklist with copy-paste comments

**Contains:**

- Pattern overview for reviewers
- **7 Critical Checks** with examples:
  1. Shared utilities used
  2. TenantIdentifier union type
  3. Components route-agnostic
  4. Links use basePath + domainParam
  5. Domain guard in \_domain route
  6. Error handling consistent
  7. ISR revalidation configured
- Secondary checks (code quality)
- Review flow decision tree
- Copy-paste review comments (5 common scenarios)
- Approval criteria checklist
- Reference table of key files

**Use when:**

- Reviewing PRs with dual-route changes
- Responding to developer questions
- Enforcing pattern consistency
- Onboarding new reviewers

**Best for:**

- Code review process
- Quality assurance
- Enforcement

---

## Quick Links by Task

### "I'm adding a new about/services/faq page"

→ Read: [Quick Checklist](nextjs-route-duplication-quick-checklist.md)
→ Time: 10 minutes
→ Copy templates, follow checklist, submit

### "I'm reviewing a PR with route changes"

→ Read: [Review Guidelines](code-review-patterns/nextjs-route-review-guidelines.md)
→ Time: 5 minutes per PR
→ Use decision tree, run 7 checks, copy-paste comments if needed

### "I want to understand the pattern deeply"

→ Read: [Full Prevention Strategy](nextjs-route-duplication-prevention-MAIS-20251228.md)
→ Time: 30-45 minutes
→ Learn history, rationale, and examples from MAIS

### "I'm writing tests for a new page"

→ Read: [Prevention Strategy - Testing Section](nextjs-route-duplication-prevention-MAIS-20251228.md#testing-approach)
→ Time: 15 minutes
→ Unit test utilities, E2E test both routes

### "A developer has a question about the pattern"

→ Refer: [Quick Checklist - Troubleshooting Section](nextjs-route-duplication-quick-checklist.md#troubleshooting) first
→ If unclear: [Prevention Strategy](nextjs-route-duplication-prevention-MAIS-20251228.md) for full explanation

### "I'm onboarding a new developer"

→ Start: [Quick Checklist](nextjs-route-duplication-quick-checklist.md) for hands-on learning
→ Deepen: [Prevention Strategy](nextjs-route-duplication-prevention-MAIS-20251228.md) for understanding
→ Reference: [Review Guidelines](code-review-patterns/nextjs-route-review-guidelines.md) for maintaining quality

---

## The Pattern in 60 Seconds

**Problem:** Implementing the same page twice (once for [slug], once for \_domain) causes:

- Code duplication
- Maintenance burden (fix in 2 places)
- Bug inconsistency (fixed in one route but not other)

**Solution:** Use a TenantIdentifier union type to abstract route differences:

```typescript
// Union type - handles both routes
type TenantIdentifier =
  | { type: 'slug'; slug: string }
  | { type: 'domain'; domain: string };

// Shared utilities accept this type
async function resolveTenant(identifier: TenantIdentifier) { ... }

// [slug] route: convert params to identifier
const identifier = { type: 'slug', slug };
const context = await resolveTenant(identifier);

// _domain route: convert searchParams to identifier
const identifier = { type: 'domain', domain };
const context = await resolveTenant(identifier);

// Both use same component, pass basePath + domainParam
<PageContent tenant={context.tenant} basePath={context.basePath} domainParam={context.domainParam} />
```

**Result:**

- Logic lives in one place (utilities)
- Components route-agnostic
- Both routes stay in sync automatically
- New features take 30 min instead of 50 min

---

## Key Concepts

### TenantIdentifier

Union type that abstracts route type:

- `{ type: 'slug', slug }` for /t/[slug]/... routes
- `{ type: 'domain', domain }` for /t/\_domain/... routes

Used as parameter to all shared utilities.

### ResolvedTenantContext

Standard return type from utilities containing:

- `tenant` - tenant data
- `config` - landing page config
- `basePath` - route prefix (/t/slug or '')
- `domainParam` - query string (?domain=... or undefined)

### basePath + domainParam Pattern

Used in components to build links agnostically:

```typescript
const serviceLink = `${basePath}/services${domainParam || ''}`;
```

- On [slug]: `/t/slug/services`
- On \_domain: `/services?domain=...`

### Domain Guard

\_domain routes require special handling because domain comes from URL params:

```typescript
const { domain } = await searchParams;
if (!domain) {
  // [slug] has slug parameter always
  // [domain] has domain parameter optionally
  return notFound(); // or fallback metadata
}
```

---

## Files Implementing This Pattern in MAIS

All tenant pages follow this pattern. Reference examples:

| Page             | [slug] Route                                 | \_domain Route                         |
| ---------------- | -------------------------------------------- | -------------------------------------- |
| **About**        | `/app/t/[slug]/(site)/about/page.tsx`        | `/app/t/_domain/about/page.tsx`        |
| **Services**     | `/app/t/[slug]/(site)/services/page.tsx`     | `/app/t/_domain/services/page.tsx`     |
| **Contact**      | `/app/t/[slug]/(site)/contact/page.tsx`      | `/app/t/_domain/contact/page.tsx`      |
| **FAQ**          | `/app/t/[slug]/(site)/faq/page.tsx`          | `/app/t/_domain/faq/page.tsx`          |
| **Gallery**      | `/app/t/[slug]/(site)/gallery/page.tsx`      | `/app/t/_domain/gallery/page.tsx`      |
| **Testimonials** | `/app/t/[slug]/(site)/testimonials/page.tsx` | `/app/t/_domain/testimonials/page.tsx` |

Shared utilities:

- `/lib/tenant-page-utils.ts` - TenantIdentifier type + shared functions
- `/lib/tenant.ts` - Tenant data fetching
- `/components/tenant/TenantErrorBoundary.tsx` - Shared error boundary
- `/components/tenant/[Page]PageContent.tsx` - Content components

---

## Checklist for Implementation

When implementing dual routes in a Next.js project:

- [ ] Create `TenantIdentifier` union type
- [ ] Create shared utilities that accept `TenantIdentifier`
- [ ] Create shared content components (accept basePath + domainParam)
- [ ] Implement [slug] route (minimal wrapper)
- [ ] Implement [slug] error boundary
- [ ] Implement \_domain route (minimal wrapper + domain guard)
- [ ] Implement \_domain error boundary
- [ ] Update content component props (basePath, domainParam)
- [ ] Test both routes work identically
- [ ] Test links include correct query params
- [ ] Test domain route fails without domain param
- [ ] Add E2E tests covering both routes

---

## Common Questions

**Q: When should I NOT use this pattern?**
A: If you have only one route type, don't use it. If you're implementing 3+ pages across 2+ routes, use it.

**Q: Can I use this for other multi-route scenarios?**
A: Yes! This pattern works for any multi-route setup: workspaces, organizations, teams, etc.

**Q: How much time does this save?**
A: Per new page: ~30 min (vs 50 min without pattern). Per bug fix: automatic propagation to both routes (vs 2x time to fix both).

**Q: What if the routes need different logic?**
A: If divergence >30%, direct implementation might be better. For <30% divergence, this pattern is worth it.

**Q: How do I handle context in Next.js 15?**
A: Use `params: Promise<{...}>` and `searchParams: Promise<{...}>` (await inside component/function).

---

## Learning Path

**New team member learning path:**

1. **Day 1:** Read [Quick Checklist](nextjs-route-duplication-quick-checklist.md) (30 min)
2. **Day 1:** Add a simple page (10/about) following checklist (45 min)
3. **Day 2:** Read [Prevention Strategy](nextjs-route-duplication-prevention-MAIS-20251228.md) (45 min)
4. **Day 2:** Review 2 PRs using [Review Guidelines](code-review-patterns/nextjs-route-review-guidelines.md)
5. **Day 3:** Add a complex page (services with packages/segments) (60 min)
6. **Day 3:** Lead code review for another page

**Total onboarding time:** ~4-5 hours to full competency

---

## Related Prevention Strategies

These complement the route deduplication pattern:

- **[mais-critical-patterns](patterns/mais-critical-patterns.md)** - Tenant isolation, multi-tenant fundamentals
- **[nextjs-migration-lessons-learned](code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)** - App Router patterns from production migration
- **[BRAND_VOICE_GUIDE](../../design/BRAND_VOICE_GUIDE.md)** - Component design + styling consistency

---

## Summary

This strategy prevents route duplication through:

1. **Abstraction:** TenantIdentifier union type
2. **Sharing:** Utilities + components (route-agnostic)
3. **Consistency:** Both routes use same utilities
4. **Maintenance:** Fix logic once, works everywhere
5. **Review:** 7-check list catches issues early

**Result:** Dual routes that stay in sync automatically, ~60% code reduction, ~50% faster implementation.

---

## Questions?

- **For implementation help:** See [Quick Checklist](nextjs-route-duplication-quick-checklist.md)
- **For understanding:** See [Prevention Strategy](nextjs-route-duplication-prevention-MAIS-20251228.md)
- **For code review:** See [Review Guidelines](code-review-patterns/nextjs-route-review-guidelines.md)
- **For examples:** Check MAIS codebase pages (all follow this pattern)
