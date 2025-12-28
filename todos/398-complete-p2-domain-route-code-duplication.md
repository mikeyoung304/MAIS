---
status: ready
priority: p2
issue_id: '398'
tags:
  - architecture
  - code-quality
  - code-review
dependencies: ['397']
---

# Code Duplication Between [slug] and \_domain Routes

## Problem Statement

Near-identical page implementations exist for slug-based and domain-based routes. Each page has ~90% code overlap with only the tenant resolution logic differing, creating maintenance burden and drift risk.

## Findings

**Found by:** Architecture Strategist agent

**Duplicated pages:**
| [slug] Route | \_domain Route | Overlap |
|--------------|---------------|---------|
| (site)/page.tsx | page.tsx | ~90% |
| (site)/about/page.tsx | about/page.tsx | ~90% |
| (site)/contact/page.tsx | contact/page.tsx | ~90% |
| (site)/faq/page.tsx | faq/page.tsx | ~90% |
| (site)/services/page.tsx | services/page.tsx | ~90% |
| book/[packageSlug]/page.tsx | book/[packageSlug]/page.tsx | ~90% |

**Difference pattern:**

```typescript
// [slug] route
const tenant = await getTenantStorefrontData(params.slug);

// _domain route
const domain = searchParams.domain as string;
const tenant = await getTenantByDomain(domain);
const [packages, segments] = await Promise.all([...]);
```

**Relative imports crossing boundaries:**

- `_domain/faq/page.tsx` imports from `../../[slug]/(site)/faq/FAQAccordion`
- `_domain/contact/page.tsx` imports from `../../[slug]/(site)/contact/ContactForm`
- `_domain/page.tsx` imports from `../[slug]/(site)/TenantLandingPage`

**Impact:**

- Bug fixes must be applied twice
- Feature additions require double implementation
- Drift between code paths already visible

## Proposed Solutions

### Option 1: Extract shared page content components (Recommended)

- Create `@/components/tenant/pages/` directory
- Extract `AboutPageContent`, `ContactPageContent`, etc.
- Keep route files thin - only tenant resolution + shared component

```tsx
// [slug]/about/page.tsx
const tenant = await getTenantStorefrontData(params.slug);
return <AboutPageContent tenant={tenant} basePath={`/t/${params.slug}`} />;

// _domain/about/page.tsx
const tenant = await getTenantByDomain(domain);
return <AboutPageContent tenant={tenant} basePath="" domainParam={domain} />;
```

**Pros:** DRY, single source of truth, easier maintenance
**Cons:** More files, refactoring effort
**Effort:** Medium
**Risk:** Low

### Option 2: Higher-order page factory

- Create page factory that handles both routing patterns
- Pass tenant resolver as parameter

**Pros:** Very DRY
**Cons:** More abstract, harder to understand
**Effort:** Medium
**Risk:** Medium

## Recommended Action

Option 1 - Extract shared page content components.

## Technical Details

**New files to create:**

- `apps/web/src/components/tenant/pages/AboutPageContent.tsx`
- `apps/web/src/components/tenant/pages/ContactPageContent.tsx`
- `apps/web/src/components/tenant/pages/FAQPageContent.tsx`
- `apps/web/src/components/tenant/pages/ServicesPageContent.tsx`

**Files to move:**

- `FAQAccordion.tsx` → `@/components/tenant/FAQAccordion.tsx`
- `ContactForm.tsx` → `@/components/tenant/ContactForm.tsx`
- `TenantLandingPage.tsx` → `@/components/tenant/TenantLandingPage.tsx`

## Acceptance Criteria

- [ ] Shared page content extracted to components
- [ ] Both route patterns use same content components
- [ ] No relative imports crossing route boundaries
- [ ] TypeScript compiles without errors
- [ ] All pages render correctly for both slug and domain routes

## Work Log

| Date       | Action                                | Learnings                                    |
| ---------- | ------------------------------------- | -------------------------------------------- |
| 2025-12-25 | Created from architecture review      | Route duplication creates maintenance burden |
| 2025-12-25 | **Approved for work** - Status: ready | P2 - Architectural cleanup                   |

## Resources

- Architecture Strategist report
- Next.js App Router patterns documentation
