---
status: complete
priority: p1
issue_id: '5224'
tags: [code-review, data-integrity, agent-tools]
dependencies: []
---

# P1: basePrice vs priceInDollars field mismatch — seed cleanup is a no-op

## Problem Statement

In `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts:182-186`, the programmatic seed-package-cleanup casts the `/manage-packages` list response as `{ basePrice: number }` and checks `pkg.basePrice === 0`. However, the `/manage-packages` list action (`internal-agent.routes.ts:2646-2653`) returns `priceInDollars` (an integer in dollars), NOT `basePrice` (cents). Since `basePrice` is not a key in the response object, `pkg.basePrice` evaluates to `undefined`, and `undefined === 0` is `false`.

**The defense-in-depth seed package cleanup NEVER executes.** The seed packages survive if the LLM prompt-only fallback also fails (Pitfall #94).

There are now THREE different price field names across the stack:

- `basePrice` (Prisma model)
- `priceCents` (frontend DTO)
- `priceInDollars` (agent API)

## Findings

- **Data Integrity Guardian (P1):** Field name mismatch makes the filter a silent no-op
- **Security Sentinel (P2):** Confirmed frontend/backend divergence, noted 3 price field names
- **Code Simplicity (P2):** Confirmed duplication, recommended shared constant

## Proposed Solutions

### Option A: Fix the type cast and filter (Recommended)

Change the type cast to `{ id: string; name: string; priceInDollars: number }` and the filter to `pkg.priceInDollars === 0`.

- **Pros:** Minimal change, fixes the immediate bug
- **Cons:** Doesn't address the 3-field-name divergence
- **Effort:** Small (1 line change)
- **Risk:** Low

### Option B: Fix + add shared DTO type

Fix as above, and also export an `AgentPackageResponse` type from `@macon/contracts` documenting all three field names.

- **Pros:** Prevents future field name confusion
- **Cons:** Cloud Run agent can't import from contracts (documented constraint)
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option A — fix the immediate bug now. The shared DTO is desirable but blocked by the Cloud Run import constraint.

## Technical Details

- **Affected files:** `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts:182-186`
- **Related:** `server/src/routes/internal-agent.routes.ts:2646-2653` (returns `priceInDollars`)
- **Related:** `apps/web/src/components/tenant/SegmentPackagesSection.tsx:305` (uses `priceCents`)
- **Pitfall:** #94 (prompt-only enforcement for LLM mutations affecting money/trust)

## Acceptance Criteria

- [ ] `first-draft.ts` seed cleanup uses `priceInDollars` field from API response
- [ ] Filter correctly identifies $0 packages for deletion
- [ ] Typecheck passes with corrected type cast
- [ ] Comment cross-referencing the field name mapping added

## Work Log

| Date       | Action                                                                        | Learnings                                              |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| 2026-02-07 | Created from code review of commit 8c091544                                   | 3-way price field divergence is a systemic issue       |
| 2026-02-08 | Fixed: cast uses priceInDollars, filter checks === 0, cross-ref comment added | Cloud Run agents must hardcode with cross-ref comments |

## Resources

- Commit: 8c091544
- CLAUDE.md Pitfall #94
- CLAUDE.md Pitfall #12 (field name mismatches in DTOs)
