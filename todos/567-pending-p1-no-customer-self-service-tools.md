---
status: pending
priority: p1
issue_id: '567'
tags: [code-review, agent-native, agent-ecosystem, quality-first-triage]
dependencies: []
---

# P1: No Customer Self-Service Tools (Reschedule/Cancel)

> **Quality-First Triage:** New finding. "Agent capability parity violation. Customer chatbot can book but not reschedule/cancel."

## Problem Statement

The customer chatbot (`/server/src/agent/customer/customer-tools.ts`) only has 4 tools:

- `get_services` (browse)
- `check_availability` (read)
- `book_service` (create with T3)
- `get_business_info` (read)

**Missing:**

- `get_my_bookings` - customer cannot view their own bookings
- `reschedule_booking` - customer cannot change dates
- `cancel_booking` - customer cannot cancel

The admin agent has these tools (`update_booking`, `cancel_booking`), but customers cannot access them.

**Why it matters:** Agent is less capable than basic web UI. Future AI features touching customer booking management are blocked.

## Findings

| Reviewer            | Finding                               |
| ------------------- | ------------------------------------- |
| Agent-Native Triage | P1: Agent capability parity violation |

## Proposed Solutions

### Option 1: Add Customer Self-Service Tools (Recommended)

**Effort:** Medium (3-4 hours)

Add customer-facing tools that mirror web UI:

```typescript
// T1 - Read own bookings (requires customer verification)
{
  name: 'get_my_bookings',
  trustTier: 'T1',
  description: 'View your own bookings. Requires email/phone verification.',
  inputSchema: {
    customerEmail: { type: 'string' },
    customerPhone: { type: 'string', optional: true }
  }
}

// T3 - Reschedule (high impact, requires confirmation)
{
  name: 'reschedule_booking',
  trustTier: 'T3',
  description: 'Move booking to a new date. Checks availability first.',
  inputSchema: {
    bookingId: { type: 'string' },
    newDate: { type: 'string' } // YYYY-MM-DD
  }
}

// T3 - Cancel (high impact, requires confirmation)
{
  name: 'request_cancellation',
  trustTier: 'T3',
  description: 'Submit cancellation request. Subject to tenant policy.',
  inputSchema: {
    bookingId: { type: 'string' },
    reason: { type: 'string', optional: true }
  }
}
```

## Technical Details

**Affected Files:**

- `server/src/agent/customer/customer-tools.ts` - Add tools
- `server/src/agent/customer/customer-orchestrator.ts` - Register tools

**Security Consideration:** Customer verification is critical - must verify email/phone matches booking before allowing modifications.

## Acceptance Criteria

- [ ] Add `get_my_bookings` T1 tool with customer verification
- [ ] Add `reschedule_booking` T3 tool with availability check
- [ ] Add `request_cancellation` T3 tool with policy awareness
- [ ] Tests for customer verification flow
- [ ] Tests for reschedule with availability conflict

## Work Log

| Date       | Action                            | Learnings                                    |
| ---------- | --------------------------------- | -------------------------------------------- |
| 2026-01-01 | Created from quality-first triage | Agent-Native agent identified capability gap |
