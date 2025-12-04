# ELOPE PRODUCTION LAUNCH READINESS CHECKLIST

**Analysis Date:** November 14, 2025
**Current Status:** 🟢 CORE SYSTEMS READY - FEATURE GAPS IDENTIFIED
**Overall Risk Level:** MEDIUM (Features blocking launch identified)

---

## EXECUTIVE SUMMARY

Elope's multi-tenant architecture is **production-ready** with comprehensive tenant isolation, data protection, and operational stability. However, **CRITICAL CUSTOMER-FACING AND COMPLIANCE FEATURES ARE MISSING** that are essential before production launch.

### Key Findings:

- ✅ **Multi-tenant architecture:** Fully implemented and tested (75.6% test coverage)
- ✅ **Admin capabilities:** Platform and tenant admin separation complete
- ✅ **Payment processing:** Stripe Connect fully integrated with refund support
- ❌ **Customer features:** Portal, cancellations, email confirmations - MISSING
- ❌ **Compliance:** GDPR, privacy policies, Terms of Service - NOT IMPLEMENTED
- ❌ **Monitoring:** Error tracking per tenant, audit trails incomplete

---

## 1. TENANT FEATURES

### 1.1 Subdomain Routing (tenant1.domain.com)

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** CRITICAL
**Effort:** 2-3 days

**Current State:**

- Tenant identification via `X-Tenant-Key` header (API key)
- No subdomain-based routing support
- Client embeds API key statically in request headers

**Required Implementation:**

- Express subdomain middleware to extract tenant from hostname
- Tenant lookup by subdomain slug (e.g., "tenant1" from "tenant1.example.com")
- Dynamic tenant resolution for white-label deployment
- CORS configuration for tenant-specific subdomains
- SSL certificate management (wildcard or SNI)

**File Locations to Modify:**

- `server/src/middleware/tenant.ts` - Add subdomain extraction
- `server/src/app.ts` - Add subdomain middleware before existing tenant middleware
- Infrastructure setup for wildcard DNS/subdomains
- Environment configuration for base domain

**Blocker:** Yes - White-label functionality requires this

---

### 1.2 Custom Homepage Per Tenant

**Status:** 🟡 PARTIALLY IMPLEMENTED
**Criticality:** CRITICAL
**Effort:** 1-2 days

**Current State:**

- Tenant branding stored in `Tenant.branding` JSON field
- Colors, fonts, logo URL supported
- **Missing:** Customizable homepage layout, hero sections, custom pages

**Required Implementation:**

- ConfigVersion system for tenant homepage configuration
- Homepage template builder or JSON schema
- Custom blocks (hero, features, testimonials, CTA)
- Page preview system
- Homepage route (`/` for tenant) that serves customized content

**Database Schema Changes:**

```sql
ALTER TABLE "Tenant" ADD COLUMN "homepageConfig" JSON;
CREATE TABLE "HomepageBlock" (
  id STRING PRIMARY KEY,
  tenantId STRING,
  blockType STRING, -- 'hero', 'features', 'testimonials', 'cta'
  content JSON,
  order INT,
  createdAt DateTime,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id)
);
```

**File Locations to Modify:**

- `server/prisma/schema.prisma` - Add HomepageBlock model
- `server/src/services/tenant.service.ts` - Create homepage configuration service
- `client/src/pages/TenantHomepage.tsx` - Create white-label homepage renderer
- `server/src/routes/tenant.routes.ts` - Add homepage endpoints

**Blocker:** Yes - Required for white-label branding

---

### 1.3 Tenant-Specific Email Templates

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** CRITICAL
**Effort:** 2-3 days

**Current State:**

- Hardcoded email templates in `PostmarkMailAdapter`
- No tenant customization (colors, branding, signature)
- Simple text-based confirmation emails only

**Required Implementation:**

- Template management system (CRUD endpoints)
- Email template builder with preview
- Template variables ({{bookingDate}}, {{coupleName}}, etc.)
- Tenant branding integration (logo, colors)
- Multiple email types:
  - Booking confirmation
  - Cancellation confirmation
  - Refund notification
  - Reminder emails (1 week before event)
  - Post-wedding thank you

**Database Schema Changes:**

```sql
CREATE TABLE "EmailTemplate" (
  id STRING PRIMARY KEY,
  tenantId STRING,
  templateType STRING, -- 'booking_confirmation', 'cancellation', 'refund', 'reminder', 'thank_you'
  subject STRING,
  htmlContent TEXT,
  textContent TEXT,
  variables JSON, -- List of available variables
  createdAt DateTime,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id),
  @@unique([tenantId, templateType])
);
```

**File Locations to Modify:**

- `server/prisma/schema.prisma` - Add EmailTemplate model
- `server/src/services/email-template.service.ts` - NEW - Template management
- `server/src/adapters/postmark.adapter.ts` - Load templates from database
- `server/src/routes/tenant-admin.routes.ts` - Add template CRUD endpoints
- `client/src/features/tenant-admin/EmailTemplateEditor.tsx` - NEW - Template builder

**Blocker:** Yes - Customers expect branded emails

---

### 1.4 Tenant-Customizable Booking Flow

**Status:** 🟡 PARTIALLY IMPLEMENTED
**Criticality:** HIGH
**Effort:** 3-5 days

**Current State:**

- Fixed booking flow: Select package → Pick date → Enter email
- Branding customization (colors, fonts) only
- No custom fields, conditional logic, or workflow variants

**Required Implementation:**

- Booking form builder (fields, conditional visibility, validation)
- Custom field types (text, dropdown, checkbox, date picker)
- Conditional logic (show field if another field = value)
- Optional fields vs required
- Pre-booking questionnaire
- Post-booking survey

**Database Schema Changes:**

```sql
CREATE TABLE "BookingFormField" (
  id STRING PRIMARY KEY,
  tenantId STRING,
  fieldType STRING, -- 'text', 'email', 'phone', 'dropdown', 'checkbox', 'date'
  label STRING,
  placeholder STRING,
  required BOOLEAN,
  order INT,
  options JSON, -- For dropdown/radio
  conditionalLogic JSON, -- Show if...
  createdAt DateTime,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id)
);

CREATE TABLE "BookingResponse" (
  id STRING PRIMARY KEY,
  bookingId STRING,
  fieldId STRING,
  value STRING,
  createdAt DateTime,
  FOREIGN KEY (bookingId) REFERENCES Booking(id),
  FOREIGN KEY (fieldId) REFERENCES BookingFormField(id)
);
```

**File Locations to Modify:**

- `server/prisma/schema.prisma` - Add BookingFormField and BookingResponse models
- `server/src/services/booking-form.service.ts` - NEW
- `client/src/features/booking/CustomBookingForm.tsx` - NEW - Form renderer
- `client/src/features/tenant-admin/BookingFormBuilder.tsx` - NEW - Form builder
- `server/src/routes/tenant-admin.routes.ts` - Add form CRUD endpoints

**Blocker:** Yes - Competitive feature, needed for differentiation

---

### 1.5 Tenant Analytics/Reporting

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** HIGH
**Effort:** 3-4 days

**Current State:**

- Booking list view only
- No analytics, reports, or insights

**Required Implementation:**

- Dashboard with KPIs (bookings, revenue, conversion rate, avg package price)
- Date range filtering
- Charts (bookings over time, revenue by package, customer source)
- Export to CSV
- Monthly/yearly reports
- Trend analysis

**Database Queries Required:**

- Bookings by date range, status
- Revenue by package, date
- Conversion rate (queries → confirmed bookings)
- Customer acquisition cost (if marketing data available)
- Peak booking dates

**File Locations to Modify:**

- `server/src/routes/tenant-admin.routes.ts` - Add analytics endpoints
- `server/src/services/analytics.service.ts` - NEW
- `client/src/features/tenant-admin/AnalyticsTab.tsx` - NEW - Dashboard
- `client/src/features/tenant-admin/ReportBuilder.tsx` - NEW - Export/custom reports

**Blocker:** No - But essential for business operations

---

## 2. ADMIN CAPABILITIES

### 2.1 Platform Admin vs Tenant Admin Separation

**Status:** ✅ FULLY IMPLEMENTED
**Criticality:** CRITICAL
**Effort:** 0

**Implementation Details:**

- Role-based access control: `PLATFORM_ADMIN` vs `TENANT_ADMIN`
- Separate login endpoints:
  - `/v1/admin/login` - Platform admin
  - `/v1/tenant-auth/login` - Tenant admin
- JWT tokens carry role and scope
- Middleware enforces authorization per endpoint

**Files:**

- `server/src/middleware/auth.ts` - Platform admin auth
- `server/src/middleware/tenant-auth.ts` - Tenant admin auth
- `server/src/routes/auth.routes.ts` - Unified login (NEW)

**Status:** ✅ Ready for production

---

### 2.2 Tenant Onboarding Flow

**Status:** 🟡 PARTIALLY IMPLEMENTED
**Criticality:** CRITICAL
**Effort:** 2-3 days

**Current State:**

- Manual tenant creation via database/API
- No UI wizard or self-service signup
- No email verification
- No welcome emails

**Required Implementation:**

- Self-service tenant signup form
- Email verification with token
- Stripe Connect onboarding link
- Welcome email with API key
- Tenant configuration guide
- API key generation and rotation

**Database Changes:**

```sql
ALTER TABLE "Tenant" ADD COLUMN "invitationToken" STRING;
ALTER TABLE "Tenant" ADD COLUMN "invitationTokenExpiry" DateTime;
ALTER TABLE "Tenant" ADD COLUMN "emailVerified" BOOLEAN DEFAULT FALSE;
```

**File Locations to Modify:**

- `server/src/routes/admin/tenants.routes.ts` - Add signup endpoint
- `server/src/services/tenant-onboarding.service.ts` - NEW
- `client/src/pages/TenantSignup.tsx` - NEW
- `server/src/adapters/postmark.adapter.ts` - Add welcome email template

**Blocker:** Yes - Required for SaaS model

---

### 2.3 Billing/Subscription Management for Tenants

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** CRITICAL
**Effort:** 4-5 days

**Current State:**

- Tenant commission rate is fixed (10-15%)
- No billing cycles, invoicing, or usage limits
- Platform gets commission on bookings but doesn't manage tenant subscriptions

**Required Implementation:**

- Monthly subscription plans (Free, Pro, Enterprise)
- Feature tiering (bookings/month, custom branding, email templates)
- Stripe billing integration (recurring payments)
- Invoice generation
- Usage tracking and enforcement
- Dunning management (failed payments)

**Database Schema Changes:**

```sql
CREATE TABLE "SubscriptionPlan" (
  id STRING PRIMARY KEY,
  name STRING,
  monthlyPrice INT, -- in cents
  features JSON,
  limits JSON, -- { bookingsPerMonth: 50, emailTemplates: 3, ... }
  createdAt DateTime
);

CREATE TABLE "TenantSubscription" (
  id STRING PRIMARY KEY,
  tenantId STRING UNIQUE,
  planId STRING,
  stripeSubscriptionId STRING,
  status STRING, -- 'active', 'canceled', 'past_due'
  currentPeriodStart DateTime,
  currentPeriodEnd DateTime,
  autoRenew BOOLEAN,
  createdAt DateTime,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id),
  FOREIGN KEY (planId) REFERENCES SubscriptionPlan(id)
);

CREATE TABLE "UsageMetric" (
  id STRING PRIMARY KEY,
  tenantId STRING,
  metric STRING, -- 'bookings_created', 'api_calls', 'emails_sent'
  value INT,
  period DateTime, -- Start of period (monthly)
  createdAt DateTime,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id)
);
```

**File Locations to Modify:**

- `server/prisma/schema.prisma` - Add subscription models
- `server/src/services/subscription.service.ts` - NEW
- `server/src/routes/admin/billing.routes.ts` - NEW
- `server/src/middleware/rate-limiter-per-plan.ts` - NEW - Enforce limits
- `client/src/pages/BillingSettings.tsx` - NEW - Customer billing portal

**Blocker:** YES - Cannot launch without billing model

---

### 2.4 Tenant Usage Limits and Quotas

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** HIGH
**Effort:** 2-3 days

**Current State:**

- No usage tracking or enforcement
- No quotas on API calls, bookings, or features

**Required Implementation:**

- Rate limiting per tenant (requests per hour/day)
- Booking quota enforcement (free tier: 10/month, pro: unlimited)
- Storage quota (for photos, documents)
- Concurrent user limits
- API call tracking

**File Locations to Modify:**

- `server/src/middleware/tenant-rate-limiter.ts` - NEW
- `server/src/services/usage-tracker.service.ts` - NEW
- `server/src/middleware/tenant.ts` - Add quota checks
- `server/src/routes/index.ts` - Apply per-tenant rate limiter

**Blocker:** Yes - Required to prevent abuse and enforce business model

---

### 2.5 Multi-Tenant Monitoring Dashboard

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** HIGH
**Effort:** 3-4 days

**Current State:**

- No monitoring or analytics for platform admins
- No visibility into tenant usage, errors, or health

**Required Implementation:**

- Platform dashboard showing:
  - Active tenants count
  - Total revenue (platform commission)
  - Recent bookings across all tenants
  - Tenant usage trends
  - API error rates
  - System health metrics
- Search and filter tenants
- Tenant detail pages (usage, bookings, errors)
- Alerts for failed webhooks, rate limit overages

**File Locations to Modify:**

- `server/src/routes/admin/dashboard.routes.ts` - NEW
- `server/src/services/platform-analytics.service.ts` - NEW
- `client/src/pages/PlatformDashboard.tsx` - NEW
- `client/src/features/admin/TenantManagement.tsx` - Enhance

**Blocker:** No - But essential for operations

---

## 3. CUSTOMER FEATURES

### 3.1 Email Confirmations with Tenant Branding

**Status:** 🔴 PARTIALLY IMPLEMENTED
**Criticality:** CRITICAL
**Effort:** 1-2 days

**Current State:**

- Hardcoded plain text email template
- No tenant branding (colors, logo, signature)
- Only booking confirmation, no other email types

**Required Implementation:**

- HTML email templates with tenant branding
- Logo, colors from `Tenant.branding`
- Multiple template types:
  - Booking confirmation (with booking details, calendar invite)
  - Cancellation confirmation
  - Refund confirmation
  - Payment receipt
  - Reminders (1 week before)

**File Locations to Modify:**

- `server/src/adapters/postmark.adapter.ts` - Use database templates
- `server/src/services/email-template.service.ts` - NEW - Template management
- Create email template files (HTML)
- `server/src/routes/tenant-admin.routes.ts` - Add template endpoints

**Blocker:** YES - Customers will complain about plain text emails

---

### 3.2 Customer Portal for Managing Bookings

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** HIGH
**Effort:** 2-3 days

**Current State:**

- No customer portal at all
- Customers can only view their booking via email link
- No way to reschedule or view booking details

**Required Implementation:**

- Customer booking view page (public, no login)
- Access via unique token in booking confirmation email
- View booking details (date, package, total, add-ons)
- Reschedule booking (pick new date if available)
- View tenant info, contact, location
- Customer can request cancellation (with notes)

**Database Changes:**

```sql
ALTER TABLE "Booking" ADD COLUMN "accessToken" STRING UNIQUE;
ALTER TABLE "Booking" ADD COLUMN "accessTokenExpiry" DateTime;
```

**File Locations to Modify:**

- `server/src/routes/customer.routes.ts` - NEW - Public customer routes
- `server/src/services/customer.service.ts` - NEW
- `client/src/pages/CustomerBookingPortal.tsx` - NEW
- `server/src/adapters/postmark.adapter.ts` - Include portal link in emails

**Blocker:** YES - Customers need way to manage bookings

---

### 3.3 Cancellation/Refund Flow

**Status:** 🟡 PARTIALLY IMPLEMENTED
**Criticality:** CRITICAL
**Effort:** 2-3 days

**Current State:**

- Stripe refund capability exists in adapter
- **NO** cancellation endpoint or workflow
- **NO** refund policy management
- **NO** customer-initiated cancellations
- **NO** audit trail for refunds

**Required Implementation:**

- Tenant-configured cancellation policy (deadlines, refund %)
- Customer cancellation request via portal
- Admin approval workflow
- Automatic refund processing to customer
- Cancellation email notification
- Audit trail (who canceled, when, reason)
- Partial refund support

**Database Schema Changes:**

```sql
ALTER TABLE "Tenant" ADD COLUMN "cancellationPolicy" JSON;
-- {
--   "allowedDaysBeforeEvent": 14,
--   "refundPercent": 100,
--   "refundDeadline": "2 weeks before"
-- }

CREATE TABLE "CancellationRequest" (
  id STRING PRIMARY KEY,
  bookingId STRING UNIQUE,
  customerId STRING,
  requestedAt DateTime,
  reason STRING,
  status STRING, -- 'requested', 'approved', 'denied', 'refunded'
  refundAmount INT,
  refundedAt DateTime,
  createdAt DateTime,
  FOREIGN KEY (bookingId) REFERENCES Booking(id),
  FOREIGN KEY (customerId) REFERENCES Customer(id)
);
```

**File Locations to Modify:**

- `server/prisma/schema.prisma` - Add CancellationRequest model
- `server/src/services/cancellation.service.ts` - NEW
- `server/src/routes/customer.routes.ts` - Add cancellation endpoint
- `server/src/routes/tenant-admin.routes.ts` - Add cancellation approval
- `client/src/pages/CustomerBookingPortal.tsx` - Add cancel button
- `client/src/features/tenant-admin/CancellationRequests.tsx` - NEW

**Blocker:** YES - Legal/compliance requirement

---

### 3.4 Waitlist Functionality

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** NICE-TO-HAVE
**Effort:** 2-3 days

**Current State:**

- No waitlist feature
- Customers cannot request alternative dates

**Required Implementation:**

- Waitlist when all dates booked
- Join waitlist (email notification on date availability)
- Priority-based allocation
- Automatic notification when preferred dates open

**Database Schema:**

```sql
CREATE TABLE "WaitlistEntry" (
  id STRING PRIMARY KEY,
  customerId STRING,
  tenantId STRING,
  preferredDates JSON, -- Array of dates customer wants
  notified BOOLEAN,
  createdAt DateTime,
  FOREIGN KEY (customerId) REFERENCES Customer(id),
  FOREIGN KEY (tenantId) REFERENCES Tenant(id)
);
```

**Blocker:** No - Nice-to-have, post-launch

---

### 3.5 Reviews/Testimonials Per Tenant

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** NICE-TO-HAVE
**Effort:** 2-3 days

**Current State:**

- No review system
- No testimonials display

**Required Implementation:**

- Post-wedding review request email
- Review submission form (rating 1-5 stars, text)
- Review moderation (tenant approval)
- Display on tenant website/widget
- Search and filtering

**Database Schema:**

```sql
CREATE TABLE "Review" (
  id STRING PRIMARY KEY,
  bookingId STRING UNIQUE,
  tenantId STRING,
  customerId STRING,
  rating INT, -- 1-5 stars
  comment TEXT,
  status STRING, -- 'pending', 'approved', 'rejected'
  createdAt DateTime,
  FOREIGN KEY (bookingId) REFERENCES Booking(id),
  FOREIGN KEY (tenantId) REFERENCES Tenant(id),
  FOREIGN KEY (customerId) REFERENCES Customer(id)
);
```

**Blocker:** No - Post-launch enhancement

---

## 4. OPERATIONAL FEATURES

### 4.1 Error Tracking Per Tenant (Sentry Integration)

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** HIGH
**Effort:** 1-2 days

**Current State:**

- Basic error handling with JSON responses
- No error tracking service
- No per-tenant error metrics
- All errors logged to same stream (no tenant segregation)

**Required Implementation:**

- Sentry integration for error tracking
- Tenant context in error reports
- Error alerts for critical issues
- Error dashboard with trends
- Stack traces and replay data

**File Locations to Modify:**

- `server/src/lib/core/config.ts` - Add SENTRY_DSN env var
- `server/src/index.ts` - Initialize Sentry
- `server/src/middleware/request-logger.ts` - Add tenant context to Sentry
- `server/src/middleware/error-handler.ts` - Report errors to Sentry

**Blocker:** Yes - Production monitoring required

---

### 4.2 Audit Logging (Partial)

**Status:** 🟡 PARTIALLY IMPLEMENTED
**Criticality:** CRITICAL
**Effort:** 0 (Already done)

**Current State:**

- Audit system implemented (`AuditService`)
- Tracks config changes with before/after snapshots
- **MISSING:** Audit logging for platform admin routes

**Known Gap:**

- Platform admin package CRUD routes (`/v1/admin/packages/*`) don't log to audit trail
- Documented in `BACKLOG_PLATFORM_ADMIN_AUDIT_GAP.md`
- Low risk (tenant admin routes have 100% audit coverage)

**Resolution:** Document as known limitation or add audit hooks (30-60 min)

**Files:**

- `server/src/services/audit.service.ts` - Complete implementation
- `server/src/routes/tenant-admin.routes.ts` - Full audit integration
- `server/src/routes/admin-packages.routes.ts` - MISSING audit hooks

**Blocker:** No (if only using tenant admin routes in production)

---

### 4.3 Backup/Restore Per Tenant

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** MEDIUM
**Effort:** 2-3 days

**Current State:**

- No backup strategy documented
- Relying on Supabase PostgreSQL backups
- No per-tenant export/restore

**Required Implementation:**

- Automatic daily backups
- Tenant data export (JSON/CSV)
- Backup encryption
- Restore from backup (point-in-time)
- Backup storage in cloud (S3 or similar)

**File Locations to Modify:**

- `server/src/services/backup.service.ts` - NEW
- `server/src/routes/admin/backup.routes.ts` - NEW
- Infrastructure setup for backup storage and scheduler

**Blocker:** No - But important for disaster recovery

---

### 4.4 Rate Limiting Per Tenant

**Status:** 🟡 PARTIALLY IMPLEMENTED
**Criticality:** HIGH
**Effort:** 1 day

**Current State:**

- Global rate limiters exist (`publicLimiter`, `adminLimiter`, `loginLimiter`)
- **NO** per-tenant rate limiting
- Cannot enforce usage quotas

**Required Implementation:**

- Rate limiter using Redis or in-memory store
- Per-tenant request quota (requests/hour)
- Plan-based limits (free: 100/hour, pro: 1000/hour)
- Graceful degradation (reject or queue over limit)

**File Locations to Modify:**

- `server/src/middleware/tenant-rate-limiter.ts` - NEW
- `server/src/middleware/tenant.ts` - Apply per-tenant limiter
- `server/src/lib/cache.ts` - Use for tracking per-tenant counts

**Blocker:** Yes - Required to prevent abuse

---

### 4.5 API Versioning Strategy

**Status:** 🟢 PARTIALLY READY
**Criticality:** MEDIUM
**Effort:** 0 (Already versioned)

**Current State:**

- All endpoints use `/v1/` prefix
- Contracts package defines contract versions
- No version deprecation strategy

**Required Implementation:**

- Document API versioning policy
- Backward compatibility guarantees
- Deprecation timeline (e.g., "12 months notice")
- Migration guide for breaking changes
- Version-specific error messages

**File Locations:**

- `server/src/api-docs.ts` - API documentation
- `CONTRIBUTING.md` - Update API versioning guidelines

**Blocker:** No - But needed before v2 API

---

## 5. COMPLIANCE & LEGAL

### 5.1 Terms of Service Acceptance

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** CRITICAL (Legal)
**Effort:** 1-2 days

**Current State:**

- No Terms of Service acceptance tracking
- No tenant/customer ToS

**Required Implementation:**

- Terms of Service page
- Acceptance during signup (checkbox)
- Track acceptance (tenant, date, IP, user agent)
- Version management (allow multiple versions)

**Database Schema:**

```sql
CREATE TABLE "TermsOfServiceAcceptance" (
  id STRING PRIMARY KEY,
  tenantId STRING,
  version STRING,
  acceptedAt DateTime,
  ipAddress STRING,
  userAgent STRING,
  createdAt DateTime,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id)
);
```

**File Locations to Modify:**

- `server/prisma/schema.prisma` - Add acceptance tracking
- `server/src/routes/admin/tenants.routes.ts` - Add ToS acceptance endpoint
- `client/src/pages/TermsOfService.tsx` - NEW
- Create legal document repository

**Blocker:** YES - Required before launch

---

### 5.2 GDPR/Privacy Compliance

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** CRITICAL (Legal/Compliance)
**Effort:** 3-5 days

**Current State:**

- No GDPR compliance measures
- No privacy policy
- No consent management
- No data processing agreements

**Required Implementation:**

- Privacy Policy page (how data is collected, used, stored, deleted)
- Consent management (email marketing opt-in)
- Cookie consent banner
- GDPR request handling (documented process)
- Data processing agreements for tenants
- Documentation of legal basis for processing

**Database Changes:**

```sql
ALTER TABLE "Customer" ADD COLUMN "consentGiven" BOOLEAN;
ALTER TABLE "Customer" ADD COLUMN "consentDate" DateTime;
ALTER TABLE "Customer" ADD COLUMN "marketingOptIn" BOOLEAN DEFAULT FALSE;
```

**File Locations to Modify:**

- `server/src/routes/customer.routes.ts` - Add consent endpoints
- `client/src/pages/PrivacyPolicy.tsx` - NEW
- `client/src/components/CookieConsent.tsx` - NEW
- Create legal documentation
- Update email templates with unsubscribe links

**Blocker:** YES - Legal requirement in EU and many jurisdictions

---

### 5.3 Data Export Capabilities

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** CRITICAL (GDPR requirement)
**Effort:** 1-2 days

**Current State:**

- No data export functionality
- No GDPR subject access request (SAR) handling

**Required Implementation:**

- GDPR data export endpoint
- Export all customer data (bookings, contact info, preferences)
- Export in machine-readable format (JSON/CSV)
- Download prepared within 30 days (GDPR requirement)

**File Locations to Modify:**

- `server/src/routes/customer.routes.ts` - Add export endpoint
- `server/src/services/data-export.service.ts` - NEW
- `server/src/services/gdpr.service.ts` - NEW - GDPR request handling

**Blocker:** YES - GDPR requirement

---

### 5.4 Tenant Data Deletion

**Status:** ❌ NOT IMPLEMENTED
**Criticality:** CRITICAL (GDPR requirement)
**Effort:** 2-3 days

**Current State:**

- No data deletion capability
- No right-to-be-forgotten implementation
- No cascading delete safety

**Required Implementation:**

- GDPR right-to-be-forgotten (delete all customer personal data)
- Tenant account deletion (all data except legally required records)
- Cascade delete safety checks
- Soft deletes for audit trail
- Anonymization option (instead of deletion)

**Database Changes:**

```sql
ALTER TABLE "Customer" ADD COLUMN "deletedAt" DateTime;
ALTER TABLE "Booking" ADD COLUMN "anonymized" BOOLEAN DEFAULT FALSE;
-- For hard deletes, use triggers or application-level logic
```

**File Locations to Modify:**

- `server/src/services/gdpr.service.ts` - NEW - Data deletion
- `server/src/routes/customer.routes.ts` - Add deletion request endpoint
- `server/prisma/schema.prisma` - Add soft delete fields
- Create data retention policy

**Blocker:** YES - GDPR requirement

---

### 5.5 SSL and Security Headers

**Status:** 🟢 MOSTLY COMPLETE
**Criticality:** HIGH
**Effort:** 0 (Helmet already configured)

**Current State:**

- Helmet security middleware applied (`app.use(helmet())`)
- All headers set automatically (CSP, X-Frame-Options, etc.)
- HTTPS enforced in production

**Verification:**

- CSP headers: ✅ (Helmet default)
- HSTS: ✅ (Helmet default)
- X-Content-Type-Options: ✅ (Helmet default)
- X-Frame-Options: ✅ (Helmet default)

**File:** `server/src/app.ts` line 25

**Action Items:**

- Verify SSL certificate in production
- Test HTTPS enforcement
- Configure CSP for embeds (widget embedding)

**Blocker:** No - Ready for production

---

## 6. IMPLEMENTATION PRIORITY & EFFORT MATRIX

### CRITICAL PATH TO LAUNCH (Must-Have)

| Feature                        | Status | Effort | Days        | Risk        |
| ------------------------------ | ------ | ------ | ----------- | ----------- |
| Terms of Service               | ❌     | 1      | 1           | Legal       |
| GDPR/Privacy Policy            | ❌     | 2      | 2           | Legal       |
| Data Export (GDPR)             | ❌     | 1      | 1           | Legal       |
| Data Deletion (GDPR)           | ❌     | 2      | 2           | Legal       |
| Email Confirmations (Branded)  | 🟡     | 1      | 1           | Customer UX |
| Customer Portal                | ❌     | 2      | 2           | Customer UX |
| Cancellation/Refund Flow       | 🟡     | 2      | 2           | Business    |
| Billing/Subscriptions          | ❌     | 5      | 5           | Business    |
| Tenant Onboarding              | 🟡     | 2      | 2           | SaaS Model  |
| Monitoring/Sentry              | ❌     | 1      | 1           | Operations  |
| Email Templates (Customizable) | ❌     | 2      | 2           | Customer    |
| Per-Tenant Rate Limiting       | 🟡     | 1      | 1           | Security    |
| **SUBTOTAL**                   |        |        | **22 days** |             |

### HIGH-PRIORITY (Important)

| Feature             | Status | Effort | Days        |
| ------------------- | ------ | ------ | ----------- |
| Custom Homepage     | ❌     | 2      | 2           |
| Custom Booking Flow | 🟡     | 5      | 5           |
| Analytics/Reporting | ❌     | 4      | 4           |
| Subdomain Routing   | ❌     | 3      | 3           |
| Tenant Usage Limits | ❌     | 2      | 2           |
| **SUBTOTAL**        |        |        | **16 days** |

### MEDIUM-PRIORITY (Nice-to-Have / Post-Launch)

| Feature              | Status | Effort | Days       |
| -------------------- | ------ | ------ | ---------- |
| Backup/Restore       | ❌     | 3      | 3          |
| Reviews/Testimonials | ❌     | 2      | 2          |
| Waitlist             | ❌     | 3      | 3          |
| **SUBTOTAL**         |        |        | **8 days** |

---

## 7. LAUNCH READINESS CHECKLIST

### BLOCKER - Cannot Launch Without

- [x] Multi-tenant isolation (DONE)
- [x] Payment processing (DONE)
- [x] Platform/Tenant admin separation (DONE)
- [ ] Terms of Service acceptance
- [ ] Privacy Policy & GDPR compliance
- [ ] Data export capability
- [ ] Data deletion capability
- [ ] Branded email confirmations
- [ ] Customer booking portal
- [ ] Cancellation/refund flow
- [ ] Billing/subscription system
- [ ] Tenant onboarding flow
- [ ] Error tracking (Sentry)
- [ ] Per-tenant rate limiting
- [ ] Email template customization

**Total Blockers:** 11 items
**Estimated Time:** 22 days (3+ weeks)

### CRITICAL - Launch With Risk

- [ ] Audit logging for platform admin routes (Document as limitation)
- [ ] Custom booking flow (Can start with fixed flow)
- [ ] Tenant analytics (Can add post-launch)
- [ ] Subdomain routing (Can use header-based until implemented)

---

## 8. RECOMMENDED LAUNCH TIMELINE

### Phase 1: Compliance & Legal (Week 1) - 4 days

1. Terms of Service ✅ (1 day)
2. Privacy Policy + GDPR ✅ (2 days)
3. Data export + deletion ✅ (1 day)

### Phase 2: Customer Experience (Week 2) - 5 days

1. Branded email templates ✅ (2 days)
2. Customer booking portal ✅ (2 days)
3. Cancellation/refund flow ✅ (1 day)

### Phase 3: Billing & Operations (Weeks 3-4) - 8 days

1. Tenant onboarding ✅ (2 days)
2. Subscription/billing system ✅ (5 days)
3. Error tracking (Sentry) ✅ (1 day)

### Phase 4: Security & Polish (Week 5) - 5 days

1. Per-tenant rate limiting ✅ (1 day)
2. Email template customization ✅ (2 days)
3. QA and testing ✅ (2 days)

**Total Time:** 22 days ≈ 4.4 weeks (1 month)
**Launch Date:** December 14, 2025 (if starting Nov 14)

---

## 9. RISK ASSESSMENT

### High Risk Items (Block Launch)

1. **GDPR Compliance** - Legal liability, platform could be shut down in EU
   - Mitigation: Implement all GDPR features before launch
2. **Payment Refunds** - Customers demand cancellations, legal requirements
   - Mitigation: Implement cancellation flow with audit trail
3. **Billing System** - Cannot monetize without clear billing model
   - Mitigation: Implement subscription/billing before launch

### Medium Risk Items (Should Have Before Launch)

1. **Customer Portal** - Customers will demand way to manage bookings
   - Mitigation: Implement before launch or provide strong email support
2. **Error Tracking** - Cannot debug production issues without Sentry
   - Mitigation: Implement error tracking day 1 of production
3. **Email Templates** - Customers expect branded emails
   - Mitigation: Implement before launch

### Low Risk Items (Can Defer to Post-Launch)

1. **Analytics** - Nice-to-have, can add later
2. **Waitlist** - Early-stage feature, not essential
3. **Reviews** - Can add after gathering feedback

---

## 10. MISSING IMPLEMENTATION SUMMARY

### Backend Services (11 NEW services required)

1. `EmailTemplateService` - Customizable email templates
2. `CancellationService` - Cancellation/refund workflow
3. `SubscriptionService` - Billing and subscription management
4. `AnalyticsService` - Tenant analytics and reporting
5. `BookingFormService` - Custom booking form builder
6. `TenantOnboardingService` - Self-service signup
7. `DataExportService` - GDPR data export
8. `GdprService` - Privacy and data deletion
9. `BackupService` - Data backup/restore
10. `UsageTrackerService` - Usage metrics and quotas
11. `PlatformAnalyticsService` - Platform-wide monitoring

### API Routes (9 NEW route files required)

1. `/v1/customer/...` - Customer portal endpoints
2. `/v1/email-templates/...` - Email template management
3. `/v1/billing/...` - Subscription/invoice endpoints
4. `/v1/analytics/...` - Tenant analytics
5. `/v1/backup/...` - Backup/restore
6. `/v1/admin/dashboard/...` - Platform monitoring
7. `/v1/admin/billing/...` - Billing management
8. `/v1/gdpr/...` - GDPR requests

### Client Components (12 NEW components required)

1. `EmailTemplateEditor` - Email template builder
2. `CancellationRequestList` - Admin cancellation management
3. `BillingSettings` - Subscription management
4. `AnalyticsTab` - Tenant dashboard
5. `BookingFormBuilder` - Custom form builder
6. `CustomerBookingPortal` - Customer self-service
7. `TenantSignup` - Self-service onboarding
8. `PlatformDashboard` - Platform monitoring
9. `TermsOfService` - Legal page
10. `PrivacyPolicy` - Legal page
11. `CookieConsent` - Cookie banner
12. `ReportBuilder` - Custom reports/exports

### Database Changes (7 NEW tables + 15+ ALTER commands)

See detailed section above for all schema changes needed

---

## 11. FILES REQUIRING MODIFICATIONS

### High Priority (Core features)

- `/server/prisma/schema.prisma` - Add 7+ new tables
- `/server/src/app.ts` - Subdomain middleware
- `/server/src/middleware/tenant.ts` - Enhanced tenant resolution
- `/server/src/routes/index.ts` - Add new route groups
- `/server/src/adapters/postmark.adapter.ts` - Template loading
- `/server/src/services/booking.service.ts` - Refund integration

### Medium Priority (Supporting services)

- `/server/src/di.ts` - Wire new services
- `/server/src/lib/core/config.ts` - Add Sentry DSN
- `/server/src/middleware/error-handler.ts` - Sentry integration

### Client Changes

- `/client/src/App.tsx` - Add new routes
- `/client/src/features/tenant-admin/` - New admin features
- `/client/src/pages/` - New public pages

---

## CONCLUSION

Elope's **core multi-tenant architecture is production-ready**. However, **11 blocking features** are missing that are essential for a production launch:

**Legal/Compliance (4 features):** Terms of Service, GDPR, data export/deletion - Required by law
**Customer Experience (4 features):** Branded emails, portal, cancellations, refunds - Customers expect these
**Business Model (3 features):** Billing, subscriptions, onboarding - Required to monetize

**Estimated Implementation Time:** 22 days (4-5 weeks)

**Recommendation:** Implement all blocker items before production launch. The multi-tenant architecture is solid and ready to support these features.

---

**Document Version:** 1.0
**Last Updated:** November 14, 2025
**Prepared By:** Code Analysis
