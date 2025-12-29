---
module: MAIS
date: 2025-12-28
problem_type: quick_reference
component: agent/tools
issues_prevented: [451, 452, 453, 454, 455, 456, 457]
---

# Agent Tool Architecture Quick Checklist

Print and pin this! Use before submitting any agent tool PR.

---

## Pre-Implementation

### Tool Planning

- [ ] **Search for duplicates**

  ```bash
  grep -r "get_" server/src/agent/tools/
  grep -r "manage_" server/src/agent/tools/
  grep -r "add_" server/src/agent/tools/
  ```

  - No overlapping functionality
  - Clear distinct purpose

- [ ] **Check existing helpers**

  ```bash
  grep -r "formatPrice\|formatDate\|buildDateRange" server/src/agent/tools/utils.ts
  ```

  - Reuse formatters instead of writing new ones
  - Use existing date range builders

- [ ] **Identify query dependencies**
  - [ ] Queries are independent → use `Promise.all()`
  - [ ] Queries are dependent → sequential OK

---

## Read Tools

### Pagination

- [ ] **All `findMany()` calls have `take` limit**

  ```typescript
  ✅ CORRECT:
  take: Math.min(limit || 50, 100)

  ❌ WRONG:
  // Missing take limit
  ```

- [ ] **Limit is reasonable** (10-100 range)

- [ ] **Ordering is consistent**

  ```typescript
  orderBy: {
    createdAt: 'desc';
  } // newest first
  ```

- [ ] **Response includes `hasMore` flag**

  ```typescript
  hasMore: items.length === take;
  ```

- [ ] **Tool description mentions limit**
  ```typescript
  description: 'Fetch items for tenant (max 50 returned)';
  ```

### Type Safety

- [ ] **No `as any` type casts**
  - If needed, add comment explaining why

- [ ] **Enum validation at runtime**

  ```typescript
  ✅ CORRECT:
  if (!isValidStatus(status)) {
    return { success: false, error: 'Invalid status' };
  }

  ❌ WRONG:
  status: status as any
  ```

- [ ] **Helper functions have explicit types**

  ```typescript
  ✅ CORRECT:
  function formatAddOn(addOn: {
    id: string;
    name: string;
    priceCents: number;
  }): { name: string; price: string } { ... }

  ❌ WRONG:
  function formatAddOn(addOn: any) { ... }
  ```

### Performance

- [ ] **Parallel queries use `Promise.all()`**

  ```typescript
  ✅ CORRECT:
  const [bookings, customers] = await Promise.all([
    prisma.booking.findMany(...),
    prisma.customer.findMany(...),
  ]);

  ❌ WRONG:
  const bookings = await prisma.booking.findMany(...);
  const customers = await prisma.customer.findMany(...);
  ```

- [ ] **Database indexes exist for WHERE filters**
  - Ask: What's in the `where: { ... }` clause?
  - Verify matching `@@index` in schema.prisma

### Error Handling

- [ ] **Uses `handleToolError` helper**

  ```typescript
  ✅ CORRECT:
  return handleToolError(error, 'get_items', tenantId);

  ❌ WRONG:
  return { success: false, error: error.message };
  ```

- [ ] **Appropriate error code used**
  ```typescript
  ToolErrorCode.DATABASE_ERROR;
  ToolErrorCode.VALIDATION_ERROR;
  ToolErrorCode.NOT_FOUND_ERROR;
  ```

---

## Write Tools

### Type Safety & Validation

- [ ] **Input validated with Zod or type guards**

  ```typescript
  ✅ CORRECT:
  const schema = z.object({ date: z.string().date() });
  const input = schema.parse(userInput);

  ❌ WRONG:
  const input = userInput as any;
  ```

- [ ] **Foreign keys validated for ownership**

  ```typescript
  ✅ CORRECT:
  const item = await prisma.item.findUnique({
    where: { id: input.itemId, tenantId }
  });
  if (!item) throw new NotFoundError();

  ❌ WRONG:
  const item = await prisma.item.findUnique({
    where: { id: input.itemId }  // Missing tenantId!
  });
  ```

- [ ] **Numeric fields have bounds**

  ```typescript
  ✅ CORRECT:
  priceCents: z.number().min(100).max(999999)

  ❌ WRONG:
  priceCents: z.number()  // Any value allowed
  ```

### Database Mutations

- [ ] **Transaction wraps related operations**

  ```typescript
  ✅ For critical mutations:
  await prisma.$transaction(async (tx) => {
    // Multiple operations wrapped
  });
  ```

- [ ] **Idempotency checks**

  ```typescript
  ✅ For webhook-like operations:
  const existing = await prisma.item.findUnique({
    where: { idempotencyKey }
  });
  if (existing) return existing;  // Already processed
  ```

- [ ] **No N+1 queries**

  ```typescript
  ✅ CORRECT:
  const items = await prisma.item.findMany({
    include: { related: true }  // Fetch in one query
  });

  ❌ WRONG:
  const items = await prisma.item.findMany();
  for (const item of items) {
    item.related = await prisma.related.findMany(...);  // Loop!
  }
  ```

### Error Handling

- [ ] **Uses `handleToolError` helper**

- [ ] **Handles specific error cases**

  ```typescript
  ✅ CORRECT:
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return createFailure('Already exists', ToolErrorCode.VALIDATION_ERROR);
    }
  }

  ❌ WRONG:
  return handleToolError(error, ...);  // Generic, loses context
  ```

### Security

- [ ] **All queries filtered by tenantId**

  ```bash
  # Verify no cross-tenant leaks
  grep -n "where: {" server/src/agent/tools/write-tools.ts | grep -v tenantId
  ```

- [ ] **Soft-confirm has time-based expiry** (if applicable)
  ```typescript
  const TWO_MINUTES = 2 * 60 * 1000;
  const hasExpired = Date.now() - proposal.createdAt > TWO_MINUTES;
  if (hasExpired) return { success: false, error: 'Proposal expired' };
  ```

---

## Code Quality

### DRY Compliance

- [ ] **No duplicated error handling**
  - Use `handleToolError`

- [ ] **No duplicated formatting**
  - Use `formatPrice`, `formatDate`, etc.

- [ ] **No duplicated date range logic**
  - Use `buildDateRange()` helper

- [ ] **No duplicated filter building**
  - Use `buildWhereWithDateRange()` helper

### Imports

- [ ] **Imports error handler**

  ```typescript
  import { handleToolError, ToolErrorCode } from './utils';
  ```

- [ ] **Imports formatters**

  ```typescript
  import { formatPrice, formatDate } from './utils';
  ```

- [ ] **No unused imports**
  ```bash
  eslint server/src/agent/tools/your-tools.ts
  ```

### Documentation

- [ ] **Tool description is clear**

  ```typescript
  description: 'Fetch bookings (max 50). Filter by date range.';
  ```

- [ ] **Input parameters documented**

  ```typescript
  properties: {
    date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
  }
  ```

- [ ] **Response format documented** (in comments)

---

## Testing

### Pagination Tests

```typescript
test('tool returns max 50 items even with 1000+', async () => {
  // Create 1000+ records
  const response = await getTool.execute({ tenantId });

  expect(response.items.length).toBeLessThanOrEqual(50);
  expect(response.hasMore).toBe(true);
});
```

### Type Safety Tests

```typescript
test('invalid status rejected', async () => {
  const response = await getTool.execute(
    {
      status: 'INVALID',
    },
    context
  );

  expect(response.success).toBe(false);
  expect(response.error).toContain('Invalid status');
});
```

### Ownership/Tenant Tests

```typescript
test('cannot access other tenant data', async () => {
  const response = await getTool.execute(
    {
      tenantId: 'other-tenant',
    },
    context
  );

  expect(response.success).toBe(false);
});
```

### Parallel Query Tests

```typescript
test('parallel queries faster than sequential', async () => {
  const start = Date.now();
  const response = await getTool.execute({}, context);
  const elapsed = Date.now() - start;

  // Should be ~10-20ms (parallel), not ~30ms+ (sequential)
  expect(elapsed).toBeLessThan(25);
});
```

---

## Code Review Checklist (For Reviewers)

- [ ] **All read tools have `take` limits**

  ```bash
  grep -n "findMany" agent/tools/read-tools.ts | grep -v "take:"
  # Should return nothing
  ```

- [ ] **No duplicate tools**
  - List all tool names
  - Check for overlaps

- [ ] **No `as any` casts**

  ```bash
  grep -n " as any" agent/tools/*.ts
  # Should return nothing (or justified comments)
  ```

- [ ] **Composite indexes exist**
  - Query uses: tenantId + createdAt + status?
  - Index exists: `@@index([tenantId, createdAt, status])`?

- [ ] **Error handling uses helper**

  ```bash
  grep -c "handleToolError" agent/tools/your-file.ts
  # Should equal number of try/catch blocks
  ```

- [ ] **No sequential parallel queries**

  ```bash
  grep -B2 -A2 "await.*findMany\|await.*aggregate" agent/tools/your-file.ts
  # Should show Promise.all for independent queries
  ```

- [ ] **All tests pass**
  ```bash
  npm test -- server/src/agent/tools/your-tools.test.ts
  ```

---

## Common Mistakes & Fixes

### Mistake 1: Unbounded Query

```typescript
// ❌ WRONG
const items = await prisma.item.findMany({ where: { tenantId } });

// ✅ FIX
const items = await prisma.item.findMany({
  where: { tenantId },
  take: 50,
});
```

### Mistake 2: Type Cast Instead of Validation

```typescript
// ❌ WRONG
if (status) {
  const validated = status as BookingStatus;
  // ...
}

// ✅ FIX
const isValid = (s: string): s is BookingStatus =>
  Object.values(BookingStatus).includes(s as BookingStatus);

if (isValid(status)) {
  // status is now type-safe
}
```

### Mistake 3: Duplicate Error Handling

```typescript
// ❌ WRONG (repeated in every tool)
} catch (error) {
  const msg = error instanceof Error ? error.message : 'Unknown';
  logger.error({ error, tenantId }, 'Error in tool');
  return { success: false, error: `Failed: ${msg}` };
}

// ✅ FIX
} catch (error) {
  return handleToolError(error, 'get_items', tenantId);
}
```

### Mistake 4: Sequential Independent Queries

```typescript
// ❌ WRONG (10ms + 10ms = 20ms total)
const bookings = await prisma.booking.findMany(...);
const customers = await prisma.customer.findMany(...);

// ✅ FIX (max(10ms, 10ms) = 10ms total, 2x faster)
const [bookings, customers] = await Promise.all([
  prisma.booking.findMany(...),
  prisma.customer.findMany(...),
]);
```

### Mistake 5: Missing Foreign Key Ownership Check

```typescript
// ❌ WRONG - Can access other tenant's data!
const item = await prisma.item.findUnique({
  where: { id: input.itemId },
});

// ✅ FIX - Scoped to tenant
const item = await prisma.item.findUnique({
  where: {
    id: input.itemId,
    tenantId, // Verify ownership
  },
});

// Alternative with custom error handling
const item = await prisma.item.findUnique({
  where: { id: input.itemId },
});
if (!item || item.tenantId !== tenantId) {
  throw new NotFoundError(); // 404, not 403
}
```

---

## Issue-to-Checklist Mapping

| Issue                     | Checklist Section                  |
| ------------------------- | ---------------------------------- |
| 451 - Unbounded Queries   | Read Tools → Pagination            |
| 452 - Duplicate Tools     | Pre-Implementation → Tool Planning |
| 453 - Type Safety         | Read/Write Tools → Type Safety     |
| 454 - Soft-Confirm Timing | Write Tools → Security             |
| 455 - Error Handling DRY  | Code Quality → DRY Compliance      |
| 456 - Missing Index       | Read Tools → Performance           |
| 457 - Sequential Queries  | Read Tools → Performance           |

---

## Quick Questions Before Submitting PR

1. **Does every `findMany()` have a `take` limit?**
   - Yes → Continue
   - No → Add `take: 50` and recheck

2. **Does any tool duplicate existing functionality?**
   - No → Continue
   - Yes → Consolidate or remove

3. **Any `as any` casts?**
   - No → Continue
   - Yes → Add type guards or justify with comment

4. **All errors use `handleToolError`?**
   - Yes → Continue
   - No → Refactor to use helper

5. **Independent queries run in parallel?**
   - Yes → Continue
   - No → Use `Promise.all()`

6. **All tests pass?**
   - Yes → Submit PR
   - No → Fix failures first

---

**Last Updated:** 2025-12-28
**Companion Document:** [Agent Tool Architecture Prevention Strategies](./AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md)
