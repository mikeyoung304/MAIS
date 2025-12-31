---
status: complete
priority: p2
issue_id: '454'
tags: [security, agent, code-review, ux]
dependencies: []
---

# T2 Soft-Confirm May Execute During Unrelated Conversation

## Problem Statement

The `softConfirmPendingT2` function auto-confirms all pending T2 proposals when the user sends ANY message that doesn't contain rejection keywords. If the user changes topics, T2 proposals from earlier in the conversation could be inadvertently confirmed.

## Severity: P2 - IMPORTANT

User may unintentionally approve changes they didn't explicitly agree to.

## Findings

- **Location**: `server/src/agent/proposals/proposal.service.ts` lines 204-270

```typescript
// User asks about a package price change (T2 proposal created)
// User says "Okay, now show me my bookings" (doesn't contain rejection keywords)
// The price change proposal gets auto-confirmed unexpectedly
```

Current rejection keywords checked:

- "no", "cancel", "don't", "do not", "stop", "reject", "decline"

But an affirmative reply to an unrelated topic doesn't constitute approval of the T2 proposal.

## Problem Scenario

1. User: "Update my package price to $500"
2. Agent: "I'll update the price. Confirm?" (T2 proposal created)
3. User: "Actually, wait. What bookings do I have this week?"
4. Agent: Shows bookings, T2 proposal still pending
5. User: "Great, thanks!"
6. T2 proposal auto-confirmed because message didn't contain rejection keywords
7. Package price changed without explicit user approval

## Proposed Solutions

### Option 1: Add Time-Based Expiry (Recommended)

- **Pros**: Simple, prevents stale approvals
- **Cons**: User must re-request if they take too long
- **Effort**: Small (1-2 hours)
- **Risk**: Low

```typescript
// Only auto-confirm T2 if created within last 2 minutes
const TWO_MINUTES = 2 * 60 * 1000;
const recentProposals = pendingT2.filter((p) => Date.now() - p.createdAt.getTime() < TWO_MINUTES);
```

### Option 2: Require Affirmative Signal

- **Pros**: No false positives
- **Cons**: More friction, user must say "yes" explicitly
- **Effort**: Medium
- **Risk**: Low

### Option 3: Require Proposal Reference

- **Pros**: Most explicit
- **Cons**: Awkward UX ("confirm proposal #123")
- **Effort**: Medium
- **Risk**: Medium (UX degradation)

## Recommended Action

[To be filled during triage]

## Technical Details

- **Affected Files**:
  - `server/src/agent/proposals/proposal.service.ts` - Add time check to `softConfirmPendingT2`
- **Related Components**: ProposalService, T2 trust tier
- **Database Changes**: No (proposal already has createdAt)

## Acceptance Criteria

- [ ] T2 proposals expire after 2 minutes of inactivity
- [ ] Expired proposals return "proposal expired, please request again"
- [ ] Test case covers topic-change scenario
- [ ] Documentation updated

## Resources

- Source: Code Review - Security Review Agent (2025-12-28)

## Notes

Source: Code Review on 2025-12-28
Estimated Effort: Small (1-2 hours)
