---
status: pending
priority: p2
issue_id: 9020
tags: [code-review, migration, data-integrity]
dependencies: [9003]
---

# sortOrder Collision During Package→Tier Migration

## Problem Statement

Phase 1 migrates existing Tier rows (GOOD→1, BETTER→2, BEST→3 for sortOrder). Phase 7 then migrates Packages to NEW Tier rows starting sortOrder from 1. This creates a `@@unique([segmentId, sortOrder])` collision.

The migration has `ON CONFLICT DO NOTHING`, so collisions are silently dropped — meaning some packages would never be migrated to tiers.

## Findings

- Data Integrity Guardian P2-3: "Existing tiers already have sortOrder 1,2,3 from provisioning defaults. Package→Tier migration creates new rows starting from 1 → collision."

## Proposed Solutions

### Option A: Start new sortOrder from max+1 (Recommended)

- Before Package→Tier migration, query: `SELECT "segmentId", MAX("sortOrder") FROM "Tier" GROUP BY "segmentId"`
- Start new tier sortOrder from `maxExisting + 1`
- **Effort:** Small

### Option B: Delete provisioning-default tiers first

- Default tiers have price=0 and are placeholder data
- Delete them, then migrate packages starting from 1
- **Effort:** Small but riskier (what if defaults were customized?)

## Acceptance Criteria

- [ ] No sortOrder collision between existing tiers and migrated packages
- [ ] All packages with segmentId are successfully migrated to tiers

## Work Log

| Date       | Action                  | Learnings                                  |
| ---------- | ----------------------- | ------------------------------------------ |
| 2026-02-12 | Migration safety review | ON CONFLICT DO NOTHING silently drops data |
