---
status: complete
priority: p2
issue_id: '702'
tags: [code-review, security, caching, next-js]
dependencies: ['698']
---

# ISR Cache Poisoning Risk for Draft Preview

## Problem Statement

The tenant storefront uses ISR with 60-second revalidation:

```typescript
export const revalidate = 60;
```

If draft preview is implemented incorrectly (serving draft data on the same URL path), the ISR cache could cache draft content and serve it to ALL public users for up to 60 seconds.

## Findings

### Current State

- Page uses `revalidate = 60`
- `getTenantBySlug` uses `next: { revalidate: 60 }`
- Same URL path for published and preview mode

### Risk Scenario

1. Admin requests `/t/tenant?preview=draft`
2. Server renders with draft content
3. ISR caches this response
4. Public visitor requests `/t/tenant`
5. ISR serves cached draft content to public visitor

## Proposed Solutions

### Option A: Separate URL Path for Preview

**Effort:** Medium
**Risk:** Low

Use `/t/[slug]/preview/...` that bypasses ISR cache.

### Option B: Dynamic Rendering for Preview

**Effort:** Small
**Risk:** Low

```typescript
export const dynamic = searchParams.preview ? 'force-dynamic' : 'auto';
```

### Option C: No-Store Cache Header for Preview

**Effort:** Small
**Risk:** Low

```typescript
if (isPreviewMode) {
  headers().set('Cache-Control', 'no-store');
}
```

## Recommended Action

**APPROVED** - Implement as part of #698. Use separate URL path (Option A) for clearest separation.

Rationale: Data integrity issue - cache poisoning would leak draft content to all users. Critical when implementing preview.

## Acceptance Criteria

- [x] Public visitors never see draft content from cache
- [x] Preview requests don't poison ISR cache
- [x] Preview URL uses different caching strategy than public URL

## Work Log

| Date       | Action              | Learnings                                                         |
| ---------- | ------------------- | ----------------------------------------------------------------- |
| 2026-01-10 | **Triage: APPROVED** | Data integrity - cache poisoning could leak drafts to public users. |
| 2026-01-10 | **Verified & COMPLETE** | Resolved as part of #698 preview token implementation. Multi-layer cache poisoning prevention verified. |

## Implementation Details (Resolved with #698)

Four-layer protection prevents ISR cache poisoning:

1. **Client-side fetch**: `getTenantPreviewData()` in `apps/web/src/lib/tenant.ts` uses `cache: 'no-store'`
2. **Server-side headers**: Preview endpoint in `server/src/routes/public-tenant.routes.ts` sets `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
3. **Separate data paths**: Normal requests use `getTenantStorefrontData()` with ISR caching; preview uses `getTenantStorefrontDataWithPreview()` which bypasses cache
4. **Next.js dynamic rendering**: Preview requests access `searchParams`, which opts out of static generation automatically

## Resources

- Security review: agent a68b7ce
- Next.js ISR documentation
- Depends on: #698
