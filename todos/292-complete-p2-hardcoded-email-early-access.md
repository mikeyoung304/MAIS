---
status: resolved
priority: p2
issue_id: "292"
tags: [code-review, configuration, early-access]
dependencies: []
resolved_at: 2025-12-06
resolution: "Added EARLY_ACCESS_NOTIFICATION_EMAIL to config.ts with fallback, updated auth.routes.ts to use config value, documented in .env.example"
---

# Hardcoded Admin Email in Early Access

## Problem Statement

The destination email `mike@maconheadshots.com` is hardcoded in the route handler, violating the MAIS rule: "Secrets: Environment variables only, never hardcode."

**Why it matters:** Can't change recipient without code deployment. Dev/test requests go to production email.

## Findings

**File:** `server/src/routes/auth.routes.ts` (line 815)

```typescript
await mailProvider.sendEmail({
  to: 'mike@maconheadshots.com', // ⚠️ Hardcoded
  subject: `Early Access Request from ${normalizedEmail}`,
```

## Proposed Solutions

### Option A: Environment Variable (Recommended)
**Pros:** Standard pattern, easy to change
**Cons:** Requires env var documentation
**Effort:** Small (10 min)
**Risk:** Low

```typescript
// server/src/lib/core/config.ts
earlyAccessNotificationEmail: process.env.EARLY_ACCESS_NOTIFICATION_EMAIL || 'mike@maconheadshots.com',

// server/src/routes/auth.routes.ts
await mailProvider.sendEmail({
  to: config.earlyAccessNotificationEmail,
  // ...
});
```

## Recommended Action

Implement Option A - add to config with fallback to current email.

## Technical Details

**Affected files:**
- `server/src/lib/core/config.ts`
- `server/src/routes/auth.routes.ts`

**Environment variable:** `EARLY_ACCESS_NOTIFICATION_EMAIL`

## Acceptance Criteria

- [x] Email address moved to environment variable
- [x] Fallback to current email if not set
- [x] Config documented in .env.example
- [x] Works in both mock and real modes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-06 | Created from code review | Architecture agent identified config violation |

## Resources

- PR commit: 9548fc3
- MAIS config pattern: `server/src/lib/core/config.ts`
