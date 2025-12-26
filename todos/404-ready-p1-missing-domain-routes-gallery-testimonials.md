---
status: complete
priority: p1
issue_id: "404"
tags:
  - code-review
  - next-js
  - routing
  - locked-template-system
dependencies: []
---

# Missing _domain Routes for Gallery/Testimonials

## Problem Statement

The Locked Template System added new gallery and testimonials pages at `/t/[slug]/(site)/gallery` and `/t/[slug]/(site)/testimonials`, but corresponding `_domain` routes were not created. This means custom domain tenants cannot access these new pages.

**Why This Matters:**
- Custom domain tenants (e.g., `myphotography.com`) get 404 errors when visiting `/gallery` or `/testimonials`
- Inconsistent user experience between slug routes and domain routes
- The feature is incomplete for production use

## Findings

**Location:** `apps/web/src/app/t/_domain/`

**Evidence:**
- `_domain/about/`, `_domain/contact/`, `_domain/faq/`, `_domain/services/` exist
- `_domain/gallery/` and `_domain/testimonials/` are MISSING
- Each _domain route should mirror the corresponding [slug]/(site) route

**Agent:** Pattern Recognition Specialist

## Proposed Solutions

### Solution 1: Create Mirror Routes (Recommended)

Create `_domain/gallery/` and `_domain/testimonials/` directories with:
- `page.tsx` - Copy from [slug]/(site) version, update for domain resolution
- `error.tsx` - Standard error boundary
- `loading.tsx` - Standard loading skeleton

**Pros:**
- Complete feature parity with slug routes
- Consistent UX for all tenants

**Cons:**
- Some code duplication (can be refactored later)

**Effort:** Small
**Risk:** Low

### Solution 2: Shared Page Component Abstraction

Refactor all page routes to use shared components, reducing duplication.

**Pros:**
- DRY code, easier maintenance
- Single source of truth

**Cons:**
- Larger refactor scope
- More complex architecture

**Effort:** Medium
**Risk:** Low

## Recommended Action

**APPROVED**: Solution 1 - Create mirror routes for gallery and testimonials.

## Technical Details

**Affected Files:**
- NEW: `apps/web/src/app/t/_domain/gallery/page.tsx`
- NEW: `apps/web/src/app/t/_domain/gallery/error.tsx`
- NEW: `apps/web/src/app/t/_domain/gallery/loading.tsx`
- NEW: `apps/web/src/app/t/_domain/testimonials/page.tsx`
- NEW: `apps/web/src/app/t/_domain/testimonials/error.tsx`
- NEW: `apps/web/src/app/t/_domain/testimonials/loading.tsx`

**Database Changes:** None

## Acceptance Criteria

- [ ] `_domain/gallery/` directory created with page, error, loading files
- [ ] `_domain/testimonials/` directory created with page, error, loading files
- [ ] Custom domain routes resolve correctly in middleware
- [ ] Pages render correctly for domain-based tenants
- [ ] ISR configured with `revalidate = 60`
- [ ] TypeScript passes (`npm run typecheck`)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from code review | Missing routes discovered during pattern analysis |

## Resources

- PR: N/A (uncommitted changes)
- Related: `apps/web/src/app/t/_domain/about/page.tsx` (reference implementation)
- Pattern: `apps/web/src/app/t/[slug]/(site)/gallery/page.tsx` (source to mirror)
