---
status: deferred
priority: p2
issue_id: "535"
tags: [code-review, agent-ecosystem, agent-native]
dependencies: []
---

# Incomplete Action Parity for Customer Agent

## Problem Statement

The customer-facing chatbot can't do everything customers can do on the web UI. Missing: cancel booking, reschedule, view bookings.

## Findings

**Agent-Native Reviewer:**
> "| Cancel booking | Missing | Customers can't cancel via chat |
> | Reschedule booking | Missing | Customers can't reschedule via chat |
> | View their bookings | Missing | Customers can't check their booking status |"

## Proposed Solutions

Add tools to achieve action parity:
- `get_my_bookings` (T1) - List customer's own bookings
- `cancel_booking` (T3) - Cancel with confirmation
- `reschedule_booking` (T3) - Reschedule with confirmation

## Acceptance Criteria

- [ ] Customers can view their bookings via chat
- [ ] Customers can cancel via chat (with confirmation)
- [ ] Customers can reschedule via chat (with confirmation)
- [ ] Tests pass
