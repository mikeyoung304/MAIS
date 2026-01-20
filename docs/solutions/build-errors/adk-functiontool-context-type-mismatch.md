---
title: Fix ADK FunctionTool ToolContext Type Mismatch
category: build-errors
component: agent-v2
severity: P1
tags: [adk, typescript, functiontool, toolcontext, render, build-failure]
created: 2026-01-20
related:
  - ../patterns/ADK_A2A_PREVENTION_INDEX.md
  - ../patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md
  - ../patterns/A2A_SESSION_STATE_PREVENTION.md
---

# ADK FunctionTool ToolContext Type Mismatch

## Problem Statement

Render build failed with 41+ TypeScript errors in the project-hub agent. All errors related to ADK's FunctionTool type signatures being incompatible with our implementations.

**Impact:** Production deploys blocked for ~4 commits until resolved.

## Symptoms

```
error TS2322: Type 'ToolContext | undefined' is not assignable to type 'ToolContext'.
  Types of parameters '_ctx' and 'tool_context' are incompatible.

error TS2352: Conversion of type 'State' to type 'Record<string, unknown>' may be a mistake
  Index signature for type 'string' is missing in type 'State'.
```

## Root Cause Analysis

### Issue 1: FunctionTool Execute Context Type

ADK's `FunctionTool.execute()` signature passes `tool_context` as **potentially undefined**. Our tools were incorrectly typed to require it.

```typescript
// WRONG - context required
execute: async ({ param }, _ctx: ToolContext) => { ... }

// CORRECT - context optional
execute: async ({ param }, _ctx: ToolContext | undefined) => { ... }
```

**Why?** ADK may invoke tools without a context in certain scenarios (testing, direct invocation).

### Issue 2: State Type Casting

ADK's `State` type doesn't have an index signature, so TypeScript prevents direct casting to `Record<string, unknown>`.

```typescript
// WRONG - direct cast fails
const state = ctx.state as Record<string, unknown>;

// CORRECT - cast through unknown first
const state = ctx.state as unknown as Record<string, unknown>;
```

**Why?** TypeScript's type safety prevents "lie" casts between incompatible types. Casting through `unknown` is the escape hatch.

## Solution

### Fix 1: Update All Execute Signatures

Changed all 11 FunctionTool definitions in `server/src/agent-v2/deploy/project-hub/src/agent.ts`:

```typescript
// Before
const getProjectStatus = new FunctionTool({
  name: 'get_project_status',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
  }),
  execute: async ({ projectId }: { projectId: string }, _ctx: ToolContext) => {
    // ...
  },
});

// After
const getProjectStatus = new FunctionTool({
  name: 'get_project_status',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
  }),
  execute: async ({ projectId }: { projectId: string }, _ctx: ToolContext | undefined) => {
    // ...
  },
});
```

### Fix 2: Update State Casting

```typescript
// Before
function getContextFromSession(ctx: ToolContext) {
  const state = ctx.state as Record<string, unknown>;
  // ...
}

// After
function getContextFromSession(ctx: ToolContext) {
  // Cast through unknown because ADK's State type doesn't have an index signature
  const state = ctx.state as unknown as Record<string, unknown>;
  // ...
}
```

## Commits

1. `be8ee764` - Fix FunctionTool context type to `ToolContext | undefined`
2. `06ade04b` - Cast State through unknown for proper type narrowing

## Verification

```bash
# Run typecheck locally before pushing
npm run typecheck

# Grep for incorrect patterns
grep -rn "_ctx: ToolContext)" server/src/agent-v2/deploy/
# Should return no matches (all should have | undefined)
```

## Prevention

### Checklist Before Writing ADK FunctionTool Code

- [ ] Execute function context typed as `ToolContext | undefined`
- [ ] State access casts through `unknown` first
- [ ] Unused context params prefixed with underscore (`_ctx`)
- [ ] Run `npm run typecheck` before committing

### Code Review Guidelines

When reviewing ADK agent code:

1. Check all `execute:` functions for correct context type
2. Verify State casting uses `as unknown as Record<...>`
3. Run typecheck on agent-v2 directory

### Quick Reference Pattern

```typescript
import { LlmAgent, FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';

const myTool = new FunctionTool({
  name: 'my_tool',
  description: 'Does something useful',
  parameters: z.object({
    input: z.string().describe('Input value'),
  }),
  execute: async (
    { input }: { input: string },
    _ctx: ToolContext | undefined // ✅ Must allow undefined
  ) => {
    // If you need state, check for undefined first
    if (_ctx?.state) {
      const state = _ctx.state as unknown as Record<string, unknown>;
      // Use state...
    }
    return { success: true, result: input };
  },
});

export const agent = new LlmAgent({
  name: 'agent',
  model: 'gemini-2.0-flash',
  tools: [myTool],
  generateContentConfig: {
    // ✅ Not "config"
    temperature: 0.4,
  },
});
```

## Related Documentation

- [ADK_A2A_PREVENTION_INDEX.md](../patterns/ADK_A2A_PREVENTION_INDEX.md) - Issue #8 covers FunctionTool API
- [ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md](../patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md) - 10 commandments
- [A2A_SESSION_STATE_PREVENTION.md](../patterns/A2A_SESSION_STATE_PREVENTION.md) - State access patterns
- **CLAUDE.md Pitfall #51** - FunctionTool API mismatch summary

## Key Takeaway

ADK's TypeScript types are strict about optionality. Always check the actual type signatures in `@google/adk` rather than assuming based on typical patterns. The `| undefined` pattern is intentional design, not a bug.
