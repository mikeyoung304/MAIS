---
status: pending
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

Implement as part of #698. Use separate URL path (Option A) for clearest separation.

## Acceptance Criteria

- [ ] Public visitors never see draft content from cache
- [ ] Preview requests don't poison ISR cache
- [ ] Preview URL uses different caching strategy than public URL

## Resources

- Security review: agent a68b7ce
- Next.js ISR documentation
- Depends on: #698
