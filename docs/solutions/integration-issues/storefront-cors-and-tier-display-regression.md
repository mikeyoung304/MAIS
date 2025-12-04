---
title: "Storefront CORS and Tier Display Regression"
problem_type:
  - cors_configuration
  - api_response_mapping
component:
  - storefront
  - segments-routes
  - cors-middleware
  - tier-display-utils
severity: P1 - Production Outage
date_discovered: 2025-12-03
date_solved: 2025-12-03
root_cause_commit: 012bd9b
fix_commits:
  - db586e5
  - 7f40941
symptoms:
  - Customer storefront at /t/little-bit-farm displayed "Storefront Not Found"
  - API rejected requests from www.maconaisolutions.com with HTTP 500
  - After CORS fix, page showed "Coming Soon" instead of package tiers
tags:
  - production-outage
  - cors
  - storefront
  - api-integration
  - tier-pricing
  - accidental-regression
  - multi-tenant
---

# Storefront CORS and Tier Display Regression

## Summary

Customer-facing storefront at `maconaisolutions.com/t/little-bit-farm` was broken due to two cascading issues introduced by commit `012bd9b`:

1. **CORS Rejection**: API rejected cross-origin requests from production domains
2. **Missing Tier Data**: Segment packages endpoint didn't return tier grouping fields

## Root Cause Analysis

### Issue 1: CORS Whitelist Removal

**Breaking Commit:** `012bd9b` (Dec 2, 2025) - "fix: resolve 15+ P2/P3 TODOs from code review"

This commit accidentally removed the hardcoded production CORS whitelist and HTTPS fallback:

```typescript
// BEFORE (working) - server/src/app.ts
const allowed = [
  'http://localhost:5173',
  'https://maconaisolutions.com',
  'https://www.maconaisolutions.com',
  // ... other domains
];

if (allowed.includes(origin)) {
  callback(null, true);
} else if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
  // Widget embedding fallback
  callback(null, true);
}

// AFTER (broken)
const allowedOrigins = config.ALLOWED_ORIGINS || [];  // Empty if not set!

if (allowedOrigins.includes(origin)) {
  callback(null, true);
} else {
  callback(new Error('Not allowed by CORS'));  // Blocks everything!
}
```

**Impact:** All storefront requests from `www.maconaisolutions.com` received HTTP 500.

### Issue 2: Missing DTO Fields

The `/v1/segments/:slug/packages` endpoint transformation didn't include `grouping` and `groupingOrder` fields needed by the frontend `TierSelector` component.

Additionally, the frontend `extractTiers()` utility only recognized `'middle'` as a valid tier, but packages use `'popular'` as the grouping value.

## Solution

### Fix 1: Restore CORS Whitelist (commit db586e5)

**File:** `server/src/app.ts`

```typescript
// Hardcoded production origins (always allowed)
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://maconaisolutions.com',
  'https://www.maconaisolutions.com',
  'https://app.maconaisolutions.com',
  'https://widget.maconaisolutions.com',
];

// Merge with environment variable overrides
const allowedOrigins = [...defaultOrigins, ...(config.ALLOWED_ORIGINS || [])];

if (allowedOrigins.includes(origin)) {
  callback(null, true);
} else if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
  // Allow all HTTPS origins in production (widget embedding on customer sites)
  callback(null, true);
} else {
  logger.warn({ origin, allowedOrigins }, 'CORS request blocked');
  callback(new Error('Not allowed by CORS'));
}
```

### Fix 2: Add Tier Grouping Fields (commit 7f40941)

**File:** `server/src/routes/segments.routes.ts`

```typescript
// Include tier grouping fields for storefront display
return {
  id: pkg.id,
  slug: pkg.slug,
  title: pkg.name,
  description: pkg.description || '',
  priceCents: pkg.basePrice,
  photoUrl,
  grouping: pkg.grouping || null,      // Added
  groupingOrder: pkg.groupingOrder ?? null,  // Added
  addOns: [...],
};
```

**File:** `client/src/features/storefront/utils.ts`

```typescript
export function extractTiers(packages: PackageDto[]): Record<TierLevel, PackageDto | undefined> {
  // ...
  for (const pkg of packages) {
    const grouping = pkg.grouping?.toLowerCase();
    if (!grouping) continue;

    // Map 'popular' to 'middle' tier
    const normalizedGrouping = grouping === 'popular' ? 'middle' : grouping;

    if (TIER_LEVELS.includes(normalizedGrouping as TierLevel)) {
      tiers[normalizedGrouping as TierLevel] = pkg;
    }
  }
  return tiers;
}
```

## Prevention Strategies

### CORS Configuration Changes

1. **Never remove hardcoded production origins** without verifying env vars are configured in all environments
2. **Add CORS integration tests** that verify requests from known production domains
3. **Document CORS strategy** in code comments explaining why certain origins are hardcoded

```typescript
// server/test/http/cors.spec.ts
it('should allow requests from www.maconaisolutions.com', async () => {
  const response = await supertest(app)
    .get('/v1/health')
    .set('Origin', 'https://www.maconaisolutions.com')
    .expect(200);

  expect(response.headers['access-control-allow-origin'])
    .toBe('https://www.maconaisolutions.com');
});
```

### DTO Transformation Changes

1. **Include ALL related fields** when transforming DTOs (if adding `grouping`, also add `groupingOrder`)
2. **Create field mapping document** showing: Prisma field → DTO field → Frontend field
3. **Use TypeScript to enforce DTO shape**:

```typescript
// Enforces all required fields present
const response: PackageDto = {
  ...mapPackageToDto(pkg),
};
```

### Code Review Checklist

- [ ] CORS changes: All production domains still hardcoded?
- [ ] DTO changes: All fields in contract present in response?
- [ ] Field aliasing documented? (e.g., 'popular' → 'middle')
- [ ] Tests cover the change?

## Related Documentation

- [TENANT_SCOPED_ROUTING.md](../../routing/TENANT_SCOPED_ROUTING.md) - Tenant routing patterns
- [STOREFRONT_GRID_DUPLICATION_ELIMINATION.md](../STOREFRONT_GRID_DUPLICATION_ELIMINATION.md) - Tier component architecture
- [public-tenant-route-validation-and-di.md](../security-issues/public-tenant-route-validation-and-di.md) - Public route security

## Timeline

| Time | Event |
|------|-------|
| Dec 2, 20:05 | Commit 012bd9b removes CORS whitelist |
| Dec 3, ~14:00 | Issue detected - storefront broken |
| Dec 3, 21:24 | Commit db586e5 - CORS restored |
| Dec 3, 21:37 | Commit 7f40941 - Tier fields added |
| Dec 3, ~21:45 | Verified working in production |

## Metrics

- **Time to resolution:** ~23 minutes (from investigation start)
- **Lines changed:** 21 across 3 files
- **Commits to fix:** 2
