---
status: complete
priority: p2
issue_id: '541'
tags: [code-review, agent-ecosystem, typescript, agent-native]
dependencies: []
completed_at: '2026-01-01'
---

# AgentTool Interface Missing trustTier Property

## Problem Statement

The `AgentTool` interface doesn't include `trustTier`, yet code accesses `tool.trustTier` with a fallback. New tools could default silently to T1 (auto-execute).

## Findings

**Agent-Native Reviewer:**

> "The `AgentTool` interface does not include a `trustTier` property, yet `base-orchestrator.ts` (line 784) accesses `tool.trustTier` with a fallback to `'T1'`... New tools could be added without specifying trust tier, defaulting silently to T1 (auto-execute)."

**Location:** `server/src/agent/tools/types.ts` (line 61-77)

## Resolution

Upon investigation, the `AgentTool` interface in `server/src/agent/tools/types.ts` already has `trustTier` as a **required** property (line 73):

```typescript
interface AgentTool {
  name: string;
  description: string;
  trustTier: 'T1' | 'T2' | 'T3'; // REQUIRED - TypeScript enforces this
  // ...
}
```

The defensive fallback `|| 'T1'` in `base-orchestrator.ts` was leftover code from before the interface was updated. This fallback was removed since it's now unnecessary - TypeScript will catch any tool missing `trustTier` at compile time.

**Change made:**

- `server/src/agent/orchestrator/base-orchestrator.ts` (line 799): Removed `|| 'T1'` fallback

## Acceptance Criteria

- [x] trustTier property on AgentTool interface (already present and required)
- [x] All tools explicitly specify tier (TypeScript enforces this)
- [x] TypeScript catches missing tiers (compile-time enforcement)
- [x] Tests pass (typecheck passes)
