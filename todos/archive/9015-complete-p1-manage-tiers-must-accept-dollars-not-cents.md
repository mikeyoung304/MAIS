---
status: pending
priority: p1
issue_id: 9015
tags: [code-review, agent, financial]
dependencies: []
---

# manage_tiers Tool Must Accept Dollars (Not Cents) — LLM Math Risk

## Problem Statement

The plan implies `manage_tiers` accepts `priceCents` directly (matching the Prisma schema field). This means the LLM must multiply by 100 before calling the tool. LLMs are unreliable at arithmetic.

**Current pattern (correct):** `manage_packages` accepts `priceInDollars` as a tool param and the tool's `handleCreatePackage()` converts: `const priceCents = Math.round(params.priceInDollars * 100)`. The LLM never sees cents.

**Risk:** If `manage_tiers` accepts `priceCents`, the LLM might pass `2500` (meaning $2,500) as `priceCents`, creating a $25 tier.

## Findings

- Agent-Native Reviewer P1-1: Current packages.ts:251 shows the correct pattern `Math.round(params.priceInDollars * 100)`
- Same principle applies to A2A commerce JSON (see todo 9001)

## Proposed Solutions

### Option A: Follow current pattern — accept dollars, convert in TypeScript (Recommended)

- `manage_tiers` parameter schema: `priceInDollars: z.number().positive()`
- Handler converts: `priceCents: Math.round(params.priceInDollars * 100)`
- Add sanity validation: `if (priceCents < 100) return { error: 'Price seems too low' }`
- **Effort:** Tiny

## Acceptance Criteria

- [ ] manage_tiers accepts priceInDollars (not priceCents)
- [ ] Conversion to cents happens in TypeScript code
- [ ] Sanity bounds check on price (e.g., $1 to $50,000)

## Work Log

| Date       | Action            | Learnings                         |
| ---------- | ----------------- | --------------------------------- |
| 2026-02-12 | Agent tool review | Never delegate arithmetic to LLMs |
