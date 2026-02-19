# 11001 — Isolate HANDLED Marketing Colors from Tenant Storefront Tokens

**Status:** pending
**Priority:** P2
**Created:** 2026-02-17

## Problem

The HANDLED marketing dark palette (`surface`, `sage`, `text-primary`) and tenant semantic tokens (`primary`, `accent`, `background`) coexist in the same `tailwind.config.js` with no CSS-level scoping. The only boundary is a grep-based test (`storefront-token-boundary.test.ts`) that checks component source code for forbidden class names.

This creates three concrete leaks:

### 1. Chrome Autofill Styling (P2)

**File:** `apps/web/src/styles/globals.css` (lines 157-174)

`:root` hardcodes `--autofill-bg: #18181B` (HANDLED dark graphite) for ALL form inputs. Tenant storefront booking forms show dark autofill backgrounds instead of matching the tenant's color scheme.

**Fix:** Use `var(--color-background, #18181B)` so tenant pages get tenant bg, platform pages get dark.

### 2. PWA Manifest (P3)

**File:** `apps/web/src/app/manifest.ts` (line 16)

`background_color: '#18181B'` applies the dark graphite splash screen to ALL routes, including tenant storefronts added to homescreen.

**Fix:** Dynamic manifest per route, or accept as low-priority since few users install PWA.

### 3. Body Background CSS Variable Scope (P2)

**File:** `apps/web/src/app/layout.tsx` (line 77)

Root layout `<body>` applies `bg-background` which resolves to `var(--color-background, #FAFAF7)` BEFORE `TenantSiteShell` can inject tenant-specific CSS variables. The fallback happens to be correct for storefronts (warm ivory), but the architecture is fragile — if the default changes, ALL tenant sites break.

**Fix:** Either:

- **Option A:** Remove `bg-background` from root `<body>`, let each layout set its own background
- **Option B:** Set `:root` CSS variables for default tenant theme, override in TenantSiteShell
- **Option C:** Move CSS variable injection to a higher-level component that wraps `<body>`

## Architectural Debt

The two color systems sharing one Tailwind config is the deeper issue:

```
HANDLED Marketing:  surface (#18181B), sage (#45B37F), text-primary (#FAFAFA)
Tenant Semantic:    primary (var), accent (var), background (var)
```

**Current boundary:** `storefront-token-boundary.test.ts` greps for forbidden patterns in `/components/tenant/`. This is fragile — a new component or import path can bypass it.

**Better boundary options:**

1. CSS Layers (`@layer marketing`, `@layer storefront`) for cascade isolation
2. Separate Tailwind configs per route group (marketing vs tenant)
3. Move marketing colors to a CSS module scoped to `/components/home/`

## Files Affected

- `apps/web/tailwind.config.js` (dual color system definition)
- `apps/web/src/styles/globals.css` (autofill hardcoding)
- `apps/web/src/app/manifest.ts` (PWA hardcoding)
- `apps/web/src/app/layout.tsx` (body bg-background)
- `apps/web/src/components/tenant/TenantSiteShell.tsx` (CSS var injection scope)
- `apps/web/src/components/tenant/__tests__/storefront-token-boundary.test.ts` (grep enforcement)

## Acceptance Criteria

- [ ] Chrome autofill respects tenant background color on storefront forms
- [ ] `<body>` background is correctly scoped per route (dark for marketing, tenant-specific for storefronts)
- [ ] No hardcoded HANDLED dark hex values affect tenant storefront rendering
- [ ] Existing storefront-token-boundary test still passes
- [ ] All 2000+ server tests pass
- [ ] Both workspaces typecheck clean
