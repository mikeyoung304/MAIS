---
status: pending
priority: p3
issue_id: '11061'
tags: [integrations, migration, onboarding]
dependencies: []
---

# 11061: HoneyBook/Dubsado Migration Importer Missing

## Problem Statement

Most new tenants are migrating FROM HoneyBook or Dubsado. A painless migration
importer (CSV/JSON import of contacts, projects, bookings) would be a significant
acquisition advantage. Currently there is no import tooling — tenants must manually
recreate all their client data, which is a major friction point and churn risk during
onboarding.

## Findings

- No import routes, services, or tooling exist
- HoneyBook and Dubsado both offer CSV export of contacts and projects
- The `Customer`, `Project`, and `Booking` models can absorb migrated data
- Onboarding agent has no import step

## Proposed Solution

Phase 1 — CSV import (contacts only, lowest risk):

1. `POST /v1/tenant/import/customers` — accepts CSV with header mapping
2. Deduplicate by email within tenant scope
3. Return import summary (created, skipped, errors)
4. UI: simple drag-and-drop CSV upload in tenant settings

Phase 2 — Full project/booking import:

- Map HoneyBook "project" → `Project` + `Booking`
- Map Dubsado "job" → same
- Preserve historical dates (createdAt override)
- Idempotent: re-running import skips already-imported records (by email + date)

Phase 3 — Onboarding agent integration:

- Offer import step during onboarding conversation
- "Do you want to import your existing clients from HoneyBook or Dubsado?"

**Key constraints:**

- ALL imports must be scoped by `tenantId` (no cross-tenant leakage)
- Validate and sanitize all CSV input
- Rate limit: one import job per tenant at a time
- Max rows per import: 10,000 (prevent abuse)

## Acceptance Criteria

- [ ] `POST /v1/tenant/import/customers` accepts CSV and creates `Customer` records
- [ ] Deduplication by email within tenant
- [ ] Import result summary returned (created/skipped/errors)
- [ ] All records tenant-scoped
- [ ] Input validation and sanitization
- [ ] Unit tests for CSV parsing and dedup logic
- [ ] Rate limiting (one active import per tenant)

## Effort

XL

## Work Log

- 2026-02-20: Strategic finding from integration review. Primary acquisition advantage — reduces the #1 switching friction from competitors.
