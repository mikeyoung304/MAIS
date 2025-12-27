# Company Website vs. Tenant Storefront Confusion Prevention

**Problem:** The HANDLED marketing homepage was mistakenly configured as a tenant redirect (`/t/handled`) instead of a proper static marketing page, causing 404 errors because the "handled" tenant didn't exist in the database.

**Root Cause:** Architectural confusion between two distinct routing concepts:
1. **Tenant Storefronts**: Dynamic user-created websites for service professionals
2. **Company Marketing Site**: Static HANDLED platform landing page

This document prevents future confusion through architectural clarity and testing.

---

## Part 1: Architectural Decision Framework

### What Type of Content Are You Building?

#### Tenant Storefront (Use `/t/[slug]/` routing)

**Characteristics:**
- **Dynamic & User-Created**: Each tenant (photographer, therapist, coach) gets a unique storefront
- **Data-Driven**: Content comes from database (packages, testimonials, gallery images)
- **Tenant-Specific**: Navigation, branding, and content vary by tenant
- **Business Model**: Tenants manage their own pages via admin dashboard
- **Example URLs**: `/t/jane-photography`, `/t/dr-smith-therapy`, `/t/wedding-planner-co`

**Requires:**
- Valid tenant in database with `slug` matching URL
- `tenantId` in all database queries (multi-tenant isolation)
- Tenant configuration (branding, pages, sections)
- API keys for client-side data fetching

**Pattern:**
```typescript
// apps/web/src/app/t/[slug]/(site)/page.tsx
async function TenantPage({ params }: { params: { slug: string } }) {
  // Fetch tenant by slug - MUST exist in database
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound(); // 404 if tenant doesn't exist

  // Render tenant-specific content
  return <TenantLandingPage tenant={tenant} />;
}
```

---

#### Company Marketing Site (Use Static Page or `(marketing)/` group)

**Characteristics:**
- **Static & Company-Owned**: Single landing page for the HANDLED platform itself
- **No Multi-Tenant Data**: No database lookup needed
- **Fixed Content**: Features, pricing tiers, brand messaging
- **Marketing Purpose**: Acquire customers, explain product, link to signup
- **Example URLs**: `/`, `/features`, `/pricing`

**Does NOT require:**
- Tenant lookup or database query
- Multi-tenant data scoping
- Tenant configuration
- API keys or authentication

**Pattern (Current):**
```typescript
// apps/web/src/app/page.tsx - Root marketing page
export default function HomePage() {
  // Static content, no database lookups
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <CTASection />
    </main>
  );
}
```

**Alternative Pattern (If Marketing Grows):**
```typescript
// apps/web/src/app/(marketing)/page.tsx - Grouped marketing routes
// (marketing)/features/page.tsx
// (marketing)/pricing/page.tsx
// (marketing)/about/page.tsx

// This organizes marketing content separately from tenant routes
```

---

### Key Distinction Matrix

| Aspect | Tenant Storefront | Company Marketing |
|--------|-------------------|-------------------|
| **URL Pattern** | `/t/[slug]`, `/t/_domain` | `/`, `/(marketing)/...` |
| **Database Lookup** | REQUIRED (`getTenantBySlug`) | NOT NEEDED |
| **Tenant Exists Check** | Must exist (else 404) | Not applicable |
| **Content Source** | Tenant config in DB | Static files/code |
| **Data Scoping** | All queries by `tenantId` | No multi-tenant logic |
| **Admin Control** | Tenant dashboard | Developer-managed |
| **Dynamic Sections** | Yes (hero, gallery, etc.) | Hardcoded components |
| **Custom Styling** | Per-tenant branding | Fixed brand colors |
| **Example** | `/t/jane-photography/about` | `/`, `/about` |

---

## Part 2: Code Review Checklist

Use this checklist when reviewing any new page or routing changes:

### Before Code Review

**Reviewer asks: "Is this page company content or tenant content?"**

- [ ] **I can clearly answer** which type this is (if not, ask author for clarification)
- [ ] **URL pattern matches type**:
  - Tenant content: Uses `/t/[slug]/` or `/t/_domain/` routing
  - Company content: Uses static paths or `(marketing)/` grouping
- [ ] **No database tenant lookup** in company pages (like root `/page.tsx`)
- [ ] **Tenant pages ALWAYS lookup** tenant first, handle 404 if not found

### During Code Review

#### For Tenant Pages (`/t/[slug]/`)

**Verify these exist:**

```typescript
// ✓ REQUIRED: Fetch tenant
const tenant = await getTenantBySlug(params.slug);

// ✓ REQUIRED: 404 if not found
if (!tenant) notFound();

// ✓ REQUIRED: Pass tenant to components
<TenantComponent tenant={tenant} />
```

**Verify these are NOT present:**

```typescript
// ✗ WRONG: Hardcoded content
<h1>Welcome to HANDLED</h1> {/* This should be tenant-specific */}

// ✗ WRONG: API calls without tenantId
const packages = await api.getPackages(); // Missing X-Tenant-Key header

// ✗ WRONG: Rendering static sections
<FeaturesList features={HANDLED_FEATURES} /> {/* Should be tenant config */}
```

#### For Company Pages (`/page.tsx`, `/(marketing)/`)

**Verify these are present:**

```typescript
// ✓ CORRECT: Static content, no tenant lookup
export const metadata = { title: 'HANDLED - Stay Ahead Without the Overwhelm' };

// ✓ CORRECT: Hardcoded features, pricing, CTAs
const features = [
  { title: 'Website That Works', ... },
  { title: 'Booking & Payments', ... },
];

// ✓ CORRECT: Links to signup (for acquiring new tenants)
<a href="/signup">Get Started</a>
```

**Verify these are NOT present:**

```typescript
// ✗ WRONG: Tenant database lookup in homepage
const tenant = await getTenantBySlug('handled');

// ✗ WRONG: Multi-tenant API calls
const tenants = await api.getTenants({ X-Tenant-Key: ... });

// ✗ WRONG: Dynamic page based on database config
const config = await db.tenantConfig.findUnique({ ... });
```

---

## Part 3: Pre-Deployment Checklist

### Preventing "Company is Not a Tenant" Errors

**Before deploying any routing changes:**

1. **Identify Route Type**
   - [ ] I can explain in 1 sentence whether this is tenant or company content
   - [ ] URL pattern matches the content type (see Key Distinction Matrix above)

2. **Tenant Routes Only** (`/t/[slug]/` and `/t/_domain/`)
   - [ ] Code includes tenant lookup: `getTenantBySlug()` or `getTenantByDomain()`
   - [ ] 404 handler present: `if (!tenant) notFound()`
   - [ ] Tenant data passed to all components
   - [ ] All API calls include proper `X-Tenant-Key` header
   - [ ] Tested with a valid tenant (create one with `npm run create-tenant` if needed)
   - [ ] Tested with invalid tenant slug → confirms 404 behavior

3. **Company Routes Only** (`/page.tsx`, `/(marketing)/`)
   - [ ] No tenant database lookup
   - [ ] No multi-tenant API calls
   - [ ] Static content (hardcoded, not from tenant config)
   - [ ] Links properly direct to signup or other marketing pages
   - [ ] Tested without any tenant existing in database

4. **Middleware Configuration**
   - [ ] `KNOWN_DOMAINS` in `middleware.ts` includes all company domains
   - [ ] Custom domains route to `/t/_domain` (tenant routes), not company routes
   - [ ] Company domain `gethandled.ai` uses normal routing (not `/t/` rewrite)

5. **Never Create "Company Tenants"**
   - [ ] Database does NOT contain a tenant with slug `handled` or `company` or `gethandled`
   - [ ] Root domain routes are static pages, not `/t/[slug]` redirects
   - [ ] Marketing content uses hardcoded components, not tenant configuration

---

## Part 4: Testing Strategies

### Unit Test: Verify Route Type

```typescript
// __tests__/routing.test.ts

describe('Route Type Identification', () => {
  test('Company pages (root) should not query database for tenant', async () => {
    // Test that / does not call getTenantBySlug
    const mockedGetTenant = vi.fn();
    vi.stubGlobal('getTenantBySlug', mockedGetTenant);

    // Navigate to root
    // Assert getTenantBySlug was NOT called
    expect(mockedGetTenant).not.toHaveBeenCalled();
  });

  test('Tenant pages (/t/[slug]) MUST query database for tenant', async () => {
    const mockedGetTenant = vi.fn().mockResolvedValue(null);

    // Render /t/jane-photography
    // Assert getTenantBySlug('jane-photography') was called
    expect(mockedGetTenant).toHaveBeenCalledWith('jane-photography');
  });
});
```

### E2E Test: Verify URL Routing

```typescript
// e2e/routing.spec.ts

test.describe('Tenant Storefront Routing', () => {
  test('should 404 when tenant does not exist', async ({ page }) => {
    await page.goto('/t/nonexistent-tenant');

    // Should show 404 error, not database error
    const heading = page.locator('h1');
    expect(heading).toContainText(/404|Not Found/i);
  });

  test('should load when valid tenant exists', async ({ page }) => {
    // Create test tenant first
    const testTenant = await createTestTenant({ slug: 'test-studio' });

    await page.goto('/t/test-studio');

    // Should show tenant page, not 404
    const heading = page.locator('h1');
    expect(heading).toContainText(testTenant.name);
  });
});

test.describe('Company Marketing Pages', () => {
  test('should load root without any tenant lookup', async ({ page }) => {
    // Clear all database (optional, for isolation)
    // Root page should load regardless
    await page.goto('/');

    const heading = page.locator('h1');
    expect(heading).toContainText('Stay Ahead Without the Overwhelm');
  });

  test('pricing page should show all tiers statically', async ({ page }) => {
    await page.goto('/');

    // Look for pricing section (hardcoded, not from database)
    expect(page.locator('text=Handled')).toBeVisible();
    expect(page.locator('text=Fully Handled')).toBeVisible();
    expect(page.locator('text=Completely Handled')).toBeVisible();
  });
});
```

### Integration Test: Verify Multi-Tenant Isolation

```typescript
// __tests__/multi-tenant-pages.test.ts

describe('Multi-Tenant Routing', () => {
  test('each tenant slug should load correct tenant data', async () => {
    const tenant1 = await createTestTenant({ slug: 'photographer-one' });
    const tenant2 = await createTestTenant({ slug: 'photographer-two' });

    // Visit tenant1 page
    const page1 = await renderPage(`/t/${tenant1.slug}`);
    expect(page1).toContainText(tenant1.name);
    expect(page1).not.toContainText(tenant2.name); // Isolation!

    // Visit tenant2 page
    const page2 = await renderPage(`/t/${tenant2.slug}`);
    expect(page2).toContainText(tenant2.name);
    expect(page2).not.toContainText(tenant1.name); // Isolation!
  });

  test('company page should not expose any tenant data', async () => {
    const tenant = await createTestTenant({ slug: 'hidden-studio' });

    // Visit root page
    const page = await renderPage('/');

    // Should not see tenant data
    expect(page).not.toContainText(tenant.name);
    expect(page).not.toContainText(tenant.slug);

    // Should see company content
    expect(page).toContainText('HANDLED');
    expect(page).toContainText('Stay Ahead Without the Overwhelm');
  });
});
```

---

## Part 5: Real-World Scenarios & Patterns

### Scenario 1: Adding a New Company Page

**Goal:** Add a `/features` page to the HANDLED marketing site

**CORRECT Approach:**

```typescript
// apps/web/src/app/features/page.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features - HANDLED',
  description: 'Everything you get with HANDLED membership',
};

// Hardcoded features for marketing
const FEATURES = [
  { title: 'Website That Works', description: '...' },
  { title: 'Booking & Payments', description: '...' },
  // ...
];

export default function FeaturesPage() {
  return (
    <main>
      <h1>What You Get</h1>
      <div className="features-grid">
        {FEATURES.map(feature => (
          <div key={feature.title}>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
```

**Pattern Checklist:**
- ✓ Static URL (`/features`, not `/t/...`)
- ✓ Hardcoded content (FEATURES array, not database)
- ✓ No tenant lookup
- ✓ No X-Tenant-Key header needed
- ✓ Works even if no tenants exist in database

**WRONG Approach (DO NOT DO THIS):**

```typescript
// ✗ WRONG: Trying to use tenants as content
export default async function FeaturesPage() {
  // This won't work - no "features" tenant!
  const tenant = await getTenantBySlug('features');
  if (!tenant) notFound(); // Will 404

  return <TenantLandingPage tenant={tenant} />;
}
```

---

### Scenario 2: Adding a New Tenant Page

**Goal:** Add `/services` page to tenant storefronts

**CORRECT Approach:**

```typescript
// apps/web/src/app/t/[slug]/(site)/services/page.tsx
import { getTenantBySlug, getTenantPackages } from '@/lib/tenant';

export async function generateMetadata({ params }: Props) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  return {
    title: `Services - ${tenant.name}`,
  };
}

export default async function ServicesPage({ params }: Props) {
  // REQUIRED: Fetch tenant
  const tenant = await getTenantBySlug(params.slug);

  // REQUIRED: 404 if not found
  if (!tenant) notFound();

  // Fetch tenant-specific packages
  const packages = await getTenantPackages(tenant.apiKeyPublic);

  return (
    <main>
      <TenantNav tenant={tenant} />
      <h1>{tenant.name}'s Services</h1>
      <PackageGrid packages={packages} />
      <TenantFooter tenant={tenant} />
    </main>
  );
}
```

**Pattern Checklist:**
- ✓ Uses `/t/[slug]/` routing
- ✓ Calls `getTenantBySlug(params.slug)`
- ✓ Handles 404 with `notFound()`
- ✓ Uses tenant data in all components
- ✓ Fetches tenant-specific packages

---

### Scenario 3: Updating Middleware for New Company Domain

**Goal:** Add new company domain `maconaisolutions.com`

**CORRECT Approach:**

```typescript
// apps/web/src/middleware.ts

// Add company domain to KNOWN_DOMAINS
const KNOWN_DOMAINS = [
  'gethandled.ai',
  'www.gethandled.ai',
  'app.gethandled.ai',
  'maconaisolutions.com',     // ← Add here
  'www.maconaisolutions.com', // ← Add here
  'vercel.app',
  'localhost',
];

// This ensures:
// - gethandled.ai/pricing → /pricing (company page)
// - mysubcompany.com/about → /t/_domain/about?domain=mysubcompany.com (custom domain)
```

**Key Point:** Only add to `KNOWN_DOMAINS` if it's a company domain. Everything else routes to `/t/_domain` for custom tenant domains.

---

## Part 6: Common Mistakes & Fixes

### Mistake 1: Creating a "Company Tenant" in Database

**What Happens:**
```typescript
// Database has: { id: 1, slug: 'handled', name: 'HANDLED Platform' }
// Root page tries: await getTenantBySlug('handled');
// This queries the database instead of using static content!
```

**Why It's Wrong:**
- Marketing content becomes tied to database
- Tenant deletion breaks company homepage
- Multi-tenant isolation rules applied to company content
- Cache pollution (company content cached with tenant key)

**Fix:**
- Delete the tenant from database
- Use static pages, never tenant routes for company content
- Separate concerns: company = static, tenants = dynamic

### Mistake 2: Hardcoding `X-Tenant-Key` in Company Pages

**What Happens:**
```typescript
// Company page hardcodes a tenant key
const response = await fetch('/v1/packages', {
  headers: {
    'X-Tenant-Key': 'pk_live_mycompany_xyz', // ✗ Hardcoded!
  },
});
```

**Why It's Wrong:**
- Exposes API key in client-side code
- If key rotates, page breaks
- Could leak data if key compromised

**Fix:**
- Company pages don't need API keys
- Use static content for marketing pages
- Only fetch API data in tenant pages (with tenant-specific keys)

### Mistake 3: Infinite Redirects with Tenant Routes

**What Happens:**
```typescript
// Root page redirects to /t/handled
// Middleware or code tries to create a tenant named "handled"
// But if that tenant is deleted, 404 occurs
```

**Why It's Wrong:**
- Adds dependency on database for static content
- Creates failure point (missing tenant = broken homepage)
- Violates separation of concerns

**Fix:**
- Root page is static (no redirect needed)
- Company content stands alone
- Redirect only in special cases (with strong justification)

---

## Part 7: Quick Reference: By Component Type

### Adding to Root App (`/page.tsx`)

**Use this:**
- Hardcoded content
- No `getTenantBySlug` call
- Static features/pricing/CTAs
- Example: `src/app/page.tsx`

**Don't use this:**
- Tenant lookups
- Database queries (except logging/tracking)
- Tenant-specific data

### Adding to Tenant Storefront (`/t/[slug]/`)

**Use this:**
- `getTenantBySlug(params.slug)`
- `notFound()` if tenant not found
- Tenant-specific content
- Example: `src/app/t/[slug]/(site)/page.tsx`

**Don't use this:**
- Hardcoded company messaging
- Skipping tenant existence check
- API calls without X-Tenant-Key

### Adding to Custom Domains (`/t/_domain/`)

**Use this:**
- `getTenantByDomain(searchParams.domain)`
- Same pattern as slug-based routes
- Verify domain ownership
- Example: `src/app/t/_domain/page.tsx`

**Don't use this:**
- Direct tenant slug references
- Skipping domain validation

---

## Part 8: Implementation Verification

### How to Verify This is Implemented

**Check 1: Database State**
```bash
# Verify no company tenant exists
cd server
npm exec prisma studio

# Look at Tenant table - should NOT have:
# - slug: 'handled'
# - slug: 'company'
# - slug: 'maconaisolutions'
```

**Check 2: Root Page Code**
```bash
# Verify /page.tsx is static
grep -n "getTenantBySlug\|getHandledTenant\|db.tenant" \
  apps/web/src/app/page.tsx
# Should return nothing - no tenant lookups in root page
```

**Check 3: Tenant Page Code**
```bash
# Verify /t/[slug] has tenant lookup
grep -n "getTenantBySlug" \
  apps/web/src/app/t/\[slug\]/\(site\)/page.tsx
# Should return match - tenant lookup required
```

**Check 4: Middleware Domains**
```bash
# Verify company domains are in KNOWN_DOMAINS
grep -A 10 "const KNOWN_DOMAINS" apps/web/src/middleware.ts

# Should include:
# - gethandled.ai
# - www.gethandled.ai
# - app.gethandled.ai
# - maconaisolutions.com (if applicable)
```

---

## Summary: The Mental Model

Think of MAIS as having **two distinct routing systems**:

### System 1: Company Marketing (Static)
- **Where:** Root app, static pages
- **URLs:** `/`, `/features`, `/pricing`
- **Content:** Hardcoded in components
- **Database:** No tenant lookup needed
- **Purpose:** Acquire customers for HANDLED

### System 2: Tenant Storefronts (Dynamic)
- **Where:** `/t/[slug]/` and `/t/_domain/`
- **URLs:** `/t/jane-photography`, custom domain
- **Content:** From database (tenant config)
- **Database:** REQUIRED tenant lookup
- **Purpose:** Each tenant's custom website

**Never mix them. Never create a "company tenant."**

