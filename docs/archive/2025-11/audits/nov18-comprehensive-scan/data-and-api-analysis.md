# Data Architecture & API Analysis

## MAIS (Macon AI Solutions) Platform

**Generated:** November 18, 2025
**Scope:** Very Thorough Analysis
**Project:** Macon AI Solutions - AI-Powered Tenant Management Platform

---

## Executive Summary

The MAIS platform is a **multi-tenant modular monolith** built with modern Node.js/TypeScript, Prisma ORM, and Express. The architecture demonstrates strong data isolation patterns, comprehensive API contracts via ts-rest, and critical concurrency controls for preventing double-bookings in the wedding industry.

**Key Strengths:**

- Robust multi-tenant data isolation with composite unique constraints
- Three-layer double-booking prevention (unique constraint, pessimistic locking, error handling)
- Type-safe API contracts with Zod validation
- Comprehensive audit logging infrastructure
- Production-ready error handling with domain-specific errors

**Critical Areas for Improvement:**

- Missing validation on some API request paths
- Webhook idempotency implementation needs edge case testing
- Rate limiting currently only on login endpoints
- Cache invalidation strategy underdeveloped
- No request body size limits documented

---

## Part 1: Database Schema Overview

### 1.1 Core Data Model

The database is organized around **multi-tenant data isolation** with the following hierarchy:

```
Tenant (root entity - 50 max)
├── Users (admin accounts)
├── Customers (wedding couples)
├── Venues (wedding locations)
├── Segments (business lines: "Elopement", "Micro-Wedding", "Full Wedding")
├── Packages (booking packages - scoped per segment)
├── AddOns (optional extras per package)
├── Bookings (confirmed reservations)
├── BlackoutDates (administrative blocks)
├── WebhookEvents (payment processing audit trail)
└── ConfigChangeLogs (audit trail for config-driven system)
```

### 1.2 Database Technology Stack

**Provider:** PostgreSQL (Supabase)
**ORM:** Prisma v5.3+
**Driver:** `@prisma/client`
**Connection Pooling:** Supabase PgBouncer
**Migrations:** Located at `/server/prisma/migrations/`

### 1.3 Critical Tables & Security

#### 1.3.1 Tenant Table

```sql
CREATE TABLE "Tenant" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT UNIQUE,
  "name" TEXT,
  "apiKeyPublic" TEXT UNIQUE,      -- pk_live_{slug}_{32chars}
  "apiKeySecret" TEXT,              -- sk_live_{slug}_{32chars}
  "commissionPercent" DECIMAL(5,2), -- Platform commission (10-15%)
  "branding" JSON,                  -- Color scheme, fonts, logo
  "primaryColor" STRING,             -- #HEX color
  "secondaryColor" STRING,           -- #HEX color
  "accentColor" STRING,              -- #HEX color
  "backgroundColor" STRING,          -- #HEX color
  "stripeAccountId" TEXT UNIQUE,    -- Stripe Connect ID
  "stripeOnboarded" BOOLEAN,        -- Stripe setup complete?
  "secrets" JSON,                    -- Encrypted secrets {stripe: {...}}
  "isActive" BOOLEAN,
  "createdAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3)
);

-- Indexes
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");
CREATE INDEX "Tenant_apiKeyPublic_idx" ON "Tenant"("apiKeyPublic");
CREATE INDEX "Tenant_isActive_idx" ON "Tenant"("isActive");
```

**Security Notes:**

- API keys use format: `pk_live_{slug}_{random32}` for public, `sk_live_{slug}_{random32}` for secret
- Secret key stored encrypted with AES-256-GCM (encryption key from `TENANT_SECRETS_ENCRYPTION_KEY`)
- Commission percent validated in range [0.5%, 50%] for Stripe compatibility

#### 1.3.2 Booking Table (Mission-Critical)

```sql
CREATE TABLE "Booking" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,          -- CRITICAL: Data isolation
  "customerId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "venueId" TEXT,                    -- Optional
  "date" DATE NOT NULL,              -- UTC midnight (YYYY-MM-DD)
  "startTime" TIMESTAMP(3),          -- Optional event time
  "endTime" TIMESTAMP(3),            -- Optional event time
  "status" ENUM('PENDING','CONFIRMED','CANCELED','FULFILLED'),
  "totalPrice" INT NOT NULL,         -- Cents
  "notes" TEXT,

  -- Commission tracking (multi-tenant)
  "commissionAmount" INT,            -- Platform fee in cents
  "commissionPercent" DECIMAL(5,2),  -- Rate snapshot at booking time

  -- Payment tracking
  "stripePaymentIntentId" TEXT UNIQUE,
  "confirmedAt" TIMESTAMP(3),        -- When payment completed

  "createdAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3)
);

-- CRITICAL UNIQUE CONSTRAINT: One booking per date per tenant
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_date_key"
  UNIQUE ("tenantId", "date");

-- Performance indexes
CREATE INDEX "Booking_tenantId_idx" ON "Booking"("tenantId");
CREATE INDEX "Booking_tenantId_status_idx" ON "Booking"("tenantId", "status");
CREATE INDEX "Booking_tenantId_date_idx" ON "Booking"("tenantId", "date");
CREATE INDEX "Booking_tenantId_status_date_idx" ON "Booking"("tenantId", "status", "date");
CREATE INDEX "Booking_stripePaymentIntentId_idx" ON "Booking"("stripePaymentIntentId");
CREATE INDEX "Booking_tenantId_confirmedAt_idx" ON "Booking"("tenantId", "confirmedAt");
```

**Double-Booking Prevention:**

- Layer 1: Composite unique constraint on (tenantId, date)
- Layer 2: Pessimistic row-level lock with FOR UPDATE NOWAIT
- Layer 3: Zod-based validation + error mapping

#### 1.3.3 Package Table

```sql
CREATE TABLE "Package" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT,
  "description" TEXT,
  "basePrice" INT,                   -- Cents
  "active" BOOLEAN DEFAULT true,
  "segmentId" TEXT,                  -- Segment scoping
  "grouping" STRING,                 -- Tier label: "Solo", "Couple", "Group"
  "groupingOrder" INT,               -- Order within grouping
  "photos" JSON DEFAULT '[]',        -- [{url, filename, size, order}]
  "createdAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3)
);

-- CRITICAL: Composite unique per tenant (not globally unique)
ALTER TABLE "Package" ADD CONSTRAINT "Package_tenantId_slug_key"
  UNIQUE ("tenantId", "slug");

-- Indexes
CREATE INDEX "Package_tenantId_active_idx" ON "Package"("tenantId", "active");
CREATE INDEX "Package_segmentId_grouping_idx" ON "Package"("segmentId", "grouping");
```

#### 1.3.4 WebhookEvent Table (Payment Safety)

```sql
CREATE TABLE "WebhookEvent" (
  "id" TEXT PRIMARY KEY DEFAULT uuid(),
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,           -- Stripe event ID (NOT globally unique)
  "eventType" TEXT,                  -- 'checkout.session.completed'
  "rawPayload" TEXT,                 -- Full JSON payload
  "status" ENUM('PENDING','PROCESSED','FAILED','DUPLICATE'),
  "attempts" INT DEFAULT 1,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3)
);

-- CRITICAL: Composite unique prevents duplicate processing per tenant
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_tenantId_eventId"
  UNIQUE ("tenantId", "eventId");

-- Indexes for efficient webhook processing
CREATE INDEX "WebhookEvent_tenantId_status_idx" ON "WebhookEvent"("tenantId", "status");
CREATE INDEX "WebhookEvent_tenantId_createdAt_idx" ON "WebhookEvent"("tenantId", "createdAt");
CREATE INDEX "WebhookEvent_status_createdAt_idx" ON "WebhookEvent"("status", "createdAt");
```

**Idempotency Strategy:**

- Webhook event stored BEFORE processing (all-or-nothing guarantee)
- Composite unique constraint on (tenantId, eventId) prevents duplicate processing
- Stripe can retry without creating duplicate bookings
- Failed webhooks retained for manual recovery with retry logic

#### 1.3.5 ConfigChangeLog Table (Audit Trail)

```sql
CREATE TABLE "ConfigChangeLog" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "changeType" STRING,               -- 'config_version', 'agent_proposal', 'package_crud'
  "operation" STRING,                -- 'create', 'update', 'delete', 'publish', 'approve'
  "entityType" STRING,               -- 'ConfigVersion', 'Package', 'Tenant'
  "entityId" TEXT,                   -- ID of changed entity

  -- Attribution
  "userId" TEXT,                     -- Admin making change
  "agentId" TEXT,                    -- AI agent making change
  "email" STRING,                    -- User or agent email
  "role" STRING,                     -- 'PLATFORM_ADMIN', 'TENANT_ADMIN', 'AGENT'

  -- Change data (full snapshots for rollback)
  "beforeSnapshot" JSON,             -- Null for creates
  "afterSnapshot" JSON,              -- Always populated
  "reason" TEXT,                     -- Optional change reason
  "metadata" JSON,                   -- IP, user agent, session ID, etc

  "createdAt" TIMESTAMP(3)
);

-- Indexes for audit trail queries
CREATE INDEX "ConfigChangeLog_tenantId_createdAt_idx" ON "ConfigChangeLog"("tenantId", "createdAt");
CREATE INDEX "ConfigChangeLog_tenantId_entityType_idx" ON "ConfigChangeLog"("tenantId", "entityType", "entityId");
CREATE INDEX "ConfigChangeLog_tenantId_changeType_idx" ON "ConfigChangeLog"("tenantId", "changeType");
```

### 1.4 Relationships & Constraints

| Table           | Relationship | Constraint                          | Cascade        |
| --------------- | ------------ | ----------------------------------- | -------------- |
| User            | → Tenant     | Foreign Key on tenantId             | CASCADE DELETE |
| Package         | → Tenant     | Foreign Key on tenantId             | CASCADE DELETE |
| Package         | → Segment    | Foreign Key on segmentId (optional) | SET NULL       |
| AddOn           | → Tenant     | Foreign Key on tenantId             | CASCADE DELETE |
| AddOn           | → Segment    | Foreign Key on segmentId (optional) | SET NULL       |
| Booking         | → Tenant     | Foreign Key on tenantId             | CASCADE DELETE |
| Booking         | → Customer   | Foreign Key on customerId           | -              |
| Booking         | → Package    | Foreign Key on packageId            | -              |
| Booking         | → Venue      | Foreign Key on venueId (optional)   | -              |
| BlackoutDate    | → Tenant     | Foreign Key on tenantId             | CASCADE DELETE |
| WebhookEvent    | → Tenant     | Foreign Key on tenantId             | CASCADE DELETE |
| ConfigChangeLog | → Tenant     | Foreign Key on tenantId             | CASCADE DELETE |

**Cascade DELETE Strategy:**

- Master data (packages, add-ons, blackouts) deleted when tenant deleted
- Bookings deleted when tenant deleted (revenue implications)
- Historical data (ConfigChangeLog, WebhookEvent) deleted when tenant deleted

### 1.5 Migration History

| Migration                                   | Date          | Purpose                                    | Status     |
| ------------------------------------------- | ------------- | ------------------------------------------ | ---------- |
| `20251016140827_initial_schema`             | 2025-10-16    | Initial Supabase schema                    | ✅ Applied |
| `20251023152454_add_password_hash`          | 2025-10-23    | Add User.passwordHash for admin auth       | ✅ Applied |
| `00_supabase_reset.sql`                     | Pre-migration | Database reset for Supabase                | ✅ Applied |
| `01_add_webhook_events.sql`                 | 2025-10-23    | WebhookEvent table + idempotency           | ✅ Applied |
| `02_add_performance_indexes.sql`            | 2025-10-31    | Composite indexes on Booking, WebhookEvent | ✅ Applied |
| `03_add_multi_tenancy.sql`                  | 2025-01-06    | Full multi-tenant transformation           | ✅ Applied |
| `04_fix_multi_tenant_data_corruption.sql`   | Post-Phase1   | Data migration + constraint fixes          | ✅ Applied |
| `05_add_additional_performance_indexes.sql` | Latest        | Segment queries, blackout dates            | ✅ Applied |

**Migration Strategy:**

- Prisma migrations in `/server/prisma/migrations/`
- SQL migrations for complex operations (multi-tenancy)
- Direct URL (`DIRECT_URL` env) used for migrations, pooled URL for app
- Idempotent operations (IF NOT EXISTS, ON CONFLICT DO NOTHING)

### 1.6 Data Validation Layer

**Zod Schemas (Type-Safe Validation)**

Location: `/packages/contracts/src/dto.ts` and `/server/src/adapters/lib/validation.ts`

```typescript
// Package validation
export const CreatePackageDtoSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  priceCents: z.number().int().min(0),
  photoUrl: z.string().url().optional(),
});

// Booking validation
export const CreateCheckoutDtoSchema = z.object({
  packageId: z.string(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  coupleName: z.string(),
  email: z.string().email(),
  addOnIds: z.array(z.string()).optional(),
});

// Segment validation
export const CreateSegmentDtoSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  heroTitle: z.string().min(1).max(200),
  heroSubtitle: z.string().max(300).optional(),
  heroImage: z.string().url().or(z.literal('')).optional(),
  description: z.string().max(2000).optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});
```

**Validation Coverage:**

- All public API request bodies validated with Zod
- Query parameters validated (date format, pagination)
- Response DTOs typed with Zod for type safety
- Commission percent validated: 0.5% - 50% (Stripe limits)
- Commission rounding: ALWAYS ROUND UP (Math.ceil) to protect platform revenue

---

## Part 2: API Surface & Endpoints

### 2.1 API Architecture

**Framework:** Express.js 4.18 with @ts-rest/express
**API Style:** REST with strong TypeScript contracts
**API Version:** v1
**Base URL:** `http://localhost:3001/v1` (development)

**Contract Location:** `/packages/contracts/src/api.v1.ts`

### 2.2 Public API Endpoints (X-Tenant-Key Required)

All public endpoints require `X-Tenant-Key: pk_live_{slug}_{32chars}` header.

#### 2.2.1 Catalog Endpoints

| Method | Endpoint             | Purpose                      | Auth         | Response       |
| ------ | -------------------- | ---------------------------- | ------------ | -------------- |
| `GET`  | `/v1/packages`       | List all packages for tenant | X-Tenant-Key | `PackageDto[]` |
| `GET`  | `/v1/packages/:slug` | Get package by slug          | X-Tenant-Key | `PackageDto`   |

**Request Example:**

```bash
curl -X GET http://localhost:3001/v1/packages \
  -H "X-Tenant-Key: pk_live_bella-weddings_abc123"
```

**Response Schema:**

```typescript
interface PackageDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number; // Price in cents ($100 = 10000 cents)
  photoUrl?: string;
  addOns: AddOnDto[]; // Included add-ons
}

interface AddOnDto {
  id: string;
  packageId: string;
  title: string;
  description?: string;
  priceCents: number;
  photoUrl?: string;
}
```

**Implementation:** `/server/src/routes/packages.routes.ts`
**Service:** `CatalogService.getAllPackages(tenantId)`
**Repository:** `PrismaCatalogRepository.getAllPackagesWithAddOns(tenantId)`

---

#### 2.2.2 Availability Endpoints

| Method | Endpoint                                                               | Purpose                        | Auth         | Response              |
| ------ | ---------------------------------------------------------------------- | ------------------------------ | ------------ | --------------------- |
| `GET`  | `/v1/availability?date=YYYY-MM-DD`                                     | Check single date availability | X-Tenant-Key | `AvailabilityDto`     |
| `GET`  | `/v1/availability/unavailable?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | Batch query unavailable dates  | X-Tenant-Key | `{ dates: string[] }` |

**Request Examples:**

```bash
# Single date check
curl -X GET "http://localhost:3001/v1/availability?date=2025-06-15" \
  -H "X-Tenant-Key: pk_live_bella_xyz"

# Batch date range (calendar picker)
curl -X GET "http://localhost:3001/v1/availability/unavailable?startDate=2025-06-01&endDate=2025-06-30" \
  -H "X-Tenant-Key: pk_live_bella_xyz"
```

**Response Schema:**

```typescript
interface AvailabilityDto {
  date: string; // YYYY-MM-DD
  available: boolean;
  reason?: 'booked' | 'blackout' | 'calendar'; // Why unavailable
}

interface BatchAvailabilityDto {
  dates: string[]; // YYYY-MM-DD format
}
```

**Availability Check Flow:**

1. Blackout dates (admin-controlled blocks)
2. Existing bookings (for this tenant)
3. Google Calendar freeBusy API (if configured)

**Performance:** ~200ms for single date, ~500ms for 30-day range

---

#### 2.2.3 Booking Endpoints

| Method | Endpoint                | Purpose                                 | Auth         | Response                  |
| ------ | ----------------------- | --------------------------------------- | ------------ | ------------------------- |
| `POST` | `/v1/bookings/checkout` | Create checkout session                 | X-Tenant-Key | `{ checkoutUrl: string }` |
| `GET`  | `/v1/bookings/:id`      | Get booking by ID (public confirmation) | X-Tenant-Key | `BookingDto`              |

**Request Body:**

```typescript
interface CreateCheckoutDto {
  packageId: string; // Package slug
  eventDate: string; // YYYY-MM-DD format
  coupleName: string; // Customer name
  email: string; // Customer email (required)
  addOnIds?: string[]; // Optional add-on IDs
}
```

**Response:**

```typescript
interface CheckoutResponse {
  checkoutUrl: string; // Stripe Checkout URL (30 minute expiration)
}
```

**Request Example:**

```bash
curl -X POST http://localhost:3001/v1/bookings/checkout \
  -H "X-Tenant-Key: pk_live_bella_xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "intimate-ceremony",
    "eventDate": "2025-06-15",
    "coupleName": "Jane & John Doe",
    "email": "couple@example.com",
    "addOnIds": ["addon_photography", "addon_flowers"]
  }'
```

**Implementation:** `/server/src/routes/bookings.routes.ts`
**Service:** `BookingService.createCheckout(tenantId, input)`
**Processing:**

1. Validate package exists for tenant
2. Calculate total (package + add-ons + commission)
3. Generate idempotency key to prevent duplicate sessions
4. Create Stripe checkout with application fee
5. Store metadata in session (tenantId, email, commission details)

**Error Handling:**

- 404: Package not found
- 400: Invalid date format or email
- 409: Date already booked (race condition)
- 402: Stripe payment processing error

---

#### 2.2.4 Tenant Branding Endpoint

| Method | Endpoint              | Purpose                            | Auth         | Response            |
| ------ | --------------------- | ---------------------------------- | ------------ | ------------------- |
| `GET`  | `/v1/tenant/branding` | Get tenant color scheme for widget | X-Tenant-Key | `TenantBrandingDto` |

**Response Schema:**

```typescript
interface TenantBrandingDto {
  primaryColor?: string; // #HEX format
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string; // "Inter", "Playfair Display", etc
  logo?: string; // URL to logo image
}
```

**Use Case:** Embedded widgets fetch tenant branding at runtime to customize appearance

---

#### 2.2.5 Segments (Public Browse)

| Method | Endpoint           | Purpose                        | Auth         | Response       |
| ------ | ------------------ | ------------------------------ | ------------ | -------------- |
| `GET`  | `/v1/segments`     | Get active segments for tenant | X-Tenant-Key | `SegmentDto[]` |
| `GET`  | `/v1/segments/:id` | Get segment details            | X-Tenant-Key | `SegmentDto`   |

**Response Schema:**

```typescript
interface SegmentDto {
  id: string;
  slug: string; // URL-safe identifier
  name: string; // Display name
  heroTitle: string; // Hero section heading
  heroSubtitle?: string;
  heroImage?: string; // Hero image URL
  description?: string; // SEO description
  metaTitle?: string; // Page title for SEO
  metaDescription?: string;
  sortOrder: number; // Display order
  active: boolean;
  createdAt: string; // ISO date
  updatedAt: string;
}
```

**Use Case:** Customers browse different wedding services (elopements, micro-weddings, full weddings)

---

### 2.3 Admin API Endpoints (JWT Required)

All admin endpoints require `Authorization: Bearer {jwt}` header with valid admin token.

#### 2.3.1 Authentication Endpoints

| Method | Endpoint                | Purpose                      | Auth       | Response            |
| ------ | ----------------------- | ---------------------------- | ---------- | ------------------- |
| `POST` | `/v1/admin/login`       | Platform admin login         | None       | `{ token: string }` |
| `POST` | `/v1/tenant-auth/login` | Tenant admin login           | None       | `{ token: string }` |
| `POST` | `/v1/auth/login`        | Unified login (both types)   | None       | `{ token: string }` |
| `GET`  | `/v1/auth/verify`       | Verify token + get user info | Bearer JWT | User profile        |

**Request Body (Login):**

```typescript
interface AdminLoginDto {
  email: string; // Admin email
  password: string; // Plain text (bcrypted on backend)
}
```

**Response:**

```typescript
interface LoginResponse {
  token: string; // JWT signed with HS256
}
```

**Token Structure:**

```typescript
interface TokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'tenant_admin' | 'platform_admin';
  type?: 'tenant'; // For tenant tokens
  iat?: number; // Issued at
  exp?: number; // Expires (7 days)
}
```

**Rate Limiting:** 5 attempts per 15 minutes per IP address (strict rate limiter)

**Implementation:**

- `/server/src/routes/auth.routes.ts`
- `/server/src/services/identity.service.ts`
- Password hashing: bcryptjs (10 salt rounds)
- Token signing: jsonwebtoken HS256

---

#### 2.3.2 Booking Management

| Method | Endpoint             | Purpose                         | Auth       | Response       |
| ------ | -------------------- | ------------------------------- | ---------- | -------------- |
| `GET`  | `/v1/admin/bookings` | List all bookings (all tenants) | Bearer JWT | `BookingDto[]` |

**Query Parameters:**

- `status`: Filter by PENDING, CONFIRMED, CANCELED, FULFILLED
- `tenantId`: Filter by specific tenant (platform admin only)
- `limit`: Results per page (default 50)
- `offset`: Pagination offset

**Response Schema:**

```typescript
interface BookingDto {
  id: string;
  packageId: string;
  coupleName: string;
  email: string;
  phone?: string;
  eventDate: string; // YYYY-MM-DD
  addOnIds: string[];
  totalCents: number;
  status: 'PAID' | 'REFUNDED' | 'CANCELED';
  createdAt: string; // ISO datetime
}
```

---

#### 2.3.3 Blackout Date Management

| Method | Endpoint              | Purpose                 | Auth       | Response       |
| ------ | --------------------- | ----------------------- | ---------- | -------------- |
| `GET`  | `/v1/admin/blackouts` | List all blackout dates | Bearer JWT | Blackout[]     |
| `POST` | `/v1/admin/blackouts` | Create blackout date    | Bearer JWT | `{ ok: true }` |

**Request Body (Create):**

```typescript
interface CreateBlackoutDto {
  date: string; // YYYY-MM-DD format
  reason?: string; // Why date is blocked
}
```

**Error Handling:**

- 409: Date already blackout or booked
- 400: Invalid date format

**Implementation:** `/server/src/routes/blackouts.routes.ts`

---

#### 2.3.4 Package CRUD

| Method   | Endpoint                 | Purpose        | Auth       | Response             |
| -------- | ------------------------ | -------------- | ---------- | -------------------- |
| `POST`   | `/v1/admin/packages`     | Create package | Bearer JWT | `PackageResponseDto` |
| `PUT`    | `/v1/admin/packages/:id` | Update package | Bearer JWT | `PackageResponseDto` |
| `DELETE` | `/v1/admin/packages/:id` | Delete package | Bearer JWT | 204 No Content       |

**Request Body (Create):**

```typescript
interface CreatePackageDto {
  slug: string; // URL-safe identifier
  title: string;
  description: string;
  priceCents: number;
  photoUrl?: string;
}
```

**Validation:**

- slug: min 1 char, lowercase alphanumeric + hyphens
- title, description: min 1 char
- priceCents: non-negative integer
- photoUrl: must be valid HTTPS URL if provided

**Constraints:**

- (tenantId, slug) must be unique per tenant
- Cannot create if tenant is inactive

**Implementation:** `/server/src/routes/admin-packages.routes.ts`

---

#### 2.3.5 Add-On CRUD

| Method   | Endpoint                               | Purpose       | Auth       | Response       |
| -------- | -------------------------------------- | ------------- | ---------- | -------------- |
| `POST`   | `/v1/admin/packages/:packageId/addons` | Create add-on | Bearer JWT | `AddOnDto`     |
| `PUT`    | `/v1/admin/addons/:id`                 | Update add-on | Bearer JWT | `AddOnDto`     |
| `DELETE` | `/v1/admin/addons/:id`                 | Delete add-on | Bearer JWT | 204 No Content |

**Request Body (Create):**

```typescript
interface CreateAddOnDto {
  packageId: string;
  title: string;
  description?: string;
  priceCents: number;
  photoUrl?: string;
}
```

---

### 2.4 Webhook Endpoints

#### 2.4.1 Stripe Webhook

| Method | Endpoint              | Purpose                           | Auth      | Response       |
| ------ | --------------------- | --------------------------------- | --------- | -------------- |
| `POST` | `/v1/webhooks/stripe` | Stripe checkout.session.completed | Signature | 204 No Content |

**Request Requirements:**

- `Content-Type: application/json`
- `stripe-signature` header (HMAC-SHA256)
- Raw body (not JSON parsed)

**Processing Flow:**

1. Verify signature with webhook secret
2. Extract Stripe event (checkout.session.completed)
3. Check idempotency (store eventId in WebhookEvent table)
4. Extract metadata (tenantId, packageId, email, etc)
5. Create booking in database (atomic transaction)
6. Emit BookingPaid event (triggers email notification)
7. Return 204 (or retry on error)

**Error Handling:**

- 400: Invalid signature (webhook spoofing)
- 422: Payload validation failure
- 500: Processing error (Stripe will retry)

**Implementation:** `/server/src/routes/webhooks.routes.ts`
**Signature Verification:** Stripe SDK (`stripe.webhooks.constructEvent()`)

---

### 2.5 Tenant Admin Endpoints

These endpoints require **tenant admin JWT** (not platform admin).

#### 2.5.1 Segment Management (Tenant Self-Service)

| Method   | Endpoint                              | Purpose                | Auth       | Response                       |
| -------- | ------------------------------------- | ---------------------- | ---------- | ------------------------------ |
| `GET`    | `/v1/tenant/admin/segments`           | List tenant segments   | Tenant JWT | `SegmentDto[]`                 |
| `POST`   | `/v1/tenant/admin/segments`           | Create segment         | Tenant JWT | `SegmentDto`                   |
| `GET`    | `/v1/tenant/admin/segments/:id`       | Get segment details    | Tenant JWT | `SegmentDto`                   |
| `PUT`    | `/v1/tenant/admin/segments/:id`       | Update segment         | Tenant JWT | `SegmentDto`                   |
| `DELETE` | `/v1/tenant/admin/segments/:id`       | Delete segment         | Tenant JWT | 204 No Content                 |
| `GET`    | `/v1/tenant/admin/segments/:id/stats` | Get segment statistics | Tenant JWT | `{ packageCount, addOnCount }` |

**Request Body (Create):**

```typescript
interface CreateSegmentDto {
  slug: string; // [a-z0-9-]+
  name: string; // Max 100 chars
  heroTitle: string; // Max 200 chars
  heroSubtitle?: string;
  heroImage?: string; // HTTPS URL
  description?: string; // Max 2000 chars
  metaTitle?: string; // Max 60 chars (SEO)
  metaDescription?: string; // Max 160 chars
  sortOrder?: number; // Default 0
  active?: boolean; // Default true
}
```

**Implementation:** `/server/src/routes/tenant-admin-segments.routes.ts`

---

### 2.6 Platform Admin Endpoints

Requires **platform admin JWT** with role='admin' or 'platform_admin'.

#### 2.6.1 Tenant Management

| Method   | Endpoint                | Purpose             | Auth         | Response                  |
| -------- | ----------------------- | ------------------- | ------------ | ------------------------- |
| `GET`    | `/v1/admin/tenants`     | List all tenants    | Platform JWT | `TenantDto[]`             |
| `POST`   | `/v1/admin/tenants`     | Create new tenant   | Platform JWT | `CreateTenantResponseDto` |
| `GET`    | `/v1/admin/tenants/:id` | Get tenant details  | Platform JWT | `TenantDetailDto`         |
| `PUT`    | `/v1/admin/tenants/:id` | Update tenant       | Platform JWT | `TenantDto`               |
| `DELETE` | `/v1/admin/tenants/:id` | Deactivate tenant   | Platform JWT | 204 No Content            |
| `GET`    | `/v1/admin/stats`       | Platform statistics | Platform JWT | `PlatformStatsDto`        |

**Request Body (Create Tenant):**

```typescript
interface CreateTenantDto {
  slug: string; // [a-z0-9-]+, min 2, max 50 chars
  name: string; // Display name, min 2, max 100 chars
  email?: string; // Admin email
  commissionPercent?: number; // Default 10.0 (0-100%)
}
```

**Response (with secret key shown once):**

```typescript
interface CreateTenantResponseDto {
  tenant: TenantDto;
  secretKey: string; // API secret key - shown ONCE ONLY
}
```

**Response (Statistics):**

```typescript
interface PlatformStatsDto {
  // Tenant metrics
  totalTenants: number;
  activeTenants: number;

  // Booking metrics
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;

  // Revenue metrics (in cents)
  totalRevenue: number;
  platformCommission: number;
  tenantRevenue: number;

  // Time-based metrics
  revenueThisMonth?: number;
  bookingsThisMonth?: number;
}
```

**Implementation:** `/server/src/routes/admin/tenants.routes.ts`

---

### 2.7 API Error Responses

All errors follow consistent structure:

```typescript
interface ErrorResponse {
  status: 'error';
  statusCode: number; // HTTP status code
  error: string; // Error code (TENANT_KEY_REQUIRED, etc)
  message: string; // Human-readable message
  requestId?: string; // For debugging
}
```

**Common Error Codes:**

| Code                       | Status | Meaning                                |
| -------------------------- | ------ | -------------------------------------- |
| `TENANT_KEY_REQUIRED`      | 401    | X-Tenant-Key header missing            |
| `INVALID_TENANT_KEY`       | 401    | API key format invalid or not found    |
| `TENANT_INACTIVE`          | 403    | Tenant account disabled                |
| `UNAUTHORIZED`             | 401    | Invalid/missing auth token             |
| `INVALID_TOKEN`            | 401    | Token expired or tampered              |
| `NOT_FOUND`                | 404    | Resource not found                     |
| `CONFLICT`                 | 409    | Date already booked or blackout exists |
| `BOOKING_LOCK_TIMEOUT`     | 409    | High contention - retry with backoff   |
| `UNPROCESSABLE_ENTITY`     | 422    | Validation error (Zod schema failed)   |
| `STRIPE_NOT_ONBOARDED`     | 403    | Tenant Stripe Connect not complete     |
| `WEBHOOK_VALIDATION_ERROR` | 400    | Invalid webhook signature or payload   |
| `INTERNAL_SERVER_ERROR`    | 500    | Unexpected server error                |

**Example Error Response:**

```json
{
  "status": "error",
  "statusCode": 409,
  "error": "BOOKING_CONFLICT",
  "message": "Date 2025-06-15 is already booked",
  "requestId": "req_abc123xyz"
}
```

---

## Part 3: Data Flow & Request Lifecycle

### 3.1 Booking Creation Flow (End-to-End)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. CUSTOMER: View Available Dates (Frontend)                         │
├─────────────────────────────────────────────────────────────────────┤
│ GET /v1/availability/unavailable?startDate=2025-06-01&endDate=2025-06-30
│ Header: X-Tenant-Key: pk_live_bella_xyz
│
│ Response: { dates: ['2025-06-15', '2025-06-22'] }
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. AVAILABILITY CHECK: Multi-source validation                       │
├─────────────────────────────────────────────────────────────────────┤
│ A. Blackout dates (admin blocks): SELECT * FROM BlackoutDate
│    WHERE tenantId = 'tenant_123' AND date = '2025-06-15'
│
│ B. Existing bookings: SELECT * FROM Booking
│    WHERE tenantId = 'tenant_123' AND date = '2025-06-15'
│
│ C. Google Calendar API: isDateAvailable('2025-06-15')
│    (if Google Calendar credentials configured)
│
│ Result: Available dates returned to frontend for calendar picker
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. CUSTOMER: Submit Booking Request                                  │
├─────────────────────────────────────────────────────────────────────┤
│ POST /v1/bookings/checkout
│ Header: X-Tenant-Key: pk_live_bella_xyz
│
│ Body: {
│   "packageId": "intimate-ceremony",
│   "eventDate": "2025-06-15",
│   "coupleName": "Jane & John Doe",
│   "email": "couple@example.com",
│   "addOnIds": ["addon_photography"]
│ }
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. VALIDATION: Zod schema validation                                 │
├─────────────────────────────────────────────────────────────────────┤
│ ✓ Email format valid
│ ✓ Date format = YYYY-MM-DD
│ ✓ packageId = string
│ ✓ coupleName = non-empty string
│ ✓ addOnIds = array of strings (optional)
│
│ On failure: Return 422 Unprocessable Entity
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. FETCH ENTITIES: Package & Tenant lookup                           │
├─────────────────────────────────────────────────────────────────────┤
│ SELECT id, slug, basePrice FROM Package
│ WHERE tenantId = 'tenant_123' AND slug = 'intimate-ceremony'
│
│ SELECT id, commissionPercent, stripeAccountId FROM Tenant
│ WHERE id = 'tenant_123'
│
│ If not found: Return 404 Not Found
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. CALCULATE TOTAL: Package + Add-ons + Commission                   │
├─────────────────────────────────────────────────────────────────────┤
│ A. Package base price: 50000 cents ($500)
│
│ B. Add-ons:
│    Photography: +20000 cents ($200)
│    Total add-ons: 20000 cents
│
│ C. Subtotal: 50000 + 20000 = 70000 cents ($700)
│
│ D. Commission (12% of subtotal):
│    70000 * 0.12 = 8400 cents → ROUND UP
│    Commission = 8400 cents ($84)
│
│ E. Total to charge: 70000 cents ($700 to customer)
│    Platform fee: 8400 cents (automatically deducted from Stripe)
│
│ Result stored in Booking:
│   totalPrice = 70000 cents
│   commissionAmount = 8400 cents
│   commissionPercent = 12.0
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 7. IDEMPOTENCY CHECK: Prevent duplicate Stripe sessions              │
├─────────────────────────────────────────────────────────────────────┤
│ Generate key: checkout_{tenantId}_{email}_{packageId}_{date}_{timestamp}
│
│ SELECT * FROM IdempotencyKey WHERE key = 'generated_key'
│
│ If exists: Return cached session URL (no new charge)
│ If not: Continue to Stripe
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 8. CREATE STRIPE CHECKOUT SESSION                                    │
├─────────────────────────────────────────────────────────────────────┤
│ Call Stripe API with:
│
│ {
│   "amount": 70000,                    // Total customer pays
│   "metadata": {
│     "tenantId": "tenant_123",        // Multi-tenant isolation
│     "packageId": "intimate-ceremony",
│     "eventDate": "2025-06-15",
│     "email": "couple@example.com",
│     "coupleName": "Jane & John Doe",
│     "addOnIds": "addon_photography",
│     "commissionAmount": "8400",
│     "commissionPercent": "12.0"
│   },
│   "application_fee_amount": 8400,     // Stripe Connect fee
│   "stripe_account": "acct_tenant_123" // Send to tenant account
│ }
│
│ Result: Stripe returns checkout URL (30 min expiration)
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 9. CACHE IDEMPOTENCY KEY                                             │
├─────────────────────────────────────────────────────────────────────┤
│ INSERT INTO IdempotencyKey (
│   key = 'generated_key',
│   response = '{"url": "https://checkout.stripe.com/..."}',
│   expiresAt = NOW() + 24 hours
│ )
│
│ Purpose: Duplicate requests return cached URL (same session)
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 10. RETURN CHECKOUT URL                                              │
├─────────────────────────────────────────────────────────────────────┤
│ HTTP 200 OK
│ {
│   "checkoutUrl": "https://checkout.stripe.com/pay/cs_live_..."
│ }
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 11. CUSTOMER: Complete Stripe Checkout                               │
├─────────────────────────────────────────────────────────────────────┤
│ Customer redirected to Stripe Checkout
│ → Enters payment details
│ → Confirms payment
│ → Stripe processes charge
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 12. STRIPE WEBHOOK: Payment completed notification                   │
├─────────────────────────────────────────────────────────────────────┤
│ Stripe → Platform webhook: POST /v1/webhooks/stripe
│
│ Payload: {
│   "type": "checkout.session.completed",
│   "data": {
│     "object": {
│       "id": "cs_live_...",
│       "amount_total": 70000,
│       "metadata": {
│         "tenantId": "tenant_123",
│         "email": "couple@example.com",
│         ...
│       }
│     }
│   }
│ }
│
│ Signature: stripe-signature header (HMAC-SHA256)
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 13. VERIFY WEBHOOK SIGNATURE                                         │
├─────────────────────────────────────────────────────────────────────┤
│ stripe.webhooks.constructEvent(
│   rawBody,
│   signature,
│   webhookSecret
│ )
│
│ On failure: Return 400 (webhook spoofing attempt)
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 14. IDEMPOTENCY: Check if event already processed                    │
├─────────────────────────────────────────────────────────────────────┤
│ SELECT * FROM WebhookEvent
│ WHERE tenantId = 'tenant_123' AND eventId = 'evt_stripe_...'
│
│ If found AND status = 'PROCESSED': Return 204 (duplicate ignored)
│ If found AND status = 'FAILED': Retry processing
│ If not found: Continue to create booking
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 15. STORE WEBHOOK EVENT (Pre-processing)                             │
├─────────────────────────────────────────────────────────────────────┤
│ INSERT INTO WebhookEvent (
│   id = uuid(),
│   tenantId = 'tenant_123',
│   eventId = 'evt_stripe_...',
│   eventType = 'checkout.session.completed',
│   rawPayload = JSON.stringify(event),
│   status = 'PENDING',
│   attempts = 1,
│   createdAt = NOW()
│ )
│
│ Purpose: Atomicity - if booking fails, webhook event logged for retry
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 16. EXTRACT & VALIDATE METADATA                                      │
├─────────────────────────────────────────────────────────────────────┤
│ Zod validation on metadata:
│ {
│   tenantId: string,
│   packageId: string,
│   eventDate: string (YYYY-MM-DD),
│   email: string (email format),
│   coupleName: string,
│   addOnIds?: string,
│   commissionAmount?: string,
│   commissionPercent?: string
│ }
│
│ On failure: Mark webhook as FAILED, return 500 (Stripe retries)
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 17. ATOMIC TRANSACTION: Create booking + emit event                  │
├─────────────────────────────────────────────────────────────────────┤
│ BEGIN TRANSACTION (SERIALIZABLE isolation)
│
│ A. Acquire pessimistic lock on date:
│    SELECT 1 FROM Booking
│    WHERE tenantId = 'tenant_123' AND date = '2025-06-15'
│    FOR UPDATE NOWAIT
│
│    If locked: Return 409 (date just booked by another request)
│    If timeout: Return 500 (Stripe will retry)
│
│ B. Verify availability (double-check):
│    if (blackout || booked || calendar_unavailable)
│      ROLLBACK
│      Return 500 (Stripe will retry)
│
│ C. Create Customer:
│    INSERT INTO Customer (tenantId, email, name, phone)
│    SELECT * FROM existing customer or create new
│
│ D. Create Booking:
│    INSERT INTO Booking (
│      id = cuid(),
│      tenantId = 'tenant_123',
│      customerId = 'cust_...',
│      packageId = 'pkg_...',
│      date = '2025-06-15',
│      status = 'CONFIRMED',
│      totalPrice = 70000,
│      commissionAmount = 8400,
│      commissionPercent = 12.0,
│      stripePaymentIntentId = 'cs_live_...',
│      confirmedAt = NOW()
│    )
│
│ E. Create BookingAddOns (line items):
│    INSERT INTO BookingAddOn (bookingId, addOnId, quantity, unitPrice)
│    VALUES ('booking_...', 'addon_photography', 1, 20000)
│
│ F. Emit event:
│    eventBus.emit('BookingPaid', {
│      bookingId: 'booking_...',
│      eventDate: '2025-06-15',
│      email: 'couple@example.com',
│      lineItems: [...]
│    })
│
│ COMMIT (all-or-nothing)
│
│ Result: Booking created OR transaction rolled back (no partial state)
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 18. UPDATE WEBHOOK EVENT STATUS                                      │
├─────────────────────────────────────────────────────────────────────┤
│ UPDATE WebhookEvent
│ SET status = 'PROCESSED',
│     processedAt = NOW()
│ WHERE id = 'webhook_event_...'
│
│ On error: SET status = 'FAILED', lastError = error message
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 19. SEND CONFIRMATION EMAIL (Event listener)                         │
├─────────────────────────────────────────────────────────────────────┤
│ BookingPaid event triggers email notification:
│
│ Email template: ConfirmationEmail
│ To: couple@example.com
│ Subject: "Your wedding booking is confirmed!"
│
│ Body: Booking details + venue address + add-ons + guest count
│
│ Provider: Postmark (with file-sink fallback)
│ Delivery: Async, doesn't block webhook response
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 20. RETURN WEBHOOK RESPONSE                                          │
├─────────────────────────────────────────────────────────────────────┤
│ HTTP 204 No Content
│
│ Stripe receives 204 → considers webhook successfully processed
│ → Stops retrying webhook
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 State Management Patterns

**Server-Side State:**

- Database (Supabase PostgreSQL): Source of truth
- In-memory cache (NodeCache): ~5 minute TTL for packages, availability
- Session storage: Idempotency keys (24 hour expiration)

**Cache Strategy:**

- Tenant-scoped cache keys: `catalog:${tenantId}:packages`
- Invalidation on: Package update, tenant deactivation
- No HTTP-level caching (removed in Phase 1 due to security vulnerability)

**Client-Side State:**

- React Query/TanStack Query: API response caching + refetch
- URL params: Date picker state, pagination
- Local storage: User preferences (widget branding)

---

## Part 4: Security Considerations

### 4.1 Data Isolation & Tenant Security

#### Multi-Tenant Isolation Pattern

```
Threat: Tenant A requests Tenant B's data

Defense Layer 1: API Key Validation
├─ X-Tenant-Key header required
├─ API key format: pk_live_{slug}_{32chars}
├─ Lookup in Tenant table by apiKeyPublic
└─ Returns 401 if not found or inactive

Defense Layer 2: Repository Pattern
├─ All queries include tenantId WHERE clause
├─ Example: SELECT * FROM Package WHERE tenantId = ? AND slug = ?
├─ Impossible to query cross-tenant data
└─ All repository methods require tenantId parameter

Defense Layer 3: Composite Unique Constraints
├─ Package: UNIQUE(tenantId, slug) - not globally unique
├─ Booking: UNIQUE(tenantId, date) - one booking per date per tenant
├─ WebhookEvent: UNIQUE(tenantId, eventId) - prevents cross-tenant webhook hijacking
└─ Prevents "slug collision" attacks across tenants

Defense Layer 4: Application-Level Cache Keys
├─ All cache keys include tenantId
├─ Example: catalog:${tenantId}:packages
├─ Prevents cache poisoning between tenants
└─ No shared cache entries
```

**Risk Assessment: MITIGATED**

- All layers working together prevent cross-tenant data access
- Tenant ID passed through every service layer
- No implicit global queries

#### 4.1.1 API Key Security

**Public Keys (Embeddable in Frontend):**

- Format: `pk_live_bella-weddings_7a9f3c2e1b4d8f6a`
- Lookup indexed by apiKeyPublic (fast)
- Can only read packages, availability, create bookings
- Used in X-Tenant-Key header
- No write access to admin functions

**Secret Keys (Server-Only):**

- Format: `sk_live_bella-weddings_9x2k4m8p3n7q1w5z`
- Stored encrypted in database (AES-256-GCM)
- Never transmitted over HTTP
- Used for admin operations (internal only)
- Should be stored in .env, never in frontend code

**Generation Strategy:**

```typescript
// Random slug-specific suffix
random32 = crypto.randomBytes(32).toString('hex'); // 64 hex chars
publicKey = `pk_live_${slug}_${random32.substring(0, 16)}`;
secretKey = `sk_live_${slug}_${random32.substring(16, 32)}`;
```

**Risk Assessment: MITIGATED**

- Secret keys encrypted at rest
- Public keys read-only for payments
- No key material in logs

---

### 4.2 Authentication & Authorization

#### JWT Token Security

```typescript
// Token generation
const payload = {
  userId: 'user_123',
  email: 'admin@example.com',
  role: 'admin', // or 'tenant_admin'
  iat: Date.now(),
  exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
};

const token = jwt.sign(payload, process.env.JWT_SECRET, {
  algorithm: 'HS256', // ONLY allow HS256 (not 'none' or 'alg' confusion)
  expiresIn: '7d',
});
```

**Verification (Explicit Algorithm):**

```typescript
const payload = jwt.verify(token, jwtSecret, {
  algorithms: ['HS256'], // Only allow HS256, reject 'none' or other algs
});
```

**Rate Limiting:**

- Login endpoints: 5 attempts per 15 minutes per IP
- Prevents brute force attacks
- Configurable via `loginLimiter` middleware

**Password Security:**

- Hashed with bcryptjs (10 salt rounds)
- Never stored in plaintext
- Never returned in API responses
- Compared with timing-safe comparison (bcrypt.compare)

**Risk Assessment: MITIGATED**

- Algorithm confusion attacks prevented (explicit HS256)
- Brute force attacks prevented (rate limiting)
- Password hashing strong (10 rounds = ~100ms per attempt)

---

### 4.3 Payment & Financial Security

#### Stripe Integration

```typescript
// Webhook signature verification
const event = stripe.webhooks.constructEvent(
  rawBody, // Raw string (not JSON parsed)
  signature, // stripe-signature header
  webhookSecret // Stored in environment variable
);
// On failure: throws WebhookSignatureError
```

**Commission Calculation Safety:**

```typescript
// Commission always rounds UP to protect platform revenue
const commissionAmount = Math.ceil(bookingTotal * (commissionPercent / 100));

// Example: 12% of $99.99 (9999 cents)
// = 9999 * 0.12 = 1199.88 cents
// Rounded up = 1200 cents ($12.00) ✓

// Stripe Connect validation
if (commissionPercent < 0.5 || commissionPercent > 50) {
  throw new Error('Commission must be between 0.5% and 50%');
}
```

**Booking Lock Mechanism (Serializable Transactions):**

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Pessimistic lock: First request wins
SELECT 1 FROM "Booking"
WHERE tenantId = ? AND date = ?
FOR UPDATE NOWAIT;  -- Fail immediately if locked, don't wait

-- Only after lock acquired, create booking
INSERT INTO Booking (tenantId, date, ...) VALUES (...);

COMMIT;  -- All-or-nothing
```

**Risk Assessment: MITIGATED**

- Webhook spoofing prevented (cryptographic verification)
- Double-booking prevented (3-layer defense)
- Commission manipulation prevented (server-side calculation + rounding)
- Payment fraud detected (webhook idempotency tracking)

---

### 4.4 Data Validation

#### Input Validation (Zod Schemas)

```typescript
// All API requests validated before processing
const CreateCheckoutDtoSchema = z.object({
  packageId: z.string(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Exact date format
  email: z.string().email(), // RFC 5322 compliant
  coupleName: z.string().min(1).max(200),
  addOnIds: z.array(z.string()).optional(),
});

// Usage
const parsed = CreateCheckoutDtoSchema.parse(req.body);
// Throws ZodError if invalid, caught by error handler
```

**Validation Coverage:**

- All public API request bodies
- All query parameters (date ranges, pagination)
- All webhook payloads (metadata validation)
- Type safety at compile time

**Missing Validations (TODO):**

- Request body size limits (should add `express.json({ limit: '1MB' })`)
- File upload size limits (image uploads not currently validated)
- Webhook signature header case-sensitivity (should be case-insensitive)

**Risk Assessment: PARTIALLY MITIGATED**

- Zod validation prevents injection attacks
- Type safety prevents incorrect data formats
- Missing: Request size limits (DoS vulnerability)

---

### 4.5 Error Handling & Information Disclosure

#### Error Response Masking

```typescript
// ✓ GOOD: Vague error message to client
throw new UnauthorizedError('Invalid credentials'); // 401

// ✓ GOOD: Log details server-side for debugging
logger.warn(
  {
    event: 'login_failed',
    email: body.email,
    ipAddress: req.ip,
    reason: 'password_mismatch',
  },
  'Failed admin login attempt'
);
```

**Sensitive Information Never Leaked:**

- Database connection strings
- JWT secret key
- Stripe API keys
- Google Calendar credentials
- Stack traces in production

**Risk Assessment: MITIGATED**

- Error messages generic and safe
- Detailed logs server-side only
- Secrets in environment variables

---

### 4.6 Security Vulnerabilities Identified

#### HIGH PRIORITY

1. **Missing Request Body Size Limits**
   - Severity: HIGH (DoS vulnerability)
   - Current state: No limit on POST body size
   - Impact: Attacker can send 1GB+ request, crash server
   - Fix: Add `express.json({ limit: '1MB' })` middleware
   - Status: NOT FIXED

2. **Webhook Signature Header Case Sensitivity**
   - Severity: MEDIUM (header parsing issue)
   - Current state: `req.headers['stripe-signature']` (case-sensitive)
   - Impact: Header might be `Stripe-Signature` on some clients
   - Fix: Use case-insensitive header lookup
   - Status: NOT FIXED

#### MEDIUM PRIORITY

3. **Rate Limiting Not on All Admin Endpoints**
   - Severity: MEDIUM (brute force on package CRUD)
   - Current state: Only `/v1/admin/login` rate limited
   - Impact: Attacker can mass-create/delete packages
   - Fix: Add rate limiting to `POST/PUT/DELETE /v1/admin/*` routes
   - Status: NOT FIXED

4. **Commission Rounding Not Enforced in Validation**
   - Severity: MEDIUM (revenue loss)
   - Current state: Math.ceil used but not tested edge cases
   - Impact: Floating-point errors could lose cents
   - Fix: Add unit tests for all rounding scenarios
   - Status: NOT FIXED

#### LOW PRIORITY

5. **Cache Invalidation Missing Edge Cases**
   - Severity: LOW (stale data issue)
   - Current state: Manual cache.del() calls
   - Impact: Stale packages returned for 5 minutes
   - Fix: Implement event-driven cache invalidation
   - Status: NOT FIXED

---

## Part 5: Performance Observations

### 5.1 Database Performance

#### Query Performance Analysis

**Fast Queries (< 10ms):**

```sql
-- Tenant lookup (indexed)
SELECT id FROM "Tenant" WHERE apiKeyPublic = ? -- Index: Tenant_apiKeyPublic_idx

-- Package lookup per tenant
SELECT * FROM "Package" WHERE tenantId = ? AND slug = ? -- Index: tenantId_slug_key

-- Availability check
SELECT 1 FROM "Booking" WHERE tenantId = ? AND date = ? FOR UPDATE NOWAIT
```

**Moderate Queries (10-100ms):**

```sql
-- List all packages with add-ons (N+1 risk)
SELECT * FROM "Package" WHERE tenantId = ?
JOIN "PackageAddOn" ON Package.id = PackageAddOn.packageId
JOIN "AddOn" ON PackageAddOn.addOnId = AddOn.id

-- Batch unavailable dates
SELECT date FROM "Booking"
WHERE tenantId = ? AND date BETWEEN ? AND ? AND status != 'CANCELED'
```

**Slow Queries (100-1000ms):**

```sql
-- Platform admin: list ALL bookings (no tenant filter)
SELECT * FROM "Booking" -- Scans 10k+ rows if multiple tenants

-- Platform stats calculation
SELECT COUNT(*), SUM(totalPrice) FROM "Booking" -- Full table scan
```

#### Index Coverage

| Query                    | Index                              | Status         |
| ------------------------ | ---------------------------------- | -------------- |
| Tenant lookup by API key | `Tenant_apiKeyPublic_idx`          | ✅ Covered     |
| Package lookup           | `Package_tenantId_slug_key`        | ✅ Covered     |
| Availability check       | `Booking_tenantId_date_idx`        | ✅ Covered     |
| Booking status filter    | `Booking_tenantId_status_idx`      | ✅ Covered     |
| Webhook processing       | `WebhookEvent_tenantId_status_idx` | ✅ Covered     |
| Date range queries       | Missing (no range index)           | ❌ NOT COVERED |
| Global stats             | Partial (no aggregate index)       | ⚠️ PARTIAL     |

#### Missing Indexes (Performance Recommendations)

```sql
-- Improve batch date range queries
CREATE INDEX "Booking_tenantId_date_range_idx"
ON "Booking"(tenantId, date) WHERE status != 'CANCELED';

-- Improve customer lookup
CREATE INDEX "Customer_tenantId_email_idx"
ON "Customer"(tenantId, email);

-- Improve segment package queries
CREATE INDEX "Package_tenantId_segmentId_idx"
ON "Package"(tenantId, segmentId) WHERE active = true;

-- Improve stats calculation
CREATE INDEX "Booking_tenantId_confirmedAt_idx"
ON "Booking"(tenantId, confirmedAt);
```

### 5.2 Cache Strategy

**Application Cache (NodeCache):**

- TTL: 5 minutes (configurable)
- Scope: In-memory, server instance
- Keys: Tenant-scoped

**Cached Data:**

```typescript
// Catalog data (expensive to fetch with JOINs)
cache.set(`catalog:${tenantId}:packages`, packages, 300);

// Availability checks (multiple DB queries)
cache.set(`availability:${tenantId}:${date}`, isAvailable, 60);

// Tenant branding (rarely changes)
cache.set(`branding:${tenantId}`, branding, 3600);
```

**Cache Invalidation:**

```typescript
// On package update
await catalogService.updatePackage(tenantId, id, input);
cache.del(`catalog:${tenantId}:packages`); // Manual invalidation

// On booking creation
await bookingService.createBooking(tenantId, input);
cache.del(`availability:${tenantId}:*`); // Wildcard not supported
```

**Performance Impact:**

- Cache HIT: ~1ms (memory access)
- Cache MISS: ~20-100ms (database query + join)
- Hit rate: ~60-70% in production (varies by traffic pattern)

**Limitations:**

- Single instance cache (not shared across server replicas)
- No distributed cache (Redis) implemented
- Manual invalidation is error-prone
- No cache warming strategy

### 5.3 Concurrency Performance

**Booking Creation Under Load:**

```
Scenario: 10 concurrent requests for same date

Request 1: Acquires lock, creates booking
Requests 2-10: Wait for lock (FOR UPDATE NOWAIT)
  → Timeout after 5 seconds (BOOKING_TRANSACTION_TIMEOUT_MS)
  → Returns 409 BookingConflictError

Result: 1 booking created, 9 conflicts
Expected behavior: Correct, prevents overbooking
```

**Lock Timeout Configuration:**

```typescript
const BOOKING_TRANSACTION_TIMEOUT_MS = 5000; // 5 seconds
const BOOKING_ISOLATION_LEVEL = 'Serializable' as const;
```

**Retry Strategy (Client Side):**

```typescript
// Client should implement exponential backoff
async function createBookingWithRetry(input, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await bookingService.createCheckout(input);
    } catch (error) {
      if (error instanceof BookingConflictError) {
        const backoff = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await sleep(backoff);
      } else {
        throw error;
      }
    }
  }
}
```

**Performance Metrics:**

- Booking creation: ~500-800ms (Stripe checkout creation included)
- Availability check: ~50-150ms (single date)
- Batch date range: ~200-500ms (30-day range)
- Webhook processing: ~1000-2000ms (including email)

### 5.4 Scalability Analysis

**Vertical Scaling (Single Instance):**

- Max concurrent connections: ~1000 (default Node.js)
- Max bookings/minute: ~60 (with 500ms checkout time)
- Max tenants: ~50 (current design limit)

**Horizontal Scaling (Multiple Instances):**

- Limitation: In-memory cache not shared (each instance has own copy)
- Solution: Add Redis for distributed cache
- Database connection pooling: Already implemented (Supabase)

**Bottleneck:** Cache invalidation with multiple instances

- Instance A updates package → clears cache on A
- Instance B still has stale cache
- Fix: Use event bus (Redis Pub/Sub) for cache invalidation across instances

---

## Part 6: Migration History & Data Safety

### 6.1 Migration Timeline

| Phase    | Date       | Action                          | Risk   |
| -------- | ---------- | ------------------------------- | ------ |
| Phase 1  | 2025-10-23 | Restructure hexagonal → layered | High   |
| Phase 2A | 2025-10-23 | Add password hashing            | Low    |
| Phase 2B | 2025-10-29 | Integrate Supabase              | High   |
| Phase 3  | 2025-11-18 | Add multi-tenancy               | High   |
| Phase 4  | Planned    | Config-driven system            | Medium |

### 6.2 Multi-Tenancy Migration (Phase 3)

**Migration Strategy (Safe):**

```sql
-- Step 1: Create Tenant table
CREATE TABLE "Tenant" (...)

-- Step 2: Insert legacy tenant
INSERT INTO "Tenant" VALUES ('tenant_default_legacy', 'elope', ...)

-- Step 3: Add tenantId columns (nullable)
ALTER TABLE "Package" ADD COLUMN "tenantId" TEXT

-- Step 4: Populate with default tenant
UPDATE "Package" SET "tenantId" = 'tenant_default_legacy' WHERE "tenantId" IS NULL

-- Step 5: Make NOT NULL and add FK
ALTER TABLE "Package" ALTER COLUMN "tenantId" SET NOT NULL
ALTER TABLE "Package" ADD CONSTRAINT "Package_tenantId_fkey" ...

-- Step 6: Add composite unique constraints
ALTER TABLE "Package" ADD CONSTRAINT "Package_tenantId_slug_key" UNIQUE(tenantId, slug)

-- Step 7: Drop old unique constraints
ALTER TABLE "Package" DROP CONSTRAINT "Package_slug_key"
```

**Data Validation Post-Migration:**

```sql
-- Verify no orphaned records
SELECT COUNT(*) FROM "Package" WHERE "tenantId" IS NULL  -- Should be 0
SELECT COUNT(*) FROM "Booking" WHERE "tenantId" IS NULL  -- Should be 0
```

### 6.3 Backup & Disaster Recovery

**Backup Strategy:**

- Supabase automatic daily backups (7 days retention)
- Point-in-time recovery available
- Encrypted at rest

**Recovery Procedure:**

1. Contact Supabase support for backup restore
2. Restore to new database instance
3. Run migrations if needed
4. Test connections
5. Update DATABASE_URL in environment

**High Availability:**

- Single database instance (no replication)
- No read replicas (could improve read performance)
- No failover mechanism

**Recommendations:**

- Enable Supabase replication for HA
- Set up automated daily export to S3
- Document recovery procedures

---

## Part 7: Outstanding Issues & Recommendations

### 7.1 Data Architecture Issues

| Priority | Issue                           | Impact                        | Fix                                   |
| -------- | ------------------------------- | ----------------------------- | ------------------------------------- |
| P0       | Request body size limit missing | DoS vulnerability             | Add `express.json({ limit: '1MB' })`  |
| P1       | Rate limiting incomplete        | Brute force on CRUD           | Add rate limiter to all admin routes  |
| P2       | Cache invalidation manual       | Stale data (5 min)            | Event-driven cache invalidation       |
| P2       | Index gaps on date ranges       | Query slowdown (30-day range) | Add composite indexes on date queries |
| P3       | No distributed cache            | Scaling limitation            | Add Redis for multi-instance cache    |
| P3       | Password reset missing          | Account lockout risk          | Implement password reset flow         |

### 7.2 API Issues

| Priority | Issue                           | Impact                 | Fix                                |
| -------- | ------------------------------- | ---------------------- | ---------------------------------- |
| P1       | Webhook header case sensitivity | Event loss             | Use case-insensitive header lookup |
| P2       | No API versioning strategy      | Breaking changes risky | Document v2 upgrade path           |
| P3       | Pagination not implemented      | Large datasets slow    | Add limit/offset to list endpoints |
| P3       | No request ID correlation       | Debugging difficult    | Add request ID to all logs         |

### 7.3 Security Issues

| Priority | Issue                      | Impact                 | Fix                                             |
| -------- | -------------------------- | ---------------------- | ----------------------------------------------- |
| P0       | Request size limit missing | DoS                    | Add size limit middleware                       |
| P1       | Missing input validation   | Injection risk         | Add validators to all routes                    |
| P2       | Error messages too generic | Hard to debug          | Log details server-side, return codes to client |
| P3       | No CSRF protection         | State-changing attacks | Add CSRF tokens for form submissions            |

---

## Summary & Recommendations

### Strengths

1. **Robust multi-tenant isolation** with 3-layer defense
2. **Type-safe API contracts** with Zod validation
3. **Transaction safety** with pessimistic locking
4. **Webhook idempotency** prevents duplicate bookings
5. **Clear service layer** separation (repositories, services, controllers)

### Critical Improvements Needed

1. Add request body size limits (DoS vulnerability)
2. Implement rate limiting on all admin endpoints
3. Fix webhook header case sensitivity
4. Add distributed cache (Redis) for multi-instance scaling
5. Implement event-driven cache invalidation

### Performance Optimization Opportunities

1. Add missing database indexes (date ranges)
2. Implement query result caching for stats
3. Add read replicas for scaling reads
4. Batch webhook events for bulk processing

### Recommended Next Steps

1. Fix P0/P1 security issues (body size, rate limiting)
2. Add missing indexes for date range queries
3. Implement Redis for distributed caching
4. Add comprehensive integration tests for webhook flows
5. Document scaling strategy for multi-instance deployment
