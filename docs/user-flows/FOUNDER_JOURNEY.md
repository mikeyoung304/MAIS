# FOUNDER/PLATFORM ADMIN Journey

**Document Version:** 1.0
**Last Updated:** 2025-01-21
**Platform Version:** Sprint 10 Complete (92.2% test pass rate)

## Overview

The **FOUNDER/PLATFORM ADMIN** is the highest-level user role in the MAIS platform. This role owns and operates the entire multi-tenant platform, managing all tenants (business owners), monitoring system-wide metrics, and maintaining platform infrastructure.

### Role Characteristics

- **Access Level:** Platform-wide (all tenants, all data)
- **Primary Responsibilities:** Tenant management, platform operations, system monitoring
- **Authentication:** JWT-based with `PLATFORM_ADMIN` role
- **Technical Proficiency:** High (CLI tools, database migrations, environment configuration)
- **Business Context:** Revenue-sharing SaaS platform operator

### Key Differentiators from Other Roles

| Feature                 | Platform Admin     | Tenant Admin       | Customer     |
| ----------------------- | ------------------ | ------------------ | ------------ |
| Multi-tenant visibility | ✅ All tenants     | ❌ Own tenant only | ❌ None      |
| Tenant creation         | ✅ Yes             | ❌ No              | ❌ No        |
| Stripe Connect setup    | ✅ For all tenants | ❌ Own setup only  | ❌ None      |
| Platform statistics     | ✅ System-wide     | ❌ Own metrics     | ❌ None      |
| CLI access              | ✅ Required        | ⚠️ Optional        | ❌ None      |
| Database migrations     | ✅ Required        | ❌ No access       | ❌ No access |

---

## Complete Journey Map

### Phase 1: Platform Initialization

**Goal:** Set up the MAIS platform infrastructure from scratch

#### Step 1.1: Environment Setup

**Location:** Local development machine or production server
**Tools Required:** Node.js 18+, PostgreSQL, Git

```bash
# Clone repository
git clone <repository-url>
cd MAIS

# Install dependencies (npm workspaces)
npm install

# Validate environment configuration
npm run doctor
```

**Technical Implementation:**

- **File:** `/Users/mikeyoung/CODING/MAIS/server/scripts/doctor.ts` (lines 1-100+)
- **Config Service:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/core/config.ts`
- **Validation:** Zod schemas validate 15+ environment variables
- **Output:** Health check report with missing/invalid variables

**Required Environment Variables:**

```bash
# Core Configuration
JWT_SECRET=<generate-with-openssl-rand-hex-32>
TENANT_SECRETS_ENCRYPTION_KEY=<generate-with-openssl-rand-hex-32>
DATABASE_URL=postgresql://user:password@host:5432/mais
DIRECT_URL=<same-as-DATABASE_URL>

# Stripe (Production)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional (Graceful Fallbacks)
POSTMARK_SERVER_TOKEN=<email-api-token>
GOOGLE_CALENDAR_ID=<calendar-id>
```

**Success Criteria:**

- ✅ `npm run doctor` shows all required variables set
- ✅ Database connection successful
- ✅ No missing secrets warnings

---

#### Step 1.2: Database Schema Setup

**Goal:** Create all database tables and initial platform admin user

```bash
cd server

# Apply all migrations
npm exec prisma migrate deploy

# Generate Prisma Client
npm exec prisma generate

# Seed database (creates platform admin + test tenant)
npm exec prisma db seed
```

**Technical Implementation:**

- **Migrations:** `/Users/mikeyoung/CODING/MAIS/server/prisma/migrations/`
- **Schema:** `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma`
- **Seed Script:** `/Users/mikeyoung/CODING/MAIS/server/prisma/seed.ts` (lines 1-209)

**What Gets Created:**

1. **Platform Admin User:**
   - Email: `admin@elope.com`
   - Password: `admin123` (⚠️ CHANGE IN PRODUCTION)
   - Role: `PLATFORM_ADMIN`
   - Location: `User` table, line 23-27 in seed.ts

2. **Test Tenant (E2E):**
   - Slug: `elope-e2e`
   - Name: "MAIS E2E Test Tenant"
   - API Key: `pk_live_elope-e2e_000000000000`
   - Secret Key: (hashed) `sk_live_elope-e2e_...`
   - Location: `Tenant` table, lines 35-64 in seed.ts

3. **Sample Data:**
   - 3 packages (Classic, Garden, Luxury)
   - 4 add-ons (Photography, Officiant, Bouquet, Violinist)
   - 1 blackout date (Christmas 2025)
   - Location: Lines 70-205 in seed.ts

**Database Schema Highlights:**

- **User Model** (lines 15-34): Platform admin + tenant admin authentication
- **Tenant Model** (lines 36-92): Multi-tenant isolation, API keys, Stripe Connect
- **Booking Model** (lines 247-289): Unique constraint `@@unique([tenantId, date])` prevents double-booking
- **WebhookEvent Model** (lines 348-375): Idempotency with composite unique key `[tenantId, eventId]`

**Success Criteria:**

- ✅ Database tables created (15+ models)
- ✅ Platform admin user exists in `User` table
- ✅ Test tenant exists in `Tenant` table
- ✅ Can log in at `/api/docs` (Swagger UI)

---

#### Step 1.3: First Login

**Goal:** Authenticate as platform admin and verify access

**Login Endpoint:** `POST /v1/auth/login` (Unified Authentication)

**Request:**

```bash
curl -X POST http://localhost:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@elope.com",
    "password": "admin123"
  }'
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "PLATFORM_ADMIN",
  "email": "admin@elope.com",
  "userId": "clx123abc..."
}
```

**Technical Implementation:**

- **Route:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/auth.routes.ts` (lines 166-204)
- **Controller:** `UnifiedAuthController.login()` (lines 53-92)
- **Service:** `/Users/mikeyoung/CODING/MAIS/server/src/services/identity.service.ts` (lines 16-38)
- **Middleware:** `/Users/mikeyoung/CODING/MAIS/server/src/middleware/auth.ts` (lines 14-67)

**Authentication Flow:**

1. Request hits unified login endpoint (line 166 in auth.routes.ts)
2. Controller tries tenant login first (lines 58-72)
3. Falls back to platform admin login (lines 78-88)
4. IdentityService validates credentials via bcrypt (line 22)
5. JWT token generated with `role: 'admin'` payload (lines 27-36)
6. Token valid for 7 days (line 35)

**JWT Token Payload:**

```typescript
{
  userId: string; // Platform admin user ID
  email: string; // admin@elope.com
  role: 'admin'; // Grants platform-wide access
  iat: number; // Issued at timestamp
  exp: number; // Expires in 7 days
}
```

**Rate Limiting:**

- **Endpoint Protection:** `loginLimiter` middleware (5 attempts per 15 minutes per IP)
- **Implementation:** `/Users/mikeyoung/CODING/MAIS/server/src/middleware/rateLimiter.ts`
- **Security:** Prevents brute-force attacks on authentication

**Success Criteria:**

- ✅ 200 response with JWT token
- ✅ Token includes `role: "PLATFORM_ADMIN"`
- ✅ Token validates on protected endpoints

---

### Phase 2: Tenant Onboarding

**Goal:** Add new business owners to the platform

#### Step 2.1: Create New Tenant (CLI)

**Recommended Method:** CLI script for tenant creation with API key generation

```bash
cd server

# Basic tenant creation
npm run create-tenant -- --slug=bellaweddings --name="Bella Weddings"

# With custom commission rate
npm run create-tenant -- --slug=luxuryevents --name="Luxury Events" --commission=12.5
```

**Technical Implementation:**

- **Script:** `/Users/mikeyoung/CODING/MAIS/server/scripts/create-tenant.ts` (lines 1-206)
- **Repository:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/tenant.repository.ts`
- **API Key Service:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/api-key.service.ts`

**Execution Flow:**

1. **Parse Arguments** (lines 33-51):
   - `--slug`: URL-safe identifier (required)
   - `--name`: Display name (required)
   - `--commission`: Platform fee percentage (optional, default 10.0)

2. **Validate Slug Availability** (lines 109-117):
   - Check `Tenant` table for existing slug
   - Enforce slug rules: 3-50 chars, lowercase, alphanumeric + hyphens

3. **Generate API Key Pair** (lines 123-124):
   - **Public Key:** `pk_live_{slug}_{12-random-chars}` (client-safe)
   - **Secret Key:** `sk_live_{slug}_{32-hex-chars}` (server-only, SHOWN ONCE)
   - Secret key hashed with bcrypt before storage

4. **Create Tenant Record** (lines 129-136):
   - Insert into `Tenant` table
   - Store hashed secret key (never plaintext)
   - Set `isActive: true` by default

**Output Example:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TENANT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tenant ID:    clx456def...
Slug:         bellaweddings
Name:         Bella Weddings
Commission:   10%
Created:      2025-01-21T10:30:00.000Z
Active:       Yes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 API KEYS (SAVE THESE SECURELY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Public Key:
  pk_live_bellaweddings_abc123xyz
  ℹ️  Safe for client-side use (embed in widget)

Secret Key:
  sk_live_bellaweddings_0123456789abcdef...
  ⚠️  SHOWN ONCE - Save immediately!
  ⚠️  Server-side only - NEVER expose to client

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Next Steps:
   1. Save the secret key in a secure password manager
   2. Provide both keys to the tenant
   3. Configure Stripe Connect for payment processing
   4. Set up branding via admin API
```

**Security Notes:**

- ⚠️ **Secret key shown ONLY ONCE** - cannot be retrieved later
- ✅ Public key safe for embedded widgets (read-only access)
- ✅ Secret key required for admin operations (write access)
- ✅ All keys scoped per tenant (no cross-tenant access)

**Success Criteria:**

- ✅ Tenant created in database
- ✅ API keys generated and displayed
- ✅ Founder has saved secret key securely

---

#### Step 2.2: Create Tenant with Stripe Connect (CLI)

**Advanced Method:** CLI script that creates tenant AND sets up Stripe Connect in one step

```bash
cd server

# Full setup with Stripe Connect
npm run create-tenant-with-stripe -- \
  --slug=bellaweddings \
  --name="Bella Weddings" \
  --email=owner@bellaweddings.com \
  --commission=10.0 \
  --country=US
```

**Technical Implementation:**

- **Script:** `/Users/mikeyoung/CODING/MAIS/server/scripts/create-tenant-with-stripe.ts` (lines 1-365)
- **Service:** `/Users/mikeyoung/CODING/MAIS/server/src/services/stripe-connect.service.ts`

**Execution Flow:**

1. **Tenant Creation** (lines 204-225):
   - Same as Step 2.1
   - API keys generated

2. **Stripe Connect Account Creation** (lines 228-234):
   - Creates Stripe Connected Account (type: `express`)
   - Links to tenant record via `stripeAccountId`
   - Initial state: `chargesEnabled: false`, `payoutsEnabled: false`

3. **Onboarding Link Generation** (lines 237-243):
   - Creates Stripe AccountLink for tenant onboarding
   - URL expires in 1 hour
   - Return/refresh URLs configurable

**Output Example:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 STRIPE CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Account ID:   acct_1234567890
Country:      US
Charges:      Disabled (complete onboarding)
Payouts:      Disabled (complete onboarding)
Details:      Pending (complete onboarding)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 STRIPE ONBOARDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Onboarding URL (expires in 1 hour):
  https://connect.stripe.com/setup/e/acct_xxx/yyy

⚠️  IMPORTANT: Complete Stripe onboarding to enable payments
   1. Copy the onboarding URL above
   2. Open it in your browser
   3. Complete the Stripe Connect onboarding process
   4. Verify account status after completion
```

**Stripe Connect Setup:**

- **Account Type:** Express (Stripe-hosted onboarding)
- **Revenue Model:** Application fees (platform takes commission)
- **Payment Flow:** Customer → Tenant Stripe Account → Platform Fee → Tenant Payout
- **Capabilities:** `card_payments`, `transfers` (automatic)

**Success Criteria:**

- ✅ Tenant created with API keys
- ✅ Stripe Connect account linked
- ✅ Onboarding URL generated
- ✅ Tenant can complete onboarding independently

---

#### Step 2.3: Create Tenant via API (Dashboard)

**Alternative Method:** REST API endpoint for programmatic tenant creation

**Endpoint:** `POST /v1/admin/tenants`
**Authentication:** Required (Bearer token with `PLATFORM_ADMIN` role)

**Request:**

```bash
curl -X POST http://localhost:3001/v1/admin/tenants \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "bellaevents",
    "name": "Bella Events LLC",
    "commission": 12.5
  }'
```

**Technical Implementation:**

- **Route:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/admin/tenants.routes.ts` (lines 89-136)
- **Middleware:** Auth middleware validates JWT (lines 284)
- **Repository:** PrismaTenantRepository (line 28)

**Validation Rules:**

- `slug`: Required, 3-50 chars, lowercase, alphanumeric + hyphens
- `name`: Required, display name
- `commission`: Optional, 0-100 (default 10.0)

**Response:**

```json
{
  "tenant": {
    "id": "clx789ghi...",
    "slug": "bellaevents",
    "name": "Bella Events LLC",
    "apiKeyPublic": "pk_live_bellaevents_xyz123",
    "commissionPercent": 12.5,
    "isActive": true,
    "createdAt": "2025-01-21T10:45:00.000Z"
  },
  "secretKey": "sk_live_bellaevents_abcdef0123456789..."
}
```

**⚠️ CRITICAL:** `secretKey` is returned ONLY in this response. It is never stored in plaintext and cannot be retrieved later.

**Success Criteria:**

- ✅ 201 Created response
- ✅ Tenant object with API keys
- ✅ Secret key saved by founder

---

### Phase 3: Platform Operations

**Goal:** Monitor system health, manage tenants, ensure platform stability

#### Step 3.1: View Platform Dashboard

**Location:** Platform Admin Dashboard UI (if implemented)
**Endpoint:** `GET /v1/admin/stats` (API)

**Technical Implementation:**

- **Controller:** `/Users/mikeyoung/CODING/MAIS/server/src/controllers/platform-admin.controller.ts` (lines 54-135)
- **Frontend:** `/Users/mikeyoung/CODING/MAIS/client/src/pages/admin/PlatformAdminDashboard.tsx` (lines 1-367)

**API Request:**

```bash
curl http://localhost:3001/v1/admin/stats \
  -H "Authorization: Bearer eyJhbGc..."
```

**Response:**

```json
{
  "totalTenants": 15,
  "activeTenants": 12,
  "totalSegments": 28,
  "activeSegments": 24,
  "totalBookings": 342,
  "confirmedBookings": 298,
  "pendingBookings": 44,
  "totalRevenue": 85600000,
  "platformCommission": 8560000,
  "tenantRevenue": 77040000,
  "revenueThisMonth": 12400000,
  "bookingsThisMonth": 52
}
```

**Dashboard UI Metrics:**

1. **Total Tenants** (line 177-186): Building2 icon, shows active count
2. **Business Segments** (lines 188-197): Layers icon, shows active segments
3. **Total Bookings** (lines 199-208): Calendar icon, all tenants
4. **Total Revenue** (lines 210-221): DollarSign icon, system-wide (cents)
5. **Platform Commission** (lines 223-234): DollarSign icon, earnings (cents)

**Tenant Management Table:**

- **Location:** Lines 239-362 in PlatformAdminDashboard.tsx
- **Features:** Search, filter, view details, create new tenant
- **Columns:** Name, Slug, Email, Packages, Bookings, Commission, Status, Actions
- **Actions:** View Details → Navigate to `/admin/tenants/:id`

**Success Criteria:**

- ✅ System-wide metrics visible
- ✅ All tenants listed with stats
- ✅ Search/filter functionality works
- ✅ Can navigate to tenant details

---

#### Step 3.2: Manage Tenant Lifecycle

**View All Tenants:**

```bash
GET /v1/admin/tenants
Authorization: Bearer <platform-admin-token>
```

**Technical Implementation:**

- **Route:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/admin/tenants.routes.ts` (lines 27-74)
- **Returns:** Array of tenants with stats (packages, bookings, add-ons count)

**Get Tenant Details:**

```bash
GET /v1/admin/tenants/:id
Authorization: Bearer <platform-admin-token>
```

**Response:**

```json
{
  "tenant": {
    "id": "clx123...",
    "slug": "bellaweddings",
    "name": "Bella Weddings",
    "apiKeyPublic": "pk_live_bellaweddings_...",
    "commissionPercent": 10.0,
    "branding": { "fontFamily": "Inter" },
    "stripeOnboarded": true,
    "stripeAccountId": "acct_1234567890",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-21T10:45:00.000Z",
    "stats": {
      "bookings": 45,
      "packages": 8,
      "addOns": 12,
      "blackoutDates": 3
    }
  }
}
```

**Update Tenant:**

```bash
PUT /v1/admin/tenants/:id
Authorization: Bearer <platform-admin-token>
Content-Type: application/json

{
  "commission": 15.0,
  "isActive": true,
  "branding": {
    "fontFamily": "Playfair Display"
  }
}
```

**Technical Implementation:**

- **Route:** Lines 200-234 in tenants.routes.ts
- **Validation:** Commission must be 0-100
- **Updatable Fields:** `name`, `commissionPercent`, `branding`, `isActive`

**Deactivate Tenant (Soft Delete):**

```bash
DELETE /v1/admin/tenants/:id
Authorization: Bearer <platform-admin-token>
```

**Response:** `204 No Content`

**⚠️ Note:** This is a soft delete - sets `isActive: false`, does NOT delete data.

**Success Criteria:**

- ✅ Can list all tenants
- ✅ Can view tenant details with full stats
- ✅ Can update tenant settings
- ✅ Can deactivate tenant (reversible)

---

#### Step 3.3: Manage Stripe Connect Accounts

**Goal:** Set up payment processing for tenants

**Create Stripe Connect Account:**

```bash
POST /v1/admin/tenants/:tenantId/stripe/connect
Authorization: Bearer <platform-admin-token>
Content-Type: application/json

{
  "country": "US",
  "email": "owner@bellaweddings.com"
}
```

**Technical Implementation:**

- **Route:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/admin/stripe.routes.ts` (lines 55-95)
- **Service:** StripeConnectService.createConnectedAccount()
- **Validation:** Tenant must exist, no existing Stripe account

**Response:**

```json
{
  "accountId": "acct_1234567890",
  "chargesEnabled": false,
  "payoutsEnabled": false,
  "detailsSubmitted": false
}
```

**Generate Onboarding Link:**

```bash
POST /v1/admin/tenants/:tenantId/stripe/onboarding
Authorization: Bearer <platform-admin-token>
Content-Type: application/json

{
  "refreshUrl": "https://admin.mais.com/tenants/:id/stripe",
  "returnUrl": "https://admin.mais.com/tenants/:id/stripe/success"
}
```

**Response:**

```json
{
  "url": "https://connect.stripe.com/setup/e/acct_xxx/yyy",
  "expiresAt": 1706097600
}
```

**⚠️ Link expires in 1 hour** - generate new link if expired

**Check Account Status:**

```bash
GET /v1/admin/tenants/:tenantId/stripe/status
Authorization: Bearer <platform-admin-token>
```

**Response:**

```json
{
  "accountId": "acct_1234567890",
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "detailsSubmitted": true,
  "requirements": {
    "currentlyDue": [],
    "eventuallyDue": ["external_account"],
    "pastDue": []
  }
}
```

**Stripe Onboarding States:**

1. **Not Started:** `stripeAccountId: null` in database
2. **Account Created:** `stripeAccountId` set, `stripeOnboarded: false`
3. **Onboarding In Progress:** Tenant filling out Stripe forms
4. **Onboarding Complete:** `stripeOnboarded: true`, `chargesEnabled: true`

**Success Criteria:**

- ✅ Stripe account created for tenant
- ✅ Onboarding link generated
- ✅ Tenant completes onboarding
- ✅ `stripeOnboarded: true` in database

---

#### Step 3.4: Monitor System Health

**Health Check Endpoint:**

```bash
GET /health
# No authentication required
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-21T10:50:00.000Z",
  "uptime": 3456.78,
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "stripe": "healthy",
    "cache": "healthy"
  }
}
```

**Technical Implementation:**

- **Route:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/health.routes.ts`
- **Checks:** Database connection, external service connectivity
- **Usage:** Monitoring tools, load balancers, uptime tracking

**Environment Health Check:**

```bash
npm run doctor
```

**Output:**

- ✅ Required environment variables
- ⚠️ Optional variables with fallbacks
- ❌ Missing critical configuration

**Database Status:**

```bash
cd server
npm exec prisma studio
# Opens visual database browser at http://localhost:5555
```

**Monitoring Checklist:**

- [ ] Health endpoint returns 200 OK
- [ ] Database connection stable
- [ ] Stripe API accessible
- [ ] No rate limit violations
- [ ] Error logs within acceptable threshold
- [ ] All tenants' Stripe accounts operational

**Success Criteria:**

- ✅ Health endpoint accessible
- ✅ All services reporting healthy
- ✅ No critical errors in logs

---

### Phase 4: Database Management

**Goal:** Maintain database schema, handle migrations, manage data integrity

#### Step 4.1: Schema Migrations

**Create New Migration:**

```bash
cd server

# After editing prisma/schema.prisma
npm exec prisma migrate dev --name add_new_feature

# Example: Adding a new field to Tenant model
npm exec prisma migrate dev --name add_tenant_phone_field
```

**Technical Implementation:**

- **Schema:** `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma` (lines 1-429)
- **Migrations:** `/Users/mikeyoung/CODING/MAIS/server/prisma/migrations/`

**Migration Workflow:**

1. Edit `schema.prisma` (e.g., add new field)
2. Run `prisma migrate dev --name <descriptive-name>`
3. Prisma generates SQL migration file
4. Prisma applies migration to database
5. Prisma regenerates client types

**Check Migration Status:**

```bash
npm exec prisma migrate status
```

**Output Example:**

```
Status
3 migrations found in prisma/migrations

Database schema is up to date!
```

**Apply Migrations (Production):**

```bash
npm exec prisma migrate deploy
# Non-interactive, safe for CI/CD
```

**⚠️ Critical Safeguards:**

- Never edit migration files manually
- Always test migrations in development first
- Use `prisma migrate deploy` in production (not `dev`)
- Backup database before major schema changes

**Success Criteria:**

- ✅ Migration file generated
- ✅ Database schema updated
- ✅ Prisma Client regenerated
- ✅ Application restarts successfully

---

#### Step 4.2: Database Seeding

**Re-seed Database:**

```bash
cd server
npm exec prisma db seed
```

**Use Cases:**

- Resetting development environment
- Creating test data for E2E tests
- Adding sample tenants for demos

**What Gets Seeded:**

- Platform admin user (admin@elope.com)
- Test tenant (elope-e2e)
- Sample packages (Classic, Garden, Luxury)
- Sample add-ons (Photography, Officiant, etc.)
- Blackout dates (holidays)

**⚠️ Warning:** Seeding is idempotent (uses `upsert`), but **DO NOT run in production** with customer data.

**Success Criteria:**

- ✅ Seed script completes without errors
- ✅ Platform admin user exists
- ✅ Test tenant exists with sample data

---

#### Step 4.3: Database Backup & Restore

**Backup Database (PostgreSQL):**

```bash
# Export full database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Export specific tables
pg_dump $DATABASE_URL -t tenants -t bookings > critical_tables.sql
```

**Restore Database:**

```bash
psql $DATABASE_URL < backup_20250121.sql
```

**Automated Backups (Production):**

- Use managed database service (Supabase, AWS RDS)
- Configure automatic daily backups
- Retain backups for 30 days minimum
- Test restore procedure quarterly

**Success Criteria:**

- ✅ Backup file created successfully
- ✅ Backup file size reasonable (indicates data captured)
- ✅ Restore tested in non-production environment

---

### Phase 5: Advanced Operations

**Goal:** Handle complex platform scenarios, troubleshoot issues, optimize performance

#### Step 5.1: Secret Rotation

**When to Rotate Secrets:**

- Scheduled rotation (quarterly recommended)
- Security incident or breach
- Employee/contractor offboarding
- Suspected key compromise

**Rotate JWT Secret:**

```bash
# Generate new secret
openssl rand -hex 32

# Update .env file
JWT_SECRET=<new-secret>

# Restart API server
npm run dev:api

# All existing tokens immediately invalid
# Users must re-authenticate
```

**⚠️ Impact:** All logged-in users (platform admins + tenant admins) will be logged out.

**Rotate Tenant API Keys:**

```bash
cd server

# Regenerate keys for specific tenant
npm run rotate-tenant-keys -- --tenantId=clx123...

# Output will show NEW keys
# Notify tenant immediately
```

**Technical Implementation:**

- **Guide:** `/Users/mikeyoung/CODING/MAIS/docs/security/SECRET_ROTATION_GUIDE.md`
- **Service:** API Key Service with key generation logic

**Success Criteria:**

- ✅ New secret generated securely
- ✅ Application restarted with new secret
- ✅ Old tokens rejected
- ✅ New logins work correctly

---

#### Step 5.2: Incident Response

**Security Incident Playbook:**

1. **Detect:** Unusual activity (failed logins, API errors, rate limit violations)
2. **Contain:** Deactivate affected tenants, revoke compromised keys
3. **Investigate:** Analyze logs, identify root cause
4. **Remediate:** Patch vulnerability, rotate secrets, update dependencies
5. **Document:** Write post-incident report

**Common Incidents:**

**Double-Booking Detected:**

```bash
# Check database for conflicts
psql $DATABASE_URL -c "
  SELECT date, COUNT(*)
  FROM bookings
  WHERE tenantId = 'clx123...'
  GROUP BY date
  HAVING COUNT(*) > 1;
"

# If found, investigate transaction logs
# Check for race condition bypass
```

**Stripe Webhook Failure:**

```bash
# Check webhook events table
psql $DATABASE_URL -c "
  SELECT * FROM webhook_events
  WHERE status = 'FAILED'
  ORDER BY createdAt DESC
  LIMIT 10;
"

# Manually replay failed webhook
curl -X POST http://localhost:3001/v1/dev/simulate-checkout-completed \
  -H "Content-Type: application/json" \
  -d '{"bookingId": "clx456..."}'
```

**Success Criteria:**

- ✅ Incident contained within 1 hour
- ✅ Root cause identified
- ✅ Remediation applied
- ✅ Post-incident report documented

---

#### Step 5.3: Performance Optimization

**Enable Redis Caching:**

```bash
# Add to .env
REDIS_URL=redis://localhost:6379

# Restart API server
npm run dev:api
```

**Cache Performance Metrics:**

- Hit response time: ~5ms (97.5% faster than database)
- Database load reduction: 70%
- Cache hit rate target: >80%

**Database Query Optimization:**

```bash
# Check slow queries (PostgreSQL)
psql $DATABASE_URL -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"
```

**Existing Performance Indexes:**

- **Tenant isolation:** `[tenantId]` on all multi-tenant tables
- **Date queries:** `[tenantId, date]` on Booking, BlackoutDate
- **Status filtering:** `[tenantId, status]` on Booking
- **Recent records:** `[tenantId, createdAt]` on Customer, WebhookEvent

**Success Criteria:**

- ✅ Cache enabled and working
- ✅ Response times improved
- ✅ Database CPU usage reduced
- ✅ No cache-related bugs

---

## Technical Implementation Details

### Authentication & Authorization

**Platform Admin Authentication Flow:**

1. **Login Request:** `POST /v1/auth/login` with email/password
2. **Credential Validation:** IdentityService checks User table, bcrypt compare
3. **JWT Generation:** Sign token with `role: 'admin'`, 7-day expiration
4. **Token Storage:** Client stores in localStorage or cookie
5. **Subsequent Requests:** Include `Authorization: Bearer <token>` header
6. **Middleware Validation:** Auth middleware verifies token, checks role
7. **Route Access:** Route handler receives validated admin user in `res.locals.admin`

**Files:**

- Auth Routes: `/Users/mikeyoung/CODING/MAIS/server/src/routes/auth.routes.ts` (lines 166-204)
- Identity Service: `/Users/mikeyoung/CODING/MAIS/server/src/services/identity.service.ts` (lines 16-49)
- Auth Middleware: `/Users/mikeyoung/CODING/MAIS/server/src/middleware/auth.ts` (lines 14-67)

**Security Features:**

- Bcrypt password hashing (12 rounds, OWASP recommendation)
- JWT with explicit algorithm (HS256 only, prevents confusion attacks)
- Rate limiting (5 attempts per 15 minutes per IP)
- Token expiration (7 days, refresh required)
- Role validation (reject tenant tokens on admin routes)

---

### Multi-Tenant Data Isolation

**Critical Rule:** ALL database queries MUST filter by `tenantId` to prevent data leakage.

**Tenant Resolution Flow:**

1. Client sends `X-Tenant-Key` header (format: `pk_live_{slug}_{random}`)
2. Tenant middleware validates key and resolves tenant
3. Middleware injects `tenantId` into `req.tenantId`
4. All subsequent queries use `req.tenantId` for filtering

**Files:**

- Tenant Middleware: `/Users/mikeyoung/CODING/MAIS/server/src/middleware/tenant.ts`
- Repository Interfaces: `/Users/mikeyoung/CODING/MAIS/server/src/lib/ports.ts`

**Example (Safe Query):**

```typescript
// ✅ CORRECT - Tenant-scoped
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});
```

**Example (Vulnerable Query):**

```typescript
// ❌ WRONG - Returns data from all tenants
const packages = await prisma.package.findMany({
  where: { active: true },
});
```

**Platform Admin Exception:**

- Platform admins can query across all tenants
- Must explicitly opt-in (no `tenantId` filter)
- Used only for platform-wide statistics and tenant management

---

### API Key Management

**Key Types:**

1. **Public Key** (`pk_live_{slug}_{12-random-chars}`):
   - Safe for client-side use
   - Embedded in widgets
   - Read-only access to tenant data
   - Used for package catalog, availability checks

2. **Secret Key** (`sk_live_{slug}_{32-hex-chars}`):
   - Server-side only
   - NEVER expose to client
   - Write access (create bookings, update settings)
   - Required for admin operations

**Key Generation:**

```typescript
// File: /server/src/lib/api-key.service.ts
generateKeyPair(slug: string) {
  const randomPart = generateRandomString(12);
  const publicKey = `pk_live_${slug}_${randomPart}`;

  const secretPart = crypto.randomBytes(16).toString('hex');
  const secretKey = `sk_live_${slug}_${secretPart}`;
  const secretKeyHash = bcrypt.hashSync(secretKey, 10);

  return { publicKey, secretKey, secretKeyHash };
}
```

**Key Storage:**

- Public keys: Stored in plaintext (Tenant.apiKeyPublic)
- Secret keys: Hashed with bcrypt (Tenant.apiKeySecret)
- Secret keys shown ONCE at creation (cannot retrieve later)

**Key Rotation:**

- Generate new key pair via CLI or API
- Update tenant record with new keys
- Notify tenant immediately
- Old keys invalid after update

---

### Revenue Model & Commission Calculation

**Platform Revenue Model:**

- Commission-based: 10-15% of each booking
- Calculated server-side (cannot be manipulated by client)
- Rounded UP to nearest cent (protects platform revenue)

**Commission Calculation:**

```typescript
// File: /server/src/services/commission.service.ts
calculateCommission(totalPrice: number, tenantId: string): number {
  const tenant = await tenantRepo.findById(tenantId);
  const rate = tenant.commissionPercent; // e.g., 10.0 = 10%

  const commission = (totalPrice * rate) / 100;
  return Math.ceil(commission); // Always round UP
}
```

**Example:**

- Booking total: $2,500 ($250,000 cents)
- Commission rate: 10%
- Platform commission: $250 ($25,000 cents)
- Tenant payout: $2,250 ($225,000 cents)

**Stripe Connect Integration:**

- Customer pays full amount ($2,500)
- Stripe routes to tenant's Stripe account
- Platform takes commission via application fee ($250)
- Tenant receives net amount ($2,250)

---

### Database Schema Key Points

**User Model (lines 15-34):**

- Supports both PLATFORM_ADMIN and TENANT_ADMIN roles
- `tenantId` field links tenant admins to their tenant
- Platform admins have `tenantId: null`

**Tenant Model (lines 36-92):**

- Stores API keys (public plaintext, secret hashed)
- Stores Stripe Connect account ID
- Stores commission percentage per tenant
- Stores branding configuration (colors, fonts, logo)
- Stores encrypted secrets (Stripe keys, etc.)

**Booking Model (lines 247-289):**

- Unique constraint: `@@unique([tenantId, date])` prevents double-booking
- Stores commission snapshot at booking time
- Linked to Stripe PaymentIntent ID

**WebhookEvent Model (lines 348-375):**

- Composite unique key: `[tenantId, eventId]` prevents cross-tenant hijacking
- Tracks processing status (PENDING, PROCESSED, FAILED, DUPLICATE)
- Stores raw payload for debugging

---

## Current Capabilities

### ✅ Fully Implemented

1. **Tenant Management:**
   - Create tenants via CLI or API
   - List all tenants with stats
   - View tenant details
   - Update tenant settings
   - Deactivate tenants (soft delete)

2. **Stripe Connect:**
   - Create connected accounts
   - Generate onboarding links
   - Check account status
   - Automatic application fee collection

3. **Authentication:**
   - Unified login (platform admin + tenant admin)
   - JWT-based authentication
   - Role-based access control
   - Token expiration (7 days)

4. **Platform Monitoring:**
   - System-wide statistics (revenue, bookings, tenants)
   - Health check endpoint
   - Environment validation (doctor script)

5. **Database Management:**
   - Schema migrations
   - Seeding
   - Prisma Studio (visual browser)

6. **Security:**
   - Multi-tenant data isolation (tenantId filtering)
   - API key management (public/secret pairs)
   - Rate limiting (login, admin routes)
   - Secret rotation procedures

### ⚠️ Partially Implemented

1. **Platform Admin Dashboard UI:**
   - Frontend exists (`PlatformAdminDashboard.tsx`)
   - Shows metrics and tenant list
   - Missing: Advanced filtering, bulk operations, tenant detail pages

2. **Monitoring & Alerting:**
   - Health check endpoint exists
   - Missing: Automated alerts, uptime monitoring integration

3. **Backup & Restore:**
   - Manual procedures documented
   - Missing: Automated backup scheduling, restore testing

### ❌ Not Implemented

1. **Tenant Analytics:**
   - No per-tenant revenue graphs
   - No booking trends analysis
   - No segment performance metrics

2. **Audit Logging (Platform-Level):**
   - ConfigChangeLog exists for config changes
   - Missing: Platform admin action logging (who created/updated tenants)

3. **Tenant Communication:**
   - No email notifications to tenants
   - No in-app messaging system

4. **Multi-Admin Support:**
   - Only one platform admin account
   - Missing: Multiple platform admin users with different permissions

5. **Tenant Self-Service Portal:**
   - Tenants must contact platform admin for some operations
   - Missing: Tenant-initiated Stripe Connect setup, API key rotation

---

## Common Pitfalls & Solutions

### Pitfall 1: Forgetting Tenant Scoping

**Problem:** Query returns data from all tenants (security vulnerability)

**Example:**

```typescript
// ❌ WRONG - No tenantId filter
const bookings = await prisma.booking.findMany({
  where: { status: 'CONFIRMED' },
});
```

**Solution:**

```typescript
// ✅ CORRECT - Always filter by tenantId
const bookings = await prisma.booking.findMany({
  where: { tenantId, status: 'CONFIRMED' },
});
```

**Detection:** Code review, automated tests, multi-tenant test fixtures

---

### Pitfall 2: Exposing Secret API Keys

**Problem:** Secret key leaked to client-side code or logs

**Example:**

```typescript
// ❌ WRONG - Sending secret key to client
res.json({
  tenant: {
    apiKeyPublic: tenant.apiKeyPublic,
    apiKeySecret: tenant.apiKeySecret, // ❌ NEVER!
  },
});
```

**Solution:**

```typescript
// ✅ CORRECT - Never return secret keys
res.json({
  tenant: {
    apiKeyPublic: tenant.apiKeyPublic,
    // Secret key omitted
  },
});
```

**Detection:** Code review, security audits, secret scanning tools

---

### Pitfall 3: Skipping Transaction Locks

**Problem:** Double-booking despite unique constraint (race condition)

**Example:**

```typescript
// ❌ WRONG - Check and insert separately (race condition)
const existing = await prisma.booking.findFirst({
  where: { tenantId, date }
});
if (existing) throw new Error('Date unavailable');

await prisma.booking.create({ data: { tenantId, date, ... } });
```

**Solution:**

```typescript
// ✅ CORRECT - Use transaction with pessimistic lock
await prisma.$transaction(async (tx) => {
  const existing = await tx.$queryRaw`
    SELECT id FROM bookings
    WHERE tenantId = ${tenantId} AND date = ${date}
    FOR UPDATE
  `;
  if (existing.length > 0) throw new Error('Date unavailable');

  await tx.booking.create({ data: { tenantId, date, ... } });
});
```

**Detection:** Load testing, race condition tests, production monitoring

---

### Pitfall 4: Forgetting to Regenerate Prisma Client

**Problem:** Schema changed but TypeScript types outdated

**Example:**

```bash
# Schema updated with new field
# BUT forgot to regenerate client

npm run dev:api
# TypeScript errors: Property 'newField' does not exist
```

**Solution:**

```bash
# Always regenerate after schema changes
npm exec prisma generate

# Or use migration which does this automatically
npm exec prisma migrate dev --name add_new_field
```

**Detection:** TypeScript compiler errors, CI/CD checks

---

## Quick Reference

### Essential Commands

```bash
# Environment validation
npm run doctor

# Database operations
cd server
npm exec prisma migrate dev --name <name>
npm exec prisma migrate deploy
npm exec prisma generate
npm exec prisma db seed
npm exec prisma studio

# Tenant management
npm run create-tenant -- --slug=<slug> --name="<name>"
npm run create-tenant-with-stripe -- --slug=<slug> --name="<name>" --email=<email>

# Development
npm run dev:api                    # API server (mock mode)
ADAPTERS_PRESET=real npm run dev:api  # API server (real mode)
npm run dev:client                 # React client
npm run dev:all                    # API + client + Stripe webhooks

# Testing
npm test                           # All server tests
npm run test:integration           # Integration tests
npm run test:e2e                   # Playwright E2E tests
```

### Key Endpoints

```bash
# Authentication
POST /v1/auth/login                # Unified login (platform admin + tenant admin)
GET  /v1/auth/verify               # Verify token

# Platform Admin - Tenant Management
GET    /v1/admin/tenants           # List all tenants
POST   /v1/admin/tenants           # Create tenant
GET    /v1/admin/tenants/:id       # Get tenant details
PUT    /v1/admin/tenants/:id       # Update tenant
DELETE /v1/admin/tenants/:id       # Deactivate tenant

# Platform Admin - Stripe Connect
POST /v1/admin/tenants/:id/stripe/connect     # Create account
POST /v1/admin/tenants/:id/stripe/onboarding  # Generate link
GET  /v1/admin/tenants/:id/stripe/status      # Check status

# Platform Admin - Statistics
GET /v1/admin/stats                # Platform-wide metrics

# Health Check
GET /health                        # System health (no auth)
```

### Configuration Files

```
/Users/mikeyoung/CODING/MAIS/
├── server/
│   ├── .env                        # Environment variables
│   ├── prisma/
│   │   ├── schema.prisma           # Database schema
│   │   ├── seed.ts                 # Seed script
│   │   └── migrations/             # Migration history
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.routes.ts      # Unified authentication
│   │   │   └── admin/
│   │   │       ├── tenants.routes.ts  # Tenant management
│   │   │       └── stripe.routes.ts   # Stripe Connect
│   │   ├── services/
│   │   │   ├── identity.service.ts    # Platform admin auth
│   │   │   └── tenant-auth.service.ts # Tenant admin auth
│   │   ├── middleware/
│   │   │   ├── auth.ts             # Platform admin auth
│   │   │   └── tenant.ts           # Tenant resolution
│   │   └── controllers/
│   │       └── platform-admin.controller.ts
│   └── scripts/
│       ├── create-tenant.ts        # CLI tenant creation
│       └── create-tenant-with-stripe.ts
├── client/src/pages/admin/
│   └── PlatformAdminDashboard.tsx  # Dashboard UI
└── docs/
    ├── operations/
    │   ├── RUNBOOK.md              # Operations guide
    │   └── INCIDENT_RESPONSE.md    # Incident playbook
    └── security/
        └── SECRET_ROTATION_GUIDE.md
```

---

## Future Roadmap

### Near-Term Enhancements (Sprint 11-12)

1. **Multi-Admin Support:**
   - Allow multiple platform admin users
   - Role-based permissions (view-only vs. full access)
   - Admin activity audit log

2. **Enhanced Tenant Analytics:**
   - Revenue graphs per tenant
   - Booking trends analysis
   - Segment performance metrics
   - Custom date range filtering

3. **Automated Monitoring:**
   - Uptime monitoring integration (Pingdom, UptimeRobot)
   - Error rate alerts (Sentry)
   - Stripe webhook failure notifications
   - Database performance alerts

4. **Tenant Self-Service:**
   - Tenant-initiated Stripe Connect setup
   - API key rotation via tenant dashboard
   - Billing/invoice access

### Long-Term Vision (2025)

1. **Agent-Admin Collaboration:**
   - AI agents propose config changes
   - Admin review UI with diff view
   - Automated approval workflows for low-risk changes

2. **Advanced Platform Operations:**
   - Blue-green deployments
   - A/B testing infrastructure
   - Feature flags per tenant
   - Multi-region deployment

3. **Business Intelligence:**
   - Cross-tenant benchmarking
   - Churn prediction
   - Revenue forecasting
   - Market analysis

---

## Appendix

### Related Documentation

- **Architecture Overview:** `/Users/mikeyoung/CODING/MAIS/ARCHITECTURE.md`
- **Multi-Tenant Guide:** `/Users/mikeyoung/CODING/MAIS/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`
- **Operations Runbook:** `/Users/mikeyoung/CODING/MAIS/docs/operations/RUNBOOK.md`
- **Security Guide:** `/Users/mikeyoung/CODING/MAIS/docs/security/SECURITY_SUMMARY.md`
- **API Documentation:** `http://localhost:3001/api/docs` (Swagger UI)

### Support & Troubleshooting

**Common Issues:**

- Port conflicts: Check `lsof -i :3001`, kill process if needed
- Database connection errors: Verify DATABASE_URL, check PostgreSQL running
- Prisma Client out of sync: Run `npm exec prisma generate`
- Migration conflicts: Check `prisma migrate status`, resolve manually

**Getting Help:**

- API Documentation: Swagger UI at `/api/docs`
- Codebase Guide: `CLAUDE.md` in repository root
- Project Architecture: `ARCHITECTURE.md`

---

**Document End**
