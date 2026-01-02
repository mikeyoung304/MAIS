# P1: Missing Auth Fallback Protection

**Status:** done ✅
**Priority:** P1 (Critical)
**Fixed in:** commit a93a2a9e
**Category:** Security
**File:** `server/src/routes/platform-admin-traces.routes.ts`
**Lines:** 238, 287

## Problem

The route uses `res.locals.user?.id || 'system'` to get the user ID. If `res.locals.user` is undefined (middleware bypass or misconfiguration), admin actions get attributed to "system" rather than failing with 401.

```typescript
// Current (dangerous)
const userId = res.locals.user?.id || 'system';
```

## Risk

- Audit trail corruption: actions attributed to non-existent "system" user
- Potential auth bypass: if middleware fails silently, requests still proceed

## Fix

Remove fallback, require authenticated user:

```typescript
// Fixed
const userId = res.locals.user?.id;
if (!userId) {
  res.status(401).json({ error: 'Authentication required' });
  return;
}
```

Or throw explicitly:

```typescript
const userId = res.locals.user?.id;
if (!userId) {
  throw new UnauthorizedError('User ID required for audit trail');
}
```

## Source

Code review of commit b2cab182 - Security reviewer finding
