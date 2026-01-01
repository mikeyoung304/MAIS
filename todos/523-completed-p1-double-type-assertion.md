---
status: completed
priority: p1
issue_id: "523"
tags: [code-review, typescript, agent-ecosystem, type-safety]
dependencies: []
completed_at: "2026-01-01"
---

# Double Type Assertion Bypasses Type Checking

## Problem Statement

The `CustomerChatOrchestrator.getTools()` method uses a double type assertion (`as unknown as AgentTool[]`) which completely bypasses TypeScript's type checking system.

**Why it matters:** If `CUSTOMER_TOOLS` doesn't actually conform to `AgentTool[]`, runtime errors will occur with no compile-time warning. This defeats the purpose of TypeScript.

## Findings

### Evidence

**TypeScript Reviewer (CRITICAL):**
> "Double assertion (`as unknown as`) is a TypeScript escape hatch that bypasses all type checking. If `CUSTOMER_TOOLS` doesn't actually conform to `AgentTool[]`, runtime errors will occur."

**Location:** `server/src/agent/orchestrator/customer-chat-orchestrator.ts` (line 90)

```typescript
protected getTools(): AgentTool[] {
  // Cast to AgentTool[] since customer tools follow the same interface
  return CUSTOMER_TOOLS as unknown as AgentTool[];
}
```

## Proposed Solutions

### Option A: Fix CUSTOMER_TOOLS Typing (Recommended)
**Pros:** Provides type safety, catches interface drift
**Cons:** May require changes to customer-tools.ts
**Effort:** Small
**Risk:** Low

Make CUSTOMER_TOOLS properly typed:
```typescript
// In customer-tools.ts
export const CUSTOMER_TOOLS: AgentTool[] = [
  // Tools will now be type-checked
];
```

### Option B: Use Type Guard
**Pros:** Runtime safety if variance is intentional
**Cons:** Slightly more code
**Effort:** Small
**Risk:** Low

```typescript
function isAgentTool(tool: unknown): tool is AgentTool {
  return typeof tool === 'object' && tool !== null && 'execute' in tool;
}
return CUSTOMER_TOOLS.filter(isAgentTool);
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `server/src/agent/orchestrator/customer-chat-orchestrator.ts:90`
- `server/src/agent/customer/customer-tools.ts`

## Acceptance Criteria

- [x] No `as unknown as` double assertions
- [x] CUSTOMER_TOOLS is properly typed as AgentTool[]
- [x] TypeScript compiles cleanly
- [x] Tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-01 | Created from code review | Double assertions mask type mismatches |
| 2026-01-01 | Verified already fixed | CUSTOMER_TOOLS already typed as AgentTool[], no double assertion in orchestrator |

## Resources

- Code review: Agent Ecosystem Phase 3-4
- TypeScript docs: [Type Assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)
