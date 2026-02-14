# TODO 10002: Onboarding Phase Drift — BUILDING Missing from Contracts

**Priority:** P1
**Status:** pending
**Source:** Technical Debt Audit 2026-02-13, Issue #6
**Audit Doc:** `docs/solutions/architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md`

## Problem

Prisma enum has `BUILDING` but contracts `OnboardingPhaseSchema` does not. `parseOnboardingPhase('BUILDING')` silently returns `'NOT_STARTED'`, making tenants in BUILDING phase appear as never-started throughout the frontend.

## Files to Fix (7+)

1. **`packages/contracts/src/schemas/onboarding.schema.ts:22-30`** — ROOT CAUSE: Add `BUILDING` to Zod enum
2. **`server/src/adapters/prisma/tenant.repository.ts:51-58`** — Add `BUILDING` to type literal
3. **`apps/web/src/hooks/useComputedPhase.ts:37-44`** — Add `BUILDING` to `PHASE_METADATA` record
4. **`apps/web/src/hooks/useComputedPhase.ts:131-137`** — Add `BUILDING` to `phases` array
5. **`apps/web/src/hooks/useBuildModeRedirect.ts:42`** — Check `BUILDING` instead of (or in addition to) `MARKETING`
6. **`apps/web/src/hooks/useOnboardingState.ts:127-128`** — Verify uses contract type correctly
7. **`server/src/services/context-builder.service.ts:16,148,480`** — Verify handles BUILDING

## Fix Strategy

Start at contracts (source of truth), then propagate outward:

1. Add `BUILDING` to `OnboardingPhaseSchema` in contracts
2. TypeScript will flag every `Record<OnboardingPhase, ...>` that's missing it
3. Fix each compiler error
4. Update `useBuildModeRedirect` to trigger on `BUILDING`
5. Run full typecheck to catch any remaining gaps

## Verification

- `npm run --workspace=packages/contracts typecheck`
- `npm run --workspace=server typecheck`
- `npm run --workspace=apps/web typecheck`
- Grep for hardcoded phase lists that TypeScript won't catch
