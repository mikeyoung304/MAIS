# Implementing ISR Cache Strategies - Step-by-Step Guide

**Date:** December 25, 2025
**Audience:** Developers working on Next.js storefronts
**Estimated Time:** 30 minutes

---

## Overview

This guide shows you how to implement the three main ISR cache strategies to prevent stale data issues on tenant storefronts.

---

## Strategy 1: Disable ISR During Development

**When to use:** During feature development when you want instant feedback

### Step 1: Identify the page

Find pages that use `export const revalidate`:

```bash
grep -r "export const revalidate" apps/web/src/app
```

### Step 2: Update the page

```typescript
// apps/web/src/app/t/[slug]/(site)/page.tsx

// Change this:
export const revalidate = 60;

// To this (for development):
export const revalidate = 0; // Fetch fresh on every request
```

### Step 3: Verify it works

```bash
# Start dev server
cd apps/web && npm run dev

# Navigate to storefront
# Open http://localhost:3000/t/test-tenant

# Update mock data in another terminal
# curl -X POST http://localhost:3001/v1/admin/packages/update

# Refresh browser
# You should see updated data immediately
```

### Step 4: Re-enable ISR for production

```typescript
// IMPORTANT: Before committing, change back to:
export const revalidate = 60;

// Or use environment variable for automatic switching:
export const revalidate = process.env.NODE_ENV === 'development' ? 0 : 60;
```

---

## Strategy 2: Use Next.js On-Demand Revalidation

**When to use:** When tenants update content and you want immediate refresh

### Step 1: Create a server action for cache invalidation

```typescript
// apps/web/src/lib/cache-actions.ts
'use server';

import { revalidatePath } from 'next/cache';

/**
 * Invalidate all cached pages for a tenant
 * Call this when tenant updates content
 */
export async function invalidateTenantCache(tenantSlug: string) {
  // Invalidate all pages for this tenant
  revalidatePath(`/t/${tenantSlug}`, 'layout');
  revalidatePath(`/t/${tenantSlug}/(site)`, 'layout');
  revalidatePath(`/t/${tenantSlug}/book`, 'layout');

  console.log(`Invalidated cache for tenant: ${tenantSlug}`);
  return { success: true };
}

/**
 * Invalidate cache for a specific package
 */
export async function invalidatePackageCache(tenantSlug: string, packageSlug: string) {
  // Invalidate the package detail page
  revalidatePath(`/t/${tenantSlug}/book/${packageSlug}`, 'page');

  console.log(`Invalidated cache for package: ${tenantSlug}/${packageSlug}`);
  return { success: true };
}
```

### Step 2: Call from admin actions

```typescript
// apps/web/src/app/(protected)/tenant/packages/page.tsx
'use client';

import { invalidateTenantCache } from '@/lib/cache-actions';

export default function PackagesPage() {
  const handleSavePackage = async (packageData) => {
    // Save package to API
    const response = await api.tenantAdminUpdatePackage({
      params: { id: packageData.id },
      body: packageData,
    });

    if (response.status === 200) {
      // Invalidate cache after successful update
      await invalidateTenantCache(tenantSlug);

      // Show success message
      toast.success('Package updated and cache invalidated');
    }
  };

  return (
    // ... component JSX
  );
}
```

### Step 3: Test it works

```bash
# 1. Navigate to package
http://localhost:3000/t/test-tenant/book/wedding

# 2. Update package in admin
http://localhost:3000/tenant/packages

# 3. Make change (e.g., price)

# 4. Cache should be invalidated immediately
# Refresh /t/test-tenant/book/wedding
# Should see new price

# 5. Verify in server logs:
# "Invalidated cache for tenant: test-tenant"
```

---

## Strategy 3: Add Cache-Busting Query Parameter

**When to use:** For quick debugging in development

### Step 1: Update the page component

```typescript
// apps/web/src/app/t/[slug]/(site)/page.tsx

interface TenantPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fresh?: string }>;
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const data = await getTenantStorefrontData(slug);
    // ... metadata generation
  } catch (error) {
    // ... error handling
  }
}

export default async function TenantPage({ params, searchParams }: TenantPageProps) {
  const { slug } = await params;
  const { fresh } = await searchParams;

  // If fresh=1 in query, disable cache for this request
  const data = fresh
    ? await getTenantStorefrontDataNoCache(slug)  // New function, no cache
    : await getTenantStorefrontData(slug);  // Normal cached version

  return <TenantLandingPage data={data} basePath={`/t/${slug}`} />;
}

export const revalidate = 60;  // Normal ISR setting
```

### Step 2: Create a cache-disabled version

```typescript
// apps/web/src/lib/tenant.ts

/**
 * Fetch without caching (used for ?fresh=1 debugging)
 */
async function getTenantStorefrontDataNoCache(slug: string): Promise<TenantStorefrontData> {
  // Fetch without React cache() wrapper
  const tenantUrl = `${API_BASE_URL}/v1/public/tenants/${encodeURIComponent(slug)}`;
  const tenantResponse = await fetch(tenantUrl, {
    method: 'GET',
    next: { revalidate: 0 }, // Never cache
  });

  const tenant = await tenantResponse.json();

  const [packages, segments] = await Promise.all([
    fetch(`${API_BASE_URL}/v1/packages`, {
      headers: { 'X-Tenant-Key': tenant.apiKeyPublic },
      next: { revalidate: 0 },
    }).then((r) => r.json()),

    fetch(`${API_BASE_URL}/v1/segments`, {
      headers: { 'X-Tenant-Key': tenant.apiKeyPublic },
      next: { revalidate: 0 },
    })
      .then((r) => r.json())
      .catch(() => []),
  ]);

  return { tenant, packages, segments };
}
```

### Step 3: Use the query parameter

```
# Normal request - uses ISR cache
http://localhost:3000/t/test-tenant

# Force fresh data - bypasses cache
http://localhost:3000/t/test-tenant?fresh=1

# Multiple checks:
# 1st request (t=0s):     http://localhost:3000/t/test-tenant?fresh=1 → Fresh data
# 2nd request (t=30s):    http://localhost:3000/t/test-tenant → Cached data (matches 1st)
# 3rd request (t=70s):    http://localhost:3000/t/test-tenant → New data (past 60s)
# Verify 2nd and 3rd are different
```

---

## Strategy 4: Clear Local Cache Between Requests

**When to use:** When ISR cache seems corrupted or stuck

### Step 1: Clear the Next.js build cache

```bash
# Stop the dev server (Ctrl+C)
cd apps/web

# Remove cache directories
rm -rf .next
rm -rf node_modules/.cache

# Restart dev server
npm run dev
```

### Step 2: Add cache clearing to development script

```json
{
  "scripts": {
    "dev:clean": "rm -rf .next && npm run dev",
    "dev:full-reset": "rm -rf .next node_modules && npm install && npm run dev"
  }
}
```

Use when needed:

```bash
npm run dev:clean
```

---

## Testing Your Implementation

### Test 1: Verify ISR Revalidation Timing

```typescript
// e2e/tests/isr-timing.spec.ts
import { test, expect } from '@playwright/test';

test('ISR revalidates data after 60 seconds', async ({ page }) => {
  // 1. First visit
  await page.goto('/t/test-tenant');
  const initialPackages = await page.locator('[data-test="package"]').count();

  // Record initial content
  const initialContent = await page.textContent('[data-test="package-list"]');

  // 2. Request page again before 60s - should be cached
  await page.reload();
  const cachedContent = await page.textContent('[data-test="package-list"]');
  expect(cachedContent).toBe(initialContent); // Identical (from cache)

  // 3. Wait for ISR window to pass
  await page.waitForTimeout(61 * 1000); // Wait 61 seconds

  // 4. Request again - should fetch fresh
  await page.reload();

  // Verify fetch was made (check Network tab)
  const request = await page.evaluate(() => {
    return (performance as any)
      .getEntriesByType('resource')
      .find((r: any) => r.name.includes('/v1/public/tenants'));
  });

  expect(request).toBeDefined(); // API was called
});
```

### Test 2: Verify Cache Invalidation

```typescript
// e2e/tests/cache-invalidation.spec.ts
import { test, expect } from '@playwright/test';

test('invalidateTenantCache works immediately', async ({ page, context }) => {
  // 1. Visit storefront
  await page.goto('/t/test-tenant');

  // Capture initial data
  const initialPrice = await page.locator('[data-test="package-price"]').first().textContent();

  // 2. In admin, update package price
  await page.goto('/tenant/packages');
  await page.fill('[name="price"]', '500.00');
  await page.click('[type="submit"]');

  // 3. Admin update triggers cache invalidation
  await page.waitForNavigation();

  // 4. Navigate back to storefront
  await page.goto('/t/test-tenant');

  // 5. Should see new price immediately (not from cache)
  const newPrice = await page.locator('[data-test="package-price"]').first().textContent();

  expect(newPrice).not.toBe(initialPrice);
  expect(newPrice).toBe('$500.00');
});
```

### Test 3: Verify Query Parameter Cache Bypass

```typescript
// e2e/tests/cache-busting.spec.ts
import { test, expect } from '@playwright/test';

test('?fresh=1 bypasses ISR cache', async ({ page }) => {
  // 1. Load from cache
  await page.goto('/t/test-tenant');
  const cachedContent = await page.textContent('body');

  // 2. Load with cache bypass
  await page.goto('/t/test-tenant?fresh=1');
  const freshContent = await page.textContent('body');

  // Both should show same content (no update made), but fresh=1 should
  // fetch from API (verify in Network tab)
  const apiRequest = await page.evaluate(() => {
    return (performance as any)
      .getEntriesByType('resource')
      .filter((r: any) => r.name.includes('/v1/')).length;
  });

  expect(apiRequest).toBeGreaterThan(0); // API was called
});
```

---

## Monitoring & Debugging

### Enable Debug Logging

```typescript
// apps/web/src/lib/tenant.ts

// Add at top of each cache function:
console.log(`[TENANT-CACHE] Fetching ${slug} at ${new Date().toISOString()}`);

// Call logger on success:
console.log(`[TENANT-CACHE] Success for ${slug} (${result.packages.length} packages)`);

// Call logger on cache hit:
console.log(`[TENANT-CACHE] Cache HIT for ${slug} (React cache())`);
```

### Check Cache Headers

In browser DevTools → Network tab:

```
Request:
  GET /v1/packages HTTP/1.1

Response Headers:
  cache-control: public, max-age=3600  // ← Shows API's cache policy
  date: Wed, 25 Dec 2025 10:00:00 GMT

Next.js Cache:
  x-middleware-cache: HIT  // ← Shows if cached
```

### Server Logs

```bash
# Start server with debug logging
DEBUG=nextjs:* npm run dev:web

# Look for cache-related messages:
# [TENANT-CACHE] Fetching test-tenant...
# [TENANT-CACHE] Success (9 packages)
```

---

## Checklist: Implementation Complete

After implementing cache strategies:

- [ ] Strategy 1 (Disable): Verified `revalidate: 0` shows fresh data
- [ ] Strategy 2 (On-Demand): Tested `invalidateTenantCache()` after updates
- [ ] Strategy 3 (Query Param): Verified `?fresh=1` bypasses cache
- [ ] Strategy 4 (Clear Cache): Tested `rm -rf .next` clears stuck cache
- [ ] Tests: All E2E tests pass for ISR timing and invalidation
- [ ] Logging: Debug logs show cache hits/misses
- [ ] Documentation: Updated team on cache strategies

---

## Common Issues & Solutions

| Issue                                   | Solution                                           |
| --------------------------------------- | -------------------------------------------------- |
| Changes not showing after 60s           | Verify ISR window has passed (wait 61s)            |
| Cache cleared but still stale           | Restart browser tab completely                     |
| `revalidatePath()` not working          | Check it's in a server action or route handler     |
| API returns new data but page shows old | Clear `.next` and restart dev server               |
| `?fresh=1` ignored                      | Verify `searchParams` is handled in page component |

---

## Next Steps

1. **Choose Strategy**: Decide which strategy fits your workflow
2. **Implement**: Follow steps above for chosen strategy
3. **Test**: Run E2E tests to verify functionality
4. **Monitor**: Check debug logs during development
5. **Share**: Document in team wiki/Slack
