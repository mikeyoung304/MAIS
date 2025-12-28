# Plan: Cleanup Tenant Configuration (MINIMAL)

## Overview

Delete outdated workflow files and clean up test tenants from database.

## Scope (Revised After Review)

Based on DHH/Kieran/YAGNI review feedback, this plan is intentionally minimal:

- ✅ Delete 2 outdated workflow files
- ✅ Delete test tenants from database
- ❌ No default landing page changes (will configure manually)
- ❌ No new documentation
- ❌ No CLI helpers

## Tasks

### 1. Delete Workflow Files

- `.claude/commands/workflows/newtenant.md`
- `.claude/commands/workflows/tenant.md`

### 2. Clean Up Test Tenants

**Keep (3 real tenants):**

- `la-petit-mariage` - La Petit Mariage (has landing page config)
- `little-bit-farm` - Little Bit Horse Farm (has landing page config)
- `mais-e2e` - E2E test tenant (needed for automated tests)

**Delete (23 test tenants):**
All tenants with patterns like:

- `*-test-*`
- `test-*`
- `*-tenant-a`
- Timestamped slugs (`*-1766*`)

## Acceptance Criteria

- [ ] Workflow files deleted
- [ ] Test tenants removed from database
- [ ] Only 3 tenants remain: la-petit-mariage, little-bit-farm, mais-e2e
- [ ] No broken skill references

## Out of Scope (Deferred)

- Default landing page config on signup
- Backfill migration for existing tenants
- Documentation updates
- CLI helper commands
