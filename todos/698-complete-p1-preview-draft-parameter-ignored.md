---
status: complete
priority: p1
issue_id: '698'
tags: [code-review, preview, next-js, build-mode]
dependencies: []
---

# Preview Panel: ?preview=draft Parameter Completely Ignored

## Problem Statement

The preview panel constructs iframe URLs with `?preview=draft&edit=true`, but the Next.js storefront page **never reads** this parameter. The page always fetches from the public API which returns published content.

**Result:** Preview shows the same content as the live site. Users cannot see their draft changes before publishing.

## Resolution

Implemented **Option A: Server-Side Draft Preview with Token** as recommended.

### Implementation Summary

1. **Preview Token Service** (`server/src/lib/preview-tokens.ts`)
   - `generatePreviewToken(tenantId, slug, expiryMinutes)` - Creates signed JWT
   - `validatePreviewToken(token, expectedSlug)` - Validates token with detailed error types
   - Tokens expire after 10 minutes by default
   - Token payload includes: tenantId, slug, type='preview'

2. **Preview Token Endpoint** (`server/src/routes/tenant-admin.routes.ts`)
   - `POST /v1/tenant-admin/preview-token` - Generates preview token for authenticated tenant
   - Requires authenticated tenant session
   - Returns `{ token, expiresAt }`

3. **Public Preview Endpoint** (`server/src/routes/public-tenant.routes.ts`)
   - `GET /v1/public/tenants/:slug/preview?token={jwt}` - Returns draft content
   - Validates token signature and expiry
   - Validates token slug matches requested tenant
   - Returns draft config if exists, otherwise published
   - Sets `Cache-Control: no-store` to prevent ISR cache poisoning

4. **Frontend Hook** (`apps/web/src/hooks/usePreviewToken.ts`)
   - `usePreviewToken()` - TanStack Query hook for token management
   - Auto-refreshes token before expiry (2 minute buffer)
   - Provides `refreshToken()` for manual refresh
   - Tracks `isExpiringSoon` state

5. **PreviewPanel Update** (`apps/web/src/components/preview/PreviewPanel.tsx`)
   - Uses `usePreviewToken()` to fetch token
   - Includes token in iframe URL: `?preview=draft&token={jwt}&edit=true`
   - Shows loading state while token is being fetched
   - Handles token errors gracefully

6. **Next.js Page Update** (`apps/web/src/app/t/[slug]/(site)/page.tsx`)
   - Accepts `searchParams` with `preview`, `token`, `edit`
   - Uses `getTenantStorefrontDataWithPreview(slug, token)` for preview mode
   - Falls back to published content if token is invalid/expired
   - Does not include SEO structured data for preview pages

7. **Data Fetching** (`apps/web/src/lib/tenant.ts`)
   - `getTenantPreviewData(slug, token)` - Fetches draft via preview endpoint
   - `getTenantStorefrontDataWithPreview(slug, token?)` - Unified fetcher
   - Uses `cache: 'no-store'` to bypass ISR cache

### Security Measures

- Preview tokens are tenant-scoped (slug in payload, validated server-side)
- Tokens expire after 10 minutes
- Token generation requires authenticated tenant session
- Preview endpoint validates token before returning any data
- ISR cache is not poisoned (no-store headers, conditional dynamic rendering)
- Graceful fallback to published content on token expiry

### Tests

Added comprehensive tests in `server/test/lib/preview-tokens.test.ts`:
- Token generation with correct payload and expiry
- Custom expiry times
- Valid token validation
- Slug mismatch detection
- Expired token rejection
- Invalid signature rejection
- Wrong token type rejection
- Malformed token rejection
- Missing fields rejection

## Acceptance Criteria

- [x] Preview panel shows draft content without flash
- [x] Unauthorized users cannot access draft content
- [x] ISR cache is not poisoned with draft content
- [x] Preview token expires after 10 minutes
- [x] Only tenant owner can generate preview token

## Findings (Original)

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

The system relied on PostMessage protocol to inject draft config client-side:

1. Iframe sends `BUILD_MODE_READY`
2. Parent sends `BUILD_MODE_INIT` with draft config
3. Client state updates to show draft

**Problem:** This caused a "flash" of published content before draft appears.

## Work Log

| Date       | Action                                   | Learnings                              |
| ---------- | ---------------------------------------- | -------------------------------------- |
| 2026-01-10 | Code review discovered ignored parameter | PostMessage workaround has flash issue |
| 2026-01-10 | **Approved during triage** | P1 - Critical for Build Mode UX |
| 2026-01-10 | **Implemented Option A** | Token-based preview with full security |

## Files Modified

- `server/src/lib/preview-tokens.ts` (new)
- `server/src/routes/tenant-admin.routes.ts`
- `server/src/routes/public-tenant.routes.ts`
- `apps/web/src/hooks/usePreviewToken.ts` (new)
- `apps/web/src/components/preview/PreviewPanel.tsx`
- `apps/web/src/app/t/[slug]/(site)/page.tsx`
- `apps/web/src/lib/tenant.ts`
- `server/test/lib/preview-tokens.test.ts` (new)

## Resources

- Security review findings: agent a68b7ce
- Preview system review: agent ac3274b
- Related: `apps/web/src/components/tenant/BuildModeWrapper.tsx` (PostMessage handler)
