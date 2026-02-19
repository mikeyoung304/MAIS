---
status: pending
priority: p2
issue_id: '11018'
tags: [code-review, frontend, domain-routing, documentation, domainparam]
---

# P2-03 — `domainParam` Removal Misleading: Add Explanatory Comment in TenantLandingPage

## Problem Statement

Commit `b0c536ce` says "Remove unused domainParam prop." It correctly removes it from `TenantSiteShell`/`TenantNav`/`TenantFooter`. But `domainParam` is **load-bearing** in `SegmentTiersSection` (booking URLs on domain routes) and `ContactForm` ("Back to Home" href). A future developer reading `TenantSiteShell` will not expect `domainParam` three layers down and may attempt to "complete the cleanup" — breaking custom domain booking flows.

## Findings

- **Files:**
  - `apps/web/src/components/tenant/TenantLandingPage.tsx:26,107,130` (still passes domainParam)
  - `apps/web/src/components/tenant/SegmentTiersSection.tsx:349-358` (booking link — load-bearing)
  - `apps/web/src/components/tenant/ContactForm.tsx:59` (home href — load-bearing)
- **Agents:** code-simplicity, architecture-strategist, kieran, learnings-researcher (4-way)

## Proposed Solution

Add a comment to `TenantLandingPage.tsx` near the `domainParam` prop:

```typescript
/**
 * domainParam is intentionally retained for domain-routing link construction
 * in SegmentTiersSection (booking URLs) and ContactForm (home href).
 * It was removed from TenantSiteShell/Nav/Footer only — those components
 * use basePath for link construction. See PR #62 + commit b0c536ce.
 */
```

No code change needed. Comment-only fix.

## Acceptance Criteria

- [ ] `TenantLandingPage.tsx` has an explanatory comment near `domainParam` prop declaration
- [ ] Comment explains which child components still use it and why
- [ ] References the PR/commit for context

## Work Log

- 2026-02-18: Created from 4-agent convergence
