---
status: completed
priority: p2
issue_id: 740
tags: [code-review, typescript, type-safety, pr-27]
dependencies: []
---

# P2: Explicit `any` Types in Tool Result Handling

## Problem Statement

Three instances of explicit `any` type usage found in the tool result handling code. This bypasses TypeScript's type checking and could mask runtime errors.

**Impact:** Loss of type safety for tool results, potential runtime errors if result structure changes.

## Findings

**Reviewer:** kieran-typescript-reviewer

**Locations:**

1. `apps/web/src/components/agent/AgentPanel.tsx:313` - `(r: any)`
2. `apps/web/src/components/agent/AgentPanel.tsx:492` - `(r: any)` (duplicate)
3. `apps/web/src/components/agent/PanelAgentChat.tsx:55` - `data?: any`

**Current Implementation:**

```tsx
// AgentPanel.tsx:313, 492
const resultWithConfig = toolResults?.find(
  (r: any) => r.success && r.data?.updatedConfig
);

// PanelAgentChat.tsx:55
onToolComplete?: (toolResults?: Array<{ success: boolean; data?: any }>) => void;
```

## Proposed Solutions

### Solution A: Define Proper Interface (Recommended)

- **Pros:** Full type safety, IDE autocomplete, compile-time error detection
- **Cons:** Requires interface definition
- **Effort:** Small (20 minutes)
- **Risk:** Low

```tsx
// In types.ts or inline
interface ToolResultWithConfig {
  success: boolean;
  data?: {
    updatedConfig?: LandingPageConfig;
    [key: string]: unknown;
  };
}

// Usage with type guard
const resultWithConfig = toolResults?.find(
  (r): r is ToolResultWithConfig => r.success && !!r.data?.updatedConfig
);

// PanelAgentChat.tsx
import type { ToolResult } from '@/hooks/useAgentChat';

interface PanelAgentChatProps {
  onToolComplete?: (toolResults?: ToolResult[]) => void;
}
```

### Solution B: Use `unknown` with Type Guards

- **Pros:** Safer than `any`, forces runtime validation
- **Cons:** More verbose
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Solution A - Import existing `ToolResult` type from `useAgentChat.ts` and use type guards.

## Technical Details

**Affected Files:**

- `apps/web/src/components/agent/AgentPanel.tsx` (2 locations)
- `apps/web/src/components/agent/PanelAgentChat.tsx` (1 location)

## Acceptance Criteria

- [x] No `any` types in tool result handling
- [x] Proper type guards for narrowing
- [x] TypeScript compilation passes
- [x] ESLint @typescript-eslint/no-explicit-any passes

## Work Log

| Date       | Action    | Notes                                                     |
| ---------- | --------- | --------------------------------------------------------- |
| 2026-01-11 | Created   | From PR #27 multi-agent review                            |
| 2026-01-11 | Completed | Defined ToolResultWithConfig interface with type guards ✓ |

## Resources

- PR #27: https://github.com/mikeyoung304/MAIS/pull/27
