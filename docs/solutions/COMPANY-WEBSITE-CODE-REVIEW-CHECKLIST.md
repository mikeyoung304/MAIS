# Code Review Checklist: Company vs. Tenant Routing

Use this checklist when reviewing any pull request that modifies pages, routing, or creates new pages in `apps/web/src/app/`.

---

## Pre-Review Checklist

Before reviewing the code, ask the author:

- [ ] **What is this page?** (Company marketing page OR Tenant storefront page)
  - If they can't clearly answer in 1 sentence → Request clarification
- [ ] **Where is it being deployed?** (Root domain OR tenant slug OR custom domain)
- [ ] **Did you test it?** (With actual data, not theoretical)

---

## Code Review Checklist: Company Pages

Use this for any PR modifying `/page.tsx`, `/signup`, `/login`, `/(marketing)/`, etc.

### File Structure Check

```
✓ Location is correct:
  - apps/web/src/app/page.tsx OR
  - apps/web/src/app/(marketing)/features/page.tsx OR
  - apps/web/src/app/signup/page.tsx

✗ NOT under: apps/web/src/app/t/ (that's for tenants!)
```

### Code Content Check

**Search for these - they should NOT be present:**

```typescript
// ✗ WRONG: Tenant database lookup
❌ getTenantBySlug
❌ getTenantByDomain
❌ findTenant
❌ db.tenant.findUnique

// ✗ WRONG: Multi-tenant API calls
❌ api.getPackages() // Missing tenant context!
❌ api.getBookings()
❌ X-Tenant-Key header (not needed for company pages)

// ✗ WRONG: Checking if tenant exists
❌ if (!tenant) notFound()
❌ if (tenant) // implies tenant lookup happened
```

**Examples of what to search for:**

```bash
# In the PR diff, search:
grep "getTenantBySlug\|getTenantByDomain\|db.tenant\|X-Tenant-Key" \
  <changed_file_path>

# Should return NOTHING
```

**Content should be hardcoded:**

```typescript
// ✓ CORRECT: Static arrays of content
const features = [
  { title: 'Website That Works', description: '...' },
  { title: 'Booking & Payments', description: '...' },
];

const tiers = [
  { name: 'Handled', price: '$49', ... },
  { name: 'Fully Handled', price: '$149', ... },
];

// ✓ CORRECT: No database queries
export const metadata = { title: 'HANDLED - Homepage' };
export default function Page() {
  return <HomePage features={features} tiers={tiers} />;
}
```

### Links & Navigation Check

```
✓ Links point to:
  - Other company pages (/features, /pricing, /about)
  - Signup pages (/signup)
  - External links (social media, blog)

✗ Links should NOT:
  - Point to /t/handled (no "handled" tenant!)
  - Reference tenant slugs
  - Redirect to database lookups
```

### Testing Check

```
✓ Testing should verify:
  [ ] Page loads without any database
  [ ] Page works even if all tenants are deleted from database
  [ ] Static content is hardcoded (use snapshots)
  [ ] Links point to correct URLs

Example test:
it('should load without database', async () => {
  const page = await renderPage('/');
  expect(page).toContain('Stay Ahead Without the Overwhelm');
  // No database setup needed
});
```

---

## Code Review Checklist: Tenant Pages

Use this for any PR modifying `/t/[slug]/`, `/t/_domain/`, or tenant-specific routes.

### File Structure Check

```
✓ Location is correct:
  - apps/web/src/app/t/[slug]/(site)/page.tsx OR
  - apps/web/src/app/t/[slug]/(site)/about/page.tsx OR
  - apps/web/src/app/t/_domain/page.tsx OR
  - apps/web/src/app/t/_domain/about/page.tsx

✗ NOT in root: apps/web/src/app/page.tsx
✗ NOT in company sections: apps/web/src/app/(marketing)/
```

### Tenant Lookup - CRITICAL CHECK

**Must have this pattern:**

```typescript
export default async function Page({ params }: Props) {
  // REQUIRED: Fetch tenant
  const tenant = await getTenantBySlug(params.slug);

  // REQUIRED: Handle missing tenant
  if (!tenant) notFound();

  // Then use tenant in all child components
  return <TenantComponent tenant={tenant} />;
}
```

**Search for these in the diff:**

```bash
# Should FIND getTenantBySlug or getTenantByDomain:
✓ MUST EXIST: getTenantBySlug(params.slug)
✓ MUST EXIST: await getTenantByDomain(searchParams.domain)

# Should FIND notFound() call:
✓ MUST EXIST: if (!tenant) notFound()

# Should NOT EXIST without tenant context:
✗ NOT ALLOWED: render components without passing tenant
✗ NOT ALLOWED: API calls without X-Tenant-Key: tenant.apiKeyPublic
```

### Failure Scenarios - Test Coverage

```
✓ Testing should verify:
  [ ] Page 404s when tenant doesn't exist
  [ ] Page loads when tenant exists
  [ ] Correct tenant data shown (isolation test)
  [ ] Multi-tenant data doesn't leak

Example tests:
it('should 404 for non-existent tenant', async () => {
  const { status } = await renderPage('/t/fake-tenant');
  expect(status).toBe(404);
});

it('should load correct tenant data', async () => {
  const tenant = await createTestTenant({ slug: 'test-studio' });
  const page = await renderPage(`/t/test-studio`);
  expect(page).toContain(tenant.name);
  expect(page).not.toContain('OTHER_TENANT_NAME'); // Isolation
});
```

### Multi-Tenant Isolation Check

```
✓ Verify data isolation:
  [ ] Component receives tenant prop
  [ ] All rendered content uses tenant data
  [ ] No hardcoded data from other tenants
  [ ] Cache keys include tenantId

Example:
// ✓ CORRECT: Uses tenant data
<h1>{tenant.name}'s Website</h1>
<h2>{tenant.description}</h2>
<PricingSection packages={tenant.packages} />

// ✗ WRONG: Hardcoded content on tenant page
<h1>Welcome to HANDLED</h1> {/* Breaks isolation! */}
<h2>Our Packages</h2> {/* Should be {tenant.name}'s Packages */}
```

### API Calls Check

```
✓ For any API calls on tenant pages:
  [ ] Uses tenant-specific API key: tenant.apiKeyPublic
  [ ] Includes X-Tenant-Key header
  [ ] Verifies API response is tenant-specific

Example:
const packages = await getTenantPackages(tenant.apiKeyPublic);
// Internally calls: api.getPackages({ 'X-Tenant-Key': tenant.apiKeyPublic })
```

---

## Combined Checklist: Both Types

Use this for PRs that touch both company and tenant pages.

### Separation of Concerns

```
✓ Each file is clearly one type:
  [ ] No file mixes company logic with tenant logic
  [ ] No shared components that assume tenant lookup
  [ ] Services/utilities separate: company utils vs. tenant utils

✗ Examples of BAD mixing:
  - Component that calls getTenantBySlug but also renders static content
  - Page that has if/else for "company" vs "tenant" mode
  - Shared component hardcoding company content
```

### Router Middleware Check

```
✓ In middleware.ts:
  [ ] KNOWN_DOMAINS includes all company domains
  [ ] Custom domains (tenant) route to /t/_domain
  [ ] Company domains use normal routing (no /t/ rewrite)

Current KNOWN_DOMAINS:
  - gethandled.ai
  - www.gethandled.ai
  - app.gethandled.ai
  - localhost
  - *.vercel.app

✓ Adding new domain? Add to KNOWN_DOMAINS if it's company-owned
```

---

## Database Validation

After code review, validator should check:

```bash
# Check: No company tenants in database
cd server
npm exec prisma studio

Tenant table should NOT contain:
  ✗ slug: 'handled'
  ✗ slug: 'company'
  ✗ slug: 'maconaisolutions'
  ✗ slug: 'app'
  ✗ slug: 'gethandled'

These are company domains. Use static pages instead.
```

---

## Testing Verification

Before approving the PR:

### For Company Pages
```bash
# Run tests
npm run test:e2e -- company-pages.spec.ts

# Manual test: Does it work with no database?
NEXT_PUBLIC_SKIP_DB=true npm run dev:web
# Visit /, /features, /pricing
# All should work without database connection
```

### For Tenant Pages
```bash
# Run tests
npm run test:e2e -- tenant-pages.spec.ts

# Manual test: Valid tenant
npm run create-tenant # Creates test tenant
npm run dev:web
Visit /t/test-tenant # Should work

# Manual test: Invalid tenant
Visit /t/nonexistent-xyz # Should 404
```

---

## Common Issues to Catch

### Issue 1: Missing Tenant Lookup

**Red Flag:**
```typescript
// ✗ WRONG: /t/[slug] page without tenant lookup
export default function TenantPage({ params }: Props) {
  return <HeroSection title="Welcome" />;
}
```

**Fix:**
```typescript
// ✓ CORRECT: Fetch tenant first
export default async function TenantPage({ params }: Props) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  return <HeroSection tenant={tenant} />;
}
```

### Issue 2: Database Lookup in Company Page

**Red Flag:**
```typescript
// ✗ WRONG: Root page queries database
export default async function HomePage() {
  const features = await db.feature.findMany();
  // This should be hardcoded!
  return <HomePage features={features} />;
}
```

**Fix:**
```typescript
// ✓ CORRECT: Hardcode company content
const FEATURES = [
  { title: 'Website That Works', ... },
  // ...
];

export default function HomePage() {
  return <HomePage features={FEATURES} />;
}
```

### Issue 3: Creating Company Tenant

**Red Flag (in commit message or DB):**
```
Created tenant with slug 'handled' for company homepage
```

**Why it's wrong:**
- Makes homepage depend on database
- If tenant is deleted, homepage breaks
- Violates separation of concerns

**Solution:**
- Delete the tenant
- Use static `/page.tsx` instead
- Document why company is NOT a tenant

---

## Sign-Off Checklist

Before marking PR as approved:

- [ ] **Type verified**: I confirmed this is [COMPANY|TENANT] content
- [ ] **Database lookups correct**:
  - Company pages: No tenant lookups
  - Tenant pages: Has `getTenantBySlug` + `notFound()`
- [ ] **No hardcoded company content** on tenant pages
- [ ] **No database entries** for company domains
- [ ] **Testing verified**: Relevant tests pass
- [ ] **Multi-tenant isolation**: No data leakage between tenants
- [ ] **Middleware updated** (if new domains added)
- [ ] **No infinite redirects** or circular dependencies

---

## Questions for Author (If Unsure)

```
1. "What happens if I delete this tenant from the database?
   Does the page still work?"
   - If YES → It's company content, should not use /t/ routing
   - If NO → It's tenant content, /t/ routing is correct

2. "Who controls this content?
   Is it HANDLED marketing or a specific tenant?"
   - If HANDLED → Use static pages or hardcode
   - If Tenant → Use /t/ routing with tenant lookup

3. "Can you show me a test that verifies this page
   works without any tenants in the database?"
   - Company pages: Should pass this test
   - Tenant pages: Should 404 this test
```

---

## References

- **Prevention Guide**: `docs/solutions/COMPANY-WEBSITE-TENANT-CONFUSION-PREVENTION.md`
- **Quick Check**: `docs/solutions/COMPANY-VS-TENANT-QUICK-CHECK.md`
- **Architecture**: `ARCHITECTURE.md` (Dual Routing Pattern)
- **App Structure**: `apps/web/README.md`

