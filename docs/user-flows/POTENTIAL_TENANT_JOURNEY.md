# Potential Member (Prospect) Journey

**Document Version:** 2.0
**Last Updated:** January 10, 2026
**Status:** Current Implementation Analysis

---

## Executive Summary

This document maps the complete journey for potential members (service professionals interested in joining HANDLED) from initial awareness to becoming an active member. Based on a comprehensive codebase analysis, this outlines what's implemented, what's planned, and the technical architecture supporting each stage.

**Key Finding:** The HANDLED platform currently operates in a **platform admin-provisioned model**. There is NO self-service member signup flow. All member onboarding happens through CLI tools executed by platform administrators.

**Business Model:** HANDLED is a membership platform with a flat monthly fee. Standard members keep 100% of their bookings. The platform also supports commission-based pricing for custom arrangements.

---

## Table of Contents

1. [Persona Overview](#persona-overview)
2. [Journey Stages](#journey-stages)
3. [Current Implementation Status](#current-implementation-status)
4. [Technical Architecture](#technical-architecture)
5. [Gaps & Future Roadmap](#gaps--future-roadmap)
6. [Code References](#code-references)

---

## Persona Overview

### Who is a Potential Tenant?

A **potential tenant** is a small business owner or entrepreneur who:

- **Business Type:** Service-based businesses (wedding venues, event planners, consultants, wellness coaches, salon owners)
- **Pain Points:**
  - Drowning in admin work (scheduling, payments, bookings)
  - Losing leads to competitors with better tech
  - Wearing all the hats (sales, marketing, operations)
  - Lack technical skills for website/marketing automation
- **Goals:**
  - Increase revenue by 20-30%
  - Save 60+ hours/month on admin tasks
  - Professional web presence without hiring developers
  - Never miss a booking or payment
- **Decision Factors:**
  - Flat monthly membership (predictable cost, keep 100% of bookings)
  - Done-for-you tech + done-with-you education
  - Proven results from existing members
  - Quick setup (application to live in 1-2 weeks)

### Value Propositions

Based on the marketing homepage (`/Users/mikeyoung/CODING/MAIS/client/src/pages/Home.tsx`):

1. **Business Growth Accelerated:** Hands-on marketing, consulting, sales strategies powered by AI
2. **Seamless Scheduling & Bookings:** Eliminate double-bookings, missed payments, admin chaos
3. **Professional Website:** Design, launch, and maintain digital presence without dev skills

**Social Proof:**

- 50+ businesses using the platform
- $2M+ revenue managed through the system
- 4.9/5 member rating
- Average 30% revenue increase, 60+ hours/month saved

---

## Journey Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                    POTENTIAL TENANT JOURNEY                      │
└─────────────────────────────────────────────────────────────────┘

1. AWARENESS          →  2. CONSIDERATION    →  3. APPLICATION
   (Marketing)             (Research)             (Contact Sales)

   ↓                       ↓                       ↓

4. ADMIN PROVISIONING →  5. ONBOARDING       →  6. ACTIVATION
   (Platform Admin)        (Tenant Setup)         (First Booking)

   ↓                       ↓                       ↓

7. GROWTH             →  8. RETENTION         →  9. ADVOCACY
   (Ongoing Success)       (Commission Model)     (Referrals)
```

---

## Current Implementation Status

### Stage 1: Awareness (Marketing Pages)

**Status:** ✅ **IMPLEMENTED**

**What Exists:**

- Full marketing homepage with club positioning
- Three-pillar value proposition (growth, bookings, website)
- Testimonials from existing members
- Social proof metrics (50+ businesses, $2M+ revenue)
- Clear CTAs ("Browse Packages", "How It Works")

**Code Location:**
`/Users/mikeyoung/CODING/MAIS/client/src/pages/Home.tsx` (lines 1-477)

**Key Sections:**

- Hero section with gradient background and animated orbs (lines 14-63)
- "Club Advantage" three-pillar feature cards (lines 66-135)
- "Who Is This For?" persona targeting (lines 138-219)
- Testimonials with 5-star ratings (lines 222-301)
- Social proof statistics bar (lines 304-332)
- "How It Works" 3-step process (lines 335-403)
- Final CTA with application promise (lines 434-473)

**User Actions:**

- Read marketing content
- Click "Browse Packages" → redirects to `/packages`
- Click "Apply" or "Learn More" → no specific endpoint (generic email link)

**Gaps:**

- No dedicated "Apply Now" landing page
- No lead capture form for warm leads
- Email link (`mailto:support@maconai.com`) requires manual follow-up

---

### Stage 2: Consideration (Package Discovery)

**Status:** ✅ **PARTIALLY IMPLEMENTED**

**What Exists:**

- Public package catalog browsing (no authentication required)
- Segment-based package organization (e.g., "Wellness Retreat", "Micro-Wedding")
- Package details with photos, pricing, descriptions
- Widget embeddable on tenant websites (for end-customer bookings)

**Code Locations:**

- Package catalog grid: `/Users/mikeyoung/CODING/MAIS/client/src/features/catalog/CatalogGrid.tsx`
- Package detail page: `/Users/mikeyoung/CODING/MAIS/client/src/features/catalog/PackagePage.tsx`
- API contracts: `/Users/mikeyoung/CODING/MAIS/packages/contracts/`

**What's Missing:**

- No "membership packages" or "club tier" pricing page
- Prospects see service packages (for end-customers), not membership plans
- No clear differentiation between B2B (tenant signup) vs B2C (customer bookings)

---

### Stage 3: Application (Lead Capture)

**Status:** ❌ **NOT IMPLEMENTED**

**Current Reality:**

- Homepage mentions "5-minute application" and "24-hour review"
- No application form exists in the codebase
- CTAs lead to generic email or package browsing
- No lead capture/tracking system

**Expected Flow (Not Built):**

1. Prospect clicks "Apply to Join" CTA
2. Fills out application form:
   - Business name
   - Business type (dropdown)
   - Current revenue/bookings per month
   - Pain points (checkboxes)
   - Contact email/phone
3. Application submitted to database
4. Admin notification sent
5. Auto-reply email with "We'll review within 24 hours"

**Database Model (Not Present):**
No `Application` or `Lead` model in Prisma schema (`/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma`)

---

### Stage 4: Admin Provisioning (Tenant Creation)

**Status:** ✅ **FULLY IMPLEMENTED** (CLI-based)

**How It Works Today:**

Platform administrators manually create tenants using CLI scripts after sales approval.

#### Tool 1: Basic Tenant Creation

**File:** `/Users/mikeyoung/CODING/MAIS/server/scripts/create-tenant.ts`

**Command:**

```bash
pnpm create-tenant --slug=bellaweddings --name="Bella Weddings" --commission=10.0
```

**What It Does:**

1. Validates slug availability (lines 109-117)
2. Generates API key pair (lines 120-125)
   - Public key: `pk_live_bellaweddings_a3f8c9d2e1b4f7g8` (client-safe)
   - Secret key: `sk_live_bellaweddings_a3f8c9d2e1b4f7g8h9i0j1k2l3m4n5o6` (admin-only, shown ONCE)
3. Creates tenant in database (lines 128-136)
4. Outputs tenant ID, API keys, commission rate (lines 140-171)

**Security:**

- Secret key hashed with SHA-256 before storage (never plaintext)
- Uses `apiKeyService` for secure key generation
- File: `/Users/mikeyoung/CODING/MAIS/server/src/lib/api-key.service.ts`

#### Tool 2: Tenant Creation with Stripe Connect

**File:** `/Users/mikeyoung/CODING/MAIS/server/scripts/create-tenant-with-stripe.ts`

**Command:**

```bash
pnpm create-tenant-with-stripe \
  --slug=bellaweddings \
  --name="Bella Weddings" \
  --commission=12.5 \
  --email=owner@bellaweddings.com \
  --password=secure123 \
  --primaryColor="#7C3AED" \
  --fontFamily="Playfair Display"
```

**What It Does:**

1. All steps from Tool 1 (tenant + API keys)
2. Creates Stripe Connect Express account (lines 228-234)
   - Uses `StripeConnectService.createConnectedAccount()`
   - Stores `stripeAccountId` in database
3. Generates Stripe onboarding link (lines 237-243)
   - 1-hour expiration
   - Returns URL for tenant to complete KYC/bank details
4. Optionally sets branding colors (lines 211-224)
5. Optionally sets tenant admin password (line 312)

**Stripe Connect Architecture:**

- **Account Type:** Stripe Express (Stripe handles compliance, payouts)
- **Payment Flow:** Customer pays → Tenant receives funds → Platform takes commission via `application_fee_amount`
- **File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/stripe-connect.service.ts` (lines 56-112)

#### Admin API Endpoints

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/admin/tenants.routes.ts`

Protected routes (require admin authentication):

| Method   | Endpoint                    | Purpose                                                    |
| -------- | --------------------------- | ---------------------------------------------------------- |
| `GET`    | `/api/v1/admin/tenants`     | List all tenants with stats (lines 27-73)                  |
| `POST`   | `/api/v1/admin/tenants`     | Create new tenant (returns secret key ONCE) (lines 89-136) |
| `GET`    | `/api/v1/admin/tenants/:id` | Get tenant details (lines 142-187)                         |
| `PUT`    | `/api/v1/admin/tenants/:id` | Update tenant settings (lines 200-234)                     |
| `DELETE` | `/api/v1/admin/tenants/:id` | Deactivate tenant (lines 240-249)                          |

**Stripe-Specific Admin Routes:**

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/admin/stripe.routes.ts`

| Method | Endpoint                                      | Purpose                                     |
| ------ | --------------------------------------------- | ------------------------------------------- |
| `POST` | `/api/v1/admin/tenants/:id/stripe/connect`    | Create Stripe Connect account (lines 55-95) |
| `POST` | `/api/v1/admin/tenants/:id/stripe/onboarding` | Generate onboarding link (lines 109-150)    |
| `GET`  | `/api/v1/admin/tenants/:id/stripe/status`     | Check Stripe account status (lines 166-202) |

**What Happens:**

1. Admin creates tenant (CLI or API)
2. Tenant receives email with:
   - Public API key (for widget embedding)
   - Secret API key (for admin operations) - **SHOWN ONCE**
   - Stripe onboarding link (1-hour expiration)
   - Login credentials for tenant dashboard

---

### Stage 5: Onboarding (Tenant Setup)

**Status:** ✅ **PARTIALLY IMPLEMENTED**

#### 5A. Stripe Connect Onboarding

**What Happens:**

1. Tenant clicks Stripe onboarding link (from admin)
2. Stripe-hosted flow collects:
   - Business details (name, address, EIN)
   - Bank account information
   - Identity verification (KYC)
   - Terms of Service acceptance
3. Redirect back to platform after completion
4. Platform checks onboarding status via API

**Code:**

- Service: `/Users/mikeyoung/CODING/MAIS/server/src/services/stripe-connect.service.ts`
  - `createOnboardingLink()` (lines 124-151)
  - `checkOnboardingStatus()` (lines 160-196)
- Database: `stripeOnboarded` boolean flag on `Tenant` model (line 67 of schema)

**Status Checks:**

- `chargesEnabled: true` → Can accept payments
- `payoutsEnabled: true` → Can receive payouts
- `detailsSubmitted: true` → KYC complete

#### 5B. Tenant Admin Dashboard Access

**Status:** ✅ **IMPLEMENTED**

Tenants log in to manage their business settings.

**Authentication:**

- **Login Endpoint:** `POST /v1/tenant-auth/login`
- **File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-auth.routes.ts` (lines 69-93)
- **Credentials:** Email + password (set during provisioning or via admin)

**Login Flow:**

1. Tenant submits email + password
2. `TenantAuthService.login()` validates credentials (lines 26-63 in service file)
3. JWT token generated with payload:
   ```typescript
   {
     tenantId: string,
     slug: string,
     email: string,
     type: 'tenant'
   }
   ```
4. Token expires in 7 days
5. All subsequent requests use `Authorization: Bearer <token>` header

**Protected by Rate Limiting:**

- 5 login attempts per 15 minutes per IP
- Middleware: `/Users/mikeyoung/CODING/MAIS/server/src/middleware/rateLimiter.ts`

#### 5C. Initial Configuration

**What Tenants Can Configure:**

**Branding/Theme:**

- Primary color (hex)
- Secondary color (hex)
- Accent color (hex)
- Background color (hex)
- Font family
- Logo upload

**Database Schema:**

```prisma
model Tenant {
  primaryColor    String @default("#1a365d") // Macon Navy
  secondaryColor  String @default("#fb923c") // Macon Orange
  accentColor     String @default("#38b2ac") // Macon Teal
  backgroundColor String @default("#ffffff") // White
  branding        Json   @default("{}") // {fontFamily, logo}
}
```

**File:** `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma` (lines 58-64)

**Business Segments:**

- Create customer-facing "routes" (e.g., "Wellness Retreats", "Micro-Weddings")
- Each segment has its own landing page, hero image, packages
- **Example:** Little Bit Farm might have:
  - Segment 1: "Wellness Retreats" (yoga, meditation packages)
  - Segment 2: "Weekend Getaways" (romantic escape packages)
  - Segment 3: "Micro-Weddings" (intimate ceremony packages)

**Packages:**

- Create/edit service packages (name, price, description)
- Upload up to 5 photos per package
- Assign packages to segments
- Set active/inactive status

**Add-Ons:**

- Create optional extras (e.g., "Photography +$500", "Catering +$1200")
- Link add-ons to specific packages or make global

**Blackout Dates:**

- Mark dates unavailable for bookings
- Prevents double-bookings on holidays/maintenance days

**Dashboard UI:**

- File: `/Users/mikeyoung/CODING/MAIS/client/src/pages/tenant/TenantAdminDashboard.tsx`
- Features:
  - Revenue metrics
  - Recent bookings list
  - Package manager
  - Branding editor
  - Blackout calendar

---

### Stage 6: Activation (First Customer Booking)

**Status:** ✅ **FULLY IMPLEMENTED**

#### Widget Embedding

Tenants embed the booking widget on their existing website using a JavaScript snippet:

```html
<script src="https://mais-platform.com/widget.js"></script>
<script>
  MaisWidget.init({
    apiKey: 'pk_live_bellaweddings_a3f8c9d2e1b4f7g8',
    target: '#booking-widget',
    theme: 'auto', // Fetches tenant branding from API
  });
</script>
```

**Widget Architecture:**

- **Loader:** JavaScript SDK (`/Users/mikeyoung/CODING/MAIS/client/src/widget-main.tsx`)
- **Container:** Sandboxed iframe with PostMessage communication
- **Branding:** Dynamically fetched via API using public key
- **Security:** CSP headers, origin validation, CORS restrictions

**Customer Booking Flow:**

1. Customer browses packages on tenant's website (via widget)
2. Selects package, date, add-ons
3. Enters contact info (name, email, phone)
4. Checkout with Stripe payment
5. Booking confirmed, calendar updated, email sent

**Backend Processing:**
**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/booking.service.ts`

**Key Features:**

- **Double-Booking Prevention:** Three-layer defense (database constraint, pessimistic locking, graceful errors)
- **Transaction Safety:** `SELECT FOR UPDATE` within Prisma transactions (lines 89-121)
- **Availability Checking:** Real-time query against `Booking` and `BlackoutDate` tables

**Payment Processing:**
**File:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/stripe.adapter.ts`

**Flow:**

1. Create Stripe PaymentIntent with `application_fee_amount` (platform commission)
2. Customer completes payment via Stripe Checkout
3. Webhook updates booking status to `CONFIRMED`
4. Funds transferred: Customer → Tenant (direct) → Platform (commission)

**Commission Calculation:**

```typescript
const tenantAmount = totalPrice;
const commissionAmount = Math.round(totalPrice * (commissionPercent / 100));
const platformReceives = commissionAmount;
```

**Stored in Database:**

```prisma
model Booking {
  totalPrice        Int     // $500.00 = 50000 cents
  commissionAmount  Int     // $50.00 = 5000 cents (10% commission)
  commissionPercent Decimal // 10.0 (snapshot at booking time)
}
```

---

### Stage 7: Growth (Ongoing Success)

**Status:** ⚠️ **PARTIALLY IMPLEMENTED**

**What's Built:**

- Revenue metrics on tenant dashboard
- Booking history and trends
- Package performance analytics

**What's Missing:**

- AI-powered insights (mentioned in marketing, not built)
- Proactive recommendations from "AI strategist"
- A/B testing for package descriptions
- Seasonal promotion suggestions
- Conversion rate optimization tools

**Marketing Claims vs Reality:**

| Marketing Promise         | Implementation Status                                             |
| ------------------------- | ----------------------------------------------------------------- |
| "AI consulting"           | ❌ Not implemented (no agent proposals, no automation)            |
| "Dedicated AI strategist" | ❌ No AI agent system exists                                      |
| "Marketing automation"    | ⚠️ Partial (email confirmations only)                             |
| "Sales-driven strategies" | ❌ No CRM, lead nurturing, or sales tools                         |
| "Website builds"          | ⚠️ Tenant can embed widget, but platform doesn't build full sites |

**Future Vision (from Architecture Docs):**

**Config-Driven Architecture** (planned for 2025):

- AI agents propose configuration changes (e.g., "Feature 'Wellness Retreat' package this month")
- Tenant reviews and approves agent proposals via dashboard
- All changes versioned with audit trail
- Rollback to previous configurations with one click

**File:** `/Users/mikeyoung/CODING/MAIS/ARCHITECTURE.md` (lines 36-100)

**Database Models (Not Yet Created):**

```prisma
model ConfigVersion {
  id              String   @id @default(cuid())
  tenantId        String
  status          VersionStatus // draft, published, archived
  config          Json
  publishedAt     DateTime?
  publishedBy     String?
}

model AgentProposal {
  id              String   @id @default(cuid())
  tenantId        String
  proposalType    String  // 'display_rule', 'pricing_change', 'promotion'
  status          ProposalStatus // pending, approved, rejected
  changes         Json    // { before: {}, after: {} }
  reasoning       String
  reviewedAt      DateTime?
  reviewedBy      String?
}
```

---

### Stage 8: Retention (Membership Model)

**Status:** ✅ **FULLY IMPLEMENTED**

**Membership Model:**

- **Flat Monthly Fee:** Members pay one predictable monthly membership fee
- **Keep 100% of Bookings:** Standard members keep all their booking revenue
- **Commission Option:** Platform supports percentage-based pricing for custom arrangements
- **All-Inclusive:** Optimized storefront, booking, AI chatbot, newsletters, and Zoom calls included
- **Cancel Anytime:** No long-term contracts required

**Database:**

```prisma
model Tenant {
  commissionPercent Decimal @default(10.0) @db.Decimal(5, 2)
}

model Booking {
  totalPrice        Int     // Customer pays this
  commissionAmount  Int     // Platform's cut (calculated at booking time)
  commissionPercent Decimal // Snapshot of rate (for historical accuracy)
}
```

**Payout Flow:**

1. Customer pays $500 for booking
2. Stripe routes $450 to tenant's bank account (90%)
3. Stripe routes $50 to platform (10% commission)
4. Tenant receives payout within 2-7 business days (Stripe standard)

**Platform Revenue Tracking:**

- Sum all `commissionAmount` across all bookings
- Filter by date range, tenant, status (`CONFIRMED` only)
- No separate billing/invoicing system needed

**Tenant Dashboard:**

- Shows gross revenue (total bookings)
- Shows net revenue (after commission)
- Transparency builds trust

---

### Stage 9: Advocacy (Referrals)

**Status:** ❌ **NOT IMPLEMENTED**

**Marketing Promise:**

- Testimonials showcase happy members
- Social proof on homepage

**What's Missing:**

- No referral program or incentives
- No affiliate tracking system
- No case studies or detailed success stories
- No NPS (Net Promoter Score) tracking
- No automated review requests post-booking

**Opportunity:**

- Implement referral codes (e.g., `bellaweddings-referral`)
- Track signups from referral links
- Reward referring tenants (e.g., 1 month reduced commission)
- Showcase top-performing tenants as case studies

---

## Technical Architecture

### Multi-Tenant Data Isolation

**Critical Pattern:** ALL database queries MUST filter by `tenantId` to prevent cross-tenant data leakage.

**Prisma Schema:**

```prisma
model Package {
  id       String @id @default(cuid())
  tenantId String // CRITICAL: Tenant isolation
  slug     String
  name     String
  price    Int

  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, slug]) // Unique WITHIN tenant, not globally
  @@index([tenantId, active])
}
```

**Repository Pattern:**
All repository methods require `tenantId` as first parameter.

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/ports.ts`

```typescript
interface CatalogRepository {
  getPackages(tenantId: string): Promise<Package[]>;
  getPackageBySlug(tenantId: string, slug: string): Promise<Package>;
}
```

**Security Rules:**

1. ✅ **Correct:** `prisma.package.findMany({ where: { tenantId, active: true } })`
2. ❌ **WRONG:** `prisma.package.findMany({ where: { active: true } })` (returns ALL tenants' packages)

### Tenant Resolution Flow

```
Client Request
    ↓
┌─────────────────────────────────────────┐
│ Header: X-Tenant-Key: pk_live_...      │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Tenant Middleware                       │
│ /server/src/middleware/tenant.ts        │
│                                         │
│ 1. Extract API key from header         │
│ 2. Query: Tenant.findByApiKey(key)     │
│ 3. Validate tenant.isActive === true   │
│ 4. Inject req.tenantId                 │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Route Handler                           │
│ Uses req.tenantId for all queries      │
└─────────────────────────────────────────┘
```

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/middleware/tenant.ts`

### API Key Security

**Format:**

- Public Key: `pk_live_{tenant_slug}_{random_16_chars}`
- Secret Key: `sk_live_{tenant_slug}_{random_32_chars}`

**Generation:**
**File:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/api-key.service.ts` (lines 36-86)

**Storage:**

- Public key: Stored in plaintext (safe to expose)
- Secret key: SHA-256 hashed before storage (never plaintext in DB)

**Usage:**

- Public key: Widget embedding, catalog API, booking creation (read-only)
- Secret key: Admin operations (create packages, update settings, manage blackouts)

**Validation:**

```typescript
// Format check (regex)
isValidPublicKeyFormat(key: string): boolean {
  return /^pk_live_[a-z0-9-]+_[a-f0-9]{16}$/.test(key);
}

// Secret key verification (constant-time comparison)
verifySecretKey(secretKey: string, hash: string): boolean {
  const inputHash = this.hashSecretKey(secretKey);
  return crypto.timingSafeEqual(
    Buffer.from(inputHash, 'hex'),
    Buffer.from(hash, 'hex')
  );
}
```

### Stripe Connect Integration

**Architecture Decision:** Express Connected Accounts

**Why Express?**

- Stripe handles KYC, compliance, tax reporting
- Tenant receives funds directly (not held by platform)
- Platform automatically receives commission via `application_fee_amount`
- Simplified onboarding flow (Stripe-hosted)

**Account Creation:**

```typescript
const account = await stripe.accounts.create({
  type: 'express',
  country: 'US',
  email: 'owner@tenant.com',
  business_type: 'individual',
  business_profile: {
    name: 'Bella Weddings',
    product_description: 'Wedding and event booking services',
  },
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
});
```

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/stripe-connect.service.ts` (lines 82-95)

**Payment Intent with Commission:**

```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 50000, // $500.00 in cents
  currency: 'usd',
  application_fee_amount: 5000, // $50.00 platform commission
  transfer_data: {
    destination: tenantStripeAccountId,
  },
});
```

**Webhook Idempotency:**
Stripe webhooks use database-backed deduplication.

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/webhooks.routes.ts`

```prisma
model WebhookEvent {
  id          String        @id @default(uuid())
  tenantId    String
  eventId     String        // Stripe event ID
  eventType   String
  rawPayload  String        @db.Text
  status      WebhookStatus @default(PENDING)
  attempts    Int           @default(1)
  processedAt DateTime?

  @@unique([tenantId, eventId]) // Prevents duplicate processing
}
```

**Security:** `@@unique([tenantId, eventId])` prevents webhook replay attacks across tenants.

### Cache Isolation

**Critical Rule:** Cache keys MUST include `tenantId` to prevent cross-tenant data leakage.

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/cache.ts`

```typescript
// ✅ CORRECT
const key = `catalog:${tenantId}:packages`;
await cache.set(key, packages);

// ❌ WRONG (leaks data between tenants)
const key = 'catalog:packages';
await cache.set(key, packages);
```

**Cache Adapter:**

- **Mock Mode:** In-memory Map (development)
- **Real Mode:** Redis with TTL and key namespacing

**Performance Impact:**

- Cache hit response time: ~5ms
- Database query time: ~200ms
- **97.5% faster** with caching enabled
- **70% reduction** in database load

---

## Gaps & Future Roadmap

### Critical Gaps

#### 1. Self-Service Tenant Signup (HIGH PRIORITY)

**Current State:** Manual provisioning by platform admins
**Target State:** Automated signup flow

**Implementation Plan:**

**Phase 1: Lead Capture (Week 1-2)**

- Create `/apply` landing page
- Build application form with validation
- Store applications in new `Application` model
- Send confirmation email + admin notification

**Database Schema:**

```prisma
model Application {
  id              String   @id @default(cuid())
  businessName    String
  businessType    String
  contactEmail    String   @unique
  contactPhone    String?
  currentRevenue  String   // Range: "$0-10k", "$10k-50k", etc.
  painPoints      String[] // Array of checkboxes
  status          ApplicationStatus @default(PENDING)
  reviewedAt      DateTime?
  reviewedBy      String?
  notes           String?
  createdAt       DateTime @default(now())
}

enum ApplicationStatus {
  PENDING
  APPROVED
  REJECTED
  CONVERTED // Became a tenant
}
```

**Phase 2: Admin Review Dashboard (Week 3-4)**

- Build admin UI to review applications
- One-click "Approve" → triggers tenant creation flow
- Automated email to approved prospects with next steps

**Phase 3: Self-Service Onboarding (Week 5-8)**

- Approved prospects receive onboarding link
- Multi-step wizard:
  1. Choose slug + business details
  2. Set branding (colors, logo)
  3. Connect Stripe (OAuth or guided flow)
  4. Create first package
  5. Get widget embed code
- Automated email with API keys (shown once)

**Files to Create:**

- `client/src/pages/Apply.tsx` (application form)
- `server/src/routes/applications.routes.ts` (application API)
- `server/prisma/migrations/add_application_model.sql`
- `client/src/pages/admin/ApplicationReview.tsx` (admin dashboard)

#### 2. AI Agent System (MEDIUM PRIORITY)

**Current State:** Marketing promises AI, but no agent system exists
**Target State:** Agent proposals for tenant config changes

**Implementation Plan:**

**File:** `/Users/mikeyoung/CODING/MAIS/ARCHITECTURE.md` (lines 36-100)

**Sprint 2: Foundation (Week 1-4)**

- Build `ConfigChangeLog` table with full audit trail
- Remove all `as any` casts, add Zod schemas
- Core test suite (70% coverage)

**Sprint 3: Versioning (Week 5-8)**

- Create `ConfigVersion` schema (draft/published states)
- Build versioning API (create, publish, rollback)
- Widget config hydration via PostMessage

**Sprint 4: Agent Interface (Week 9-12)**

- Create `AgentProposal` table
- Build agent API with rate limiting
- Admin proposal review UI with diff view
- Display rules configuration

**Example Agent Proposal:**

```json
{
  "proposalType": "seasonal_promotion",
  "reasoning": "April is wedding season. Featuring 'Micro-Wedding' package increases bookings by 40% based on historical data.",
  "changes": {
    "before": {
      "packages.micro-wedding.featured": false
    },
    "after": {
      "packages.micro-wedding.featured": true,
      "packages.micro-wedding.tagline": "🌸 Spring Special: 15% Off Micro-Weddings"
    }
  },
  "status": "pending"
}
```

**Admin Reviews:**

- View proposal in dashboard
- See side-by-side diff
- Click "Approve" or "Reject" with notes
- Approved proposals publish automatically

#### 3. Marketing Automation (LOW PRIORITY)

**Current State:** Basic email confirmations
**Target State:** Full marketing funnel

**Features to Build:**

- Lead nurturing sequences (email drip campaigns)
- Automated follow-ups for abandoned applications
- Post-booking review requests (NPS tracking)
- Seasonal campaign suggestions
- A/B testing for package descriptions
- Analytics dashboard with conversion funnels

**Integration Points:**

- Email provider: Postmark (already integrated)
- Analytics: Segment or Mixpanel
- A/B testing: Custom implementation or LaunchDarkly

#### 4. Referral Program (LOW PRIORITY)

**Current State:** No tracking or incentives
**Target State:** Viral growth loop

**Implementation:**

- Referral code generation (e.g., `BELLA15`)
- Tracking: `signups.referralCode = 'BELLA15'`
- Rewards: 1 month reduced commission for successful referrals
- Dashboard showing referral stats
- Shareable referral links

**Database:**

```prisma
model Tenant {
  referralCode       String?  @unique
  referredBy         String?  // Other tenant's ID
  referralRewardUsed Boolean  @default(false)
}
```

---

## Code References

### Key Files for Tenant Journey

**Frontend (Client):**

```
/Users/mikeyoung/CODING/MAIS/client/src/
├── pages/
│   ├── Home.tsx                               # Marketing homepage (lines 1-477)
│   └── tenant/
│       └── TenantAdminDashboard.tsx           # Tenant dashboard
├── features/
│   ├── catalog/
│   │   ├── CatalogGrid.tsx                    # Package browsing
│   │   └── PackagePage.tsx                    # Package details
│   └── tenant-admin/
│       ├── BrandingEditor.tsx                 # Theme customization
│       ├── TenantPackagesManager.tsx          # Package CRUD
│       └── BlackoutsManager.tsx               # Blackout calendar
└── widget/
    ├── WidgetApp.tsx                          # Embeddable widget entry
    └── WidgetPackagePage.tsx                  # Widget package view
```

**Backend (Server):**

```
/Users/mikeyoung/CODING/MAIS/server/
├── scripts/
│   ├── create-tenant.ts                       # Basic tenant CLI (lines 1-206)
│   └── create-tenant-with-stripe.ts           # Full onboarding CLI (lines 1-365)
├── src/
│   ├── routes/
│   │   ├── admin/
│   │   │   ├── tenants.routes.ts              # Admin tenant CRUD (lines 1-253)
│   │   │   └── stripe.routes.ts               # Stripe Connect admin (lines 1-205)
│   │   ├── tenant-auth.routes.ts              # Tenant login (lines 1-123)
│   │   └── tenant.routes.ts                   # Tenant branding API (lines 1-40)
│   ├── services/
│   │   ├── tenant-auth.service.ts             # JWT auth (lines 1-102)
│   │   ├── stripe-connect.service.ts          # Stripe integration (lines 1-361)
│   │   └── booking.service.ts                 # Booking logic with locking
│   ├── adapters/
│   │   └── prisma/
│   │       └── tenant.repository.ts           # Tenant data access (lines 1-178)
│   ├── lib/
│   │   └── api-key.service.ts                 # API key generation (lines 1-275)
│   └── middleware/
│       ├── tenant.ts                          # Tenant resolution
│       └── tenant-auth.ts                     # JWT validation
└── prisma/
    └── schema.prisma                          # Database schema
        ├── Tenant model (lines 37-92)
        ├── Package model (lines 172-209)
        ├── Booking model (lines 247-289)
        └── WebhookEvent model (lines 348-368)
```

**Documentation:**

```
/Users/mikeyoung/CODING/MAIS/
├── ARCHITECTURE.md                            # System overview (lines 1-100)
├── CLAUDE.md                                  # Developer guide
├── docs/
│   ├── README.md                              # Documentation hub
│   ├── multi-tenant/
│   │   └── MULTI_TENANT_IMPLEMENTATION_GUIDE.md
│   ├── roadmaps/
│   │   └── EMBEDDABLE_MULTI_TENANT_IMPLEMENTATION_PLAN.md
│   └── security/
│       └── SECRET_ROTATION_GUIDE.md
```

---

## Conclusion

### What's Working Well

1. ✅ **Solid Technical Foundation:** Multi-tenant isolation, secure API keys, Stripe Connect integration
2. ✅ **Professional Marketing:** Clear value props, social proof, compelling CTAs
3. ✅ **Robust Booking System:** Race condition prevention, transaction safety, webhook idempotency
4. ✅ **Member Self-Management:** Dashboard for packages, branding, blackouts
5. ✅ **Membership Model:** Flat monthly fee, members keep 100% of bookings

### What Needs Attention

1. ❌ **No Self-Service Signup:** Manual provisioning creates bottleneck, limits scale
2. ❌ **AI Promises Unfulfilled:** Marketing mentions AI heavily, but no agent system exists
3. ⚠️ **Marketing Automation Gap:** Only basic emails, no drip campaigns or lead nurturing
4. ❌ **No Referral Program:** Missing viral growth mechanic
5. ⚠️ **B2B vs B2C Confusion:** Package catalog shows B2C services, not B2B membership plans

### Recommended Next Steps

**Phase 1 (Immediate - 4 weeks):**

1. Build lead capture form on `/apply` page
2. Create `Application` database model
3. Admin review dashboard for applications
4. Automated email flow for approved prospects

**Phase 2 (Short Term - 8 weeks):**

1. Self-service onboarding wizard for approved prospects
2. Automated Stripe Connect OAuth flow
3. First-package creation wizard
4. Email drip campaigns for new tenants

**Phase 3 (Medium Term - 12 weeks):**

1. Build agent proposal system (if AI positioning continues)
2. Implement config versioning
3. Create agent API with rate limiting
4. Admin review UI for agent proposals

**Phase 4 (Long Term - 16+ weeks):**

1. Full marketing automation suite
2. Referral program with tracking
3. Advanced analytics dashboard
4. White-label website builder (if marketing promises persist)

---

**Document Maintainer:** Platform Team
**Review Cycle:** Quarterly
**Last Reviewed:** November 21, 2025
**Next Review:** February 21, 2026
