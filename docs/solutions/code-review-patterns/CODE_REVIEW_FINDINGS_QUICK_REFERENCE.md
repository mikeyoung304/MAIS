---
title: 'Code Review Findings Quick Reference - P1/P2/P3 Fixes'
category: code-review-patterns
tags:
  - quick-reference
  - toctou-prevention
  - type-safety
  - component-patterns
---

# Code Review Findings Quick Reference

**Print & Pin This** | **Commit:** `02cde7e8` | **Status:** 6 of 10 findings resolved

---

## P1 CRITICAL: maxPerDay TOCTOU Fix (#708)

### Before ❌

```typescript
const count = await booking.count({ where: { serviceId, date } });
if (count >= maxPerDay) throw Error();
await booking.create({ ... }); // ❌ RACE - other thread can create between count and create
```

### After ✅

```typescript
import { hashServiceDate } from '../lib/advisory-locks';

await prisma.$transaction(async (tx) => {
  const lockId = hashServiceDate(tenantId, serviceId, dateString);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  const count = await tx.booking.count({ where: { serviceId, date } });
  if (count >= maxPerDay) throw Error();
  await tx.booking.create({ ... }); // ✅ SAFE - lock serializes all threads
});
```

### When to Use

- ✅ Bounded resource limits (maxPerDay, maxPerMonth, balance limits)
- ✅ Date-based uniqueness checks
- ✗ Don't use for high-frequency operations (hash overhead)

---

## P2: Type Guard Safety (#709)

### Before ❌

```typescript
const action = message.uiAction as UIAction; // ❌ UNSAFE - no validation
if (action.type === 'publish') { ... }        // ❌ CRASH if uiAction is malformed
```

### After ✅

```typescript
import { hasUIAction } from '@/agent/tools/utils';

if (message.uiAction && hasUIAction(message.uiAction)) {
  const action = message.uiAction; // ✅ SAFE - runtime validated
  if (action.type === 'publish') { ... }
}
```

### Pattern

```typescript
// In utils.ts
export function hasUIAction(uiAction: any): uiAction is UIAction {
  return (
    uiAction?.type &&
    ['publish_draft', 'discard_draft', 'get_draft'].includes(uiAction.type) &&
    typeof uiAction.params === 'object'
  );
}
```

---

## P2: Component Deduplication (#711, #712)

### Extract Shared Component

```typescript
// ❌ BEFORE: Same logic in AgentChat.tsx + PanelAgentChat.tsx (170 lines × 2)

// ✅ AFTER: Single shared ChatMessage.tsx
export interface ChatMessageProps {
  message: ChatMessageType;
  variant?: 'default' | 'compact'; // ← Key: variant prop for styling
  onConfirmProposal?: (id: string) => void;
}

export function ChatMessage({ message, variant = 'default', ... }: ChatMessageProps) {
  const styles = variantStyles[variant];
  return (
    <div className={styles.container}>
      <div className={styles.bubble}>
        {message.content}
      </div>
    </div>
  );
}
```

### Usage Pattern

```typescript
// AgentChat.tsx - full variant
<ChatMessage message={msg} variant="default" showTimestamp />

// PanelAgentChat.tsx - compact variant
<ChatMessage message={msg} variant="compact" />
```

### Benefits

- ✅ Single source of truth
- ✅ Consistent styling
- ✅ Easier maintenance

---

## P2: Centralized Defaults (#713)

### Extract to Service

```typescript
// ❌ BEFORE: Duplicated in 3+ places
// admin-routes.ts
await db.segment.create({ name: 'General', ... });
await db.package.createMany([...]);

// signup-routes.ts
await db.segment.create({ name: 'General', ... }); // DUPLICATE
await db.package.createMany([...]);                // DUPLICATE

// ✅ AFTER: Single method in TenantProvisioningService
private async createDefaultSegmentAndPackages(
  tx: PrismaTransactionClient,
  tenantId: string
): Promise<{ segment: Segment; packages: Package[] }> {
  const segment = await tx.segment.create({
    data: {
      tenantId,
      slug: DEFAULT_SEGMENT.slug,
      name: DEFAULT_SEGMENT.name,
    },
  });

  const packages = await Promise.all(
    Object.values(DEFAULT_PACKAGE_TIERS).map((tier) =>
      tx.package.create({
        data: {
          tenantId,
          segmentId: segment.id,
          slug: tier.slug,
          name: tier.name,
        },
      })
    )
  );

  return { segment, packages };
}
```

### Usage

```typescript
// Both paths reuse same method
async createAdminTenant(input) {
  return this.prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ ... });
    const { segment, packages } = await this.createDefaultSegmentAndPackages(tx, tenant.id);
    return { tenant, segment, packages };
  });
}

async createSignupTenant(input) {
  return this.prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ ... });
    const { segment, packages } = await this.createDefaultSegmentAndPackages(tx, tenant.id);
    return { tenant, segment, packages };
  });
}
```

---

## Advisory Lock Patterns (Reusable)

### Booking Limits

```typescript
import { hashServiceDate } from '../lib/advisory-locks';

// Lock: service + date
const lockId = hashServiceDate(tenantId, serviceId, '2025-06-15');
```

### Balance Payments

```typescript
import { hashTenantBooking } from '../lib/advisory-locks';

// Lock: specific booking (P1-147 fix)
const lockId = hashTenantBooking(tenantId, bookingId);
```

### Storefront Edits

```typescript
import { hashTenantStorefront } from '../lib/advisory-locks';

// Lock: tenant-wide (P1-659 fix)
const lockId = hashTenantStorefront(tenantId);
```

### Dates

```typescript
import { hashTenantDate } from '../lib/advisory-locks';

// Lock: tenant + date
const lockId = hashTenantDate(tenantId, '2025-06-15');
```

---

## Decision Tree: When to Extract

```
Is code duplicated in 2+ places?
├─ YES → Extract to shared module
│  ├─ Component? → Use variant pattern
│  ├─ Service logic? → Use private method
│  └─ Constants? → Use DEFAULT_* exports
└─ NO → Keep local
```

---

## Decision Tree: Type Guard vs Cast

```
Need to access property on unknown object?
├─ YES → Always use type guard
│  │ export function hasX(value: any): value is X {
│  │   return value?.requiredProp !== undefined;
│  │ }
│  └─ if (hasX(value)) { /* value is X */ }
└─ NO → Use cast sparingly (library limitations only)
   └ Document why cast is necessary
```

---

## Testing Checklist

- [ ] New shared component tested with `variant` prop
- [ ] Advisory lock tests verify serialization on concurrent calls
- [ ] Type guard tests verify runtime validation
- [ ] Tenant provisioning tests verify single source of truth
- [ ] No tests broken by refactoring

---

## Files to Know

| File                                                 | Purpose                         |
| ---------------------------------------------------- | ------------------------------- |
| `server/src/lib/advisory-locks.ts`                   | Lock ID utilities (reusable)    |
| `server/src/agent/tools/utils.ts`                    | Type guards (hasUIAction, etc.) |
| `apps/web/src/components/chat/ChatMessage.tsx`       | Shared message bubble component |
| `apps/web/src/components/chat/ProposalCard.tsx`      | Shared proposal card component  |
| `server/src/services/tenant-provisioning.service.ts` | Centralized tenant defaults     |

---

## Prevention: Multi-Agent Code Review

**How to catch these issues systematically:**

```bash
# Run full multi-agent review
/workflows:review PR_NUMBER

# Results: Specialized agents find non-overlapping issues
# - data-integrity-guardian → TOCTOU races
# - kieran-typescript-reviewer → Type safety
# - code-simplicity-reviewer → Duplication
# - architecture-strategist → Service design
```

See [MULTI_AGENT_CODE_REVIEW_PREVENTION_STRATEGIES.md](./MULTI_AGENT_CODE_REVIEW_PREVENTION_STRATEGIES.md) for full details.

---

## Next Steps

- [ ] Run `/workflows:review` on all PRs >300 lines
- [ ] Schedule P3 deferred findings (#714-717) for next sprint
- [ ] Add `hasUIAction()` pattern to type guard examples
- [ ] Document advisory lock patterns in architecture guide

---

## Related Docs

- [CODE_REVIEW_FINDINGS_RESOLUTION_P1P2P3_20260109.md](./CODE_REVIEW_FINDINGS_RESOLUTION_P1P2P3_20260109.md) - Full details
- [MULTI_AGENT_CODE_REVIEW_PREVENTION_STRATEGIES.md](./MULTI_AGENT_CODE_REVIEW_PREVENTION_STRATEGIES.md) - Review framework
- [atomic-tenant-provisioning-defense-in-depth](./atomic-tenant-provisioning-defense-in-depth-MAIS-20260105.md) - Provisioning patterns
