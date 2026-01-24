# feat: Comprehensive Dark Mode & UI/UX Fix Plan

**Created:** 2025-12-30
**Updated:** 2025-12-30 (Post-Review)
**Status:** Ready for Implementation
**Estimated Effort:** 8-10 hours across 7 phases
**Priority:** P0 - Blocking user experience issues
**Philosophy:** No shortcuts, no cutting corners - only what makes the best possible app

---

## Review Feedback Incorporated

This plan has been reviewed by three expert reviewers and updated accordingly:

| Reviewer                | Key Feedback                                                                  | Status          |
| ----------------------- | ----------------------------------------------------------------------------- | --------------- |
| **DHH**                 | Create shared `theme.ts`, remove card overlay entirely, establish conventions | ✅ Incorporated |
| **Kieran (TypeScript)** | Add explicit CVA types, error.tsx files, focus state consistency              | ✅ Incorporated |
| **Simplicity**          | Keep comprehensive scope per user request, but add shared utilities           | ✅ Incorporated |

---

## Overview

Fix 36+ UI/UX issues across the MAIS (HANDLED) tenant admin dashboard including dark mode compatibility, auth page consistency, missing tenant CRUD functionality, and component styling bugs.

### Problem Statement

The tenant admin dashboard suffers from multiple visual defects:

1. **Invisible stat card numbers** - Card overlay blur (`before:from-white/80`) obscures text
2. **Undefined color tokens** - `text-sage-700` in Badge component doesn't exist
3. **Inconsistent theming** - Auth pages mix dark backgrounds with light Card components
4. **Missing features** - Tenant CRUD exists in backend but not in Next.js admin UI
5. **Growth Assistant errors** - Connection failures with no graceful fallback

### Root Cause Analysis

| Issue              | Root Cause                        | File:Line            |
| ------------------ | --------------------------------- | -------------------- |
| Invisible numbers  | Card pseudo-element overlay       | `card.tsx:18`        |
| Blurred text       | `before:from-white/80` gradient   | `card.tsx:18`        |
| Badge unreadable   | `sage-700` undefined in Tailwind  | `badge.tsx:13`       |
| Auth inconsistency | Card uses `bg-white` default      | `card.tsx:14`        |
| Dark mode broken   | No `darkMode` setting in Tailwind | `tailwind.config.js` |

---

## Technical Approach

### Architecture Decision

**Context-based theming** (not system preference):

- Auth pages → Always dark (`bg-surface`)
- Marketing pages → Always light (`bg-white`)
- Admin dashboard → Dark theme to match auth flow
- Tenant storefronts → Per-tenant configurable (future)

This matches ADR-017 and avoids complexity of `next-themes` or `prefers-color-scheme`.

### Color Token Strategy

```typescript
// Already defined in tailwind.config.js - USE THESE:
surface: '#18181B',        // Dark backgrounds
'surface-alt': '#27272A',  // Cards on dark
sage: '#45B37F',           // Primary accent
'text-primary': '#FAFAFA', // Light text
'text-muted': '#A1A1AA',   // Secondary text

// Per DHH review: Don't add sage-700 for a typo. Use existing text-sage instead.
```

### Shared Theme Utilities (NEW - Per DHH Review)

Create a single source of truth for dark theme styles:

**File to create:** `apps/web/src/lib/theme.ts`

```typescript
// lib/theme.ts - Shared dark theme constants
export const darkFormStyles = {
  input:
    'bg-surface border-neutral-700 text-text-primary placeholder:text-text-muted/60 focus:border-sage focus:ring-2 focus:ring-sage/20 focus:outline-none hover:border-neutral-600 transition-colors duration-200',
  card: 'bg-surface-alt border-neutral-700 text-text-primary',
  label: 'text-text-primary font-medium',
  muted: 'text-text-muted',
} as const;

export const darkAlertStyles = {
  error: 'bg-red-950/50 text-red-400 border-red-800',
  warning: 'bg-amber-950/50 text-amber-400 border-amber-800',
  success: 'bg-green-950/50 text-green-400 border-green-800',
  info: 'bg-blue-950/50 text-blue-400 border-blue-800',
} as const;

export type DarkFormStyleKey = keyof typeof darkFormStyles;
export type DarkAlertStyleKey = keyof typeof darkAlertStyles;
```

---

## Implementation Phases

### Phase 1: Foundation (45 min)

**Goal:** Fix blocking issues and establish shared conventions

| Task                    | File                                      | Change                                                       |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| Create shared theme.ts  | `apps/web/src/lib/theme.ts`               | NEW - shared dark theme constants                            |
| Fix Badge component     | `apps/web/src/components/ui/badge.tsx:13` | Change `text-sage-700` to `text-sage` (use existing token)   |
| **Remove** Card overlay | `apps/web/src/components/ui/card.tsx:18`  | DELETE the `before:from-white/80` overlay entirely (per DHH) |

**Acceptance Criteria:**

- [ ] `theme.ts` created with typed exports
- [ ] Badge text uses `text-sage` (visible on all backgrounds)
- [ ] Card overlay completely removed (not conditionalized)
- [ ] Card content is crisp and readable

**Test:** Run `npm run typecheck` - no errors

---

### Phase 2: Core UI Components (75 min)

**Goal:** Update base components with dark mode variants using explicit CVA types

| Component | File                      | Current                        | Target                                | CVA Change                           |
| --------- | ------------------------- | ------------------------------ | ------------------------------------- | ------------------------------------ |
| Card      | `card.tsx`                | `bg-white text-neutral-900`    | Add `dark` to colorScheme union       | Explicit type definition             |
| Input     | `input.tsx`               | `bg-white`                     | Document className override pattern   | No component change (use `theme.ts`) |
| Dialog    | `dialog.tsx:56,63,93,107` | `bg-white`, `text-neutral-900` | `bg-surface-alt`, `text-text-primary` | Add close button dark styling        |
| Label     | `label.tsx:10`            | `text-neutral-800`             | `text-text-primary`                   | Simple class change                  |
| Switch    | `switch.tsx:52,60`        | `bg-neutral-200`, `bg-white`   | `bg-neutral-700`, `bg-surface`        | Simple class changes                 |
| Sheet     | `sheet.tsx`               | Light colors                   | Dark variants                         | Add dark styling                     |

#### Card Component CVA Update (Per Kieran Review)

```typescript
// card.tsx - Add explicit dark variant to colorScheme
colorScheme: {
  default: [
    'bg-white text-neutral-900',
    'shadow-elevation-2 hover:shadow-elevation-3',
    'border border-neutral-100/30',
    'hover:-translate-y-0.5',
  ],
  dark: [
    'bg-surface-alt text-text-primary',
    'shadow-elevation-2 hover:shadow-elevation-3',
    'border border-neutral-700',
    'hover:-translate-y-0.5',
  ],
  // ... other existing variants
}
```

#### Input Component Strategy (Per Kieran Review)

**Decision:** Keep Input component generic, use className overrides at usage site.

- This is the existing pattern in signup.tsx
- Import from `theme.ts` for consistency:

```typescript
import { darkFormStyles } from '@/lib/theme';

<Input className={darkFormStyles.input} />
```

#### Dialog Close Button Fix (Per Kieran Review)

```typescript
// dialog.tsx line 63-66 - Update close button for dark mode
<DialogPrimitive.Close className="... bg-surface-alt hover:bg-neutral-700 ...">
  <X className="h-4 w-4 text-text-muted" />
</DialogPrimitive.Close>
```

#### Focus State Consistency (Per Kieran Review)

All dark mode components must use sage for focus, not orange:

```typescript
// CORRECT (dark contexts)
'focus:border-sage focus:ring-2 focus:ring-sage/20';

// WRONG (light mode pattern)
'focus:border-macon-orange focus:ring-macon-orange/30';
```

**Acceptance Criteria:**

- [ ] Card component has typed `colorScheme: 'dark'` variant
- [ ] All base UI components render correctly on dark backgrounds
- [ ] Focus states use sage accent (not orange) in dark contexts
- [ ] Placeholder text is visible but muted
- [ ] Dialog close button visible on dark background

---

### Phase 3: Admin Dashboard (90 min)

**Goal:** Fix the visible dashboard issues

#### 3A. AdminSidebar

**File:** `apps/web/src/components/layouts/AdminSidebar.tsx`

| Line | Current    | Target           |
| ---- | ---------- | ---------------- |
| 148  | `bg-white` | `bg-surface-alt` |
| 165  | `bg-white` | `bg-surface-alt` |

#### 3B. Tenant Dashboard Page

**File:** `apps/web/src/app/(protected)/tenant/dashboard/page.tsx`

| Line | Current          | Target           |
| ---- | ---------------- | ---------------- |
| 196  | `bg-red-50`      | `bg-red-950/50`  |
| 230  | `bg-neutral-200` | `bg-neutral-700` |

#### 3C. GrowthAssistantPanel

**File:** `apps/web/src/components/agent/GrowthAssistantPanel.tsx`

| Line | Current    | Target           |
| ---- | ---------- | ---------------- |
| 76   | `bg-white` | `bg-surface-alt` |
| 85   | `bg-white` | `bg-surface-alt` |

#### 3D. PanelAgentChat

**File:** `apps/web/src/components/agent/PanelAgentChat.tsx`

| Line    | Current         | Target           |
| ------- | --------------- | ---------------- |
| 319     | `bg-neutral-50` | `bg-surface`     |
| 350     | `bg-white`      | `bg-surface-alt` |
| 362-363 | Light colors    | Dark equivalents |

#### 3E. Other Admin Pages

- `tenant/settings/page.tsx` - Fix `bg-neutral-50` inputs
- `tenant/payments/page.tsx` - Fix `bg-red-50`, `bg-yellow-50` alerts
- `tenant/billing/page.tsx` - Fix `bg-green-50`, `bg-amber-50` cards
- `tenant/branding/page.tsx` - Fix error/success card colors

**Alert Color Mappings:**

```typescript
// Error states
bg-red-50    → bg-red-950/50
text-red-700 → text-red-400

// Warning states
bg-yellow-50  → bg-yellow-950/50
bg-amber-50   → bg-amber-950/50
text-amber-800 → text-amber-400

// Success states
bg-green-50  → bg-green-950/50
text-green-700 → text-green-400
```

**Acceptance Criteria:**

- [ ] Stat card numbers are clearly visible
- [ ] Quick action card text is readable
- [ ] Error/warning/success alerts have proper contrast
- [ ] Sidebar matches page theme

---

### Phase 4: Auth Page Consistency (45 min)

**Goal:** Make all auth pages match signup (gold standard)

#### 4A. Login Page

**File:** `apps/web/src/app/login/page.tsx`

- Line 194: Page has `bg-surface` ✓
- **Issue:** Card component uses default (white) variant
- **Fix:** Pass `colorScheme="dark"` or use inline classes

#### 4B. Forgot Password Page

**File:** `apps/web/src/app/forgot-password/page.tsx`

| Issue              | Line    | Fix                             |
| ------------------ | ------- | ------------------------------- |
| Card uses white bg | 70      | Add dark classes                |
| Logo says "MAIS"   | 123     | Change to "HANDLED"             |
| Input light styled | Various | Apply `inputBaseStyles` pattern |

#### 4C. Reset Password Page

**File:** `apps/web/src/app/reset-password/page.tsx`

Same fixes as forgot-password:

- Dark Card background
- Dark Input styling
- Consistent logo branding

**Acceptance Criteria:**

- [ ] All 4 auth pages visually identical in theme
- [ ] Logo consistently says "HANDLED"
- [ ] Form inputs use sage focus states
- [ ] Chrome autofill doesn't flash white

---

### Phase 5: Tenant Storefront Components (60 min)

**Goal:** Update public-facing tenant components

| Component           | File                                                 | Priority |
| ------------------- | ---------------------------------------------------- | -------- |
| TenantNav           | `components/tenant/TenantNav.tsx`                    | P1       |
| TenantFooter        | `components/tenant/TenantFooter.tsx`                 | P1       |
| PricingSection      | `components/tenant/sections/PricingSection.tsx`      | P1       |
| TestimonialsSection | `components/tenant/sections/TestimonialsSection.tsx` | P1       |
| ContactForm         | `components/tenant/ContactForm.tsx`                  | P1       |
| FAQSection          | `components/tenant/sections/FAQSection.tsx`          | P2       |
| GallerySection      | `components/tenant/sections/GallerySection.tsx`      | P2       |
| HeroSection         | `components/tenant/sections/HeroSection.tsx`         | P2       |
| TextSection         | `components/tenant/sections/TextSection.tsx`         | P2       |
| CTASection          | `components/tenant/sections/CTASection.tsx`          | P2       |

**Note:** Tenant storefronts should remain **light themed** for now (marketing context). Only fix hardcoded colors that break in any context.

**Acceptance Criteria:**

- [ ] Components use semantic tokens, not hardcoded colors
- [ ] Borders and backgrounds work on both light/dark contexts
- [ ] No `bg-white` without fallback consideration

---

### Phase 6: Missing Features (120 min)

**Goal:** Add tenant CRUD to Next.js admin with proper error handling

#### 6A. Create Tenant Page

**Files to create:**

- `apps/web/src/app/(protected)/admin/tenants/new/page.tsx` (Server Component)
- `apps/web/src/app/(protected)/admin/tenants/new/error.tsx` (Required per Kieran)
- `apps/web/src/components/admin/NewTenantForm.tsx` (Client Component)

**Architecture (Per Kieran Review):**

```typescript
// page.tsx (Server Component)
export default async function NewTenantPage() {
  return <NewTenantForm />;
}

// NewTenantForm.tsx (Client Component)
'use client';
export function NewTenantForm() {
  // Form state, validation, submission
}
```

**Requirements:**

- Form fields: name, slug (auto-generated), commission %
- Call `POST /v1/admin/tenants` via API proxy
- Show generated secret key ONCE after creation (modal with copy button)
- Redirect to `/admin/tenants` on success
- Use `darkFormStyles` from `theme.ts`

**Backend already implemented:** `server/src/routes/admin/tenants.routes.ts:64-111`

#### 6B. Edit Tenant Page

**Files to create:**

- `apps/web/src/app/(protected)/admin/tenants/[id]/page.tsx` (Server Component)
- `apps/web/src/app/(protected)/admin/tenants/[id]/error.tsx` (Required per Kieran)
- `apps/web/src/components/admin/EditTenantForm.tsx` (Client Component)

**Requirements:**

- Fetch tenant via `GET /v1/admin/tenants/:id`
- Edit fields: name, commission, isActive
- Call `PUT /v1/admin/tenants/:id` on save
- Add "Deactivate" button with confirmation dialog (soft delete)
- Use `darkFormStyles` from `theme.ts`

**Backend already implemented:** `server/src/routes/admin/tenants.routes.ts:149-199`

#### 6C. Search/Filter on Tenants List

**File:** `apps/web/src/app/(protected)/admin/tenants/page.tsx`

**Add:**

- Search input (filter by name, slug, email) - client-side filtering
- Status filter (active/inactive)
- Sort by (name, created date)
- "Create Tenant" button linking to `/admin/tenants/new`

**API Contract Verification (Per Kieran Review):**
Before implementation, verify:

- [ ] `POST /v1/admin/tenants` returns `{ tenant, secretKey }` shape
- [ ] `PUT /v1/admin/tenants/:id` accepts `{ name, commission, isActive }`
- [ ] `DELETE /v1/admin/tenants/:id` returns 204

**Acceptance Criteria:**

- [ ] Can create new tenant from Next.js admin
- [ ] Can edit existing tenant details
- [ ] Can deactivate tenant (soft delete)
- [ ] Can search/filter tenant list
- [ ] Secret key shown once on creation
- [ ] All new routes have `error.tsx` files
- [ ] Forms use shared `darkFormStyles`

---

### Phase 7: Bug Fixes (30 min)

#### 7A. Growth Assistant Connection Error

**File:** `apps/web/src/components/agent/PanelAgentChat.tsx:106-118`

**Investigation needed:**

- Check if backend agent service is running
- Verify `/api/agent/health` endpoint responds
- Add better error state UI with retry button

#### 7B. ImpersonationBanner Colors

**File:** `apps/web/src/components/layouts/ImpersonationBanner.tsx`

| Current            | Target            |
| ------------------ | ----------------- |
| `bg-orange-500/10` | `bg-amber-500/20` |
| `text-orange-700`  | `text-amber-400`  |

#### 7C. TrialBanner Colors

**File:** `apps/web/src/components/trial/TrialBanner.tsx`

| Current          | Target            |
| ---------------- | ----------------- |
| `bg-amber-50`    | `bg-amber-950/50` |
| `text-amber-800` | `text-amber-400`  |

---

## Quality Gates

### Functional Requirements

- [ ] All stat card values visible and readable
- [ ] All quick action cards have legible text
- [ ] Auth pages have consistent dark theme
- [ ] Admin can create/edit/delete tenants
- [ ] Search/filter works on tenant list

### Non-Functional Requirements

- [ ] WCAG AA contrast ratios maintained (4.5:1 minimum)
- [ ] No SSR hydration warnings in console
- [ ] Page load under 2 seconds
- [ ] No layout shift on theme application

### Testing Requirements (Expanded Per Kieran Review)

#### Automated Testing

- [ ] `npm run typecheck` passes (zero errors)
- [ ] `npm test` passes (99%+ tests, 1196/1200 minimum)
- [ ] Visual regression with Playwright: `npm run test:e2e`

#### Accessibility Testing

- [ ] Run axe-core audit on all modified pages
- [ ] Verify contrast ratios with WebAIM Contrast Checker:

| Combination                                 | Expected Ratio | Verified |
| ------------------------------------------- | -------------- | -------- |
| text-primary (#FAFAFA) on surface (#18181B) | >4.5:1         | [ ]      |
| text-muted (#A1A1AA) on surface (#18181B)   | >4.5:1         | [ ]      |
| sage (#45B37F) on surface (#18181B)         | >4.5:1         | [ ]      |
| sage (#45B37F) on surface-alt (#27272A)     | >4.5:1         | [ ]      |
| red-400 on red-950/50                       | >4.5:1         | [ ]      |
| amber-400 on amber-950/50                   | >4.5:1         | [ ]      |
| green-400 on green-950/50                   | >4.5:1         | [ ]      |

#### Cross-Browser Testing

- [ ] Chrome (primary)
- [ ] Safari (dark mode input quirks)
- [ ] Firefox (autofill styling)

#### Manual Testing

- [ ] Test all 4 auth pages visually match
- [ ] Test tenant dashboard with real tenant data
- [ ] Test Chrome autofill on all dark forms
- [ ] Test tenant CRUD flow end-to-end
- [ ] Test Growth Assistant panel connection

#### Hydration Mismatch Test (Per Kieran Review)

Add to E2E test suite:

```typescript
test('no hydration mismatch on dashboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('Hydration')) errors.push(msg.text());
  });
  await page.goto('/tenant/dashboard');
  expect(errors).toHaveLength(0);
});
```

---

## Risk Analysis & Mitigation

| Risk                                 | Impact | Likelihood | Mitigation                                    |
| ------------------------------------ | ------ | ---------- | --------------------------------------------- |
| Breaking existing light-themed pages | High   | Medium     | Use additive variants, don't modify defaults  |
| SSR hydration mismatch               | Medium | Low        | Use `suppressHydrationWarning` where needed   |
| Accessibility regression             | High   | Low        | Run contrast checker after each phase         |
| Tenant CRUD API mismatch             | Medium | Low        | Backend already tested, use existing patterns |

---

## Files to Modify (Complete List)

### Config (1 file)

- `apps/web/tailwind.config.js`

### Base UI Components (7 files)

- `apps/web/src/components/ui/card.tsx`
- `apps/web/src/components/ui/badge.tsx`
- `apps/web/src/components/ui/input.tsx`
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/label.tsx`
- `apps/web/src/components/ui/switch.tsx`
- `apps/web/src/components/ui/sheet.tsx`

### Layout Components (3 files)

- `apps/web/src/components/layouts/AdminSidebar.tsx`
- `apps/web/src/components/layouts/ImpersonationBanner.tsx`
- `apps/web/src/components/trial/TrialBanner.tsx`

### Agent Components (2 files)

- `apps/web/src/components/agent/GrowthAssistantPanel.tsx`
- `apps/web/src/components/agent/PanelAgentChat.tsx`

### Auth Pages (3 files)

- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/forgot-password/page.tsx`
- `apps/web/src/app/reset-password/page.tsx`

### Admin Pages (6 files)

- `apps/web/src/app/(protected)/tenant/dashboard/page.tsx`
- `apps/web/src/app/(protected)/tenant/settings/page.tsx`
- `apps/web/src/app/(protected)/tenant/payments/page.tsx`
- `apps/web/src/app/(protected)/tenant/billing/page.tsx`
- `apps/web/src/app/(protected)/tenant/branding/page.tsx`
- `apps/web/src/app/(protected)/admin/tenants/page.tsx`

### New Files to Create (8 files)

- `apps/web/src/lib/theme.ts` (shared dark theme constants)
- `apps/web/src/app/(protected)/admin/tenants/new/page.tsx`
- `apps/web/src/app/(protected)/admin/tenants/new/error.tsx`
- `apps/web/src/app/(protected)/admin/tenants/[id]/page.tsx`
- `apps/web/src/app/(protected)/admin/tenants/[id]/error.tsx`
- `apps/web/src/components/admin/NewTenantForm.tsx`
- `apps/web/src/components/admin/EditTenantForm.tsx`
- `e2e/tests/dark-mode-hydration.spec.ts` (hydration mismatch test)

### Tenant Sections (10 files)

- `apps/web/src/components/tenant/TenantNav.tsx`
- `apps/web/src/components/tenant/TenantFooter.tsx`
- `apps/web/src/components/tenant/ContactForm.tsx`
- `apps/web/src/components/tenant/sections/PricingSection.tsx`
- `apps/web/src/components/tenant/sections/TestimonialsSection.tsx`
- `apps/web/src/components/tenant/sections/FAQSection.tsx`
- `apps/web/src/components/tenant/sections/GallerySection.tsx`
- `apps/web/src/components/tenant/sections/HeroSection.tsx`
- `apps/web/src/components/tenant/sections/TextSection.tsx`
- `apps/web/src/components/tenant/sections/CTASection.tsx`

---

## References

### Internal Documentation

- ADR-017: `docs/adrs/ADR-017-dark-theme-auth-pages.md`
- Brand Voice Guide: `docs/design/BRAND_VOICE_GUIDE.md`
- Dark Mode Analysis: `plans/DARK_MODE_ANALYSIS.md`

### Gold Standard Implementation

- Signup page: `apps/web/src/app/signup/page.tsx:207-209` (input styles)
- Signup page: `apps/web/src/app/signup/page.tsx:240` (card dark styling)

### Backend API Reference

- Tenant CRUD: `server/src/routes/admin/tenants.routes.ts:64-199`
- Auth routes: `server/src/routes/auth.routes.ts`

---

## Success Metrics

1. **Visual:** All dashboard text readable without squinting
2. **Functional:** Tenant CRUD complete in Next.js admin
3. **Consistency:** All auth pages visually identical
4. **Performance:** No increase in bundle size > 5KB
5. **Quality:** Zero new TypeScript errors
