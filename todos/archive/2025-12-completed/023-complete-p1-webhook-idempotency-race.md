---
status: complete
priority: p1
issue_id: '023'
tags: [code-review, security, webhooks, data-integrity]
dependencies: []
---

# Webhook Idempotency Race Condition with tenantId="unknown"

## Problem Statement

Webhook processing extracts tenantId BEFORE validation, defaulting to "unknown" if extraction fails. This creates a single bucket where all failed-extraction webhooks share idempotency checks, potentially causing legitimate webhooks from different tenants to be marked as duplicates.

**Why this matters:** Cross-tenant webhook hijacking can cause booking data loss when legitimate webhooks are rejected as duplicates.

## Findings

### Code Evidence

**Location:** `server/src/routes/webhooks.routes.ts:128-138`

```typescript
// Line 128: tenantId defaults to "unknown"
const tenantId = tempSession?.metadata?.tenantId || 'unknown';

// Line 138: Idempotency check uses potentially "unknown" tenantId
const isDupe = await this.webhookRepo.isDuplicate(tenantId, event.id);
```

### Attack Vector

1. Webhook 1 arrives with invalid/missing metadata, tenantId="unknown"
2. Webhook 2 arrives with VALID metadata but same Stripe event.id
3. Webhook 2 is checked against "unknown" bucket
4. Webhook 2 marked as duplicate → legitimate booking never created
5. Customer paid but booking not recorded

### Severity

- **Cross-tenant data loss** via webhook collision
- Stripe event IDs are unique but tenantId extraction order matters
- Silent failure - no error logged for "duplicate" webhook

## Proposed Solutions

### Option A: Fail Fast on Missing TenantId (Recommended)

**Effort:** Small | **Risk:** Low

```typescript
// Only check idempotency AFTER validating metadata
if (!tempSession?.metadata?.tenantId) {
  logger.error({ eventId: event.id }, 'Missing tenantId in webhook metadata');
  throw new WebhookValidationError('Missing tenantId in webhook metadata');
}
const tenantId = tempSession.metadata.tenantId;
const isDupe = await this.webhookRepo.isDuplicate(tenantId, event.id);
```

**Pros:**

- Eliminates "unknown" bucket entirely
- Forces proper error handling for malformed webhooks
- Stripe will retry webhook automatically

**Cons:**

- Webhooks with missing metadata will fail (correct behavior)

### Option B: Use Event ID as Primary Key (Alternative)

**Effort:** Medium | **Risk:** Medium

Change idempotency to use Stripe event.id globally (it's already unique):

```typescript
const isDupe = await this.webhookRepo.isDuplicateByEventId(event.id);
```

**Pros:**

- Stripe event IDs are globally unique
- Simpler idempotency logic

**Cons:**

- Loses tenant-scoped idempotency for auditing
- Changes database schema

## Recommended Action

Implement **Option A** - Fail fast if tenantId cannot be extracted.

## Technical Details

**Files to Update:**

- `server/src/routes/webhooks.routes.ts:126-140`

**Changes:**

1. Move tenantId extraction validation before idempotency check
2. Log error with event details for debugging
3. Return 400 instead of silently accepting with "unknown"

## Acceptance Criteria

- [ ] No webhook processed with tenantId="unknown"
- [ ] Missing tenantId logs error and returns 400
- [ ] Stripe retries webhooks that fail validation
- [ ] Idempotency check only runs after tenantId validated
- [ ] Test: Two webhooks with same event.id but different tenants both processed

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2025-11-27 | Created | Found during comprehensive code review |

## Resources

- Data Integrity Guardian analysis
- Webhook idempotency ADR in DECISIONS.md
- Stripe webhook best practices
