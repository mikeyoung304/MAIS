---
status: pending
priority: p1
issue_id: '5204'
tags: [code-review, session-bootstrap, agent-native, concierge, context-injection]
dependencies: []
---

# knownFacts Injection Lacks Refresh Mechanism

## Problem Statement

The onboarding prompt is built once at bootstrap time with the known facts. If a user stores new discovery facts via `store_discovery_fact` during a long conversation, these facts are NOT reflected in the prompt context. The agent loses awareness of what it knows.

**Why it matters:** The agent may re-ask questions about facts it just stored, creating a frustrating user experience.

## Findings

**Location:** `server/src/agent-v2/deploy/concierge/src/agent.ts:1218-1231`

**Current Code:**

```typescript
onboardingPrompt: isOnboarding
  ? buildOnboardingPrompt(onboardingContext.resumeGreeting, onboardingContext.knownFacts)
  : null,
```

The prompt is built once from bootstrap data - new facts stored via store_discovery_fact don't update it.

**Related Location:** `agent.ts:1287-1291` - store_discovery_fact returns minimal feedback

```typescript
return {
  stored: true,
  key: params.key,
  message: `Got it! I'll remember that.`,
};
```

**Reviewer:** Agent-Native Architecture Review (P1-001, P2-002)

## Proposed Solutions

### Option A: Return Updated Facts in Response (Recommended)

**Pros:** Simple, immediate feedback, no additional API calls
**Cons:** Response size increases slightly
**Effort:** Small
**Risk:** Low

```typescript
return {
  stored: true,
  key: params.key,
  value: params.value,
  totalFactsKnown: Object.keys(updatedFacts).length,
  knownKeys: Object.keys(updatedFacts),
  message: `Got it! I now know: ${Object.keys(updatedFacts).join(', ')}`,
};
```

### Option B: Add refresh_onboarding_context Tool

**Pros:** Explicit refresh, full context available
**Cons:** Extra tool call required, more complex
**Effort:** Medium
**Risk:** Low

### Option C: Add get_known_facts Read-Only Tool

**Pros:** Agent can check what it knows anytime
**Cons:** Doesn't solve mid-conversation staleness automatically
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts`
- `server/src/routes/internal-agent.routes.ts`

**Affected Components:**

- store_discovery_fact tool
- Bootstrap endpoint (if adding get_known_facts)

## Acceptance Criteria

- [ ] store_discovery_fact returns updated list of known fact keys
- [ ] Agent can reason about what it knows mid-conversation
- [ ] No redundant questions about already-stored facts

## Work Log

| Date       | Action                         | Learnings                                          |
| ---------- | ------------------------------ | -------------------------------------------------- |
| 2026-01-20 | Created from /workflows:review | Agent-Native reviewer identified context staleness |

## Resources

- PR: feature/session-bootstrap-onboarding
- Review: Agent-Native Architecture Review
- Principle: "Active memory means the agent knows what it knows"
