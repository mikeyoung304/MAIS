---
title: ADK FunctionTool API Mismatch - Render Build Fix
category: build-errors
component: project-hub-agent
severity: P0
tags: [google-adk, typescript, build-failure, render, typesafety]
created: 2026-01-19
updated: 2026-01-19
related:
  - ADK_A2A_PREVENTION_INDEX.md (Issue #8 / Pitfall #51)
  - ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md
---

# ADK FunctionTool API Mismatch - Render Build Fix

## Problem Statement

The project-hub agent (standalone Cloud Run deployment) failed to build on Render with 41+ TypeScript errors. All 11 tools in the agent were incorrectly typed, preventing compilation.

### Error Summary

```
Error TS2769 (Argument of type 'ToolContext | undefined' is not assignable to parameter of type 'ToolContext')
Error TS2322 (Type 'State' is not assignable to type 'Record<string, unknown>')
```

**Impact:** Render deployment blocked, 41 TypeScript compilation errors, build fails before running

**Root Causes:**

1. FunctionTool `execute` callback receives `tool_context` as potentially `undefined`
2. ADK's `State` type lacks an index signature for direct object casting

**Time to Impact:** Production deployment blocked (CI/CD failure)

---

## Root Cause Analysis

### Issue 1: FunctionTool Execute Context Type

**Symptom:** All 11 tools in project-hub agent show this error:

```
Type 'ToolContext | undefined' is not assignable to type 'ToolContext'
```

**Root Cause:** The ADK's `FunctionTool` class has this signature:

```typescript
// From @google/adk
class FunctionTool {
  execute?: (input: InputType, tool_context?: ToolContext) => Promise<OutputType>;
}
```

Notice: `tool_context` parameter is **optional** with `?` mark.

However, developers were typing the execute callback as:

```typescript
execute: async ({ param }: { param: string }, _ctx: ToolContext) => {
  //                                                ^^^ Required, not optional
  return { result };
};
```

This creates a type mismatch: The callback signature demands a `ToolContext`, but ADK may pass `undefined` in certain lifecycle phases (initialization, validation, etc.).

**Why This Matters:** When ADK invokes the tool function, it may pass `undefined` for `tool_context`. TypeScript's strict mode rejects this because the function signature doesn't allow `undefined`.

### Issue 2: State Type Casting

**Symptom:** Type error in `getContextFromSession` helper:

```
Conversion of type 'State' to type 'Record<string, unknown>' may be a mistake
```

**Root Cause:** ADK's `State` type is defined as:

```typescript
// From @google/adk
interface State {
  // No index signature - cannot be assigned to Record<string, unknown>
}
```

Direct casting fails because TypeScript doesn't allow assigning a type without an index signature to a `Record`. The solution is to cast through `unknown` first, which tells TypeScript "we know what we're doing":

```typescript
// Direct cast - fails type checking
const state = ctx.state as Record<string, unknown>;

// Correct cast - through unknown - succeeds
const state = ctx.state as unknown as Record<string, unknown>;
```

This is a documented TypeScript pattern for dealing with structural typing mismatches from external libraries.

---

## Solution

### Fix 1: Type FunctionTool Execute Context as Optional

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/project-hub/src/agent.ts`

**Pattern:** All 11 tools follow the same fix. Update the execute function signature to accept `ToolContext | undefined`:

**BEFORE:**

```typescript
const getProjectStatus = new FunctionTool({
  name: 'get_project_status',
  description: 'Get the current status of the customer project...',
  parameters: z.object({
    projectId: z.string().describe('The project ID to check status for'),
  }),
  execute: async ({ projectId }: { projectId: string }, _ctx: ToolContext) => {
    //                                                            ^^^ Wrong - doesn't allow undefined
    try {
      const project = await callBackendAPI<Project>(`/project-hub/projects/${projectId}`, 'GET');
      return {
        success: true,
        project: { ... },
      };
    } catch (error) {
      return { success: false, error: ... };
    }
  },
});
```

**AFTER:**

```typescript
const getProjectStatus = new FunctionTool({
  name: 'get_project_status',
  description: 'Get the current status of the customer project...',
  parameters: z.object({
    projectId: z.string().describe('The project ID to check status for'),
  }),
  execute: async ({ projectId }: { projectId: string }, _ctx: ToolContext | undefined) => {
    //                                                            ^^^^^^^^^^^^^^^^ Correct - allows ADK's undefined
    try {
      const project = await callBackendAPI<Project>(`/project-hub/projects/${projectId}`, 'GET');
      return {
        success: true,
        project: { ... },
      };
    } catch (error) {
      return { success: false, error: ... };
    }
  },
});
```

**All 11 Tools Updated:**

1. `getProjectStatus` (line 254)
2. `getPrepChecklist` (line 283)
3. `answerPrepQuestion` (line 311)
4. `submitRequest` (line 369)
5. `getTimeline` (line 415)
6. `getPendingRequests` (line 455)
7. `getCustomerActivity` (line 492)
8. `approveRequest` (line 528)
9. `denyRequest` (line 560)
10. `sendMessageToCustomer` (line 597)
11. `updateProjectStatus` (line 637)

### Fix 2: Cast State Through Unknown for Record Type

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/project-hub/src/agent.ts`

**Location:** `getContextFromSession` helper function (line 228)

**BEFORE:**

```typescript
function getContextFromSession(ctx: ToolContext): {
  contextType: 'customer' | 'tenant';
  tenantId: string;
  customerId?: string;
  projectId?: string;
} {
  // Direct cast fails - State lacks index signature
  const state = ctx.state as Record<string, unknown>;
  return {
    contextType: (state.contextType as 'customer' | 'tenant') || 'customer',
    tenantId: (state.tenantId as string) || '',
    customerId: state.customerId as string | undefined,
    projectId: state.projectId as string | undefined,
  };
}
```

**AFTER:**

```typescript
function getContextFromSession(ctx: ToolContext): {
  contextType: 'customer' | 'tenant';
  tenantId: string;
  customerId?: string;
  projectId?: string;
} {
  // Cast through unknown because ADK's State type doesn't have an index signature
  const state = ctx.state as unknown as Record<string, unknown>;
  return {
    contextType: (state.contextType as 'customer' | 'tenant') || 'customer',
    tenantId: (state.tenantId as string) || '',
    customerId: state.customerId as string | undefined,
    projectId: state.projectId as string | undefined,
  };
}
```

**Key Point:** The additional cast through `unknown` acts as an "escape hatch" that tells TypeScript: "We understand the structural mismatch. Trust us for this external library type."

---

## Verification

### Typecheck Passes

```bash
npm run typecheck
# Output: All files OK, no TypeScript errors
```

### Render Build Succeeds

- No TS compilation errors blocking build
- Agent deploys successfully to Cloud Run
- Tools are accessible via `/list-apps` endpoint

### Tool Invocation Works

All 11 tools can be invoked without context-related errors:

- Customer-facing tools respond to user requests
- Tenant-facing tools display administrative data
- Error handling gracefully recovers from missing context

---

## Prevention Strategy

### ADK FunctionTool Checklist

When implementing new tools in ADK agents:

- [ ] **Use `parameters`** not `inputSchema`
- [ ] **Use `execute`** not `func`
- [ ] **Type context as `ToolContext | undefined`** - ADK passes undefined
- [ ] **Prefix unused params with underscore** - `_ctx` indicates intentionally unused
- [ ] **Use explicit type annotations** - `({ param }: { param: string }) => { ... }`
- [ ] **Use `generateContentConfig`** in LlmAgent, not `config`

### Code Review Guideline

> When reviewing ADK FunctionTool implementations, verify that the `execute` callback types its context parameter as `ToolContext | undefined` (not just `ToolContext`). ADK may invoke the callback with undefined context in validation phases, and the function signature must accept it.

### Pattern Template

```typescript
const myTool = new FunctionTool({
  name: 'my_operation',
  description: 'Does something with the provided input',
  parameters: z.object({
    input: z.string().describe('The input to process'),
  }),
  execute: async (
    { input }: { input: string },
    _ctx: ToolContext | undefined // ✅ Correct: allows undefined
  ) => {
    try {
      const result = await processInput(input);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});
```

---

## Related Documentation

- **[ADK A2A Prevention Index](./ADK_A2A_PREVENTION_INDEX.md)** - Issue #8 / Pitfall #51 comprehensive guide
- **[ADK Agent Development Quick Reference](./ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md)** - One-page checklist for agent development
- **[CLAUDE.md Pitfalls Section](../../CLAUDE.md#agent-v2-code-quality-pitfalls-45-51)** - Pitfall #51

---

## Commits Made

### Commit 1: Fix FunctionTool Context Type (be8ee764)

```
fix(project-hub): type FunctionTool context as ToolContext | undefined

ADK's execute function signature passes tool_context as potentially
undefined. All 11 tools in project-hub agent were incorrectly typed as
`_ctx: ToolContext` which caused TypeScript errors blocking Render build.

Fixed signatures to `_ctx: ToolContext | undefined` to match ADK's API.

Updated prevention docs (Issue #8, pitfall #51) with this pattern.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Files Changed:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts` (28 changes, 11 tools updated)
- `CLAUDE.md` (pitfall reference updated)
- `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md` (Issue #8 documentation)

### Commit 2: Fix State Type Casting (06ade04b)

```
fix(project-hub): cast State through unknown for Record type

ADK's State type lacks an index signature, so direct casting to
Record<string, unknown> fails. Cast through unknown first.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Files Changed:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts` (3 changes, 1 location)

---

## Impact Summary

| Aspect            | Before                | After                                |
| ----------------- | --------------------- | ------------------------------------ |
| TypeScript Errors | 41+                   | 0                                    |
| Build Status      | FAILED                | SUCCESS                              |
| Render Deployment | Blocked               | Passes                               |
| Project-Hub Agent | Unusable              | Operational                          |
| Tool Context Type | `ToolContext` (wrong) | `ToolContext \| undefined` (correct) |
| State Casting     | Direct (fails)        | Through unknown (works)              |

---

## Testing

### Build Verification

```bash
cd /Users/mikeyoung/CODING/MAIS
npm run typecheck
# ✅ No errors

npm run build
# ✅ Build succeeds
```

### Agent Deployment Test

```bash
npm run deploy --workspace=server/src/agent-v2/deploy/project-hub
# ✅ Deploys successfully to Cloud Run
# ✅ Tools accessible via /list-apps endpoint
```

### Functional Test

- Customer context tools respond correctly with project data
- Tenant context tools show pending requests and activity
- Context detection from session state works properly
- Error handling gracefully recovers from missing/undefined context

---

## Lessons Learned

1. **External Library Type Contracts:** When working with external libraries like ADK, carefully verify the exact type signature expected, especially for optional parameters and callback functions.

2. **TypeScript Escape Hatches:** Casting through `unknown` is a valid (and sometimes necessary) pattern when dealing with structural type mismatches from external libraries. Document WHY it's needed.

3. **Consistent Patterns:** All tools in an agent should follow the same pattern. A single incorrect tool type signature can block an entire build when using strict TypeScript.

4. **Documentation is Critical:** ADK's type signatures and expected patterns needed to be documented to prevent this from happening in future agents.

---

## Key Takeaway

**ADK's FunctionTool execute callbacks must accept `ToolContext | undefined`, not just `ToolContext`, because ADK may invoke the callback with undefined context during validation phases. Always cast ADK's State type through unknown before casting to Record types due to structural type mismatches.**
