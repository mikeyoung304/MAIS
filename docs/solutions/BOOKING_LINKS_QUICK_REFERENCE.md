# Booking Links Phase 0: Quick Reference Cheat Sheet

Print this and pin it next to your desk while working on booking links features.

---

## The 4 Critical Patterns

### 1. Always Scope Mutations by tenantId

```typescript
// DELETE
const deleted = await prisma.service.deleteMany({
  where: { id: serviceId, tenantId },  // ALWAYS include tenantId
});
if (deleted.count === 0) throw new ResourceNotFoundError(...);

// UPDATE
const updated = await prisma.$transaction(async (tx) => {
  await tx.service.updateMany({
    where: { id: serviceId, tenantId },  // ALWAYS include tenantId
    data: updateData,
  });
  return tx.service.findFirstOrThrow({ where: { id: serviceId, tenantId } });
});
```

### 2. Register Tools in REQUIRED_EXECUTOR_TOOLS

In `server/src/agent/proposals/executor-registry.ts`:

```typescript
const REQUIRED_EXECUTOR_TOOLS = [
  // existing tools...
  'my_new_tool',  // ADD HERE when creating new tools
] as const;
```

If you forget, the server won't start. That's a feature.

### 3. Extract Shared Utilities to agent/utils/

Don't implement `getTenantInfo()` twice. If you need it in 2+ places:

```bash
# Create: server/src/agent/utils/my-utility.ts
export async function myUtility(...) { ... }

# Import in both places:
import { myUtility } from '../utils/my-utility';
```

### 4. Lock Check-Then-Act in Transactions

Every time you check state then modify:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Lock the row
  await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${id} FOR UPDATE`;

  // 2. Check condition
  const state = await tx.booking.count({ where: { serviceId: id, ... } });
  if (state > 0) throw new ValidationError(...);

  // 3. Act
  await tx.service.deleteMany({ where: { id, tenantId } });
});
```

---

## Copy-Paste Templates

### Template: Delete Operation

```typescript
async function deleteService(
  prisma: PrismaClient,
  tenantId: string,
  serviceId: string
): Promise<void> {
  // Lock row to prevent concurrent modifications
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;

    // Check for active bookings
    const upcomingBookings = await tx.booking.count({
      where: {
        serviceId,
        tenantId,
        date: { gte: new Date() },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    if (upcomingBookings > 0) {
      throw new ValidationError(
        `Cannot delete service with ${upcomingBookings} upcoming booking(s).`
      );
    }

    // Delete with tenantId scope (defense in depth)
    const deleted = await tx.service.deleteMany({
      where: { id: serviceId, tenantId },
    });

    if (deleted.count === 0) {
      throw new ResourceNotFoundError('Service', serviceId);
    }
  });
}
```

### Template: Update Operation

```typescript
async function updateService(
  prisma: PrismaClient,
  tenantId: string,
  serviceId: string,
  updateData: ServiceUpdateInput
): Promise<Service> {
  return prisma.$transaction(async (tx) => {
    const result = await tx.service.updateMany({
      where: { id: serviceId, tenantId },  // Defense in depth
      data: updateData,
    });

    if (result.count === 0) {
      throw new ResourceNotFoundError('Service', serviceId);
    }

    return tx.service.findFirstOrThrow({
      where: { id: serviceId, tenantId },
    });
  });
}
```

### Template: Shared Utility

```typescript
// server/src/agent/utils/my-utility.ts

export interface MyUtilityResult {
  field1: string;
  field2?: string;
}

export async function myUtility(
  prisma: PrismaClient,
  tenantId: string,
  options?: { includeExtra?: boolean }
): Promise<MyUtilityResult | null> {
  const data = await prisma.myModel.findUnique({
    where: { id: tenantId },
    select: {
      field1: true,
      ...(options?.includeExtra ? { field2: true } : {}),
    },
  });

  return data
    ? {
        field1: data.field1,
        field2: options?.includeExtra ? (data as any).field2 : undefined,
      }
    : null;
}
```

---

## Pre-Commit Checklist

Before pushing code:

- [ ] All mutations include `tenantId` in where clause
- [ ] New tools added to `REQUIRED_EXECUTOR_TOOLS`
- [ ] Check-then-act patterns wrapped in `$transaction`
- [ ] No duplicate functions (search for function name across codebase)
- [ ] Error messages are user-friendly and specific
- [ ] Tests cover isolation, registry, and race conditions

```bash
# Quick validation
npm run typecheck
npm run lint
npm test -- --grep "booking"
npx madge --circular server/src/
```

---

## Red Flags (Fix Before Commit)

| Red Flag | Why | Fix |
|----------|-----|-----|
| `await prisma.model.delete({ where: { id } })` | No tenantId scope | Add tenantId to where clause |
| New tool but not in REQUIRED_EXECUTOR_TOOLS | Silent failures | Add to executor-registry.ts |
| `getTenantInfo()` implemented twice | DRY violation | Extract to agent/utils/ |
| Check and mutation in separate functions | Race condition | Wrap in $transaction |
| No `FOR UPDATE` lock in transaction | Concurrent bugs | Add lock before check |
| `throw new Error(...)` | Unclear to user | Use specific error classes |

---

## Common Mistakes

### Mistake 1: Forgetting tenantId in mutation

```typescript
// WRONG - Only in where check
if (isOwner(serviceId, tenantId)) {
  await prisma.service.delete({ where: { id: serviceId } });
}

// RIGHT - In both check AND mutation
if (isOwner(serviceId, tenantId)) {
  const deleted = await prisma.service.deleteMany({
    where: { id: serviceId, tenantId },
  });
}
```

### Mistake 2: Missing FROM REQUIRED_EXECUTOR_TOOLS

```typescript
// In tools file: implement new tool
export const my_tool = { ... };

// In executors file: implement executor
export async function my_tool_executor() { ... }

// In executor-registry.ts: FORGOT THIS
const REQUIRED_EXECUTOR_TOOLS = [ ... ]; // my_tool NOT here

// Result: Server starts fine, but proposals silently fail
```

### Mistake 3: Separate check and mutation

```typescript
// WRONG - Race condition between lines
const count = await prisma.booking.count({ where: { serviceId, ... } });
if (count > 0) throw Error();
await prisma.service.delete({ where: { id: serviceId } }); // Another booking created here!

// RIGHT - Atomic in transaction
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT ... FOR UPDATE`;
  const count = await tx.booking.count(...);
  if (count > 0) throw Error();
  await tx.service.deleteMany(...);
});
```

---

## How Things Fail (and How We Prevent It)

### Scenario 1: Cross-Tenant Data Leak

**How it happens:** Mutation without tenantId scope
```typescript
await prisma.service.delete({ where: { id: '123' } }); // Could delete from ANY tenant
```

**How we prevent (Fix #617):**
```typescript
await prisma.service.deleteMany({ where: { id: '123', tenantId } }); // Defense in depth
```

---

### Scenario 2: Silent Proposal Failures

**How it happens:** Tool implemented but executor not registered
```typescript
// Proposal confirms → tries to execute → "executor not found" → silent fail
```

**How we prevent (Fix #618):**
```typescript
// Server startup: validateExecutorRegistry()
// Throws error immediately if executor not in REQUIRED_EXECUTOR_TOOLS
// Server doesn't start until all executors registered
```

---

### Scenario 3: N+1 Queries

**How it happens:** Same function in multiple files
```typescript
// booking-link-tools.ts calls getTenantInfo() → 1 query
// booking-link-executors.ts calls getTenantInfo() → 1 query (identical)
// Total: 2 queries where 1 would suffice
```

**How we prevent (Fix #619):**
```typescript
// Single shared utility in agent/utils/tenant-info.ts
// Both files import from same place → 1 query total
```

---

### Scenario 4: Orphaned Bookings

**How it happens:** Race condition in delete
```typescript
// Thread A: count bookings = 0 ✓
// Thread B: create booking
// Thread A: delete service ✗
// Result: booking exists for deleted service
```

**How we prevent (Fix #620):**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT ... FOR UPDATE`;  // Lock acquired
  const count = await tx.booking.count(...);    // Count under lock
  await tx.service.deleteMany(...);             // Delete under lock
  // Lock released → other transactions unblocked
});
```

---

## Questions to Ask Before Implementing

1. **Are all mutations scoped by tenantId?** (Fix #617)
2. **Are new tools in REQUIRED_EXECUTOR_TOOLS?** (Fix #618)
3. **Is this function implemented anywhere else?** (Fix #619)
4. **Are check and mutation atomic?** (Fix #620)

If you answer "no" to any, you're about to ship a bug. Stop and fix it.

---

## Performance Notes

- **Row locks (FOR UPDATE):** Block concurrent access to 1 row for ~milliseconds. Safe.
- **Shared utilities:** Reduce queries from N to 1. Always worth extracting.
- **Defense-in-depth:** Tiny overhead (one tenantId comparison). Always include.
- **REQUIRED_EXECUTOR_TOOLS validation:** Happens once at startup. Free after that.

---

## Further Reading

- Full details: `docs/solutions/BOOKING_LINKS_PHASE_0_FIXES_SUMMARY.md`
- ADR-013: Advisory locks pattern → `docs/adrs/ADR-013-advisory-locks.md`
- Multi-tenant guide → `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`

---

## TL;DR

**Do These 4 Things, Skip P1 Issues**

1. Include `tenantId` in ALL mutations
2. Add tools to `REQUIRED_EXECUTOR_TOOLS`
3. Extract shared utilities to `agent/utils/`
4. Lock check-then-act in transactions

That's it. These 4 patterns prevent 90% of bugs.
