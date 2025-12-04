# Security Incident Prevention Checklist

**Owner**: Security Team / Engineering Lead
**Last Updated**: 2025-11-18
**Status**: Active

---

## Purpose

This document provides comprehensive checklists to prevent security incidents based on lessons learned from MAIS platform's incident history. Use these checklists during development, code review, and pre-deployment to catch security issues before they reach production.

**Context**: MAIS has experienced 3 P0 security incidents in 35 days:

1. Nov 6: Cross-tenant cache leak
2. Nov 10: Exposed secrets in git history
3. Recent: Platform admin authentication bypass

This checklist is designed to prevent recurrence of these and similar incident classes.

---

## Pre-Deployment Security Checklist

Use this checklist before EVERY production deployment:

### Multi-Tenant Isolation ⚠️ CRITICAL

**Cache Isolation**:

- [ ] All cache keys include `tenantId` prefix (format: `tenant:{id}:resource:{id}`)
- [ ] No shared cache keys across tenants
- [ ] Cache isolation integration tests exist and pass
- [ ] Cache invalidation respects tenant boundaries

**Database Isolation**:

- [ ] All queries include `WHERE tenantId = ?` clause
- [ ] Repository methods enforce tenant scoping
- [ ] Tenant middleware runs before all public/admin routes
- [ ] No raw SQL queries without tenant parameter

**API Isolation**:

- [ ] X-Tenant-Key header validated on all public endpoints
- [ ] JWT token includes and validates tenantId
- [ ] No cross-tenant data access possible in any endpoint
- [ ] Admin endpoints verify tenant ownership before operations

**Testing**:

- [ ] Integration tests verify tenant isolation
- [ ] Attempt cross-tenant access in tests (should fail)
- [ ] Cache isolation tests pass
- [ ] Database constraint tests pass

---

### Authentication & Authorization ⚠️ CRITICAL

**Authentication**:

- [ ] All admin routes require JWT validation
- [ ] JWT expiration set appropriately (< 24 hours)
- [ ] Refresh token rotation implemented (if using)
- [ ] No authentication bypass possible

**Authorization**:

- [ ] Role-based access control (RBAC) enforced
- [ ] Platform admin vs tenant admin roles properly checked
- [ ] No privilege escalation possible
- [ ] Resource ownership verified before operations

**Testing**:

- [ ] Unauthenticated access blocked (401)
- [ ] Unauthorized access blocked (403)
- [ ] JWT tampering detected and rejected
- [ ] Expired tokens rejected

---

### Secret Management ⚠️ CRITICAL

**Code Review**:

- [ ] No hardcoded secrets, API keys, or passwords
- [ ] No secrets in comments
- [ ] `.env.example` contains NO real values
- [ ] All secrets loaded from environment variables

**Git History**:

- [ ] No secrets committed in current branch
- [ ] `.gitignore` includes all secret files
- [ ] Pre-commit hooks check for secrets (if configured)

**Production Secrets**:

- [ ] All secrets encrypted at rest
- [ ] Tenant secrets use encryption key from env
- [ ] Stripe secret keys never logged
- [ ] Database connection strings use env vars

**Documentation**:

- [ ] No secrets in README or documentation
- [ ] Example values use placeholder format
- [ ] Secret rotation procedures documented

---

### Input Validation ⚠️ HIGH

**Request Validation**:

- [ ] All endpoints use Zod schema validation
- [ ] Request body size limits enforced (10 MB max)
- [ ] File upload validation (type, size, content)
- [ ] SQL injection prevention (use Prisma, no raw SQL)

**Data Sanitization**:

- [ ] User input sanitized before database storage
- [ ] HTML/script tags escaped in outputs
- [ ] Email validation using proper regex
- [ ] URL validation for webhook endpoints

---

### Rate Limiting & DoS Prevention ⚠️ HIGH

**Rate Limits**:

- [ ] Login endpoints rate limited (5 attempts/15min)
- [ ] Admin endpoints rate limited (100 req/15min)
- [ ] Public endpoints rate limited (1000 req/15min)
- [ ] Webhook endpoints have appropriate limits

**Resource Limits**:

- [ ] Request body size limited (10 MB)
- [ ] Database connection pooling configured
- [ ] Query timeouts set (30 seconds max)
- [ ] File upload size limited (50 MB max)

---

### Error Handling & Logging ⚠️ MEDIUM

**Error Handling**:

- [ ] No sensitive data in error messages
- [ ] Production errors don't expose stack traces
- [ ] Errors logged with context (tenant, user, endpoint)
- [ ] Structured error format (JSON)

**Logging**:

- [ ] Security events logged (login, logout, auth failures)
- [ ] Tenant context in all logs
- [ ] No secrets in logs (API keys, passwords)
- [ ] Sentry configured for error tracking

---

## Code Review Security Checklist

Use during every pull request review:

### Multi-Tenant Code Review

- [ ] **Cache Operations**: Does cache key include tenantId?

  ```typescript
  // ❌ BAD
  cache.get(`package:${packageId}`);

  // ✅ GOOD
  cache.get(`tenant:${tenantId}:package:${packageId}`);
  ```

- [ ] **Database Queries**: Are all queries scoped by tenantId?

  ```typescript
  // ❌ BAD
  prisma.booking.findMany();

  // ✅ GOOD
  prisma.booking.findMany({ where: { tenantId } });
  ```

- [ ] **Repository Methods**: Do all methods require tenantId parameter?

  ```typescript
  // ❌ BAD
  async findAll() { ... }

  // ✅ GOOD
  async findAll(tenantId: string) { ... }
  ```

- [ ] **API Endpoints**: Is tenant extracted from header/JWT and validated?
  ```typescript
  // ✅ GOOD
  const tenantId = req.tenantId; // From middleware
  if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });
  ```

### Authentication Code Review

- [ ] **JWT Validation**: Is JWT verified on admin routes?
- [ ] **Role Checking**: Is user role validated for sensitive operations?
- [ ] **Token Expiration**: Are expired tokens rejected?
- [ ] **Authorization**: Is resource ownership verified?

### Secret Management Code Review

- [ ] **No Hardcoded Secrets**: Search for common patterns

  ```typescript
  // ❌ BAD
  const apiKey = 'sk_live_abc123';
  const password = 'admin123';

  // ✅ GOOD
  const apiKey = process.env.STRIPE_SECRET_KEY;
  const password = process.env.DB_PASSWORD;
  ```

- [ ] **Environment Variables**: All secrets from env vars?
- [ ] **Logging**: No secrets in console.log or logger calls?
- [ ] **.gitignore**: Secret files ignored?

### Input Validation Code Review

- [ ] **Zod Schemas**: All endpoints have request validation?
- [ ] **SQL Injection**: No string concatenation in queries?
- [ ] **XSS Prevention**: User input escaped in outputs?
- [ ] **File Uploads**: Type and size validation?

---

## Incident-Specific Prevention

### Preventing Cache Leak (Nov 6 Type Incidents)

**Root Cause**: Cache keys missing tenantId, allowing cross-tenant access

**Prevention Checklist**:

- [ ] All cache operations use `getCacheKey(tenantId, resourceType, resourceId)` helper
- [ ] Integration test: Attempt to access tenant A's cache from tenant B context (should fail)
- [ ] Code review specifically checks cache key format
- [ ] CI lint rule: All cache.get/set calls must include 'tenant:' prefix
- [ ] Cache utility enforces tenantId parameter (compile-time check)

**Code Pattern**:

```typescript
// ✅ ENFORCE at type level
function getCacheKey(tenantId: string, resource: string, id: string): string {
  if (!tenantId) throw new Error('tenantId required for cache key');
  return `tenant:${tenantId}:${resource}:${id}`;
}

// Usage
const key = getCacheKey(tenantId, 'package', packageId);
cache.get(key);
```

**Tests Required**:

```typescript
it('should not allow cross-tenant cache access', async () => {
  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';

  // Store data for tenant A
  await cache.set(getCacheKey(tenantA, 'package', 'pkg-1'), { name: 'Secret' });

  // Attempt to access from tenant B (should fail)
  const result = await cache.get(getCacheKey(tenantB, 'package', 'pkg-1'));
  expect(result).toBeNull();
});
```

---

### Preventing Exposed Secrets (Nov 10 Type Incidents)

**Root Cause**: Secrets committed to git history

**Prevention Checklist**:

- [ ] Pre-commit hook scans for common secret patterns
- [ ] CI fails if secrets detected in committed files
- [ ] Secret scanning in GitHub (Dependabot, GitGuardian)
- [ ] Regular git history audits for accidental commits
- [ ] `.gitignore` comprehensive and enforced

**Pre-Commit Hook** (`.git/hooks/pre-commit`):

```bash
#!/bin/bash
# Check for common secret patterns

PATTERNS=(
  "sk_live_"
  "pk_live_"
  "password.*=.*['\"]"
  "secret.*=.*['\"]"
  "api_key.*=.*['\"]"
  "stripe.*key"
)

for pattern in "${PATTERNS[@]}"; do
  if git diff --cached | grep -i "$pattern"; then
    echo "⚠️  ERROR: Possible secret detected: $pattern"
    echo "Commit aborted. Please remove secrets."
    exit 1
  fi
done
```

**CI Check**:

```yaml
# .github/workflows/security.yml
- name: Scan for secrets
  run: |
    if grep -r "sk_live_\|pk_live_\|password.*=" .; then
      echo "Secrets detected!"
      exit 1
    fi
```

**If Secrets Already Committed**:

```bash
# Remove from history (DESTRUCTIVE - backup first)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/secret/file' \
  --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team)
git push origin --force --all
```

---

### Preventing Auth Bypass (Platform Admin Type Incidents)

**Root Cause**: Missing or incorrect role validation

**Prevention Checklist**:

- [ ] All admin routes use authentication middleware
- [ ] Role-based middleware checks user.role
- [ ] Platform admin routes explicitly check for 'PLATFORM_ADMIN' role
- [ ] Tenant admin routes verify tenant ownership
- [ ] No authorization logic in route handlers (use middleware)

**Middleware Pattern**:

```typescript
// middleware/auth.ts
export const requirePlatformAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Platform admin only' });
  }

  next();
};

export const requireTenantAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.role !== 'TENANT_ADMIN' && req.user.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Tenant admin required' });
  }

  // Verify tenant ownership
  if (req.user.role === 'TENANT_ADMIN' && req.user.tenantId !== req.params.tenantId) {
    return res.status(403).json({ error: 'Forbidden: Cannot access other tenant' });
  }

  next();
};

// Usage
app.get('/v1/admin/tenants', requireAuth, requirePlatformAdmin, listTenants);
app.get('/v1/tenant/admin/packages', requireAuth, requireTenantAdmin, listPackages);
```

**Tests Required**:

```typescript
describe('Platform Admin Authorization', () => {
  it('should block tenant admin from accessing platform admin endpoint', async () => {
    const tenantAdminToken = generateToken({ role: 'TENANT_ADMIN', tenantId: 'tenant-a' });

    const res = await request(app)
      .get('/v1/admin/tenants')
      .set('Authorization', `Bearer ${tenantAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Platform admin only');
  });

  it('should block tenant admin from accessing other tenant', async () => {
    const tenantAdminToken = generateToken({ role: 'TENANT_ADMIN', tenantId: 'tenant-a' });

    const res = await request(app)
      .get('/v1/tenant/admin/packages?tenantId=tenant-b')
      .set('Authorization', `Bearer ${tenantAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Cannot access other tenant');
  });
});
```

---

## Automated Security Checks

### CI/CD Security Pipeline

```yaml
# .github/workflows/security.yml
name: Security Checks

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Secret Scanning
        run: |
          # Check for hardcoded secrets
          if grep -r "sk_live_\|pk_live_\|password.*=" --exclude-dir=node_modules .; then
            echo "⚠️  Secrets detected!"
            exit 1
          fi

      - name: Dependency Audit
        run: npm audit --audit-level=high

      - name: TypeScript Type Check
        run: npm run typecheck

      - name: Lint Security Rules
        run: npm run lint:security

      - name: Integration Tests
        run: npm run test:integration
        env:
          # Run tests that verify tenant isolation
          TEST_FILTER: 'tenant-isolation'
```

### ESLint Security Rules

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // Prevent console.log in production
    'no-console': 'warn',

    // Require strict equality
    eqeqeq: ['error', 'always'],

    // Prevent eval usage
    'no-eval': 'error',

    // Custom rules
    'mais/require-tenant-id-in-cache-key': 'error',
    'mais/require-tenant-id-in-query': 'error',
  },
};
```

---

## Security Training Checklist

### New Developer Onboarding

Every new developer must complete:

- [ ] Read SECURITY.md
- [ ] Read this document (SECURITY_INCIDENT_PREVENTION.md)
- [ ] Review all 3 historical incident post-mortems
- [ ] Complete security training quiz (80% pass required)
- [ ] Pair program on security-sensitive feature
- [ ] Shadow security code review

### Quarterly Security Refresher

All developers complete quarterly:

- [ ] Review recent security incidents (if any)
- [ ] Update on new security best practices
- [ ] Review changes to security checklist
- [ ] Practice incident response drill

---

## Security Metrics

Track these metrics monthly:

### Leading Indicators (Prevention)

- % of PRs with security checklist completed (target: 100%)
- Security-related PR comments per month (target: >10)
- Pre-deployment checklist completion rate (target: 100%)
- Secret scanning alerts (target: 0)

### Lagging Indicators (Detection)

- Security incidents per month (target: 0)
- Time to detect security issues (target: <1 hour)
- Time to remediate security issues (target: <4 hours)
- Repeat incident rate (target: 0%)

---

## Related Documentation

- [POST_INCIDENT_REVIEW_PROCESS.md](../operations/POST_INCIDENT_REVIEW_PROCESS.md) - Incident review process
- [SECURITY.md](./SECURITY.md) - Security overview
- [SECRETS.md](./SECRETS.md) - Secret management
- [INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md) - Incident response playbook

---

## Quick Reference

### Before Every Deployment

```bash
# Run complete security check
npm run security:check

# Checklist completion
echo "✅ Multi-tenant isolation verified"
echo "✅ Authentication/authorization tested"
echo "✅ No secrets in code"
echo "✅ Input validation complete"
echo "✅ Rate limiting configured"
echo "✅ Error handling secure"
```

### During Code Review

```bash
# Security-focused review
echo "1. Check cache keys for tenantId"
echo "2. Check queries for tenant scoping"
echo "3. Check for hardcoded secrets"
echo "4. Check authentication/authorization"
echo "5. Check input validation"
```

### After Security Incident

```bash
# Immediate actions
echo "1. Follow POST_INCIDENT_REVIEW_PROCESS.md"
echo "2. Update this checklist with new prevention"
echo "3. Add regression test"
echo "4. Update CI/CD checks"
```

---

**Last Updated**: 2025-11-18
**Next Review**: 2026-02-18 (Quarterly)
**Owner**: Security Team / Engineering Lead

**Questions?** Contact @security-lead or post in #security channel.
