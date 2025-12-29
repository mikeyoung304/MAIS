# MAIS Security Threat Model

**Date:** 2025-12-28
**System:** MAIS Multi-Tenant SaaS Platform
**Scope:** Backend API, Frontend Admin, Tenant Storefronts

---

## 1. System Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INTERNET                                       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Tenant Admin  │     │   Customer    │     │   Webhooks    │
│ (NextAuth.js) │     │  Storefronts  │     │   (Stripe)    │
│   /admin/*    │     │    /t/*       │     │ /v1/webhooks  │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        │  JWT Bearer Token   │ X-Tenant-Key Header │ Stripe Signature
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXPRESS API (port 3001)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Rate Limit  │─▶│   Auth      │─▶│  Tenant     │─▶│  Routes     │     │
│  │ Middleware  │  │ Middleware  │  │ Middleware  │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  PostgreSQL   │       │    Redis      │       │   Supabase    │
│   (Prisma)    │       │   (Cache)     │       │   Storage     │
└───────────────┘       └───────────────┘       └───────────────┘
```

### Trust Boundaries

| Boundary | Location                 | Protection                              |
| -------- | ------------------------ | --------------------------------------- |
| **TB-1** | Internet → Load Balancer | HTTPS/TLS 1.3                           |
| **TB-2** | Client → Express API     | Rate limiting, CORS, CSP                |
| **TB-3** | API → Database           | Connection pooling, prepared statements |
| **TB-4** | API → External Services  | API keys, HMAC signatures               |
| **TB-5** | Tenant A → Tenant B      | tenantId scoping on all queries         |

---

## 2. Threat Actors

### External Actors

| Actor                    | Motivation      | Capability                        | Targets                   |
| ------------------------ | --------------- | --------------------------------- | ------------------------- |
| **Script Kiddie**        | Chaos, practice | Automated tools, public exploits  | Login, public endpoints   |
| **Competitor**           | Business intel  | Social engineering, basic hacking | Customer data, pricing    |
| **Criminal**             | Financial gain  | Medium sophistication             | Payment data, credentials |
| **Disgruntled Customer** | Revenge         | Account access, API knowledge     | Service disruption        |

### Internal Actors

| Actor              | Access Level      | Risk                | Mitigation                            |
| ------------------ | ----------------- | ------------------- | ------------------------------------- |
| **Tenant Admin**   | Own tenant data   | Cross-tenant access | tenantId filtering                    |
| **Platform Admin** | All tenants       | Privilege abuse     | Audit logging, impersonation tracking |
| **Developer**      | Codebase, secrets | Credential theft    | Secret rotation, access reviews       |

---

## 3. Authentication Flows

### 3.1 Tenant Admin Login

```
User                    NextAuth                  Express API
  │                         │                         │
  │──── Email/Password ────▶│                         │
  │                         │──── POST /v1/auth/login ▶│
  │                         │                         │── Verify credentials
  │                         │                         │── Check tenant.isActive
  │                         │◀──── JWT token ─────────│
  │                         │                         │
  │◀── Session cookie ──────│                         │
  │    (HTTP-only)          │                         │
```

**Security Controls:**

- Rate limit: 5 attempts / 15 min / IP
- JWT algorithm: HS256 (explicit, prevents confusion attacks)
- Token expiry: 7 days (admin), 24h (session)
- Backend token: Stored in HTTP-only cookie, never exposed to client JS

### 3.2 Customer Storefront Access

```
Customer               Next.js SSR              Express API
  │                         │                         │
  │──── GET /t/tenant-slug ▶│                         │
  │                         │──── X-Tenant-Key ──────▶│
  │                         │                         │── Validate pk_live_*
  │                         │                         │── Resolve tenantId
  │                         │◀──── Tenant data ───────│
  │◀──── Rendered page ─────│                         │
```

**Security Controls:**

- API key format: `pk_live_{slug}_{16_hex}` (public) or `sk_live_{slug}_{32_hex}` (secret)
- Secret keys: SHA-256 hashed before storage
- Constant-time comparison: Prevents timing attacks

### 3.3 Platform Admin Impersonation

```
Admin                   Admin Panel              Express API
  │                         │                         │
  │── Impersonate tenant ──▶│                         │
  │                         │── POST /impersonate ───▶│
  │                         │                         │── Verify admin role
  │                         │                         │── Check not already impersonating
  │                         │                         │── Generate scoped token
  │                         │◀──── Impersonation JWT ─│
  │                         │                         │
  │◀── New session ─────────│                         │
```

**Security Controls:**

- Impersonation tokens: Tracked with `impersonatedBy` field
- Nested impersonation: Blocked (prevents privilege escalation)
- Audit trail: All impersonation events logged with admin ID

---

## 4. Attacker Paths & Mitigations

### 4.1 Authentication Attacks

| Attack                   | Vector                | Current Protection                  | Gap                |
| ------------------------ | --------------------- | ----------------------------------- | ------------------ |
| **Brute Force**          | POST /v1/auth/login   | 5 req/15 min/IP                     | None               |
| **Credential Stuffing**  | POST /v1/auth/login   | Rate limiting                       | Consider CAPTCHA   |
| **Session Hijacking**    | Steal JWT cookie      | HTTP-only, Secure flags             | 7-day expiry long  |
| **Token Replay**         | Reuse expired token   | Token expiration check              | No revocation list |
| **Password Reset Abuse** | POST /forgot-password | 1-hour token expiry, hashed storage | None               |

### 4.2 Authorization Attacks

| Attack                   | Vector                           | Current Protection                | Gap  |
| ------------------------ | -------------------------------- | --------------------------------- | ---- |
| **Cross-Tenant Access**  | Manipulate tenantId              | All queries filter by tenantId    | None |
| **Privilege Escalation** | Modify JWT claims                | HS256 signature verification      | None |
| **IDOR**                 | Change bookingId in URL          | Ownership check + tenantId filter | None |
| **Admin Bypass**         | Access admin routes without auth | JWT verification middleware       | None |

### 4.3 Injection Attacks

| Attack                | Vector                | Current Protection           | Gap                |
| --------------------- | --------------------- | ---------------------------- | ------------------ |
| **SQL Injection**     | User input to queries | Prisma ORM (parameterized)   | None               |
| **XSS (Reflected)**   | URL parameters        | Zod validation, sanitization | None               |
| **XSS (Stored)**      | Rich text fields      | XSS library whitelist        | SVG attribute risk |
| **Command Injection** | N/A                   | No shell execution           | None               |
| **NoSQL Injection**   | N/A                   | PostgreSQL only              | N/A                |

### 4.4 Payment Attacks

| Attack                 | Vector              | Current Protection                 | Gap                  |
| ---------------------- | ------------------- | ---------------------------------- | -------------------- |
| **Double Charge**      | Retry checkout      | Idempotency keys (no timestamp)    | None                 |
| **Webhook Replay**     | Resend webhook      | Stripe signature + DB dedup        | 5-min replay window  |
| **Double Booking**     | Concurrent requests | Advisory locks + unique constraint | Timeout not enforced |
| **Refund Fraud**       | Over-refund         | Cumulative refund tracking         | None                 |
| **Price Manipulation** | Modify checkout     | Server-side price calculation      | None                 |

### 4.5 Denial of Service

| Attack                  | Vector            | Current Protection              | Gap                    |
| ----------------------- | ----------------- | ------------------------------- | ---------------------- |
| **Rate Limit Bypass**   | IPv6 rotation     | /64 prefix normalization        | None                   |
| **Large Payload**       | Huge JSON body    | Body size limits                | Rate limit after parse |
| **Slow Loris**          | Slow HTTP         | Keep-alive timeout 65s          | None                   |
| **Database Exhaustion** | Unbounded queries | Pagination enforced (max 500)   | None                   |
| **File Upload Flood**   | Many large files  | 3 concurrent limit, size limits | No tenant quota        |

---

## 5. Data Flow Security

### 5.1 Sensitive Data Handling

| Data Type             | At Rest               | In Transit | In Logs         | Access Control    |
| --------------------- | --------------------- | ---------- | --------------- | ----------------- |
| **Passwords**         | bcrypt (10 rounds)    | HTTPS      | Never           | N/A               |
| **JWT Tokens**        | N/A (stateless)       | HTTPS      | Never           | HTTP-only cookie  |
| **API Keys (secret)** | SHA-256 hashed        | HTTPS      | Never           | Tenant admin only |
| **API Keys (public)** | Plaintext             | HTTPS      | **LOGGED**      | Public            |
| **Stripe Keys**       | AES-256-GCM encrypted | HTTPS      | Never           | Platform only     |
| **Customer Email**    | Plaintext             | HTTPS      | Request context | Tenant admin      |
| **Payment Data**      | Stripe-side only      | HTTPS      | Never           | Stripe handles    |

### 5.2 Critical Finding: API Key Logging

**Location:** `server/src/middleware/tenant.ts:85,112`

```typescript
// CURRENT (VULNERABLE)
logger.warn({ apiKey, path: req.path }, 'Invalid API key format');

// REQUIRED FIX
logger.warn(
  {
    apiKeyPeek: apiKey.slice(0, 8) + '...' + apiKey.slice(-4),
    path: req.path,
  },
  'Invalid API key format'
);
```

**Impact:** Full API keys visible in log aggregation (Datadog, CloudWatch, etc.)

---

## 6. External Service Trust

| Service             | Data Shared                      | Authentication       | Risk                 |
| ------------------- | -------------------------------- | -------------------- | -------------------- |
| **Stripe**          | Payment metadata, amounts        | API key (encrypted)  | Payment fraud        |
| **Postmark**        | Customer emails, booking details | API token            | Email compromise     |
| **Google Calendar** | Booking dates, availability      | Service account JSON | Schedule exposure    |
| **Supabase**        | All tenant data                  | Connection string    | Full database access |
| **Sentry**          | Error details, request context   | DSN                  | PII in stack traces  |

### Webhook Security

```
Stripe                          Express API
  │                                  │
  │── POST /v1/webhooks/stripe ─────▶│
  │   Headers:                       │
  │   - Stripe-Signature            │── Verify signature (HMAC-SHA256)
  │   Body: Raw event payload        │── Check timestamp (5-min window)
  │                                  │── Check idempotency (DB unique)
  │                                  │── Extract tenantId from metadata
  │◀──── 200 OK ─────────────────────│
```

**Gap:** Global namespace fallback (`_global`) when tenantId missing from metadata.

---

## 7. Tenant Isolation Model

### Database-Level Isolation

```
Every table with tenant data:
  ┌─────────────────────────────────────┐
  │ id       │ tenantId │ ...data...   │
  ├──────────┼──────────┼──────────────┤
  │ booking1 │ tenant-a │ ...          │
  │ booking2 │ tenant-b │ ...          │
  │ booking3 │ tenant-a │ ...          │
  └─────────────────────────────────────┘
                 ▲
                 │
  All queries MUST include: WHERE tenantId = ?
```

### Repository Pattern Enforcement

```typescript
// INTERFACE (ports.ts)
interface BookingRepository {
  findById(tenantId: string, bookingId: string): Promise<Booking>;
  //       ^^^^^^^^ REQUIRED - impossible to skip
}

// IMPLEMENTATION
async findById(tenantId: string, bookingId: string) {
  return prisma.booking.findFirst({
    where: { tenantId, id: bookingId }  // Both fields required
  });
}
```

### Cache Key Isolation

```typescript
// CORRECT - tenant-scoped
const key = `catalog:${tenantId}:packages`;

// WRONG - would leak data (prevented by code review)
const key = 'catalog:packages';
```

---

## 8. Attack Surface Summary

### External Attack Surface

| Endpoint Type       | Count | Auth Required | Rate Limited    |
| ------------------- | ----- | ------------- | --------------- |
| Public Tenant Pages | 5     | No            | Yes (300/15min) |
| Public Booking      | 3     | API Key       | Yes (100/min)   |
| Admin Auth          | 4     | No            | Yes (5/15min)   |
| Admin Operations    | 50+   | JWT           | Yes (120/15min) |
| Webhooks            | 2     | Signature     | Yes (100/min)   |
| Health Checks       | 2     | No            | No              |

### Internal Attack Surface

| Component        | Exposure    | Protection                              |
| ---------------- | ----------- | --------------------------------------- |
| Database         | VPC only    | Connection pooling, prepared statements |
| Redis            | VPC only    | Auth token, TLS                         |
| Supabase Storage | Signed URLs | 1-year expiry, tenant prefixes          |
| BullMQ Queue     | VPC only    | Redis auth                              |

---

## 9. Security Controls Matrix

| Control                   | Implemented | Evidence                          |
| ------------------------- | ----------- | --------------------------------- |
| **Input Validation**      | Yes         | Zod schemas on all endpoints      |
| **Output Encoding**       | Yes         | React JSX escaping, XSS library   |
| **Authentication**        | Yes         | JWT with HS256, bcrypt passwords  |
| **Authorization**         | Yes         | tenantId filtering, role checks   |
| **Session Management**    | Yes         | HTTP-only cookies, 24h timeout    |
| **HTTPS**                 | Yes         | HSTS preload, 1-year max-age      |
| **CSP**                   | Partial     | unsafe-inline for Stripe.js       |
| **Rate Limiting**         | Yes         | 12 different limiters             |
| **Error Handling**        | Yes         | Operational vs non-operational    |
| **Logging**               | Partial     | **API keys logged in plaintext**  |
| **Encryption at Rest**    | Yes         | AES-256-GCM for secrets           |
| **Encryption in Transit** | Yes         | TLS 1.3                           |
| **Secrets Management**    | Partial     | .env file (needs secrets manager) |
| **Dependency Scanning**   | Yes         | 0 npm vulnerabilities             |

---

## 10. Recommended Threat Mitigations

### Immediate (P0)

1. **Fix API key logging** - Redact in tenant middleware
2. **Add tenant validation** - Reject webhooks without tenantId
3. **Enforce advisory lock timeout** - Pass timeout to transaction

### Short-term (P1)

4. **Implement CSRF tokens** - For sensitive admin operations
5. **Add CAPTCHA** - For signup and password reset
6. **Reduce token expiry** - 4h for impersonation, 1d for admin

### Medium-term (P2)

7. **Implement CSP nonces** - Replace unsafe-inline
8. **Add circuit breakers** - For external service calls
9. **Deploy secrets manager** - Replace .env files

---

_Threat model reviewed by: Security Audit Team_
_Next review date: Quarterly or after significant changes_
