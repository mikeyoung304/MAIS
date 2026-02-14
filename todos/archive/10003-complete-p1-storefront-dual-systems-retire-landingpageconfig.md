# TODO 10003: Retire Legacy landingPageConfig — Storefront Dual Systems

**Priority:** P1
**Status:** pending
**Source:** Technical Debt Audit 2026-02-13, Issue #2
**Audit Doc:** `docs/solutions/architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md`

## Problem

Two parallel storefront storage systems run simultaneously:

- **Legacy:** `Tenant.branding.landingPage` (JSON blob)
- **New:** `SectionContent` table (rows with isDraft/published)

Every page load fetches BOTH, merges them via `injectSectionsIntoData()`, and runs a 540-line `normalizeToPages()` normalizer.

## Key Files

- `apps/web/src/app/t/[slug]/(site)/page.tsx:249-270` — Parallel fetch + merge
- `apps/web/src/lib/tenant.client.ts:56` — 540-line `normalizeToPages()`
- `ARCHITECTURE.md:641` — Documents intentional transitional state

## Fix Strategy

1. **Verify all tenants have SectionContent data** (SQL query against prod)
2. **Backfill any tenants still on legacy** (migration script)
3. **Remove parallel fetch** — use SectionContent only
4. **Delete `normalizeToPages()`** and `injectSectionsIntoData()`
5. **Remove `landingPageConfig` from Tenant branding JSON** (after 30-day verification)

## Pre-Requisites

- Confirm no active tenants rely solely on legacy landingPageConfig
- Ensure `getPublishedSections()` handles all section types
