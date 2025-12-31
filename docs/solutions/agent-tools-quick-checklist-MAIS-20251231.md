---
module: MAIS
date: 2025-12-31
problem_type: quick_reference
component: server/src/agent
purpose: Single-page checklist for agent tool implementation
severity: P1
related_docs:
  - agent-implementation-prevention-phase-3-MAIS-20251231.md
tags: [agent, checklist, quick-reference, implementation]
---

# Agent Tools Implementation Checklist - Quick Reference

**Print this page and pin it to your desk during agent tool development.**

---

## Before You Code

- [ ] Read the tool requirements carefully
- [ ] Check Prisma schema for optional fields (fields with `?`)
- [ ] Identify JSON fields that need parsing (Prisma `Json` type)
- [ ] Review existing similar tools for patterns
- [ ] Plan error cases (not found, conflict, permission denied)

---

## During Implementation

### Type Safety Checklist

```
Handling Prisma JSON field?

○ Is it a JsonValue type?
  └─ YES: Create a parse/validate function (see pattern below)

○ Using `as unknown as Type` anywhere?
  └─ YES: Replace with a type guard filter function
  └─ Test: Does it handle null/missing data gracefully?

○ Accessing nested object property?
  └─ First: Check Prisma schema for `?` (optional marker)
  └─ If optional: Use `obj?.property ?? default`

Pattern for JSON parsing:
  function parseMessages(raw: unknown): ChatMessage[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((msg): msg is ChatMessage => {
      return (
        typeof msg === 'object' && msg !== null &&
        'role' in msg && 'content' in msg &&
        typeof msg.content === 'string'
      );
    });
  }
```

### Null Safety Checklist

```
Each field in data model?

○ Is it marked optional in Prisma schema (has `?`)?
  └─ YES: Check before accessing
     - If relation: data?.relation?.property
     - If value: data.value ?? defaultValue

○ Accessing nested properties?
  └─ First check parent: if (!data.location) { return default; }
  └─ Then destructure: const { city } = data.location;

○ What if it's null?
  └─ Bad: const city = data.location.city; // Crashes
  └─ Good: const city = data.location?.city ?? 'Unknown';
```

### Error Handling Checklist

```
In your try/catch block?

○ Catch which error types?
  - ValidationError (input validation failed)
  - ConflictError (duplicate, already exists)
  - NotFoundError (no matching record)
  - Prisma errors (P2002, P2025, etc.)
  - Re-throw unexpected errors

○ For each error type:
  └─ Log with context: logger.warn({ tenantId, error }, 'message')
  └─ Return user-friendly message (400 status)

○ For unexpected errors:
  └─ Don't catch and return default
  └─ Log with full context
  └─ Re-throw to error middleware

Pattern:
  catch (error) {
    if (error instanceof ValidationError) {
      logger.info({ error: error.message }, 'Validation failed');
      return { success: false, error: error.message };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictError(...);
    }
    logger.error({ error }, 'Unexpected error');
    throw error;
  }
```

### Tenant Isolation Checklist

```
Every database query?

○ WHERE clause has tenantId?
  └─ MUST be present in every findMany, findUnique

○ Multi-step operations?
  └─ Check tenantId in each step

Pattern:
  const data = await prisma.table.findMany({
    where: { tenantId, status: 'active' }, // ← tenantId required
    select: { ... },
  });
```

---

## Code Patterns (Copy/Paste Ready)

### Pattern 1: Parse Prisma JSON Field

```typescript
// For JsonValue fields that need validation
function parseSessionMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter((msg): msg is ChatMessage => {
    return (
      typeof msg === 'object' &&
      msg !== null &&
      'role' in msg &&
      'content' in msg &&
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof msg.content === 'string'
    );
  });
}

// Usage
const messages = parseSessionMessages(session.messages);
```

### Pattern 2: Safe Optional Field Access

```typescript
// Check optional relation before access
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { location: true }, // May be null
});

// Method A: Guard clause
if (!tenant?.location) {
  return { success: true, data: { city: 'Unknown' } };
}
const { city } = tenant.location;

// Method B: Optional chaining + default
const city = tenant?.location?.city ?? 'Unknown';
```

### Pattern 3: Differentiated Error Handling

```typescript
try {
  // Business logic
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  // Expected user errors
  if (error instanceof ValidationError) {
    logger.info({ error: error.message }, 'Input validation failed');
    return { success: false, error: error.message };
  }

  if (error instanceof ConflictError) {
    logger.info({ error: error.message }, 'Resource conflict');
    return { success: false, error: error.message };
  }

  // Database constraint errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      logger.warn({ error }, 'Duplicate key violation');
      return { success: false, error: 'Resource already exists' };
    }
    if (error.code === 'P2025') {
      logger.warn({ error }, 'Record not found');
      return { success: false, error: 'Resource not found' };
    }
  }

  // Unexpected errors - log and re-throw
  logger.error(
    { error, stack: error instanceof Error ? error.stack : undefined },
    'Unexpected error'
  );
  throw error;
}
```

### Pattern 4: Tenant-Scoped Query

```typescript
// Always include tenantId in WHERE clause
const packages = await prisma.package.findMany({
  where: {
    tenantId, // ← CRITICAL: Tenant isolation
    active: true,
    segmentId: params.segmentId || undefined, // Optional filter
  },
  select: {
    id: true,
    name: true,
    price: true,
    segment: { select: { name: true } }, // May be null
  },
});
```

---

## Testing Checklist

For each tool, write tests for:

- [ ] **Happy path:** Successful operation with valid input
- [ ] **Input validation error:** Invalid email, past date, etc.
- [ ] **Conflict error:** Duplicate, already exists, etc.
- [ ] **Not found error:** Package doesn't exist, etc.
- [ ] **Null optional field:** What if segment is null?
- [ ] **Missing optional field:** What if notes aren't provided?
- [ ] **Malformed JSON:** What if data is corrupted?
- [ ] **Tenant isolation:** Query with wrong tenantId returns nothing
- [ ] **Empty results:** Query returns empty array, not null

Test pattern:

```typescript
describe('myTool', () => {
  it('should handle valid input', async () => {
    const result = await tool.execute(context, validParams);
    expect(result.success).toBe(true);
  });

  it('should return error for invalid input', async () => {
    const result = await tool.execute(context, invalidParams);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle null optional field', async () => {
    const result = await tool.execute(context, {
      ...validParams,
      // Don't include optional field
    });
    expect(result.success).toBe(true); // Should not crash
  });

  it('should isolate by tenant', async () => {
    const result = await tool.execute(wrongTenantContext, validParams);
    expect(result.success).toBe(false);
  });
});
```

---

## Code Review Red Flags

If your PR has any of these, fix before submitting:

- [ ] `as unknown as Type` without validation function
- [ ] Accessing `obj.nested.property` without null checks
- [ ] `catch (error) { return defaultValue; }` for all errors
- [ ] Missing `tenantId` in database WHERE clause
- [ ] No test for error cases
- [ ] No test for null/missing optional fields
- [ ] Error messages that expose internal details
- [ ] Logging sensitive data (passwords, tokens, emails)
- [ ] Service layer logic inside tool function

---

## Debugging Tips

### "as unknown as" Type Errors

```
Problem: TypeScript says type is incompatible
└─ Check: Are you using `as unknown as Type` directly?
└─ Fix: Create a parse/validation function (see Pattern 1)
```

### Null Reference Errors at Runtime

```
Problem: "Cannot read property 'x' of null/undefined"
└─ Check: Is field optional in Prisma schema?
└─ Fix: Use optional chaining: obj?.field ?? default (see Pattern 2)
```

### Wrong Error Type in Response

```
Problem: All errors return same message
└─ Check: Are you catching specific error types?
└─ Fix: Add separate catch blocks (see Pattern 3)
```

### Cross-Tenant Data Leakage

```
Problem: Query returns data from wrong tenant
└─ Check: Does WHERE clause have tenantId?
└─ Fix: Add tenantId to all queries (see Pattern 4)
```

---

## File Templates

### New Tool File Template

```typescript
import type { AgentTool, ToolContext, AgentToolResult } from '../tools/types';
import { logger } from '../../lib/core/logger';
import { ErrorMessages } from '../errors';

export const myTool: AgentTool = {
  name: 'my_operation',
  description: 'What this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      requiredParam: {
        type: 'string',
        description: 'What this param means',
      },
      optionalParam: {
        type: 'string',
        description: 'Optional, defaults to...',
      },
    },
    required: ['requiredParam'],
  },

  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const { requiredParam, optionalParam } = params as {
      requiredParam: string;
      optionalParam?: string;
    };

    try {
      // 1. Validate input
      if (!requiredParam.trim()) {
        return { success: false, error: 'Parameter cannot be empty' };
      }

      // 2. Query database with tenantId
      const resource = await prisma.table.findFirst({
        where: { tenantId, slug: requiredParam },
      });

      if (!resource) {
        return { success: false, error: 'Not found' };
      }

      // 3. Process safely (handle optional fields)
      const result = {
        ...resource,
        optional: resource.optionalField ?? 'default value',
      };

      // 4. Return success
      return { success: true, data: result };
    } catch (error) {
      // 5. Handle errors
      logger.error({ error, tenantId }, 'Tool execution failed');
      throw error; // Let middleware handle
    }
  },
};
```

### New Tool Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myTool } from './my-tool';
import type { ToolContext } from '../tools/types';

describe('myTool', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = {
      tenantId: 'test-tenant',
      prisma: mockPrisma, // Use test database
      sessionId: 'test-session',
    };
  });

  describe('happy path', () => {
    it('should handle valid input', async () => {
      const result = await myTool.execute(context, {
        requiredParam: 'valid-value',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('error cases', () => {
    it('should return error for missing required param', async () => {
      const result = await myTool.execute(context, {});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle not found case', async () => {
      const result = await myTool.execute(context, {
        requiredParam: 'nonexistent',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('optional fields', () => {
    it('should handle missing optional field', async () => {
      const result = await myTool.execute(context, {
        requiredParam: 'value',
        // optionalParam not provided
      });
      expect(result.success).toBe(true);
    });
  });

  describe('tenant isolation', () => {
    it('should not return data from other tenants', async () => {
      const otherTenantContext = { ...context, tenantId: 'other-tenant' };
      const result = await myTool.execute(otherTenantContext, {
        requiredParam: 'value-owned-by-test-tenant',
      });
      expect(result.success).toBe(false);
    });
  });
});
```

---

## Pre-Submission Checklist

Before pushing your agent tool code:

```
Type Safety
  ☐ No `as unknown as Type` without validation function
  ☐ parseChatMessages or similar for JSON fields
  ☐ npm run typecheck passes
  ☐ No unused imports (underscore prefix only if TRULY unused)

Null Safety
  ☐ Prisma schema checked for `?` (optional fields)
  ☐ Optional chaining used: `obj?.field ?? default`
  ☐ Guard clauses for required optional fields
  ☐ No accessing nested properties without null check

Error Handling
  ☐ Specific error types caught (ValidationError, ConflictError, etc.)
  ☐ Expected errors return 400-level responses
  ☐ Unexpected errors re-thrown to middleware
  ☐ All error paths logged with tenantId context
  ☐ No sensitive data in logs

Tenant Isolation
  ☐ Every WHERE clause has tenantId
  ☐ Every relation fetch filtered by tenantId
  ☐ No global cache without tenant scoping

Testing
  ☐ Happy path test passes
  ☐ Error case tests pass (not found, conflict, validation)
  ☐ Optional field tests pass
  ☐ Tenant isolation test passes
  ☐ Test coverage ≥ 70%
  ☐ npm test passes

Documentation
  ☐ Tool description is clear and concise
  ☐ Parameter descriptions include types and constraints
  ☐ Error conditions documented in code comments
  ☐ Complex logic has inline comments

Code Review
  ☐ Followed service layer patterns
  ☐ No direct Prisma calls in tool (delegate to service)
  ☐ Dependencies injected (not hardcoded)
  ☐ No hardcoded values (use env vars or config)
```

---

## When You Need Help

### Unsure About a Pattern?

1. Search the codebase: `grep -r "parseChatMessages"` → See how it's done elsewhere
2. Check existing tools: `/server/src/agent/customer/customer-tools.ts`
3. Read the full prevention doc: `agent-implementation-prevention-phase-3-MAIS-20251231.md`

### Tool Isn't Working?

1. Check error logs: Include tenantId, operation name
2. Test with valid tenantId and data first
3. Verify Prisma schema for optional fields
4. Check if parent object is null before accessing properties

### Tests Are Failing?

1. Check if tenantId matches between context and data
2. Verify test data exists in database
3. Check for optional field handling (should not crash)
4. Run in isolation: `npm test -- my-tool.test.ts`

---

## Key Metrics

Track these while implementing:

- **Test coverage:** ≥ 70% per tool
- **Type errors:** 0 (after `npm run typecheck`)
- **Lint errors:** 0 (after `npm run lint`)
- **Build time:** < 30 seconds
- **Execution time:** < 500ms per tool

---

## Version History

| Date       | Phase   | Change                                      |
| ---------- | ------- | ------------------------------------------- |
| 2025-12-31 | Phase 3 | Initial checklist from code review findings |

**Last updated:** 2025-12-31
**Status:** Active - Use for Phase 3+ agent implementations
