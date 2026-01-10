# Code Review #708-717 Quick Reference

**Print this. Pin it. Use it.**

---

## 30-Second Decision Trees

### Is This a Check-Then-Act Pattern? (Issue #708)

```
Does code do: Check value → Make decision based on check → Perform operation?
    │
    ├─ YES & separate DB calls? → TOCTOU RACE! Use advisory lock + transaction
    │
    └─ NO → OK, check existing code pattern
```

### Is This a Type Assertion? (Issue #709)

```
Does code use "as SomeType" on runtime data (API, user input, agent response)?
    │
    ├─ YES → Need type guard BEFORE the cast
    │   Pattern: function hasXyz(data: unknown): data is SomeType { ... }
    │
    └─ NO → OK if casting compile-time types
```

### Should I Cache This? (Issue #710)

```
Do you think something is slow?
    │
    ├─ YES → STOP. Measure first. Profile with DevTools.
    │   - If validation is <20% of total latency → don't cache
    │   - If DB fetch is >50% → DB is bottleneck, not validation
    │
    └─ NO → Good instinct, keep code simple
```

### Component Looks Similar? (Issues #711, #712)

```
Does this component differ from similar one only in styling?
    │
    ├─ YES → DUPLICATE! Use variant prop pattern:
    │   - Extract styles to variantStyles object
    │   - Add variant?: 'default' | 'compact' prop
    │   - Use: const style = variantStyles[variant]
    │
    └─ NO → Check if logic differs
```

### Service Logic Duplication? (Issue #713)

```
Is this DB operation sequence in multiple public methods?
    │
    ├─ YES → EXTRACT! Create private method
    │   - Name: private async createDefaultSegmentAndPackages()
    │   - Called from all public paths
    │   - Single source of truth
    │
    └─ NO → OK, keep as-is
```

### Callback to List Item? (Issue #716)

```
Is callback passed to component in a list of 100+ items?
    │
    ├─ YES → Use useCallback: const handle = useCallback(...)
    │
    └─ NO → Inline function OK, keep simple
```

### Quota Check-Then-Increment? (Issue #717)

```
Are you checking limit then incrementing?
    │
    ├─ Hard enforcement (payments) → Use atomic increment
    │   Pattern: $transaction with advisory lock
    │
    └─ Advisory (logging) → Document and accept minor overage
```

### React Ref in JSX? (React 19 Fix)

```
Using ref in JSX and getting type error?
    │
    ├─ YES → Cast: useRef<T>(null) as React.RefObject<T>
    │
    └─ NO → Regular ref usage OK
```

---

## Pattern Library (Copy-Paste Ready)

### Advisory Lock + Transaction

```typescript
// Import at top
import { hashServiceDate } from '../lib/advisory-locks';

// Use in service
await this.prisma.$transaction(async (tx) => {
  const lockId = hashServiceDate(tenantId, serviceId, dateStr);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  // Check and act atomically
  const count = await tx.booking.count({
    where: {
      /* ... */
    },
  });
  if (count >= maxPerDay) throw new Error('Over limit');

  await tx.booking.create({
    data: {
      /* ... */
    },
  });
});
```

### Type Guard

```typescript
function hasUIAction(data: unknown): data is { uiAction: UIAction } {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!('uiAction' in obj)) return false;
  const action = obj.uiAction as Record<string, unknown>;
  return typeof action.type === 'string' && VALID_TYPES.includes(action.type);
}

// Usage
if (hasUIAction(result.data)) {
  onUIAction(result.data.uiAction); // ✅ Safe
}
```

### Variant Pattern

```typescript
export type ChatMessageVariant = 'default' | 'compact';

interface Props {
  variant?: ChatMessageVariant;
}

const variantStyles = {
  default: { container: 'p-4 rounded-2xl', text: 'text-base' },
  compact: { container: 'p-2 rounded-lg', text: 'text-sm' }
};

export function ChatMessage({ variant = 'default', ...props }: Props) {
  const style = variantStyles[variant];
  return <div className={style.container}>...</div>;
}
```

### Private Extraction

```typescript
private async createDefaultSegmentAndPackages(
  tx: PrismaTransactionClient,
  tenantId: string
): Promise<{ segment: Segment; packages: Package[] }> {
  // Shared logic here
  const segment = await tx.segment.create({ ... });
  const packages = await Promise.all([...]);
  return { segment, packages };
}

// Called from both public methods
async signupFlow(input) {
  return await prisma.$transaction(async (tx) => {
    const defaults = await this.createDefaultSegmentAndPackages(tx, tenantId);
  });
}
```

### React Ref Type Cast

```typescript
const messagesEndRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
```

---

## Severity Reminder

| Issue                   | Severity | Your Move                                    |
| ----------------------- | -------- | -------------------------------------------- |
| #708: TOCTOU Race       | **P1**   | FIX NOW. Blocks merge. Data corruption risk. |
| #709: Type Assertions   | **P2**   | FIX before release. Security validation.     |
| #710: Premature Cache   | **P2**   | FIX before release. Code quality.            |
| #711: MessageBubble Dup | **P2**   | FIX before release. Maintenance burden.      |
| #712: ProposalCard Dup  | **P2**   | FIX before release. Maintenance burden.      |
| #713: Service Dup       | **P2**   | FIX before release. Logic divergence risk.   |
| #714: XSS Patterns      | **P3**   | Defer. Low risk, defense-in-depth.           |
| #715: Unused Exports    | **P3**   | Defer. Code cleanup.                         |
| #716: Memoization       | **P3**   | Defer. Optimize if list > 100 items.         |
| #717: Quota Race        | **P3**   | Defer. Advisory only, very low risk.         |

---

## Questions to Ask in Code Review

**Check-then-act:**

- Are multiple DB operations based on first operation's result?
- Could another request modify data between operations?

**Type assertions:**

- Is this data from external source (API, user, agent)?
- Have I validated the structure before accessing properties?

**Caching:**

- Have I measured this is the bottleneck?
- What's the cache hit rate and stale data impact?

**Duplication:**

- Could a prop/variant eliminate this?
- What happens when logic needs to change in both?

**Service logic:**

- Is this DB sequence in multiple methods?
- Could changes cause them to diverge?

**Memoization:**

- List has 100+ items?
- Child components use React.memo?
- Profiling shows re-renders are slow?

---

## Testing Pattern

```typescript
test('should prevent TOCTOU race with advisory lock', async () => {
  const { tenantId, serviceId } = await createTestSetup();

  // Two concurrent requests racing to the same limit
  const [result1, result2] = await Promise.all([
    appointmentService.onAppointmentPaymentCompleted(tenantId, {
      serviceId,
      startTime: today,
      sessionId: 'session1',
    }),
    appointmentService.onAppointmentPaymentCompleted(tenantId, {
      serviceId,
      startTime: today,
      sessionId: 'session2',
    }),
  ]);

  // Only ONE can succeed (the other throws MaxBookingsPerDayExceededError)
  const results = [result1, result2].filter(Boolean);
  expect(results.length).toBe(1); // Exactly one succeeded
});
```

---

## File Locations

| Pattern            | File                                                 |
| ------------------ | ---------------------------------------------------- |
| Advisory locks     | `server/src/lib/advisory-locks.ts`                   |
| Error definitions  | `server/src/lib/errors.ts`                           |
| Chat component     | `apps/web/src/components/chat/ChatMessage.tsx`       |
| Proposal card      | `apps/web/src/components/chat/ProposalCard.tsx`      |
| Service extraction | `server/src/services/tenant-provisioning.service.ts` |

---

## One More Thing

**The Meta-Pattern:** When code review finds the same issue multiple times (#711, #712 both duplication), that's a PATTERN to prevent. This document captures that pattern so the next time you see similar code, you'll recognize it immediately.

**When you fix one instance:** Check for similar issues elsewhere. Often they come in clusters.
