# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in MAIS, please report it to:

**Email:** security@maconaisolutions.com

### What to Include

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Initial Response:** Within 48 hours
- **Status Update:** Within 7 days
- **Resolution:** Severity-dependent (Critical: 48h, High: 7d, Medium: 30d)

We will acknowledge your contribution in our security advisories (unless you prefer to remain anonymous).

---

## Security Architecture

### Multi-Tenant Data Isolation

MAIS uses row-level multi-tenancy with **strict tenant ID scoping**:

- ✅ All database queries filter by `tenantId`
- ✅ API keys encode tenant slug for validation
- ✅ Middleware enforces tenant context on every request
- ✅ Repository interfaces require `tenantId` parameter
- ✅ Unique constraints scoped per tenant

**Test Coverage:** 100% of repository methods include tenant isolation tests

### Authentication & Authorization

**Platform Admin:**

- JWT-based authentication
- bcrypt password hashing (cost factor: 10)
- Rate limiting: 5 attempts per 15 minutes per IP
- Session expiry: 24 hours

**Tenant Admin:**

- Separate JWT tokens with tenant scope
- API key authentication (pk*live*_ / sk*live*_)
- Rate limiting: 5 attempts per 15 minutes per IP

**Customer:**

- Email-based identification (no password)
- Verified via Stripe checkout flow

### Input Validation

**Defense-in-Depth Approach:**

1. **Schema Validation (Primary):** Zod schemas on all endpoints
2. **Sanitization (Secondary):** XSS prevention via sanitization middleware
3. **Database Layer (Tertiary):** Prisma parameterized queries (SQL injection prevention)

**Sanitization Rules:**

- Plain text fields: Strip all HTML, escape special chars
- Email fields: Normalize + validate format
- URL fields: Protocol whitelist (http/https only)
- Slug fields: Lowercase alphanumeric + hyphens only
- Description fields: Whitelist safe HTML tags (p, strong, em, br)

### SQL Injection Prevention

✅ **Prisma ORM:** All queries use parameterized statements
✅ **Raw Queries:** Use `$queryRawUnsafe` with typed parameters only
✅ **No String Concatenation:** Never concatenate user input into SQL

**Example:**

```typescript
// ✅ SAFE - Parameterized
await tx.$queryRawUnsafe('SELECT * FROM "Booking" WHERE "tenantId" = $1', tenantId);

// ❌ UNSAFE - Never do this
await tx.$queryRawUnsafe(`SELECT * FROM "Booking" WHERE "tenantId" = '${tenantId}'`);
```

### Cross-Site Scripting (XSS) Prevention

**Layers of Defense:**

1. **Content Security Policy (CSP):**
   - Strict directives for scripts, styles, images
   - No `unsafe-eval`
   - Limited `unsafe-inline` for Tailwind CSS and Stripe integration
   - CSP violation reporting to `/v1/csp-violations`

2. **Input Sanitization:**
   - HTML sanitization with whitelist approach
   - Special character escaping
   - URL protocol validation

3. **Output Encoding:**
   - React auto-escapes by default
   - Manual escaping for `dangerouslySetInnerHTML` (avoided where possible)

### Cross-Site Request Forgery (CSRF)

**Protection:**

- SameSite cookies: `strict`
- CORS whitelist for API endpoints
- JWT tokens (not cookies) for authentication
- State parameter in OAuth flows

### Rate Limiting

**Global Rate Limits:**

- General API: 100 req/min per IP
- Admin routes: 20 req/min per IP
- Login endpoints: 5 attempts per 15 min per IP

**Implementation:** `express-rate-limit` with in-memory store (Redis recommended for production)

### Secrets Management

**Environment Variables:**

- `JWT_SECRET` - JWT signing key (256-bit)
- `TENANT_SECRETS_ENCRYPTION_KEY` - Tenant-specific secret encryption (256-bit)
- `DATABASE_URL` - PostgreSQL connection string
- `STRIPE_SECRET_KEY` - Stripe API key
- `POSTMARK_SERVER_TOKEN` - Email service token

**Rotation:**

- JWT secrets: Rotate every 90 days
- Database passwords: Rotate every 180 days
- API keys: Rotate on tenant offboarding

See: [Secret Rotation Guide](./docs/security/SECRET_ROTATION_GUIDE.md)

### HTTPS & TLS

**Production Requirements:**

- TLS 1.2+ only (1.0/1.1 disabled)
- Strong cipher suites
- HSTS enabled (max-age: 1 year, includeSubDomains)
- Certificate: Let's Encrypt or AWS ACM

### Security Headers

Configured via Helmet.js:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: [see CSP configuration in app.ts]`

### Error Handling

**Production Error Policy:**

- ❌ Never expose stack traces
- ❌ Never expose internal paths
- ❌ Never expose database errors
- ✅ Log full errors internally (Sentry)
- ✅ Return generic messages to clients

### Audit Logging

**Logged Events:**

- Authentication attempts (success/failure)
- Admin actions (package create/update/delete)
- Tenant configuration changes
- Booking creation
- Payment completion
- CSP violations

**Log Retention:** 90 days (configurable)

### Dependency Management

**Process:**

- Weekly automated dependency updates (Dependabot)
- Security audit: `npm audit` in CI/CD
- Critical CVEs: Patch within 48 hours
- High CVEs: Patch within 7 days

### Third-Party Services

**External Dependencies:**

- **Stripe:** PCI-DSS compliant (payment processing)
- **Postmark:** GDPR compliant (email delivery)
- **Supabase:** SOC 2 Type II (database hosting)
- **Sentry:** GDPR compliant (error tracking)

---

## Security Testing

### Automated Tests

- Unit tests: Input validation, sanitization
- Integration tests: Multi-tenant isolation, authentication
- E2E tests: Complete user flows

### Manual Testing

- Quarterly penetration testing (external vendor)
- Annual security audit (internal team)
- Responsible disclosure program

---

## Compliance

### Standards

- OWASP Top 10 (2021)
- WCAG 2.1 AA (Accessibility)
- GDPR (Data Protection) - EU customers
- CCPA (Privacy) - California customers
- PCI-DSS (via Stripe)

### Data Privacy

**User Data Handling:**

- Minimal data collection
- Explicit consent for email
- Data deletion on request (GDPR Article 17)
- Data export on request (GDPR Article 20)
- 30-day retention after tenant deletion

---

## Incident Response

### Process

1. **Detection:** Automated monitoring + user reports
2. **Assessment:** Severity classification (Critical/High/Medium/Low)
3. **Containment:** Isolate affected systems
4. **Eradication:** Remove threat
5. **Recovery:** Restore normal operations
6. **Lessons Learned:** Post-mortem + remediation

### Communication

- Critical: Notify affected users within 24 hours
- High: Notify within 72 hours
- Status page: status.maconaisolutions.com

---

## Security Contacts

- **Security Team:** security@maconaisolutions.com
- **Bug Bounty:** https://maconaisolutions.com/security/bounty
- **PGP Key:** https://maconaisolutions.com/security/pgp

---

**Last Updated:** 2025-11-21
**Version:** 1.0
