---
status: pending
priority: p2
issue_id: 9007
tags: [code-review, cleanup, agent]
dependencies: []
---

# SEED_PACKAGE_NAMES in Agent Constants Not Addressed

## Problem Statement

`server/src/agent-v2/deploy/tenant/src/constants/shared.ts:46` has:

```typescript
export const SEED_PACKAGE_NAMES = ['Basic Package', 'Standard Package', 'Premium Package'] as const;
```

Phase 7 removes `SEED_PACKAGE_NAMES` from contracts but the Cloud Run agent's manually-synced copy isn't explicitly listed for cleanup. After Package deletion, this constant references a deleted concept.

Also: `first-draft.ts` uses SEED_PACKAGE_NAMES to clean up seed packages before building. With Tier replacing Package, this needs to become seed TIER cleanup.

## Findings

- `shared.ts:46` — `SEED_PACKAGE_NAMES` constant
- Plan Phase 4 line 437: mentions "Replace seed package cleanup with seed tier check" for first-draft.ts
- Plan Phase 4 line 444: mentions updating shared.ts but not specifically SEED_PACKAGE_NAMES

## Proposed Solutions

### Option A: Replace with SEED_TIER_NAMES in Phase 4 (Recommended)

- Rename to `SEED_TIER_NAMES = ['Basic Tier', 'Standard Tier', 'Premium Tier']` or whatever seed tiers are created
- Update first-draft.ts to use new constant
- **Effort:** Small

### Option B: Remove entirely

- If the new Tier provisioning doesn't create seed tiers, remove the constant entirely
- **Effort:** Tiny

## Acceptance Criteria

- [ ] SEED_PACKAGE_NAMES removed or renamed in agent constants
- [ ] first-draft.ts updated to use Tier-based seed cleanup
- [ ] Constants drift test updated

## Work Log

| Date       | Action                                     | Learnings                                              |
| ---------- | ------------------------------------------ | ------------------------------------------------------ |
| 2026-02-12 | Agent-native reviewer found stale constant | Cloud Run manual sync means easy-to-miss cleanup items |
