# CSRF Protection Strategy

**Document:** CSRF Protection and CORS Configuration
**Last Updated:** December 25, 2025
**Status:** Active

---

## Overview

MAIS uses JWT Bearer tokens for API authentication instead of session cookies. This document explains why this architecture provides inherent CSRF protection and documents the permissive CORS configuration required for widget embedding.

---

## Current Authentication Strategy

### JWT Bearer Token Authentication

MAIS authenticates API requests using Bearer tokens:

1. **Token Storage:** JWT tokens stored in `localStorage` by the client
2. **Token Transmission:** Sent via `Authorization: Bearer <token>` header
3. **Token Validation:** Server validates signature, expiration, and tenant association
4. **No Cookies:** API does not use cookies for authentication (except NextAuth.js for admin SSR)

```typescript
// Client sends token explicitly
fetch('/v1/packages', {
  headers: {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Key': 'pk_live_bella-weddings_abc123',
  },
});
```

### Why This Provides CSRF Protection

CSRF (Cross-Site Request Forgery) attacks exploit a fundamental browser behavior: **cookies are automatically sent with every request to a domain**, including requests triggered by malicious sites.

**Bearer tokens are immune to CSRF because:**

1. **No Automatic Transmission:** Bearer tokens must be explicitly included in headers via JavaScript
2. **Same-Origin Policy:** JavaScript from a malicious site cannot read our localStorage
3. **Explicit Action Required:** An attacker would need to steal the token first (XSS), not just trigger a request

**Attack Comparison:**

| Attack Vector                       | Cookie Auth            | Bearer Token Auth                     |
| ----------------------------------- | ---------------------- | ------------------------------------- |
| Hidden form submission              | Vulnerable             | **Protected** - No token sent         |
| Image tag request                   | Vulnerable             | **Protected** - No token sent         |
| JavaScript fetch from attacker site | Vulnerable             | **Protected** - Cannot read our token |
| XSS + token theft                   | N/A (different attack) | Vulnerable (see Remaining Risks)      |

**OWASP Guidance:**

> "CSRF is an attack that forces an end user to execute unwanted actions on a web application in which they're currently authenticated... The attack relies on the user's session being stored in a cookie." - [OWASP CSRF Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

Since MAIS API endpoints require explicit Bearer token headers and do not rely on cookies for state-changing operations, traditional CSRF attacks are not applicable.

---

## CORS Configuration

### Current Configuration

Located in `/server/src/app.ts` (lines 106-146):

```typescript
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) return callback(null, true);

      // In development, allow all origins
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }

      // Hardcoded production origins (always allowed)
      const defaultOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://maconaisolutions.com',
        'https://www.maconaisolutions.com',
        'https://app.maconaisolutions.com',
        'https://widget.maconaisolutions.com',
      ];

      // Merge with environment variable overrides
      const allowedOrigins = [...defaultOrigins, ...(config.ALLOWED_ORIGINS || [])];

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
        // Allow all HTTPS origins in production (widget embedding)
        callback(null, true);
      } else {
        logger.warn({ origin, allowedOrigins }, 'CORS request blocked');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Key'],
    exposedHeaders: ['X-Tenant-Key'],
  })
);
```

### Rationale for Permissive CORS

**Business Requirement:** MAIS provides embeddable booking widgets that tenant customers install on their own websites. These widgets need to make API calls to the MAIS backend.

**Why All HTTPS Origins in Production:**

1. **Widget Embedding:** Tenants embed booking widgets on their custom domains (e.g., `https://bellaweddings.com`)
2. **Unpredictable Origins:** We cannot know all customer domains in advance
3. **HTTPS Requirement:** We only allow HTTPS origins (secure transport)
4. **Bearer Token Required:** Even with permissive CORS, API calls still require valid Bearer token or X-Tenant-Key

**CORS is NOT Authentication:**

CORS controls which origins can make requests, but every request still requires:

- Valid `X-Tenant-Key` header (for public endpoints)
- Valid `Authorization: Bearer` token (for authenticated endpoints)

Without these credentials, requests fail regardless of CORS policy.

---

## Remaining Risks and Mitigations

### 1. XSS Token Theft (Medium Risk)

**Risk:** If an attacker can execute JavaScript on our domain (XSS), they can steal the JWT from localStorage.

**Mitigations in Place:**

| Mitigation              | Implementation                          | Location                                      |
| ----------------------- | --------------------------------------- | --------------------------------------------- |
| Content Security Policy | Strict CSP with script-src restrictions | `/server/src/app.ts` lines 56-104             |
| Input Sanitization      | DOMPurify middleware for user input     | `/server/src/middleware/sanitize.ts`          |
| React Auto-escaping     | React escapes JSX output by default     | All React components                          |
| CSP Violation Reporting | Logged to `/v1/csp-violations`          | `/server/src/routes/csp-violations.routes.ts` |

**CSP Configuration:**

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // TODO: Replace with nonce in Phase 3
      'https://js.stripe.com',
    ],
    // ... additional restrictions
    frameAncestors: ["'none'"], // Prevent clickjacking
  },
},
```

### 2. Token in LocalStorage (Low Risk)

**Risk:** LocalStorage is accessible to any JavaScript on the page.

**Mitigations:**

- Short token lifetime (7 days for general, 24 hours for admins via NextAuth)
- Automatic token cleanup on logout
- CSP prevents unauthorized script execution

**Future Improvement:** Consider httpOnly cookies for sensitive admin operations (see Security Roadmap).

### 3. Open CORS for Production HTTPS (Low Risk)

**Risk:** Any HTTPS site can attempt API calls.

**Why This is Acceptable:**

- API calls still require valid credentials (X-Tenant-Key or Bearer token)
- Public endpoints (catalog, availability) are read-only
- Tenant data isolation enforced at query level
- Rate limiting prevents abuse

---

## Security Boundaries

### What CSRF Protection Does NOT Protect

1. **XSS Attacks:** If attacker can run JavaScript, they can steal tokens
2. **Credential Theft:** Phishing, keyloggers, malware
3. **Token Leakage:** Accidental logging, insecure transmission
4. **Session Fixation:** Not applicable (no server sessions for API)

### Defense in Depth Layers

```
Layer 1: CORS          → Controls which origins can send requests
Layer 2: Rate Limiting → Prevents brute-force and DoS
Layer 3: Bearer Token  → Authenticates the request
Layer 4: Tenant Key    → Associates request with correct tenant
Layer 5: Tenant Scope  → All queries filtered by tenantId
Layer 6: Input Validation → Prevents injection attacks
Layer 7: CSP           → Prevents XSS attacks
```

---

## NextAuth.js Session Cookies (Admin Only)

The Next.js admin frontend (`apps/web`) uses NextAuth.js with httpOnly session cookies for SSR authentication. This is separate from the API authentication.

**NextAuth Cookie Security:**

```typescript
// apps/web/src/lib/auth.ts
session: {
  strategy: 'jwt',
  maxAge: 24 * 60 * 60, // 24 hours
},
cookies: {
  sessionToken: {
    name: '__Secure-authjs.session-token',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
},
```

**Important:** The NextAuth session cookie does NOT contain the backend API token. The backend token is stored in the NextAuth JWT and only accessible server-side via `getBackendToken()`.

See: [NEXTAUTH_SECURITY.md](./NEXTAUTH_SECURITY.md) for detailed NextAuth patterns.

---

## Future Improvements

### Tenant-Based CORS Allowlist (Planned)

Instead of allowing all HTTPS origins, maintain a per-tenant allowlist:

```typescript
// Future: Tenant-specific CORS
const tenant = await getTenantByKey(origin);
if (tenant && tenant.allowedOrigins.includes(origin)) {
  callback(null, true);
}
```

**Benefits:**

- More restrictive
- Audit trail of which domains access which tenant
- Protection against unauthorized widget embedding

### HttpOnly Cookies for Sensitive Operations (Planned)

For high-risk operations (password change, payment methods), consider requiring httpOnly cookie authentication:

```typescript
// Future: Dual authentication for sensitive ops
if (isSensitiveOperation(req.path)) {
  validateBearerToken(req);
  validateHttpOnlyCookie(req); // Double-check
}
```

**Benefits:**

- Additional protection for sensitive operations
- Defense in depth against token theft

---

## Verification Checklist

When reviewing CORS/CSRF configuration:

- [ ] API endpoints require Bearer token or X-Tenant-Key
- [ ] No state-changing operations rely on cookies alone
- [ ] CSP headers properly configured
- [ ] Input sanitization middleware active
- [ ] Rate limiting applied to authentication endpoints
- [ ] CORS warnings logged for blocked origins
- [ ] NextAuth session cookies use httpOnly + secure flags

---

## Related Documents

- [SECURITY_SUMMARY.md](./SECURITY_SUMMARY.md) - Complete security overview
- [NEXTAUTH_SECURITY.md](./NEXTAUTH_SECURITY.md) - NextAuth.js patterns
- [OWASP_COMPLIANCE.md](./OWASP_COMPLIANCE.md) - OWASP Top 10 compliance

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [JWT.io Introduction](https://jwt.io/introduction)
