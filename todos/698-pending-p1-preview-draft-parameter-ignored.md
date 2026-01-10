---
status: pending
priority: p1
issue_id: '698'
tags: [code-review, preview, next-js, build-mode]
dependencies: []
---

# Preview Panel: ?preview=draft Parameter Completely Ignored

## Problem Statement

The preview panel constructs iframe URLs with `?preview=draft&edit=true`, but the Next.js storefront page **never reads** this parameter. The page always fetches from the public API which returns published content.

**Result:** Preview shows the same content as the live site. Users cannot see their draft changes before publishing.

## Findings

### Evidence

**Preview Panel (PreviewPanel.tsx:117):**

```typescript
const iframeUrl = `/t/${slug}/${currentPage === 'home' ? '' : currentPage}?preview=draft&edit=true`;
```

**Page Component (page.tsx:70) - Never reads preview param:**

```typescript
export default async function TenantPage({ params }: TenantPageProps) {
  const { slug } = await params;
  // searchParams NOT destructured, preview param ignored
  const data = await getTenantStorefrontData(slug); // Always public API
}
```

**Data Fetching (tenant.ts:248):**

```typescript
const url = `${API_URL}/v1/public/tenants/${encodeURIComponent(slug)}`;
// Always fetches published content, no draft option
```

### Current Workaround

The system relies on PostMessage protocol to inject draft config client-side:

1. Iframe sends `BUILD_MODE_READY`
2. Parent sends `BUILD_MODE_INIT` with draft config
3. Client state updates to show draft

**Problem:** This causes a "flash" of published content before draft appears.

## Proposed Solutions

### Option A: Implement Server-Side Draft Preview with Token (Recommended)

**Pros:** No flash, proper SSR, secure
**Cons:** Requires new endpoint, token management
**Effort:** Medium (4-6 hours)
**Risk:** Low

1. Generate short-lived preview token when opening preview panel
2. Include in URL: `?preview=draft&token={jwt}`
3. Create endpoint: `GET /v1/public/tenants/:slug/preview?token={jwt}`
4. Validate token, return draft config
5. Update `getTenantStorefrontData` to handle preview mode

### Option B: Accept Flash, Improve Loading UX

**Pros:** Simpler, no server changes
**Cons:** Still has UX issue
**Effort:** Small (1-2 hours)
**Risk:** Low

1. Show loading state in BuildModeWrapper until PostMessage handshake completes
2. Prevent flash of published content
3. Document limitation

### Option C: Remove ?preview=draft to Prevent Confusion

**Pros:** Honest about behavior
**Cons:** Doesn't fix the actual problem
**Effort:** Trivial
**Risk:** None

Remove the misleading parameter if we're not implementing it.

## Recommended Action

**Option A** - Implement proper server-side draft preview. This is essential for the edit-preview-publish workflow.

## Technical Details

### Affected Files

- `apps/web/src/components/preview/PreviewPanel.tsx` (line 117)
- `apps/web/src/app/t/[slug]/(site)/page.tsx` (add searchParams handling)
- `apps/web/src/lib/tenant.ts` (add preview mode support)
- `server/src/routes/public-tenant.routes.ts` (add preview endpoint)

### Security Considerations

- Preview token must be tenant-scoped (can't preview other tenant's draft)
- Token must be short-lived (5-10 minutes)
- Token must require authenticated session
- Must not poison ISR cache with draft content

### Implementation Sketch

```typescript
// page.tsx
interface TenantPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; token?: string }>;
}

export default async function TenantPage({ params, searchParams }: TenantPageProps) {
  const { slug } = await params;
  const { preview, token } = await searchParams;

  const isPreviewMode = preview === 'draft' && token;
  const data = await getTenantStorefrontData(slug, isPreviewMode ? token : undefined);
  // ...
}

// Disable ISR for preview
export const dynamic = 'force-dynamic'; // Only apply conditionally
```

## Acceptance Criteria

- [ ] Preview panel shows draft content without flash
- [ ] Unauthorized users cannot access draft content
- [ ] ISR cache is not poisoned with draft content
- [ ] Preview token expires after 10 minutes
- [ ] Only tenant owner can generate preview token

## Work Log

| Date       | Action                                   | Learnings                              |
| ---------- | ---------------------------------------- | -------------------------------------- |
| 2026-01-10 | Code review discovered ignored parameter | PostMessage workaround has flash issue |

## Resources

- Security review findings: agent a68b7ce
- Preview system review: agent ac3274b
- Related: `apps/web/src/components/tenant/BuildModeWrapper.tsx` (PostMessage handler)
