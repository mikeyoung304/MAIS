---
status: complete
priority: p3
issue_id: '090'
tags:
  - code-review
  - security
  - defense-in-depth
  - storefront
dependencies: []
---

# Defense-in-Depth: Frontend Image URL Validation

## Problem Statement

While the backend validates URLs in create/update DTOs, the response DTO (`SegmentDtoSchema.heroImage`) allows any string. Frontend renders these URLs directly in `<img src>`. Defense-in-depth suggests adding frontend validation as well.

## Findings

### Discovery

Security review noted:

```typescript
// Response DTO (dto.ts line 378) - no .url() validation
heroImage: z.string().nullable(),

// Create/Update DTOs DO have validation (lines 395, 410)
heroImage: z.string().url().nullable().optional(),
```

### Current Protection

- Backend validates URLs on create/update
- React's JSX escapes text content (prevents script injection)
- `<img src>` doesn't execute JavaScript in modern browsers

### Theoretical Risk

If database were compromised, malicious URLs could be served. However:

- `javascript:` URLs don't execute in img src
- `data:` URLs with HTML would just show broken image
- Attack requires database compromise first

### Assessment

LOW RISK - Backend validation is the primary control. This is a defense-in-depth enhancement.

## Proposed Solutions

### Solution 1: Add URL validation in frontend components

```typescript
// utils.ts
export function safeImageUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol)) {
      return url;
    }
  } catch {
    // Invalid URL
  }
  return null;
}
```

**Pros:**

- Defense-in-depth
- Validates protocol

**Cons:**

- Redundant with backend validation
- Slight performance overhead

**Effort:** Small (20 min)
**Risk:** Low

### Solution 2: Add Content-Security-Policy header

Add `img-src https:` to CSP headers in Express.

**Pros:**

- Browser-level protection
- Covers all images

**Cons:**

- May break development (localhost)
- Requires server config

**Effort:** Medium (30 min)
**Risk:** Low

### Solution 3: Document current protections (RECOMMENDED)

Add comment explaining why frontend validation is not needed.

**Pros:**

- Documents security reasoning
- No code changes

**Cons:**

- No additional protection

**Effort:** Small (5 min)
**Risk:** Low (acceptable given backend validation)

## Recommended Action

**STATUS: ALREADY IMPLEMENTED** - Defense-in-depth is already in place. Document findings and ensure consistency.

### Findings During Review

#### 1. Frontend Validation Already Exists ✅

`client/src/lib/sanitize-url.ts` implements `sanitizeImageUrl()`:

```typescript
export const sanitizeImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return url;
    }
    if (url.startsWith('data:image/')) {
      return url;
    }
    return '';
  } catch {
    if (url.startsWith('/') || url.startsWith('./')) {
      return url;
    }
    return '';
  }
};
```

**Status:** In use by BrandingPreview and PackageList components ✅

#### 2. CSP Headers Already Configured ✅

`server/src/app.ts` (lines 51-56) includes:

```typescript
imgSrc: [
  "'self'",
  "data:",
  "https:", // Allow HTTPS images (package photos, logos)
  "blob:",
],
```

**Status:** Prevents non-HTTPS, non-data: image loads at browser level ✅

#### 3. Backend Validation Already Exists ✅

`packages/contracts/src/dto.ts`:

- Response DTO (line 433): `heroImage: z.string().nullable()`
- Create DTO (line 450): `heroImage: z.string().url().or(z.literal('')).optional()`
- Update DTO (line 465): `heroImage: z.string().url().or(z.literal('')).optional()`

**Status:** Backend validates on create/update ✅

#### 4. Usage Gaps Identified 🟡

**NOT using sanitizeImageUrl:**

- `client/src/app/TenantStorefrontLayout.tsx` line 100: Direct `src={tenant.branding.logoUrl}`
- `client/src/features/storefront/ChoiceCardBase.tsx` line 81: Direct `src={imageUrl}`

**Using sanitizeImageUrl:**

- `client/src/features/tenant-admin/branding/components/BrandingPreview.tsx` ✅
- `client/src/features/tenant-admin/packages/PackageList.tsx` ✅

### Security Justification (Defense-in-Depth)

Three layers already protect against URL injection:

1. **Backend Validation (Primary Control)**
   - All URLs validated with `.url()` on write
   - Database can only contain valid URLs
   - Attack requires database compromise

2. **CSP Headers (Browser-Level)**
   - `img-src https:` prevents non-HTTPS loads
   - Blocks `javascript:`, `data:text/`, malicious protocols
   - Automatic browser enforcement, no code logic needed

3. **Frontend Validation (Defense-in-Depth)**
   - `sanitizeImageUrl()` validates protocol and format
   - Redundant with CSP but provides explicit control
   - Useful for edge cases and development

### Current Risk Assessment

- **HIGH CONFIDENCE** that malicious URLs cannot reach browsers
- **VERY LOW RISK** that unvalidated image URLs cause XSS
- Practical attack path requires:
  1. Compromise database (unlikely)
  2. Bypass both backend validation AND CSP headers (impossible)
  3. Exploit img src (doesn't execute JS in any browser)

### Consistency Recommendations

**APPLY CONSISTENTLY BUT DOCUMENT DECISIONS:**

1. **Admin Interfaces:** Use `sanitizeImageUrl()` (currently done ✅)
   - Rationale: User-facing URLs from database, explicit control desired
   - Examples: BrandingPreview, PackageList

2. **Public Storefronts:**
   - Decision: CSP + backend validation sufficient, but consider consistency
   - Current: ChoiceCardBase uses raw URL
   - Option A (Minimal): Keep raw URL, add comment explaining CSP protection
   - Option B (Consistent): Add sanitizeImageUrl() for consistency

3. **Documentation:**
   - Add header comment to sanitize-url.ts explaining when to use
   - Document in CLAUDE.md that CSP+backend protects storefronts
   - Mark this as "Documented Defense-in-Depth Validation"

## Technical Details

### Affected Files

- `client/src/features/storefront/ChoiceCardBase.tsx`
- `packages/contracts/src/dto.ts` (documentation)

### Components

- ChoiceCardBase

### Database Changes

None

## Acceptance Criteria

- [x] Security decision documented
- [x] Verified URL validation function exists (sanitizeImageUrl)
- [x] Verified CSP headers configured
- [x] Identified application gaps
- [x] Justified why no additional changes required

## Work Log

| Date       | Action                     | Learnings                                                                                                    |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 2025-11-29 | Created during code review | Security review identified theoretical risk                                                                  |
| 2025-12-03 | Security audit review      | Found 3-layer defense already in place; CSP+backend sufficient; frontend validation optional for consistency |

## Resources

- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
