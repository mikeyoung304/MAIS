---
title: Storefront text contrast failure — color token collision + palette WCAG violation
category: runtime-errors
date_solved: 2026-02-16
severity: P1
components:
  - TenantNav
  - TenantFooter
  - HeroSection
  - SegmentTiersSection
  - TestimonialsSection
  - ContactSection
  - FeaturesSection
  - PricingSection
  - FAQSection
  - FAQAccordion
  - ContactForm
  - TenantErrorBoundary
  - CustomerChatWidget
  - ProjectHubChatWidget
  - DateBookingWizard
symptoms:
  - Text invisible on light backgrounds (near-white #FAFAFA on cream/white surfaces)
  - WCAG AA contrast failure on accent color CTA buttons (2.4:1 vs 4.5:1 minimum)
  - Stale tenant data served from ISR cache after DB seed updates
root_cause: |
  1. Color token collision: `text-text-primary` (dark-theme token #FAFAFA) used in 14+ light-bg storefront components
  2. Default palette WCAG failure: Old accent #8B9E86 had 2.4:1 contrast ratio
  3. ISR cache drift: Next.js fetch cache serves stale data after DB updates
tags:
  - color-tokens
  - wcag-accessibility
  - tailwind-config
  - next-isr-cache
  - multi-tenant-theming
  - contrast-ratio
---

# Storefront Text Contrast Failure

## Problem

All text on tenant storefronts was invisible on light backgrounds. The heading "What brings you here?", nav brand name, and footer text were all near-white (#FAFAFA) on cream/white backgrounds.

## Root Causes

### 1. Color Token Collision (Primary)

Two color systems exist in the app:

| System              | Context                     | Token               | Resolves To              |
| ------------------- | --------------------------- | ------------------- | ------------------------ |
| Platform dark theme | Marketing pages (dark bg)   | `text-text-primary` | #FAFAFA (near-white)     |
| Tenant storefront   | Storefront pages (light bg) | `text-primary`      | CSS var(--color-primary) |

14+ storefront components incorrectly used `text-text-primary` (the dark-theme token) on light backgrounds. The naming similarity made the wrong pattern easy to copy.

**Before (broken):**

```tsx
// TenantNav.tsx — light bg (bg-white/80)
<span className="text-text-primary font-serif font-bold">{tenant.name}</span>
// → Renders #FAFAFA (near-white) on white = invisible
```

**After (fixed):**

```tsx
<span className="text-primary font-serif font-bold">{tenant.name}</span>
// → Renders var(--color-primary, #1C1917) on white = visible
```

**Token mapping applied across 14 components:**

| Old (dark-bg)             | New (light-bg)          | Purpose                        |
| ------------------------- | ----------------------- | ------------------------------ |
| `text-text-primary`       | `text-primary`          | Primary text (headings, brand) |
| `text-text-muted`         | `text-muted-foreground` | Secondary text (descriptions)  |
| `hover:text-text-primary` | `hover:text-foreground` | Hover states                   |

**Critical nuance:** Components on dark backgrounds (`bg-surface-alt`) like SegmentCard, TierCard, TextSection, and GallerySection were left unchanged — they correctly use the dark-theme tokens.

### 2. WCAG AA Contrast Failure

Old accent `#8B9E86` had only 2.4:1 contrast ratio with white text on CTA buttons. WCAG AA minimum is 4.5:1.

**New palette:**

| Token           | Old               | New                | Rationale                                |
| --------------- | ----------------- | ------------------ | ---------------------------------------- |
| primaryColor    | `#2d3436`         | `#1C1917`          | Warm stone-black (warmer than cool gray) |
| secondaryColor  | `#b8860b`         | `#A78B5A`          | Muted gold (luxury signal, less brassy)  |
| accentColor     | `#8B9E86` (2.4:1) | `#5A7C65` (4.67:1) | Deep sage — WCAG AA compliant            |
| backgroundColor | `#ffffff`         | `#FAFAF7`          | Warm ivory (reduces sterile feel)        |

Updated in: `schema.prisma` defaults, `tailwind.config.js` fallbacks, `TenantSiteShell.tsx`, seed files, chat widgets, booking wizard, `offline.html`, project hub pages.

Tailwind base tokens also warmed to match:

- `foreground`: #111827 → #292524 (stone-800)
- `muted.foreground`: #6b7280 → #78716C (stone-500)
- `border`/`input`: #e5e7eb → #e7e5e4 (stone-200)

### 3. Next.js ISR Cache Stale Data

After updating the DB via seed, Next.js continued serving old colors due to `next: { revalidate: 60 }` in `getTenantBySlug`.

**Fix during development:**

```bash
rm -rf apps/web/.next/cache/fetch-cache
```

In production, the 60-second revalidation self-heals. The API itself (`curl localhost:3001/v1/public/tenants/littlebit-farm`) returned correct values immediately — only the Next.js layer was stale.

## Files Changed

26 files, net -396 lines. All 2014 server tests pass, both workspaces typecheck clean.

## Prevention

### Token Naming Awareness

The core anti-pattern: `text-text-primary` and `text-primary` sound similar but resolve to opposite color spaces. When building tenant storefront components:

- **Light backgrounds → `text-primary`, `text-muted-foreground`, `text-foreground`**
- **Dark backgrounds (`bg-surface-alt`) → `text-text-primary`, `text-text-muted`**

### Quick Grep Check

```bash
# Find potential token collisions in tenant components
grep -r "text-text-primary\|text-text-muted" apps/web/src/components/tenant/sections/
```

If any results appear in components that render on light backgrounds, they need fixing.

### WCAG Contrast Validation

Before changing any accent/CTA color, verify contrast ratio:

- Normal text: minimum 4.5:1 (WCAG AA)
- Large text (18px+ bold or 24px+): minimum 3:1
- Tool: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

## Related Documentation

- `docs/solutions/architecture/per-tenant-css-theming-semantic-tokens-and-branding-route-fix.md` — TenantSiteShell CSS var injection architecture
- `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md` — Similar pattern: multiple sources of truth causing silent failures
- `docs/solutions/NEXTJS-ISR-AND-API-MISMATCH-PREVENTION.md` — ISR cache stale data patterns
- `docs/design/01-COLOR-CONTRAST-ANALYSIS.md` — WCAG compliance analysis
- `docs/patterns/ACCESSIBILITY_PATTERNS.md` — Accessibility patterns reference
