# Security Audit - Key Findings Summary

**Full audit report**: `SECURITY_AUDIT.md` (10,500+ words)

## Quick Score: 7.3/10 (MODERATE)

| Component        | Score | Status      |
| ---------------- | ----- | ----------- |
| Authentication   | 8/10  | STRONG ✓    |
| Tenant Isolation | 9/10  | EXCELLENT ✓ |
| Input Validation | 6/10  | MODERATE    |
| Audit Logging    | 3/10  | WEAK 🔴     |
| Rate Limiting    | 8/10  | STRONG ✓    |
| Security Headers | 6/10  | NEEDS WORK  |

---

## Top Strengths

### 1. Multi-Layer Tenant Isolation (9/10)

- Tenant ID enforced at **4 layers**: middleware → service → repository → database
- Composite unique constraints prevent cross-tenant data leaks
- Cache keys include tenantId to prevent poisoning
- Example: `catalog:${tenantId}:all-packages`

### 2. JWT Authentication (8/10)

- Explicit algorithm specification prevents confusion attacks (CVE-2016-5431)
- Strong token type separation (admin vs tenant)
- 7-day expiration is reasonable
- Only allows HS256, rejects other algorithms

### 3. Rate Limiting (8/10)

- **Differentiated by endpoint**:
  - Public: 300 req/15min
  - Admin: 120 req/15min
  - Login: 5 attempts/15min
- Only counts failed login attempts (not successful ones)

### 4. Webhook Security (9/10)

- Stripe signature verification prevents spoofing
- Idempotency protection prevents double-charging
- Zod-based payload validation (no unsafe JSON.parse)

### 5. Database Security (9/10)

- Prisma ORM prevents SQL injection
- Type-safe query building
- Parameterized queries throughout

---

## Critical Issues (Fix Immediately)

### 🔴 CRITICAL: Missing Audit Logging

**Impact**: Compliance violation (PCI-DSS, HIPAA, GDPR, SOC 2)

**No audit trail for**:

- Package create/update/delete
- Price changes (CRITICAL for compliance)
- Add-on modifications
- Branding updates
- Blackout date changes
- Tenant configuration changes
- Commission rate changes

**Example**: Admin changes package price from $500 to $50 → NO LOG

**Cost**: Regulatory fines, audit failure, fraud detection impossible

**Fix**: Create AuditLog table + logging service

```typescript
interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string; // 'PACKAGE_CREATE', 'PRICE_UPDATE', etc
  entityType: string; // 'package', 'addon', etc
  entityId: string;
  changes: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  timestamp: Date;
}
```

---

### 🔴 CRITICAL: CORS Too Permissive in Production

**Issue**: Allows ANY HTTPS origin to embed widget

```typescript
// Current (DANGEROUS in production):
if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
  callback(null, true); // ✓ Accepts ANY HTTPS origin
}
```

**Risk**:

- Malicious sites can embed booking widget
- Customer data exposed to untrusted sites
- No control over embedding partners

**Fix**: Use explicit whitelist

```typescript
const allowedOrigins = [
  'https://example.com',
  'https://widget.example.com',
  // ... explicit partners only
];
```

---

## High Priority Issues (Fix Within Sprint)

### ⚠️ HIGH: Missing Validation Upper Bounds

**Issue**: No max limits on prices, string lengths

**Examples**:

```typescript
// Can set price of $999,999.99
validatePrice(999999999); // ✓ Passes

// Can create title with 100k characters
title: "A".repeat(100000) // ✓ Passes (DoS vector)

// Can upload 100 photos
photos: Array(100).fill({...}) // ✓ Passes
```

**Fix**:

```typescript
// Price: Max $99,999.99
if (priceCents > 9999999) throw new ValidationError('Price too high');

// String lengths
title: z.string().max(255),
description: z.string().max(5000),

// Array sizes
photos: z.array(z.object({...})).max(5)
```

---

### ⚠️ HIGH: No Permission Validation in Services

**Issue**: Services don't check tenantId, rely only on middleware

**Risk**: If middleware misconfigured, can access other tenant's data

```typescript
// Current (middleware trusts everything):
async updatePackage(tenantId: string, id: string, data: UpdatePackageInput) {
  const pkg = await this.repository.getPackageById(tenantId, id);
  // NO CHECK: what if tenantId doesn't match token?
}

// Should be:
async updatePackage(tenantId: string, id: string, data: UpdatePackageInput) {
  const pkg = await this.repository.getPackageById(tenantId, id);
  if (pkg.tenantId !== tenantId) throw new ForbiddenError();
  // ...
}
```

---

## Medium Priority Issues (Before GA)

### ⚠️ MEDIUM: Token Payload Not Fully Validated

**Issue**: Missing format validation in JWT

```typescript
// Checks presence but not format:
if (!payload.tenantId || !payload.slug) {
  /* ... */
}

// Should validate:
// - tenantId is valid CUID format
// - slug is alphanumeric-hyphen only
```

---

### ⚠️ MEDIUM: No Request Size Limits

**Issue**: No explicit limits on JSON/form body size

```typescript
// Should be:
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
```

---

### ⚠️ MEDIUM: Rate Limiting Not Distributed

**Issue**: In-memory store doesn't share across servers

```typescript
// Current: Each server has its own rate limit counter
// In distributed setup: 5 servers × 120 req/15min = 600 req/15min total

// Should use Redis:
import RedisStore from 'rate-limit-redis';
const store = new RedisStore({ client: redis });
```

---

## Low Priority Issues (Polish)

### ℹ️ LOW: Email Validation Too Permissive

```typescript
// Accepts invalid emails: "a@b.c"
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Use zod instead:
email: z.string().email();
```

---

## Compliance Status

| Standard      | Status     | Blocker           |
| ------------- | ---------- | ----------------- |
| PCI-DSS       | ⚠️ PARTIAL | **Audit logging** |
| HIPAA         | ⚠️ PARTIAL | **Audit logging** |
| GDPR          | ⚠️ PARTIAL | Audit logging     |
| SOC 2 Type II | ⚠️ PARTIAL | **Audit logging** |
| OWASP Top 10  | ✓ GOOD     | None major        |

**Primary Blocker**: Audit logging is required by ALL compliance frameworks

---

## Implementation Roadmap

### Phase 1 (THIS SPRINT - Critical)

- [ ] Add AuditLog table to schema
- [ ] Implement audit logging service
- [ ] Log all package/addon/price changes
- [ ] Fix CORS whitelist
- **Estimated**: 8-10 hours

### Phase 2 (NEXT SPRINT - High Priority)

- [ ] Add validation upper bounds
- [ ] Add service-layer permission checks
- [ ] Add token format validation
- [ ] Add request size limits
- **Estimated**: 6-8 hours

### Phase 3 (BEFORE GA - Medium Priority)

- [ ] Switch to Redis rate limit store
- [ ] Add session management
- [ ] Improve email validation
- [ ] Add comprehensive logging to error logs
- **Estimated**: 10-12 hours

---

## Testing Recommendations

### For Audit Logging

```typescript
it('should log price change', async () => {
  await updatePackage(tenantId, pkgId, { priceCents: 5000 });

  const audit = await AuditLog.findLast({
    tenantId,
    action: 'PRICE_UPDATE',
  });

  expect(audit.changes.before.priceCents).toBe(10000);
  expect(audit.changes.after.priceCents).toBe(5000);
});
```

### For Validation

```typescript
it('should reject price > $99,999.99', async () => {
  expect(() => validatePrice(10000000)).toThrow();
});

it('should reject title > 255 chars', async () => {
  expect(() => {
    createPackageSchema.parse({
      title: 'A'.repeat(256),
      // ...
    });
  }).toThrow();
});
```

### For CORS

```typescript
it('should block non-whitelisted origins', async () => {
  const response = await fetch(api, {
    headers: { origin: 'https://malicious.com' },
  });
  expect(response.status).toBe(403); // or CORS error
});
```

---

## File-by-File Issues

| File                                            | Issue                        | Severity    |
| ----------------------------------------------- | ---------------------------- | ----------- |
| `server/src/app.ts`                             | CORS too permissive          | 🔴 CRITICAL |
| `server/src/lib/validation.ts`                  | Missing upper bounds         | ⚠️ HIGH     |
| `server/src/validation/tenant-admin.schemas.ts` | Missing string length limits | ⚠️ HIGH     |
| `server/src/services/catalog.service.ts`        | No permission checks         | ⚠️ HIGH     |
| `server/src/middleware/tenant-auth.ts`          | No token format validation   | ⚠️ MEDIUM   |
| Routes throughout                               | No audit logging             | 🔴 CRITICAL |

---

## Security Wins to Highlight

- ✅ 4-layer tenant isolation architecture
- ✅ JWT with explicit algorithm specification
- ✅ Timing-safe string comparison for keys
- ✅ Webhook signature verification
- ✅ Idempotent webhook processing
- ✅ Prisma ORM prevents SQL injection
- ✅ Differentiated rate limiting
- ✅ Cache poisoning prevention
- ✅ API key format validation before DB lookup
- ✅ Tenant status checks (prevents disabled accounts)

---

## Questions for Product/Engineering

1. **What's the target deployment** (single server or distributed)?
   - If distributed: Redis rate limiting is required

2. **Are customers PCI-DSS or HIPAA compliant**?
   - If yes: Audit logging is legally mandatory

3. **Are there partner integrations** that need widget embedding?
   - If yes: Need explicit CORS whitelist per partner

4. **What's the planned GA timeline**?
   - Use roadmap above to plan fixes

---

## Next Steps

1. **Read full audit**: `SECURITY_AUDIT.md`
2. **Create tickets** for each critical/high issue
3. **Implement Phase 1** before production release
4. **Plan Phase 2/3** for post-GA hardening
5. **Consider** security review by third party before GA

---

**Report generated**: 2024-11-10
**Audit scope**: Authentication, authorization, validation, audit logging, rate limiting, CORS
**Files reviewed**: 45+ TypeScript files, schema definitions, middleware stack
