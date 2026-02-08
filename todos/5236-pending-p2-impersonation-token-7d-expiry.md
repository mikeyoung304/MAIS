---
status: pending
priority: p2
issue_id: '5236'
tags: [code-review, security, auth, enterprise-review]
dependencies: []
---

# Impersonation Token Uses 7-Day Expiry (Should Be 1-2 Hours)

## Problem Statement

Impersonation tokens grant a platform admin full access as a specific tenant for 7 days. If a token is leaked (browser history, logs, network interception), it provides a week-long window for unauthorized tenant access.

**Why it matters:** A compromised impersonation token allows full tenant account takeover — managing bookings, viewing customer PII, modifying storefront content, accessing billing.

## Findings

**Source:** Security Sentinel review (PR #42, 2026-02-08)

**Location:** `server/src/services/identity.service.ts` lines 35 and 56

```typescript
createImpersonationToken(payload: UnifiedTokenPayload): string {
  return jwt.sign(payload, this.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '7d', // ← Should be much shorter
  });
}
```

Both `createToken` (line 35) and `createImpersonationToken` (line 56) use `7d`. The impersonation token has a `type: 'impersonation'` claim but shares the same long expiry.

## Proposed Solutions

### Option A: Reduce expiry to 2 hours (Recommended)

- Change `expiresIn: '7d'` to `expiresIn: '2h'` for impersonation tokens only
- **Pros:** Simple, immediate risk reduction
- **Cons:** Admin must re-impersonate after 2 hours
- **Effort:** Small (1 line change)
- **Risk:** Low

### Option B: Add session-scoped impersonation

- Generate short-lived token (15 min) that auto-refreshes via a dedicated endpoint
- Add audit logging for all actions during impersonation
- **Pros:** Best security posture, full audit trail
- **Cons:** Requires new refresh endpoint + middleware changes
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] Impersonation token expiry is ≤2 hours
- [ ] Regular tenant tokens remain at 7 days
- [ ] Impersonation flow still works end-to-end
- [ ] Audit log captures impersonation token creation

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2026-02-08 | Created | Found during enterprise review PR #42 |
