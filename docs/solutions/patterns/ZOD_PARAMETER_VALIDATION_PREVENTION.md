---
title: Zod Parameter Validation Prevention Strategy
category: patterns
component: type-safety
severity: P1
tags: [zod, validation, type-safety, agent-tools, endpoints, code-review]
created: 2026-01-21
updated: 2026-01-21
related:
  - ADK_FUNCTIONTOOL_TYPESAFETY_PREVENTION.md
  - AGENT_TOOLS_PREVENTION_INDEX.md
  - README-TYPE-SAFETY-PREVENTION.md
---

# Zod Parameter Validation Prevention Strategy

**Problem Solved:** Type assertion without validation (`params as { foo: string }`) bypasses runtime safety
**Root Cause:** TypeScript's type system only enforces compile-time; runtime data (API requests, tool params) needs Zod
**Impact:** Runtime crashes, security vulnerabilities, inconsistent error handling

---

## When to Apply Zod Validation

### ALWAYS Validate With Zod

| Context                   | Why                               |
| ------------------------- | --------------------------------- |
| Agent tool parameters     | LLM can send ANY data structure   |
| HTTP request bodies       | User input is untrusted           |
| HTTP query parameters     | User can modify URLs              |
| HTTP path parameters      | User can modify URLs              |
| Webhook payloads          | External system data is untrusted |
| JSON fields from database | Prisma JSON fields are `unknown`  |
| Environment variables     | May be missing or malformed       |
| Config files              | May be edited manually            |
| External API responses    | External services may change      |

### MAY Skip Zod Validation

| Context                 | Why                                 |
| ----------------------- | ----------------------------------- |
| Internal function calls | TypeScript enforces at compile time |
| Already-validated data  | Don't double-validate               |
| Prisma typed results    | Prisma validates schema             |
| Known-shape constants   | Static data with type annotations   |

### Decision Tree

```
Is this data crossing a trust boundary?
├── YES (user input, external API, JSON field, LLM params)
│   └── ALWAYS use Zod validation
└── NO (internal function, Prisma typed result)
    ├── Is the data shape guaranteed by TypeScript?
    │   ├── YES → Skip Zod (optional)
    │   └── NO → Use Zod validation
    └── Is this data from a JSON column?
        ├── YES → ALWAYS use Zod validation
        └── NO → Trust TypeScript
```

---

## Checklist: New API Endpoints

When adding a new endpoint, verify:

### Request Validation

- [ ] Request body has Zod schema defined in `packages/contracts/`
- [ ] Schema includes `.min()`, `.max()`, `.email()`, `.regex()` as appropriate
- [ ] Schema has clear error messages via `.message()` or `.describe()`
- [ ] Required vs optional fields match business requirements
- [ ] Enum values use `z.enum([])` not `z.string()`

### Response Typing

- [ ] Response shape matches contract definition
- [ ] Sensitive fields excluded (passwords, tokens, internal IDs)
- [ ] Error responses use consistent format

### ts-rest Integration

- [ ] Contract uses Zod schemas from `@macon/contracts`
- [ ] Handler uses `{ req: any }` (ts-rest limitation - see README-TYPE-SAFETY-PREVENTION.md)
- [ ] After extraction, apply schema validation or type assertion

### Example: Complete Endpoint Pattern

```typescript
// 1. Define schema in packages/contracts/src/schemas/booking.ts
export const CreateBookingSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  customerEmail: z.string().email('Valid email required'),
  notes: z.string().max(500).optional(),
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

// 2. Use in contract
export const bookingContract = c.router({
  create: {
    method: 'POST',
    path: '/bookings',
    body: CreateBookingSchema,
    responses: { 201: BookingResponseSchema },
  },
});

// 3. Handler gets validated body automatically via ts-rest
const handler = async ({ req, body }: { req: any; body: CreateBookingInput }) => {
  // body is already validated by ts-rest middleware
  const booking = await bookingService.create(tenantId, body);
  return { status: 201, body: booking };
};
```

---

## Checklist: New Agent Tools

When adding a new agent tool, verify:

### Schema Definition

- [ ] Zod schema defined at top of file (e.g., `const ParamsSchema = z.object({...})`)
- [ ] All parameters have `.describe()` for LLM guidance
- [ ] Required parameters use `.min(1, 'error message')`
- [ ] Optional parameters marked with `.optional()`
- [ ] Date strings use `.regex(/^\d{4}-\d{2}-\d{2}$/)`
- [ ] IDs use `.string().min(1)` (not `.uuid()` - we use CUIDs)

### Validation in Execute

- [ ] First line of `execute()` calls `schema.safeParse(params)`
- [ ] Parse failure returns `{ success: false, error: message }`
- [ ] Parse success destructures validated data
- [ ] NO `params as SomeType` assertions without validation

### Trust Tier Alignment

- [ ] T1 (read-only): Validation prevents malformed queries
- [ ] T2 (write, auto-confirmed): Validation ensures data integrity
- [ ] T3 (write, user-confirmed): Validation + `confirmationReceived` parameter

### Example: Complete Tool Pattern

```typescript
// 1. Schema at top of file
const UpdateServiceParamsSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  name: z.string().min(1).max(100).optional().describe('New service name'),
  price: z.number().min(0).optional().describe('Price in cents'),
  active: z.boolean().optional().describe('Whether service is active'),
  confirmationReceived: z.boolean().describe('Must be true to execute T3 action'),
});

// 2. Tool definition
const updateServiceTool: AgentTool = {
  name: 'update_service',
  trustTier: 'T3',
  description: 'Update a service. Requires explicit confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      serviceId: { type: 'string', description: 'ID of service to update' },
      name: { type: 'string', description: 'New service name' },
      price: { type: 'number', description: 'Price in cents' },
      active: { type: 'boolean', description: 'Whether service is active' },
      confirmationReceived: { type: 'boolean', description: 'Must be true' },
    },
    required: ['serviceId', 'confirmationReceived'],
  },

  // 3. Execute with validation FIRST
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    // VALIDATION FIRST - before any logic
    const parseResult = UpdateServiceParamsSchema.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid parameters',
      };
    }

    // Destructure VALIDATED data
    const { serviceId, name, price, active, confirmationReceived } = parseResult.data;

    // Trust tier enforcement (T3 requires confirmation)
    if (!confirmationReceived) {
      return {
        success: false,
        error: 'This action requires explicit confirmation. Set confirmationReceived: true',
      };
    }

    // Now safe to use validated data
    try {
      const result = await serviceService.update(context.tenantId, serviceId, {
        name,
        price,
        active,
      });

      // Return updated state (Active Memory Pattern)
      return {
        success: true,
        data: {
          service: result,
          message: `Service "${result.name}" updated successfully`,
        },
      };
    } catch (error) {
      return { success: false, error: sanitizeError(error) };
    }
  },
};
```

---

## Anti-Patterns to Avoid

### 1. Type Assertion Without Validation

```typescript
// WRONG - No runtime validation
async execute(context: ToolContext, params: Record<string, unknown>) {
  const { packageId, date } = params as { packageId: string; date: string };
  // If LLM sends { packageId: 123 }, this silently breaks
}

// CORRECT - Zod validates at runtime
async execute(context: ToolContext, params: Record<string, unknown>) {
  const parseResult = Schema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors[0]?.message };
  }
  const { packageId, date } = parseResult.data;
  // Now guaranteed to be correct types
}
```

### 2. Using `.parse()` Without Error Handling

```typescript
// WRONG - Throws on invalid input (crashes agent)
const { packageId } = Schema.parse(params);

// CORRECT - safeParse returns result object
const result = Schema.safeParse(params);
if (!result.success) {
  return { success: false, error: result.error.errors[0]?.message };
}
const { packageId } = result.data;
```

### 3. Partial Validation

```typescript
// WRONG - Only validates some fields
if (!params.packageId) {
  return { success: false, error: 'Package ID required' };
}
const { packageId, date, email } = params as BookingParams;
// date and email not validated!

// CORRECT - Schema validates all fields
const result = BookingSchema.safeParse(params);
// All fields validated together
```

### 4. Validation After Usage

```typescript
// WRONG - Uses data before validation
async execute(context: ToolContext, params: Record<string, unknown>) {
  const { tenantId } = context;

  // BUG: Using params.packageId before validation!
  const pkg = await prisma.package.findFirst({
    where: { id: params.packageId as string, tenantId },
  });

  // Validation happens too late
  const parseResult = Schema.safeParse(params);
  // ...
}

// CORRECT - Validate first, use second
async execute(context: ToolContext, params: Record<string, unknown>) {
  // ALWAYS validate first
  const parseResult = Schema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors[0]?.message };
  }
  const { packageId } = parseResult.data;

  // Now safe to use
  const pkg = await prisma.package.findFirst({
    where: { id: packageId, tenantId },
  });
}
```

### 5. `.uuid()` on CUID Fields

```typescript
// WRONG - MAIS uses CUIDs, not UUIDs
const Schema = z.object({
  packageId: z.string().uuid(), // Fails on CUIDs!
});

// CORRECT - Use .min(1) for required IDs
const Schema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
});
```

### 6. Missing Error Messages

```typescript
// WRONG - Generic Zod errors are confusing to LLMs
const Schema = z.object({
  email: z.string().email(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
// Error: "Invalid email" - not helpful

// CORRECT - Human-readable error messages
const Schema = z.object({
  email: z.string().email('Please provide a valid email address'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format (e.g., 2026-01-21)'),
});
```

### 7. Inline Schema Definition

```typescript
// WRONG - Schema defined inline, hard to test and reuse
async execute(context: ToolContext, params: Record<string, unknown>) {
  const result = z.object({
    packageId: z.string(),
    date: z.string(),
  }).safeParse(params);
}

// CORRECT - Schema defined at module level
const BookingParamsSchema = z.object({
  packageId: z.string().min(1, 'Package ID required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

async execute(context: ToolContext, params: Record<string, unknown>) {
  const result = BookingParamsSchema.safeParse(params);
}
```

---

## Code Review Checklist

When reviewing PRs with parameter handling:

### Endpoints

- [ ] Request validation uses ts-rest + Zod contracts
- [ ] No `req.body as SomeType` without schema validation
- [ ] Query params validated (especially pagination, filters)
- [ ] Path params validated (IDs, slugs)
- [ ] Error messages are user-friendly

### Agent Tools

- [ ] Schema defined at module level (not inline)
- [ ] `safeParse()` called as FIRST LINE of execute
- [ ] Parse failure returns proper error response
- [ ] No `params as Type` assertions anywhere
- [ ] All fields have error messages
- [ ] T3 tools include `confirmationReceived` parameter
- [ ] Date strings use regex validation
- [ ] IDs use `.min(1)` not `.uuid()`

### JSON Fields (Database)

- [ ] JSON field access uses Zod schema
- [ ] Graceful defaults when schema fails
- [ ] No `field as JsonType` without validation

### Test Commands for Verification

```bash
# Find potential unsafe type assertions in agent tools
grep -rn "params as {" server/src/agent/

# Find inline Zod schemas (should be at module level)
grep -rn "z\.object({" server/src/agent/**/execute

# Find missing safeParse in tools
grep -A5 "async execute" server/src/agent/**/*.ts | grep -v safeParse

# Verify all tools have schemas
grep -rn "Schema = z.object" server/src/agent/

# Check for .uuid() on CUID fields
grep -rn "\.uuid()" server/src/
```

### Review Comment Template

If you find issues:

````markdown
## Zod Validation Issue

### Problem

[Description of the issue]

### Fix Required

```typescript
// BEFORE (incorrect)
const { field } = params as { field: string };

// AFTER (correct)
const Schema = z.object({
  field: z.string().min(1, 'Field is required'),
});

const result = Schema.safeParse(params);
if (!result.success) {
  return { success: false, error: result.error.errors[0]?.message };
}
const { field } = result.data;
```
````

### Why

Type assertions only work at compile time. Runtime data from LLMs, APIs, and users
needs Zod validation to prevent crashes and ensure data integrity.

See: docs/solutions/patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md

````

---

## Quick Reference Card

### Schema Definition

```typescript
// At module level
const MyParamsSchema = z.object({
  // Required string
  name: z.string().min(1, 'Name is required'),

  // Optional string with max length
  description: z.string().max(500).optional(),

  // Required email
  email: z.string().email('Valid email required'),

  // Date in YYYY-MM-DD format
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),

  // Enum values
  status: z.enum(['active', 'inactive', 'pending']),

  // Number with constraints
  price: z.number().min(0).max(1000000),

  // Boolean with default
  active: z.boolean().default(true),

  // Nested object
  address: z.object({
    street: z.string(),
    city: z.string(),
  }).optional(),

  // Array
  tags: z.array(z.string()).max(10).optional(),

  // ID (CUID, not UUID)
  packageId: z.string().min(1, 'Package ID required'),

  // T3 confirmation
  confirmationReceived: z.boolean().describe('Required for T3 actions'),
});
````

### Validation Pattern

```typescript
// In execute function
async execute(context: ToolContext, params: Record<string, unknown>) {
  // 1. Validate FIRST
  const parseResult = MyParamsSchema.safeParse(params);

  // 2. Handle errors
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.errors[0]?.message || 'Invalid parameters',
    };
  }

  // 3. Destructure validated data
  const { name, email, date } = parseResult.data;

  // 4. Use with confidence
  // ...
}
```

### Error Handling

```typescript
// Good error messages for each failure case
if (!parseResult.success) {
  const errors = parseResult.error.errors;

  // Single field error
  return {
    success: false,
    error: errors[0]?.message || 'Invalid parameters',
  };

  // Or multiple field errors
  return {
    success: false,
    error: `Validation failed: ${errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
  };
}
```

---

## Integration with Existing Systems

### Agent Tools (server/src/agent/)

Follow pattern in `server/src/agent/customer/customer-tools.ts`:

```typescript
// Schema at top
const GetServicesParamsSchema = z.object({
  category: z.string().optional(),
});

// Validation in execute
const parseResult = GetServicesParamsSchema.safeParse(params);
if (!parseResult.success) {
  return { success: false, error: parseResult.error.errors[0]?.message };
}
```

### API Contracts (packages/contracts/)

All endpoint schemas in `packages/contracts/src/`:

```typescript
// packages/contracts/src/schemas/booking.ts
export const CreateBookingSchema = z.object({...});
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

// packages/contracts/src/contracts/booking.ts
import { CreateBookingSchema } from '../schemas/booking';

export const bookingContract = c.router({
  create: {
    method: 'POST',
    path: '/bookings',
    body: CreateBookingSchema,
    // ...
  },
});
```

### Executor Schemas (server/src/agent/proposals/)

Follow pattern in `server/src/agent/proposals/executor-schemas.ts`:

```typescript
export function validateAndTransformPayload<T>(operation: string, payload: unknown): T {
  const schema = EXECUTOR_SCHEMAS[operation];
  if (!schema) return payload as T;

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid payload: ${result.error.errors.map((e) => e.message).join('; ')}`);
  }
  return result.data as T;
}
```

---

## Common Pitfalls Reference

| Pitfall | Problem                        | Solution                                |
| ------- | ------------------------------ | --------------------------------------- |
| #24     | UUID validation on CUID fields | Use `z.string().min(1)`                 |
| #49     | T3 without confirmation param  | Add `confirmationReceived: z.boolean()` |
| #52     | Tool returns confirmation only | Return updated state data               |

---

## Related Documentation

- **ts-rest `any` types:** [README-TYPE-SAFETY-PREVENTION.md](../README-TYPE-SAFETY-PREVENTION.md)
- **ADK FunctionTool types:** [ADK_FUNCTIONTOOL_TYPESAFETY_PREVENTION.md](./ADK_FUNCTIONTOOL_TYPESAFETY_PREVENTION.md)
- **Agent tools overview:** [AGENT_TOOLS_PREVENTION_INDEX.md](./AGENT_TOOLS_PREVENTION_INDEX.md)
- **Active memory pattern:** [AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md](./AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md)

---

## Commit Reference

This prevention guide synthesizes patterns from:

- `server/src/agent/customer/customer-tools.ts` - Complete tool validation examples
- `server/src/agent/proposals/executor-schemas.ts` - Executor payload validation
- `packages/contracts/` - API contract schemas

**Created:** 2026-01-21
**Last Updated:** 2026-01-21
