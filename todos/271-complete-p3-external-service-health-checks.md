---
status: complete
priority: p3
issue_id: '271'
tags: [code-review, backend-audit, health-check, monitoring, observability]
dependencies: []
---

# Missing Health Checks for External Services

## Problem Statement

The `/health` endpoint doesn't verify connectivity to external services (Postmark, Google Calendar, Stripe). Operations team has limited visibility into service dependencies when troubleshooting issues.

**Why it matters:**

- No early warning when external services are down
- Troubleshooting requires manual verification of each service
- Load balancers may route to unhealthy instances

## Findings

### Agent: backend-audit

- **Location:** `server/src/routes/health.routes.ts`
- **Evidence:** Health check likely only verifies database connectivity
- **Impact:** LOW - Operational visibility gap

## Proposed Solutions

### Option A: Extended Health Check Endpoint (Recommended)

**Description:** Add optional deep health check that verifies external services

```typescript
// GET /health?deep=true
router.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    cache: await container.cacheAdapter.isConnected(),
  };

  if (req.query.deep === 'true') {
    checks.stripe = await checkStripeConnectivity();
    checks.postmark = await checkPostmarkConnectivity();
    checks.googleCalendar = await checkGoogleCalendarConnectivity();
  }

  const allHealthy = Object.values(checks).every(Boolean);
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});
```

**Effort:** Small (2-3 hours)
**Risk:** Low

### Option B: Separate Readiness Endpoint

**Description:** Add `/ready` endpoint for external service checks

**Pros:**

- Clear separation of liveness vs readiness
- Kubernetes-friendly pattern

**Cons:**

- Two endpoints to maintain

**Effort:** Small (2-3 hours)
**Risk:** Low

## Recommended Action

Implement Option A with optional deep check to avoid slowing down frequent health checks.

## Technical Details

**Affected Files:**

- `server/src/routes/health.routes.ts`

**Health Check Methods:**

- **Stripe:** `stripe.balance.retrieve()` (minimal API call)
- **Postmark:** Postmark SDK has built-in server info endpoint
- **Google Calendar:** Attempt to list calendars or check auth

**Caching:**

- Cache external service status for 30-60 seconds to avoid rate limiting

## Acceptance Criteria

- [x] Deep health check available via query parameter
- [x] Each external service has connectivity check
- [x] Appropriate timeouts to prevent blocking
- [x] Response includes individual service status
- [x] 503 status when any critical service is down

## Work Log

| Date       | Action                         | Learnings                                                          |
| ---------- | ------------------------------ | ------------------------------------------------------------------ |
| 2025-12-05 | Created from backend audit     | Nice-to-have for operations                                        |
| 2025-12-06 | Implemented deep health checks | Created HealthCheckService with 60s caching, 5s timeouts per check |

## Resources

- Related: `server/src/routes/health.routes.ts`
- [12 Factor App Health Checks](https://12factor.net/admin-processes)
