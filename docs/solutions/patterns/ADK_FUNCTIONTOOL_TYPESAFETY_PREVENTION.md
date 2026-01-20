---
title: ADK FunctionTool TypeScript Safety Prevention
category: patterns
component: agent-v2
severity: P0
tags: [google-adk, typescript, functiontool, type-safety, code-review, build-safety]
created: 2026-01-19
updated: 2026-01-19
related:
  - ADK_A2A_PREVENTION_INDEX.md
  - ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md
  - adk-agent-deployment-pattern.md
---

# ADK FunctionTool TypeScript Safety Prevention

**Problem Solved:** 41 TypeScript errors in project-hub agent preventing Render deploy
**Root Cause:** FunctionTool API mismatch between ADK specification and incorrect imports/patterns
**Impact:** Build failures, production deploy blocking, runtime type errors

---

## The 3 Critical Type Mismatches

### Issue 1: Context Parameter Can Be Undefined

**What Broke:**

```typescript
// WRONG - TypeScript error: Type 'ToolContext' is not assignable to 'ToolContext | undefined'
execute: async (params, ctx: ToolContext) => {
  // ...
};
```

**Why It Fails:**
ADK's `execute()` function signature passes `tool_context` as **potentially undefined**. If your function signature requires a non-null `ToolContext`, TypeScript will reject it with 41+ errors across all tool definitions.

**The Fix:**

```typescript
// CORRECT - Accept undefined context
execute: async (params, _ctx: ToolContext | undefined) => {
  // Context may not be available, handle gracefully
  // Prefix with underscore if unused
};
```

**Example (From project-hub agent):**

```typescript
const getProjectStatus = new FunctionTool({
  name: 'get_project_status',
  description: 'Get the current status of the customer project',
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
  }),
  execute: async (
    { projectId }: { projectId: string },
    _ctx: ToolContext | undefined // ✅ Allows undefined
  ) => {
    // Implementation...
  },
});
```

---

### Issue 2: State Type Lacks Index Signature

**What Broke:**

```typescript
// WRONG - TypeScript error: 'State' is not assignable to 'Record<string, unknown>'
const state = ctx.state as Record<string, unknown>;
```

**Why It Fails:**
ADK's `State` type doesn't have an index signature `[key: string]`, so TypeScript doesn't allow direct casting to `Record<string, unknown>`.

**The Fix:**

```typescript
// CORRECT - Cast through unknown first
const state = ctx.state as unknown as Record<string, unknown>;
```

**Example (From project-hub agent):**

```typescript
function getContextFromSession(ctx: ToolContext): {
  contextType: 'customer' | 'tenant';
  tenantId: string;
} {
  // Cast through unknown because ADK's State type doesn't have index signature
  const state = ctx.state as unknown as Record<string, unknown>;

  return {
    contextType: (state.contextType as 'customer' | 'tenant') || 'customer',
    tenantId: (state.tenantId as string) || '',
  };
}
```

---

### Issue 3: Wrong Property Names in Tool Definition

**What Broke:**

```typescript
// WRONG - ADK doesn't recognize these properties
new FunctionTool({
  inputSchema: z.object({}), // ❌ Wrong property name
  func: async () => {}, // ❌ Wrong property name
});
```

**Why It Fails:**
ADK's API uses `parameters` and `execute`, not the older `inputSchema` and `func` naming convention.

**The Fix:**

```typescript
// CORRECT - Use ADK's official property names
new FunctionTool({
  parameters: z.object({}), // ✅ Correct property
  execute: async () => {}, // ✅ Correct property
});
```

---

## Prevention Checklist: Before Writing FunctionTool Code

Use this checklist **before** you write any tool:

### Type Signatures

- [ ] Execute function signature: `execute: async (params: {...}, _ctx: ToolContext | undefined)`
- [ ] If context unused, prefix with underscore: `_ctx` not `ctx`
- [ ] State access uses: `ctx.state as unknown as Record<string, unknown>`
- [ ] All type casts are explicit and documented

### Property Names

- [ ] Tool definition uses `parameters` (not `inputSchema`)
- [ ] Tool definition uses `execute` (not `func`)
- [ ] LlmAgent uses `generateContentConfig` (not `config`)

### Zod Schemas

- [ ] All Zod types are ADK-compatible (no `z.record()`, `z.tuple()`, `z.intersection()`, `z.lazy()`)
- [ ] Complex objects use `z.any().describe('description')`
- [ ] All parameters have `.describe()` for LLM guidance

### Security & Error Handling

- [ ] Tool returns result data, not instructions
- [ ] Tool has try/catch with proper error messages
- [ ] Tool validates input before using
- [ ] Tool includes tenantId scoping for database calls

### Code Review Readiness

- [ ] Run `npm run typecheck` - zero errors in agent code
- [ ] Run `npm run build` - zero TypeScript errors
- [ ] Grep for old patterns: `grep -rn "inputSchema:" .`
- [ ] Grep for old patterns: `grep -rn "func: async" .`

---

## Code Review Checklist: When Reviewing FunctionTool PRs

### TypeScript Safety

- [ ] All `execute` functions typed as `async (..., _ctx: ToolContext | undefined)`
- [ ] State accessed via `ctx.state as unknown as Record<string, unknown>`
- [ ] No `ctx` without underscore when unused
- [ ] No direct casts to `Record<string, unknown>` (must go through `unknown`)

### API Correctness

- [ ] All tools use `parameters` property (not `inputSchema`)
- [ ] All tools use `execute` property (not `func`)
- [ ] If LlmAgent present, uses `generateContentConfig`
- [ ] No `config` property in LlmAgent definition

### Code Quality

- [ ] Parameters have `.describe()` for LLM tool calling
- [ ] Execute function has explicit type annotations on params
- [ ] Try/catch wraps all I/O operations
- [ ] Returns actual results, not instructions or prompts

### Build Verification

- [ ] `npm run typecheck` passes in your local
- [ ] No TypeScript errors in terminal output
- [ ] No `any` types without documented justification

### Code Review Comment Template

If you find issues, use this comment:

````markdown
## FunctionTool TypeScript Safety Issue

### Problem

[Describe the issue]

### Fix Required

```typescript
// BEFORE (incorrect)
[show wrong code]

// AFTER (correct)
[show correct code]
```
````

### Why

[Explain the ADK API rule]

See: docs/solutions/patterns/ADK_FUNCTIONTOOL_TYPESAFETY_PREVENTION.md

````

---

## Test Commands: Verification Workflow

### 1. Full TypeScript Check (Before Commit)

```bash
# Check entire codebase for type errors
npm run typecheck

# Expected output:
# ✓ 0 errors found
# If errors appear, fix before committing
````

### 2. Grep for Anti-Patterns (Code Review)

```bash
# Check for old property names in agent code
grep -rn "inputSchema:" server/src/agent-v2/deploy/
grep -rn "func: async" server/src/agent-v2/deploy/
grep -rn "\.config = {" server/src/agent-v2/deploy/*/src/agent.ts

# Expected output: (no matches)
# All should return empty - no matches means you're good
```

### 3. Verify Context Types (Safety Check)

```bash
# Find all execute functions and verify context type
grep -rn "execute: async" server/src/agent-v2/deploy/*/src/agent.ts | head -5

# Check one specific agent for context signature
grep -A5 "execute: async" server/src/agent-v2/deploy/project-hub/src/agent.ts | head -20

# Verify it shows: _ctx: ToolContext | undefined
```

### 4. Build Verification (Before Deploy)

```bash
# Full build including type checking
npm run build

# If build succeeds, you're safe to deploy
# Look for: "Successfully compiled" or similar message
```

### 5. Focus Testing on Single Agent

```bash
# If working on one agent, typecheck that workspace
npm run --workspace=server typecheck

# Or test just the agent file's syntax with ts-node
npx ts-node server/src/agent-v2/deploy/project-hub/src/agent.ts
```

---

## Quick Reference: Copy-Paste Patterns

### Pattern 1: Basic FunctionTool Template

```typescript
import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';

const myTool = new FunctionTool({
  name: 'my_tool_name',
  description: 'What this tool does',

  // ✅ CORRECT property: parameters
  parameters: z.object({
    userId: z.string().describe('The user ID'),
    action: z.enum(['create', 'update', 'delete']).describe('Action to perform'),
    metadata: z.any().describe('Additional metadata as JSON object'),
  }),

  // ✅ CORRECT method: execute
  // ✅ CORRECT context type: ToolContext | undefined
  execute: async (
    {
      userId,
      action,
      metadata,
    }: {
      userId: string;
      action: 'create' | 'update' | 'delete';
      metadata: unknown;
    },
    _ctx: ToolContext | undefined // ✅ Underscore because unused
  ) => {
    try {
      // Your implementation here
      return {
        success: true,
        result: {
          /* your data */
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
```

### Pattern 2: Tool That Uses Context

```typescript
const toolWithContext = new FunctionTool({
  name: 'get_project_status',
  description: 'Get status of a project',
  parameters: z.object({
    projectId: z.string().describe('Project ID'),
  }),

  // ✅ Use context if available, but don't require it
  execute: async (
    { projectId }: { projectId: string },
    ctx: ToolContext | undefined // ✅ No underscore - we use it
  ) => {
    try {
      // Option 1: Access state if context available
      let userId: string | undefined;
      if (ctx) {
        const state = ctx.state as unknown as Record<string, unknown>;
        userId = state.userId as string | undefined;
      }

      // Continue with implementation
      return {
        success: true,
        projectId,
        userId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
```

### Pattern 3: Accessing State Safely

```typescript
function getContextFromSession(ctx: ToolContext | undefined): {
  tenantId: string;
  userId?: string;
} {
  if (!ctx) {
    return { tenantId: '', userId: undefined };
  }

  // CRITICAL: Cast through unknown first, THEN to Record
  const state = ctx.state as unknown as Record<string, unknown>;

  return {
    tenantId: (state.tenantId as string) || '',
    userId: state.userId as string | undefined,
  };
}

// Usage in tool:
execute: async (params, ctx: ToolContext | undefined) => {
  const { tenantId, userId } = getContextFromSession(ctx);
  // Now tenantId and userId are safely typed
};
```

### Pattern 4: LlmAgent Definition

```typescript
import { LlmAgent } from '@google/adk';

// ✅ CORRECT property: generateContentConfig
export const agent = new LlmAgent({
  name: 'project-hub-agent',
  model: 'gemini-2.0-flash',

  // ✅ Use generateContentConfig, not config
  generateContentConfig: {
    temperature: 0.4,
    maxOutputTokens: 2048,
    topP: 0.95,
    topK: 40,
  },

  systemPrompt: 'Your system prompt here...',
  tools: [tool1, tool2, tool3],
});
```

---

## Common Mistakes & Fixes

| Mistake                                | Error                         | Fix                                                   |
| -------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| `ctx: ToolContext`                     | TypeScript error in execute   | Change to `ctx: ToolContext \| undefined`             |
| `ctx.state as Record<string, unknown>` | Direct cast fails             | Use `ctx.state as unknown as Record<string, unknown>` |
| `inputSchema: z.object({})`            | Property not recognized       | Change to `parameters: z.object({})`                  |
| `func: async () => {}`                 | Property not recognized       | Change to `execute: async () => {}`                   |
| `config: { temperature: 0.4 }`         | LlmAgent won't use it         | Change to `generateContentConfig: {...}`              |
| `ctx` parameter unused                 | ESLint warning                | Prefix with underscore: `_ctx`                        |
| State type errors                      | Can't access state properties | Always cast through unknown first                     |

---

## Real-World Example: project-hub Agent

The project-hub agent fixed all 3 issues. Here's the pattern used:

```typescript
// ✅ Correct import
import { LlmAgent, FunctionTool, type ToolContext } from '@google/adk';

// ✅ Correct state access function
function getContextFromSession(ctx: ToolContext): {
  contextType: 'customer' | 'tenant';
  tenantId: string;
  customerId?: string;
} {
  // CRITICAL: Cast through unknown because ADK's State lacks index signature
  const state = ctx.state as unknown as Record<string, unknown>;
  return {
    contextType: (state.contextType as 'customer' | 'tenant') || 'customer',
    tenantId: (state.tenantId as string) || '',
    customerId: state.customerId as string | undefined,
  };
}

// ✅ Correct tool definition
const getProjectStatus = new FunctionTool({
  name: 'get_project_status',
  description: 'Get project status',

  // ✅ parameters (not inputSchema)
  parameters: z.object({
    projectId: z.string().describe('The project ID'),
  }),

  // ✅ execute (not func)
  // ✅ context as ToolContext | undefined
  execute: async ({ projectId }: { projectId: string }, _ctx: ToolContext | undefined) => {
    try {
      const project = await callBackendAPI(`/projects/${projectId}`, 'GET');
      return { success: true, project };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed',
      };
    }
  },
});

// ✅ Correct LlmAgent definition
export const agent = new LlmAgent({
  name: 'project-hub',
  model: 'gemini-2.0-flash',

  // ✅ generateContentConfig (not config)
  generateContentConfig: {
    temperature: 0.4,
    maxOutputTokens: 2048,
  },

  systemPrompt: PROJECT_HUB_SYSTEM_PROMPT,
  tools: [getProjectStatus, getPrepChecklist, answerPrepQuestion, submitRequest],
});
```

---

## Prevention Strategy: Integration Checklist

### When Starting New Agent

1. **Copy the basic template** from "Pattern 1" above
2. **Update property names** (not inputSchema, use parameters)
3. **Add context type** as `ToolContext | undefined`
4. **Add state casting** helper function
5. **Run `npm run typecheck`** - expect 0 errors
6. **Commit and deploy**

### When Reviewing PRs

1. **Check context types** - must be `ToolContext | undefined`
2. **Check state access** - must cast through `unknown`
3. **Check property names** - must use `parameters` and `execute`
4. **Run typecheck locally** - verify no errors
5. **Approve only if all above pass**

### When Debugging Type Errors

1. **Count the errors** - if 41+, likely context type issue
2. **Check execute signature** - is context `ToolContext | undefined`?
3. **Check state access** - does it cast through `unknown`?
4. **Check property names** - are you using `parameters` and `execute`?
5. **Run `npm run typecheck`** - see exact error locations

---

## Why These Rules Exist

| Rule                                   | Reason                                        | Consequence                                                  |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| `ToolContext \| undefined`             | ADK passes undefined in some calling contexts | TypeScript rejects if you require non-null                   |
| Cast through `unknown`                 | ADK State type lacks index signature          | TypeScript won't allow direct `Record<string, unknown>` cast |
| `parameters` (not `inputSchema`)       | ADK API naming convention                     | Property silently ignored, tool can't call tool              |
| `execute` (not `func`)                 | ADK API naming convention                     | Property silently ignored, execute never runs                |
| `generateContentConfig` (not `config`) | LlmAgent API naming convention                | Config silently ignored, settings don't apply                |

---

## Performance & Debugging

### TypeScript Check Performance

```bash
# Fast check (just agent code)
npm run --workspace=server typecheck

# Full check (might take 30s)
npm run typecheck

# Fastest: grep for known patterns
grep -rn "inputSchema:" . # Should return nothing
```

### Debug Type Errors

If you see 40+ errors like "Type 'ToolContext' is not assignable to 'ToolContext | undefined'":

1. **Find the pattern**: `grep -rn "execute: async" | grep -v "ToolContext | undefined"`
2. **Fix each occurrence** to add `| undefined` to context param
3. **Rerun typecheck** - errors should drop significantly

---

## Additional Resources

- **Main Prevention Index**: [ADK_A2A_PREVENTION_INDEX.md](./ADK_A2A_PREVENTION_INDEX.md) - Issue 8
- **Development Quick Ref**: [ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md](./ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md)
- **Global Pitfalls**: [CLAUDE.md](../../CLAUDE.md) - Pitfall #51
- **Example Agent**: `/server/src/agent-v2/deploy/project-hub/src/agent.ts`

---

## Commit Reference

This prevention guide was created to address:

- Commit `c34273c2` - Fixed FunctionTool API usage (41 TypeScript errors)
- Commit `be8ee764` - Fixed context typing as `ToolContext | undefined`
- Commit `06ade04b` - Fixed State casting through `unknown`

**Issue**: #8 (FunctionTool API mismatch prevention)
**Created**: 2026-01-19
**Last Updated**: 2026-01-19
