# TODO-204: No Image URL Sanitization in Frontend Components

## Priority: P1 (Critical)

## Status: Open

## Source: Code Review - Landing Page Implementation

## Description

Section components render image URLs directly from tenant config without sanitization. Even with backend validation, defense-in-depth requires frontend sanitization to prevent XSS if validation is bypassed.

## Affected Files

- `client/src/features/storefront/landing/sections/HeroSection.tsx` - backgroundImageUrl in style
- `client/src/features/storefront/landing/sections/AboutSection.tsx` - imageUrl in img src
- `client/src/features/storefront/landing/sections/TestimonialsSection.tsx` - avatarUrl in img src
- `client/src/features/storefront/landing/sections/AccommodationSection.tsx` - imageUrl in img src
- `client/src/features/storefront/landing/sections/GallerySection.tsx` - imageUrl in img src

## Current Vulnerable Pattern

```typescript
// HeroSection.tsx - Direct URL in style
<section
  style={{
    backgroundImage: config.backgroundImageUrl
      ? `url(${config.backgroundImageUrl})`
      : undefined
  }}
>

// AboutSection.tsx - Direct URL in src
<img src={config.imageUrl} alt={config.imageAlt} />
```

## Fix Required

1. Create sanitization utility:

```typescript
// client/src/lib/sanitize-url.ts
const ALLOWED_PROTOCOLS = ['https:', 'http:'];
const ALLOWED_IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;

export function sanitizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);

    // Block dangerous protocols
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      console.warn('Blocked dangerous URL protocol:', parsed.protocol);
      return undefined;
    }

    // Optionally validate image extension
    if (!ALLOWED_IMAGE_EXTENSIONS.test(parsed.pathname)) {
      console.warn('URL does not appear to be an image:', url);
      // Could return undefined or allow it based on policy
    }

    return url;
  } catch {
    console.warn('Invalid URL:', url);
    return undefined;
  }
}

export function sanitizeBackgroundUrl(url: string | undefined): string | undefined {
  const sanitized = sanitizeImageUrl(url);
  return sanitized ? `url(${sanitized})` : undefined;
}
```

2. Use in components:

```typescript
// HeroSection.tsx
import { sanitizeImageUrl } from '@/lib/sanitize-url';

export function HeroSection({ config }: HeroSectionProps) {
  const backgroundUrl = sanitizeImageUrl(config.backgroundImageUrl);

  return (
    <section
      style={{
        backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined
      }}
    >
      {/* ... */}
    </section>
  );
}

// AboutSection.tsx
export function AboutSection({ config }: AboutSectionProps) {
  const imageUrl = sanitizeImageUrl(config.imageUrl);

  return (
    <section>
      {imageUrl && (
        <img src={imageUrl} alt={config.imageAlt || ''} />
      )}
    </section>
  );
}
```

## Note

This is defense-in-depth. Primary validation should occur at the API level (TODO-200). Frontend sanitization catches edge cases where:
- Direct database manipulation occurred
- API validation was bypassed
- Migration introduced invalid data

## Acceptance Criteria

- [ ] sanitizeImageUrl utility created
- [ ] All section components use sanitization
- [ ] Dangerous protocols logged and blocked
- [ ] Graceful fallback when URL is invalid
- [ ] Unit tests for sanitization function

## Related

- TODO-200: XSS Vulnerability via javascript:/data: URI Protocols

## Tags

security, xss, frontend, landing-page, defense-in-depth
