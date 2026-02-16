---
status: pending
priority: p2
issue_id: 9018
tags: [code-review, migration, data-loss]
dependencies: []
---

# Package Photos Not Migrated to Tier in Phase 7

## Problem Statement

Phase 1 adds `photos Json @default("[]")` to Tier. Phase 7 migration converts Package→Tier but inserts `'[]'::jsonb` for photos — never copying `Package.photos` to `Tier.photos`. Existing tenant photos would be lost.

## Findings

- Pattern Recognition P2-2: "Phase 7 migration script doesn't copy Package.photos to Tier.photos"
- Agent-Native P3-3: Same finding
- Data Integrity Guardian confirmed Package.photos exists as a JSON column

## Proposed Solutions

### Option A: Add photo migration step to Phase 7 (Recommended)

```sql
UPDATE "Tier" t SET photos = p.photos
FROM "Package" p
WHERE t."sourcePackageId" = p.id AND p.photos != '[]'::jsonb;
```

- **Effort:** Tiny — one SQL statement

## Acceptance Criteria

- [ ] Phase 7 migration copies Package.photos to corresponding Tier.photos
- [ ] Verification query: no Tier with sourcePackageId has empty photos when source Package had photos

## Work Log

| Date       | Action                | Learnings                                    |
| ---------- | --------------------- | -------------------------------------------- |
| 2026-02-12 | Data migration review | JSON column data must be explicitly migrated |
