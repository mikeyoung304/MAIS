# TODO 10006: Merge Duplicate Route Trees — [slug] vs \_domain

**Priority:** P2
**Status:** pending
**Source:** Technical Debt Audit 2026-02-13, Issue #5
**Audit Doc:** `docs/solutions/architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md`

## Problem

Two parallel route trees serve tenant storefronts:

- `apps/web/src/app/t/[slug]/(site)/` — 14 routes (slug-based)
- `apps/web/src/app/t/_domain/` — 27 files (custom domain)

`tenant-page-utils.ts:7` has a TODO acknowledging this.

## Key Files

- `apps/web/src/app/t/[slug]/(site)/` — Slug-based routes
- `apps/web/src/app/t/_domain/` — Domain-based routes
- `apps/web/src/lib/tenant-page-utils.ts:7` — TODO comment

## Fix Strategy

1. Audit differences between the two trees
2. Create shared layout/page components
3. Route both [slug] and \_domain through shared components
4. Delete duplicate tree
