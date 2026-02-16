---
status: pending
priority: p2
issue_id: 9017
tags: [code-review, frontend, seo]
dependencies: []
---

# 301 Redirects Missing for /book/[packageSlug] URLs

## Problem Statement

Phase 6 renames booking pages from `[packageSlug]` to `[tierSlug]` but doesn't implement 301 redirects. Open Question #1 recommends redirects but it's listed as "open" — not incorporated into any phase's acceptance criteria.

All existing bookmarked/shared booking URLs and Google-indexed pages will 404.

## Findings

- Architecture Strategist P2-08: "No redirect implementation details"
- Pattern Recognition P1-6: "All existing bookmarked/shared booking URLs break permanently. SEO damage."
- Affected paths: `apps/web/src/app/t/[slug]/book/[packageSlug]/page.tsx` and `apps/web/src/app/t/_domain/book/[packageSlug]/page.tsx`

## Proposed Solutions

### Option A: Keep both routes active, old one redirects (Recommended)

- Create redirect route at old `[packageSlug]` path that 301s to `[tierSlug]`
- Use `sourcePackageId` join (while it exists) for slug mapping
- Set 90-day TTL then remove old route
- **Effort:** Small

### Option B: Next.js middleware redirect

- Catch `/book/*` requests and check if slug is a Package slug
- Redirect to equivalent Tier slug
- **Effort:** Small

## Acceptance Criteria

- [ ] Old /book/[packageSlug] URLs 301 redirect to /book/[tierSlug]
- [ ] Both [slug] and \_domain variants handled
- [ ] Redirect added to Phase 6 acceptance criteria

## Work Log

| Date       | Action               | Learnings                                                      |
| ---------- | -------------------- | -------------------------------------------------------------- |
| 2026-02-12 | URL migration review | Open questions must be resolved into phase acceptance criteria |
