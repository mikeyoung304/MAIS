---
status: complete
priority: p1
issue_id: '553'
tags: [code-review, security, agent-ecosystem, quality-first-triage]
dependencies: []
resolved_at: 2026-01-01
resolution: 'Moved detectPromptInjection() to BaseOrchestrator, added enableInjectionDetection config flag (default true), getInjectionBlockMessage() hook for subclass customization, 17 new tests for injection patterns.'
---

# P1: Prompt Injection Detection Only Applied to CustomerChat

> **Quality-First Triage Upgrade:** P2 → P1. "Higher-privilege endpoints have weaker input validation. This inverts the security model."

## Problem Statement

Prompt injection detection (NFKC normalization + pattern matching) is only applied in `CustomerChatOrchestrator`:

```typescript
// customer-chat-orchestrator.ts:176-181
if (this.detectPromptInjection(userMessage)) {
  logger.warn('Potential prompt injection detected', {
    tenantId,
    preview: userMessage.slice(0, 100),
  });
  return { response: "I'm here to help with booking..." };
}
```

Neither `OnboardingOrchestrator` nor `AdminOrchestrator` have this protection.

**Why it matters:**

- Onboarding orchestrator has **higher-privilege tools** (upsert_services, update_storefront)
- Admin orchestrator has **full tool access**
- Pattern-based detection can be bypassed with creative encoding

## Findings

| Reviewer          | Finding                                             |
| ----------------- | --------------------------------------------------- |
| Security Reviewer | P2: Prompt injection detection only in CustomerChat |
| Security Reviewer | Pattern matching can be bypassed                    |

## Proposed Solutions

### Option 1: Move Detection to BaseOrchestrator (Recommended)

**Effort:** Small (1-2 hours)

Apply prompt injection detection in the base `chat()` method:

```typescript
// base-orchestrator.ts in chat() method
protected async chat(tenantId: string, sessionId: string, userMessage: string) {
  if (this.getConfig().enableInjectionDetection && this.detectPromptInjection(userMessage)) {
    logger.warn('Potential prompt injection detected', { tenantId, agentType: this.getConfig().agentType });
    return this.handleInjectionAttempt(userMessage);
  }
  // ... rest of chat logic
}
```

**Pros:**

- All orchestrators protected
- Configurable per-orchestrator

**Cons:**

- May increase false positives for admin use

### Option 2: Add to Admin and Onboarding Separately

**Effort:** Medium (2-3 hours)

Copy detection logic to other orchestrators with tuned patterns.

**Pros:**

- Can customize patterns per context

**Cons:**

- Code duplication
- Risk of drift

### Option 3: Second-Layer AI Content Safety

**Effort:** Large (4-6 hours)

Use Claude's content moderation or a dedicated safety classifier.

**Pros:**

- More robust than regex
- Catches semantic attacks

**Cons:**

- Additional API calls
- Latency impact

## Recommended Action

Implement **Option 1** first (move to base), then consider **Option 3** as enhancement.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/base-orchestrator.ts` - Add detection
- `server/src/agent/orchestrator/customer-chat-orchestrator.ts` - Remove redundant
- `server/src/agent/orchestrator/types.ts` - Add config flag

**Detection Patterns (current):**

```typescript
const INJECTION_PATTERNS = [
  /ignore.*previous.*instructions/i,
  /disregard.*system.*prompt/i,
  /you are now/i,
  // ... more patterns
];
```

## Acceptance Criteria

- [ ] Prompt injection detection available in base orchestrator
- [ ] Config flag `enableInjectionDetection` added to OrchestratorConfig
- [ ] All three orchestrators have detection enabled
- [ ] Logged injection attempts include agent type
- [ ] Test for injection detection across orchestrator types

## Work Log

| Date       | Action                   | Learnings                       |
| ---------- | ------------------------ | ------------------------------- |
| 2026-01-01 | Created from code review | Security Sentinel flagged as P2 |

## Resources

- Current detection: customer-chat-orchestrator.ts:176-181
- OWASP LLM Top 10: https://owasp.org/www-project-top-10-for-large-language-model-applications/
