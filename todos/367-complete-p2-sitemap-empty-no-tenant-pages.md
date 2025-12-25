---
status: complete
priority: p3
issue_id: "367"
tags: [code-review, seo, nextjs]
dependencies: ["359"]
---

# Sitemap Empty - No Dynamic Tenant Pages

## Problem Statement

The sitemap only returns static pages. Tenant storefronts are not included because the backend endpoint to list tenant slugs doesn't exist.

**Why it matters:** Search engines can't discover tenant pages via sitemap, reducing SEO effectiveness.

## Findings

**File:** `apps/web/src/app/sitemap.ts`

```typescript
// Lines 57-66
try {
  // TODO: We'd need a public endpoint that lists active tenant slugs
  // For now, this is a placeholder - in production, you'd have
  // GET /v1/public/tenants/slugs that returns active tenant slugs
  tenantPages = [];  // ❌ EMPTY
} catch (error) {
  tenantPages = [];
}
```

**Impact:** P2 - Tenant storefronts not in sitemap, poor SEO

## Proposed Solutions

### Option 1: Implement Backend Endpoint + Sitemap
- **Description:** Create `GET /v1/public/tenants/slugs` and update sitemap.ts
- **Pros:** Full SEO coverage
- **Cons:** Requires backend work
- **Effort:** Small (1 hour total)
- **Risk:** Low

**Backend endpoint:**
```typescript
// GET /v1/public/tenants/slugs
router.get('/slugs', async (req, res) => {
  const slugs = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true }
  });
  res.json(slugs);
});
```

**Frontend sitemap fix:**
```typescript
const response = await fetch(`${API_URL}/v1/public/tenants/slugs`);
const slugs = await response.json();
tenantPages = slugs.map(({ slug, updatedAt }) => ({
  url: `${APP_URL}/t/${slug}`,
  lastModified: updatedAt,
  changeFrequency: 'weekly',
  priority: 0.8,
}));
```

## Recommended Action

**FIX NOW** - Tenant storefronts are a core feature. An empty sitemap is incomplete code. Create `/v1/public/tenants/active` endpoint and populate the sitemap properly.

## Acceptance Criteria

- [ ] Backend endpoint returns active tenant slugs
- [ ] Sitemap includes all active tenant pages
- [ ] Sitemap updates when tenants change
- [ ] Google Search Console validates sitemap

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created during code review | SEO issue found |

## Resources

- Next.js Sitemap: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
