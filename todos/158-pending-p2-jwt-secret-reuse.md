---
status: pending
priority: p2
issue_id: "158"
tags: [code-review, security, mvp-gaps, jwt]
dependencies: []
---

# JWT Secret Key Reused for Booking Tokens

## Problem Statement

Booking tokens use the same `JWT_SECRET` as tenant authentication tokens. If a booking token leaks, attackers could analyze the JWT structure.

**Why This Matters:**
- Shared secret increases attack surface
- Token leak could expose signing patterns
- Defense in depth violation

## Findings

### Agent: security-sentinel

**Location:** `server/src/lib/booking-tokens.ts:67-72`

**Evidence:**
```typescript
const token = jwt.sign(
  { bookingId, tenantId, action },
  config.JWT_SECRET, // Same secret as tenant auth
  { expiresIn: `${expiresInDays}d` }
);
```

## Proposed Solutions

### Option A: Separate Booking Token Secret (Recommended)
**Pros:** Better isolation, defense in depth
**Cons:** Additional secret to manage
**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
// .env
JWT_SECRET=xxx                    # Tenant/admin authentication
BOOKING_TOKEN_SECRET=yyy          # Customer booking management

// booking-tokens.ts
const BOOKING_TOKEN_SECRET = process.env.BOOKING_TOKEN_SECRET || config.JWT_SECRET;
```

## Technical Details

**Affected Files:**
- `server/src/lib/booking-tokens.ts`
- `server/src/lib/core/config.ts`
- `.env.example`

## Acceptance Criteria

- [ ] Separate BOOKING_TOKEN_SECRET environment variable
- [ ] Fallback to JWT_SECRET for backwards compatibility
- [ ] .env.example updated
- [ ] Documentation updated
