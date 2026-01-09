---
status: done
priority: p1
issue_id: '669'
tags:
  - code-review
  - onboarding
  - agent
dependencies:
  - '667'
---

# getGreeting() Uses Admin Greeting Function for Onboarding

## Problem Statement

`AdminOrchestrator.getGreeting()` calls `getHandledGreeting()` which generates Stripe-focused greetings, even when the tenant is in onboarding mode. It should call `getOnboardingGreeting()` for tenants in active onboarding phases.

**Why it matters:** Even if the frontend uses the API greeting (after fixing #668), the greeting will still be wrong because the backend returns the wrong greeting for onboarding users.

## Findings

**Location:** `server/src/agent/orchestrator/admin-orchestrator.ts` lines 242-249

**Current Code:**

```typescript
async getGreeting(tenantId: string, sessionId: string): Promise<string> {
  const session = await this.getAdminSession(tenantId, sessionId);
  if (!session) {
    return 'What should we knock out today?';
  }

  return getHandledGreeting(session.context);  // ❌ Always admin greeting
}
```

**getHandledGreeting() is Stripe-focused:**

- "Ready to start accepting payments?" when Stripe not connected
- "You're all set up!" when configured
- Doesn't know about onboarding phases

**getOnboardingGreeting() is phase-aware:**

- Discovery: "Tell me about your business..."
- Market Research: "Let me research your market..."
- Services: "Let's set up your services..."
- Marketing: "Time to work on your website..."

## Proposed Solutions

### Option A: Check Onboarding Mode in getGreeting() (Recommended)

**Pros:** Minimal change, consistent with tools pattern
**Cons:** Need to fetch/check onboarding phase
**Effort:** Small (20 min)
**Risk:** Low

```typescript
async getGreeting(tenantId: string, sessionId: string): Promise<string> {
  const session = await this.getAdminSession(tenantId, sessionId);
  if (!session) {
    return 'What should we knock out today?';
  }

  if (session.isOnboardingMode && session.onboardingPhase) {
    const memory = await advisorMemoryRepo.projectFromEvents(tenantId);
    return getOnboardingGreeting(session.onboardingPhase, memory?.isReturning ?? false);
  }

  return getHandledGreeting(session.context);
}
```

### Option B: Extract to Greeting Service

**Pros:** Single responsibility, testable
**Cons:** More files, over-engineering for simple fix
**Effort:** Medium (45 min)
**Risk:** Low

## Recommended Action

**Option A** - Check onboarding mode in getGreeting(). The session already contains `isOnboardingMode` and `onboardingPhase`, so just need to check and call the appropriate greeting function.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/admin-orchestrator.ts` - Update getGreeting()

**Imports Needed:**

```typescript
import { getOnboardingGreeting } from '../prompts/onboarding-system-prompt';
import { advisorMemoryRepo } from '../onboarding/advisor-memory.service';
```

## Acceptance Criteria

- [ ] When tenant is in onboarding phase, return phase-appropriate greeting
- [ ] When tenant is NOT in onboarding, return admin greeting (getHandledGreeting)
- [ ] Returning users get contextual resume message
- [ ] New users get discovery-focused greeting
- [ ] Test coverage for both greeting paths

## Work Log

| Date       | Action                   | Learnings                                                              |
| ---------- | ------------------------ | ---------------------------------------------------------------------- |
| 2026-01-08 | Created from code review | Part of onboarding flow fix, depends on #667 for full prompt switching |

## Resources

- `getOnboardingGreeting()` in `server/src/agent/prompts/onboarding-system-prompt.ts`
- `getHandledGreeting()` in `server/src/agent/context/context-builder.ts`
- Related: #667 (system prompt), #668 (frontend hardcode)
