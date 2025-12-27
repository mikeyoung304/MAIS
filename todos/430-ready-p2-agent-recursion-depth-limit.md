---
status: ready
priority: p2
issue_id: "430"
tags: [agent, safety, orchestrator]
dependencies: []
---

# Agent Orchestrator Missing Recursion Depth Limit

## Problem Statement
The agent orchestrator recursively processes tool calls without a depth limit, which could lead to infinite loops or stack overflow if Claude keeps requesting tools.

## Severity: P2 - MEDIUM

Potential runaway agent execution. Comment claims depth limit exists but implementation is missing.

## Findings
- Location: `server/src/agent/orchestrator/orchestrator.ts:597-611`
- Issue: Comment says "limited depth" but no actual limit implementation

## Vulnerable Code
```typescript
// Lines 597-611: Recursive call without depth limit
if (finalResponse.content.some((block) => block.type === 'tool_use')) {
  // Comment says "with depth limit" but NO LIMIT EXISTS
  const recursiveResult = await this.processResponse(
    finalResponse,
    tenantId,
    sessionId,
    continuedMessages
    // No depth parameter passed!
  );
}
```

## Proposed Solution
Add explicit depth tracking:

```typescript
private async processResponse(
  response: Anthropic.Messages.Message,
  tenantId: string,
  sessionId: string,
  messages: MessageParam[],
  depth: number = 0  // Add depth counter
): Promise<...> {
  const MAX_RECURSION_DEPTH = 5;

  if (depth >= MAX_RECURSION_DEPTH) {
    logger.warn({ tenantId, sessionId, depth }, 'Max tool recursion depth reached');
    return {
      finalMessage: 'I\'ve reached my tool call limit for this request. Please try rephrasing your question.',
      ...
    };
  }

  // ... existing logic ...

  if (finalResponse.content.some((block) => block.type === 'tool_use')) {
    const recursiveResult = await this.processResponse(
      finalResponse,
      tenantId,
      sessionId,
      continuedMessages,
      depth + 1  // Increment depth
    );
  }
}
```

## Technical Details
- **Affected Files**: `server/src/agent/orchestrator/orchestrator.ts`
- **Recommended Depth Limit**: 5 (sufficient for complex multi-tool workflows)
- **Risk**: Low - adds safety without limiting normal usage

## Acceptance Criteria
- [ ] `processResponse` accepts depth parameter
- [ ] Recursion stops at MAX_RECURSION_DEPTH (5)
- [ ] User receives helpful message when limit reached
- [ ] Warning logged for debugging

## Review Sources
- Architecture Strategist: P2 - Add Recursion Depth Limit
- Pattern Recognition Specialist: P0 (Critical) in their assessment

## Notes
Source: Parallel code review session on 2025-12-26
The misleading comment should also be updated or removed
