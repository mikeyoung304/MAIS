# Elope API Surface Area Analysis for Agent/LLM Integration

**Date**: 2025-11-10  
**Scope**: Complete API endpoint inventory, authentication requirements, validation rules, and gaps

---

## Executive Summary

The Elope system has a **multi-tenant REST API** with clear separation between:

1. **Public APIs** - Package browsing, availability checks, booking checkout
2. **Platform Admin APIs** - Tenant management, global configuration
3. **Tenant Admin APIs** - Self-service management of packages, branding, blackouts
4. **Authentication Endpoints** - Admin login, tenant login

The API uses **JWT token-based authentication**, **Zod schema validation**, and **rate limiting** on mutation endpoints. Key gaps exist for bulk operations, configuration templates, and AI-friendly batch endpoints.

---

## Part 1: Complete API Endpoint Inventory

### 1.1 PUBLIC ENDPOINTS (No Authentication)

#### Packages (Catalog)

| Method | Path                 | Purpose             | Auth | Rate Limit         | Notes                                 |
| ------ | -------------------- | ------------------- | ---- | ------------------ | ------------------------------------- |
| GET    | `/v1/packages`       | List all packages   | None | Public (300/15min) | Tenant-scoped via X-Tenant-Key header |
| GET    | `/v1/packages/:slug` | Get package by slug | None | Public             | Includes add-ons                      |

#### Availability

| Method | Path                                                 | Purpose                        | Auth | Rate Limit | Notes                                                         |
| ------ | ---------------------------------------------------- | ------------------------------ | ---- | ---------- | ------------------------------------------------------------- |
| GET    | `/v1/availability?date=YYYY-MM-DD`                   | Check single date availability | None | Public     | Returns: available boolean, reason (booked/blackout/calendar) |
| GET    | `/v1/availability/unavailable?startDate=X&endDate=Y` | Batch unavailable dates        | None | Public     | Efficient date range query                                    |

#### Bookings (Customer-Facing)

| Method | Path                    | Purpose                        | Auth | Rate Limit | Notes                                                   |
| ------ | ----------------------- | ------------------------------ | ---- | ---------- | ------------------------------------------------------- |
| POST   | `/v1/bookings/checkout` | Create Stripe checkout session | None | Public     | Validates package exists, date available, add-ons valid |
| GET    | `/v1/bookings/:id`      | Get booking details            | None | Public     | For confirmation page (no sensitive data leaked)        |

#### Branding

| Method | Path                  | Purpose                    | Auth | Rate Limit | Notes                                        |
| ------ | --------------------- | -------------------------- | ---- | ---------- | -------------------------------------------- |
| GET    | `/v1/tenant/branding` | Get tenant branding config | None | Public     | Colors, fonts, logo for widget customization |

#### Webhooks

| Method | Path                  | Purpose                 | Auth      | Rate Limit | Notes                          |
| ------ | --------------------- | ----------------------- | --------- | ---------- | ------------------------------ |
| POST   | `/v1/webhooks/stripe` | Stripe webhook receiver | Signature | Public     | Raw body for HMAC verification |

---

### 1.2 AUTHENTICATION ENDPOINTS (Public but return tokens)

#### Unified Authentication (RECOMMENDED)

| Method | Path              | Purpose                      | Auth | Rate Limit                 | Notes                                |
| ------ | ----------------- | ---------------------------- | ---- | -------------------------- | ------------------------------------ |
| POST   | `/v1/auth/login`  | Login for admin or tenant    | None | **5/15min** (loginLimiter) | Body: email, password                |
| GET    | `/v1/auth/verify` | Verify token & get user info | JWT  | None                       | Returns role, tenantId if applicable |

#### Platform Admin Authentication (Legacy)

| Method | Path              | Purpose              | Auth | Rate Limit  | Notes                            |
| ------ | ----------------- | -------------------- | ---- | ----------- | -------------------------------- |
| POST   | `/v1/admin/login` | Platform admin login | None | **5/15min** | Returns token with role: 'admin' |

#### Tenant Admin Authentication

| Method | Path                    | Purpose                    | Auth       | Rate Limit  | Notes                                             |
| ------ | ----------------------- | -------------------------- | ---------- | ----------- | ------------------------------------------------- |
| POST   | `/v1/tenant-auth/login` | Tenant admin login         | None       | **5/15min** | Returns token with type: 'tenant', tenantId, slug |
| GET    | `/v1/tenant-auth/me`    | Get current tenant context | Tenant JWT | None        | Returns: tenantId, slug, email                    |

---

### 1.3 PLATFORM ADMIN ENDPOINTS (Requires Admin Authentication)

#### Tenant Management

| Method | Path                    | Purpose                         | Auth          | Rate Limit        | Notes                                            |
| ------ | ----------------------- | ------------------------------- | ------------- | ----------------- | ------------------------------------------------ |
| GET    | `/v1/admin/tenants`     | List all tenants                | **Admin JWT** | Admin (120/15min) | Includes stats (bookings, packages, add-ons)     |
| POST   | `/v1/admin/tenants`     | Create new tenant               | **Admin JWT** | Admin             | Body: slug, name, commission(0-100)              |
| GET    | `/v1/admin/tenants/:id` | Get tenant details              | **Admin JWT** | Admin             | Includes branding, stripe status, full stats     |
| PUT    | `/v1/admin/tenants/:id` | Update tenant settings          | **Admin JWT** | Admin             | Can update: name, commission, branding, isActive |
| DELETE | `/v1/admin/tenants/:id` | Deactivate tenant (soft delete) | **Admin JWT** | Admin             | Sets isActive=false                              |

#### Stripe Connect Management

| Method | Path                                            | Purpose                     | Auth          | Rate Limit | Notes                                                 |
| ------ | ----------------------------------------------- | --------------------------- | ------------- | ---------- | ----------------------------------------------------- |
| POST   | `/v1/admin/tenants/:tenantId/stripe/connect`    | Create Stripe account       | **Admin JWT** | Admin      | Body: country, email                                  |
| POST   | `/v1/admin/tenants/:tenantId/stripe/onboarding` | Generate onboarding link    | **Admin JWT** | Admin      | Returns onboarding URL with expiration                |
| GET    | `/v1/admin/tenants/:tenantId/stripe/status`     | Check Stripe account status | **Admin JWT** | Admin      | Returns: chargesEnabled, payoutsEnabled, requirements |

#### Legacy Admin - Bookings

| Method | Path                 | Purpose           | Auth          | Rate Limit | Notes                                                |
| ------ | -------------------- | ----------------- | ------------- | ---------- | ---------------------------------------------------- |
| GET    | `/v1/admin/bookings` | List all bookings | **Admin JWT** | Admin      | Legacy - uses DEFAULT_TENANT='tenant_default_legacy' |

#### Legacy Admin - Blackouts

| Method | Path                  | Purpose              | Auth          | Rate Limit | Notes                                      |
| ------ | --------------------- | -------------------- | ------------- | ---------- | ------------------------------------------ |
| GET    | `/v1/admin/blackouts` | List all blackouts   | **Admin JWT** | Admin      | Legacy single-tenant                       |
| POST   | `/v1/admin/blackouts` | Create blackout date | **Admin JWT** | Admin      | Body: date (YYYY-MM-DD), reason (optional) |

#### Legacy Admin - Packages (deprecated, use tenant admin instead)

| Method | Path                     | Purpose        | Auth          | Rate Limit | Notes                                                |
| ------ | ------------------------ | -------------- | ------------- | ---------- | ---------------------------------------------------- |
| POST   | `/v1/admin/packages`     | Create package | **Admin JWT** | Admin      | Body: slug, title, description, priceCents, photoUrl |
| PUT    | `/v1/admin/packages/:id` | Update package | **Admin JWT** | Admin      | Partial update allowed                               |
| DELETE | `/v1/admin/packages/:id` | Delete package | **Admin JWT** | Admin      | Cascades to add-ons                                  |

#### Legacy Admin - Add-Ons (deprecated, use tenant admin instead)

| Method | Path                                   | Purpose       | Auth          | Rate Limit | Notes                             |
| ------ | -------------------------------------- | ------------- | ------------- | ---------- | --------------------------------- |
| POST   | `/v1/admin/packages/:packageId/addons` | Create add-on | **Admin JWT** | Admin      | Body: title, priceCents, photoUrl |
| PUT    | `/v1/admin/addons/:id`                 | Update add-on | **Admin JWT** | Admin      | Partial update allowed            |
| DELETE | `/v1/admin/addons/:id`                 | Delete add-on | **Admin JWT** | Admin      |                                   |

---

### 1.4 TENANT ADMIN ENDPOINTS (Requires Tenant JWT)

#### Self-Service Packages (Recommended)

| Method | Path                            | Purpose              | Auth           | Rate Limit        | Notes                                                |
| ------ | ------------------------------- | -------------------- | -------------- | ----------------- | ---------------------------------------------------- |
| GET    | `/v1/tenant/admin/packages`     | List tenant packages | **Tenant JWT** | Admin (120/15min) | Includes photo arrays                                |
| POST   | `/v1/tenant/admin/packages`     | Create new package   | **Tenant JWT** | Admin             | Body: slug, title, description, priceCents, photoUrl |
| PUT    | `/v1/tenant/admin/packages/:id` | Update package       | **Tenant JWT** | Admin             | Partial update, ownership verified                   |
| DELETE | `/v1/tenant/admin/packages/:id` | Delete package       | **Tenant JWT** | Admin             | Ownership verified                                   |

#### Package Photos

| Method | Path                                             | Purpose              | Auth           | Rate Limit | Notes                              |
| ------ | ------------------------------------------------ | -------------------- | -------------- | ---------- | ---------------------------------- |
| POST   | `/v1/tenant/admin/packages/:id/photos`           | Upload package photo | **Tenant JWT** | Admin      | Max 5 photos/package, max 5MB each |
| DELETE | `/v1/tenant/admin/packages/:id/photos/:filename` | Delete photo         | **Tenant JWT** | Admin      | Deletes from storage and database  |

#### Self-Service Blackouts

| Method | Path                             | Purpose             | Auth           | Rate Limit | Notes                                      |
| ------ | -------------------------------- | ------------------- | -------------- | ---------- | ------------------------------------------ |
| GET    | `/v1/tenant/admin/blackouts`     | List blackout dates | **Tenant JWT** | Admin      | Ordered by date ASC                        |
| POST   | `/v1/tenant/admin/blackouts`     | Add blackout date   | **Tenant JWT** | Admin      | Body: date (YYYY-MM-DD), reason (optional) |
| DELETE | `/v1/tenant/admin/blackouts/:id` | Remove blackout     | **Tenant JWT** | Admin      | Ownership verified                         |

#### Booking Visibility (Read-Only)

| Method | Path                                                       | Purpose              | Auth           | Rate Limit | Notes                                                    |
| ------ | ---------------------------------------------------------- | -------------------- | -------------- | ---------- | -------------------------------------------------------- |
| GET    | `/v1/tenant/admin/bookings?status=X&startDate=X&endDate=X` | List tenant bookings | **Tenant JWT** | Admin      | Query filters: status, startDate, endDate (all optional) |

#### Branding Management

| Method | Path                        | Purpose             | Auth           | Rate Limit | Notes                                                   |
| ------ | --------------------------- | ------------------- | -------------- | ---------- | ------------------------------------------------------- |
| GET    | `/v1/tenant/admin/branding` | Get branding config | **Tenant JWT** | Admin      | Returns: primaryColor, secondaryColor, fontFamily, logo |
| PUT    | `/v1/tenant/admin/branding` | Update branding     | **Tenant JWT** | Admin      | Partial update, hex color validation                    |
| POST   | `/v1/tenant/logo`           | Upload logo image   | **Tenant JWT** | Admin      | Max 2MB, returns URL                                    |

---

### 1.5 DEVELOPMENT/DEBUG ENDPOINTS (Mock Mode Only)

| Method | Path                                  | Purpose                     | Notes          |
| ------ | ------------------------------------- | --------------------------- | -------------- |
| POST   | `/v1/dev/simulate-checkout-completed` | Simulate payment completion | Mock mode only |
| GET    | `/v1/dev/debug-state`                 | Get internal state          | Mock mode only |
| POST   | `/v1/dev/reset`                       | Reset database              | Mock mode only |

---

## Part 2: Authentication & Authorization

### 2.1 Token Types

#### Platform Admin Token

```typescript
{
  userId: string;
  email: string;
  role: 'admin'; // REQUIRED - identifies as admin
  // Issued by: /v1/admin/login or /v1/auth/login
  // Used on: /v1/admin/* routes
}
```

#### Tenant Admin Token

```typescript
{
  tenantId: string;
  slug: string;
  email: string;
  type: 'tenant'; // REQUIRED - identifies as tenant
  // Issued by: /v1/tenant-auth/login or /v1/auth/login
  // Used on: /v1/tenant/* routes
}
```

### 2.2 Middleware Stack

**Global Middleware** (applied in `app.ts`):

1. Helmet (security headers)
2. CORS (wildcard HTTPS in prod, specific origins in dev)
3. Rate Limiting (public: 300/15min, admin: 120/15min, login: 5/15min)
4. Body Parsing (JSON + raw for Stripe)
5. Request Logging (request ID tracking)

**Route-Specific Middleware**:

- **Public routes** (`/v1/packages`, `/v1/bookings`, `/v1/availability`): None (except rate limit)
- **Admin routes** (`/v1/admin/*`): `createAuthMiddleware()` validates JWT has `role: 'admin'`
- **Tenant routes** (`/v1/tenant/admin/*`): `createTenantAuthMiddleware()` validates JWT has `type: 'tenant'`
- **Login routes** (`/v1/admin/login`, `/v1/tenant-auth/login`): `loginLimiter` (5 attempts/15min, skipSuccessfulRequests)

### 2.3 Token Validation & Security

```typescript
// Admin token validation (from auth.ts)
if (payload.type === 'tenant') {
  throw UnauthorizedError('tenant tokens not allowed for admin routes');
}
if (!payload.role || payload.role !== 'admin') {
  throw UnauthorizedError('admin role required');
}

// Tenant token validation (from tenant-auth.ts)
if (!payload.type || payload.type !== 'tenant') {
  throw UnauthorizedError('only tenant tokens allowed');
}
if (!payload.tenantId || !payload.slug) {
  throw UnauthorizedError('missing tenant context');
}
```

---

## Part 3: Validation Rules & Constraints

### 3.1 Package Management Validation

#### Create Package

```zod
slug: string().min(1)
title: string().min(1)
description: string().min(1)
priceCents: number().int().min(0)        // ⚠️ No max price limit
photoUrl: string().url().optional()
```

**Constraints**:

- Slug must be unique per tenant
- Price must be >= 0 (no upper limit)
- Photo URL must be valid HTTP(S)
- No validation on slug format (alphanumeric, hyphens, etc.)

#### Update Package

Same schema but all fields optional (partial update)

**Constraints**:

- Ownership verified: tenantId from JWT vs package.tenantId
- If slug changed: new slug must be unique for tenant
- Can update price to 0 (might unintentionally create free packages)

### 3.2 Add-On Validation

#### Create Add-On

```zod
packageId: string().min(1)
title: string().min(1)
priceCents: number().int().min(0)        // ⚠️ No max price limit
photoUrl: string().url().optional()
```

#### Update Add-On

Same schema but all fields optional

**Constraints**:

- Package must exist
- Can move add-on to different package
- No validation on add-on count per package

### 3.3 Blackout Validation

```zod
date: string().regex(/^\d{4}-\d{2}-\d{2}$/)    // YYYY-MM-DD only
reason: string().optional()                     // No length limit
```

**Constraints**:

- Date must be in exact format
- No validation on past/future dates
- Can create blackouts in the past
- Multiple blackouts same date allowed
- No duplicate detection

### 3.4 Availability Validation

```zod
date: string().regex(/^\d{4}-\d{2}-\d{2}$/)    // YYYY-MM-DD only
startDate: string().regex(/^\d{4}-\d{2}-\d{2}$/)
endDate: string().regex(/^\d{4}-\d{2}-\d{2}$/)
```

**Constraints**:

- No validation on startDate < endDate
- No date range limits (can query 10-year range)

### 3.5 Branding Validation

```zod
primaryColor: string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
secondaryColor: string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
fontFamily: string().optional()                  // No length limit
logo: string().url().optional()
```

**Constraints**:

- Colors must be 6-digit hex (no short form #RGB)
- Font family no length validation
- Logo URL must be valid HTTP(S)

### 3.6 Checkout Validation

```zod
packageId: string()
eventDate: string().regex(/^\d{4}-\d{2}-\d{2}$/)
coupleName: string()
email: string().email()
addOnIds: string[].optional()
```

**Constraints**:

- Package must exist and be active
- Event date must be available
- All add-ons must belong to package
- Email must be valid format
- No name length validation

### 3.7 Login Validation

```zod
email: string().email()
password: string()                       // No length requirements
```

**Constraints**:

- Email format validated
- Password no length/complexity requirements
- No rate limiting on password validation attempts (only on login endpoint)

---

## Part 4: Critical Gaps for Agent Integration

### 4.1 MISSING: Bulk Operations

**Gap**: No batch endpoints for LLM operations

- ❌ Cannot create multiple packages in one request
- ❌ Cannot bulk update prices
- ❌ Cannot bulk create blackout dates
- ❌ Cannot delete multiple items in one request

**Workaround Required**: Agent must make N+1 requests for N items

### 4.2 MISSING: Configuration Templates

**Gap**: No pre-built package templates

- ❌ No "wedding preset" with standard add-ons
- ❌ No "elopement preset" with pricing tiers
- ❌ No template duplication feature

**Workaround Required**: Agent must manually create each package

### 4.3 MISSING: Validation-Only Endpoints

**Gap**: No dry-run endpoints to validate before committing

- ❌ Cannot validate slug uniqueness before creation
- ❌ Cannot preview pricing with add-ons
- ❌ Cannot test branding colors on widget

**Workaround Required**: Agent must catch validation errors on actual requests

### 4.4 MISSING: Batch Query Endpoints

**Gap**: No efficient multi-item fetch

- ❌ Cannot get multiple packages by ID in one request
- ❌ Cannot get all add-ons across packages
- ❌ Cannot get bookings filtered by multiple statuses

**Workaround Required**: Agent makes multiple GET requests

### 4.5 MISSING: Audit Trail API

**Gap**: No endpoint to track configuration changes

- ❌ Cannot see who changed package pricing
- ❌ Cannot see change history of branding
- ❌ Cannot audit blackout modifications

**Workaround Required**: Parse server logs (not exposed via API)

### 4.6 MISSING: Configuration Export/Import

**Gap**: No way to bulk export or backup configuration

- ❌ Cannot export all packages for backup
- ❌ Cannot import packages from CSV
- ❌ Cannot clone configuration between tenants

**Workaround Required**: Agent must reconstruct from API calls

### 4.7 MISSING: Transaction Support

**Gap**: No atomic multi-step operations

- ❌ Creating package + add-ons not atomic
- ❌ Updating pricing across package + add-ons not atomic
- ❌ Cannot rollback partial updates on error

**Workaround Required**: Manual coordination, risk of partial failures

### 4.8 MISSING: Conditional Updates

**Gap**: No if-match or optimistic locking

- ❌ Cannot prevent concurrent edits
- ❌ No version/etag support
- ❌ No last-write-wins conflict detection

**Workaround Required**: Trust timestamps or retry on conflict

### 4.9 MISSING: Async Job Queue

**Gap**: No long-running operations endpoint

- ❌ Cannot queue large photo uploads
- ❌ Cannot schedule bulk operations
- ❌ No job status polling

**Workaround Required**: Synchronous blocking operations only

### 4.10 MISSING: AI-Friendly Response Format

**Gap**: No structured response format optimized for LLM parsing

- ❌ No machine-readable status enums (HTTP status codes used instead)
- ❌ No consistent error code schema
- ❌ Error messages vary by endpoint

**Workaround Required**: Parse error messages for intent

---

## Part 5: Hard Boundaries & Security Constraints

### 5.1 AGENTS SHOULD NEVER DO

**1. Access data across tenants** ⛔

- Each JWT is scoped to a tenantId
- Service layer enforces ownership checks
- `catalogService.updatePackage(tenantId, id, data)` validates tenantId ownership
- Cross-tenant queries impossible due to middleware

**2. Modify bookings** ⛔

- Booking endpoints are **READ-ONLY** for tenant admins
- Only Stripe webhooks can update booking status
- Cannot refund, cancel, or edit customer data via API
- Cannot modify totalCents or addOnIds

**3. Delete tenants (as tenant admin)** ⛔

- Only platform admins can deactivate tenants
- Tenant admins cannot access `/v1/admin/tenants`
- Token type validation rejects tenant tokens on admin routes

**4. Modify other tenants' Stripe accounts** ⛔

- Stripe Connect routes are platform-admin only
- No tenant-level Stripe management
- Cannot change commission percentage

**5. Bypass price validation** ⛔

- All prices must be integers >= 0
- Zod schema enforces this at middleware level
- Negative prices impossible

**6. Create duplicate API keys** ⛔

- API keys generated server-side only
- Secret key shown once on creation
- Cannot retrieve existing secret keys

**7. Modify branding outside bounds** ⛔

- Color validation enforces 6-digit hex
- Font family persisted as-is but widget may not support all fonts
- Logo URL must be valid HTTP(S)

**8. Bypass rate limits** ⛔

- 5 login attempts per 15 minutes (strict)
- 120 admin requests per 15 minutes
- No token refresh endpoint to reset counters
- IP-based rate limiting (can't defeat with same IP)

---

## Part 6: Rate Limiting Details

### 6.1 Rate Limit Configuration

```typescript
publicLimiter: {
  windowMs: 15 * 60 * 1000,      // 15 minutes
  max: 300,                        // 300 requests per window
  standardHeaders: true,           // RateLimit-* headers
  legacyHeaders: false,
}

adminLimiter: {
  windowMs: 15 * 60 * 1000,      // 15 minutes
  max: 120,                        // 120 requests per window
  standardHeaders: true,
  legacyHeaders: false,
}

loginLimiter: {
  windowMs: 15 * 60 * 1000,      // 15 minutes
  max: 5,                          // 5 attempts per window
  standardHeaders: true,
  skipSuccessfulRequests: true,   // ⚠️ Successful login resets counter!
}
```

### 6.2 Rate Limit Response

```json
{
  "error": "too_many_requests",
  "message": "Rate limit exceeded. Please try again later."
}
// HTTP 429
```

### 6.3 Applied To Routes

| Route Pattern                | Limiter       | Limit     |
| ---------------------------- | ------------- | --------- |
| `/v1/admin/login`            | loginLimiter  | 5/15min   |
| `/v1/tenant-auth/login`      | loginLimiter  | 5/15min   |
| `/v1/admin/*` (except login) | adminLimiter  | 120/15min |
| `/v1/tenant/admin/*`         | adminLimiter  | 120/15min |
| All other public routes      | publicLimiter | 300/15min |

---

## Part 7: Data Isolation & Multi-Tenancy

### 7.1 Tenant Isolation Mechanism

**Middleware-Level Isolation** (`tenant.ts`):

```typescript
// Extracts tenant from:
// 1. X-Tenant-Key header (public APIs)
// 2. URL path (legacy)
// 3. JWT token (admin APIs)

getTenantId(req): string
```

**Service-Level Isolation**:

```typescript
// Every service method signature includes tenantId
catalogService.getAllPackages(tenantId: string)
catalogService.getPackageById(tenantId: string, id: string)

// Service verifies ownership:
const pkg = await catalog.getById(id);
if (pkg.tenantId !== tenantId) throw NotFoundError;
```

**Database-Level Isolation**:

```prisma
model Package {
  id        String
  tenantId  String  // ⚠️ Required foreign key
  slug      String
  @@unique([tenantId, slug])
}
```

### 7.2 Cross-Tenant Attack Vectors (BLOCKED)

| Attack                                         | Blocked By                                                     |
| ---------------------------------------------- | -------------------------------------------------------------- |
| JWT token for tenant A accessing tenant B data | Service layer `tenantId` check                                 |
| Guessing other tenant package IDs              | `catalogService.getPackageById(tenantId, id)` checks ownership |
| Accessing other tenant bookings                | `bookingService.getAllBookings(tenantId)` filters by tenantId  |
| Modifying other tenant blackouts               | `blackoutRepo.findBlackoutById(tenantId, id)` checks ownership |
| Changing other tenant branding                 | `tenantRepository.findById()` + JWT tenantId validation        |

---

## Part 8: Error Handling & Response Codes

### 8.1 Standard HTTP Status Codes

| Code | Scenario                            | Example                       |
| ---- | ----------------------------------- | ----------------------------- |
| 200  | Successful GET/PUT                  | Get packages, update branding |
| 201  | Resource created                    | POST /v1/admin/packages       |
| 204  | Successful DELETE                   | Delete package (no content)   |
| 400  | Validation error                    | Invalid slug, color not hex   |
| 401  | Missing/invalid auth                | Missing Bearer token          |
| 403  | Forbidden (auth'd but unauthorized) | Tenant accessing admin routes |
| 404  | Resource not found                  | Package ID doesn't exist      |
| 413  | File too large                      | Photo > 5MB                   |
| 429  | Rate limited                        | Too many login attempts       |
| 500  | Server error                        | Database connection failure   |

### 8.2 Error Response Format (varies by endpoint)

**Validation Error**:

```json
{
  "error": "Validation error",
  "details": [
    {
      "code": "invalid",
      "message": "Primary color must be a valid hex color",
      "path": ["primaryColor"]
    }
  ]
}
```

**Authentication Error**:

```json
{
  "error": "Invalid Authorization header format. Expected: Bearer <token>"
}
```

**Rate Limit Error**:

```json
{
  "error": "too_many_login_attempts",
  "message": "Too many login attempts. Please try again in 15 minutes."
}
```

**Not Found Error**:

```json
{
  "error": "Package not found"
}
```

---

## Part 9: Recommended Architecture for Agent Integration

### 9.1 Use Cases & Endpoints

**Use Case: Create Wedding Package with Add-ons**

```
Step 1: Create package
POST /v1/tenant/admin/packages
{
  "slug": "deluxe-wedding-2025",
  "title": "Deluxe Wedding Package",
  "description": "Full day coverage",
  "priceCents": 350000
}

Step 2: Get package ID from response, create add-ons
POST /v1/tenant/admin/packages/{packageId}/addons
{
  "title": "Engagement Session",
  "priceCents": 50000
}

Step 3: Upload package photo
POST /v1/tenant/admin/packages/{packageId}/photos
(multipart/form-data with file)

Step 4: Get all packages to verify
GET /v1/tenant/admin/packages
```

**Why Not Single Endpoint?**

- Packages and add-ons are separate entities
- Photos require multipart form data
- API designed for sequential workflow, not bulk operations

### 9.2 Recommended Workflow for LLM Agents

```
1. Authenticate
   POST /v1/auth/login → token

2. Verify token & get context
   GET /v1/auth/verify (with token) → role, tenantId

3. For tenant admins: Get current configuration
   GET /v1/tenant/admin/packages
   GET /v1/tenant/admin/blackouts
   GET /v1/tenant/admin/branding

4. Perform requested mutations (one at a time)
   POST/PUT /v1/tenant/admin/* endpoints

5. Verify changes
   GET endpoints to confirm state

6. Return confirmation to user
```

### 9.3 Error Recovery Patterns

**Package Creation Fails**: Retry up to 3 times with exponential backoff

**Add-On Creation Fails**: Rollback by deleting package (or leave orphaned)

**Photo Upload Fails**: Retry just the photo, package already created

**Rate Limit Hit**: Wait 15 minutes or use different IP/client ID

---

## Part 10: Recommended Enhancements for Agent Use

### Priority 1: Essential for AI Safety

```
1. Bulk Operations API
   POST /v1/tenant/admin/packages/bulk-create
   POST /v1/tenant/admin/blackouts/bulk-create

2. Validation-Only (Dry-Run) Endpoints
   POST /v1/tenant/admin/packages/validate
   POST /v1/tenant/admin/branding/validate

3. Optimistic Locking (If-Match / ETag)
   GET /v1/tenant/admin/packages/:id → includes ETag header
   PUT /v1/tenant/admin/packages/:id (If-Match: etag)

4. Structured Error Codes
   Standardize error response across all endpoints
   Use consistent errorCode enum (VALIDATION_ERROR, CONFLICT, etc.)
```

### Priority 2: Agent-Friendly Features

```
5. Async Job Queue
   POST /v1/tenant/admin/jobs (for bulk operations)
   GET /v1/tenant/admin/jobs/:id (poll status)

6. Configuration Export
   GET /v1/tenant/admin/packages/export?format=json
   POST /v1/tenant/admin/packages/import (multipart JSON)

7. Audit Trail
   GET /v1/tenant/admin/changes (last 30 days)
   GET /v1/tenant/admin/changes/packages/:id

8. Transaction Support
   POST /v1/tenant/admin/transactions (batch multiple ops)
```

### Priority 3: Advanced Features

```
9. Webhook Events (for agent notifications)
   POST /v1/webhook/subscribe
   - package.created, package.updated
   - booking.paid, booking.refunded
   - branding.updated

10. GraphQL Endpoint (optional)
    POST /graphql (for complex queries)

11. WebSocket Live Updates
    WS /ws/tenant/:tenantId/live
```

---

## Part 11: API Endpoint Summary Table

| Category         | Count  | Auth       | Rate Limit       | Bulk?  | Notes                                 |
| ---------------- | ------ | ---------- | ---------------- | ------ | ------------------------------------- |
| Public Endpoints | 7      | None       | Public (300/15m) | No     | Catalog, availability, checkout       |
| Auth Endpoints   | 5      | None/JWT   | Login (5/15m)    | No     | Admin/tenant login, verify            |
| Platform Admin   | 11     | Admin JWT  | Admin (120/15m)  | No     | Tenant management, Stripe Connect     |
| Tenant Admin     | 13     | Tenant JWT | Admin (120/15m)  | No     | Packages, blackouts, branding, photos |
| Dev/Debug        | 3      | None       | N/A              | No     | Mock mode only                        |
| **TOTAL**        | **39** | **Mixed**  | **Tiered**       | **❌** | **No bulk operations**                |

---

## Part 12: Critical Notes for LLM Integration

### Gotchas for Agent Implementation

1. **No Bulk Operations**: Cannot create 5 packages in one request - must make 5 API calls
2. **Multipart Forms**: Photo uploads require `multipart/form-data`, not JSON
3. **Rate Limiting**: 120 requests per 15 minutes for admin routes - budget accordingly
4. **No Transactions**: Creating package + add-ons + photos has failure points between steps
5. **Slug Uniqueness**: Must check by name first or catch 400 error on duplicate
6. **Ownership Checks**: Always scoped by tenantId - cannot access data across tenants
7. **Read-Only Bookings**: Cannot modify booking state from API (Stripe webhooks only)
8. **No Dry-Run**: No way to validate without committing (except catch errors)
9. **Price Constraints**: Only min=0, no max - can accidentally set prices to millions
10. **Date Formats**: Strict YYYY-MM-DD format only, no flexible parsing

---

## Conclusion

The Elope API is **well-secured** with proper multi-tenant isolation, strong rate limiting, and clear authentication boundaries. However, it lacks **bulk operations, transaction support, and audit trails** needed for enterprise agent integration.

**Recommendation**: Implement Priority 1 enhancements (bulk ops, dry-run, optimistic locking) before deploying AI agents for configuration management.
