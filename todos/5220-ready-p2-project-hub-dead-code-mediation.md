---
status: ready
priority: p2
issue_id: '5220'
tags: [quality, agent-v2, project-hub, code-review, dead-code]
dependencies: []
---

# Project Hub: Dead Code - Mediation Logic Defined but Never Used

## Problem Statement

Several functions and constants related to mediation logic are defined but never called anywhere in the code:

- `shouldAlwaysEscalate()` function (line 241-244)
- `ALWAYS_ESCALATE_KEYWORDS` constant (line 33)
- `AUTO_HANDLE_THRESHOLD` constant (line 31)
- `ESCALATE_THRESHOLD` constant (line 32)

This means the mediation behavior described in the system prompt (auto-handle >80% confidence, escalate <50%, always escalate keywords) is NOT programmatically enforced.

**Impact:** Per pitfall #48, writing security/utility functions without wiring them up is a common mistake. The agent may not escalate sensitive keywords like "refund" or "lawyer" as expected.

## Findings

### TypeScript Reviewer

```typescript
const ALWAYS_ESCALATE_KEYWORDS = ['refund', 'complaint', 'lawyer', 'legal', 'cancel', 'sue'];

function shouldAlwaysEscalate(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return ALWAYS_ESCALATE_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));
}
// ^ Never called anywhere
```

### Performance Oracle

- These are loaded at module level but never executed
- Unnecessary code bloat

### Simplicity Reviewer

- Dead code should be removed or implemented
- Currently misleading - appears implemented but isn't

## Proposed Solutions

### Option A: Implement the Mediation Logic (Recommended)

Wire up `shouldAlwaysEscalate` in customer tools:

```typescript
const answerPrepQuestion = new FunctionTool({
  execute: async ({ projectId, question }, ctx) => {
    // Enforce escalation for sensitive keywords BEFORE answering
    if (shouldAlwaysEscalate(question)) {
      return {
        success: false,
        requiresEscalation: true,
        reason: 'This question contains keywords requiring tenant review',
        suggestedAction: 'Use submit_request tool to escalate to tenant',
      };
    }

    const answer = await callBackendAPI(...);

    // Check confidence threshold
    if (answer.confidence < ESCALATE_THRESHOLD) {
      return {
        success: true,
        answer: answer.answer,
        shouldEscalate: true,
        confidence: answer.confidence,
        message: 'Low confidence - consider escalating to tenant',
      };
    }
    // ... rest
  }
});
```

**Pros:** Programmatic enforcement of documented behavior
**Cons:** Changes agent behavior (may need prompt updates)
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Option B: Remove Dead Code

Delete unused constants and functions if prompt-based handling is sufficient.

**Pros:** Cleaner code
**Cons:** Loses the programmatic safety net
**Effort:** Small (10 minutes)
**Risk:** Low

## Recommended Action

**Option A** - The mediation logic was clearly intended to be used. Implement it.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts` (lines 31-33, 241-244)

**Tools to Update:**

- `answerPrepQuestion` - check keywords and confidence
- `submitRequest` - could auto-set urgency based on keywords

## Acceptance Criteria

- [ ] `shouldAlwaysEscalate()` is called before answering prep questions
- [ ] Confidence thresholds are checked after getting answers
- [ ] Keywords trigger escalation with clear user message
- [ ] Tests verify keyword escalation works
- [ ] Remove any code that remains unused after implementation

## Work Log

| Date       | Action                               | Result                    |
| ---------- | ------------------------------------ | ------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by 3 reviewers |

## Resources

- [CLAUDE.md Pitfall #48](CLAUDE.md) - Dead security functions
