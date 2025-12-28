---
status: ready
priority: p2
issue_id: '397'
tags:
  - architecture
  - performance
  - code-review
dependencies: []
---

# Missing loading.tsx Files for Custom Domain Routes

## Problem Statement

The `t/[slug]/(site)/` routes have proper `loading.tsx` files for Suspense boundaries, but the parallel `t/_domain/` routes (for custom domain handling) are missing all loading states, causing poor UX during SSR data fetching.

## Findings

**Found by:** Architecture Strategist + Performance Oracle agents

**Present in [slug] routes:**

- `t/[slug]/(site)/loading.tsx` ✓
- `t/[slug]/(site)/about/loading.tsx` ✓
- `t/[slug]/(site)/contact/loading.tsx` ✓
- `t/[slug]/(site)/faq/loading.tsx` ✓
- `t/[slug]/(site)/services/loading.tsx` ✓
- `t/[slug]/book/[packageSlug]/loading.tsx` ✓

**Missing in \_domain routes:**

- `t/_domain/loading.tsx` ✗
- `t/_domain/about/loading.tsx` ✗
- `t/_domain/contact/loading.tsx` ✗
- `t/_domain/faq/loading.tsx` ✗
- `t/_domain/services/loading.tsx` ✗
- `t/_domain/book/[packageSlug]/loading.tsx` ✗
- `t/_domain/book/success/loading.tsx` ✗

**Impact:** Custom domain users experience blank screens during SSR data fetching.

## Proposed Solutions

### Option 1: Copy loading.tsx files to \_domain routes (Quick fix)

- Duplicate existing loading components to \_domain routes
- Maintains consistency

**Pros:** Quick, consistent UX
**Cons:** Code duplication
**Effort:** Small
**Risk:** Low

### Option 2: Extract shared loading components (Recommended)

- Create `@/components/tenant/LoadingSkeleton.tsx`
- Import in both route segments

**Pros:** DRY, maintainable
**Cons:** Slightly more work
**Effort:** Small
**Risk:** Low

## Recommended Action

Option 2 - Extract shared loading components.

## Technical Details

**Files to create:**

- `apps/web/src/app/t/_domain/loading.tsx`
- `apps/web/src/app/t/_domain/about/loading.tsx`
- `apps/web/src/app/t/_domain/contact/loading.tsx`
- `apps/web/src/app/t/_domain/faq/loading.tsx`
- `apps/web/src/app/t/_domain/services/loading.tsx`
- `apps/web/src/app/t/_domain/book/[packageSlug]/loading.tsx`
- `apps/web/src/app/t/_domain/book/success/loading.tsx`

**Reference implementation:** `apps/web/src/app/t/[slug]/(site)/loading.tsx`

## Acceptance Criteria

- [ ] All \_domain routes have loading.tsx files
- [ ] Loading states match [slug] routes visually
- [ ] Custom domain users see loading skeleton during data fetch
- [ ] TypeScript compiles without errors

## Work Log

| Date       | Action                                       | Learnings                                   |
| ---------- | -------------------------------------------- | ------------------------------------------- |
| 2025-12-25 | Created from multi-agent architecture review | Parallel route segments need matching files |
| 2025-12-25 | **Approved for work** - Status: ready        | P2 - UX improvement                         |

## Resources

- Architecture Strategist report
- Performance Oracle report
