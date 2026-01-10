# Code Review Resolution Quick Reference

**Commit:** `02cde7e8` (January 9, 2026) | **Fixed:** 10 findings | **Status:** P1+P2 complete

## 6 Working Patterns (Copy-Paste Ready)

### Pattern 1: TOCTOU Prevention with Advisory Lock

**Problem:** Check-then-act race condition on concurrent writes
**Solution:** Transaction + deterministic lock ID + `pg_advisory_xact_lock()`

```typescript
// File: server/src/lib/advisory-locks.ts
export function hashServiceDate(tenantId: string, serviceId: string, date: string): number {
  const str = `${tenantId}:service:${serviceId}:${date}`;
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}

// File: service file
const dateStr = date.toISOString().split('T')[0];
await this.prisma.$transaction(async (tx) => {
  const lockId = hashServiceDate(tenantId, serviceId, dateStr);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  // Now safe: check and create are atomic
  const count = await tx.booking.count({ where: { tenantId, ... } });
  if (count >= maxPerDay) throw new Error('...');
  await tx.booking.create({ data: { ... } });
});
```

**When to Use:** Any check-then-act pattern (booking limits, balance updates, duplicate prevention)

---

### Pattern 2: Type Guard for Runtime Validation

**Problem:** Unsafe `as Type` cast doesn't validate at runtime
**Solution:** Discriminating function that checks structure + enums

```typescript
// Type-safe guard function
function hasUIAction(data: unknown): data is { uiAction: AgentUIAction } {
  if (typeof data !== 'object' || data === null) return false;

  const obj = data as Record<string, unknown>;
  if (!('uiAction' in obj) || typeof obj.uiAction !== 'object' || !obj.uiAction) {
    return false;
  }

  const action = obj.uiAction as Record<string, unknown>;
  const validTypes = ['SHOW_PREVIEW', 'SHOW_DASHBOARD', 'HIGHLIGHT_SECTION', 'NAVIGATE'];
  return typeof action.type === 'string' && validTypes.includes(action.type);
}

// Usage: Conditional checks type and narrows
if (hasUIAction(result.data)) {
  // TypeScript knows result.data.uiAction is AgentUIAction
  dispatch(result.data.uiAction);
}
```

**When to Use:** Data from APIs, webhooks, user input, tool results. Not needed for internal data.

---

### Pattern 3: Variant-Based Component Styling

**Problem:** Same component, multiple layouts (full vs compact, dark vs light)
**Solution:** Single component + `variant` prop + style map object

```typescript
// components/chat/ChatMessage.tsx
export type ChatMessageVariant = 'default' | 'compact';

const variantStyles = {
  default: {
    container: 'gap-3',
    avatar: 'w-8 h-8 rounded-full',
    bubble: 'rounded-2xl px-4 py-3 shadow-sm',
  },
  compact: {
    container: 'gap-2',
    avatar: 'w-6 h-6 rounded-lg',
    bubble: 'rounded-lg px-3 py-2',
  },
} as const;

export function ChatMessage({ message, variant = 'default' }: Props) {
  const styles = variantStyles[variant];
  return <div className={cn('flex', styles.container)}>{/* ... */}</div>;
}
```

**When to Use:** Extracting duplicated component styling, adapting to different containers (panel vs page, mobile vs desktop)

---

### Pattern 4: Private Utility Method for DRY Logic

**Problem:** Same business logic in multiple public methods
**Solution:** Extract to `private` utility, call from all paths

```typescript
export class TenantProvisioningService {
  // Private utility - single source of truth
  private async createDefaultSegmentAndPackages(
    tx: PrismaTransactionClient,
    tenantId: string
  ): Promise<{ segment: Segment; packages: Package[] }> {
    const segment = await tx.segment.create({ data: { ... } });
    const packages = await Promise.all([/* create 3 packages */]);
    return { segment, packages };
  }

  // Public methods reuse the private utility
  async createAdminTenant(input: AdminCreateTenantInput): Promise<ProvisionedTenantResult> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { ... } });
      const { segment, packages } = await this.createDefaultSegmentAndPackages(tx, tenant.id);
      return { tenant, segment, packages };
    });
  }

  async createSignupTenant(input: SignupCreateTenantInput): Promise<ProvisionedTenantResult> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { ... } });
      const { segment, packages } = await this.createDefaultSegmentAndPackages(tx, tenant.id);
      return { tenant, segment, packages };
    });
  }
}
```

**When to Use:** Same logic in 2+ methods, complex initialization, multi-step operations

---

### Pattern 5: Accept Documented Trade-offs

**Problem:** Optimization gains 5% but adds 4 hours of work + complexity
**Solution:** Document decision, move on

```typescript
// NOTE: Zod validation overhead (5-30ms) is negligible vs database latency (50-200ms).
// Removal would improve latency <5% at cost of runtime type safety.
// Decision: Keep validation for correctness, accept latency.
```

**Rule of Thumb:**

- **Optimize if:** effort ≤ 1 hour OR latency improvement ≥ 20%
- **Document if:** effort > 4 hours AND latency improvement < 5%
- **Assess if:** effort 1-4 hours AND latency improvement 5-20%

---

### Pattern 6: React Ref Type Compatibility (React 18/19)

**Problem:** `useRef()` type is mutable but JSX expects readonly RefObject
**Solution:** Cast to `React.RefObject<T>` to satisfy JSX type checker

```typescript
const scrollRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

useEffect(() => {
  if (scrollRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }
}, [messages]);

return <div ref={scrollRef} />;
```

**Why it works:** Promise to TypeScript that ref won't be reassigned. Runtime behavior unchanged.

---

## Decision Trees

### When to Use `as Type` vs Type Guard

```
Data from external source (API, user, webhook)?
  YES → Use type guard (validate structure + enums)
  NO  → Internal data? Use `as Type`

Is the type simple (string | number)?
  YES → Type guard overkill, use `as Type`
  NO  → Complex object? Use type guard
```

### When to Extract a Component

```
Same styling/markup appears in 2+ files?
  YES → Extract to shared component

Will the component vary by context?
  YES → Add `variant` prop + styles map
  NO  → Simple extraction is fine
```

### When to Extract a Service Method

```
Same business logic in 2+ methods?
  YES → Extract to private utility

Does it touch the database?
  YES → Accept transaction client as parameter
  NO  → Can be pure function
```

---

## Files Changed (Reference)

| File                                                 | Change          | Lines         |
| ---------------------------------------------------- | --------------- | ------------- |
| `server/src/lib/advisory-locks.ts`                   | NEW             | 128           |
| `server/src/services/appointment-booking.service.ts` | MODIFIED        | +67           |
| `apps/web/src/components/agent/PanelAgentChat.tsx`   | MODIFIED        | -85           |
| `apps/web/src/components/chat/ChatMessage.tsx`       | NEW (extracted) | 171           |
| `apps/web/src/components/chat/ProposalCard.tsx`      | NEW (extracted) | 109           |
| `server/src/services/tenant-provisioning.service.ts` | MODIFIED        | +35           |
| `apps/web/src/hooks/useAgentChat.ts`                 | MODIFIED        | +1 (cast fix) |

---

## Verification Checklist

After implementing any pattern:

- [ ] Run `npm run typecheck` - no type errors
- [ ] Run `npm test -- --grep "pattern-name"` - related tests pass
- [ ] Run `npm run lint` - no ESLint warnings
- [ ] Manual testing - feature works as expected
- [ ] Verify multi-tenant isolation - queries include `tenantId`
- [ ] Check transaction boundaries - all ops atomic
- [ ] Review error messages - user-friendly and helpful

---

## 2-Minute Application Guide

1. **Identify the pattern:** Which of the 6 apply to your code?
2. **Copy the template:** Grab the code example above
3. **Customize for your context:** Replace entity/field names
4. **Run tests:** Verify no regressions
5. **Document trade-offs:** If optimization deferred, leave comment

---

**See also:** `docs/solutions/code-review-patterns/CODE_REVIEW_RESOLUTION_P1_P2_FIXES_MAIS_20260109.md` for full explanations
