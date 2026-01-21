---
title: Project Hub P1 Security and Performance Resolution
category: security-issues
problem_type: code_review_resolution
severity: P1
created: 2026-01-21
updated: 2026-01-21
pr: 31
components:
  - server/src/routes/public-project.routes.ts
  - server/src/routes/tenant-admin-projects.routes.ts
  - server/src/services/project-hub.service.ts
  - server/src/agent-v2/deploy/project-hub/src/agent.ts
  - server/src/agent-v2/deploy/concierge/src/agent.ts
  - server/src/lib/project-tokens.ts
tags:
  - code-review
  - security
  - performance
  - authentication
  - rate-limiting
  - pagination
  - zod-validation
  - optimistic-locking
  - agent-tools
  - project-hub
  - multi-tenant
related_issues:
  - '5231'
  - '5232'
  - '5233'
  - '5234'
  - '5235'
  - '5236'
related_docs:
  - docs/solutions/patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md
  - docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md
  - docs/solutions/PREVENTION-QUICK-REFERENCE.md
---

# Project Hub P1 Security and Performance Resolution

> **Summary:** Resolved 6 critical security and performance issues identified in PR #31 code review for the Project Hub feature.

## Problem Statement

During code review of the Project Hub implementation (PR #31), 6 P1 issues were identified:

| Issue | Type                      | Risk                                         |
| ----- | ------------------------- | -------------------------------------------- |
| 5231  | Weak access control       | Unauthorized data access via guessable email |
| 5232  | Missing rate limiting     | DoS via unthrottled authenticated requests   |
| 5233  | Unbounded queries         | Memory exhaustion, timeouts                  |
| 5234  | Sequential queries        | 4x unnecessary latency                       |
| 5235  | Missing Zod safeParse     | LLM injection via unvalidated params         |
| 5236  | Hardcoded expectedVersion | Race conditions, lost updates                |

## Solutions

### 1. JWT-Based Project Access Tokens (Issue 5231)

**Root Cause:** Email-based authentication is guessable and enumerable.

**Solution:** Replace with cryptographically signed JWT tokens.

```typescript
// server/src/lib/project-tokens.ts
export function generateProjectAccessToken(
  projectId: string,
  tenantId: string,
  customerId: string,
  action: ProjectTokenAction = 'view',
  expiresInDays: number = 30
): string {
  return jwt.sign({ projectId, tenantId, customerId, action }, getBookingTokenSecret(config), {
    expiresIn: `${expiresInDays}d`,
  });
}

export function validateProjectAccessToken(
  token: string,
  expectedProjectId?: string
): ValidateProjectTokenResult {
  const payload = jwt.verify(token, getBookingTokenSecret(config));
  if (expectedProjectId && payload.projectId !== expectedProjectId) {
    return { valid: false, error: 'wrong_project' };
  }
  return { valid: true, payload };
}
```

**Route Usage:**

```typescript
const tokenResult = validateProjectAccessToken(token, projectId, 'view');
if (!tokenResult.valid) {
  res.status(tokenResult.error === 'expired' ? 401 : 403).json({ error: tokenResult.message });
  return;
}
```

---

### 2. Tenant-Scoped Rate Limiter (Issue 5232)

**Root Cause:** Authenticated routes lacked rate limiting.

**Solution:** Add tenant-specific rate limiter keyed by tenantId.

```typescript
// server/src/routes/tenant-admin-projects.routes.ts
const tenantProjectRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Higher for authenticated tenants
  message: { error: 'Too many requests.' },
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || 'unknown',
  standardHeaders: true,
});

router.use(tenantProjectRateLimiter);
```

---

### 3. Cursor-Based Pagination (Issue 5233)

**Root Cause:** List queries returned ALL records without limits.

**Solution:** Implement cursor-based pagination with `take: limit + 1` pattern.

```typescript
// server/src/services/project-hub.service.ts
async listProjects(
  tenantId: string,
  status?: ProjectStatus,
  cursor?: string,
  limit: number = 50
): Promise<{ projects: ProjectWithBooking[]; nextCursor?: string }> {
  const projects = await this.prisma.project.findMany({
    where: { tenantId, ...(status && { status }) },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Fetch extra to detect hasMore
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
  });

  const hasMore = projects.length > limit;
  const items = hasMore ? projects.slice(0, limit) : projects;
  return { projects: items, nextCursor: hasMore ? items.at(-1)?.id : undefined };
}
```

---

### 4. Parallelized Bootstrap Queries (Issue 5234)

**Root Cause:** 4 independent queries executed sequentially (~800ms).

**Solution:** Use `Promise.all` for ~75% latency reduction (~200ms).

```typescript
// server/src/services/project-hub.service.ts
async bootstrapTenant(tenantId: string): Promise<TenantBootstrapResult> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [tenant, activeProjectCount, pendingRequestCount, recentActivityCount] =
    await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
      this.prisma.project.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.projectRequest.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.projectEvent.count({ where: { tenantId, createdAt: { gte: weekAgo } } }),
    ]);

  return { activeProjectCount, pendingRequestCount, recentActivityCount, /* ... */ };
}
```

---

### 5. Zod safeParse in Agent Tools (Issue 5235)

**Root Cause:** Type assertions without runtime validation (Pitfall #62).

**Solution:** `safeParse()` as FIRST LINE in all 11 tool execute functions.

```typescript
// server/src/agent-v2/deploy/project-hub/src/agent.ts
const ProjectIdSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
});

const getProjectStatus = new FunctionTool({
  name: 'get_project_status',
  parameters: z.object({ projectId: z.string() }),
  execute: async (params, ctx) => {
    // P1 Security: Validate params FIRST (Pitfall #62)
    const parsed = ProjectIdSchema.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message };
    }
    const { projectId } = parsed.data;

    // Context guard SECOND
    const contextError = requireContext(ctx, 'customer');
    if (contextError) return contextError;

    // Business logic with validated params
  },
});
```

---

### 6. Required expectedVersion for Optimistic Locking (Issue 5236)

**Root Cause:** Hardcoded `expectedVersion: 1` bypassed concurrency protection.

**Solution:** Make expectedVersion required with validation.

```typescript
// Schema with required expectedVersion
const ApproveRequestSchema = z.object({
  requestId: z.string().min(1),
  expectedVersion: z.number().int().positive('Expected version required'),
  response: z.string().optional(),
});

// Tool description guides agent behavior
const approveRequest = new FunctionTool({
  name: 'approve_request',
  description: 'Approve request. Requires expectedVersion from get_pending_requests.',
  execute: async (params, ctx) => {
    const parsed = ApproveRequestSchema.safeParse(params);
    // ... validation, then pass expectedVersion to backend
  },
});
```

---

## Prevention Strategies

### Code Review Checklist

- [ ] **Auth routes**: Use signed tokens, never email/guessable identifiers
- [ ] **All routes**: Have rate limiting applied (check `router.use(limiter)`)
- [ ] **List queries**: Include `take` parameter with enforced MAX
- [ ] **Multiple queries**: Use `Promise.all()` for independent operations
- [ ] **Agent tools**: `safeParse(params)` is FIRST LINE of execute()
- [ ] **Optimistic locking**: `expectedVersion` from state, never hardcoded

### Automated Checks

```bash
# Find routes without rate limiting
grep -r "Router()" server/src/routes/ | xargs -I{} grep -L "rateLimit\|Limiter" {}

# Find agent tools missing safeParse
grep -r "execute: async" server/src/agent-v2/ | xargs -I{} grep -L "safeParse" {}

# Find hardcoded expectedVersion
grep -rn "expectedVersion: [0-9]" server/src/
```

---

## Files Changed

| File                                                  | Change                             |
| ----------------------------------------------------- | ---------------------------------- |
| `server/src/lib/project-tokens.ts`                    | NEW - JWT token utilities          |
| `server/src/routes/public-project.routes.ts`          | Token-based auth                   |
| `server/src/routes/tenant-admin-projects.routes.ts`   | Rate limiting                      |
| `server/src/services/project-hub.service.ts`          | Pagination, parallel queries       |
| `server/src/agent-v2/deploy/project-hub/src/agent.ts` | Zod safeParse (11 tools)           |
| `server/src/agent-v2/deploy/concierge/src/agent.ts`   | expectedVersion param              |
| `server/src/lib/errors/index.ts`                      | Export ConcurrentModificationError |

---

## Related Documentation

- [Zod Parameter Validation Prevention](../patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md)
- [Agent Tools Prevention Index](../patterns/AGENT_TOOLS_PREVENTION_INDEX.md)
- [Prevention Quick Reference](../PREVENTION-QUICK-REFERENCE.md)
- [ADR-018: Hub-and-Spoke Agent Architecture](../../adrs/ADR-018-hub-and-spoke-agent-architecture.md)
