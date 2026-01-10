---
status: pending
priority: p3
issue_id: '717'
tags: [code-review, data-integrity, quota]
dependencies: []
---

# Minor Quota Over-Count Possible Under High Concurrency

## Problem Statement

The AI quota check in `AdminOrchestrator` checks quota BEFORE processing and increments AFTER success. Under extreme concurrency, multiple requests could pass the check simultaneously before any increment occurs.

## Evidence

From `server/src/agent/orchestrator/admin-orchestrator.ts`:

```typescript
async chat(message: string): Promise<ChatResponse> {
  // 1. Check quota
  const { tier, aiMessagesUsed } = await this.prisma.tenant.findUnique(...);
  if (isOverQuota(tier, aiMessagesUsed)) {
    return { message: "quota exceeded" };
  }

  // 2. Process (takes time)
  const response = await super.chat(message);

  // 3. Increment
  await this.prisma.tenant.update({
    data: { aiMessagesUsed: { increment: 1 } }
  });
}
```

## Race Scenario

```
Time    Request A              Request B
----    ---------              ---------
T1      check: 49/50 ✓
T2                             check: 49/50 ✓
T3      process...
T4                             process...
T5      increment: now 50
T6                             increment: now 51 ❌
```

## Impact Assessment

**Very Low Risk**:

- Requires exact timing (both requests within processing window)
- FREE tier = 50 msgs/month, so 51 is minor overage
- Usage is for billing guidance, not hard enforcement
- Stripe handles actual payment limits

## Recommendation

**Accept as-is** for now. If strict enforcement needed later:

```typescript
// Use atomic check-and-increment
await this.prisma.$transaction(async (tx) => {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
  if (isOverQuota(tenant.tier, tenant.aiMessagesUsed)) {
    throw new QuotaExceededError();
  }
  await tx.tenant.update({
    where: { id: tenantId },
    data: { aiMessagesUsed: { increment: 1 } },
  });
});
// Then process after transaction commits
```

## Acceptance Criteria

- [ ] Document accepted behavior
- [ ] Consider atomic increment if stricter enforcement needed

## Resources

- Data Integrity Guardian: agent a03348f
- Related: Issue #696 (added quota check)
