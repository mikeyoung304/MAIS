# 11006 — Move existingTenant Read Inside Transaction

**Status:** complete
**Priority:** P2
**Created:** 2026-02-17
**Source:** code-review (data-integrity-guardian P2-2)

## Problem

`server/prisma/seeds/little-bit-horse-farm.ts` reads `existingTenant` outside the transaction (line 194), then uses the result inside the transaction (line 214) to decide whether to generate new API keys.

```typescript
// Line 194 — OUTSIDE transaction
const existingTenant = await prisma.tenant.findUnique({
  where: { slug: TENANT_SLUG },
});

// Line 208 — INSIDE transaction
await prisma.$transaction(async (tx) => {
  if (existingTenant) {
    publicKey = existingTenant.apiKeyPublic; // stale read
  } else {
    publicKey = `pk_live_${TENANT_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
  }
});
```

If two seed runs execute concurrently, both read `null`, both generate new keys, one wins and the other gets a unique constraint violation. More practically, if the tenant is created between the read and the transaction start, the seed generates new keys instead of reusing.

Unlikely in practice (seeds run in CI, not concurrently), but structurally unsafe.

## Proposed Solution

Move the read inside the transaction:

```typescript
await prisma.$transaction(async (tx) => {
  const existingTenant = await tx.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  // ... rest of key logic
});
```

Remove the outer `existingTenant` variable and `publicKeyForLogging`/`secretKeyForLogging` capture pattern. Log keys inside the transaction callback instead.

**Effort:** Small

## Acceptance Criteria

- [ ] `findUnique` call moved inside `$transaction`
- [ ] No reads of tenant outside transaction scope
- [ ] API key preservation logic unchanged
- [ ] Tests pass (update mock if needed)

## Work Log

- 2026-02-17: Created from code review.
- 2026-02-18: Fixed. existingTenant read moved inside $transaction. Post-transaction logging now uses secretKeyForLogging instead of existingTenant. Archived with PR fix/deploy-pipeline-reliability.
