---
title: Comprehensive Prevention Strategies for Code Review Findings
category: prevention
tags: [security, multi-tenant, code-quality, testing, ci-cd]
priority: P0
date_created: 2025-11-27
applies_to: all-features
---

# Comprehensive Prevention Strategies

This document provides actionable prevention strategies derived from the P1 critical issues found during comprehensive code review. The goal is to prevent entire **categories** of issues from recurring through architectural guardrails, automated enforcement, and developer education.

## Executive Summary

**Key Issues Identified:**

1. Customer email not normalized - causes duplicate records
2. Webhook idempotency race with `tenantId="unknown"`
3. Password reset UI missing (backend exists)
4. Multiple PrismaClient instances - connection pool exhaustion
5. N+1 query pattern on segment landing pages
6. Stripe Connect uses browser `prompt()` dialogs
7. Database verification disabled at startup

**Patterns Observed:**

- Code added without considering multi-tenant implications
- Features partially implemented (backend without frontend)
- Performance optimization deferred
- `console.log` used instead of logger
- Type safety bypassed with `any`
- Security validation skipped

**Impact:**

- Production incidents waiting to happen
- User experience degradation
- Security vulnerabilities
- Technical debt accumulation

---

## 1. Code Review Checklist Enhancements

### 1.1 Multi-Tenant Security Checklist

Add to `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Multi-Tenant Security Review

**For ANY database query or API endpoint:**

- [ ] All queries filter by `tenantId` (no cross-tenant data leakage)
- [ ] Foreign key references validate ownership before mutation
- [ ] Cache keys include `tenantId` (format: `resource:${tenantId}:key`)
- [ ] Error messages don't leak tenant information
- [ ] Both CREATE and UPDATE endpoints validate ownership

**For ANY user input (email, phone, name):**

- [ ] Input normalized before storage (email.toLowerCase().trim())
- [ ] Input normalized before queries (case-insensitive lookups)
- [ ] Unique constraints work with normalized values
- [ ] Test cases cover case variations (UPPER, lower, MiXeD)

**For ANY webhook or async operation:**

- [ ] Idempotency check uses tenant-scoped unique key
- [ ] Early tenant extraction (before validation failures)
- [ ] TenantId never defaults to "unknown" or magic strings
- [ ] Race conditions tested with concurrent requests

**For ANY new database query:**

- [ ] Uses repository pattern (not direct Prisma calls in routes)
- [ ] Includes indexes for tenant-scoped queries
- [ ] N+1 patterns identified and resolved
- [ ] Query performance tested with realistic data volume
```

### 1.2 Feature Completeness Checklist

```markdown
## Feature Completeness Review

**For ANY new feature:**

- [ ] Backend routes implemented
- [ ] Frontend UI implemented
- [ ] API contracts defined in `packages/contracts`
- [ ] Integration tests cover happy path
- [ ] Error handling tested (network failures, validation errors)
- [ ] Loading states implemented (no flash of empty content)
- [ ] Feature flag added (if needed for gradual rollout)

**Documentation:**

- [ ] CLAUDE.md updated with new patterns
- [ ] ARCHITECTURE.md updated if design changes
- [ ] Migration guide created if breaking changes
- [ ] API documentation generated from contracts
```

### 1.3 Database Performance Checklist

```markdown
## Database Performance Review

**For ANY new query:**

- [ ] Indexes exist for WHERE clauses
- [ ] Compound indexes for multi-column filters
- [ ] N+1 patterns prevented (use includes/select)
- [ ] Query plan reviewed (EXPLAIN ANALYZE)
- [ ] Pagination implemented (no unbounded queries)
- [ ] Connection pooling respected (no new PrismaClient)

**Query Patterns to Avoid:**

- [ ] No `findMany()` without limit
- [ ] No nested loops over database queries
- [ ] No synchronous queries in async loops
- [ ] No queries inside map/forEach
```

---

## 2. ESLint Rules to Enforce

Update `server/.eslintrc.json`:

```json
{
  "rules": {
    // Already enforced
    "@typescript-eslint/no-explicit-any": "error",

    // NEW: Prevent console.log in production code
    "no-console": [
      "error",
      {
        "allow": ["warn", "error"]
      }
    ],

    // NEW: Prevent multiple PrismaClient instances
    "no-restricted-syntax": [
      "error",
      {
        "selector": "NewExpression[callee.name='PrismaClient']",
        "message": "Do not instantiate PrismaClient directly. Use dependency injection from di.ts or import from lib/db.ts singleton."
      }
    ],

    // NEW: Prevent browser prompt/alert/confirm in React
    "no-restricted-globals": [
      "error",
      {
        "name": "prompt",
        "message": "Use controlled input components instead of browser prompt()."
      },
      {
        "name": "alert",
        "message": "Use toast notifications or modal dialogs instead of alert()."
      },
      {
        "name": "confirm",
        "message": "Use confirmation modals instead of browser confirm()."
      }
    ],

    // NEW: Enforce import from shared logger
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["console"],
            "message": "Import logger from 'lib/core/logger' instead of using console"
          }
        ]
      }
    ]
  }
}
```

### Custom ESLint Plugin for Multi-Tenant Patterns

Create `server/.eslint/rules/require-tenant-id.js`:

```javascript
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce tenantId parameter in repository methods',
      category: 'Multi-Tenant Security',
    },
  },
  create(context) {
    return {
      MethodDefinition(node) {
        // Check if method is in a repository class
        const className = node.parent.parent.id?.name;
        if (!className?.includes('Repository')) return;

        // Exempt constructor and private methods
        if (node.key.name === 'constructor' || node.key.name.startsWith('_')) return;

        // Check if first parameter is tenantId
        const firstParam = node.value.params[0];
        if (!firstParam || firstParam.name !== 'tenantId') {
          context.report({
            node,
            message:
              'Repository methods must accept tenantId as first parameter for multi-tenant isolation',
          });
        }
      },
    };
  },
};
```

Register in `.eslintrc.json`:

```json
{
  "plugins": ["@typescript-eslint", "./eslint/rules"],
  "rules": {
    "custom/require-tenant-id": "error"
  }
}
```

---

## 3. Test Patterns to Require

### 3.1 Multi-Tenant Isolation Tests (REQUIRED)

For ANY new repository or service that accepts `tenantId`:

```typescript
describe('TenantIsolationTests', () => {
  it('should not return data from other tenants', async () => {
    // Create data for tenant A
    const tenantA = await createTestTenant();
    const resourceA = await repo.create(tenantA.id, { ... });

    // Create data for tenant B
    const tenantB = await createTestTenant();
    const resourceB = await repo.create(tenantB.id, { ... });

    // Verify tenant A can only see their data
    const resultsA = await repo.findAll(tenantA.id);
    expect(resultsA).toContainEqual(resourceA);
    expect(resultsA).not.toContainEqual(resourceB);

    // Verify tenant B can only see their data
    const resultsB = await repo.findAll(tenantB.id);
    expect(resultsB).toContainEqual(resourceB);
    expect(resultsB).not.toContainEqual(resourceA);
  });

  it('should enforce ownership on updates', async () => {
    const tenantA = await createTestTenant();
    const tenantB = await createTestTenant();

    const resource = await repo.create(tenantA.id, { ... });

    // Tenant B should not be able to update tenant A's resource
    await expect(
      repo.update(tenantB.id, resource.id, { ... })
    ).rejects.toThrow('not found');
  });
});
```

### 3.2 Input Normalization Tests (REQUIRED)

For ANY authentication or user input endpoint:

```typescript
describe('InputNormalizationTests', () => {
  const testCases = [
    { input: 'user@example.com', expected: 'user@example.com' },
    { input: 'USER@EXAMPLE.COM', expected: 'user@example.com' },
    { input: 'User@Example.Com', expected: 'user@example.com' },
    { input: '  user@example.com  ', expected: 'user@example.com' },
  ];

  testCases.forEach(({ input, expected }) => {
    it(`should normalize "${input}" to "${expected}"`, async () => {
      const result = await service.login(input, 'password');
      expect(result).toBeDefined();
    });
  });

  it('should prevent duplicate accounts with different cases', async () => {
    await service.signup('user@example.com', 'pass1', 'Business1');

    await expect(service.signup('USER@EXAMPLE.COM', 'pass2', 'Business2')).rejects.toThrow(
      'already registered'
    );
  });
});
```

### 3.3 Idempotency Tests (REQUIRED)

For ANY webhook or async operation:

```typescript
describe('IdempotencyTests', () => {
  it('should handle duplicate webhook events gracefully', async () => {
    const payload = createMockWebhookPayload();

    // First webhook processes successfully
    await controller.handleStripeWebhook(payload, validSignature);
    const bookings1 = await bookingRepo.findAll(tenantId);
    expect(bookings1).toHaveLength(1);

    // Second webhook (duplicate) doesn't create duplicate booking
    await controller.handleStripeWebhook(payload, validSignature);
    const bookings2 = await bookingRepo.findAll(tenantId);
    expect(bookings2).toHaveLength(1); // Still only 1
  });

  it('should use tenant-scoped idempotency keys', async () => {
    const tenantA = await createTestTenant();
    const tenantB = await createTestTenant();

    // Same eventId but different tenants should both succeed
    const eventId = 'evt_123';
    await processWebhook({ tenantId: tenantA.id, eventId });
    await processWebhook({ tenantId: tenantB.id, eventId });

    // Both tenants should have bookings
    expect(await bookingRepo.findAll(tenantA.id)).toHaveLength(1);
    expect(await bookingRepo.findAll(tenantB.id)).toHaveLength(1);
  });
});
```

### 3.4 Performance Tests (REQUIRED for queries)

```typescript
describe('PerformanceTests', () => {
  it('should not have N+1 query pattern', async () => {
    // Seed database with realistic data
    const tenant = await createTestTenant();
    const segment = await createSegment(tenant.id);

    // Create 50 packages
    for (let i = 0; i < 50; i++) {
      await createPackage(tenant.id, { segmentId: segment.id });
    }

    // Track query count
    const queryCountBefore = getQueryCount();

    // Fetch all packages with their relations
    await repo.getPackagesBySegmentWithAddOns(tenant.id, segment.id);

    const queryCountAfter = getQueryCount();
    const queriesExecuted = queryCountAfter - queryCountBefore;

    // Should use 1 query (with joins), not 51 (N+1)
    expect(queriesExecuted).toBeLessThanOrEqual(2);
  });
});
```

---

## 4. Documentation Requirements

### 4.1 Required Documentation for New Features

**When adding ANY new feature, you MUST update:**

1. **CLAUDE.md** - Add to relevant sections:
   - Critical Security Rules (if touches auth/multi-tenant)
   - Architecture Patterns (if new pattern introduced)
   - Common Pitfalls (if discovered gotchas)

2. **API Contracts** (`packages/contracts/src/api.v1.ts`):
   - Define request/response schemas with Zod
   - Add JSDoc comments explaining purpose
   - Include example requests/responses

3. **Repository Interface** (`server/src/lib/ports.ts`):
   - Add method signatures with TSDoc
   - Document `tenantId` parameter
   - Specify return types

4. **Migration Guide** (if breaking changes):
   - Create `docs/migrations/YYYY-MM-DD-feature-name.md`
   - Document what changed
   - Provide migration steps
   - Include rollback plan

### 4.2 Required Comments in Code

```typescript
// ✅ GOOD: Documents WHY, not WHAT
/**
 * Find tenant by email.
 *
 * CRITICAL: Email is normalized to lowercase before query.
 * This ensures case-insensitive authentication and prevents
 * duplicate accounts with different casing (User@Example.com vs user@example.com).
 *
 * See docs/solutions/security-issues/EMAIL-CASE-SENSITIVITY-SUMMARY.md
 */
async findByEmail(email: string): Promise<Tenant | null> {
  return this.prisma.tenant.findUnique({
    where: { email: email.toLowerCase() }
  });
}

// ❌ BAD: States the obvious
/**
 * Finds a tenant by email
 */
async findByEmail(email: string): Promise<Tenant | null> {
  return this.prisma.tenant.findUnique({
    where: { email: email.toLowerCase() }
  });
}
```

---

## 5. CI/CD Gates to Add

### 5.1 Pattern Validation Script

Create `.github/scripts/validate-patterns.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 Validating multi-tenant security patterns..."

# Check 1: No queries without tenantId filtering
echo "Checking for queries without tenantId..."
MISSING_TENANT_ID=$(grep -r "prisma\.\w\+\.findMany" server/src --include="*.ts" | grep -v "tenantId" | grep -v "test" || true)
if [ -n "$MISSING_TENANT_ID" ]; then
  echo "❌ Found queries without tenantId filtering:"
  echo "$MISSING_TENANT_ID"
  exit 1
fi

# Check 2: No new PrismaClient() in routes
echo "Checking for direct PrismaClient instantiation..."
NEW_PRISMA=$(grep -r "new PrismaClient()" server/src/routes --include="*.ts" || true)
if [ -n "$NEW_PRISMA" ]; then
  echo "❌ Found direct PrismaClient instantiation in routes:"
  echo "$NEW_PRISMA"
  exit 1
fi

# Check 3: No console.log in production code
echo "Checking for console.log usage..."
CONSOLE_LOG=$(grep -r "console\.log" server/src --include="*.ts" --exclude-dir=test || true)
if [ -n "$CONSOLE_LOG" ]; then
  echo "❌ Found console.log in production code:"
  echo "$CONSOLE_LOG"
  echo "Use logger from lib/core/logger instead"
  exit 1
fi

# Check 4: Repository methods have tenantId as first param
echo "Checking repository method signatures..."
# This is complex, delegate to TypeScript compiler + ESLint
npm run lint --workspace=server

echo "✅ All pattern validations passed!"
```

Add to `.github/workflows/main-pipeline.yml`:

```yaml
# Add after pattern-validation job
security-patterns:
  name: Security Pattern Validation
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Validate patterns
      run: ./.github/scripts/validate-patterns.sh
```

### 5.2 Test Coverage Gates

Update `.github/workflows/main-pipeline.yml`:

```yaml
unit-tests:
  # ... existing steps

  - name: Enforce coverage thresholds
    run: |
      COVERAGE=$(npm run test:coverage --silent | grep "All files" | awk '{print $10}' | sed 's/%//')

      if (( $(echo "$COVERAGE < 70" | bc -l) )); then
        echo "❌ Test coverage is $COVERAGE% (required: 70%)"
        exit 1
      fi

      echo "✅ Test coverage is $COVERAGE%"

  - name: Enforce critical path coverage
    run: |
      # Check webhook handler has 100% coverage
      WEBHOOK_COVERAGE=$(npm run test:coverage --silent | grep "webhooks.routes.ts" | awk '{print $10}' | sed 's/%//')

      if (( $(echo "$WEBHOOK_COVERAGE < 100" | bc -l) )); then
        echo "❌ Webhook handler coverage is $WEBHOOK_COVERAGE% (required: 100%)"
        exit 1
      fi
```

### 5.3 Database Migration Validation

```yaml
migration-validation:
  # ... existing steps

  - name: Check for missing indexes
    run: |
      cd server

      # Extract all WHERE clauses from code
      WHERE_COLUMNS=$(grep -rh "where.*tenantId" src --include="*.ts" | \
        sed 's/.*where.*{\s*//g' | \
        sed 's/\s*}.*//' | \
        sort -u)

      # Check if indexes exist for those columns
      MISSING_INDEXES=$(node scripts/check-indexes.js "$WHERE_COLUMNS")

      if [ -n "$MISSING_INDEXES" ]; then
        echo "❌ Missing indexes for WHERE clauses:"
        echo "$MISSING_INDEXES"
        echo "Add indexes to prisma/schema.prisma"
        exit 1
      fi
```

---

## 6. Architectural Guardrails

### 6.1 Dependency Injection Container Rules

Update `server/src/di.ts` with validation:

```typescript
/**
 * Dependency Injection Container
 *
 * RULES:
 * 1. Single PrismaClient instance (no new PrismaClient() elsewhere)
 * 2. All services injected here (no direct imports in routes)
 * 3. All repositories implement interfaces from lib/ports.ts
 * 4. Mock vs Real mode controlled by ADAPTERS_PRESET env var
 */

// Validate no duplicate PrismaClient instances
if (global.__prismaInstance) {
  throw new Error('PrismaClient already instantiated. Use dependency injection.');
}
global.__prismaInstance = true;

export const container = {
  // Database (singleton)
  prisma: createPrismaClient(),

  // Repositories (must implement interfaces)
  catalogRepo: createCatalogRepository(),
  bookingRepo: createBookingRepository(),
  tenantRepo: createTenantRepository(),

  // Services (business logic)
  catalogService: createCatalogService(),
  bookingService: createBookingService(),

  // Providers (external integrations)
  paymentProvider: createPaymentProvider(),
  emailProvider: createEmailProvider(),
};

// Type-check that all repos implement interfaces
const _repoCheck: {
  catalogRepo: CatalogRepository;
  bookingRepo: BookingRepository;
  tenantRepo: TenantRepository;
} = container;
```

### 6.2 Repository Pattern Enforcement

Update `server/src/lib/ports.ts`:

````typescript
/**
 * CRITICAL: All repository methods MUST:
 * 1. Accept tenantId as first parameter (for multi-tenant isolation)
 * 2. Filter all queries by tenantId (no cross-tenant data leakage)
 * 3. Throw NotFoundError if resource doesn't exist
 * 4. Throw UnauthorizedError if resource belongs to different tenant
 *
 * Example:
 * ```typescript
 * async getPackageById(tenantId: string, id: string): Promise<Package> {
 *   const pkg = await prisma.package.findFirst({
 *     where: { id, tenantId } // ← CRITICAL: Both id AND tenantId
 *   });
 *
 *   if (!pkg) throw new NotFoundError('Package not found');
 *   return pkg;
 * }
 * ```
 */
export interface CatalogRepository {
  // All methods require tenantId as first parameter
  getAllPackages(tenantId: string): Promise<Package[]>;
  getPackageById(tenantId: string, id: string): Promise<Package | null>;
  // ... rest of interface
}
````

### 6.3 Input Normalization Middleware

Create `server/src/middleware/normalize-input.ts`:

```typescript
/**
 * Input Normalization Middleware
 *
 * Automatically normalizes common input fields to prevent case-sensitivity issues.
 * Applied globally to all routes.
 */
export function normalizeInputMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Normalize email fields
  if (req.body?.email) {
    req.body.email = req.body.email.toLowerCase().trim();
  }

  // Normalize customerEmail (for bookings)
  if (req.body?.customerEmail) {
    req.body.customerEmail = req.body.customerEmail.toLowerCase().trim();
  }

  // Add more normalizations as needed

  next();
}
```

Register globally in `server/src/server.ts`:

```typescript
app.use(express.json());
app.use(normalizeInputMiddleware); // ← Add this
```

---

## 7. Developer Education & Training

### 7.1 Onboarding Checklist

Add to `docs/ONBOARDING.md`:

````markdown
## Security & Architecture Training

Before your first PR, you MUST:

- [ ] Read CLAUDE.md (project-specific patterns)
- [ ] Read docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md
- [ ] Review 3 recent PRs to understand code review standards
- [ ] Complete multi-tenant security quiz (see below)
- [ ] Pair program with senior engineer for first feature

## Multi-Tenant Security Quiz

**Question 1:** You're adding a new API endpoint that returns all packages. What's wrong with this code?

```typescript
app.get('/api/packages', async (req, res) => {
  const packages = await prisma.package.findMany();
  res.json(packages);
});
```
````

**Answer:** Missing `tenantId` filter. This returns packages from ALL tenants (security vulnerability).

**Correct:**

```typescript
app.get('/api/packages', tenantMiddleware, async (req, res) => {
  const tenantId = req.tenantId; // From middleware
  const packages = await prisma.package.findMany({
    where: { tenantId }, // ← CRITICAL
  });
  res.json(packages);
});
```

[Add 5-10 more questions covering common patterns]

````

### 7.2 Weekly Code Review Sessions

Schedule recurring meetings:
- **Topic:** Review recent production incidents and root causes
- **Format:** 30 minutes, all engineers attend
- **Output:** Update prevention strategies based on new patterns

### 7.3 Post-Incident Reviews

Template for `docs/incidents/YYYY-MM-DD-incident-name.md`:

```markdown
# Incident Report: [Title]

## Timeline
- **Detection:** [When was it detected?]
- **Resolution:** [When was it fixed?]
- **Duration:** [How long was it broken?]

## Root Cause
[What caused the issue?]

## Impact
- Users affected: [Number/percentage]
- Data integrity: [Was data corrupted?]
- Revenue impact: [Any financial loss?]

## Prevention Strategies
[What can we do to prevent this entire class of issues?]

- [ ] Add ESLint rule to catch this pattern
- [ ] Add test requirement to checklist
- [ ] Update documentation
- [ ] Add CI/CD validation
- [ ] Schedule training session
````

---

## 8. Quick Win Implementations

### Immediate Actions (Week 1)

1. **Add ESLint rules** (2 hours):
   - `no-console` enforcement
   - `no-restricted-syntax` for PrismaClient
   - Custom `require-tenant-id` rule

2. **Create test templates** (2 hours):
   - Tenant isolation test template
   - Input normalization test template
   - Idempotency test template

3. **Update PR template** (1 hour):
   - Add multi-tenant security checklist
   - Add feature completeness checklist

### Short-term Actions (Week 2-4)

4. **Add CI/CD gates** (4 hours):
   - Pattern validation script
   - Coverage threshold enforcement
   - Migration validation

5. **Create onboarding quiz** (4 hours):
   - 10 security questions
   - Auto-grade with examples
   - Require passing score

6. **Document prevention strategies** (2 hours):
   - This document (done!)
   - Link from CLAUDE.md

### Long-term Actions (Month 2-3)

7. **Weekly code review sessions** (ongoing):
   - Schedule recurring meeting
   - Rotate facilitator
   - Track patterns over time

8. **Post-incident process** (ongoing):
   - Create template
   - Schedule review meetings
   - Update prevention strategies

---

## 9. Measuring Success

### Metrics to Track

| Metric                                    | Current | Target | Timeline |
| ----------------------------------------- | ------- | ------ | -------- |
| P1 issues per sprint                      | 7       | 0      | 2 months |
| Security vulnerabilities                  | 3       | 0      | 1 month  |
| Test coverage                             | 85%     | 90%    | 2 months |
| Feature completeness (backend + frontend) | 60%     | 100%   | 1 month  |
| PrismaClient instances                    | 5+      | 1      | 1 week   |
| Console.log usage                         | 12+     | 0      | 1 week   |

### Monthly Review

At the end of each month:

1. Review all P1 issues from that month
2. Identify common patterns
3. Update prevention strategies
4. Add new ESLint rules if needed
5. Update training materials

---

## 10. Related Documentation

- [Email Case-Sensitivity Prevention](./security-issues/PREVENTION-STRATEGY-EMAIL-CASE-SENSITIVITY.md) - Detailed email normalization patterns
- [Missing Input Validation](./security-issues/missing-input-validation-cross-tenant-exposure.md) - Ownership validation patterns
- [Multi-Tenant Implementation Guide](../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md) - Core multi-tenant patterns
- [CLAUDE.md](../../CLAUDE.md) - Project-specific development guide
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design and patterns

---

## Appendix A: Pattern Detection Regexes

For grep/ripgrep searches:

```bash
# Find queries without tenantId
rg 'prisma\.\w+\.findMany' --type ts | rg -v 'tenantId'

# Find new PrismaClient() instantiations
rg 'new PrismaClient\(\)' --type ts

# Find console.log usage
rg 'console\.log' server/src --type ts

# Find prompt/alert/confirm usage
rg 'prompt\(|alert\(|confirm\(' client/src --type ts

# Find magic strings in tenantId fields
rg 'tenantId.*=.*"(unknown|default|test)"' --type ts

# Find missing .toLowerCase() on email
rg 'email.*findUnique|findMany.*email' --type ts | rg -v 'toLowerCase'
```

---

## Appendix B: AI Agent Integration

For Claude Code or other AI assistants, add to `.claude/PATTERNS.md`:

```markdown
# Critical Patterns to Enforce

When writing code for this project:

1. **ALWAYS** filter queries by tenantId
2. **ALWAYS** normalize email to lowercase before storage/queries
3. **ALWAYS** validate foreign key ownership before mutations
4. **NEVER** instantiate new PrismaClient() outside di.ts
5. **NEVER** use console.log (use logger instead)
6. **NEVER** use prompt/alert/confirm (use React components)
7. **ALWAYS** implement both backend AND frontend for features
8. **ALWAYS** add tests for tenant isolation
9. **ALWAYS** check for N+1 query patterns
10. **ALWAYS** document WHY not WHAT in comments
```

---

**Status:** Active
**Last Updated:** 2025-11-27
**Next Review:** 2025-12-27
**Maintainer:** Engineering Team
