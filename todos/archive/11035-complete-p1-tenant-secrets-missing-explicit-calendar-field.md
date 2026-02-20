---
status: pending
priority: p1
issue_id: '11035'
tags: [code-review, google-calendar, typescript, type-safety, data-integrity]
---

# TenantSecrets Missing Explicit `calendar` Field — Duplicate Definition with Weaker Types

## Problem Statement

The `TenantSecrets` TypeScript interface is missing an explicit `calendar?: EncryptedData` property, relying on an index signature catch-all instead. Additionally, there is a duplicate `TenantSecrets` definition in `stripe-connect.service.ts` with a weaker `[key: string]: unknown` index signature. This causes type unsafe access to calendar secrets and risks accessing the wrong keys at runtime.

## Findings

- **Flagged by:** 5 agents
- `TenantSecrets` interface lacks explicit `calendar?` and `googleCalendarOAuth?` properties
- Duplicate definition in `server/src/services/stripe-connect.service.ts` — divergent index signature
- Fix: add named properties to the canonical interface; delete the duplicate

## Proposed Solutions

### Option A: Fix Canonical Interface + Delete Duplicate (15 min)

```typescript
interface TenantSecrets {
  stripe?: EncryptedData;
  calendar?: EncryptedData;
  googleCalendarOAuth?: {
    accessToken: EncryptedData;
    refreshToken: EncryptedData;
    expiresAt: number;
  };
  webhooks?: { [id: string]: EncryptedData };
}
```

Delete the duplicate in `stripe-connect.service.ts`, import from the canonical location.

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Single canonical `TenantSecrets` interface with explicit named fields
- [ ] No duplicate definition
- [ ] TypeScript strict mode passes
- [ ] `calendar` access is type-safe without cast

## Work Log

- 2026-02-20: Flagged by 5 agents. Simple type fix, high confidence.
