# Tool Boilerplate Reduction: Wrappers + Standardized Error Shapes

**Priority:** P2
**Files:** `server/src/agent-v2/deploy/tenant/src/utils.ts` + all 13 tool files in `tools/`
**Blocked by:** 6005 (shared constants should land first so imports are clean)
**Plan:** `docs/plans/2026-02-11-refactor-agent-debt-cleanup-plan.md`

## Problem

Every single tool (28 of 34) repeats the same boilerplate:

### TenantId extraction (28 occurrences, 5 lines each = 140 lines)

```typescript
const tenantId = getTenantId(context);
if (!tenantId) {
  return { success: false, error: 'No tenant context available' };
}
```

### Zod validation (13+ occurrences, 5 lines each = 65 lines)

```typescript
const parseResult = SomeSchema.safeParse(params);
if (!parseResult.success) {
  return { success: false, error: `Invalid parameters: ${parseResult.error.message}` };
}
```

### Inconsistent error response shapes (3 patterns)

- Most tools: `{ success: false, error: string }`
- project-management.ts (7 tools): `{ error: string }` (missing `success: false`)
- discovery.ts `storeDiscoveryFactTool`: `{ stored: false, error: string }`

## Fix

### 1. Add `requireTenantId` to utils.ts

```typescript
/**
 * Extract tenantId from ADK context, throwing if not found.
 * Use in tool execute functions to eliminate the 5-line null-check boilerplate.
 */
export function requireTenantId(context: ToolContext | undefined): string {
  const tenantId = getTenantId(context);
  if (!tenantId) {
    throw new ToolError('No tenant context available');
  }
  return tenantId;
}
```

### 2. Add `validateParams` to utils.ts

```typescript
/**
 * Validate tool parameters against a Zod schema, throwing on failure.
 * Replaces the 5-line safeParse + error return boilerplate.
 */
export function validateParams<T>(schema: z.ZodType<T>, params: unknown): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ToolError(`Invalid parameters: ${result.error.message}`);
  }
  return result.data;
}
```

### 3. Add `ToolError` class + `wrapToolExecute` helper to utils.ts

```typescript
/** Error thrown by tool helpers — caught by wrapToolExecute */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

/** Standard error response shape for all tools */
interface ToolErrorResponse {
  success: false;
  error: string;
}

/**
 * Wrap a tool execute function with standardized error handling.
 * Catches ToolError and returns { success: false, error } consistently.
 */
export function wrapToolExecute<P, R>(
  fn: (params: P, context: ToolContext | undefined) => Promise<R>
): (params: P, context: ToolContext | undefined) => Promise<R | ToolErrorResponse> {
  return async (params, context) => {
    try {
      return await fn(params, context);
    } catch (err) {
      if (err instanceof ToolError) {
        return { success: false, error: err.message } as ToolErrorResponse;
      }
      throw err; // Re-throw unexpected errors
    }
  };
}
```

### 4. Update ALL tool files

Before:

```typescript
execute: async (params, context: ToolContext | undefined) => {
  const parseResult = Schema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: `Invalid parameters: ${parseResult.error.message}` };
  }
  const tenantId = getTenantId(context);
  if (!tenantId) {
    return { success: false, error: 'No tenant context available' };
  }
  // ... actual logic
};
```

After:

```typescript
execute: wrapToolExecute(async (params, context) => {
  const { field1, field2 } = validateParams(Schema, params);
  const tenantId = requireTenantId(context);
  // ... actual logic
});
```

This saves ~10 lines per tool × 28 tools = ~280 lines of boilerplate removed.

### 5. Standardize all error responses

After wrapping, all tools return `{ success: false, error: string }` on ANY error:

- Fix project-management.ts (7 tools missing `success: false`)
- Fix discovery.ts `storeDiscoveryFactTool` (`stored: false` → `success: false`)

## Verification

```bash
npm run --workspace=server typecheck
# Verify no more inline getTenantId null checks in tools:
grep -r "getTenantId(context)" server/src/agent-v2/deploy/tenant/src/tools/ | grep -v "requireTenantId"
# Should return 0 matches (all replaced with requireTenantId)
```
