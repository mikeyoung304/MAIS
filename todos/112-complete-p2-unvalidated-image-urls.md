---
status: complete
priority: p2
issue_id: "112"
tags: [code-review, security, ui-redesign]
dependencies: []
---

# Unvalidated Image URLs from User Input

## Problem Statement

Package photos and logo URLs are rendered without validation. An attacker could inject malicious URLs (javascript:, data:, or external tracking pixels).

**Why it matters:** Potential XSS in older browsers, tracking pixel injection.

## Findings

### From security-sentinel agent:

**Files affected:**
- `client/src/features/tenant-admin/packages/PackageList.tsx` (line 94)
- `client/src/features/tenant-admin/branding/components/BrandingPreview.tsx` (line 53)

```typescript
// No validation
<img src={pkg.photos[0].url} alt={`${pkg.title} preview`} />
<img src={logoUrl} alt="Logo Preview" />
```

## Proposed Solutions

### Solution 1: Create URL Sanitizer Utility (Recommended)
**Pros:** Defense in depth
**Cons:** Minimal overhead
**Effort:** Small (1 hour)
**Risk:** Low

```typescript
// lib/sanitize-url.ts
export const sanitizeImageUrl = (url: string | undefined): string => {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return url;
    if (url.startsWith('data:image/')) return url;
    return ''; // Invalid protocol
  } catch {
    return '';
  }
};

// Usage
<img
  src={sanitizeImageUrl(pkg.photos[0]?.url)}
  onError={(e) => e.currentTarget.src = '/fallback-image.png'}
/>
```

## Acceptance Criteria

- [ ] sanitizeImageUrl utility created
- [ ] Applied to all user-uploaded image sources
- [ ] Fallback image displayed on error
- [ ] CSP headers added for javascript: URL protection

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-30 | Created from code review | Security concern identified |
