---
status: ready
priority: p2
issue_id: 5213
tags: [code-review, duplication, dashboard-rebuild]
dependencies: []
---

# Duplicated knownFactKeys Computation in context-builder

## Problem Statement

`context-builder.service.ts` computes `forbiddenSlots` and `knownFactKeys` twice — once around lines 376-380 and again around lines 392-396. This is likely a copy-paste artifact from adding `computeSectionReadiness`.

## Findings

- Lines 376-380: First computation of knownFactKeys/forbiddenSlots
- Lines 392-396: Second computation (identical logic)
- Both used in different parts of getBootstrapData
- Could share a single computation

## Proposed Solutions

### Option A: Compute once at top of method (Recommended)

- Extract shared computation, reference result in both places
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] knownFactKeys computed only once in getBootstrapData
- [ ] Both consumers use same result

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
