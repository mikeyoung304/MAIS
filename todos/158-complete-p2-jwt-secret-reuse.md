---
status: complete
priority: p2
issue_id: "158"
tags: [code-review, security, mvp-gaps, jwt]
dependencies: []
completed_date: 2025-12-02
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

## Implemented Solution

### Separate Booking Token Secret with Fallback (Completed)

**Implementation Details:**
1. Added `BOOKING_TOKEN_SECRET` to config schema with optional validation
2. Created `getBookingTokenSecret()` helper function with fallback logic
3. Updated `booking-tokens.ts` to use dedicated secret
4. Documented new environment variable in `.env.example`

**Files Changed:**
- `server/src/lib/core/config.ts` - Added BOOKING_TOKEN_SECRET config + helper
- `server/src/lib/booking-tokens.ts` - Uses getBookingTokenSecret() for sign/verify
- `.env.example` - Documented new optional variable

## Technical Details

**Affected Files:**
- `server/src/lib/booking-tokens.ts`
- `server/src/lib/core/config.ts`
- `.env.example`

## Acceptance Criteria

- [x] Separate BOOKING_TOKEN_SECRET environment variable in config
- [x] Fallback to JWT_SECRET for backwards compatibility
- [x] .env.example updated with documentation
- [x] booking-tokens.ts uses getBookingTokenSecret() helper
- [x] Maintains backwards compatibility (no breaking changes)
