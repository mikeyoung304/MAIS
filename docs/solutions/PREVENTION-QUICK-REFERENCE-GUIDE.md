# Prevention Strategies: 30-Second Quick Reference

**Print this and pin it next to your monitor!**

---

## P1: Race Conditions (Bookings)

```typescript
// ALWAYS do this:
await prisma.$transaction(async (tx) => {
  const lockId = hashTenantDate(tenantId, date);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;  // FIRST

  const existing = await tx.booking.findFirst({...});             // THEN check
  if (existing) throw new BookingConflictError(...);

  return await tx.booking.create({...});                           // THEN create
});
```

**Key:** Lock ID must be deterministic (same date = same lock)

---

## P1: Trust Tier Escalation

```typescript
// Base assignment:
const trustTier = 'T1'; // No confirmation needed
const trustTier = 'T2'; // Soft confirmation (default for updates)
const trustTier = 'T3'; // Hard confirmation (cancellations, deletes, financial)

// Dynamic escalation:
if (status === 'CANCELED') trustTier = 'T3';
if (isSignificantPriceChange(old, new)) trustTier = 'T3';
if (hasBookings) trustTier = 'T3';
```

**Key:** Escalate based on risk factors (data loss, financial impact, customer impact)

---

## P1: Availability Check Inside Lock

```typescript
// WRONG: Check outside transaction
const available = await checkAvailability(tenantId, date);
if (!available) throw new Error(...);
const booking = await create(...); // Race condition!

// RIGHT: Check inside lock
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(...)`;
  const existing = await tx.booking.findFirst({...}); // Inside lock
  if (existing) throw new BookingConflictError(...);
  return await tx.booking.create({...});
});
```

**Key:** Lock + check + create must be atomic

---

## P1: Booking Check Before Deletion

```typescript
const addon = await prisma.addOn.findFirst({
  where: { id, tenantId },
  include: { _count: { select: { bookingRefs: true } } },
});

const hasBookings = addon._count.bookingRefs > 0;
const trustTier = hasBookings ? 'T3' : 'T2';
```

**Key:** Count references before soft-delete, escalate if found

---

## P2: Prompt Injection Detection

```typescript
export const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(your\s+)?instructions/i,
  /you are now\s+(a|an|my|the)/i,
  /\[system\]/i,
  // ... 47+ more patterns
];

// ALWAYS sanitize user input before context injection:
const name = sanitizeForContext(user.name, 50);
//                              ^ prefix with tenant
const notes = sanitizeForContext(booking.notes, 500);
```

**Key:** Specific patterns (avoid single-word matches), normalize Unicode first

---

## P3: Unicode Normalization

```typescript
export function sanitizeForContext(text: string, maxLength = 100): string {
  // Step 1: Normalize Unicode lookalikes
  let result = text.normalize('NFKC');

  // Step 2: Check against injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, '[FILTERED]');
  }

  // Step 3: Truncate
  return result.slice(0, maxLength);
}
```

**Key:** NFKC normalizes compatibility characters (e.g., Cyrillic 'а' → Latin 'a')

---

## P2: Error Codes + Specific Messages

```typescript
catch (error) {
  if (error instanceof BookingConflictError) {
    return {
      status: 409,
      body: {
        message: 'This date is no longer available',  // Generic (safe)
        code: 'BOOKING_CONFLICT',                     // Specific (actionable)
        timestamp: new Date().toISOString()
      }
    };
  }
}
```

**Key:** Message is generic, code is specific for client handling

---

## P2: Field Mapping Consistency

```typescript
// Use canonical names (contract):
customerName  ✅  (not: customer_name, coupleName, name)
customerEmail ✅  (not: customer_email, email, contactEmail)
packageName   ✅  (not: package_name, packageTitle, title)

// Map consistently in all services:
booking.customerName = row.customer_name;  // DB → Contract
sanitizeForContext(b.customerName, 50);    // Contract → Agent
```

**Key:** Define canonical names in contracts, map consistently everywhere

---

## Testing Checklist

- [ ] Race condition: 50 concurrent requests, 1 succeeds, 49 fail
- [ ] Trust tier: Escalates based on conditions (has bookings, significant price change, cancellation)
- [ ] Availability: Check happens inside advisory lock transaction
- [ ] Booking check: Add-on has bookings, escalates to T3
- [ ] Injection detection: Filters injection patterns, preserves legitimate text
- [ ] Unicode: Normalizes lookalikes before pattern matching
- [ ] Error codes: Returns correct code for each error scenario
- [ ] Field mapping: Consistent names across all services

---

## Anti-Patterns (What NOT to Do)

```typescript
// ❌ NO advisory lock
await db.booking.create({...});

// ❌ Lock AFTER check
const existing = await db.booking.findFirst({...});
await tx.$executeRaw`SELECT pg_advisory_xact_lock(...)`;  // Too late!

// ❌ Non-deterministic lock ID
const lockId = Math.random() * 2147483647;

// ❌ Session-scoped lock (persists across transactions)
await tx.$executeRaw`SELECT pg_advisory_lock(...)`;

// ❌ Pattern matching without normalization
if (/system:/i.test(text)) { ... }  // Won't match Cyrillic 's'

// ❌ Single-word injection patterns
/ignore/i  // Matches "ignore the details"

// ❌ Check availability before lock
const available = await checkAvailability(tenantId, date);
if (!available) throw new Error(...);
await create(...);  // Race condition!

// ❌ Delete without checking references
await db.addon.delete({...});  // What about bookings?

// ❌ Generic error (no code)
return { status: 400, body: { error: 'Something went wrong' } };
```

---

## File Locations

| Strategy           | File                                               | Lines               |
| ------------------ | -------------------------------------------------- | ------------------- |
| Advisory Locks     | `server/src/adapters/prisma/booking.repository.ts` | 14-160              |
| Trust Tiers        | `server/src/agent/tools/types.ts`                  | 77-95               |
| Injection Patterns | `server/src/agent/tools/types.ts`                  | 106-154             |
| Sanitization       | `server/src/agent/tools/types.ts`                  | 175-182             |
| Booking Check      | `server/src/agent/tools/write-tools.ts`            | 294-352             |
| Error Codes        | `server/src/lib/errors.ts`                         | (all domain errors) |
| Dynamic Tier       | `server/src/agent/tools/write-tools.ts`            | 1140-1178           |

---

## Decision Tree: What Tier for My Operation?

```
Is it a cancellation or refund?
  └─ YES → T3 (hard confirm)
  └─ NO  → Is it a delete with existing bookings?
           └─ YES → T3 (hard confirm)
           └─ NO  → Is there a significant price change (>20% or >$100)?
                    └─ YES → T3 (hard confirm)
                    └─ NO  → Is it a read operation?
                             └─ YES → T1 (auto-confirm)
                             └─ NO  → T2 (soft confirm, default for updates)
```

---

**Last Updated:** December 26, 2025
**Print and Pin:** Reference this during code review and implementation!
