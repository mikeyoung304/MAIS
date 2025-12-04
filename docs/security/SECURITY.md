# Security

## Multi-Tenant Security (Phase 1)

MAIS is a **multi-tenant SaaS platform** supporting up to 50 independent wedding businesses. Complete data isolation is critical for security and compliance.

### Tenant Isolation Guarantees

**Row-Level Data Isolation:**

- Every database table includes `tenantId UUID NOT NULL`
- All queries automatically scoped by tenantId
- Composite unique constraints prevent cross-tenant conflicts: `[tenantId, slug]`, `[tenantId, date]`
- Impossible to query data from other tenants (enforced at database level)

**Tenant Resolution Middleware:**

```typescript
// All public API requests require X-Tenant-Key header
// Middleware extracts tenant, validates, injects into request context
X-Tenant-Key: pk_live_tenant_a_xxx

// Error codes:
// 401 TENANT_KEY_REQUIRED - Missing header
// 401 INVALID_TENANT_KEY - Invalid format or not found
// 403 TENANT_INACTIVE - Tenant exists but disabled
```

**API Key Security:**

- **Public keys** (`pk_live_*`): Safe for client-side use, included in HTTP headers
- **Secret keys** (`sk_live_*`): Server-side only, encrypted in database with AES-256-GCM
- Encryption key: `TENANT_SECRETS_ENCRYPTION_KEY` (must be backed up securely)
- Format validation before database lookup (prevents injection)

**Cache Isolation:**

- All cache keys include tenantId: `catalog:${tenantId}:packages`
- **Critical P0 Fix (Phase 1)**: Removed HTTP cache middleware that was generating keys without tenantId
  - Vulnerability: All tenants shared same cached data (cross-tenant data leakage)
  - Resolution: Application-level cache with tenant-scoped keys only
  - Verified: Each tenant sees only their own data

**Commission Security:**

- Commission rates calculated **server-side only** (never trust client)
- Always rounds UP to protect platform revenue
- Stripe Connect enforces 0.5% - 50% limits
- Commission metadata stored in booking record for audit trail

### Authentication Model

**Public API Endpoints** (require X-Tenant-Key):

- `/v1/packages` - List tenant's packages
- `/v1/bookings` - Create bookings for tenant
- `/v1/availability` - Check tenant's availability

**Admin Endpoints** (require Bearer JWT):

- `/v1/admin/login` - Get JWT token
- `/v1/admin/bookings` - Manage all bookings
- `/v1/admin/tenants` - Tenant management (CRUD)

**Webhook Endpoints** (require Stripe signature):

- `/v1/webhooks/stripe` - Process Stripe events

### Security Best Practices

**Tenant Provisioning:**

```bash
# 1. Generate encryption key (production)
openssl rand -hex 32
# Store securely: TENANT_SECRETS_ENCRYPTION_KEY

# 2. Create tenant with secure credentials
pnpm --filter @elope/api exec tsx server/scripts/create-tenant.ts \
  --slug tenant-a \
  --name "Tenant Business Name" \
  --commission 10.0

# 3. Tenant receives public key (safe to embed)
# Public: pk_live_tenant-a_xxx (share with tenant)
# Secret: sk_live_tenant-a_xxx (NEVER share - encrypted in DB)
```

**API Key Rotation:**

1. Generate new API key pair for tenant
2. Update tenant record in database
3. Notify tenant to update their integration
4. Invalidate old keys after grace period

**Monitoring for Security Issues:**

```bash
# Check for cross-tenant data access (should be zero)
SELECT tenantId, COUNT(*) FROM bookings GROUP BY tenantId;

# Verify all queries include tenantId (audit database logs)
grep "SELECT.*FROM.*WHERE.*tenantId" postgres.log

# Monitor failed authentication attempts
grep "TENANT_KEY_REQUIRED\|INVALID_TENANT_KEY" application.log
```

## Login Rate Limiting

**Status:** ✅ Implemented (2025-11-07)

To prevent brute force attacks and credential stuffing, strict rate limiting is enforced on all login endpoints.

### Configuration

**Rate Limit Settings:**

- **Window:** 15 minutes (900 seconds)
- **Max Attempts:** 5 failed login attempts per IP address
- **Tracking:** Per IP address (IP-based isolation)
- **Scope:** Failed attempts only (successful logins don't count toward limit)

**Protected Endpoints:**

- `POST /v1/admin/login` - Platform admin login
- `POST /v1/tenant-auth/login` - Tenant admin login

### Behavior

**Normal Operation:**

1. User attempts login with wrong password → 401 Unauthorized
2. Attempts 1-5 → Standard authentication error
3. Attempt 6+ → 429 Too Many Requests

**Rate Limit Response:**

```json
{
  "error": "too_many_login_attempts",
  "message": "Too many login attempts. Please try again in 15 minutes."
}
```

**Response Headers:**

```
RateLimit-Limit: 5
RateLimit-Remaining: 3
RateLimit-Reset: 1699282800
```

### Security Logging

All failed login attempts are logged with structured data for security monitoring:

```json
{
  "level": "warn",
  "event": "tenant_login_failed" | "admin_login_failed",
  "endpoint": "/v1/tenant-auth/login" | "/v1/admin/login",
  "email": "attempted@email.com",
  "ipAddress": "192.168.1.1",
  "timestamp": "2025-11-07T10:30:00.000Z",
  "error": "Invalid credentials"
}
```

**Monitoring Recommendations:**

- Alert on high volume of 429 responses (potential attack in progress)
- Track failed login patterns for specific emails (targeted attacks)
- Monitor distributed failures across IPs targeting same email (credential stuffing)
- Analyze geographic distribution of failed attempts

### Testing

**Manual Test Script:**

```bash
# Run the provided test script
cd server
./test-login-rate-limit.sh

# Or test manually with curl
curl -X POST http://localhost:3000/v1/tenant-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
```

**Expected Behavior:**

- Attempts 1-5: HTTP 401 (authentication error)
- Attempt 6+: HTTP 429 (rate limit exceeded)

### Production Considerations

**Multi-Server Deployments:**

Current implementation uses in-memory storage. For production with multiple servers, consider:

**Option 1: Redis Store (Recommended)**

```typescript
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const client = createClient({ url: process.env.REDIS_URL });

export const loginLimiter = rateLimit({
  store: new RedisStore({
    client,
    prefix: 'login_limit:',
  }),
  // ... other config
});
```

**Option 2: Sticky Sessions**

- Configure load balancer for session affinity based on IP address
- Ensures requests from same IP always route to same server instance

### Compliance

This implementation helps meet:

- **PCI DSS 8.1.6:** Limit repeated access attempts
- **OWASP Top 10:** Broken Authentication prevention
- **NIST SP 800-63B:** Authentication and lifecycle management guidelines

**Implementation Details:** See [server/LOGIN_RATE_LIMITING.md](./server/LOGIN_RATE_LIMITING.md)

## General Security Guardrails

- **No secrets in code.** Use .env files and deploy envs.
- **Validate all inputs** with zod.
- **Webhook:** verify Stripe signature; raw body for that route only.
- **Auth:** admin endpoints require Bearer JWT; strong bcrypt hashes; rotate `JWT_SECRET` for prod.
- **CORS:** restrict to configured origin(s) (allow HTTPS in production for widget embedding).
- **Errors:** no stack traces in responses; use standardized error shapes.
- **Dependencies:** run `pnpm audit` weekly; keep Prisma/Stripe libs up to date.
- **Tenant Secrets:** Encrypt with `TENANT_SECRETS_ENCRYPTION_KEY` (AES-256-GCM).
- **Rate Limiting:** Login endpoints limited to 5 attempts per 15 minutes; global limits on other routes.
- **Security Logging:** Structured logging of all failed authentication attempts with IP tracking.
- **Database:** Connection pooling via Prisma/Supabase; monitor slow queries (>1s).

## Security Incidents

### Phase 1: HTTP Cache Cross-Tenant Data Leakage (P0 - FIXED)

**Date:** 2025-11-06
**Severity:** P0 Critical
**Status:** ✅ Resolved (commit `efda74b`)

**Vulnerability:**

- HTTP cache middleware generated keys without tenantId
- Cache key format: `GET:/v1/packages:{}` (same for ALL tenants)
- Cache hit returned immediately, bypassing tenant middleware
- Result: All tenants saw cached data from first request

**Impact:**

- Complete breach of tenant isolation
- Tenant A's packages visible to Tenant B, C, etc.
- Only affected cached responses (GET /v1/packages, GET /v1/availability)

**Resolution:**

- Removed HTTP cache middleware from `server/src/app.ts` (lines 18, 81-86)
- Application-level cache (CacheService) provides performance with proper tenant isolation
- Cache keys now include tenantId: `catalog:${tenantId}:packages`

**Verification:**

- Tested with 3 tenants (tenant-a, tenant-b, tenant-c)
- Each tenant sees only their own data ✓
- No X-Cache headers in responses ✓
- Tenant middleware runs on EVERY request ✓

**Lessons Learned:**

1. Cache keys MUST include all scoping parameters (tenantId)
2. Middleware execution order critical for security
3. Comprehensive integration testing required for multi-tenant systems
4. Document cache key patterns in ARCHITECTURE.md

**Reference:** See `PHASE_1_COMPLETION_REPORT.md` for full details.

## Vulnerability Disclosure

If you discover a security vulnerability, please email: security@yourdomain.com

**Do NOT** open a public GitHub issue for security vulnerabilities.
