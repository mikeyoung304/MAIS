---
status: pending
priority: p2
issue_id: 9008
tags: [code-review, plan-gap]
dependencies: []
---

# Booking Confirmation Emails Reference Package Name — No Phase Owns the Fix

## Problem Statement

The plan's risk table (line 992) identifies: "Booking confirmation emails reference Package name" with mitigation "Store tier name in Booking record (denormalized) or update email builder to fetch Tier."

However, this fix is not assigned to any phase. Neither Phase 6 (frontend migration) nor Phase 7 (Package deletion) explicitly lists email templates in files-to-modify.

**Why it matters:** After Package deletion, confirmation emails will either crash or display empty/null package names.

## Findings

- Plan risk table line 992: P2 risk identified but no phase assignment
- Likely files: email templates or Postmark template builders in `server/src/`

## Proposed Solutions

### Option A: Add to Phase 6 acceptance criteria (Recommended)

- Find email builder files (grep for 'confirmation' or 'email' in services)
- Update to fetch Tier name instead of Package name
- **Effort:** Small

### Option B: Denormalize tier name into Booking record

- Add `tierName String?` to Booking model
- Populate during booking creation
- Emails read from Booking directly
- **Effort:** Small — but adds a denormalized field

## Acceptance Criteria

- [ ] Booking confirmation emails display tier name (not package name)
- [ ] Fix assigned to a specific phase in the plan

## Work Log

| Date       | Action                                            | Learnings                                      |
| ---------- | ------------------------------------------------- | ---------------------------------------------- |
| 2026-02-12 | Risk identified in plan but no phase owns the fix | Every risk mitigation needs a phase assignment |
