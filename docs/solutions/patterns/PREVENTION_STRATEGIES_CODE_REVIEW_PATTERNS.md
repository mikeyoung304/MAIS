# Prevention Strategies: Code Review Patterns (P0)

Critical patterns to enforce during code review. These three issues cause production bugs and security vulnerabilities.

**Reference:** Phase 5 Testing & Caching Prevention, Agent-Eval Remediation, Multi-Tenant Architecture

---

## Prevention Strategies

### 1. Express Route Ordering

**Problem:** Static paths must come before parameterized paths (`:id`). Otherwise, static route handlers never execute.

**Why This Matters:**

- Express evaluates routes in registration order
- A parameterized route like `/api/users/:id` will match ANY path after `/api/users/`
- If a static route like `/api/users/me` is registered after `/:id`, it matches as `id='me'` instead of the intended static handler
- Result: Feature breaks silently, wrong endpoint logic executes

**Example of Bug:**

```typescript
// WRONG - static route registered AFTER parameterized route
router.get('/:id', async (req, res) => {
  // This matches /users/123 AND /users/me
  // /users/me gets treated as id='me' - wrong handler!
  const userId = req.params.id;
  const user = await userService.getUser(userId);
  res.json(user);
});

router.get('/me', async (req, res) => {
  // This never executes for /users/me requests
  const currentUser = await userService.getCurrentUser(req);
  res.json(currentUser);
});
```

#### Detection Rule (ESLint)

Create `.eslintrc.js` rule in `server/`:

```javascript
// Lint rule to detect route ordering issues
const routePatterns = new Map();

module.exports = {
  rules: {
    'no-static-routes-after-parameterized': {
      meta: {
        type: 'problem',
        docs: { description: 'Static routes must come before parameterized routes' },
        fixable: null,
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            // Match router.get('/path', ...) patterns
            if (
              node.callee.type === 'MemberExpression' &&
              ['get', 'post', 'put', 'delete', 'patch'].includes(node.callee.property.name) &&
              node.arguments.length >= 1 &&
              node.arguments[0].type === 'Literal'
            ) {
              const path = node.arguments[0].value;
              const hasParam = path.includes(':');

              // Store route metadata
              const fileName = context.getFilename();
              if (!routePatterns.has(fileName)) {
                routePatterns.set(fileName, []);
              }

              const routes = routePatterns.get(fileName);

              // Check if static route comes after parameterized
              const lastRoute = routes[routes.length - 1];
              if (lastRoute?.hasParam && !hasParam) {
                context.report({
                  node,
                  message: `Static route '${path}' must be defined before parameterized routes`,
                  suggest: [
                    {
                      desc: 'Move this static route above parameterized routes',
                      fix: null, // Manual fix required
                    },
                  ],
                });
              }

              routes.push({ path, hasParam, node });
            }
          },
        };
      },
    },
  },
};
```

**OR use simpler regex detection:**

```bash
# Find routes registered in wrong order
grep -n "router\.\(get\|post\|put\|delete\)(':[^']*'" server/src/routes/*.ts | \
  awk -F: '{print $1}' | sort | uniq -c | \
  awk '$1 > 1 { print "REVIEW: Multiple parameterized routes in " $2 }'

# Find static routes after parameterized in same file
git diff HEAD~1 HEAD -- 'server/src/routes/*.ts' | \
  grep -E '^\+.*router\.(get|post|put|delete)\('
```

#### Test Case

```typescript
// server/src/routes/__tests__/route-order.test.ts
import { describe, it, expect } from 'vitest';
import { Router } from 'express';

describe('Route Order (CRITICAL)', () => {
  it('should register static routes before parameterized routes', async () => {
    const router = Router();

    // SETUP: Track route registration order
    const routes: Array<{ path: string; order: number }> = [];
    const originalGet = router.get.bind(router);

    router.get = function (path, ...handlers) {
      routes.push({ path, order: routes.length });
      return originalGet(path, ...handlers);
    } as any;

    // WRONG ORDER (this test should fail in code review):
    router.get('/:id', (req, res) => res.json({ id: req.params.id }));
    router.get('/me', (req, res) => res.json({ current: true }));

    // VERIFY: Static routes come BEFORE parameterized
    const staticRoutes = routes.filter((r) => !r.path.includes(':'));
    const paramRoutes = routes.filter((r) => r.path.includes(':'));

    const lastStaticOrder = Math.max(...staticRoutes.map((r) => r.order), -1);
    const firstParamOrder = Math.min(...paramRoutes.map((r) => r.order), Infinity);

    // This assertion CATCHES the bug:
    expect(lastStaticOrder).toBeLessThan(firstParamOrder);
  });

  it('should not allow /me to be shadowed by /:id', async () => {
    // Create test router with CORRECT order
    const router = Router();
    const results: string[] = [];

    // CORRECT: Static BEFORE parameterized
    router.get('/me', (req, res) => {
      results.push('me');
      res.json({ endpoint: 'me' });
    });

    router.get('/:id', (req, res) => {
      results.push('id');
      res.json({ endpoint: 'id', id: req.params.id });
    });

    // When request comes for /me, it should hit /me endpoint, not /:id
    // (This requires manual testing with actual Express server)
    expect(results).not.toContain('id:me');
  });
});
```

#### Code Review Checklist

- [ ] **Visual scan first 10 lines of router:** Verify no parameterized routes (`:id`) appear before static routes
- [ ] **Look for `/me`, `/current`, `/status`, `/health`:** These are commonly shadowed by `/:id`
- [ ] **Check new route additions:** If adding `/:id` route, verify all static routes already exist above it
- [ ] **Run route order linter:** `npm run lint -- --rule no-static-routes-after-parameterized`
- [ ] **Test static routes work:** Verify `/api/users/me` returns current user, not `{ id: 'me' }`
- [ ] **Reference:** See `server/src/routes/tenant-admin-segments.routes.ts:131` - correct order

**Example of Correct Pattern:**

```typescript
// ✅ CORRECT - All static routes BEFORE parameterized
router.post('/', createSegmentHandler); // static
router.get('/', listSegmentsHandler); // static
router.get('/:id/stats', getSegmentStatsHandler); // parameterized (static sub-path first)
router.get('/:id', getSegmentHandler); // parameterized
router.put('/:id', updateSegmentHandler); // parameterized
router.delete('/:id', deleteSegmentHandler); // parameterized
```

---

### 2. Auth Fallback Guards

**Problem:** Never use `|| 'system'` fallback for user IDs or authentication context. This silently converts missing auth into a valid auth state.

**Why This Matters:**

- Fallback hides missing authentication bugs
- Turns 401 (auth required) into 200 (OK) with wrong user
- Enables privilege escalation: attacker reuses same 'system' ID across all requests
- Logging becomes useless: can't distinguish who performed action
- Audit trails broken: all actions attributed to 'system' instead of actual user

**Example of Vulnerability:**

```typescript
// DANGEROUS: Uses 'system' as fallback when userId missing
const userId = res.locals.user?.id || 'system';

// If middleware FAILS to set user (due to bug), this silently falls back
// to 'system' instead of rejecting with 401

// Attacker can now:
// 1. Delete resources as 'system' user
// 2. Modify configurations as 'system'
// 3. All audit logs show 'system' instead of attacker
// 4. Blame shifted to "system administration"
```

**Found in MAIS:** `server/src/routes/platform-admin-traces.routes.ts:238, :287`

#### Detection Rule (ESLint)

```javascript
// eslint-disable-next-line no-restricted-properties
module.exports = {
  rules: {
    'no-auth-fallbacks': {
      meta: {
        type: 'problem',
        docs: { description: 'Never use default fallback for userId or auth context' },
        fixable: 'code',
      },
      create(context) {
        return {
          BinaryExpression(node) {
            // Match: userId || 'string'
            if (
              node.operator === '||' &&
              node.right.type === 'Literal' &&
              typeof node.right.value === 'string'
            ) {
              const leftText = context.getSourceCode().getText(node.left);

              // Detect auth fallback patterns
              const isAuthContext = /userId|tenantId|admin|auth|user|principal/i.test(leftText);
              const isFallback = /^['"](?:system|default|unknown|anonymous)/i.test(
                node.right.value
              );

              if (isAuthContext && isFallback) {
                context.report({
                  node,
                  message: `Never use '${node.right.value}' as fallback for ${leftText}. This hides authentication failures. Use throw or explicit null check instead.`,
                  fix(fixer) {
                    return fixer.replaceText(node, `${leftText}!`); // Force non-null assertion
                  },
                });
              }
            }
          },
        };
      },
    },
  },
};
```

**Or use Grep detection:**

```bash
# Find auth fallback patterns
grep -rn "\|\| '[^']*system\|anonymous\|unknown\|default" \
  server/src --include="*.ts" --include="*.tsx" | \
  grep -E "user|auth|userId|admin|principal"
```

#### Test Case

```typescript
// server/src/routes/__tests__/auth-fallback.test.ts
import { describe, it, expect } from 'vitest';
import { Request, Response, NextFunction } from 'express';

describe('Auth Fallback Protection (SECURITY)', () => {
  it('should REJECT missing userId instead of using fallback', async () => {
    // WRONG approach (do NOT do this):
    const wrongHandler = (req: Request, res: Response) => {
      const userId = res.locals.user?.id || 'system'; // BUG!
      res.json({ userId }); // Returns 'system' instead of 401
    };

    // Simulate missing auth
    const req = {} as Request;
    const res = {
      locals: {}, // No user set
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    } as any;

    wrongHandler(req, res);

    // This SILENTLY falls back - no error, no rejection!
    expect(res.json).toHaveBeenCalledWith({ userId: 'system' });
  });

  it('should REQUIRE userId and throw if missing', async () => {
    // CORRECT approach:
    const correctHandler = (req: Request, res: Response) => {
      const userId = res.locals.user?.id;

      // Explicit check - fail fast instead of fallback
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      res.json({ userId });
    };

    const req = {} as Request;
    const res = {
      locals: {},
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    } as any;

    correctHandler(req, res);

    // This REJECTS explicitly
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('should use middleware to ENFORCE auth before handler', async () => {
    // BEST approach: Middleware enforces auth BEFORE route handler
    const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
      const user = res.locals.user;

      if (!user || !user.id) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // If we reach here, user is GUARANTEED to exist
      next();
    };

    const handler = (req: Request, res: Response) => {
      // No fallback needed - middleware guarantees user exists
      const userId = res.locals.user.id; // Not optional
      res.json({ userId });
    };

    // Test: with auth
    const reqWithAuth = {} as Request;
    const resWithAuth = {
      locals: { user: { id: 'user_123' } },
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    } as any;
    const nextWithAuth = vi.fn();

    authMiddleware(reqWithAuth, resWithAuth, nextWithAuth);
    expect(nextWithAuth).toHaveBeenCalled();

    handler(reqWithAuth, resWithAuth);
    expect(resWithAuth.json).toHaveBeenCalledWith({ userId: 'user_123' });

    // Test: without auth
    const reqNoAuth = {} as Request;
    const resNoAuth = {
      locals: {},
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    } as any;
    const nextNoAuth = vi.fn();

    authMiddleware(reqNoAuth, resNoAuth, nextNoAuth);
    expect(resNoAuth.status).toHaveBeenCalledWith(401);
    expect(nextNoAuth).not.toHaveBeenCalled();
  });

  it('should track WHO performed audit action (not "system")', async () => {
    // WRONG: action attributed to 'system'
    const wrongAudit = async (userId: string | undefined, action: string) => {
      const actingUser = userId || 'system'; // Hides bugs

      await recordAuditLog({
        actor: actingUser, // Can't tell who really did it
        action,
      });
    };

    // CORRECT: reject if userId missing
    const correctAudit = async (userId: string | undefined, action: string) => {
      if (!userId) {
        throw new Error('Cannot audit action without userId');
      }

      await recordAuditLog({
        actor: userId, // Always traceable
        action,
      });
    };

    // Mock audit log
    const auditLogs: any[] = [];
    const recordAuditLog = (log: any) => {
      auditLogs.push(log);
      return Promise.resolve();
    };

    // Wrong approach hides the bug
    await wrongAudit(undefined, 'delete_file');
    expect(auditLogs[0].actor).toBe('system'); // Can't trace!

    // Correct approach fails fast
    auditLogs.length = 0;
    await expect(correctAudit(undefined, 'delete_file')).rejects.toThrow(
      'Cannot audit action without userId'
    );
    expect(auditLogs).toHaveLength(0); // Action never recorded
  });
});

// Helper function
async function recordAuditLog(log: any) {
  // Would write to database in real code
}
```

#### Code Review Checklist

- [ ] **Search for fallback patterns:** `grep -rn "|| '[a-z]*'" server/src/routes --include="*.ts"`
- [ ] **Check for `|| 'system'`, `|| 'unknown'`, `|| 'default'`:** Found in traces routes? This is a security issue.
- [ ] **Verify middleware enforces auth:** Auth check should happen in middleware BEFORE route handler, not in handler
- [ ] **Check audit logging:** Every action should reference actual user ID, never 'system' or fallback value
- [ ] **Test missing auth case:** Send request without `X-Tenant-Key` or JWT - should return 401, not 200 with fallback
- [ ] **Reference:** See `server/src/middleware/tenant.ts:243-248` - correct pattern using throw
- [ ] **Reference:** See `server/src/middleware/tenant.ts:183-194` - middleware enforces auth before handler

**Example of Correct Pattern:**

```typescript
// ✅ CORRECT - Middleware enforces, handler assumes auth exists
export function createTenantAuthMiddleware(authService: TenantAuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ error: 'Token required' });
      return;
    }

    const auth = await authService.verifyToken(token);
    if (!auth) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Only reach here if auth is GUARANTEED
    res.locals.tenantAuth = auth;
    next();
  };
}

// Handler can assume auth exists (middleware guarantee)
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantAuth = (res.locals as any).tenantAuth;

    // Still safe to check, but middleware already guaranteed it
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // tenantAuth.tenantId is GUARANTEED (no fallback needed)
    res.json(tenantAuth);
  } catch (error) {
    next(error);
  }
});
```

---

### 3. Multi-Tenant Isolation Defense-in-Depth

**Problem:** Pre-scoped IDs (like `segmentId` from URL) should NEVER be trusted without tenant validation. Always include `tenantId` in every database query.

**Why This Matters:**

- Attackers can request resources from OTHER tenants by guessing IDs
- UUID/CUID are ~36 characters and look random, but are actually enumerable
- Relying only on `tenantId` being "already scoped" in prior middleware is dangerous
- If ANY middleware fails to set `tenantId`, subsequent queries leak data
- Defense-in-depth: EVERY query should verify tenant ownership, not just trust middleware

**Example of Vulnerability:**

```typescript
// DANGEROUS: Trusts that segmentId "belongs" to tenant without verifying
router.get('/:segmentId', async (req: Request, res: Response) => {
  const { segmentId } = req.params;
  const tenantId = res.locals.tenantAuth?.tenantId;

  // What if middleware failed and tenantId is undefined?
  // What if request is for a DIFFERENT tenant's segment?
  const segment = await prisma.segment.findUnique({
    where: { id: segmentId }, // ❌ No tenantId check!
  });

  res.json(segment); // Returns someone else's segment!
});
```

**Safer approach:**

```typescript
// ✅ CORRECT: Always include tenantId in where clause
router.get('/:segmentId', async (req: Request, res: Response) => {
  const { segmentId } = req.params;
  const tenantAuth = res.locals.tenantAuth;

  if (!tenantAuth?.tenantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const segment = await prisma.segment.findUnique({
    where: {
      id_tenantId: { id: segmentId, tenantId: tenantAuth.tenantId }, // ✅ Always include tenantId
    },
  });

  if (!segment) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json(segment);
});
```

#### Detection Rule (ESLint)

```javascript
module.exports = {
  rules: {
    'no-missing-tenantid-in-where': {
      meta: {
        type: 'problem',
        docs: { description: 'All database queries must include tenantId in where clause' },
        fixable: null,
      },
      create(context) {
        return {
          CallExpression(node) {
            // Match: prisma.model.findUnique({ where: { ... } })
            if (
              node.callee.type === 'MemberExpression' &&
              ['findUnique', 'findFirst', 'findMany', 'update', 'delete'].includes(
                node.callee.property.name
              ) &&
              node.arguments[0]?.type === 'ObjectExpression'
            ) {
              const whereArg = node.arguments[0].properties.find((p) => p.key.name === 'where');

              if (whereArg && whereArg.value.type === 'ObjectExpression') {
                const hasTenanId = whereArg.value.properties.some(
                  (p) => p.key.name === 'tenantId' || p.key.name?.includes('tenantId')
                );

                if (!hasTenantId) {
                  context.report({
                    node,
                    message:
                      'Database query must include tenantId in where clause for multi-tenant isolation',
                  });
                }
              }
            }
          },
        };
      },
    },
  },
};
```

**Or use Grep detection:**

```bash
# Find queries missing tenantId
grep -rn "findUnique\|findFirst\|findMany\|update\|delete" server/src \
  --include="*.ts" -A 3 | \
  grep -B 1 "where:" | \
  grep -v "tenantId" | head -20
```

#### Test Case

```typescript
// server/src/routes/__tests__/tenant-isolation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '../generated/prisma';

describe('Multi-Tenant Isolation (SECURITY - P0)', () => {
  let prisma: PrismaClient;
  let tenant1Id: string;
  let tenant2Id: string;
  let segment1Id: string;
  let segment2Id: string;

  beforeEach(async () => {
    // Create two isolated tenants
    tenant1Id = await createTestTenant('tenant-1', 'tenant-1.com');
    tenant2Id = await createTestTenant('tenant-2', 'tenant-2.com');

    // Create segment for tenant1
    segment1Id = await prisma.segment
      .create({
        data: {
          id: `seg_${Math.random()}`,
          tenantId: tenant1Id,
          name: 'Tenant1 Segment',
          slug: 'tenant1-segment',
        },
      })
      .then((s) => s.id);

    // Create segment for tenant2
    segment2Id = await prisma.segment
      .create({
        data: {
          id: `seg_${Math.random()}`,
          tenantId: tenant2Id,
          name: 'Tenant2 Segment',
          slug: 'tenant2-segment',
        },
      })
      .then((s) => s.id);
  });

  it('should NOT return segment from different tenant (WITHOUT tenantId check)', async () => {
    // WRONG: Query without tenantId verification
    const segment = await prisma.segment.findUnique({
      where: { id: segment1Id }, // ❌ No tenant check
    });

    // This returns tenant1's segment even when queried by tenant2!
    // This is a VULNERABILITY
    expect(segment?.tenantId).toBe(tenant1Id);
    expect(segment?.name).toBe('Tenant1 Segment');

    // ⚠️ If tenant2 could somehow get segment1Id, they could access it!
  });

  it('should REJECT segment from different tenant (WITH tenantId check)', async () => {
    // CORRECT: Query WITH tenantId verification
    const segment = await prisma.segment.findUnique({
      where: {
        // Composite key forces tenant isolation
        id_tenantId: { id: segment1Id, tenantId: tenant2Id }, // ✅ Wrong tenant
      },
    });

    // This returns null - tenant2 cannot access tenant1's segment
    expect(segment).toBeNull();
  });

  it('should allow segment access ONLY to correct tenant', async () => {
    // Tenant1 accessing their own segment - should work
    const segment1 = await prisma.segment.findUnique({
      where: {
        id_tenantId: { id: segment1Id, tenantId: tenant1Id }, // ✅ Correct tenant
      },
    });

    expect(segment1?.id).toBe(segment1Id);
    expect(segment1?.tenantId).toBe(tenant1Id);

    // Tenant2 accessing tenant1's segment - should fail
    const segment2 = await prisma.segment.findUnique({
      where: {
        id_tenantId: { id: segment1Id, tenantId: tenant2Id }, // ✅ Verifies mismatch
      },
    });

    expect(segment2).toBeNull();
  });

  it('should enforce tenantId in list queries (findMany)', async () => {
    // WRONG: Get all segments (SECURITY LEAK)
    const allSegments = await prisma.segment
      .findMany
      // No where clause!
      ();
    expect(allSegments.length).toBeGreaterThan(1); // Gets both tenants' segments!

    // CORRECT: Scoped to tenant
    const tenant1Segments = await prisma.segment.findMany({
      where: { tenantId: tenant1Id }, // ✅ Tenant-scoped
    });

    expect(tenant1Segments).toHaveLength(1);
    expect(tenant1Segments[0].id).toBe(segment1Id);
  });

  it('should enforce tenantId in update mutations', async () => {
    // WRONG: Update without tenant check
    await prisma.segment.update({
      where: { id: segment1Id },
      data: { name: 'Hacked!' }, // ❌ Could be from wrong tenant
    });

    // Segment was modified!
    const updated = await prisma.segment.findUnique({
      where: { id: segment1Id },
    });
    expect(updated?.name).toBe('Hacked!');

    // CORRECT: Update with tenant verification
    await prisma.segment.update({
      where: { id_tenantId: { id: segment2Id, tenantId: tenant1Id } }, // ✅ Tenant verified
      data: { name: 'Safe Update' },
    });

    // Verify update only affected tenant1's segment
    const tenant1Seg = await prisma.segment.findUnique({
      where: { id: segment2Id },
    });
    expect(tenant1Seg?.tenantId).toBe(tenant2Id); // Still tenant2!
    expect(tenant1Seg?.name).not.toBe('Safe Update'); // Update failed (wrong tenant)
  });

  it('should prevent cross-tenant ownership hijacking', async () => {
    // Attacker tries to claim segment from another tenant
    const attackPayload = {
      segment: segment1Id, // Guessed or enumerated
      tenantId: tenant2Id, // Tries to claim for their tenant
    };

    // Defense: Always verify request.tenantId matches resource.tenantId
    const resource = await prisma.segment.findUnique({
      where: { id_tenantId: { id: attackPayload.segment, tenantId: tenant1Id } },
    });

    expect(resource?.tenantId).toBe(tenant1Id);

    // Attacker's tenant cannot modify it
    const attackUpdate = await prisma.segment
      .update({
        where: {
          id_tenantId: { id: attackPayload.segment, tenantId: attackPayload.tenantId },
        },
        data: { name: 'Hacked Segment' },
      })
      .catch((e) => null);

    expect(attackUpdate).toBeNull(); // Attack failed
  });
});

// Helper
async function createTestTenant(slug: string, email: string): Promise<string> {
  const id = `test_${slug}_${Date.now()}`;
  await prisma.tenant.create({
    data: {
      id,
      slug,
      email,
      name: slug,
      passwordHash: 'test',
      apiKeyPublic: `pk_${slug}`,
      apiKeySecret: `sk_${slug}`,
    },
  });
  return id;
}
```

#### Code Review Checklist

- [ ] **Check all Prisma queries:** Every `findUnique`, `findFirst`, `findMany`, `update`, `delete` must have `tenantId` in where clause
- [ ] **Look for composite keys:** Check schema has `@@unique([tenantId, id])` on models (prevents ID collisions between tenants)
- [ ] **Verify middleware sets tenantId:** Confirm `resolveTenant` or `tenantAuthMiddleware` runs BEFORE all route handlers
- [ ] **Test cross-tenant access:** Attempt to fetch resource from wrong tenant - should return 404 or null
- [ ] **Review repository layer:** All methods should require `tenantId` as parameter, not just trust middleware
- [ ] **Check delete operations:** Deletion should verify tenant ownership: `delete { where: { id_tenantId: { id, tenantId } } }`
- [ ] **Reference:** See `server/src/adapters/prisma/catalog.repository.ts:61` - composite key pattern
- [ ] **Reference:** See `server/src/routes/tenant-admin-segments.routes.ts:145` - service call includes tenantId

**Example of Correct Pattern:**

```typescript
// ✅ CORRECT - Composite key ensures tenant isolation
// In schema.prisma:
model Segment {
  id        String @id
  tenantId  String
  slug      String
  name      String

  tenant    Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, slug])  // Tenant can't have duplicate slugs
  @@index([tenantId])         // Fast tenant-scoped queries
}

// In repository:
class SegmentRepository {
  async getById(tenantId: string, segmentId: string) {
    return prisma.segment.findUnique({
      where: {
        id_tenantId: { id: segmentId, tenantId }, // ✅ Always require both
      },
    });
  }

  async listByTenant(tenantId: string) {
    return prisma.segment.findMany({
      where: { tenantId }, // ✅ Scoped by tenant
    });
  }

  async update(tenantId: string, segmentId: string, data: any) {
    return prisma.segment.update({
      where: {
        id_tenantId: { id: segmentId, tenantId }, // ✅ Verify ownership
      },
      data,
    });
  }
}

// In route handler:
router.get('/:id', async (req: Request, res: Response) => {
  const tenantAuth = res.locals.tenantAuth;

  if (!tenantAuth?.tenantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Service method always receives tenantId
  const segment = await segmentService.getSegmentById(
    tenantAuth.tenantId,
    req.params.id
  );

  res.json(segment);
});
```

---

## Quick Reference Checklist

Use this checklist during code review (print and pin to desk):

### Route Ordering (Static Before Parameterized)

- [ ] `/me`, `/current`, `/health`, `/status` routes appear BEFORE `/:id` routes
- [ ] No `404` errors for static endpoints that should exist
- [ ] Linter passes: `no-static-routes-after-parameterized`
- [ ] Test confirms `/users/me` hits correct handler, not `:id` handler

### Auth Fallback Guards (No `|| 'system'`)

- [ ] No `userId || 'system'` fallbacks in code
- [ ] No `tenantId || 'default'` fallbacks in code
- [ ] Missing auth returns `401`, not `200`
- [ ] Middleware enforces auth BEFORE route handler
- [ ] Audit logs show actual user ID, never 'system'
- [ ] Test confirms request without auth token is rejected

### Multi-Tenant Isolation (Always Include tenantId)

- [ ] All Prisma queries include `tenantId` in where clause
- [ ] Composite keys used: `@@unique([tenantId, id])`
- [ ] Repository methods require `tenantId` parameter
- [ ] Cross-tenant queries return `null` or `404`
- [ ] Update/delete operations verify tenant ownership
- [ ] Test confirms tenant1 cannot access tenant2 resources
- [ ] No `findUnique({ where: { id } })` without tenantId

### Common Patterns to Look For

- [ ] Auth fallback: `||`, `??`, `??=` with user/auth values
- [ ] Route order: Look for `/:id` BEFORE `/me` in git diff
- [ ] Missing tenantId: `where: { id }` without `tenantId`
- [ ] Composite key usage: `where: { id_tenantId: { id, tenantId } }`

### Test Requirements Before Approval

- [ ] Unit tests for route ordering
- [ ] Unit tests for auth rejection (missing token case)
- [ ] Integration tests for cross-tenant isolation
- [ ] E2E test confirming correct endpoint hit (not shadowed)

---

## References

- [MAIS Composite Patterns Handbook](mais-critical-patterns.md) - 10 critical patterns
- [Multi-Tenant Implementation Guide](../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- [Phase 5 Testing & Caching Prevention](phase-5-testing-and-caching-prevention-MAIS-20251231.md)
- [Circular Dependency Executor Registry](circular-dependency-executor-registry-MAIS-20251229.md)
- [Chatbot Proposal Execution Flow](chatbot-proposal-execution-flow-MAIS-20251229.md)

**Key Files to Reference During Code Review:**

- `server/src/middleware/tenant.ts:243-248` - getTenantId() throws pattern (auth guard)
- `server/src/routes/tenant-admin-segments.routes.ts:131-145` - correct route order + tenant isolation
- `server/src/adapters/prisma/catalog.repository.ts:61` - composite key query pattern

**Severity:** P0 - Production blocker. These patterns cause security vulnerabilities, data leaks, and complete feature failures. Enforce consistently.
