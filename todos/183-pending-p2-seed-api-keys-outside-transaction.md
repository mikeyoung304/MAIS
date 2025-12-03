---
status: pending
priority: p2
issue_id: "183"
tags: [code-review, data-integrity, seeds]
dependencies: []
---

# Seed API Keys Generated Outside Transaction

## Problem Statement

API keys for demo tenant are generated **outside** the transaction, but used **inside** the transaction. If the transaction fails after key generation but before commit:
1. Keys are generated and potentially logged
2. Transaction rolls back, keys are lost
3. Re-running seed creates new keys (confusing)

## Findings

**Location:** `server/prisma/seeds/demo.ts:24-42` (key generation) and `demo.ts:176` (transaction)

**Current Flow:**
```typescript
// Outside transaction - keys generated here
if (!existingTenant) {
  publicKey = `pk_live_${DEMO_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
  secretKey = `sk_live_${DEMO_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
}

// Inside transaction - keys used here
await prisma.$transaction(async (tx) => {
  const tenant = await createOrUpdateTenant(tx, {
    apiKeyPublic: publicKey,
    apiKeySecret: secretKey ?? undefined,
  });
  // ... if this fails, keys are wasted
}, { timeout: 60000 });

// Keys logged after transaction
logger.warn(`Secret Key: ${secretKey}`);
```

**Risk Assessment:**
- Impact: Medium (API key generation wasted, keys logged but not stored)
- Likelihood: Low (transaction failures are rare in seed operations)

## Proposed Solutions

### Solution 1: Move key generation inside transaction (Recommended)
- Generate keys inside transaction callback
- Only log keys after transaction commits successfully
- **Pros:** Atomic key generation, no wasted keys
- **Cons:** Slightly more complex code
- **Effort:** Small (15 minutes)
- **Risk:** Low

### Solution 2: Add explicit error handling
- Wrap transaction in try-catch
- Log warning if transaction fails after key generation
- **Pros:** Maintains current structure
- **Cons:** Keys still wasted on failure
- **Effort:** Small (10 minutes)
- **Risk:** Low

## Recommended Action

Implement **Solution 1** for clean atomic key generation.

## Technical Details

**Affected Files:**
- `server/prisma/seeds/demo.ts`

**Proposed Change:**
```typescript
let secretKey: string | null = null;

await prisma.$transaction(async (tx) => {
  // Generate keys inside transaction
  let generatedSecretKey: string | undefined;
  if (!existingTenant) {
    generatedSecretKey = `sk_live_${DEMO_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
  }

  const tenant = await createOrUpdateTenant(tx, {
    apiKeyPublic: existingTenant?.apiKeyPublic ?? `pk_live_${DEMO_SLUG}_${crypto.randomBytes(8).toString('hex')}`,
    apiKeySecret: generatedSecretKey,
  });

  secretKey = generatedSecretKey ?? null;
}, { timeout: 60000 });

// Log keys only after successful commit
if (secretKey) {
  logger.warn(`Secret Key: ${secretKey}`);
}
```

## Acceptance Criteria

- [ ] API key generation moved inside transaction
- [ ] Keys only logged after successful commit
- [ ] No TypeScript errors
- [ ] Seed tests still pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-03 | Created | Found during code review of commit 45024e6 |

## Resources

- Commit: 45024e6 (introduced seed transaction wrapping)
- Related: TODO-178 (completed - added transaction wrapping)
