# TODO 10007: Agent Code Duplication — Eliminate Intentional Copies

**Priority:** P2
**Status:** pending
**Source:** Technical Debt Audit 2026-02-13, Issue #7
**Audit Doc:** `docs/solutions/architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md`

## Problem

Agent deploy directories intentionally copy shared utilities (comment at `utils.ts:10-13`). Drift tests exist in `constants-sync.test.ts` but copies can still diverge between deploys.

## Key Files

- `server/src/agent-v2/deploy/tenant/src/utils.ts:10-13` — Intentional copy comment
- `server/src/lib/constants-sync.test.ts:4-30` — Drift detection tests

## Fix Strategy

1. Extract shared agent utilities into a proper shared package (or contracts)
2. Import from shared package in each agent deploy
3. Remove copied files
4. Delete drift detection tests (no longer needed when imports are shared)
5. Update Cloud Run build to include shared dependency
