# TODO-215: Missing SEO Metadata for Landing Pages

## Priority: P2 (Important)

## Status: Resolved

## Source: Code Review - Landing Page Implementation

## Resolution Date: 2025-12-03

## Description

Landing pages don't set page title, meta description, or Open Graph tags. This impacts SEO and social sharing for tenant storefronts.

## Current State

Page title remains default/static regardless of tenant or landing page content.

## Required Metadata

```html
<!-- Basic SEO -->
<title>{tenant.name} - {hero.headline}</title>
<meta name="description" content="{hero.subheadline or about.description}">

<!-- Open Graph (Facebook, LinkedIn) -->
<meta property="og:title" content="{hero.headline}">
<meta property="og:description" content="{hero.subheadline}">
<meta property="og:image" content="{hero.backgroundImageUrl}">
<meta property="og:type" content="website">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{hero.headline}">
<meta name="twitter:description" content="{hero.subheadline}">
<meta name="twitter:image" content="{hero.backgroundImageUrl}">
```

## Implementation Options

### Option A: React Helmet

```typescript
// LandingPage.tsx
import { Helmet } from 'react-helmet-async';

function LandingPageContent({ tenant }: LandingPageProps) {
  const landingPage = tenant.branding?.landingPage;
  const hero = landingPage?.hero;
  const about = landingPage?.about;

  const title = hero?.headline
    ? `${tenant.name} - ${hero.headline}`
    : tenant.name;

  const description = hero?.subheadline
    || about?.description?.slice(0, 160)
    || `Welcome to ${tenant.name}`;

  const image = hero?.backgroundImageUrl || tenant.branding?.logoUrl;

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {image && <meta property="og:image" content={image} />}
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div className="landing-page">
        {/* sections */}
      </div>
    </>
  );
}
```

### Option B: Custom Hook

```typescript
// hooks/usePageMeta.ts
import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description: string;
  image?: string;
}

export function usePageMeta({ title, description, image }: PageMeta) {
  useEffect(() => {
    document.title = title;

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`)
        || document.querySelector(`meta[property="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(name.startsWith('og:') ? 'property' : 'name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('description', description);
    setMeta('og:title', title);
    setMeta('og:description', description);
    if (image) setMeta('og:image', image);
  }, [title, description, image]);
}
```

## Schema Extension

Consider adding SEO fields to landing page config:

```typescript
export const LandingPageConfigSchema = z.object({
  // Existing fields...
  seo: z.object({
    title: z.string().max(60).optional(),
    description: z.string().max(160).optional(),
    ogImage: SafeImageUrlSchema.optional(),
  }).optional(),
});
```

## Acceptance Criteria

- [x] Page title reflects tenant name and headline
- [x] Meta description populated from content
- [x] Open Graph tags set for social sharing
- [x] Twitter card meta tags set
- [x] No duplicate meta tags
- [x] SEO audit passes basic checks

## Implementation Summary

Implemented **Option B: Custom Hook** approach since react-helmet-async was not available.

### Files Created/Modified

1. **Created:** `/Users/mikeyoung/CODING/MAIS/client/src/hooks/usePageMeta.ts`
   - Custom hook that manages page metadata via DOM manipulation
   - Sets document.title and creates/updates meta tags dynamically
   - Handles basic SEO tags, Open Graph tags, and Twitter Card tags
   - Properly distinguishes between `name` and `property` attributes

2. **Modified:** `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/LandingPage.tsx`
   - Imported and integrated `usePageMeta` hook
   - Extracts metadata from tenant landing page configuration:
     - **Title:** `{tenant.name} - {hero.headline}` (falls back to tenant name)
     - **Description:** hero.subheadline → about.description (first 160 chars) → default welcome message
     - **Image:** hero.backgroundImageUrl → tenant logo → undefined

### Metadata Set

The implementation sets the following meta tags:

```html
<!-- Basic SEO -->
<title>{tenant.name} - {hero.headline}</title>
<meta name="description" content="{description}">

<!-- Open Graph (Facebook, LinkedIn) -->
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{image}"> <!-- if available -->
<meta property="og:type" content="website">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{image}"> <!-- if available -->
```

### Validation

- TypeScript compilation successful
- Build completed without errors
- Meta tags update dynamically when tenant/content changes
- No duplicate meta tags (hook updates existing tags if present)

## Tags

seo, metadata, social-sharing, landing-page
