---
status: pending
priority: p3
issue_id: 9009
tags: [code-review, performance, schema]
dependencies: []
---

# Missing @@index([tenantId, segmentId]) on Tier Model

## Problem Statement

The plan's Tier schema has `@@index([tenantId, active])` and `@@index([segmentId])` but not `@@index([tenantId, segmentId])`. The most common query will be "list tiers for a segment within a tenant" which benefits from a composite index.

## Proposed Solutions

Add `@@index([tenantId, segmentId])` to Tier model in Phase 1.

## Acceptance Criteria

- [ ] Tier has composite index on [tenantId, segmentId]

## Work Log

| Date       | Action             | Learnings                                   |
| ---------- | ------------------ | ------------------------------------------- |
| 2026-02-12 | Performance review | Common query patterns need matching indexes |
