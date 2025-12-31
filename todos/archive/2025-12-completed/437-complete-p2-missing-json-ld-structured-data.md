# Missing JSON-LD Structured Data

## Metadata

- **ID:** 437
- **Status:** pending
- **Priority:** P2
- **Tags:** seo, frontend, agent-native
- **Source:** Brand Review - Agent-Native Reviewer

## Problem Statement

The homepage has no JSON-LD structured data (schema.org markup). This hurts:

1. SEO — search engines can't understand pricing, services, or organization info
2. Agent accessibility — AI agents summarizing the page have no machine-readable data
3. Rich snippets — no enhanced search results (pricing, ratings, etc.)

## Findings

1. No `application/ld+json` script in page or metadata
2. No Organization, SoftwareApplication, or Offer schemas
3. Pricing is only human-readable, not machine-parseable
4. Service descriptions exist but aren't structured

**What agents see:** Prose text that requires NLP to understand
**What agents should see:** Structured JSON with clear pricing, features, categories

## Proposed Solutions

### Option A: Add via Next.js Metadata (Recommended)

Use Next.js metadata API to inject JSON-LD

```tsx
export const metadata: Metadata = {
  title: 'HANDLED - The Rest is Handled',
  // ... existing
};

// Add JSON-LD as script in page
export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'HANDLED',
    applicationCategory: 'BusinessApplication',
    offers: [
      { '@type': 'Offer', name: 'Handled', price: '49', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Fully Handled', price: '149', priceCurrency: 'USD' },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* rest of page */}
    </>
  );
}
```

**Pros:** Proper Next.js pattern, comprehensive
**Cons:** Slightly more complex
**Effort:** Small
**Risk:** Low

### Option B: Minimal Organization Schema Only

Just add basic organization info, skip pricing

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "HANDLED",
  "url": "https://gethandled.ai"
}
```

**Pros:** Very simple
**Cons:** Misses pricing benefits
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A — Add comprehensive structured data

## Technical Details

**Affected Files:**

- `apps/web/src/app/page.tsx` — add JSON-LD script

**Schemas to Include:**

- `Organization` — company info
- `SoftwareApplication` — product type
- `Offer` — pricing tiers
- `FAQPage` — FAQ section (enables rich snippets)

## Acceptance Criteria

- [ ] JSON-LD script present in page source
- [ ] Organization schema with name, url, description
- [ ] All three pricing tiers represented as Offers
- [ ] FAQPage schema for FAQ section
- [ ] Validates at schema.org validator

## Work Log

| Date       | Action  | Notes                                     |
| ---------- | ------- | ----------------------------------------- |
| 2025-12-27 | Created | From brand review - Agent-Native Reviewer |

## Resources

- https://schema.org/SoftwareApplication
- https://schema.org/Offer
- https://search.google.com/test/rich-results — testing tool
