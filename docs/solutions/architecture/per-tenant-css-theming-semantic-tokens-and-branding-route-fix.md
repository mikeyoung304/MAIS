---
title: Per-Tenant CSS Theming with Semantic Tokens and Branding Route Fix
category: architecture
severity: p1
component: TenantSiteShell / branding routes
tags:
  - css-custom-properties
  - tailwind
  - theming
  - data-flow
  - silent-failure
  - branding
  - agent-tools
  - font-presets
  - google-fonts
date_resolved: 2026-02-16
pr: '#56'
related:
  - docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md
  - docs/solutions/HANDLED_HOMEPAGE_BRANDING_FIX.md
  - docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md
  - docs/solutions/architecture/app-router-route-tree-deduplication-domain-vs-slug-pattern.md
---

# Per-Tenant CSS Theming with Semantic Tokens and Branding Route Fix

## Problem

MAIS needed per-tenant visual theming — each tenant sets their own colors and fonts via the agent's `update_branding` tool. Two interconnected problems surfaced:

1. **Architecture challenge:** Tailwind generates classes at build time, but tenant colors are data-driven (stored in DB columns). How do you bridge static CSS tooling with runtime data?
2. **Silent bug:** The branding routes (both agent internal route and tenant-admin route) wrote color updates to the `branding` JSON blob, but `TenantSiteShell` reads from **dedicated columns** (`primaryColor`, `accentColor`, `fontPreset`). Agent branding updates had **zero effect** on the live theme.
3. **Color collision:** `sage` (#45B37F) was used on both platform marketing pages and tenant storefronts. Remapping it to a CSS var would break platform pages.

### Symptoms

- Agent calls `update_branding` with new colors → gets 200 OK → but tenant site colors don't change
- No error messages anywhere — the write "succeeded" (to the wrong storage location)
- Test suite passed because it asserted the JSON blob was updated (which it was)

## Root Cause

When dedicated color columns (`primaryColor`, `secondaryColor`, `accentColor`, `backgroundColor`, `fontPreset`) were added to the Tenant model for CSS vars theming, the branding routes were never updated to write to them. They continued writing to the legacy `branding` JSON blob.

```
Agent tool → /storefront/update-branding → writes to tenant.branding JSON ✓
TenantSiteShell → reads from tenant.primaryColor column → gets old default ✗
```

## Solution

### 1. CSS Custom Properties as Tailwind Bridge

Use CSS custom properties to bridge Tailwind's static config with runtime tenant data.

**TenantSiteShell injects CSS vars from tenant data:**

```typescript
// apps/web/src/components/tenant/TenantSiteShell.tsx
import { FONT_PRESETS } from '@macon/contracts';

const fontPreset = FONT_PRESETS[tenant.fontPreset || 'classic'] || FONT_PRESETS.classic;

const themeVars = {
  '--color-primary': tenant.primaryColor || '#2d3436',
  '--color-secondary': tenant.secondaryColor || '#b8860b',
  '--color-accent': tenant.accentColor || '#8B9E86',
  '--color-background': tenant.backgroundColor || '#ffffff',
  '--font-heading': `'${fontPreset.heading}', ${fontPreset.headingFallback}`,
  '--font-body': `'${fontPreset.body}', ${fontPreset.bodyFallback}`,
} as React.CSSProperties;

return (
  <div className="flex min-h-screen flex-col bg-background" style={themeVars}>
    {children}
  </div>
);
```

**Tailwind config maps semantic tokens to CSS vars with fallbacks:**

```javascript
// apps/web/tailwind.config.js
colors: {
  primary: { DEFAULT: 'var(--color-primary, #2d3436)' },
  secondary: { DEFAULT: 'var(--color-secondary, #b8860b)' },
  accent: { DEFAULT: 'var(--color-accent, #8B9E86)' },
  background: 'var(--color-background, #ffffff)',
},
fontFamily: {
  heading: 'var(--font-heading, Inter, system-ui, sans-serif)',
  body: 'var(--font-body, Inter, system-ui, sans-serif)',
}
```

Components use Tailwind classes normally: `text-accent`, `bg-primary`, `font-heading`. When no CSS vars are injected (platform pages), hardcoded fallbacks kick in.

### 2. Platform vs Tenant Color Separation

Two-tier color system with distinct semantic roles:

- `sage` = platform brand color (fixed `#45B37F`, used on marketing pages)
- `accent` = tenant CSS var (default `#8B9E86`, overridden per-tenant)

```tsx
// Platform pages (gethandled.ai)
<Button variant="sage">Join Waitlist</Button>

// Tenant storefronts (tenant.gethandled.ai)
<Button variant="accent">Book Session</Button>
```

Added `accent` Button variant. Migrated 25+ tenant components: `sage` → `accent`, `font-serif` → `font-heading`.

### 3. Branding Route Fix — Write to Dedicated Columns

**Before (broken):**

```typescript
// Writes to JSON blob — CSS vars never see this
const updatedBranding = { ...currentBranding, primaryColor: branding.primaryColor };
await tenantRepo.update(tenantId, { branding: updatedBranding });
```

**After (fixed):**

```typescript
// Writes to dedicated columns that TenantSiteShell actually reads
const updateData: Record<string, string> = {};
if (branding.primaryColor) updateData.primaryColor = branding.primaryColor;
if (branding.accentColor) updateData.accentColor = branding.accentColor;
if (branding.fontPreset) updateData.fontPreset = branding.fontPreset;

// Logo stays in JSON blob (not a dedicated column)
if (branding.logoUrl) {
  const currentBranding = (tenant.branding || {}) as Record<string, unknown>;
  (updateData as Record<string, unknown>).branding = {
    ...currentBranding,
    logoUrl: branding.logoUrl,
  };
}

await tenantRepo.update(tenantId, updateData);
```

Applied to both `internal-agent-storefront.routes.ts` and `tenant-admin-branding.routes.ts`.

### 4. Dynamic Fonts in Next.js

`next/font/google` only works for fonts known at build time. Per-tenant fonts are data-driven.

**Solution:** Google Fonts `<link>` tags in component body:

```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link href={fontPreset.googleFontsUrl} rel="stylesheet" />
```

Google Fonts includes `font-display: swap` by default, preventing layout shift.

### 5. Semi-transparent CSS Var Colors

Tailwind opacity modifiers (`bg-accent/10`) don't work with CSS vars. Use CSS `color-mix()`:

```typescript
const DAY_PICKER_STYLE = {
  '--rdp-accent-color': 'var(--color-accent, #8B9E86)',
  '--rdp-accent-background-color':
    'color-mix(in srgb, var(--color-accent, #8B9E86) 12%, transparent)',
} as React.CSSProperties;
```

## Prevention Strategies

### Data Flow Disconnection

- [ ] **Mark authoritative source in code.** When a feature has both legacy and new storage: `// AUTHORITATIVE: Colors read from dedicated columns, NOT branding JSON`
- [ ] **Write-read symmetry tests.** Every write test must also verify the **UI read path** returns the written data — not just that the write target was called
- [ ] **Test the integration, not just the mock.** The existing test asserted `mockTenantRepo.update` was called with `{ branding: { ... } }` — technically correct but testing the wrong storage location

### Platform vs Tenant Isolation

- [ ] **Structural separation of color constants.** `sage` = platform (fixed), `accent` = tenant (CSS var). Never use platform color names in tenant components
- [ ] **Grep guard in CI.** `grep -r "text-sage\|bg-sage" apps/web/src/components/tenant/ && exit 1` catches accidental platform color usage in tenant scope

### Constants Sync for Cloud Run Agents

- [ ] **Always pair constant copies with sync tests.** Every local copy in `agent-v2/deploy/*/src/constants/` must have a corresponding entry in `constants-sync.test.ts`
- [ ] **Use the existing pattern:** Import canonical from `@macon/contracts`, import agent copy, sort and compare

## Key Takeaways

1. **Storage Authority Must Be Explicit in Code.** When dedicated columns coexist with a JSON blob, mark which is canonical. The silent failure happened because both locations "worked" — writes succeeded, reads succeeded, they just targeted different tables.

2. **Tests Must Follow the UI Read Path.** The bug passed the test suite because the test verified `update(tenantId, { branding: { ... } })` was called. The test should have verified: "after updating branding, does `findBySlugPublic()` return the new color?"

3. **CSS vars + Tailwind fallbacks enable zero-config theming.** Components never need `if (tenant.accentColor) {...}` conditionals. The CSS var fallback chain handles everything: `var(--color-accent, #8B9E86)` works whether or not TenantSiteShell injected vars.

4. **Silent bugs are worse than loud ones.** The agent returned a 200 response with `"success": true`. Add correctness assertions beyond HTTP status — verify writes target the storage that reads actually use.

5. **`color-mix()` solves the CSS var opacity problem.** When you need `bg-accent/10` but `accent` is a CSS var, use `color-mix(in srgb, var(--color-accent) 10%, transparent)` instead.
