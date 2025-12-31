---
status: complete
priority: p1
issue_id: '028'
tags: [code-review, devops, database, production]
dependencies: []
---

# Disabled Database Verification in Startup

## Problem Statement

Production startup skips database connectivity verification due to a TODO comment. Failed database connections are only discovered after health checks fail, causing delayed detection of database issues.

**Why this matters:** Takes 30+ seconds for Kubernetes to mark pod as unhealthy. Loss of data isolation if Supabase RLS is misconfigured goes undetected.

## Findings

### Code Evidence

**Location:** `server/src/index.ts:24-26`

```typescript
// TODO: Re-enable once SUPABASE_SERVICE_KEY is configured
// await verifyDatabaseConnection();
```

### Impact

- Production pods start without validating database connectivity
- 30+ second delay before health check failures
- Requests may fail with cryptic database errors
- Supabase RLS misconfiguration not detected at startup
- Rolling deployments may route traffic to unhealthy pods

### Related Configuration Gap

`server/src/config/env.schema.ts` vs `server/src/lib/core/config.ts` have dual validation systems:

- `env.schema.ts` enforces `DATABASE_URL` must start with `postgresql://`
- `config.ts` makes `DATABASE_URL` optional
- Creates inconsistent behavior

## Proposed Solutions

### Option A: Re-enable with Timeout (Recommended)

**Effort:** Small | **Risk:** Low

```typescript
// In index.ts
if (process.env.ADAPTERS_PRESET === 'real') {
  try {
    await Promise.race([
      verifyDatabaseConnection(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB connection timeout')), 5000)
      ),
    ]);
    logger.info('Database connection verified');
  } catch (error) {
    logger.error({ error }, 'Database connection failed');
    process.exit(1); // Fail fast
  }
}
```

**Pros:**

- Fail fast on startup
- 5-second timeout prevents hanging
- Only in real mode (mock mode skips)

**Cons:**

- Requires SUPABASE_SERVICE_KEY configuration

### Option B: Health Check Based Verification

**Effort:** Small | **Risk:** Low

Remove startup check, rely on enhanced health checks.

**Pros:**

- Works without SUPABASE_SERVICE_KEY
- Kubernetes handles unhealthy pods

**Cons:**

- Delayed detection (30+ seconds)
- Traffic may reach unhealthy pods

## Recommended Action

Implement **Option A** - Re-enable database verification with timeout.

## Technical Details

**Files to Update:**

- `server/src/index.ts:24-26` - Uncomment and add timeout
- `server/src/lib/core/config.ts` - Add SUPABASE_SERVICE_KEY to schema

**Environment Variables:**

- Ensure `SUPABASE_SERVICE_KEY` is set in production
- Add to deployment configuration

## Acceptance Criteria

- [ ] Database connectivity verified at startup in real mode
- [ ] 5-second timeout on verification
- [ ] Clear error message if database unreachable
- [ ] Process exits with code 1 on failure
- [ ] Mock mode skips verification
- [ ] Health check still works as backup

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2025-11-27 | Created | Found during comprehensive code review |

## Resources

- DevOps Harmony analysis
- Render.yaml health check configuration
- Kubernetes pod lifecycle documentation
