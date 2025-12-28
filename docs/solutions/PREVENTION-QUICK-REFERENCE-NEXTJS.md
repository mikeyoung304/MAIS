# Next.js ISR & API Mismatch - Quick Reference

**Date:** December 25, 2025 | **Read Full Guide:** `NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md`

---

## Issue 1: ISR Cache Showing Stale Data

**Problem:** Tenant updates package info, but storefront shows old data for up to 60+ seconds

### Quick Detection

```bash
# Check if data is actually stale
curl http://localhost:3001/v1/packages

# Compare timestamps with what's displayed on frontend
# If API has new data but frontend shows old data → ISR cache issue
```

### Quick Fixes

```typescript
// Option A: Disable ISR during development
export const revalidate = 0;

// Option B: Force revalidation when tenant updates
import { revalidatePath } from 'next/cache';
await revalidatePath('/t/*', 'layout');

// Option C: Add cache busting query param
// http://localhost:3000/t/my-tenant?fresh=1
```

### Development Workflow

```bash
# Phase 1: Develop with fresh data
export const revalidate = 0;

# Phase 2: Test ISR timing
export const revalidate = 60;

# Phase 3: Validate with E2E
npm run test:e2e
```

---

## Issue 2: API URL Mismatches (404s)

**Problem:** Client calls `/v1/packages/slug/:slug` but contract defines `/v1/packages/:slug`

### Quick Diagnosis

```bash
# 1. Find the API call failing in browser DevTools
# Network tab → Failed request → URL

# 2. Search contracts for correct path
grep -r "path.*packages" packages/contracts/src/api.v1.ts

# 3. Compare actual URL with contract path
# If they don't match → mismatch issue
```

### Quick Fixes

**Best:** Use ts-rest client (type-safe)

```typescript
const api = await createServerApiClient();
const pkg = await api.getPackageBySlug({ params: { slug } });
```

**Acceptable:** Manual fetch with verified path

```typescript
const url = `${API_BASE_URL}/v1/packages/${encodeURIComponent(slug)}`;
const response = await fetch(url, {
  headers: { 'X-Tenant-Key': apiKey },
});
```

### Contract Verification Checklist

Before submitting code:

- [ ] Found endpoint in `packages/contracts/src/api.v1.ts`
- [ ] HTTP method matches (GET/POST/PUT/DELETE)
- [ ] Path is EXACT match (including `/v1` prefix)
- [ ] Path params are `encodeURIComponent()`
- [ ] Query params use `?key=value` syntax
- [ ] Required headers included (X-Tenant-Key, Authorization)

### Code Review Checklist

When reviewing PR with API changes:

- [ ] Contract path copied correctly to code
- [ ] No path parameters missing or extra
- [ ] All required headers present
- [ ] Response types match contract schemas
- [ ] Error cases handled (404, 401, 500)

---

## Testing Checklist

**Unit:** Does endpoint exist in contracts?

```bash
grep "getPackageBySlug" packages/contracts/src/api.v1.ts
```

**Integration:** Does Express route match contract path?

```bash
npm test -- api-contract-validation.spec.ts
```

**E2E:** Can browser load storefront without 404s?

```bash
npm run test:e2e -- storefront.spec.ts
```

---

## Decision Trees

### When to Use Cache Strategy

```
Data updates frequently?
├─ YES → Use cache: 'no-store'
└─ NO → Use ISR with revalidate: 3600
```

### Which ISR Setting

| Page           | Revalidate   |
| -------------- | ------------ |
| Landing page   | 3600s (1h)   |
| Package detail | 300s (5m)    |
| Availability   | 60s          |
| Admin          | 0 (disabled) |

### API Mismatch Diagnosis

```
Getting 404 on API call?
├─ Check DevTools Network tab
├─ Compare URL with contracts definition
├─ Verify X-Tenant-Key header is present
└─ If path wrong → Update to match contract exactly
```

---

## Common Mistakes

| Mistake                         | Solution                                    |
| ------------------------------- | ------------------------------------------- |
| Manual fetch instead of ts-rest | Use `await api.getPackageBySlug()`          |
| Missing X-Tenant-Key header     | Add `headers: { 'X-Tenant-Key': apiKey }`   |
| Path `/v1/packages/slug/:slug`  | Change to `/v1/packages/:slug}`             |
| Query param as path param       | Use `?startDate=` not `/startDate/`         |
| ISR not revalidating            | Wait 60+ seconds or use `revalidatePath()`  |
| Cache still stale after reload  | Clear `.next` folder and restart dev server |

---

## Commands

```bash
# Clear ISR cache locally
rm -rf apps/web/.next

# Restart dev environment fresh
npm run dev:all

# Validate contracts against code
npm run validate:contracts

# Test API endpoints are reachable
npm run test:e2e -- api-contract-validation.spec.ts

# Debug ISR timing
NODE_DEBUG=nextjs npm run dev:web
```

---

## Links

- **Full Guide:** `docs/solutions/NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md`
- **Contracts:** `packages/contracts/src/api.v1.ts`
- **Tenant Lib:** `apps/web/src/lib/tenant.ts`
- **API Client:** `apps/web/src/lib/api.ts`
