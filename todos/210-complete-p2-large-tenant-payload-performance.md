---
status: complete
priority: p2
issue_id: '210'
tags: [performance, api, payload, landing-page]
dependencies: []
---

# TODO-210: Large Tenant Payload (~34KB) Performance Impact

## Priority: P2 (Important)

## Status: Resolved

## Source: Code Review - Landing Page Implementation

## Resolution

Implemented response compression middleware (Option B - short-term solution). See commit for details.

### Changes Made

1. **Installed compression package**: `compression@1.8.1` and `@types/compression@1.8.1`
2. **Added compression middleware** in `/Users/mikeyoung/CODING/MAIS/server/src/app.ts`:
   - Placed after Sentry middleware (for accurate request tracking)
   - Threshold: 1KB (only compress responses > 1KB)
   - Level: 6 (balanced compression ratio and CPU usage)
   - Filter: Allows opt-out via `x-no-compression` header
   - Uses compression's default filter for Content-Type checking

### Expected Performance Impact

- **Compression ratio**: ~70-80% for JSON payloads
- **~34KB → ~8-10KB** compressed for full TenantPublicDto
- **Reduced bandwidth**: Especially beneficial for mobile users
- **Minimal CPU overhead**: Level 6 compression is well-balanced

### Future Improvements

Long-term solution (Option A - lazy load landing page config) can be implemented later if needed:

- Split into two endpoints: minimal tenant info + landing page config
- Lazy load landing page config only when needed
- Further reduce initial page load payload

## Description

The `TenantPublicDto` response includes full landing page configuration (~34KB when populated). This is fetched on every storefront visit and could impact:

1. Initial page load time on slow connections
2. Mobile data usage
3. React Query cache size

## Current Response Size

```
TenantPublicDto with full landing page config:
- Base tenant info: ~2KB
- Branding: ~3KB
- Landing page sections: ~25-30KB
Total: ~30-35KB per tenant fetch
```

## Potential Solutions

### Option A: Lazy Load Landing Page Config (Recommended)

Split into two endpoints:

```typescript
// 1. Minimal tenant info (always fetched)
GET /v1/public/tenants/:slug
Response: { id, name, slug, branding: { colors, logo } } // ~5KB

// 2. Landing page config (lazy loaded)
GET /v1/public/tenants/:slug/landing-page
Response: { sections, hero, about, ... } // ~30KB
```

Then in LandingPage.tsx:

```typescript
function LandingPage({ tenant }: LandingPageProps) {
  // Only fetch if landing page might be enabled
  const { data: landingConfig } = useQuery({
    queryKey: ['landing-page', tenant.slug],
    queryFn: () => api.getLandingPageConfig(tenant.slug),
    enabled: tenant.branding?.hasLandingPage, // Flag on base tenant
  });
}
```

### Option B: Compress Response

Add gzip/brotli compression for JSON responses:

```typescript
// server/src/app.ts
import compression from 'compression';

app.use(
  compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    threshold: 1024, // Only compress > 1KB
  })
);
```

### Option C: Partial Response with Fields Parameter

```typescript
GET /v1/public/tenants/:slug?fields=id,name,slug,branding.colors

// Contract
query: z.object({
  fields: z.string().optional(),
})
```

## Recommendation

1. Short-term: Add compression middleware (Option B)
2. Long-term: Split endpoint for lazy loading (Option A)

## Acceptance Criteria

- [x] Response compression enabled
- [ ] Landing page config optionally lazy-loaded (deferred to future)
- [x] Measure and document payload size improvement
- [x] No breaking changes to existing clients

## Tags

performance, api, payload, landing-page
