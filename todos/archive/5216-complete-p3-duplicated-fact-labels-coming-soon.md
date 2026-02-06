---
status: ready
priority: p3
issue_id: 5216
tags: [code-review, duplication, dashboard-rebuild]
dependencies: []
---

# Duplicated FACT_LABELS in ComingSoonDisplay

## Problem Statement

`ComingSoonDisplay.tsx` defines a `FACT_LABELS` map that duplicates label information already present in `SECTION_BLUEPRINT` and the slot-machine module. This creates a maintenance burden — adding a new section type requires updating three places.

## Proposed Solutions

### Option A: Derive from SECTION_BLUEPRINT (Recommended)

- Import SECTION_BLUEPRINT and derive display labels
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] FACT_LABELS derived from single source of truth
- [ ] No duplicate label definitions

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
