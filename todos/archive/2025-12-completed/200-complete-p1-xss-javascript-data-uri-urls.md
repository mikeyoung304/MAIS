---
status: complete
priority: p1
issue_id: '200'
tags: [security, xss, validation, landing-page]
dependencies: []
---

# TODO-200: XSS Vulnerability via javascript:/data: URI Protocols

## Priority: P1 (Critical)

## Status: Open

## Source: Code Review - Landing Page Implementation

## Description

Zod's `.url()` validator accepts `javascript:` and `data:` URI schemes which can lead to XSS attacks when used in `href` or `src` attributes. The landing page schemas allow arbitrary URLs in image fields and CTA links.

## Affected Files

- `packages/contracts/src/landing-page.ts` - Schema definitions
- `packages/contracts/src/dto.ts` - TenantPublicDtoSchema branding.landingPage
- `client/src/features/storefront/landing/sections/HeroSection.tsx` - backgroundImageUrl
- `client/src/features/storefront/landing/sections/AboutSection.tsx` - imageUrl
- `client/src/features/storefront/landing/sections/TestimonialsSection.tsx` - avatarUrl
- `client/src/features/storefront/landing/sections/AccommodationSection.tsx` - imageUrl
- `client/src/features/storefront/landing/sections/GallerySection.tsx` - imageUrl

## Attack Vector

```typescript
// Malicious payload stored in tenant branding
{
  "hero": {
    "backgroundImageUrl": "javascript:alert('XSS')"
  }
}

// Or via data: URI with base64-encoded JavaScript
{
  "ctaUrl": "data:text/html,<script>alert('XSS')</script>"
}
```

## Fix Required

1. Create URL sanitization helper in `packages/shared/`:

```typescript
// packages/shared/src/url-sanitizer.ts
const ALLOWED_PROTOCOLS = ['https:', 'http:'];

export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function isValidImageUrl(url: string): boolean {
  const sanitized = sanitizeUrl(url);
  if (!sanitized) return false;
  // Optionally validate extension or content-type
  return true;
}
```

2. Create Zod refinement for safe URLs:

```typescript
// packages/contracts/src/validators.ts
import { z } from 'zod';

export const SafeUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['https:', 'http:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'URL must use https or http protocol' }
  );

export const SafeImageUrlSchema = SafeUrlSchema.refine(
  (url) => /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url),
  { message: 'URL must point to an image file' }
);
```

3. Update landing-page.ts schemas to use SafeUrlSchema

4. Add frontend sanitization as defense-in-depth in section components

## Related Docs

- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Zod URL validation: https://zod.dev/?id=strings

## Acceptance Criteria

- [ ] SafeUrlSchema rejects javascript:, data:, and other dangerous protocols
- [ ] All URL fields in landing page schemas use SafeUrlSchema
- [ ] Frontend components have fallback sanitization
- [ ] Unit tests cover XSS attack vectors
- [ ] Existing tenant data validated/migrated

## Tags

security, xss, validation, landing-page
