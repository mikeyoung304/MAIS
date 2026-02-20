---
status: pending
priority: p1
issue_id: '11037'
tags: [code-review, google-calendar, stripe, data-integrity, data-loss]
---

# Stripe Disconnect Silently Deletes Calendar Secrets

## Problem Statement

When a tenant disconnects their Stripe account, the `deleteConnectedAccount` method sets `secrets: {}` — overwriting the ENTIRE secrets JSON blob, including the tenant's Google Calendar service account credentials. A tenant who disconnects Stripe loses their Google Calendar integration silently.

## Findings

- **Flagged by:** security-sentinel
- `server/src/services/stripe-connect.service.ts` line ~354: `secrets: {}`
- Fix: only clear `secrets.stripe`; preserve all other secret keys

## Proposed Solutions

### Option A: Surgical Secret Deletion (15 min)

```typescript
// Instead of: secrets: {}
// Use: Prisma JSON path update or fetch-then-patch
const existing = tenant.secrets as TenantSecrets;
const { stripe: _, ...remaining } = existing;
await prisma.tenant.update({ where: { id: tenantId }, data: { secrets: remaining } });
```

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Disconnecting Stripe does NOT clear `secrets.calendar`
- [ ] Test: configure calendar → disconnect Stripe → calendar still configured
- [ ] All other secret keys preserved on Stripe disconnect

## Work Log

- 2026-02-20: Flagged by security-sentinel. Data loss bug — surgical fix required.
