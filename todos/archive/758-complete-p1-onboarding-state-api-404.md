---
status: ready
priority: p1
issue_id: '758'
tags: [agent-v2, api, onboarding, enterprise-ai]
dependencies: []
---

# Onboarding State API Returns 404 in Production

## Problem Statement

The `/api/tenant-admin/agent/onboarding-state` endpoint returns 404 in production, preventing the agent from determining if onboarding mode should be active. Without this, the agent operates in reactive mode instead of guiding users through storefront completion.

**Evidence:** Network requests captured during E2E testing:

- `GET /api/tenant-admin/agent/onboarding-state` → 404 NOT FOUND
- `GET /api/tenant-admin/stripe/status` → 404 NOT FOUND
- Multiple tenant API endpoints returning 404

## Findings

### Expected Behavior

1. Bootstrap session calls onboarding-state API
2. API returns `{ phase, isComplete, isReturning, resumeMessage }`
3. Agent activates onboarding mode if `!isComplete`
4. Agent guides user through storefront completion

### Observed Behavior

1. API returns 404
2. Agent can't determine onboarding state
3. Agent operates in normal mode (reactive)
4. Agent doesn't guide user to complete storefront

### Root Cause Hypotheses

1. **Route Not Mounted in Production**: Route exists in code but may not be deployed
2. **Tenant Auth Failing**: Middleware rejecting request before route handler
3. **Next.js Proxy Issue**: `/api/tenant-admin/agent/[...path]` not forwarding correctly
4. **Missing Environment Variables**: Backend URL not configured

### Location

- Backend route: `server/src/routes/tenant-admin-agent.routes.ts`
- Next.js proxy: `apps/web/src/app/api/tenant-admin/agent/[...path]/route.ts`
- Bootstrap tool: `server/src/agent-v2/deploy/concierge/src/agent.ts:1544-1596`

## Proposed Solutions

### Option 1: Debug API Chain (Recommended First Step)

1. Check Render logs for 404 vs route not found
2. Verify tenant auth token in request
3. Test backend directly: `curl https://api.gethandled.ai/v1/tenant-admin/agent/onboarding-state -H "Authorization: Bearer <token>"`
4. Check Next.js proxy env vars

- **Pros**: Identifies actual root cause
- **Cons**: Requires production access
- **Effort**: Small (1 hour)
- **Risk**: Low

### Option 2: Add Backend Health Check

Add `/v1/health/agent-routes` endpoint that confirms all agent routes are mounted

- **Pros**: Easy to verify in production
- **Cons**: Doesn't fix the issue
- **Effort**: Small (30 minutes)
- **Risk**: Low

### Option 3: Graceful Fallback

If onboarding-state returns 404, assume onboarding mode is needed:

```typescript
const state = await fetchOnboardingState().catch(() => ({ isComplete: false }));
```

- **Pros**: Prevents feature breakage
- **Cons**: May incorrectly activate onboarding for completed users
- **Effort**: Small (1 hour)
- **Risk**: Medium

## Recommended Action

**Option 1** first to diagnose, then **Option 3** as defensive fallback.

## Technical Details

- **Affected Files**:
  - `server/src/routes/tenant-admin-agent.routes.ts`
  - `apps/web/src/app/api/tenant-admin/agent/[...path]/route.ts`
  - `server/src/agent-v2/deploy/concierge/src/agent.ts`
- **Related Components**: Bootstrap session, onboarding detection
- **Database Changes**: No

## Acceptance Criteria

- [ ] `/api/tenant-admin/agent/onboarding-state` returns 200 in production
- [ ] Bootstrap session successfully retrieves onboarding state
- [ ] Agent activates onboarding mode for incomplete storefronts
- [ ] Agent resumes naturally for returning users

## Work Log

### 2026-01-27 - Issue Identified

**By:** Claude Code Review
**Actions:**

- Discovered during production E2E snap observation
- Network panel showed 404 for onboarding-state API
- Multiple tenant API endpoints also 404ing

**Learnings:**

- Production API availability must be verified after deploy
- Agent features depend on multiple backend endpoints

### 2026-01-27 - Code Investigation & Improvements

**By:** Claude Code
**Actions:**

- Traced full request path from Next.js proxy to Express backend
- Verified routes ARE correctly defined and registered:
  - Backend route: `tenant-admin-agent.routes.ts` line 282 defines `/onboarding-state`
  - Route registration: `routes/index.ts` line 709-716 mounts at `/v1/tenant-admin/agent`
  - Next.js proxy: `[...path]/route.ts` correctly forwards to backend
- Added 404 debugging logs to both proxy routes (`/api/tenant-admin/agent/[...path]` and `/api/tenant-admin/[...path]`)
- Improved error messages in `useOnboardingState.ts` to include status code and response body
- Updated proxy documentation to list all 6 endpoints (was missing onboarding-state and skip-onboarding)

**Root Cause Hypothesis:**

Based on code review, the routes are correctly defined. The 404 is most likely due to:

1. **Deployment gap**: Code merged to `main` but backend not yet deployed to Render
2. **Environment variable mismatch**: `NEXT_PUBLIC_API_URL` not set correctly in Vercel production

**Next Steps:**

1. Verify backend deployment status on Render
2. Check `NEXT_PUBLIC_API_URL` in Vercel production environment
3. Test directly: `curl https://api.gethandled.ai/v1/tenant-admin/agent/onboarding-state -H "Authorization: Bearer <token>"`
4. If still failing after deploy, check Render logs for the 404 response message which will indicate if route exists

**Files Modified:**

- `apps/web/src/app/api/tenant-admin/agent/[...path]/route.ts` - Added 404 logging, updated docs
- `apps/web/src/app/api/tenant-admin/[...path]/route.ts` - Added 404 logging
- `apps/web/src/hooks/useOnboardingState.ts` - Improved error message with status code

## Resources

- Route definition: `server/src/routes/tenant-admin-agent.routes.ts`
- Onboarding detection: `server/src/agent-v2/deploy/concierge/src/onboarding-mode.ts`
- Deployment docs: `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`

## Notes

Source: `/workflows:review` session on 2026-01-27
Priority: P1 because blocks entire onboarding experience - core feature broken
