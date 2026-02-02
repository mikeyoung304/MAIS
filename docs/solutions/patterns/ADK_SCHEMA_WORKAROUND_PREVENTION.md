---
module: MAIS
date: 2026-02-01
problem_type: api_limitation
component: agent-v2/tools/zod
symptoms:
  - Zod discriminatedUnion fails during ADK deploy
  - Tool parameter validation silently fails
  - Agent receives undefined parameters
  - "Unsupported Zod type" errors in logs
root_cause: ADK doesn't support discriminatedUnion, record, tuple, intersection, lazy - need flat schemas + runtime validation
resolution_type: implementation_pattern
severity: P1
tags: [adk, zod, agent-tools, schema-design, type-safety, workaround]
---

# ADK Schema Workaround Prevention Pattern

**Issue:** When implementing agent tools with multiple actions (create/update/delete), using `z.discriminatedUnion()` for clean TypeScript breaks at ADK runtime. ADK has limited Zod support.

**Solution:** Use flat `z.object()` schema + runtime switch statement for action routing. Validates with Zod first, then routes programmatically.

---

## Problem: Unsupported Zod Types in ADK

### What ADK DOES Support

```typescript
✅ z.object({ ... })
✅ z.string(), z.number(), z.boolean()
✅ z.array(z.object({ ... }))
✅ z.enum(['a', 'b', 'c'])
✅ z.union([ type1, type2 ]) // Simple union only
✅ Optional fields: z.string().optional()
✅ Descriptions: z.string().describe('...')
```

### What ADK DOES NOT Support

```typescript
❌ z.discriminatedUnion('action', [ ... ])
❌ z.record(...)
❌ z.tuple([...])
❌ z.intersection(...)
❌ z.lazy(...)
❌ Complex nested discriminators
❌ Conditional schemas based on other fields
```

**Why:** ADK converts Zod schema to JSON Schema for Cloud Run. JSON Schema has limited discriminator support, and ADK's schema validator is more restrictive than full Zod.

---

## Solution Pattern: Flat Schema + Runtime Validation

### Anti-Pattern: discriminatedUnion (DON'T DO THIS)

```typescript
// ❌ WRONG: This will fail at ADK deploy time
export const managePackagesTool = new FunctionTool({
  name: 'manage_packages',
  parameters: z.discriminatedUnion('action', [
    z.object({
      action: z.literal('create'),
      name: z.string(),
      price: z.number(),
    }),
    z.object({
      action: z.literal('update'),
      packageId: z.string(),
      name: z.string().optional(),
      price: z.number().optional(),
    }),
    z.object({
      action: z.literal('delete'),
      packageId: z.string(),
    }),
  ]),

  execute: async (params, context) => {
    // Never reached if ADK rejects schema
  },
});
```

**Why it fails:**

1. ADK sees `z.discriminatedUnion`
2. ADK schema parser throws error
3. Tool never registers in Cloud Run
4. Agent has no tool to call
5. E2E test fails with "tool not found"

### Good Pattern: Flat Schema + Switch

```typescript
// ✅ CORRECT: Flat schema + runtime switch

// Step 1: Define flat parameter schema (only primitives + arrays)
const ManagePackagesParams = z.object({
  action: z
    .enum(['create', 'update', 'delete', 'list'])
    .describe(
      'What action to perform: create (new), update (modify), delete (remove), list (show all)'
    ),

  // Create fields
  name: z.string().optional().describe('Package name (required for create)'),
  price: z.number().optional().describe('Price in cents (required for create)'),
  description: z.string().optional().describe('What is included'),
  duration: z.number().optional().describe('Duration in minutes'),

  // Update/Delete fields
  packageId: z.string().optional().describe('Package ID (required for update/delete)'),

  // Update-only fields
  newPrice: z.number().optional().describe('New price (for update)'),
  newName: z.string().optional().describe('New name (for update)'),
});

// Step 2: Create tool with flat schema
export const managePackagesTool = new FunctionTool({
  name: 'manage_packages',
  description: 'Create, update, delete, or list service packages',
  parameters: ManagePackagesParams,

  // Step 3: Execute with runtime validation + switch
  execute: async (params, context) => {
    // FIRST: Validate with Zod (catches malformed input)
    const result = ManagePackagesParams.safeParse(params);
    if (!result.success) {
      return {
        success: false,
        error: `Invalid parameters: ${result.error.errors[0]?.message}`,
      };
    }

    const validated = result.data;
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { success: false, error: 'No tenant context' };
    }

    // SECOND: Route by action (like a command dispatcher)
    switch (validated.action) {
      case 'create':
        return await handleCreatePackage(tenantId, validated);

      case 'update':
        return await handleUpdatePackage(tenantId, validated);

      case 'delete':
        return await handleDeletePackage(tenantId, validated);

      case 'list':
        return await handleListPackages(tenantId, validated);

      default:
        return {
          success: false,
          error: `Unknown action: ${validated.action}`,
        };
    }
  },
});

// Step 4: Helper functions for each action
async function handleCreatePackage(tenantId: string, params: z.infer<typeof ManagePackagesParams>) {
  // Type-narrowed to create fields
  if (!params.name || params.price === undefined) {
    return {
      success: false,
      error: 'Create requires: name, price',
    };
  }

  // Call backend
  const response = await callMaisApi('/manage-packages', tenantId, {
    action: 'create',
    name: params.name,
    price: params.price,
    description: params.description,
    duration: params.duration,
  });

  // PITFALL #52: Return full state, not just success
  if (response.success) {
    return {
      success: true,
      data: {
        package: response.package,
        totalPackages: response.totalPackages,
        hasServices: true,
        draftHasChanges: true,
      },
    };
  }

  return { success: false, error: response.error };
}

async function handleUpdatePackage(tenantId: string, params: z.infer<typeof ManagePackagesParams>) {
  if (!params.packageId) {
    return {
      success: false,
      error: 'Update requires: packageId',
    };
  }

  const response = await callMaisApi('/manage-packages', tenantId, {
    action: 'update',
    packageId: params.packageId,
    name: params.newName,
    price: params.newPrice,
  });

  if (response.success) {
    return {
      success: true,
      data: {
        package: response.package,
        message: `Updated ${response.package.name}`,
        hasChanges: true,
      },
    };
  }

  return { success: false, error: response.error };
}

async function handleDeletePackage(tenantId: string, params: z.infer<typeof ManagePackagesParams>) {
  if (!params.packageId) {
    return {
      success: false,
      error: 'Delete requires: packageId',
    };
  }

  const response = await callMaisApi('/manage-packages', tenantId, {
    action: 'delete',
    packageId: params.packageId,
  });

  if (response.success) {
    return {
      success: true,
      data: {
        message: 'Package deleted',
        totalPackages: response.totalPackages,
        deletedId: params.packageId,
      },
    };
  }

  return { success: false, error: response.error };
}

async function handleListPackages(tenantId: string, params: z.infer<typeof ManagePackagesParams>) {
  const response = await callMaisApi('/manage-packages', tenantId, {
    action: 'list',
  });

  if (response.success) {
    return {
      success: true,
      data: {
        packages: response.packages,
        totalPackages: response.packages.length,
        hasServices: response.packages.length > 0,
      },
    };
  }

  return { success: false, error: response.error };
}
```

### Why This Works

1. **ADK accepts flat schema** - Only primitives + enums + arrays
2. **Zod validates at runtime** - Catches bad input immediately
3. **Switch routes correctly** - Each action runs its own logic
4. **Type inference still works** - `z.infer<>` narrows types
5. **Error messages are clear** - Missing required fields caught early
6. **State returns included** - Agent has context for next action

---

## Implementation Checklist

### Before Implementing Multi-Action Tool

- [ ] Schema only uses supported types (object, string, number, enum, array)
- [ ] No discriminatedUnion, record, tuple, intersection, lazy
- [ ] All action-specific fields marked optional
- [ ] Switch statement covers all action types
- [ ] Each action has its own handler function
- [ ] Handler validates required fields for that action
- [ ] Returns full state (not just success flag)
- [ ] Zod validation is FIRST line of execute()
- [ ] getTenantId() called early with error check
- [ ] Error messages don't leak tenant info
- [ ] E2E test passes: agent → tool → database → UI

### Testing the Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { managePackagesTool } from '../packages';

describe('managePackagesTool (Flat Schema Pattern)', () => {
  it('should validate action enum', async () => {
    const result = await managePackagesTool.execute(
      {},
      {
        action: 'invalid_action', // ← Will fail Zod validation
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('action');
  });

  it('should enforce required fields per action', async () => {
    // Create without name
    const result = await managePackagesTool.execute(
      {},
      {
        action: 'create',
        price: 5000,
        // Missing: name ← Should be caught
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('name');
  });

  it('should route to correct handler', async () => {
    // This test would need mocking of callMaisApi
    // Just verify the routing logic works
    const contexts = [{ tenantId: 'test' }, { state: { tenantId: 'test' } }];

    for (const ctx of contexts) {
      const result = await managePackagesTool.execute(ctx, {
        action: 'list',
      });

      // Should not fail due to routing
      // (will fail due to mocking, but that's integration test)
    }
  });

  it('should return state, not just confirmation', async () => {
    // Mocked context + API
    // Verify response includes data fields

    // Result should have:
    expect(result.data).toBeDefined();
    expect(result.data.packages).toBeDefined(); // For list
    expect(result.data.totalPackages).toBeDefined(); // State indicator
  });
});
```

---

## Common Mistakes with This Pattern

### Mistake 1: Forgetting Zod Validation

```typescript
// ❌ WRONG: Trusting params directly
execute: async (params, context) => {
  if (params.action === 'create') {
    await api.create(params.name); // What if name is undefined?
  }
};

// ✅ CORRECT: Always validate first
execute: async (params, context) => {
  const result = ManagePackagesParams.safeParse(params);
  if (!result.success) return { success: false, error: '...' };

  const validated = result.data;
  if (validated.action === 'create') {
    await api.create(validated.name); // Guaranteed to exist
  }
};
```

### Mistake 2: Optional Fields Used Inconsistently

```typescript
// ❌ WRONG: name is optional in schema but required for create
const ManagePackagesParams = z.object({
  action: z.enum(['create', 'update']),
  name: z.string().optional(), // ← Problem!
});

execute: async (params) => {
  if (params.action === 'create') {
    await api.create(params.name); // Could be undefined!
  }
};

// ✅ CORRECT: Validate requirements per action
const ManagePackagesParams = z.object({
  action: z.enum(['create', 'update']),
  name: z.string().optional(), // OK, we'll check in handler
});

execute: async (params) => {
  const validated = ManagePackagesParams.safeParse(params);
  if (!validated.success) return error;

  switch (validated.data.action) {
    case 'create':
      // Re-validate create-specific requirements
      if (!validated.data.name) {
        return { success: false, error: 'Create requires name' };
      }
      return await api.create(validated.data.name);
  }
};
```

### Mistake 3: Missing getTenantId Check

```typescript
// ❌ WRONG: Assumes tenantId always exists
execute: async (params, context) => {
  const tenantId = getTenantId(context);

  switch (params.action) {
    case 'create':
      return await api.create(params, tenantId); // Could be undefined
  }
};

// ✅ CORRECT: Check and return error
execute: async (params, context) => {
  const tenantId = getTenantId(context);
  if (!tenantId) {
    return { success: false, error: 'No tenant context' };
  }

  switch (params.action) {
    case 'create':
      return await api.create(params, tenantId); // Guaranteed
  }
};
```

### Mistake 4: Returning Confirmation Only (Pitfall #52)

```typescript
// ❌ WRONG: Agent loses state
execute: async (params, context) => {
  // ... validation & routing ...

  switch (params.action) {
    case 'create':
      await api.create(...);
      return { success: true }; // ← Agent can't answer follow-ups
  }
}

// ✅ CORRECT: Echo back state
execute: async (params, context) => {
  // ... validation & routing ...

  switch (params.action) {
    case 'create':
      const created = await api.create(...);
      return {
        success: true,
        data: {
          package: created,
          totalPackages: created.totalCount,
          hasServices: true, // State indicators
        },
      };
  }
}
```

---

## Performance Considerations

### Schema Size Impact

```
✅ GOOD: 1 flat schema + switch routing
   - ADK schema parsing: Fast (simple object)
   - Tool invocation: Fast (single Zod parse)
   - Total overhead: Minimal

❌ BAD: discriminatedUnion (if it worked)
   - ADK schema parsing: Slow (complex union)
   - LLM parameter reasoning: More confusion (complex schema)
   - Total overhead: Higher

❌ BAD: Separate tools per action
   - ADK tool registry: Large (4 separate tools)
   - LLM reasoning: Harder (which tool to call?)
   - Total overhead: LLM confusion
```

### Recommendation

1 unified tool with flat schema + switch = best performance + clarity

---

## Integration with Existing Patterns

### Relation to Pitfall #62 (Type Assertions)

```typescript
// ❌ WRONG: Type assertion without validation
const { packageId } = params as { packageId: string };

// ✅ CORRECT: Zod validation first
const validated = ManagePackagesParams.safeParse(params);
if (!validated.success) return error;
const { packageId } = validated.data;
```

### Relation to Dual-Context Agent Safety (Pitfall #60)

```typescript
// Tool isolation via context checking
execute: async (params, context) => {
  const tenantId = getTenantId(context); // ← 4-tier defensive extraction
  if (!tenantId) return error; // ← Early return prevents cross-tenant leaks

  // All API calls use tenantId
  const response = await callMaisApi('/manage-packages', tenantId, params);
};
```

### Relation to State Return (Pitfall #52)

```typescript
// Response must include state for agent memory
return {
  success: true,
  data: {
    package: created, // Full object
    totalPackages: count, // Aggregate
    hasServices: true, // State indicator (bool)
  },
};
```

---

## Migration Guide: From discriminatedUnion to Flat Schema

If you have existing tools with `discriminatedUnion`, migrate like this:

### Step 1: Expand Schema to Flat

```typescript
// BEFORE: discriminatedUnion (doesn't work in ADK)
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string() }),
  z.object({ action: z.literal('update'), id: z.string(), name: z.string().optional() }),
]);

// AFTER: Flat schema
const schema = z.object({
  action: z.enum(['create', 'update']),
  name: z.string().optional(),
  id: z.string().optional(),
});
```

### Step 2: Add Runtime Validation

```typescript
// execute function
execute: async (params, context) => {
  const result = schema.safeParse(params);
  if (!result.success) {
    return { success: false, error: result.error.errors[0]?.message };
  }

  // Now use validated.data
};
```

### Step 3: Add Switch Routing

```typescript
switch (validated.data.action) {
  case 'create':
    return handleCreate(validated.data);
  case 'update':
    return handleUpdate(validated.data);
}
```

### Step 4: Extract Handlers

```typescript
async function handleCreate(params) {
  if (!params.name) return error('name required');
  // ... logic
}

async function handleUpdate(params) {
  if (!params.id) return error('id required');
  // ... logic
}
```

### Step 5: Test & Deploy

```bash
npm run test -- tools/packages.test.ts
npm run typecheck
# Deploy
```

---

## Validation Levels

### Level 1: Zod Schema Validation (REQUIRED)

```typescript
const schema = z.object({
  action: z.enum(['create', 'update']),
  name: z.string().optional(),
});

// ✅ ALWAYS call safeParse FIRST
const result = schema.safeParse(params);
if (!result.success) return error;
```

### Level 2: Action-Specific Validation (REQUIRED)

```typescript
// After Zod passes, validate per action
if (validated.action === 'create' && !validated.name) {
  return error('Create requires name');
}
```

### Level 3: Business Logic Validation (RECOMMENDED)

```typescript
// After structural validation, check business rules
if (validated.action === 'delete') {
  const hasBookings = await checkUpcomingBookings(validated.packageId);
  if (hasBookings) {
    return error('Cannot delete package with upcoming bookings');
  }
}
```

---

## Error Message Patterns

```typescript
// ✅ GOOD: Helpful, non-leaking
{
  success: false,
  error: 'Create requires: name, price',
  // User can fix the problem
}

// ❌ BAD: Leaks tenant info
{
  success: false,
  error: 'Tenant tenant-123 has no permission',
  // Leaks tenant ID
}

// ❌ BAD: Too vague
{
  success: false,
  error: 'Error occurred',
  // User can't fix
}

// ✅ GOOD: Contextual
{
  success: false,
  error: 'Package "Elopement" already exists. Try a different name.',
  // Specific + actionable
}
```

---

## Checklist Before Deploying

- [ ] Schema uses only supported Zod types
- [ ] No discriminatedUnion, record, tuple, intersection, lazy
- [ ] Zod validation is FIRST line of execute()
- [ ] Handler functions exist for each action
- [ ] Each handler validates action-specific requirements
- [ ] getTenantId check happens early
- [ ] All API calls include tenantId
- [ ] Responses include full state (not just success)
- [ ] Error messages are helpful + non-leaking
- [ ] Unit tests cover validation paths
- [ ] E2E tests cover agent → tool → database → UI
- [ ] Cloud Run deploy succeeds (schema validated)

---

## References

**ADK Limitations:**

- ADK uses JSON Schema internally (limited discriminator support)
- Zod → JSON Schema conversion is lossy for complex types
- Pitfall #34: Unsupported Zod types documented in CLAUDE.md

**Related Patterns:**

- AGENT_CAPABILITY_AUDIT_PREVENTION.md - When to create tools
- AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md - State return patterns
- ZOD_PARAMETER_VALIDATION_PREVENTION.md - Full Zod guide
- ADK_FUNCTIONTOOL_TYPESAFETY_PREVENTION.md - FunctionTool API

**Test Examples:**

- AGENT_TOOL_TEST_PATTERNS.md - Unit/integration/E2E patterns

---

## Maintenance

**Last Updated:** 2026-02-01
**Status:** Active - apply to all multi-action agent tools
**Applies To:** Agent-v2 FunctionTool implementations

When encountering ADK schema errors:

1. Check if using unsupported Zod type
2. Migrate to flat schema + switch pattern
3. Verify Zod validation is first line
4. Test & deploy
5. Document lessons in this doc

---

**Keep this handy when implementing multi-action agent tools!**
