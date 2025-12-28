# Phase 1: Multi-Page Tenant Sites Implementation Plan

**Status:** Approved (Post-Review)
**Created:** 2025-12-25
**Updated:** 2025-12-25
**Priority:** High
**Quality Standard:** Enterprise-grade A+
**Depends On:** Next.js migration complete (Phase 1-6 done)

---

## Executive Summary

Add multi-page structure to tenant storefronts, transforming the single landing page into a full website with About, Services, FAQ, and Contact pages. This builds on the existing `/t/[slug]` infrastructure.

### Reviewer Verdicts

| Reviewer          | Verdict           | Status                  |
| ----------------- | ----------------- | ----------------------- |
| SpecFlow Analyzer | Analysis Complete | Feedback Incorporated   |
| DHH-Style         | YELLOW            | Simplified per feedback |
| Senior Engineer   | YELLOW            | Route groups added      |
| Code Simplicity   | YELLOW            | Files consolidated      |

---

## Architecture Decision

### Route Group Structure (Post-Review)

```
apps/web/src/app/t/[slug]/
├── (site)/                         # NEW: Route group for site pages
│   ├── layout.tsx                  # Shared nav + footer
│   ├── page.tsx                    # Landing page (moved)
│   ├── TenantLandingPage.tsx       # Landing component (moved)
│   ├── error.tsx                   # Error boundary
│   ├── loading.tsx                 # Loading skeleton
│   ├── about/
│   │   ├── page.tsx
│   │   ├── error.tsx
│   │   └── loading.tsx
│   ├── services/
│   │   ├── page.tsx
│   │   ├── error.tsx
│   │   └── loading.tsx
│   ├── faq/
│   │   ├── page.tsx                # Single file (inlined accordion)
│   │   ├── error.tsx
│   │   └── loading.tsx
│   └── contact/
│       ├── page.tsx
│       ├── ContactForm.tsx
│       ├── error.tsx
│       └── loading.tsx
│
├── book/                           # UNCHANGED: Booking flow (no layout)
│   ├── [packageSlug]/page.tsx
│   └── success/page.tsx
│
└── _domain/                        # Custom domain support
    ├── layout.tsx                  # Same layout as (site)
    └── ...                         # Mirror (site) structure
```

**Key Decisions:**

1. **Route groups** isolate site pages from booking flow - booking keeps its own header
2. **Custom domains** get the same layout via `_domain/layout.tsx`
3. **FAQ inlined** as single client component (not two files)
4. **Error/loading states** for every route

---

## Critical Fixes from Review

### 1. Booking Flow Isolation (Senior Engineer)

The booking page has its own "Back to {tenant}" header. Using a route group `(site)` ensures:

- Site pages (`/t/[slug]/`, `/about`, `/services`, etc.) get TenantNav + TenantFooter
- Booking pages (`/t/[slug]/book/*`) keep their standalone experience

### 2. Custom Domain Parity (Senior Engineer)

Custom domains (`janephotography.com`) route via `/t/_domain/`. Must add:

- `apps/web/src/app/t/[slug]/_domain/layout.tsx` - mirrors `(site)/layout.tsx`
- All subpages under `_domain/` with same structure

### 3. FAQ Simplification (All Reviewers)

Instead of `page.tsx` + `FAQPageClient.tsx`, use single file:

```typescript
// faq/page.tsx - Single client component with server data fetching
'use client';
// Inline accordion logic, no separate file
```

### 4. Accessibility Enhancements (SpecFlow)

Required for enterprise-grade quality:

- Skip link: "Skip to main content" in TenantNav
- ARIA labels: `aria-label="Main navigation"`, `aria-label="Footer navigation"`
- Focus trap: Mobile menu traps focus when open
- Keyboard nav: Escape closes mobile menu, Arrow keys for FAQ
- Reduced motion: Respect `prefers-reduced-motion`

### 5. Error Boundaries (SpecFlow)

Every new route needs `error.tsx` and `loading.tsx`:

- `about/error.tsx`, `about/loading.tsx`
- `services/error.tsx`, `services/loading.tsx`
- `faq/error.tsx`, `faq/loading.tsx`
- `contact/error.tsx`, `contact/loading.tsx`

---

## File Structure (Final)

```
apps/web/src/
├── app/t/[slug]/
│   ├── (site)/                          # Route group for site pages
│   │   ├── layout.tsx                   # NEW: Shared TenantLayout
│   │   ├── page.tsx                     # MOVED: Landing page
│   │   ├── TenantLandingPage.tsx        # MOVED: Landing component
│   │   ├── error.tsx                    # MOVED: Error boundary
│   │   ├── loading.tsx                  # MOVED: Loading skeleton
│   │   ├── about/
│   │   │   ├── page.tsx                 # NEW
│   │   │   ├── error.tsx                # NEW
│   │   │   └── loading.tsx              # NEW
│   │   ├── services/
│   │   │   ├── page.tsx                 # NEW
│   │   │   ├── error.tsx                # NEW
│   │   │   └── loading.tsx              # NEW
│   │   ├── faq/
│   │   │   ├── page.tsx                 # NEW (single file, inlined accordion)
│   │   │   ├── error.tsx                # NEW
│   │   │   └── loading.tsx              # NEW
│   │   └── contact/
│   │       ├── page.tsx                 # NEW
│   │       ├── ContactForm.tsx          # NEW
│   │       ├── error.tsx                # NEW
│   │       └── loading.tsx              # NEW
│   │
│   ├── book/                            # UNCHANGED (no layout inheritance)
│   │   ├── [packageSlug]/page.tsx
│   │   └── success/page.tsx
│   │
│   └── _domain/                         # Custom domain support
│       ├── layout.tsx                   # NEW: Same as (site)/layout.tsx
│       ├── page.tsx                     # EXISTING
│       ├── about/page.tsx               # NEW
│       ├── services/page.tsx            # NEW
│       ├── faq/page.tsx                 # NEW
│       └── contact/page.tsx             # NEW
│
├── components/tenant/                   # Renamed from tenant-site/
│   ├── TenantNav.tsx                    # NEW
│   └── TenantFooter.tsx                 # NEW
│
└── lib/
    └── tenant.ts                        # EXISTING (no changes)
```

**File Count:** 22 new files (down from original, accounts for error/loading states)

---

## Implementation Tasks

### Task 1: Create Shared Tenant Layout

**File:** `apps/web/src/app/t/[slug]/(site)/layout.tsx`

**Requirements:**

- Server Component fetching `getTenantStorefrontData(slug)`
- Passes tenant to TenantNav and TenantFooter
- Handles 404 with `notFound()`
- Applies `min-h-screen` and flex layout

**Acceptance Criteria:**

- [ ] Layout fetches tenant data once per request
- [ ] Navigation renders on all site pages
- [ ] Footer renders on all site pages
- [ ] 404 handling works correctly
- [ ] Booking flow does NOT inherit this layout

---

### Task 2: Create TenantNav Component

**File:** `apps/web/src/components/tenant/TenantNav.tsx`

**Requirements:**

- Client component with mobile menu state
- Skip link: "Skip to main content" (first focusable element)
- ARIA: `<nav aria-label="Main navigation">`
- Focus trap in mobile menu
- Escape key closes mobile menu
- Route change closes mobile menu
- Reduced motion support for animations

**Navigation Items:**

- Home → `/t/{slug}`
- Services → `/t/{slug}/services`
- About → `/t/{slug}/about`
- FAQ → `/t/{slug}/faq`
- Contact → `/t/{slug}/contact`
- Book Now (CTA) → `/t/{slug}#packages`

**Acceptance Criteria:**

- [ ] Skip link visible on focus
- [ ] Sticky header with blur backdrop
- [ ] Logo + tenant name displayed
- [ ] Desktop navigation links (hidden on mobile)
- [ ] Mobile hamburger menu
- [ ] Focus trapped in mobile menu when open
- [ ] Escape closes mobile menu
- [ ] "Book Now" CTA button
- [ ] Respects `prefers-reduced-motion`

---

### Task 3: Create TenantFooter Component

**File:** `apps/web/src/components/tenant/TenantFooter.tsx`

**Requirements:**

- Server component (no interactivity)
- ARIA: `<footer role="contentinfo">`, `<nav aria-label="Footer navigation">`
- `rel="noopener noreferrer"` on external links

**Acceptance Criteria:**

- [ ] Displays tenant logo and name
- [ ] Navigation links to all pages
- [ ] Copyright with dynamic year
- [ ] "Powered by MAIS" attribution with proper `rel`
- [ ] Responsive layout

---

### Task 4: Move and Refactor Landing Page

**Changes:**

1. Move `page.tsx` and `TenantLandingPage.tsx` into `(site)/`
2. Remove footer from `TenantLandingPage.tsx` (now in layout)
3. Remove `min-h-screen` (now in layout)
4. Add `id="main-content"` for skip link target

**Acceptance Criteria:**

- [ ] Footer removed from component
- [ ] Page works with new layout
- [ ] All existing sections unchanged
- [ ] No visual regression
- [ ] Skip link target exists

---

### Task 5: Create About Page

**File:** `apps/web/src/app/t/[slug]/(site)/about/page.tsx`

**Data Source:** `tenant.branding?.landingPage?.about`

**Sections:**

1. Hero with headline
2. Content with optional image (left/right position)
3. CTA section (sage background)

**SEO:**

- Title: `About | {tenant.name}`
- Description: First 160 chars of about content or fallback
- OpenGraph tags

**Acceptance Criteria:**

- [ ] Page renders with tenant about content
- [ ] Falls back to default content if not configured
- [ ] Image displays when configured (with position)
- [ ] SEO metadata generated correctly
- [ ] ISR with 60s revalidation

---

### Task 6: Create Services Page

**File:** `apps/web/src/app/t/[slug]/(site)/services/page.tsx`

**Data Source:** `packages[]`, `segments[]`

**Features:**

- Groups packages by segment (if segments exist)
- Empty state when no active packages
- Package cards with image, title, price, description, add-ons
- "Book Now" links to booking flow

**SEO:**

- Title: `Services | {tenant.name}`
- Description: "Explore our services and packages"

**Acceptance Criteria:**

- [ ] All active packages displayed
- [ ] Grouped by segment if segments exist
- [ ] Empty state for no packages
- [ ] Package cards show all details
- [ ] Add-ons displayed with pricing
- [ ] Fallback image/placeholder for packages without photos
- [ ] ISR with 60s revalidation

---

### Task 7: Create FAQ Page (Single File)

**File:** `apps/web/src/app/t/[slug]/(site)/faq/page.tsx`

**Data Source:** `tenant.branding?.landingPage?.faq`

**Requirements:**

- Single client component with inline accordion
- First item open by default
- Keyboard navigation (Arrow Up/Down between items)
- Smooth animation with reduced motion support
- Empty state when no FAQs

**Accessibility:**

- `aria-expanded` on buttons
- `aria-controls` linking to answer panels
- `id` on answer panels
- Arrow key navigation between FAQ items

**Acceptance Criteria:**

- [ ] Accordion displays all FAQ items
- [ ] First item open by default
- [ ] Keyboard navigation works (Arrow keys)
- [ ] Smooth animation (respects reduced motion)
- [ ] Empty state message when no FAQs
- [ ] ISR with 60s revalidation

---

### Task 8: Create Contact Page

**Files:**

- `apps/web/src/app/t/[slug]/(site)/contact/page.tsx`
- `apps/web/src/app/t/[slug]/(site)/contact/ContactForm.tsx`

**Form Fields:**

- Name (required)
- Email (required, validated)
- Phone (optional)
- Message (required, textarea)

**Form Behavior:**

- Client-side validation before submit
- Loading state during submission
- Success state with "Send Another" option
- Error state with retry
- **Phase 1:** Simulates success (1s delay)
- **Phase 2:** Calls `POST /v1/inquiries`

**Accessibility:**

- Labels linked to inputs via `htmlFor`
- Error messages with `aria-describedby`
- Loading state with `aria-busy`
- Focus management after submit

**Acceptance Criteria:**

- [ ] Form collects all fields
- [ ] Client-side validation works
- [ ] Loading state during submission
- [ ] Success message with reset option
- [ ] Error handling with retry
- [ ] Accessible form markup
- [ ] ISR with 60s revalidation

---

### Task 9: Create Error Boundaries

**Files:** `error.tsx` in each route folder

**Pattern:**

```typescript
'use client';
export default function Error({ error, reset }) {
  // Log error, show user-friendly message, reset button
}
```

**Acceptance Criteria:**

- [ ] Each route has error.tsx
- [ ] Errors logged via logger
- [ ] User-friendly error message
- [ ] "Try again" button calls reset()

---

### Task 10: Create Loading States

**Files:** `loading.tsx` in each route folder

**Pattern:**

- Skeleton matching page structure
- `animate-pulse` for loading animation
- No spinners (use skeletons)

**Acceptance Criteria:**

- [ ] Each route has loading.tsx
- [ ] Skeleton matches page layout
- [ ] Uses `animate-pulse`

---

### Task 11: Custom Domain Support

**Files:** Mirror `(site)/` structure in `_domain/`

**Requirements:**

- `_domain/layout.tsx` - Same as `(site)/layout.tsx`
- `_domain/about/page.tsx` - Same as `(site)/about/page.tsx`
- etc.

**Alternative:** Use a shared layout at `/t/layout.tsx` level with conditional rendering based on route.

**Acceptance Criteria:**

- [ ] Custom domain users see navigation
- [ ] All subpages work on custom domains
- [ ] No visual difference between slug and custom domain

---

### Task 12: E2E Tests

**File:** `e2e/tests/tenant-multi-page.spec.ts`

**Test Cases:**

1. Navigation between all pages (desktop)
2. Mobile menu open/close
3. Mobile navigation
4. Contact form validation
5. Contact form submission
6. FAQ accordion interaction
7. FAQ keyboard navigation
8. SEO metadata per page
9. Skip link functionality
10. Booking flow isolation (no duplicate nav)
11. Custom domain navigation (if applicable)

**Accessibility Tests:**

- Axe/Lighthouse accessibility audit
- Keyboard-only navigation
- Screen reader announcements

**Acceptance Criteria:**

- [ ] All E2E tests pass
- [ ] Lighthouse Accessibility: 90+
- [ ] Lighthouse Performance: 90+
- [ ] Lighthouse SEO: 100

---

## Success Metrics

| Metric                              | Target |
| ----------------------------------- | ------ |
| All pages render correctly          | 100%   |
| Navigation works (desktop + mobile) | 100%   |
| Lighthouse Performance              | 90+    |
| Lighthouse SEO                      | 100    |
| Lighthouse Accessibility            | 90+    |
| ISR revalidation working            | 60s    |
| Console errors                      | 0      |
| E2E tests passing                   | 100%   |
| Custom domain parity                | 100%   |
| Booking flow unchanged              | 100%   |

---

## Phase 2 Backend Work (Documented)

The following backend work is deferred to Phase 2:

### Contact Form API

```typescript
// POST /v1/inquiries
// Headers: X-Tenant-Key
// Body: { name, email, phone?, message }
// Response: { success: true, inquiryId: string }
```

**Requirements:**

- Rate limiting: 5 inquiries per IP per hour
- Email validation (beyond HTML5)
- Spam prevention (honeypot or CAPTCHA)
- Email notification to tenant
- Store in database for CRM

### Extended LandingPageConfig

```typescript
pages: {
  about: { enabled: boolean, metaTitle?: string },
  services: { enabled: boolean },
  faq: { enabled: boolean },
  contact: { enabled: boolean, showForm: boolean }
}
```

### Analytics Events

- `page_view` - Track tenant page views
- `contact_form_submitted` - Track form submissions
- `booking_started` - Track booking flow entry

---

## Resolved Questions

| Question                | Decision              | Rationale                                  |
| ----------------------- | --------------------- | ------------------------------------------ |
| Booking flow navigation | Keep separate header  | Best practice - focused booking experience |
| Custom domain parity    | Add now               | Enterprise quality requires parity         |
| Contact form backend    | Phase 2               | Simulate success, document API spec        |
| FAQ implementation      | Full accordion        | Quality over speed                         |
| Plan format             | Full plan + checklist | Both for different audiences               |

---

## Next Steps

1. Create feature branch: `feat/tenant-multi-page-sites`
2. Implement in task order (1-12)
3. Run E2E tests + Lighthouse audit
4. Deploy to staging for review
5. Production deployment after approval
