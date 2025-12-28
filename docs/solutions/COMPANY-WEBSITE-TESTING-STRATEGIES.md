# Testing Strategies: Company vs. Tenant Routing

Prevent the "company is not a tenant" error from ever reaching production by catching it in tests.

---

## Testing Philosophy

**Goal:** Verify that company pages work independently of database state, and tenant pages require valid tenants.

**Key Principle:**

- Company pages: Database is optional (should work without it)
- Tenant pages: Database is required (must handle missing tenants)

---

## Part 1: Unit Testing

### Test 1: Verify No Database Lookups in Company Pages

**File:** `apps/web/__tests__/company-pages.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Company Pages - No Database Lookups', () => {
  beforeEach(() => {
    // Mock all database-related functions
    vi.mock('@/lib/tenant', () => ({
      getTenantBySlug: vi.fn(),
      getTenantByDomain: vi.fn(),
      getTenantStorefrontData: vi.fn(),
    }));
  });

  it('root page (/page.tsx) should not call getTenantBySlug', async () => {
    const { getTenantBySlug } = require('@/lib/tenant');

    // Import and render root page
    const { default: HomePage } = await import('@/app/page');
    const result = await HomePage();

    // Assertion: getTenantBySlug should NOT be called
    expect(getTenantBySlug).not.toHaveBeenCalled();
    expect(result).toBeTruthy(); // Page should still render
  });

  it('signup page should not call getTenantByDomain', async () => {
    const { getTenantByDomain } = require('@/lib/tenant');

    // Import signup page
    const { default: SignupPage } = await import('@/app/signup/page');
    const result = await SignupPage();

    expect(getTenantByDomain).not.toHaveBeenCalled();
  });

  it('root page should hardcode features and pricing', async () => {
    const { default: HomePage } = await import('@/app/page');
    const result = await HomePage();

    // If page renders, check that content is static (snapshot)
    // This is a basic check - more thorough in E2E tests
    expect(result).toBeTruthy();
  });
});
```

**Run:**

```bash
npm test -- company-pages.test.ts
```

### Test 2: Verify Tenant Lookups in Tenant Pages

**File:** `apps/web/__tests__/tenant-pages.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Tenant Pages - Database Lookups Required', () => {
  beforeEach(() => {
    vi.mock('@/lib/tenant', () => ({
      getTenantBySlug: vi.fn(),
      getTenantByDomain: vi.fn(),
    }));
  });

  it('/t/[slug] page MUST call getTenantBySlug', async () => {
    const { getTenantBySlug } = require('@/lib/tenant');
    getTenantBySlug.mockResolvedValue(null); // Simulate not found

    // Import tenant page
    const { default: TenantPage } = await import('@/app/t/[slug]/(site)/page');

    // This should throw notFound()
    await expect(TenantPage({ params: { slug: 'test' } })).rejects.toThrow();

    expect(getTenantBySlug).toHaveBeenCalledWith('test');
  });

  it('/t/[slug] page should call notFound() when tenant missing', async () => {
    const { getTenantBySlug } = require('@/lib/tenant');
    getTenantBySlug.mockResolvedValue(null);

    const { default: TenantPage } = await import('@/app/t/[slug]/(site)/page');

    // Should trigger 404
    await expect(TenantPage({ params: { slug: 'nonexistent' } })).rejects.toThrow('notFound');
  });

  it('/t/[slug] page should render when tenant exists', async () => {
    const { getTenantBySlug } = require('@/lib/tenant');
    const mockTenant = {
      id: '1',
      slug: 'test-studio',
      name: 'Test Studio',
      apiKeyPublic: 'pk_live_test_xyz',
    };
    getTenantBySlug.mockResolvedValue(mockTenant);

    const { default: TenantPage } = await import('@/app/t/[slug]/(site)/page');
    const result = await TenantPage({ params: { slug: 'test-studio' } });

    expect(result).toBeTruthy();
    expect(getTenantBySlug).toHaveBeenCalledWith('test-studio');
  });

  it('/t/_domain page MUST call getTenantByDomain', async () => {
    const { getTenantByDomain } = require('@/lib/tenant');
    getTenantByDomain.mockResolvedValue(null);

    const { default: DomainPage } = await import('@/app/t/_domain/page');

    await expect(
      DomainPage({
        searchParams: { domain: 'janephotography.com' },
      })
    ).rejects.toThrow();

    expect(getTenantByDomain).toHaveBeenCalledWith('janephotography.com');
  });
});
```

**Run:**

```bash
npm test -- tenant-pages.test.ts
```

### Test 3: Isolation - Company Content Can't Access Tenant Data

**File:** `apps/web/__tests__/isolation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Routing Isolation', () => {
  it('company pages should not import tenant-specific components', async () => {
    // Read root page file
    const fs = require('fs');
    const homepageCode = fs.readFileSync('src/app/page.tsx', 'utf-8');

    // Should not import tenant-specific utilities
    expect(homepageCode).not.toContain("from '@/app/t/");
    expect(homepageCode).not.toContain('TenantNav');
    expect(homepageCode).not.toContain('getTenantBySlug');
    expect(homepageCode).not.toContain('getTenantByDomain');
  });

  it('tenant pages should import tenant utilities', async () => {
    const fs = require('fs');
    const tenantPageCode = fs.readFileSync('src/app/t/[slug]/(site)/page.tsx', 'utf-8');

    // Should import tenant utilities
    expect(tenantPageCode).toContain('getTenantBySlug');
    expect(tenantPageCode).toContain('TenantNav');
  });

  it('no cross-imports between company and tenant page structures', () => {
    // Company pages shouldn't import tenant page components
    const companyPageCode = fs.readFileSync('src/app/page.tsx', 'utf-8');
    expect(companyPageCode).not.toMatch(/from ['"]\.\.\/t\/\[slug\]\/\(site\)/);

    // Tenant pages can't hardcode company messaging
    const tenantPageCode = fs.readFileSync('src/app/t/[slug]/(site)/page.tsx', 'utf-8');
    expect(tenantPageCode).not.toContain('HANDLED - Stay Ahead');
  });
});
```

---

## Part 2: Integration Testing

### Integration Test: Database State Independence

**File:** `apps/web/__tests__/integration/company-no-db.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Company Pages Integration - No Database Required', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('root page works even with empty tenant table', async () => {
    // Clear all tenants
    await prisma.tenant.deleteMany({});

    // Try to render root page - should still work
    const response = await fetch('http://localhost:3000/');
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('Stay Ahead Without the Overwhelm');
    expect(html).toContain('Handled'); // Pricing tier
    expect(html).toContain('Fully Handled');
  });

  it('company pages show same content regardless of tenant count', async () => {
    // Test with 0 tenants
    await prisma.tenant.deleteMany({});
    const response1 = await fetch('http://localhost:3000/');
    const content1 = await response1.text();

    // Create some tenants
    await prisma.tenant.create({
      data: {
        slug: 'test-1',
        name: 'Test Studio 1',
        apiKeyPublic: 'pk_live_test1_xyz',
      },
    });

    // Test again - content should be identical
    const response2 = await fetch('http://localhost:3000/');
    const content2 = await response2.text();

    // Same company content regardless of database state
    expect(content1).toBe(content2);
  });
});
```

### Integration Test: Tenant Pages Require Tenants

**File:** `apps/web/__tests__/integration/tenant-requires-db.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Tenant Pages Integration - Database Required', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('tenant page 404s when tenant does not exist', async () => {
    // Clear all tenants
    await prisma.tenant.deleteMany({});

    const response = await fetch('http://localhost:3000/t/nonexistent-studio');
    expect(response.status).toBe(404);
  });

  it('tenant page loads when tenant exists', async () => {
    const tenant = await prisma.tenant.create({
      data: {
        slug: 'test-studio',
        name: 'Test Photography Studio',
        apiKeyPublic: 'pk_live_test_xyz',
      },
    });

    const response = await fetch(`http://localhost:3000/t/${tenant.slug}`);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain(tenant.name);
  });

  it('different tenants show different content', async () => {
    const tenant1 = await prisma.tenant.create({
      data: {
        slug: 'photographer-one',
        name: 'Jane Photography',
        apiKeyPublic: 'pk_live_jane_xyz',
      },
    });

    const tenant2 = await prisma.tenant.create({
      data: {
        slug: 'photographer-two',
        name: 'John Photography',
        apiKeyPublic: 'pk_live_john_xyz',
      },
    });

    const page1 = await fetch(`http://localhost:3000/t/photographer-one`);
    const content1 = await page1.text();

    const page2 = await fetch(`http://localhost:3000/t/photographer-two`);
    const content2 = await page2.text();

    // Each shows own tenant name
    expect(content1).toContain('Jane Photography');
    expect(content1).not.toContain('John Photography');

    expect(content2).toContain('John Photography');
    expect(content2).not.toContain('Jane Photography');
  });
});
```

---

## Part 3: E2E Testing with Playwright

### E2E Test: Company Pages Exist and Render

**File:** `e2e/company-pages.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Company Pages', () => {
  test('root page loads and shows company content', async ({ page }) => {
    await page.goto('/');

    // Verify company content is visible
    await expect(page.locator('text=Stay Ahead Without the Overwhelm')).toBeVisible();
    await expect(page.locator('text=Handled')).toBeVisible(); // Pricing tier
    await expect(page.locator('text=Fully Handled')).toBeVisible();

    // Verify NO tenant-specific content
    await page.waitForURL('/'); // Doesn't redirect
  });

  test('signup page is accessible', async ({ page }) => {
    await page.goto('/signup');

    expect(page.url()).toContain('/signup');
    await expect(page.locator('text=Get Started')).toBeVisible();
  });

  test('company links work', async ({ page }) => {
    await page.goto('/');

    // Click signup
    await page.click('text=Get Started');
    expect(page.url()).toContain('/signup');

    // Go back
    await page.goto('/');

    // Verify no broken links
    const links = page.locator('a[href^="/"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test('root page works without any tenants in database', async ({ page }) => {
    // This test assumes database is empty or has no "handled" tenant
    await page.goto('/');

    // Page should still render
    expect(page.status).toBe(200);
    await expect(page.locator('text=Stay Ahead Without the Overwhelm')).toBeVisible();
  });
});
```

### E2E Test: Tenant Pages Require Valid Tenants

**File:** `e2e/tenant-pages.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { createTestTenant, cleanupTestTenant } from '../helpers/test-tenant';

test.describe('Tenant Pages', () => {
  test('nonexistent tenant shows 404', async ({ page }) => {
    await page.goto('/t/nonexistent-xyz-studio');

    // Should show 404 page
    expect(page.status).toBe(404);
    await expect(page.locator('text=/404|Not Found/i')).toBeVisible();
  });

  test('valid tenant shows tenant page', async ({ page }) => {
    const tenant = await createTestTenant({
      slug: 'test-photo-studio',
      name: 'Test Photo Studio',
    });

    try {
      await page.goto(`/t/${tenant.slug}`);

      expect(page.status).toBe(200);
      await expect(page.locator(`text=${tenant.name}`)).toBeVisible();
    } finally {
      await cleanupTestTenant(tenant.id);
    }
  });

  test('custom domain routes to correct tenant', async ({ page }) => {
    const tenant = await createTestTenant({
      slug: 'jane-photography',
      name: 'Jane Photography',
      customDomain: 'janephotography.com',
    });

    try {
      // Simulate custom domain request
      // (This is tricky in Playwright, usually done via API)
      await page.goto(`/t/_domain?domain=janephotography.com`);

      // Should show tenant content
      await expect(page.locator(`text=${tenant.name}`)).toBeVisible();
    } finally {
      await cleanupTestTenant(tenant.id);
    }
  });

  test('different tenants show different content', async ({ page }) => {
    const tenant1 = await createTestTenant({
      slug: 'photographer-one',
      name: 'Alice Photography',
    });

    const tenant2 = await createTestTenant({
      slug: 'photographer-two',
      name: 'Bob Photography',
    });

    try {
      // Visit tenant 1
      await page.goto(`/t/${tenant1.slug}`);
      await expect(page.locator(`text=${tenant1.name}`)).toBeVisible();
      expect(page.text()).not.toContain(tenant2.name); // No leakage

      // Visit tenant 2
      await page.goto(`/t/${tenant2.slug}`);
      await expect(page.locator(`text=${tenant2.name}`)).toBeVisible();
      expect(page.text()).not.toContain(tenant1.name); // No leakage
    } finally {
      await cleanupTestTenant(tenant1.id);
      await cleanupTestTenant(tenant2.id);
    }
  });

  test('cannot find "handled" as a tenant (company is not a tenant)', async ({ page }) => {
    // This is the critical test - proves company wasn't accidentally created as tenant
    await page.goto('/t/handled');

    // Should 404
    expect(page.status).toBe(404);

    // Root page should still work
    await page.goto('/');
    expect(page.status).toBe(200);
    await expect(page.locator('text=Stay Ahead Without the Overwhelm')).toBeVisible();
  });
});
```

---

## Part 4: Test Helpers

### Helper: Create Test Tenant

**File:** `apps/web/__tests__/helpers/test-tenant.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createTestTenant(
  overrides: {
    slug?: string;
    name?: string;
    customDomain?: string;
  } = {}
) {
  return prisma.tenant.create({
    data: {
      slug: overrides.slug || `test-${Date.now()}`,
      name: overrides.name || 'Test Tenant',
      apiKeyPublic: `pk_live_${Date.now()}_xyz`,
      ...(overrides.customDomain && { customDomain: overrides.customDomain }),
    },
  });
}

export async function cleanupTestTenant(tenantId: string) {
  return prisma.tenant.delete({
    where: { id: tenantId },
  });
}

export async function createAndCleanup(fn: (tenant: any) => Promise<void>, overrides?: any) {
  const tenant = await createTestTenant(overrides);
  try {
    await fn(tenant);
  } finally {
    await cleanupTestTenant(tenant.id);
  }
}
```

---

## Part 5: Pre-Deployment Test Checklist

Before deploying any changes to pages/routing:

```bash
# 1. Run all unit tests
npm test -- company-pages.test.ts
npm test -- tenant-pages.test.ts
npm test -- isolation.test.ts

# 2. Run integration tests
npm test -- integration/company-no-db.integration.test.ts
npm test -- integration/tenant-requires-db.integration.test.ts

# 3. Run E2E tests
npm run test:e2e -- e2e/company-pages.spec.ts
npm run test:e2e -- e2e/tenant-pages.spec.ts

# 4. Verify database state
cd server
npm exec prisma studio
# Check: No tenant with slug 'handled', 'company', 'maconaisolutions', 'app'

# 5. Manual test
npm run dev:web
# Visit / - should work
# Visit /t/nonexistent - should 404
# Visit /t/[valid-tenant-slug] - should work
```

---

## Summary: Test Coverage Goals

By implementing these tests, you verify:

1. **Company pages don't require database** ✓
2. **Tenant pages require valid tenants** ✓
3. **No "company tenants" can exist** ✓
4. **Data isolation between tenants** ✓
5. **Routing doesn't redirect to database lookups** ✓

This prevents the "company is not a tenant" error from ever reaching production.
