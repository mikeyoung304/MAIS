---
status: complete
priority: p2
issue_id: '7002'
tags: [code-review, security, error-handling, pr-45]
dependencies: []
---

# 7002: Security Hardening — Error Leakage, HTTPS Gaps, wrapToolExecute Catch-All

## Problem Statement

Four related security issues in `utils.ts` that allow internal details to leak to the agent/user:

1. **callBackendAPI error leakage** — throws raw backend error text (stack traces, SQL errors)
2. **HTTPS enforcement gaps** — allows HTTP for `0.0.0.0`, `[::1]`, `host.docker.internal`
3. **callMaisApiTyped Zod error leak** — returns verbose Zod validation details to agent
4. **wrapToolExecute re-throws non-ToolErrors** — unexpected errors bubble up with stack traces instead of being caught gracefully

## Findings

### 1. callBackendAPI (line 202)

```typescript
throw new Error(`Backend API error: ${response.status} - ${errorText}`);
```

Raw `errorText` from backend leaks through wrapToolExecute to agent.

### 2. HTTPS enforcement (lines 42-48)

Only checks `localhost` and `127.0.0.1`. Missing: `0.0.0.0`, `[::1]`, `::1`, `host.docker.internal`.

### 3. callMaisApiTyped (line 243)

```typescript
return { ok: false, error: `Response validation failed: ${parsed.error.message}` };
```

Zod errors contain schema paths and type info. Should return generic message, keep details in logs.

### 4. wrapToolExecute (lines 357-370)

```typescript
if (err instanceof ToolError) {
  return { success: false, error: err.message };
}
throw err; // Re-throw unexpected errors — may surface ugly errors to LLM
```

Non-ToolError exceptions should be caught, logged at error level, and return `{ success: false, error: "An unexpected error occurred" }`.

## Recommended Action

Fix all 4 in `utils.ts`:

1. `callBackendAPI`: Log errorText at error level, throw only status code
2. HTTPS check: Expand regex to `/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)/`
3. `callMaisApiTyped`: Return `"Unexpected response from backend"`, keep Zod details in logger.warn (already logged on line 242)
4. `wrapToolExecute`: Add catch-all after ToolError check — `logger.error` + return generic error. Also add `logger.debug` before ToolError return for stack trace debugging.

## Technical Details

- **Affected files:** `server/src/agent-v2/deploy/tenant/src/utils.ts`
- **Components:** callBackendAPI, callMaisApiTyped, wrapToolExecute, HTTPS enforcement
- **Database:** No changes

## Acceptance Criteria

- [ ] `callBackendAPI` logs full error text at error level, throws only status code
- [ ] HTTPS enforcement covers `0.0.0.0`, `[::1]`, `host.docker.internal`
- [ ] `callMaisApiTyped` returns generic error message on Zod failures
- [ ] `wrapToolExecute` catches ALL errors (not just ToolError) and returns `{ success: false, error }` with logger.error
- [ ] No internal details (stack traces, SQL errors, Zod schema paths) reach the agent

## Work Log

| Date       | Action                                                                   | Learnings                        |
| ---------- | ------------------------------------------------------------------------ | -------------------------------- |
| 2026-02-11 | Created from PR #45 review                                               | Found by Security Sentinel agent |
| 2026-02-11 | Expanded scope: added HTTPS, Zod sanitization, wrapToolExecute catch-all | Cross-agent synthesis            |

## Resources

- PR #45: refactor/agent-debt-cleanup
- File: `server/src/agent-v2/deploy/tenant/src/utils.ts`
