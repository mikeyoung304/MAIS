# LivePreview Draft URL Parameter Mismatch

---

title: "LivePreview Draft URL Mismatch - Preview Shows Default Config"
slug: livepreview-draft-url-mismatch
category: ui-bugs
severity: P1
component: apps/web/app/(protected)/tenant/website/components/LivePreview.tsx
symptoms:

- Website page preview shows `[Your Transformation Headline]` instead of draft content
- AI agent claims changes saved but preview doesn't update
- Preview iframe never shows draft content after agent edits
  root_cause: LivePreview used `?draft=true` but page.tsx expects `?preview=draft&token=...`
  solution_verified: true
  created: 2026-01-22
  pitfall_id: 73
  related_issues:
- USEDRAFTCONFIG_SILENT_AUTH_FAILURE.md
- FLUID_CANVAS_PREVIEW_UPDATES.md
  tags:
- preview
- url-parameters
- authentication
- draft
- token

---

## Problem Statement

When using the Website page editor:

1. AI agent makes storefront changes (e.g., "Change my headline to 'Welcome to My Amazing Business'")
2. Agent responds "Done. Headline's updated" with ✓ Storefront badge
3. Agent's `get_page_structure` confirms the new headline IS in the database
4. But the preview iframe STILL shows `[Your Transformation Headline]` (the default placeholder)

## Root Cause Analysis

### The Parameter Mismatch

**LivePreview.tsx** (line 44 - BEFORE fix):

```typescript
const previewUrl = `/t/${tenantSlug}?draft=true`;
```

**page.tsx** (line 79 - what the storefront expects):

```typescript
const isPreviewMode = preview === 'draft' && !!token;
```

Two issues:

1. **Wrong parameter name**: `draft=true` vs `preview=draft`
2. **Missing token**: Preview mode requires both `preview=draft` AND a valid authentication token

### Why Preview Mode Requires a Token

Draft content is unpublished and potentially sensitive. The storefront page validates that:

1. The request has `preview=draft` parameter
2. A valid `token` is provided
3. The token was issued for the requesting tenant

Without a valid token, the page falls back to **published content** (or defaults if no published content exists).

## Solution

### 1. Add Preview Token Hook (LivePreview.tsx)

```typescript
import { usePreviewToken } from '@/hooks/usePreviewToken';

// In component:
const { token: previewToken } = usePreviewToken();
```

### 2. Build Correct Preview URL

```typescript
const previewUrl = useMemo(() => {
  const basePath = `/t/${tenantSlug}${currentPage !== 'home' ? `/${currentPage}` : ''}`;
  const params = new URLSearchParams();
  params.set('preview', 'draft');
  if (previewToken) {
    params.set('token', previewToken);
  }
  return `${basePath}?${params.toString()}`;
}, [tenantSlug, currentPage, previewToken]);
```

## Files Changed

| File                                                                     | Change                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------- |
| `apps/web/src/app/(protected)/tenant/website/components/LivePreview.tsx` | Use `usePreviewToken` hook and correct URL format |
| `docs/solutions/ui-bugs/LIVEPREVIEW_DRAFT_URL_MISMATCH.md` (this file)   | Documentation                                     |

## Before/After

| Scenario             | Before                    | After                             |
| -------------------- | ------------------------- | --------------------------------- |
| Preview URL          | `/t/slug?draft=true`      | `/t/slug?preview=draft&token=...` |
| Agent edits headline | Shows default placeholder | Shows actual draft content        |
| Token authentication | Not included              | Auto-fetched via usePreviewToken  |
| Token refresh        | N/A                       | Auto-refreshes before expiry      |

## Prevention Strategies

### Pitfall #73: URL parameter name mismatch between producer and consumer

**Anti-pattern:**

```typescript
// Component builds URL with one param name
const url = `/page?draft=true`;

// Page expects different param name
const isDraft = searchParams.preview === 'draft';
```

**Correct pattern:**

- Use constants or shared types for URL parameter names
- Add integration tests that verify parameter passing
- Document expected URL format in comments

### Testing Checklist

- [ ] AI agent makes storefront change → preview shows updated content
- [ ] Preview URL contains `?preview=draft&token=...`
- [ ] Token auto-refreshes before 10-minute expiry
- [ ] View Live button opens published (not draft) content

## Related Issues

- **USEDRAFTCONFIG_SILENT_AUTH_FAILURE.md** - Auth errors returning defaults instead of throwing
- **FLUID_CANVAS_PREVIEW_UPDATES.md** - PostMessage handshake and smooth updates

## Keywords

LivePreview, draft, preview, token, URL parameters, authentication, storefront, Website page, iframe
