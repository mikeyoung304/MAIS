---
issue_id: 11048
status: pending
priority: p2
tags: [security, audit, google-calendar, stripe]
effort: Small
---

# P2: Missing Audit Trail on Integration Credential Changes

## Problem Statement

Changes to integration credentials — calendar config saved or deleted, Stripe Connect connected or disconnected — are not logged to any audit trail. If a credential is accidentally deleted or a tenant's integration is disrupted, there is no record of when the change occurred or which admin user triggered it. This is a security and operational gap.

## Findings

- Integration credential mutations include:
  - Google Calendar: save config, delete config
  - Stripe Connect: create account, disconnect account
- None of these operations emit structured audit log entries.
- Without an audit trail, support cannot determine if a disruption was caused by a user action or a system bug.
- The `logger` utility is already available for structured logging; this is not a new infrastructure requirement.

## Proposed Solutions

Add structured audit log entries at the service layer for each credential mutation. Use `logger.info` with a consistent schema:

```typescript
logger.info({
  event: 'integration.credential.saved',
  tenantId,
  integration: 'google-calendar',
  actor: userId, // from auth context
  timestamp: new Date().toISOString(),
});
```

Events to cover:

- `integration.credential.saved` (calendar)
- `integration.credential.deleted` (calendar)
- `integration.stripe.connected`
- `integration.stripe.disconnected`

## Acceptance Criteria

- [ ] All 4 credential mutation events emit a structured `logger.info` entry.
- [ ] Each log entry includes `tenantId`, `integration`, `event`, and `actor` (userId).
- [ ] Logs are emitted at the service layer, not the route layer.
- [ ] No sensitive credential values (private keys, tokens) appear in log output.
- [ ] Tests verify log emission (spy on logger) for each mutation path.

## Work Log

_(empty)_
