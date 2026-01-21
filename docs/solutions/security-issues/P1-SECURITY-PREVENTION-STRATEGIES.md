---
title: P1 Security Prevention Strategies
category: security
component: all
severity: P1
tags:
  [security, authentication, rate-limiting, pagination, performance, validation, optimistic-locking]
created: 2026-01-21
updated: 2026-01-21
related:
  - PREVENT-CRUD-ROUTE-VULNERABILITIES.md
  - ../patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md
  - ../patterns/mais-critical-patterns.md
---

# P1 Security Prevention Strategies

**Purpose:** Comprehensive prevention strategies for 6 critical security issues identified in codebase audit.

**Audience:** All developers working on MAIS

---

## Table of Contents

1. [Email-Based Auth on Sensitive Routes](#1-email-based-auth-on-sensitive-routes)
2. [Missing Rate Limiting on Authenticated Routes](#2-missing-rate-limiting-on-authenticated-routes)
3. [Unbounded Database Queries](#3-unbounded-database-queries)
4. [Sequential Queries That Could Be Parallel](#4-sequential-queries-that-could-be-parallel)
5. [Missing Zod safeParse in Agent Tool Execute Functions](#5-missing-zod-safeparse-in-agent-tool-execute-functions)
6. [Hardcoded Values in Optimistic Locking](#6-hardcoded-values-in-optimistic-locking)

---

## 1. Email-Based Auth on Sensitive Routes

### Problem

Using email address alone to authenticate users on sensitive routes (password reset, account changes, billing) allows attackers to enumerate accounts and potentially gain access through timing attacks or data leakage.

### Prevention Rule

**ALWAYS use cryptographically signed tokens for sensitive operations, NEVER email-based lookup.**

```typescript
// WRONG - Email-based lookup for sensitive operations
app.post('/password-reset', async (req, res) => {
  const { email } = req.body;
  const user = await userRepo.findByEmail(email); // Account enumeration!
  if (!user) {
    return res.status(404).json({ error: 'User not found' }); // Leaks existence
  }
  // ... process reset
});

// CORRECT - Signed token with expiration
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Generate reset token (store hashed version, send plaintext)
const resetToken = crypto.randomBytes(32).toString('hex');
const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
await userRepo.storeResetToken(userId, hashedToken, Date.now() + 3600000); // 1hr expiry

// Verify token (timing-safe comparison)
app.post('/password-reset/confirm', async (req, res) => {
  const { token, newPassword } = req.body;
  const hashedInput = crypto.createHash('sha256').update(token).digest('hex');

  const user = await userRepo.findByResetToken(hashedInput);
  if (!user || user.resetTokenExpiry < Date.now()) {
    // Generic error - doesn't reveal if token existed
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
  // ... update password
});
```

### Code Review Checklist

- [ ] Sensitive routes use signed tokens (JWT or HMAC), not email/username lookup
- [ ] Reset/verification tokens are cryptographically random (32+ bytes)
- [ ] Tokens have expiration timestamps
- [ ] Error messages are generic (don't reveal user existence)
- [ ] Token comparison uses timing-safe methods (`crypto.timingSafeEqual`)
- [ ] Rate limiting applied to prevent brute-force token guessing

### Automated Check

**ESLint Rule (Custom):**

```javascript
// .eslintrc.js - Add to rules
'no-restricted-syntax': [
  'error',
  {
    selector: 'CallExpression[callee.property.name="findByEmail"][parent.parent.parent.type="MethodDefinition"][parent.parent.parent.key.name=/reset|verify|confirm|sensitive/i]',
    message: 'Avoid email-based auth on sensitive routes. Use signed tokens instead.'
  }
]
```

**Test Pattern:**

```typescript
// Verify sensitive routes don't accept email as primary auth
describe('Sensitive route security', () => {
  it('should NOT accept email-only authentication for password reset confirmation', async () => {
    const response = await request(app)
      .post('/v1/password-reset/confirm')
      .send({ email: 'user@example.com', newPassword: 'secret123' });

    // Should require token, not email
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/token required/i);
  });

  it('should return generic error for invalid reset tokens', async () => {
    const response = await request(app)
      .post('/v1/password-reset/confirm')
      .send({ token: 'invalid-token', newPassword: 'secret123' });

    // Should NOT reveal if token existed or expired
    expect(response.body.error).toBe('Invalid or expired token');
  });
});
```

**grep command for detection:**

```bash
# Find email-based auth in sensitive routes
grep -rn "findByEmail\|getByEmail" server/src/routes/*.ts | \
  grep -i "reset\|verify\|confirm\|sensitive\|billing"
```

---

## 2. Missing Rate Limiting on Authenticated Routes

### Problem

Authenticated routes without rate limiting allow malicious users or compromised accounts to exhaust resources, cause DoS, or abuse expensive operations (AI, file uploads).

### Prevention Rule

**ALL routes MUST have rate limiting. Authenticated routes use tenant-scoped limits.**

```typescript
// WRONG - No rate limiting
router.post('/generate-report', tenantAuth, async (req, res) => {
  const report = await expensiveReportGeneration(tenantId); // CPU/DB exhaustion
  res.json(report);
});

// CORRECT - Tenant-scoped rate limiting
import { rateLimit } from 'express-rate-limit';

const reportGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'test' ? 500 : 10, // 10 reports/hour/tenant
  standardHeaders: true,
  legacyHeaders: false,
  // Key by tenantId for per-tenant limiting
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(_req.ip),
  skip: (_req, res) => !res.locals.tenantAuth, // Only apply to authenticated requests
  validate: false, // Disable IP validation for IPv6
  handler: (_req, res) =>
    res.status(429).json({
      error: 'too_many_report_requests',
      message: 'Report generation limit reached. Try again later.',
    }),
});

router.post('/generate-report', tenantAuth, reportGenerationLimiter, async (req, res) => {
  // Now protected
});
```

### Rate Limit Guidelines by Operation Type

| Operation Type    | Window | Max Requests | Key      |
| ----------------- | ------ | ------------ | -------- |
| Read operations   | 1 min  | 100          | tenantId |
| Write operations  | 1 min  | 20           | tenantId |
| Auth attempts     | 15 min | 5            | IP       |
| File uploads      | 1 hour | 50           | tenantId |
| AI/agent chat     | 5 min  | 30           | tenantId |
| Expensive reports | 1 hour | 10           | tenantId |
| Webhooks          | 1 min  | 100          | IP       |

### Code Review Checklist

- [ ] Every route has rate limiting middleware applied
- [ ] Rate limiter uses `tenantId` for authenticated routes (not just IP)
- [ ] Test environment has higher limits (`isTestEnvironment ? 500 : N`)
- [ ] Error responses use 429 status with descriptive message
- [ ] Expensive operations (AI, reports, exports) have stricter limits
- [ ] Skip function excludes unauthenticated requests where appropriate
- [ ] IPv6 handled with `normalizeIp()` helper

### Automated Check

**Test Pattern:**

```typescript
// Rate limiter coverage test
describe('Rate limiting coverage', () => {
  const RATE_LIMITED_ROUTES = [
    'POST /v1/tenant-admin/packages',
    'PUT /v1/tenant-admin/packages/:id',
    'POST /v1/agent/chat',
    'POST /v1/tenant-admin/reports/generate',
  ];

  RATE_LIMITED_ROUTES.forEach((route) => {
    it(`${route} should be rate limited`, async () => {
      const [method, path] = route.split(' ');

      // Make requests beyond limit
      const requests = Array(101)
        .fill(null)
        .map(() =>
          request(app)
            [method.toLowerCase()](path.replace(':id', 'test-id'))
            .set('Authorization', `Bearer ${testToken}`)
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
```

**grep command for detection:**

```bash
# Find routes without rate limiters
grep -rn "router\.\(get\|post\|put\|patch\|delete\)" server/src/routes/*.ts | \
  grep -v "Limiter" | \
  grep -v "health\|ready"
```

**CI Script:**

```bash
#!/bin/bash
# scripts/check-rate-limiters.sh

ROUTES_WITHOUT_LIMITERS=$(grep -rn "router\.\(get\|post\|put\|patch\|delete\)" server/src/routes/*.ts | \
  grep -v "Limiter" | \
  grep -v "health\|ready\|webhook" | \
  wc -l)

if [ "$ROUTES_WITHOUT_LIMITERS" -gt 0 ]; then
  echo "ERROR: Found $ROUTES_WITHOUT_LIMITERS routes without rate limiters"
  exit 1
fi
```

---

## 3. Unbounded Database Queries

### Problem

Queries without pagination can return millions of rows, causing memory exhaustion, timeout, and database performance degradation.

### Prevention Rule

**ALL list queries MUST have pagination with enforced maximum limits.**

```typescript
// WRONG - Unbounded query
async getAllBookings(tenantId: string): Promise<Booking[]> {
  return this.prisma.booking.findMany({
    where: { tenantId },  // Could return 1M+ rows!
  });
}

// CORRECT - Paginated with enforced limits
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

interface PaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
  total?: number;
}

async getBookings(
  tenantId: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Booking>> {
  // Enforce maximum limit
  const limit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = options.offset ?? 0;

  // Fetch one extra to detect if more exist
  const items = await this.prisma.booking.findMany({
    where: { tenantId },
    take: limit + 1,
    skip: offset,
    orderBy: { createdAt: 'desc' },
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop(); // Remove the extra item

  return {
    items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
  };
}
```

### Pagination Standards

| Resource Type      | Default Limit | Max Limit | Cursor Support |
| ------------------ | ------------- | --------- | -------------- |
| List endpoints     | 50            | 100       | Required       |
| Admin queries      | 50            | 500       | Optional       |
| Export endpoints   | 100           | 1000      | Required       |
| Agent tool queries | 10            | 50        | Optional       |

### Code Review Checklist

- [ ] All `findMany` queries have `take` parameter
- [ ] Limit values have enforced maximum (`Math.min(requested, MAX)`)
- [ ] Response includes `hasMore` indicator for pagination
- [ ] Cursor-based pagination for large datasets
- [ ] Count queries use `take: 1` to verify existence, not full count
- [ ] No `.findMany()` without WHERE clause (would scan entire table)

### Automated Check

**ESLint Rule (Custom):**

```javascript
// Detect unbounded findMany calls
{
  selector: 'CallExpression[callee.property.name="findMany"]:not(:has(ObjectExpression Property[key.name="take"]))',
  message: 'findMany() requires "take" parameter for pagination. Add take: limit or take: MAX_PAGE_SIZE.'
}
```

**Test Pattern:**

```typescript
describe('Pagination enforcement', () => {
  it('should enforce maximum page size', async () => {
    const response = await request(app)
      .get('/v1/tenant-admin/bookings?limit=10000')
      .set('Authorization', `Bearer ${testToken}`);

    // Should cap at MAX_PAGE_SIZE (100), not return 10000
    expect(response.body.items.length).toBeLessThanOrEqual(100);
  });

  it('should include hasMore indicator', async () => {
    // Create 55 test bookings
    await createTestBookings(55);

    const response = await request(app)
      .get('/v1/tenant-admin/bookings?limit=50')
      .set('Authorization', `Bearer ${testToken}`);

    expect(response.body.hasMore).toBe(true);
    expect(response.body.items.length).toBe(50);
  });
});
```

**grep command for detection:**

```bash
# Find findMany without take parameter
grep -rn "findMany(" server/src --include="*.ts" -A 5 | \
  grep -v "take:" | \
  grep "findMany"
```

---

## 4. Sequential Queries That Could Be Parallel

### Problem

Running independent database queries sequentially increases response latency linearly. For N queries taking T ms each, sequential = N\*T, parallel = max(T).

### Prevention Rule

**Use `Promise.all()` for independent queries. Keep sequential only for dependent queries.**

```typescript
// WRONG - Sequential queries (3 * ~50ms = 150ms)
async getBookingDetails(tenantId: string, bookingId: string) {
  const booking = await this.getBooking(tenantId, bookingId);
  const customer = await this.getCustomer(tenantId, booking.customerId);
  const package_ = await this.getPackage(tenantId, booking.packageId);
  const addons = await this.getAddons(tenantId, bookingId);

  return { booking, customer, package_, addons };
}

// CORRECT - Parallel queries (max(50ms) = 50ms)
async getBookingDetails(tenantId: string, bookingId: string) {
  // First get booking (needed for customer/package IDs)
  const booking = await this.getBooking(tenantId, bookingId);

  // Then fetch independent data in parallel
  const [customer, package_, addons] = await Promise.all([
    this.getCustomer(tenantId, booking.customerId),
    this.getPackage(tenantId, booking.packageId),
    this.getAddons(tenantId, bookingId),
  ]);

  return { booking, customer, package_, addons };
}

// BEST - Use Prisma include for single query
async getBookingDetails(tenantId: string, bookingId: string) {
  return this.prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    include: {
      customer: true,
      package: true,
      addons: true,
    },
  });
}
```

### Decision Tree

```
Are the queries dependent on each other's results?
├── YES → Run sequentially with await
│   Example: Get booking, then get customer using booking.customerId
└── NO → Run in parallel with Promise.all()
    Example: Get packages, segments, and settings simultaneously

Can Prisma include/select fetch the data in one query?
├── YES → Prefer include {} for related data (most efficient)
└── NO → Use Promise.all() for independent queries
```

### Code Review Checklist

- [ ] Independent queries use `Promise.all()`
- [ ] Related data uses Prisma `include` instead of separate queries
- [ ] No sequential `await` statements for unrelated data
- [ ] Dashboard/list pages batch initial data load
- [ ] N+1 queries use `include` instead of loops
- [ ] Parallel queries have error handling (one failure shouldn't lose all)

### Automated Check

**Performance Test:**

```typescript
describe('Query parallelization', () => {
  it('should load dashboard data in parallel', async () => {
    const startTime = Date.now();

    const response = await request(app)
      .get('/v1/tenant-admin/dashboard')
      .set('Authorization', `Bearer ${testToken}`);

    const duration = Date.now() - startTime;

    // Dashboard with 4 queries should complete in ~100ms (parallel)
    // not ~400ms (sequential with 4 * 100ms each)
    expect(duration).toBeLessThan(200);
  });
});
```

**grep command for detection:**

```bash
# Find sequential await patterns (potential parallelization)
grep -rn "await.*await.*await" server/src/services --include="*.ts" | head -20

# Better: Look for multiple awaits in same function without Promise.all
grep -rn "const.*=.*await" server/src/services --include="*.ts" -A 1 | \
  grep -B1 "const.*=.*await" | \
  grep -v "Promise.all"
```

**ESLint Plugin (eslint-plugin-promise):**

```javascript
// .eslintrc.js
{
  plugins: ['promise'],
  rules: {
    // Warns on sequential awaits that could be parallel
    'promise/prefer-await-to-callbacks': 'warn',
  }
}
```

---

## 5. Missing Zod safeParse in Agent Tool Execute Functions

### Problem

Agent tools receive parameters from LLMs which may send malformed data. Using type assertions (`params as Type`) without validation causes runtime crashes.

### Prevention Rule

**Agent tool `execute()` functions MUST call `schema.safeParse(params)` as the FIRST LINE.**

```typescript
// WRONG - Type assertion without validation
const updateServiceTool = {
  name: 'update_service',
  async execute(context: ToolContext, params: Record<string, unknown>) {
    // DANGEROUS: LLM might send { serviceId: 123 } instead of string!
    const { serviceId, name, price } = params as UpdateServiceParams;

    const result = await serviceService.update(context.tenantId, serviceId, { name, price });
    return { success: true, data: result };
  },
};

// CORRECT - Zod validation first
const UpdateServiceParamsSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  name: z.string().min(1).max(100).optional(),
  price: z.number().min(0).optional(),
  confirmationReceived: z.boolean().optional(),
});

const updateServiceTool = {
  name: 'update_service',
  async execute(context: ToolContext, params: Record<string, unknown>) {
    // FIRST LINE: Validate params
    const parseResult = UpdateServiceParamsSchema.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid parameters',
      };
    }

    // Now safe to destructure validated data
    const { serviceId, name, price } = parseResult.data;

    try {
      const result = await serviceService.update(context.tenantId, serviceId, { name, price });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: sanitizeError(error) };
    }
  },
};
```

### Schema Requirements for Agent Tools

| Field Type      | Zod Validator                              | Example                                                       |
| --------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Required ID     | `z.string().min(1, 'ID required')`         | `packageId: z.string().min(1)`                                |
| Optional string | `z.string().max(N).optional()`             | `description: z.string().max(500).optional()`                 |
| Email           | `z.string().email('Valid email required')` | `customerEmail: z.string().email()`                           |
| Date string     | `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`  | `date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')` |
| Enum            | `z.enum(['a', 'b', 'c'])`                  | `status: z.enum(['active', 'inactive'])`                      |
| T3 confirmation | `z.boolean()`                              | `confirmationReceived: z.boolean()`                           |

### Code Review Checklist

- [ ] Schema defined at module level (not inline in execute)
- [ ] `safeParse()` called as FIRST LINE of execute function
- [ ] Parse failure returns `{ success: false, error: message }`
- [ ] NO `params as Type` anywhere in tool code
- [ ] All required fields have `.min(1)` or similar constraint
- [ ] Date strings validated with regex pattern
- [ ] IDs use `.string().min(1)` not `.uuid()` (MAIS uses CUIDs)
- [ ] T3 tools include `confirmationReceived` parameter

### Automated Check

**grep commands for detection:**

```bash
# Find missing safeParse in agent tools
grep -rn "async execute" server/src/agent/**/*.ts -A 10 | \
  grep -v "safeParse" | \
  grep "execute"

# Find dangerous type assertions in agent code
grep -rn "params as {" server/src/agent/
grep -rn "params as [A-Z]" server/src/agent/

# Find .parse() instead of .safeParse() (throws on error)
grep -rn "Schema\.parse(" server/src/agent/
```

**Test Pattern:**

```typescript
describe('Agent tool validation', () => {
  it('should handle malformed parameters gracefully', async () => {
    const result = await updateServiceTool.execute(mockContext, {
      serviceId: 123, // Wrong type - should be string
      name: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('string');
  });

  it('should validate required fields', async () => {
    const result = await updateServiceTool.execute(mockContext, {
      // Missing serviceId
      name: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });
});
```

**ESLint Rule:**

```javascript
// Custom rule to enforce safeParse in execute functions
{
  selector: 'MethodDefinition[key.name="execute"]:not(:has(CallExpression[callee.property.name="safeParse"]))',
  message: 'Agent tool execute() must call schema.safeParse(params) as first operation'
}
```

---

## 6. Hardcoded Values in Optimistic Locking

### Problem

Optimistic locking with hardcoded expected versions (e.g., `expectedVersion: 1`) will fail on any record that has been modified, making updates impossible after first edit.

### Prevention Rule

**ALWAYS pass the current version from client state. NEVER hardcode version numbers.**

```typescript
// WRONG - Hardcoded version
async function approveRequest(requestId: string) {
  await projectHubService.approveRequest({
    tenantId,
    requestId,
    expectedVersion: 1,  // FAILS if request was ever modified!
  });
}

// CORRECT - Version from state
interface RequestState {
  id: string;
  status: string;
  version: number;  // Track current version
}

async function approveRequest(request: RequestState) {
  await projectHubService.approveRequest({
    tenantId,
    requestId: request.id,
    expectedVersion: request.version,  // Use actual current version
  });
}

// API Response includes version for client to track
// GET /v1/project-hub/requests/:id
{
  "id": "req_123",
  "status": "PENDING",
  "version": 3,  // Client stores this
}

// Client sends version back on mutation
// POST /v1/project-hub/requests/:id/approve
{
  "expectedVersion": 3,  // From client state
  "response": "Approved"
}
```

### Server-Side Pattern

```typescript
// Service implementation with optimistic locking
async approveRequest(input: HandleRequestInput): Promise<ProjectRequest> {
  const { tenantId, requestId, expectedVersion, response } = input;

  return this.prisma.$transaction(async (tx) => {
    // Fetch with version check
    const existing = await tx.projectRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError(`Request ${requestId} not found`);
    }

    // Optimistic lock check - NEVER skip this!
    if (existing.version !== expectedVersion) {
      throw new ConcurrentModificationError(
        existing.version,
        `Request was modified. Expected version ${expectedVersion}, found ${existing.version}. Please refresh and try again.`
      );
    }

    // Update with version increment
    return tx.projectRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        responseData: { message: response },
        version: { increment: 1 },  // Always increment on mutation
      },
    });
  });
}
```

### Frontend Pattern (React)

```typescript
// Hook to manage versioned resource
function useVersionedResource<T extends { version: number }>(
  fetchFn: () => Promise<T>,
  updateFn: (data: T, version: number) => Promise<T>
) {
  const [resource, setResource] = useState<T | null>(null);

  const refresh = async () => {
    const data = await fetchFn();
    setResource(data); // Includes current version
  };

  const update = async (updates: Partial<T>) => {
    if (!resource) throw new Error('Resource not loaded');

    try {
      const updated = await updateFn(
        { ...resource, ...updates },
        resource.version // Pass current version
      );
      setResource(updated); // Update with new version
    } catch (error) {
      if (error.code === 'CONCURRENT_MODIFICATION') {
        // Refresh and notify user
        await refresh();
        throw new Error('Data was modified. Please review and try again.');
      }
      throw error;
    }
  };

  return { resource, refresh, update };
}
```

### Code Review Checklist

- [ ] `expectedVersion` parameter comes from state/props, never hardcoded
- [ ] API responses include `version` field for client tracking
- [ ] Mutation requests include `expectedVersion` from client state
- [ ] Service layer validates `expectedVersion` matches database version
- [ ] Updates increment version: `version: { increment: 1 }`
- [ ] Concurrent modification errors include helpful message with both versions
- [ ] UI handles conflict errors with refresh prompt

### Automated Check

**grep commands for detection:**

```bash
# Find hardcoded version numbers
grep -rn "expectedVersion:\s*[0-9]" server/src apps/web/src
grep -rn "version:\s*1[^0-9]" server/src apps/web/src

# Find optimistic locking calls without version from state
grep -rn "approveRequest\|denyRequest\|updateDraft" apps/web/src | \
  grep -v "\.version\|state\.version\|data\.version"
```

**Test Pattern:**

```typescript
describe('Optimistic locking', () => {
  it('should reject stale version', async () => {
    // Create request (version 1)
    const request = await createTestRequest();

    // Modify it (version 2)
    await updateRequest(request.id, { note: 'updated' });

    // Try to approve with stale version
    const result = await request(app)
      .post(`/v1/project-hub/requests/${request.id}/approve`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ expectedVersion: 1 }); // Stale!

    expect(result.status).toBe(409);
    expect(result.body.error).toContain('modified');
    expect(result.body.currentVersion).toBe(2);
  });

  it('should accept current version', async () => {
    const request = await createTestRequest();

    const result = await request(app)
      .post(`/v1/project-hub/requests/${request.id}/approve`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ expectedVersion: request.version });

    expect(result.status).toBe(200);
    expect(result.body.version).toBe(request.version + 1);
  });
});
```

**Zod Schema Enforcement:**

```typescript
// packages/contracts/src/schemas/project-hub.schema.ts
export const ApproveRequestSchema = z.object({
  expectedVersion: z.number().int().min(1, 'Version must be positive integer'),
  response: z.string().optional(),
});

// No default value - forces client to provide version
```

---

## Quick Reference Card

### Before Writing Code

| Issue                          | Prevention                               | Automated Check                        |
| ------------------------------ | ---------------------------------------- | -------------------------------------- |
| Email auth on sensitive routes | Use signed tokens                        | grep for `findByEmail` in reset routes |
| Missing rate limiting          | Apply rate limiter to every route        | grep for routes without `Limiter`      |
| Unbounded queries              | Add `take` parameter                     | grep for `findMany` without `take`     |
| Sequential queries             | Use `Promise.all()` for independent data | Performance tests                      |
| Missing Zod safeParse          | First line of execute()                  | grep for `params as {`                 |
| Hardcoded versions             | Pass version from state                  | grep for `expectedVersion: [0-9]`      |

### Code Review Checklist

```markdown
## Security Review

- [ ] No email-based auth on sensitive operations
- [ ] All routes have rate limiting
- [ ] All list queries have pagination with max limit
- [ ] Independent queries parallelized
- [ ] Agent tools validate params with safeParse()
- [ ] Optimistic locking uses version from state
```

---

## Related Documentation

- [PREVENT-CRUD-ROUTE-VULNERABILITIES.md](./PREVENT-CRUD-ROUTE-VULNERABILITIES.md) - Rate limiting patterns
- [ZOD_PARAMETER_VALIDATION_PREVENTION.md](../patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md) - Full Zod validation guide
- [mais-critical-patterns.md](../patterns/mais-critical-patterns.md) - Core patterns
- [PREVENTION-QUICK-REFERENCE.md](../PREVENTION-QUICK-REFERENCE.md) - Print-and-pin cheat sheet

---

**Created:** 2026-01-21
**Last Updated:** 2026-01-21
**Maintainer:** Security Team
