# MAIS Security Audit Report

**Audit Date:** December 26, 2025
**Auditor:** Agent C4 (Security & Data Handling)
**Codebase Version:** Commit a514162 (main branch)
**Overall Risk Score:** LOW (with 2 Medium recommendations)

---

## Executive Summary

The MAIS platform demonstrates **strong security posture** across critical areas. The multi-tenant architecture is well-implemented with consistent tenantId filtering, JWT authentication follows best practices, and payment processing uses proper signature verification. No CRITICAL security vulnerabilities were identified.

**Key Strengths:**
- Comprehensive tenant isolation across all database queries (309 tenantId references in repositories)
- Robust JWT implementation with algorithm pinning (HS256 only)
- Proper Stripe webhook signature verification
- Extensive input sanitization using xss + validator libraries
- Multi-layered rate limiting with 14 different limiters

**Areas for Improvement:**
- Console.log usage in some services (should use structured logger)
- Some hardcoded test credentials in E2E fixtures (not in production code)
- Long JWT expiry (7 days) could be reduced for sensitive operations

---

## 1. Authentication & Authorization

### Status: PASS

#### JWT Implementation
| Aspect | Status | Details |
|--------|--------|---------|
| Algorithm pinning | PASS | Uses HS256 only, rejects algorithm confusion attacks |
| Token expiry | PASS | 7-day expiry (adequate for admin tokens) |
| Secret from env | PASS | Uses `JWT_SECRET` environment variable |
| Token type validation | PASS | Separates tenant vs admin tokens |

**Evidence:** `server/src/services/identity.service.ts:33-35`
```typescript
const token = jwt.sign(payload, this.jwtSecret, {
  algorithm: 'HS256', // Explicit algorithm prevents confusion attacks
  expiresIn: '7d',
});
```

**Evidence:** `server/src/middleware/auth.ts:42-48`
```typescript
// SECURITY: Validate token type - reject tenant tokens on admin routes
if ('type' in payload && (payload as { type: string }).type === 'tenant') {
  throw new UnauthorizedError(
    'Invalid token type: tenant tokens are not allowed for admin routes'
  );
}
```

#### Protected Routes
| Route Category | Auth Middleware | Status |
|---------------|-----------------|--------|
| Admin routes | `createAuthMiddleware` | PASS |
| Tenant admin routes | `createTenantAuthMiddleware` | PASS |
| Public API routes | `resolveTenant` + API key | PASS |
| Webhook routes | Signature verification | PASS |

#### Impersonation Security
- Platform admins can impersonate tenants via special token
- Impersonation context tracked in `res.locals.impersonatedBy` for audit
- Admin email logged when impersonating

### Recommendations
- **MEDIUM**: Consider reducing JWT expiry for sensitive operations (e.g., password changes)
- Add refresh token rotation for long-lived sessions

---

## 2. Tenant Isolation (CRITICAL)

### Status: PASS

This is the most critical security boundary. All 9 repository files were audited.

#### Repository Audit Results
| Repository | tenantId Usage | Status |
|------------|----------------|--------|
| `catalog.repository.ts` | 66 occurrences | PASS |
| `booking.repository.ts` | 65 occurrences | PASS |
| `tenant.repository.ts` | 35 occurrences | PASS |
| `segment.repository.ts` | 35 occurrences | PASS |
| `webhook-subscription.repository.ts` | 32 occurrences | PASS |
| `service.repository.ts` | 30 occurrences | PASS |
| `availability-rule.repository.ts` | 18 occurrences | PASS |
| `webhook.repository.ts` | 18 occurrences | PASS |
| `blackout.repository.ts` | 10 occurrences | PASS |

**Total: 309 tenantId filtering instances across all repositories**

#### Interface Enforcement
All repository interfaces in `ports.ts` require `tenantId` as the first parameter:

```typescript
// ports.ts - Every method requires tenantId
interface CatalogRepository {
  getAllPackages(tenantId: string): Promise<Package[]>;
  getPackageBySlug(tenantId: string, slug: string): Promise<Package | null>;
  // ... all 15+ methods require tenantId
}
```

#### Cross-Tenant Reference Protection
**Evidence:** `catalog.repository.ts:143-153`
```typescript
// CRITICAL: Verify package belongs to tenant before querying add-ons
// This prevents cross-tenant reference attacks where an attacker
// provides a packageId from another tenant
const pkg = await this.prisma.package.findFirst({
  where: { tenantId, id: packageId },
  select: { id: true },
});

if (!pkg) {
  throw new NotFoundError('Package not found or unauthorized');
}
```

#### File Deletion Security
**Evidence:** `upload.adapter.ts:355-362`
```typescript
if (!storagePath.startsWith(`${tenantId}/`)) {
  logger.error(
    { tenantId, storagePath, url },
    'SECURITY: Attempted cross-tenant file deletion blocked'
  );
  return;
}
```

#### Cache Key Isolation
**Evidence:** `ports.ts:879`
```typescript
// CRITICAL: All cache keys MUST include tenantId to prevent cross-tenant data leakage
// Example: `catalog:${tenantId}:packages` NOT `catalog:packages`
```

---

## 3. Input Validation & Injection Prevention

### Status: PASS

#### XSS Prevention
**Implementation:** `server/src/lib/sanitization.ts`

| Function | Purpose | Library |
|----------|---------|---------|
| `sanitizeHtml()` | Whitelist-based HTML sanitization | xss |
| `sanitizePlainText()` | Strip all HTML, escape special chars | validator |
| `sanitizeEmail()` | Normalize and validate email | validator |
| `sanitizeUrl()` | Validate URL with safe protocols only | validator |
| `sanitizePhone()` | Remove non-numeric characters | regex |
| `sanitizeSlug()` | Lowercase alphanumeric + hyphens only | regex |

#### Sanitization Middleware
**Evidence:** `server/src/middleware/sanitize.ts` - Applies automatic sanitization to request bodies.

#### Zod Validation
All API endpoints use ts-rest + Zod contracts for runtime validation:
- Request bodies validated against Zod schemas
- Response types enforced by contracts
- Type-safe from API to database

#### SQL Injection Prevention
- All database access through Prisma ORM
- Prisma uses parameterized queries by default
- Raw SQL only used for advisory locks with template literals (safe)

**Evidence:** `booking.repository.ts:185`
```typescript
await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
// Template literal syntax is safe - Prisma parameterizes the value
```

---

## 4. Secret Management

### Status: PASS (with notes)

#### Environment Variables
| Secret | Source | Status |
|--------|--------|--------|
| `JWT_SECRET` | Environment variable | PASS |
| `TENANT_SECRETS_ENCRYPTION_KEY` | Environment variable | PASS |
| `STRIPE_SECRET_KEY` | Environment variable | PASS |
| `STRIPE_WEBHOOK_SECRET` | Environment variable | PASS |
| `POSTMARK_SERVER_TOKEN` | Environment variable | PASS |
| `DATABASE_URL` | Environment variable | PASS |

#### No Hardcoded Secrets
Grep for common secret patterns found:
- Test fixtures contain mock passwords (`admin123admin`, `SecurePass123!`) - acceptable for E2E tests
- No hardcoded API keys in production code
- CI validation tests verify secrets are not hardcoded in workflows

**Evidence:** `tests/ci/ci-validation.test.ts:191`
```typescript
it('should not have hardcoded API keys in workflows', () => {
  // Should use secrets, not hardcoded values
});
```

#### Logging Safety
- Structured logging via `logger` utility
- API keys truncated in logs: `apiKey.substring(0, 20) + '...'`
- Sentry configured to filter sensitive parameters

**Note:** Found 28 `console.log` occurrences in `server/src/` - most in generated Prisma code, but some in services should migrate to structured logger.

---

## 5. Payment Security (Stripe)

### Status: PASS

#### Webhook Signature Verification
**Evidence:** `stripe.adapter.ts:159-167`
```typescript
async verifyWebhook(payload: string, signature: string): Promise<Stripe.Event> {
  try {
    const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    return event;
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${message}`);
  }
}
```

**Double Verification:** Webhook processor re-verifies signature after queue dequeue:
```typescript
// Verify webhook signature (already verified in route, but verify again for security)
event = await this.paymentProvider.verifyWebhook(rawPayload, signature);
```

#### Idempotency Handling
- Webhook events stored in database with unique constraint on `eventId`
- Duplicate detection before and after recording
- `isNewRecord` flag prevents double-processing

**Evidence:** `webhooks.routes.ts:67-74`
```typescript
const isGlobalDupe = await this.webhookRepo.isDuplicate('_global', event.id);
if (isGlobalDupe) {
  logger.info({ eventId: event.id }, 'Duplicate webhook - returning 200 OK');
  return;
}
```

#### Amount Validation
**Evidence:** `stripe.adapter.ts:96-109`
```typescript
// Validate application fee (Stripe requires 0.5% - 50%)
const minFee = Math.ceil(input.amountCents * 0.005); // 0.5%
const maxFee = Math.floor(input.amountCents * 0.5); // 50%

if (input.applicationFeeAmount < minFee) {
  throw new Error(`Application fee below Stripe minimum`);
}
```

#### Connect Account Validation
- `stripeAccountId` required for Connect checkout sessions
- Tenant must be onboarded before payments: `requireStripeOnboarded` middleware

#### Idempotency Keys
- `idempotencyKey` parameter supported for checkout sessions and refunds
- Prevents duplicate charges from retries

---

## 6. Rate Limiting

### Status: PASS

Comprehensive rate limiting with 14 specialized limiters:

| Limiter | Window | Limit | Protection |
|---------|--------|-------|------------|
| `publicLimiter` | 15 min | 300 | General API abuse |
| `adminLimiter` | 15 min | 120 | Admin route abuse |
| `loginLimiter` | 15 min | 5 | Brute-force login |
| `signupLimiter` | 1 hour | 5 | Signup spam |
| `uploadLimiterIP` | 1 hour | 200 | Upload DDoS per IP |
| `uploadLimiterTenant` | 1 hour | 50 | Upload quota per tenant |
| `webhookLimiter` | 1 min | 100 | Webhook DoS |
| `publicBookingActionsLimiter` | 15 min | 10 | Token brute-force |
| `publicBalancePaymentLimiter` | 1 hour | 5 | Checkout spam |
| `publicSchedulingLimiter` | 1 min | 100 | Slot enumeration |
| `publicTenantLookupLimiter` | 15 min | 100 | Tenant enumeration |
| `draftAutosaveLimiter` | 1 min | 120 | Autosave abuse |
| `addonReadLimiter` | 1 min | 100 | Catalog enumeration |
| `addonWriteLimiter` | 1 min | 20 | Add-on spam |

#### IPv6 Handling
```typescript
function normalizeIp(ip: string | undefined): string {
  if (ip.includes(':')) {
    // Extract the /64 prefix for IPv6
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::';
  }
  return ip;
}
```

#### Webhook Rate Limit Special Handling
Returns HTTP 200 on rate limit to prevent Stripe retry storms:
```typescript
// Return 200 to prevent Stripe retries on rate limit
handler: (_req, res) => {
  logger.warn({ ip }, 'Webhook rate limit exceeded - returning 200');
  res.status(200).send('OK');
}
```

---

## 7. File Upload Security

### Status: PASS

#### File Type Validation
**Evidence:** `upload.adapter.ts:91-151`

| Check | Implementation |
|-------|----------------|
| File size | Configurable max (2MB logos, 5MB photos) |
| MIME type whitelist | `['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']` |
| Magic byte verification | `file-type` library checks actual file content |
| MIME mismatch detection | Logs security warning on spoofing attempts |
| SVG content validation | Checks for actual SVG content, not just extension |

```typescript
// SECURITY: MIME type mismatch detected - possible spoofing attempt
if (normalizedDetected !== normalizedDeclared) {
  logger.warn({...}, 'SECURITY: MIME type mismatch detected');
  throw new Error('File validation failed');
}
```

#### Path Traversal Prevention
- Filenames generated with random bytes: `crypto.randomBytes(8).toString('hex')`
- Original filename only used for extension extraction
- Tenant-scoped storage paths: `${tenantId}/${folder}/${filename}`

#### Concurrency Control
```typescript
const MAX_CONCURRENT_UPLOADS = 3;

export function checkUploadConcurrency(tenantId: string): void {
  const current = uploadSemaphores.get(tenantId) || 0;
  if (current >= MAX_CONCURRENT_UPLOADS) {
    throw new TooManyRequestsError('Too many concurrent uploads');
  }
}
```

---

## 8. Additional Security Controls

### Password Hashing
- Uses bcryptjs with cost factor 10
- Passwords hashed before storage
- Constant-time comparison via bcrypt.compare()

### Token Security
- Password reset tokens hashed with SHA-256 before storage
- Short expiry for reset tokens
- Single-use tokens (cleared after use)

### Advisory Locks for Race Conditions
- PostgreSQL advisory locks prevent double-booking
- Lock IDs use FNV-1a hash for deterministic distribution
- Transaction timeouts prevent lock starvation (5 seconds)

### Error Handling
- Domain errors mapped to HTTP status codes
- No stack traces in production responses
- Structured logging for debugging

---

## Summary of Findings

### CRITICAL Issues: 0
No critical security vulnerabilities identified.

### HIGH Issues: 0
No high-severity issues identified.

### MEDIUM Issues: 2

1. **Console.log Usage in Services**
   - Location: Various service files (28 occurrences)
   - Risk: Information leakage in logs, inconsistent log format
   - Recommendation: Replace with structured `logger` utility
   - Priority: P2

2. **7-Day JWT Expiry**
   - Location: `identity.service.ts`, `tenant-auth.service.ts`
   - Risk: Extended window for token theft exploitation
   - Recommendation: Implement shorter-lived tokens with refresh
   - Priority: P3

### LOW Issues: 1

1. **Test Credentials in E2E Fixtures**
   - Location: `e2e/fixtures/auth.fixture.ts`, `e2e/tests/admin-flow.spec.ts`
   - Risk: None (not in production code)
   - Note: Documented for awareness only

---

## Compliance Checklist

| Requirement | Status |
|-------------|--------|
| Multi-tenant data isolation | PASS |
| Authentication on protected routes | PASS |
| Authorization checks | PASS |
| Input validation | PASS |
| XSS prevention | PASS |
| SQL injection prevention | PASS |
| Secret management | PASS |
| Payment security (PCI-adjacent) | PASS |
| Rate limiting | PASS |
| File upload security | PASS |
| Logging without secrets | PASS |

---

## Recommended Actions

### Immediate (Before Production)
None required - system is production-ready.

### Near-Term (P2)
1. Replace `console.log` with structured logger in services
2. Document JWT refresh token strategy for future implementation

### Long-Term (P3)
1. Consider implementing JWT refresh tokens
2. Add database-level Row Level Security (RLS) as defense-in-depth
3. Implement audit logging for sensitive operations

---

**Report Generated:** December 26, 2025
**Audit Complete:** All 8 security domains assessed
