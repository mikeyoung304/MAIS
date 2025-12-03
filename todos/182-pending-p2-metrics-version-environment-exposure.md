---
status: pending
priority: p2
issue_id: "182"
tags: [code-review, security, metrics]
dependencies: []
---

# Metrics Endpoint Exposes Application Version and Environment

## Problem Statement

The `/metrics` endpoint still exposes `npm_package_version` and `NODE_ENV` after removing sensitive data. While less critical than Node.js version exposure, this information aids reconnaissance by revealing:
- Application version (could help identify known vulnerabilities)
- Environment type (development vs production)

## Findings

**Location:** `server/src/routes/metrics.routes.ts:43-44`

**Current Code:**
```typescript
version: process.env.npm_package_version || 'unknown',
environment: process.env.NODE_ENV || 'development',
```

**Risk Assessment:**
- Impact: Low-Medium (version disclosure helps identify vulnerable versions)
- Likelihood: Medium (endpoint is unauthenticated and discoverable)

## Proposed Solutions

### Solution 1: Remove version/environment from public response (Recommended)
- Remove both fields from the metrics response
- Keep only operational metrics (uptime, memory, CPU)
- **Pros:** Maximum security, no reconnaissance value
- **Cons:** Harder to identify deployment version in monitoring
- **Effort:** Small (5 minutes)
- **Risk:** Low

### Solution 2: Move to authenticated admin endpoint
- Require authentication for metrics endpoint
- Only authenticated admins can see version info
- **Pros:** Maintains visibility for ops team
- **Cons:** More complex, may break existing monitoring
- **Effort:** Medium (1-2 hours)
- **Risk:** Low

### Solution 3: Use generic version string
- Replace semver with "v1" or similar
- Obscures actual deployment version
- **Pros:** Some monitoring capability retained
- **Cons:** Loses ability to track exact deployments
- **Effort:** Small (10 minutes)
- **Risk:** Low

## Recommended Action

Implement **Solution 1** before production deployment.

## Technical Details

**Affected Files:**
- `server/src/routes/metrics.routes.ts`

**Change Required:**
```diff
const metrics = {
  timestamp: new Date().toISOString(),
  uptime_seconds: uptimeSeconds,
  memory_usage: process.memoryUsage(),
  cpu_usage: process.cpuUsage(),
  service: 'mais-api',
-  version: process.env.npm_package_version || 'unknown',
-  environment: process.env.NODE_ENV || 'development',
};
```

## Acceptance Criteria

- [ ] Version and environment fields removed from metrics response
- [ ] Endpoint still returns useful operational metrics
- [ ] No TypeScript errors
- [ ] Tests updated if needed

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-03 | Created | Found during code review of commit 45024e6 |

## Resources

- Commit: 45024e6 (introduced metrics cleanup but retained version)
- Related: TODO-175 (completed - removed node_version, platform, arch, pid)
