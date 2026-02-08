---
status: complete
priority: p2
issue_id: '5231'
tags: [code-review, code-quality, backend]
dependencies: ['5225', '5227']
---

# P2: Phase resolution 4-line block repeated 3 times

## Problem Statement

The exact same 4-line block appears in `build()`, `getBootstrapData()`, and `getOnboardingState()`:

```typescript
const hasRealContent = await this.hasNonPlaceholderContent(tenantId);
const effectivePhase = this.resolveOnboardingPhase(tenant, hasRealContent);
const onboardingDone = effectivePhase === 'COMPLETED' || effectivePhase === 'SKIPPED';
this.lazyBackfillPhase(tenantId, effectivePhase, !!tenant.onboardingPhase);
```

This is a textbook "extract method" candidate. If any step changes (e.g., adding a new phase like 'GRADUATED'), all three sites must be updated manually.

## Findings

- **Code Simplicity (P2):** Textbook extract method candidate
- **Performance Oracle:** Noted this is where lazy evaluation should be added
- **Architecture Strategist:** Confirmed waterfall order is load-bearing — extraction ensures consistency

## Proposed Solutions

### Option A: Extract private helper (Recommended)

Create `private async resolveAndBackfillPhase(tenantId: string, tenant: Tenant): Promise<{ effectivePhase: OnboardingPhase; onboardingDone: boolean }>`.

- **Pros:** DRY, ensures all 3 paths stay in sync, natural place for lazy evaluation
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected files:** `server/src/services/context-builder.service.ts` (lines 267-272, 389-394, 454-459)
- **Should combine with:** #5227 (lazy evaluation) and #5225 (waterfall fix)

## Acceptance Criteria

- [ ] Single helper method replaces all 3 duplicated blocks
- [ ] All 3 methods produce identical results as before
- [ ] Typecheck passes

## Work Log

| Date       | Action                                      | Learnings                                                |
| ---------- | ------------------------------------------- | -------------------------------------------------------- |
| 2026-02-07 | Created from code review of commit 8c091544 | 3-way duplication of orchestration logic is a drift risk |

## Resources

- Commit: 8c091544
