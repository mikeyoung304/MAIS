# Fix project-management.ts Patterns

**Priority:** P2
**Files:** `server/src/agent-v2/deploy/tenant/src/tools/project-management.ts`
**Blocked by:** 6006 (if wrapToolExecute helper exists, use it here; otherwise fix independently)
**Plan:** `docs/plans/2026-02-11-refactor-agent-debt-cleanup-plan.md`

## Problem

`project-management.ts` (502 LOC, 7 tools) is the only tool file that:

1. Uses `callBackendAPI` instead of `callMaisApi` (different error handling contract)
2. Returns `{ error: '...' }` WITHOUT `success: false` when tenantId is missing
3. Has defined-but-misused schemas (`LimitSchema`, `DaysSchema` at module level, but tools define their OWN `parameters` schema inline)

## Fix

### 1. Migrate from `callBackendAPI` to `callMaisApi`

All 7 tools use `callBackendAPI<T>()` which throws on error, requiring try/catch in every handler. Switch to `callMaisApi()` which returns `{ ok, data, error }` — consistent with all other tools.

Before:

```typescript
try {
  const result = await callBackendAPI<PendingRequest[]>('/pending-requests', tenantId, params);
  return { success: true, requests: result };
} catch (error) {
  return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
}
```

After:

```typescript
const result = await callMaisApi('/pending-requests', tenantId, params);
if (!result.ok) {
  return { success: false, error: result.error ?? 'Request failed' };
}
return { success: true, requests: result.data };
```

### 2. Add `success: false` to all error responses

All 7 tools return `{ error: 'No tenant context available' }` when `getTenantId` fails. Add `success: false` to match the standard pattern.

If todo 6006 (wrapToolExecute) has landed, use the wrapper instead and this is handled automatically.

### 3. Clean up schema duplication

The module-level `LimitSchema` and `DaysSchema` are defined but the tools also define their own `parameters` schema inline. Either:

- Use the module-level schemas as the tool `parameters`, OR
- Delete the module-level schemas and keep the inline ones (simpler)

Choose whichever is cleaner. The key is: the Zod schema used for `parameters` should be the SAME one used for `safeParse` validation.

### 4. Standardize error variable naming

Some catch blocks use `err: unknown`, others use `error`. Standardize on `error` to match the rest of the codebase.

## Verification

```bash
npm run --workspace=server typecheck
```
