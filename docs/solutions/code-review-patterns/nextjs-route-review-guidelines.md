# Next.js Route Duplication: Code Review Guidelines

**Purpose:** Code reviewer checklist for preventing route duplication in dual-route implementations
**Use when:** Reviewing PRs that modify tenant pages in both [slug] and \_domain routes
**Time to review:** ~5 minutes per page (using this checklist)

---

## Pre-Review: Understand the Pattern

The MAIS codebase uses a **TenantIdentifier union type pattern** to reduce duplication:

```typescript
// One type handles both routes
type TenantIdentifier = { type: 'slug'; slug: string } | { type: 'domain'; domain: string };

// Both [slug] and _domain routes convert their params to this type:
// [slug]:   { type: 'slug', slug: params.slug }
// _domain:  { type: 'domain', domain: searchParams.domain }

// Then use shared utilities:
const context = await checkPageAccessible(identifier, 'pageName');
```

**If PR doesn't use this pattern → request refactoring.**

---

## Review Checklist: 7 Critical Checks

Use this checklist for every PR affecting dual routes.

### Check 1: Shared Utilities Used (Critical)

**Question:** Do both routes use the SAME utility functions?

Look for:

```typescript
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';
```

**Flag if:**

- One route uses `resolveTenant()`, other uses `getTenantBySlug()`
- Logic differs between [slug] and \_domain implementations
- Custom tenant resolution code instead of utility functions

**Request:**

```
Please refactor to use shared utilities from tenant-page-utils.ts.
This ensures both routes stay in sync.
```

---

### Check 2: TenantIdentifier Union Type (Critical)

**Question:** Is TenantIdentifier created correctly in both routes?

**[slug] route should have:**

```typescript
const identifier: TenantIdentifier = { type: 'slug', slug };
```

**\_domain route should have:**

```typescript
const identifier: TenantIdentifier = { type: 'domain', domain };
```

**Flag if:**

- TenantIdentifier not used (passing slug/domain directly)
- Type cast (`as TenantIdentifier`) instead of proper construction
- Conditional logic to choose route type in component

**Request:**

```
Use the TenantIdentifier union type to abstract route differences.
This keeps the identifier type-safe and prevents route-specific logic in utilities.
```

---

### Check 3: Component Props Don't Know Routes (Critical)

**Question:** Does the shared content component receive route-agnostic props?

**Good:** Component accepts abstract props

```typescript
interface AboutPageContentProps {
  tenant: TenantPublicDto;
  basePath: string; // '/t/slug' or ''
  domainParam?: string; // '?domain=...' or undefined
}
```

**Bad:** Component receives route-specific props

```typescript
interface AboutPageContentProps {
  slug?: string;
  domain?: string;
  routeType: 'slug' | 'domain';
}
```

**Flag if:**

- Component accepts `slug`, `domain`, or `routeType` props
- Component imports `usePathname()` or `useSearchParams()` to determine route
- Component has conditional logic: `if (routeType === 'slug')`
- Component generates its own routes: `href={`/t/${slug}/services`}`

**Request:**

```
Components shouldn't know which route they're running on.

Instead of:
  <Component slug={slug} />

Use:
  <Component basePath={basePath} domainParam={domainParam} />

This keeps components portable across routing strategies.
```

---

### Check 4: All Links Use basePath + domainParam (Critical)

**Question:** Do all internal links include both basePath and domainParam?

**Correct pattern:**

```typescript
const servicesLink = `${basePath}/services${domainParam || ''}`;
return <Link href={servicesLink}>View Services</Link>;
```

**Incorrect patterns:**

```typescript
// Hard-coded route
<Link href="/services">View Services</Link>

// Only basePath (loses domain query param)
<Link href={`${basePath}/services`}>View Services</Link>

// Slug-specific
<Link href={`/t/${slug}/services`}>View Services</Link>

// Domain-specific
<Link href={`/services?domain=${domain}`}>View Services</Link>
```

**How to check:**

1. Search component file for `href=`
2. Verify every link includes `${basePath}` and `${domainParam || ''}`
3. Search for hardcoded `/t/` or `/services` - these are red flags

**Flag if:**

- Any `href` missing `basePath` prefix
- Any `href` missing `domainParam` append
- Hardcoded route patterns found

**Request:**

```
All links must respect the routing abstraction:

href={`${basePath}/services${domainParam || ''}`}

This ensures links work on both [slug] and _domain routes.
Currently, domain route links are missing the ?domain query param.
```

---

### Check 5: Domain Guard in \_domain Route (Critical)

**Question:** Does the \_domain route check domain param exists?

**generateMetadata should guard:**

```typescript
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'About | Business Not Found', robots: { index: false, follow: false } };
  }
  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'about');
}
```

**Page function should guard:**

```typescript
export default async function AboutPage({ searchParams }: Props) {
  const { domain } = await searchParams;
  if (!domain) {
    notFound();
  }
  const identifier: TenantIdentifier = { type: 'domain', domain };
  const context = await checkPageAccessible(identifier, 'about');
  if (!context) notFound();
  return <AboutPageContent {...} />;
}
```

**Flag if:**

- Domain guard missing in `generateMetadata`
- Domain guard missing in page function
- Guard doesn't return `notFound()` or fallback metadata
- Guard happens AFTER identifier creation

**Request:**

```
Domain parameter guard is missing or in wrong place.

Domain must be checked:
1. First in generateMetadata, returning noindex fallback
2. First in page function, calling notFound()

Without this, requests like /t/_domain/about (no ?domain param)
would generate metadata for undefined domain (SEO issue).
```

---

### Check 6: Error Handling Consistency (Important)

**Question:** Do both routes handle errors identically?

**Correct:**

```typescript
// [slug]/error.tsx
export default function AboutError({ error, reset }: Props) {
  return <TenantErrorBoundary error={error} reset={reset} context="about" />;
}

// _domain/error.tsx
export default function AboutError({ error, reset }: Props) {
  return <TenantErrorBoundary error={error} reset={reset} context="about (domain)" />;
}
```

**Incorrect:**

```typescript
// [slug]/error.tsx uses component
return <TenantErrorBoundary {...} />;

// _domain/error.tsx renders custom UI
return <div>Error occurred</div>;
```

**Flag if:**

- One route uses error boundary, other shows custom UI
- Error handling logic differs between routes
- Different status codes or error messages returned
- One uses `notFound()`, other uses error boundary

**Request:**

```
Both routes should handle errors consistently.

Use TenantErrorBoundary in both error.tsx files.
Difference should only be context string for logging:
- [slug]: context="pageName"
- _domain: context="pageName (domain)"
```

---

### Check 7: ISR Revalidation Configured (Important)

**Question:** Is ISR revalidation set for performance?

**Correct:**

```typescript
export default async function AboutPage(props) {
  // ...
  return <AboutPageContent {...} />;
}

export const revalidate = 60;  // ISR cache for 60 seconds
```

**Flag if:**

- `revalidate` not exported
- Different revalidate times between [slug] and \_domain
- Commented out or removed
- Set to 0 (forces full dynamic rendering every request)

**Request:**

```
Missing ISR revalidation configuration.

Add: export const revalidate = 60;

This enables Next.js Incremental Static Regeneration,
reducing load on tenant resolution on every request.
Both routes should use same revalidate value.
```

---

## Secondary Checks: Code Quality

### Context Passing (Good to Have)

**Check:** Is context passed correctly from page to component?

```typescript
// Correct pattern
const context = await checkPageAccessible(identifier, 'about');
if (!context) notFound();
return <AboutPageContent tenant={context.tenant} basePath={context.basePath} />;
```

**Issues to flag:**

- Context fields renamed before passing to component
- Additional data fetching in page component (should be in utility)
- Component receives full context object instead of selective props

**Suggestion:**

```
Pass only needed props from context:
  tenant: context.tenant
  basePath: context.basePath
  domainParam: context.domainParam

Avoid passing entire context object to keep props explicit.
```

---

### Metadata Consistency (Good to Have)

**Check:** Is metadata generation identical in both routes?

```typescript
// Both should call same utility
export async function generateMetadata(props: Props): Promise<Metadata> {
  // Extract identifier from params/searchParams
  const identifier: TenantIdentifier = { ... };
  // Call shared utility
  return generateTenantPageMetadata(identifier, 'pageName');
}
```

**Issues to flag:**

- Different metadata logic between routes
- Custom metadata generation instead of using utility
- Missing OpenGraph tags

**Suggestion:**

```
Use generateTenantPageMetadata utility for both routes.
This ensures consistent SEO metadata and page titles.
```

---

### Testing Coverage (Nice to Have)

**Check:** Are both routes tested?

Look for test files like:

- `/e2e/tenant-pages.spec.ts` - Both routes tested
- `/lib/tenant-page-utils.test.ts` - Utilities tested

**Issues to flag:**

- Only [slug] route tested, not \_domain
- E2E tests don't verify query params on domain route
- No link validation in tests

**Suggestion:**

```
Add E2E test for _domain route:
  - Verify page loads with ?domain param
  - Verify internal links include ?domain param
  - Verify 404 when ?domain param missing
  - Verify metadata correct for domain route

This ensures both routes stay in sync as code evolves.
```

---

## Review Flow: Decision Tree

```
Is this PR changing a tenant page?
├─ No → Use standard review process
└─ Yes → Does it affect both [slug] and _domain routes?
         ├─ No → Use standard review
         └─ Yes → Run checklist above (7 critical checks)
                  ├─ All 7 pass? → Approve ✅
                  ├─ Any fail? → Request changes with specific message
                  └─ Unclear? → Ask for clarification
```

---

## Common Review Comments

Copy these into your review to save time:

### Shared Utilities Missing

````markdown
Components shouldn't duplicate tenant resolution logic.

Instead of implementing resolution in both routes, please:

1. Add utility function to `/lib/tenant-page-utils.ts`:
   ```typescript
   export async function checkPageAccessible(
     identifier: TenantIdentifier,
     pageName: 'pageName'
   ): Promise<ResolvedTenantContext | null> {
     const result = await resolveTenant(identifier);
     if (!result.success) return null;
     if (!isPageEnabled(result.data.config, pageName)) return null;
     return result.data;
   }
   ```
````

2. Use in both routes:
   ```typescript
   const context = await checkPageAccessible(identifier, 'pageName');
   ```

This ensures both routes use identical logic and stay in sync.

````

### Component Has Route Awareness

```markdown
Components should not know which route they're running on.

Instead of:
```typescript
interface Props {
  slug?: string;
  domain?: string;
}

export function AboutPageContent({ slug, domain }: Props) {
  const baseUrl = slug ? `/t/${slug}` : '';
  return <Link href={`${baseUrl}/services`}>Services</Link>;
}
````

Use:

```typescript
interface Props {
  basePath: string;           // '/t/slug' or ''
  domainParam?: string;       // '?domain=...' or undefined
}

export function AboutPageContent({ basePath, domainParam = '' }: Props) {
  return <Link href={`${basePath}/services${domainParam}`}>Services</Link>;
}
```

This keeps components portable and reduces conditional logic.

````

### Domain Guard Missing

```markdown
Domain parameter guard is missing in _domain route.

The _domain route requires special handling because `domain` comes from URL params.

Add guard in both places:

1. generateMetadata:
```typescript
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'About | Business Not Found', robots: { index: false, follow: false } };
  }
  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'about');
}
````

2. Page function:

```typescript
export default async function AboutPage({ searchParams }: Props) {
  const { domain } = await searchParams;
  if (!domain) notFound(); // ← Guard here
  const identifier: TenantIdentifier = { type: 'domain', domain };
  // ... rest of function
}
```

Without this, /t/\_domain/about (missing ?domain param) would try to load
a tenant with undefined domain, causing errors or unexpected behavior.

````

### domainParam Not Passed

```markdown
Domain query param not propagated to component.

The _domain route needs to pass `domainParam` to all sub-pages.

Change:
```typescript
<AboutPageContent tenant={context.tenant} basePath={context.basePath} />
````

To:

```typescript
<AboutPageContent
  tenant={context.tenant}
  basePath={context.basePath}
  domainParam={context.domainParam}  // ← Add this
/>
```

Then in component, append to all links:

```typescript
<Link href={`${basePath}/services${domainParam || ''}`}>Services</Link>
```

This ensures users navigating on the domain route stay on the domain route.

````

### Hardcoded Routes in Component

```markdown
Component has hardcoded routes. This breaks on _domain routes.

Find and replace all hardcoded routes in the component:

```typescript
// WRONG:
<Link href="/services">Services</Link>
<Link href={`/t/${slug}/services`}>Services</Link>
<Link href={`/t/${tenant.slug}/services`}>Services</Link>

// RIGHT:
<Link href={`${basePath}/services${domainParam || ''}`}>Services</Link>
````

The component should never know about [slug] or \_domain routes.
It should only use props passed to it (basePath, domainParam).

```

---

## Approval Criteria

Approve PR only if:

- [x] Both routes use shared utilities (not duplicated logic)
- [x] TenantIdentifier type used for route abstraction
- [x] Components accept basePath + domainParam, not slug/domain
- [x] All internal links use `${basePath}${domainParam || ''}`
- [x] _domain route has domain guard in both places
- [x] Error handling identical between routes
- [x] ISR revalidation configured
- [x] Tests cover both routes (if modified)

---

## See Also

- **Full Pattern Guide:** `/docs/solutions/nextjs-route-duplication-prevention-MAIS-20251228.md`
- **Quick Checklist:** `/docs/solutions/nextjs-route-duplication-quick-checklist.md`
- **Real Examples:** `/apps/web/src/app/t/[slug]/(site)/about/page.tsx` vs `/apps/web/src/app/t/_domain/about/page.tsx`

---

## Reference: Pattern Files

Key files implementing this pattern in MAIS:

| File | Purpose |
|------|---------|
| `/lib/tenant-page-utils.ts` | TenantIdentifier type + shared utilities |
| `/lib/tenant.ts` | Tenant data fetching functions |
| `/components/tenant/TenantErrorBoundary.tsx` | Shared error boundary |
| `/components/tenant/[Page]PageContent.tsx` | Shared content components |
| `/app/t/[slug]/(site)/[page]/page.tsx` | [slug] route template |
| `/app/t/[slug]/(site)/[page]/error.tsx` | [slug] error boundary template |
| `/app/t/_domain/[page]/page.tsx` | _domain route template |
| `/app/t/_domain/[page]/error.tsx` | _domain error boundary template |

All pages (about, services, contact, faq, gallery, testimonials) follow this pattern.
```
