---
status: pending
priority: p1
issue_id: 9001
tags: [code-review, data-integrity, agent, pricing]
dependencies: []
---

# A2A Commerce JSON Price Unit Ambiguity (100x Error Risk)

## Problem Statement

Phase 8's A2A commerce JSON example shows `"price": 3500` but `Tier.priceCents` stores cents.
For a wedding photographer charging $3,500, the correct `priceCents` value is `350000`.
The example is ambiguous — is `3500` dollars or cents? If dollars, the customer-agent will display correct prices but create bookings at 1/100th the price. If cents, the display will show $35.00.

**Why it matters:** A 100x pricing error would create incorrect Stripe charges, refund liability, and tenant trust loss.

## Findings

### Evidence

- Plan line ~843: `{ "id": "tier_1", "name": "Essential", "price": 3500, "features": [...] }`
- Plan line ~88: `priceCents Int // Price in cents (consistent with Booking.totalPrice, Payment.amount)`
- Plan line ~422: `agent prompt should tell LLM to ask in dollars and convert: priceCents: dollars * 100`
- Field name in JSON is `price` (ambiguous), not `priceCents` (unambiguous)

### Agent: Data Integrity Guardian (partial)

The A2A commerce tree uses `"price"` as the field name, not `"priceCents"`. This creates ambiguity at the customer-agent boundary.

### Agent: Pattern Recognition Specialist (partial)

The plan is internally inconsistent — Tier schema uses `priceCents` (cents) but the A2A JSON uses `price` (unknown unit).

## Proposed Solutions

### Option A: Use `priceCents` in A2A JSON (Recommended)

- **Pros:** Consistent with DB column name, no conversion at boundary
- **Cons:** Customer-agent must divide by 100 for display
- **Effort:** Small
- **Risk:** Low — single source of truth

### Option B: Use `priceDisplay` (dollars) alongside `priceCents` in A2A JSON

- **Pros:** Both values available, no ambiguity
- **Cons:** Redundant data, risk of desync
- **Effort:** Small
- **Risk:** Medium — must keep in sync

### Option C: Use dollars with explicit field name `priceDollars`

- **Pros:** Human-readable, explicit
- **Cons:** Conversion needed at service boundary, inconsistent with DB
- **Effort:** Small
- **Risk:** Medium — conversion bugs

## Recommended Action

<!-- Fill during triage -->

## Technical Details

**Affected files:**

- `docs/plans/2026-02-11-feat-onboarding-conversation-redesign-plan.md` (Phase 8 JSON example)
- Future: customer-agent tools that parse A2A commerce JSON
- Future: tenant-agent tools that serialize tier data for A2A

**Affected phases:** Phase 4 (tier tool returns), Phase 8 (A2A JSON)

## Acceptance Criteria

- [ ] A2A commerce JSON uses unambiguous field name (`priceCents` or `priceDollars`, not bare `price`)
- [ ] Plan Phase 8 example corrected to match chosen convention
- [ ] Plan Phase 4 tool return values use same convention
- [ ] Customer-agent booking creation uses correct conversion

## Work Log

| Date       | Action                        | Learnings                                |
| ---------- | ----------------------------- | ---------------------------------------- |
| 2026-02-12 | Discovered during plan review | A2A boundaries need explicit unit naming |

## Resources

- Plan: `docs/plans/2026-02-11-feat-onboarding-conversation-redesign-plan.md` Phase 8
- Design spec: `docs/architecture/ONBOARDING_CONVERSATION_DESIGN.md`
