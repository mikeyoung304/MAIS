---
module: MAIS
date: 2025-12-31
problem_type: prevention_strategy
component: server/src/agent
phase: Phase 3 - AI Agent Implementation
symptoms:
  - Unsafe type assertions on JSON/unknown types
  - Missing null checks on optional fields
  - Error swallowing masks real database errors
  - Inconsistent error handling between tools
severity: P1
related_files:
  - server/src/agent/customer/customer-tools.ts
  - server/src/agent/customer/customer-orchestrator.ts
  - server/src/agent/orchestrator/orchestrator.ts
  - server/src/agent/proposals/proposal.service.ts
tags: [agent, type-safety, error-handling, json-parsing, defensive-programming]
---

# Agent Implementation Prevention Strategies - Phase 3

This document captures critical code review findings from Phase 3 implementation and provides prevention patterns to avoid regressions in future agent feature additions.

## Executive Summary

Phase 3 code review identified 3 P1 issues across agent implementations:

1. **Unsafe Type Assertions** - `as unknown as` conversions without validation
2. **Missing Null Checks** - Accessing optional fields without defensive guards
3. **Error Swallowing** - Generic error handlers hiding real failures

All three issues have been fixed, but prevention patterns must be followed in future agent work.

---

## Issue 1: Unsafe Type Assertions on JSON/Unknown Types

### The Problem

Prisma stores complex data as `JsonValue`, which TypeScript treats as `unknown`. Converting `unknown` to typed arrays requires validation, not just type assertions.

### Code Review Finding

**File:** `server/src/agent/customer/customer-orchestrator.ts` (before fix)

```typescript
// UNSAFE: Tells TypeScript to ignore the unknown type
messages: (existingSession.messages as unknown as ChatMessage[]) || [],
```

This pattern assumes the data matches `ChatMessage[]` without checking. If Prisma returns malformed data:

- Array validation is skipped
- Missing `role` or `content` fields are silently ignored
- Type guard filter doesn't run
- Empty array doesn't replace the bad data

### The Fix

**File:** `server/src/agent/orchestrator/orchestrator.ts` (lines 48-61)

```typescript
/**
 * Validate and parse messages from database JSON to ChatMessage[]
 * Prisma stores messages as JsonValue, this safely converts them
 */
function parseChatMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages.filter((msg): msg is ChatMessage => {
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
```

**Key improvements:**

- Array type check first
- Property existence checks (`'role' in msg`)
- Role value validation (`msg.role === 'user' || msg.role === 'assistant'`)
- Content type validation (`typeof msg.content === 'string'`)
- Returns empty array if validation fails (safe fallback)

### Prevention Checklist

When converting Prisma JSON fields or unknown types:

- [ ] Don't use `as unknown as Type` without validation
- [ ] Create a dedicated parse function with type guard
- [ ] Validate array first with `Array.isArray()`
- [ ] Check property existence with `'key' in obj`
- [ ] Validate property types with `typeof` checks
- [ ] Use TypeScript type guard filter: `filter((x): x is Type => { ... })`
- [ ] Return safe default (empty array, null, etc.) if validation fails
- [ ] Add unit test for malformed data handling
- [ ] Document the JsonValue→Type conversion in comments

### Code Pattern to Follow

```typescript
// GOOD: Safe JSON parsing pattern
interface SessionData {
  id: string;
  messages: ChatMessage[];
  metadata: Record<string, unknown>;
}

function parseSessionData(raw: unknown): SessionData | null {
  // Validate structure
  if (typeof raw !== 'object' || raw === null) {
    logger.warn('Session data not an object');
    return null;
  }

  const data = raw as Record<string, unknown>;

  // Type-safe property extraction
  if (typeof data.id !== 'string') {
    logger.warn('Missing or invalid session ID');
    return null;
  }

  // Validate complex nested types
  const messages = parseChatMessages(data.messages);
  const metadata = typeof data.metadata === 'object' && data.metadata !== null ? data.metadata : {};

  return {
    id: data.id,
    messages,
    metadata: metadata as Record<string, unknown>,
  };
}
```

### Testing Recommendation

```typescript
describe('parseChatMessages', () => {
  it('should handle valid message array', () => {
    const valid = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];
    expect(parseChatMessages(valid)).toEqual(valid);
  });

  it('should filter invalid messages', () => {
    const mixed = [
      { role: 'user', content: 'hello' }, // valid
      { role: 'invalid', content: 'bad' }, // invalid role
      { role: 'user', content: null }, // invalid content
      { content: 'no role' }, // missing role
    ];
    const result = parseChatMessages(mixed);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: 'hello' });
  });

  it('should return empty array for non-array input', () => {
    expect(parseChatMessages(null)).toEqual([]);
    expect(parseChatMessages('string')).toEqual([]);
    expect(parseChatMessages({ not: 'array' })).toEqual([]);
  });
});
```

---

## Issue 2: Missing Null Checks on Optional Fields

### The Problem

Prisma includes optional fields as `Type | null`. Accessing nested properties without null checks causes runtime errors or silent failures.

### Code Review Finding

**Pattern from onboarding tools (before fix):**

```typescript
// UNSAFE: location could be null, city access will fail
const location = validatedData.location;
const city = location.city; // Runtime error if location is null
```

This happens when:

- Field is optional in Prisma schema
- Data is loaded without checking null state first
- Nested property access assumes intermediate object exists

### The Fix

**Defensive pattern with null coalescing:**

```typescript
// SAFE: Check optional fields before access
const location = validatedData.location;
const city = location?.city ?? 'Unknown';

// Or: Guard clause pattern
if (!validatedData.location) {
  logger.warn('Location not provided, using defaults');
  return {
    city: 'Unknown',
    state: 'Unknown',
    country: 'Unknown',
  };
}

const { city, state, country } = validatedData.location;
```

### Prevention Checklist

When accessing nested properties:

- [ ] Check Prisma schema for `nullable` fields
- [ ] Use optional chaining (`?.`) for potentially null properties
- [ ] Use null coalescing (`??`) to provide safe defaults
- [ ] Add guard clauses for critical optional fields
- [ ] Don't assume nested properties exist without null check
- [ ] Document which fields are optional in comments
- [ ] Handle "not found" vs "null" cases differently in logging
- [ ] Add unit tests for missing optional field scenarios

### Code Pattern to Follow

```typescript
// GOOD: Safe nested property access
interface DiscoveryData {
  businessType: string;
  location?: {
    city: string;
    state: string;
    country: string;
  };
  yearsInBusiness?: number;
  currentAveragePrice?: number;
}

function extractLocationInfo(data: DiscoveryData): {
  city: string;
  state: string;
  country: string;
} {
  // Pattern 1: Guard clause for missing optional object
  if (!data.location) {
    return {
      city: 'Unknown',
      state: 'Unknown',
      country: 'Unknown',
    };
  }

  // Pattern 2: Safe destructuring after null check
  const { city, state, country } = data.location;
  return { city, state, country };
}

function buildLocationSummary(data: DiscoveryData): string {
  // Pattern 3: Optional chaining with default values
  const city = data.location?.city ?? 'Unknown';
  const state = data.location?.state ?? 'Unknown';
  return `${city}, ${state}`;
}

function formatForLogging(data: DiscoveryData): Record<string, unknown> {
  return {
    businessType: data.businessType,
    hasLocation: !!data.location, // Boolean flag instead of accessing null
    city: data.location?.city,
    yearsInBusiness: data.yearsInBusiness ?? 'Not specified',
  };
}
```

### Testing Recommendation

```typescript
describe('extractLocationInfo', () => {
  it('should extract location when present', () => {
    const data: DiscoveryData = {
      businessType: 'photographer',
      location: { city: 'Portland', state: 'OR', country: 'USA' },
    };
    const result = extractLocationInfo(data);
    expect(result).toEqual({ city: 'Portland', state: 'OR', country: 'USA' });
  });

  it('should return defaults when location is missing', () => {
    const data: DiscoveryData = {
      businessType: 'photographer',
      location: undefined,
    };
    const result = extractLocationInfo(data);
    expect(result).toEqual({
      city: 'Unknown',
      state: 'Unknown',
      country: 'Unknown',
    });
  });

  it('should return defaults when location is null', () => {
    const data: DiscoveryData = {
      businessType: 'photographer',
      location: null,
    };
    const result = extractLocationInfo(data);
    expect(result).toEqual({
      city: 'Unknown',
      state: 'Unknown',
      country: 'Unknown',
    });
  });

  it('should handle partial location data', () => {
    const data = {
      businessType: 'photographer',
      location: { city: 'Portland' } as any, // Missing state, country
    };
    // Should not crash, should use defaults for missing fields
    const result = extractLocationInfo(data);
    expect(result.city).toBe('Portland');
  });
});
```

### Database Query Pattern

When querying Prisma with optional relations:

```typescript
// GOOD: Be explicit about optional includes
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: {
    id: true,
    name: true,
    location: true, // Could be null
    settings: true, // Could be null
    createdAt: true,
  },
});

// Null checks before use
if (tenant?.location) {
  const city = tenant.location.city; // Safe now
}

// Or: Provide fallback during query
const settings = tenant?.settings ?? getDefaultSettings();
```

---

## Issue 3: Error Swallowing - Generic Catch-All Handlers

### The Problem

Generic `catch (error)` blocks that always return the same default response hide real failures. This makes debugging impossible and can allow silent data corruption.

### Code Review Finding

**Pattern (before fix):**

```typescript
try {
  const packages = await prisma.package.findMany({ where });
  return { success: true, data: packages };
} catch (error) {
  logger.error({ error, tenantId }, 'Failed to get services');
  // PROBLEM: Returns same error for all failure types
  return { success: false, error: ErrorMessages.LOAD_SERVICES };
}
```

This pattern doesn't distinguish:

- Package not found (404) vs database error (500)
- Network timeout vs constraint violation
- Permission denied vs invalid input

### The Fix

**Differentiated error handling:**

```typescript
// GOOD: Handle error types differently
try {
  const packages = await prisma.package.findMany({
    where: { tenantId, active: true },
  });

  return {
    success: true,
    data: packages,
  };
} catch (error) {
  // Classify error by type
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      // Record not found - not an error for list queries
      logger.debug({ tenantId }, 'No packages found');
      return { success: true, data: [] };
    }
    if (error.code === 'P2002') {
      // Unique constraint violation
      logger.warn({ error, tenantId }, 'Duplicate package');
      return { success: false, error: 'Package already exists' };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    // Invalid query - development error
    logger.error({ error }, 'Invalid package query');
    throw error; // Re-throw to trigger error middleware
  }

  // Database/network errors
  logger.error({ error, tenantId }, 'Failed to get services');
  throw error; // Let middleware handle
}
```

### Prevention Checklist

When writing error handlers:

- [ ] Catch specific error types first (Prisma, external APIs)
- [ ] Log error type, code, and message separately
- [ ] Don't catch `Error` and return generic message for "not found" cases
- [ ] Distinguish between "user error" (400) and "system error" (500)
- [ ] Re-throw unexpected errors to middleware
- [ ] Add fallback return only for expected error cases
- [ ] Test both success and multiple failure modes
- [ ] Include error context in logs (tenantId, userId, operation)

### Code Pattern to Follow

```typescript
// GOOD: Multi-tier error handling
async function createBooking(tenantId: string, input: BookingInput): Promise<Booking> {
  try {
    // Validate input first
    if (new Date(input.date) < new Date()) {
      throw new ValidationError('Cannot book past dates');
    }

    // Check business rules before database
    const existingBooking = await this.bookingRepo.findByDate(tenantId, input.date);
    if (existingBooking) {
      throw new ConflictError('Date already booked');
    }

    // Create booking
    const booking = await this.bookingRepo.create(tenantId, input);
    this.eventEmitter.emit('booking.created', booking);

    return booking;
  } catch (error) {
    // Layer 1: Expected domain errors (user's fault)
    if (error instanceof ValidationError) {
      logger.info({ tenantId, error: error.message }, 'Validation failed');
      throw error; // Route will return 400
    }

    if (error instanceof ConflictError) {
      logger.info({ tenantId, error: error.message }, 'Conflict detected');
      throw error; // Route will return 409
    }

    // Layer 2: Prisma constraint violations (data integrity)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        logger.warn({ tenantId, error }, 'Unique constraint violated');
        throw new ConflictError('Booking already exists');
      }
      if (error.code === 'P2025') {
        logger.warn({ tenantId, error }, 'Record not found');
        throw new NotFoundError('Package not found');
      }
    }

    // Layer 3: Unexpected errors (system's fault)
    logger.error(
      { tenantId, error, stack: error instanceof Error ? error.stack : undefined },
      'Booking creation failed'
    );
    throw error; // Let middleware handle
  }
}

// In route handler:
try {
  const booking = await bookingService.create(req.tenantId, req.body);
  return { status: 201, body: booking };
} catch (error) {
  // Error middleware catches and responds appropriately
  throw error;
}
```

### Prisma Error Reference

```typescript
// Common Prisma error codes to handle:
// P2000 - The provided value for the column is too long
// P2002 - Unique constraint failed (duplicate key)
// P2003 - Foreign key constraint failed
// P2004 - Constraint failed on the database
// P2005 - Invalid value for relation (value type mismatch)
// P2006 - Cannot delete if related records exist
// P2025 - Record not found

// Schema validation errors (typos, wrong fields)
// Should be caught during development, re-throw in production

// Network timeouts - let error middleware handle
// Retry logic at boundary (controller/route layer)
```

### Testing Recommendation

```typescript
describe('createBooking error handling', () => {
  it('should throw ValidationError for past dates', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    await expect(
      service.createBooking(tenantId, {
        ...validInput,
        date: pastDate.toISOString(),
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ConflictError for double bookings', async () => {
    // Create first booking
    await service.createBooking(tenantId, validInput);

    // Try to book same date
    await expect(service.createBooking(tenantId, validInput)).rejects.toThrow(ConflictError);
  });

  it('should throw NotFoundError if package deleted', async () => {
    const input = { ...validInput, packageId: 'nonexistent' };
    await expect(service.createBooking(tenantId, input)).rejects.toThrow(NotFoundError);
  });

  it('should re-throw unexpected Prisma errors', async () => {
    // Mock Prisma to throw unexpected error
    jest.spyOn(bookingRepo, 'create').mockRejectedValue(new Error('Connection timeout'));

    await expect(service.createBooking(tenantId, validInput)).rejects.toThrow('Connection timeout');
  });
});
```

---

## Integrated Prevention Checklist for Agent Tools

Use this checklist when adding new agent tools:

### Type Safety

- [ ] Identify Prisma JSON fields in query results
- [ ] Create parse/validation functions for JSON conversions
- [ ] Use type guard filters: `filter((x): x is Type => { ... })`
- [ ] Never use `as unknown as Type` without validation function
- [ ] Add comments documenting JsonValue→Type conversion
- [ ] Add unit tests for malformed data
- [ ] Run `npm run typecheck` after changes
- [ ] Check Prisma schema for nullable fields in related data

### Null Safety

- [ ] Check Prisma schema for `?` (optional) fields
- [ ] Use optional chaining `?.` for optional properties
- [ ] Use null coalescing `??` to provide defaults
- [ ] Add guard clauses for critical optional fields
- [ ] Don't assume nested objects exist
- [ ] Test with missing optional data
- [ ] Document which fields are optional in code comments
- [ ] Distinguish "not found" from "null" in logs

### Error Handling

- [ ] Catch specific error types, not generic `Error`
- [ ] Log error type/code/message separately
- [ ] Differentiate expected errors (400s) from system errors (500s)
- [ ] Never return same response for all error cases
- [ ] Test multiple failure modes (not found, conflict, permission denied)
- [ ] Include operation context in logs (tenantId, userId, operation)
- [ ] Re-throw unexpected errors to middleware
- [ ] Document error handling in tool description

### Testing

- [ ] Unit test happy path
- [ ] Unit test each error case
- [ ] Test with null/missing optional fields
- [ ] Test with malformed JSON data
- [ ] Test database constraint violations
- [ ] Test tenant isolation (wrong tenantId returns nothing)
- [ ] Coverage target: 70%+ per tool

### Code Review

- [ ] Check for `as any` / `as unknown as` conversions
- [ ] Verify type guard filters are comprehensive
- [ ] Check for null checks on optional fields
- [ ] Review error handling for specificity
- [ ] Verify tenant isolation in all queries

---

## Reference: Service Layer Patterns for Tools

Agent tools should follow service layer patterns:

```typescript
// GOOD: Tool uses service layer
export const myTool: AgentTool = {
  name: 'my_operation',
  description: 'Does something',
  async execute(context: ToolContext, params) {
    const { tenantId, prisma } = context;

    try {
      // Delegate to service
      const result = await myService.doSomething(tenantId, params);
      return { success: true, data: result };
    } catch (error) {
      // Service throws domain errors, tool catches them
      if (error instanceof ValidationError) {
        return { success: false, error: error.message };
      }
      // Re-throw unexpected errors
      throw error;
    }
  },
};

// GOOD: Service owns business logic
export class MyService {
  async doSomething(tenantId: string, input: InputType): Promise<OutputType> {
    // Validate input
    if (invalid) throw new ValidationError('...');

    // Check business rules
    const existing = await this.repo.findOne(tenantId, input.id);
    if (existing) throw new ConflictError('...');

    // Execute
    const result = await this.repo.create(tenantId, input);

    // Emit events
    this.events.emit('something.done', result);

    return result;
  }
}
```

---

## Common Anti-Patterns to Avoid

### 1. Type Assertions Without Validation

```typescript
// ❌ DON'T: Direct assertion
const messages = existingSession.messages as ChatMessage[];

// ✅ DO: Validate first
const messages = parseChatMessages(existingSession.messages);
```

### 2. Accessing Nested Optional Properties

```typescript
// ❌ DON'T: Assume intermediate object exists
const city = data.location.city;

// ✅ DO: Check for null first
const city = data.location?.city ?? 'Unknown';
```

### 3. Generic Error Responses

```typescript
// ❌ DON'T: Return same error for all failures
try {
  await operation();
  return { success: true };
} catch (error) {
  return { success: false, error: 'Operation failed' };
}

// ✅ DO: Differentiate error types
try {
  await operation();
  return { success: true };
} catch (error) {
  if (error instanceof ConflictError) {
    return { success: false, error: error.message, status: 409 };
  }
  throw error; // Let middleware handle unexpected errors
}
```

### 4. Swallowing Errors Silently

```typescript
// ❌ DON'T: Catch and ignore
try {
  const data = JSON.parse(jsonStr);
} catch (error) {
  return null; // Silent failure
}

// ✅ DO: Log and handle appropriately
try {
  const data = JSON.parse(jsonStr);
} catch (error) {
  logger.warn({ error }, 'Failed to parse JSON');
  return null; // Or throw, depending on context
}
```

### 5. Missing Tenant Isolation

```typescript
// ❌ DON'T: Query without tenantId filter
const packages = await prisma.package.findMany({
  where: { active: true },
});

// ✅ DO: Always include tenantId
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});
```

---

## Quick Reference: 30-Second Rules

When implementing agent tools:

```
JSON/Unknown type?
├─ Create type guard function (parseChatMessages pattern)
├─ Validate: Array.isArray(), property checks, value validation
└─ Return safe default if validation fails

Optional field (Prisma schema has `?`)?
├─ Use optional chaining: `obj?.field ?? default`
├─ Or: Guard clause before access
└─ Always provide a fallback

Catch block?
├─ Catch specific error types (ValidationError, ConflictError)
├─ Handle expected errors → return user response
├─ Log unexpected errors with full context
└─ Re-throw to middleware

Database query?
├─ Check Prisma schema for nullable fields
├─ Include tenantId in WHERE clause (always!)
├─ Test what happens if relation is null
└─ Provide defaults in SELECT if nullable

Test the tool?
├─ Happy path test
├─ Each error case test
├─ Null/missing optional field test
├─ Malformed data test
└─ Tenant isolation test
```

---

## How to Use This Document

1. **For code review:** Check against "Prevention Checklist" sections
2. **For implementation:** Follow "Code Pattern to Follow" sections
3. **For testing:** Use "Testing Recommendation" patterns
4. **For debugging:** Reference "Common Anti-Patterns" to identify issues

---

## Related Prevention Documents

- **[any-types-quick-reference-MAIS-20251204.md](./any-types-quick-reference-MAIS-20251204.md)** - When `any` is acceptable vs code smell
- **[service-layer-patterns-MAIS-20251204.md](./service-layer-patterns-MAIS-20251204.md)** - Service layer architecture
- **[cascading-entity-type-errors-MAIS-20251204.md](../logic-errors/cascading-entity-type-errors-MAIS-20251204.md)** - Preventing type cascading errors

---

## Session Context

- **Phase:** Phase 3 - AI Agent Implementation
- **Commits:** c11cda2 (Phase 2), 903da20 (Phase 1)
- **Review Date:** 2025-12-31
- **Status:** All P1 issues fixed, prevention patterns documented
