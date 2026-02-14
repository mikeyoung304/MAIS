# TODO 10001: Pricing Contract Mismatch — Agent Sends Dollars, Server Expects Cents

**Priority:** P0
**Status:** pending
**Source:** Technical Debt Audit 2026-02-13, Issue #1
**Audit Doc:** `docs/solutions/architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md`

## Problem

Agent tools (`tiers.ts`, `addons.ts`) send `priceInDollars` but server routes (`internal-agent-content-generation.routes.ts`) expect `priceCents`. Zod default mode silently strips the unknown key, leaving `priceCents: undefined`. Handler rejects with 400 on every create/update call.

**Impact:** Tier and add-on creation from agents is completely broken. No tiers are ever created during onboarding.

## Root Cause

Agent file header says "Conversion to priceCents happens server-side" — but nobody wrote that conversion. 4-layer chain confirmed:

1. Agent tool schema → sends `priceInDollars`
2. `callMaisApiTyped` → passes through as-is (no transform)
3. `ManageTiersSchema.parse()` → Zod strips unknown key (no `.strict()`)
4. Handler → rejects `priceCents === undefined` with 400

## Fix (Option A — Agent-Side Conversion)

### `server/src/agent-v2/deploy/tenant/src/tools/tiers.ts`

- `handleCreateTier` (~line 270): Map `priceInDollars` → `priceCents: Math.round(priceInDollars * 100)`
- `handleUpdateTier` (~line 310): Same conversion when `priceInDollars` is present

### `server/src/agent-v2/deploy/tenant/src/tools/addons.ts`

- `handleCreateAddOn` (~line 236): Map `priceInDollars` → `priceCents: Math.round(priceInDollars * 100)`
- `handleUpdateAddOn` (~line 270): Same conversion when `priceInDollars` is present

### Post-fix

- Update agent file header comment (line 15-16) to reflect that conversion happens agent-side
- Cloud Run redeploy required (tenant-agent)

## Verification

- Unit test: mock `callMaisApiTyped`, assert `priceCents` field is sent with correct value
- Smoke test: create tier via agent, verify it appears in DB with correct priceCents
