---
status: pending
priority: p2
issue_id: 9019
tags: [code-review, plan-gap, scope]
dependencies: []
---

# Plan Undercounts Package References — ~90 Files vs ~25 Listed

## Problem Statement

Multiple agents found the plan's file lists significantly undercount Package references:

- **Frontend:** 47 files reference Package/packageId, plan lists ~12
- **Backend services:** 18 files reference Package, ~5 listed
- **Routes:** 11 files reference Package, ~4 listed
- **Contracts:** 6 files, ~2 listed

**Total surface area: ~90+ files. Plan explicitly lists ~25.**

Key unlisted files include:

- `apps/web/src/lib/packages.ts` — Package utility functions
- `apps/web/src/lib/api.ts` — API client for Package CRUD
- `server/src/services/tenant-provisioning.service.ts` — creates seed packages at signup
- `server/src/services/commission.service.ts` — calculates commission with Package
- `server/src/services/reminder.service.ts` — sends reminders with Package title
- `server/src/routes/index.ts` — route registration
- `server/src/routes/tenant-admin.routes.ts` — has PackageDraftService refs
- `packages/contracts/src/api.v1.ts` — ts-rest contract definitions

## Findings

- Architecture Strategist P2-01: 47 frontend files, P2-02: 18 backend services, P2-04: 11 routes
- Pattern Recognition P2-3: tenant-admin.routes.ts and index.ts not listed
- Data Integrity Guardian P2-4: BookingService.getAllPlatformBookings includes Package

## Proposed Solutions

### Option A: Add comprehensive grep as pre-phase checklist (Recommended)

- Before starting each phase, run: `grep -r "Package\|packageId" --files-with-matches`
- Categorize: (a) Must change for functionality, (b) Display-only, (c) Demo content
- Update plan file lists accordingly
- **Effort:** Medium — plan documentation update

## Acceptance Criteria

- [ ] Each phase's file list is comprehensive (no unaddressed Package references survive)
- [ ] Pre-phase grep checklist documented in plan

## Work Log

| Date       | Action       | Learnings                                                  |
| ---------- | ------------ | ---------------------------------------------------------- |
| 2026-02-12 | Scope review | Always grep for the thing you're replacing before starting |
