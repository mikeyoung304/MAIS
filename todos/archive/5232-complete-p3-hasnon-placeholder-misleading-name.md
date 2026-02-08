---
status: pending
priority: p3
issue_id: '5232'
tags: [code-review, naming, backend]
dependencies: []
---

# P3: hasNonPlaceholderContent is package-only — misleading name

## Problem Statement

`hasNonPlaceholderContent()` at `context-builder.service.ts:513-518` only checks package pricing (`basePrice > 0`). It does NOT check section content quality. A tenant who has heavily customized hero/about/services but prices all packages at $0 (e.g., "free consultation" model) would be classified as having "no real content."

The function name implies broader content checking than it actually performs.

## Proposed Solutions

### Option A: Rename to `hasNonSeedPackages()` (Recommended)

More accurately describes what the function checks.

- **Effort:** Small
- **Risk:** Low

### Option B: Add comment explaining trade-off

Keep name but add JSDoc explaining why sections aren't checked (seed sections are published at provisioning).

- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `server/src/services/context-builder.service.ts:513-518`

## Acceptance Criteria

- [ ] Function name or documentation accurately reflects behavior

## Work Log

| Date       | Action                                      | Learnings                         |
| ---------- | ------------------------------------------- | --------------------------------- |
| 2026-02-07 | Created from code review of commit 8c091544 | Function names should match scope |
