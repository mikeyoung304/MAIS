---
status: ready
priority: p3
issue_id: '760'
tags: [monitoring, sentry, production]
dependencies: []
---

# Invalid Sentry DSN Format in Production

## Problem Statement

The Sentry DSN in production is malformed - missing a `/` before the project ID. This causes Sentry initialization to fail, meaning errors are not being reported to our monitoring system.

**Evidence:** Browser console on gethandled.ai:

```
Invalid Sentry Dsn: https://[key]@o4510745357516800.ingest.us.sentry.io4510745357516800
```

Expected format:

```
https://[key]@o4510745357516800.ingest.us.sentry.io/4510745357516800
                                                     ^ missing slash
```

## Findings

### Current Value

```
sentry.io4510745357516800
```

### Expected Value

```
sentry.io/4510745357516800
```

### Impact

- Production errors not reported to Sentry
- No visibility into client-side crashes
- Agent failures invisible to monitoring

### Location

- Environment variable: `NEXT_PUBLIC_SENTRY_DSN` or `SENTRY_DSN`
- Likely in Vercel environment settings

## Proposed Solutions

### Option 1: Fix Environment Variable (Recommended)

1. Go to Vercel dashboard → Environment Variables
2. Find `NEXT_PUBLIC_SENTRY_DSN`
3. Add missing `/` before project ID
4. Redeploy

- **Pros**: 5-minute fix
- **Cons**: None
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action

**Option 1** - Fix the env var immediately.

## Technical Details

- **Affected Files**: None (env var only)
- **Related Components**: Error monitoring
- **Database Changes**: No

## Acceptance Criteria

- [ ] Sentry DSN validates without error
- [ ] Test error appears in Sentry dashboard
- [ ] No "Invalid Sentry Dsn" console errors

## Work Log

### 2026-01-27 - Issue Identified

**By:** Claude Code Review
**Actions:**

- Discovered during production E2E snap observation
- Console showed Invalid Sentry Dsn error

## Notes

Source: `/workflows:review` session on 2026-01-27
Priority: P3 because monitoring gap, not user-facing

### 2026-01-27 - Marked Ready for Manual Fix

**By:** Claude Code
**Actions:**

- This requires manual Vercel dashboard access (not code change)
- Steps documented above in "Proposed Solutions"

**Manual Steps Required:**

1. Log in to Vercel dashboard
2. Navigate to MAIS project → Settings → Environment Variables
3. Find `NEXT_PUBLIC_SENTRY_DSN`
4. Current value ends with: `sentry.io4510745357516800`
5. Change to: `sentry.io/4510745357516800` (add `/` before project ID)
6. Redeploy production
