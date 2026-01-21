---
status: resolved
priority: p1
issue_id: '5203'
tags: [code-review, session-bootstrap, agent-native, concierge]
dependencies: []
---

# Bootstrap Error Fallback Assumes Onboarding Complete

## Problem Statement

When the bootstrap API call fails in the Concierge agent, the error fallback incorrectly assumes `onboardingDone: true`. This could skip onboarding for users who genuinely need it due to a transient API error.

**Why it matters:** Users could be stuck in normal mode when they should be in onboarding mode, leading to a degraded first-time experience.

## Findings

**Location:** `server/src/agent-v2/deploy/concierge/src/agent.ts:1202-1210`

**Current Code:**

```typescript
return {
  error: result.error,
  fallback: {
    tenantId,
    businessName: 'Unknown',
    onboardingDone: true, // Assume done on error to avoid getting stuck
    isOnboarding: false,
  },
};
```

**Issue:** The comment says "avoid getting stuck" but this creates a worse problem - users silently skip onboarding.

**Reviewer:** Agent-Native Architecture Review (P1-002)

## Proposed Solutions

### Option A: Return Unknown State (Recommended)

**Pros:** Explicit error handling, agent can decide how to proceed
**Cons:** Requires prompt update to handle unknown state
**Effort:** Small
**Risk:** Low

```typescript
return {
  error: result.error,
  fallback: {
    tenantId,
    businessName: 'Unknown',
    onboardingDone: null, // Unknown - let agent decide
    isOnboarding: 'unknown',
    errorMessage: result.error,
  },
};
```

### Option B: Retry with Backoff

**Pros:** Handles transient errors automatically
**Cons:** Adds latency, may still fail
**Effort:** Medium
**Risk:** Low

Add retry logic before returning fallback.

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts`

**Affected Components:**

- Concierge agent bootstrap_session tool
- Onboarding mode detection

## Acceptance Criteria

- [ ] Error fallback returns `onboardingDone: null` instead of `true`
- [ ] System prompt handles unknown onboarding state gracefully
- [ ] Agent prompts user to retry if bootstrap fails

## Work Log

| Date       | Action                         | Learnings                                   |
| ---------- | ------------------------------ | ------------------------------------------- |
| 2026-01-20 | Created from /workflows:review | Agent-Native reviewer identified this as P1 |

## Resources

- PR: feature/session-bootstrap-onboarding
- Review: Agent-Native Architecture Review
