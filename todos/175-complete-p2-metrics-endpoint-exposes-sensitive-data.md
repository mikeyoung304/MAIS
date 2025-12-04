---
status: complete
priority: p2
issue_id: "175"
tags: [todo]
dependencies: []
---

# TODO-175: Metrics Endpoint Exposes Sensitive Environment Data

**Priority:** P2 (Security)
**Status:** pending
**Created:** 2025-12-03
**Source:** Code Review (Security Sentinel)

## Issue

The new `/metrics` endpoint exposes potentially sensitive environment information that could aid attackers in fingerprinting the system:

- `node_version`: Exact Node.js version enables targeting known CVEs
- `platform`: OS type aids in crafting platform-specific exploits
- `arch`: Architecture information
- `pid`: Process ID could be useful in certain attack scenarios

## Location

- `server/src/routes/metrics.routes.ts`

## Current Code

```typescript
body: {
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  cpu: process.cpuUsage(),
  node_version: process.version,
  platform: process.platform,
  arch: process.arch,
  pid: process.pid,
}
```

## Recommendation

1. **Option A**: Remove sensitive fields entirely, keep only operational metrics:
   ```typescript
   body: {
     uptime: process.uptime(),
     memory: {
       heapUsed: process.memoryUsage().heapUsed,
       heapTotal: process.memoryUsage().heapTotal,
     },
   }
   ```

2. **Option B**: Require authentication for full metrics (admin-only):
   ```typescript
   // Public: minimal metrics
   // Authenticated admin: full metrics including system info
   ```

3. **Option C**: Move to a dedicated monitoring solution (Prometheus, DataDog) with proper access controls

## Risk Assessment

- **Impact**: Low-Medium (information disclosure aids reconnaissance)
- **Likelihood**: Low (requires discovery of endpoint)
- **Overall**: P2 - Should be addressed before production deployment

## Acceptance Criteria

- [ ] Sensitive environment data (node_version, platform, arch, pid) removed from public response
- [ ] If system metrics are needed for operations, they're behind admin authentication
- [ ] Endpoint documented in API reference

## Related

- Commit: 928b6a8 (introduced metrics endpoint)
