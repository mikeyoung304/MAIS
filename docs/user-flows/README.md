# User Flows Documentation

**Last Updated:** November 21, 2025
**Platform Version:** Sprint 10 Complete (9.8/10 Maturity)

---

## Overview

This directory contains comprehensive documentation of all user journeys through the MAIS platform. Each document maps the complete experience for a specific user type, from initial touchpoint to final outcome, backed by actual codebase analysis with 200+ code references.

**Total Documentation:** 257KB across 5 documents covering 4 user types

---

## Quick Navigation

| Document                                                               | User Type                 | Size | Status             | Priority          |
| ---------------------------------------------------------------------- | ------------------------- | ---- | ------------------ | ----------------- |
| **[COMPLETE_USER_FLOW_ANALYSIS.md](./COMPLETE_USER_FLOW_ANALYSIS.md)** | **All Users (Synthesis)** | 52KB | ✅ Complete        | 🔴 **START HERE** |
| [FOUNDER_JOURNEY.md](./FOUNDER_JOURNEY.md)                             | Platform Admin            | 43KB | ✅ Complete        | 🟢 Reference      |
| [POTENTIAL_TENANT_JOURNEY.md](./POTENTIAL_TENANT_JOURNEY.md)           | Prospect                  | 35KB | ⚠️ 40% Implemented | 🟡 Critical Gap   |
| [TENANT_JOURNEY.md](./TENANT_JOURNEY.md)                               | Member                    | 55KB | ✅ 95% Complete    | 🟢 Reference      |
| [CUSTOMER_JOURNEY.md](./CUSTOMER_JOURNEY.md)                           | End User                  | 72KB | ✅ Complete        | 🟢 Reference      |

---

## Document Summaries

### 1. COMPLETE_USER_FLOW_ANALYSIS.md (Master Synthesis)

**🔴 START HERE** - This document synthesizes all 4 user journeys into a cohesive platform overview.

**Contents:**

- Executive summary of all user types
- User flow comparison matrix (shows interactions between users)
- System touchpoint map (which APIs each user type uses)
- Multi-tenant architecture flow (security patterns)
- Implementation status summary (what's complete, what's not)
- Critical gaps & recommendations (actionable roadmap)
- Cross-reference map (how one user's actions affect others)
- Strategic insights (marketing-reality alignment, growth blockers)

**When to Read:**

- First time understanding the platform
- Planning new features that affect multiple user types
- Strategic decisions about platform direction
- Onboarding new developers or stakeholders

---

### 2. FOUNDER_JOURNEY.md (Platform Admin)

**User Type:** Founder/Platform Administrator managing all tenants

**Journey Phases:**

1. Platform initialization (environment setup, database migrations)
2. Tenant onboarding (CLI tools, API key generation)
3. Platform operations (monitoring, health checks)
4. Database management (migrations, backups)
5. Advanced operations (secret rotation, incident response)

**Key Capabilities:**

- Create and manage all tenants
- Generate API keys (public/secret pairs)
- Setup Stripe Connect accounts
- Monitor platform-wide metrics
- Database migrations and seeding

**Implementation Status:** ✅ 100% Complete

**Technical Proficiency Required:** High (CLI, database operations)

**Primary Tools:** CLI scripts (`create-tenant`, `prisma migrate`), admin API endpoints

**When to Read:**

- Setting up the platform for the first time
- Creating new tenants manually
- Debugging multi-tenant issues
- Performing database migrations
- Rotating secrets or handling security incidents

---

### 3. POTENTIAL_TENANT_JOURNEY.md (Prospect)

**User Type:** Business owner interested in joining MAIS platform

**Journey Stages:**

1. Awareness (marketing homepage, value propositions)
2. Consideration (research, competitor comparison)
3. Application (❌ **NOT IMPLEMENTED** - manual email only)
4. Admin provisioning (platform admin creates account)
5. Onboarding (Stripe Connect, initial setup)
6. Activation (first booking, commission payment)
7. Growth (ongoing usage)
8. Retention (commission model)
9. Advocacy (❌ **NOT IMPLEMENTED** - no referral program)

**Critical Gaps:**

- ❌ No self-service signup form (marketing promises "5-minute application")
- ❌ AI agent consultation not implemented (despite marketing focus)
- ❌ No lead nurturing or drip campaigns
- ❌ No referral/affiliate program

**Implementation Status:** ⚠️ 40% Complete (CRITICAL GAP)

**Marketing-Reality Mismatch:** High (promises not yet implemented)

**When to Read:**

- Planning growth and acquisition strategy
- Understanding why tenant onboarding is manual
- Prioritizing self-service signup features
- Fixing marketing-reality alignment issues
- Building lead capture and nurturing systems

---

### 4. TENANT_JOURNEY.md (Member)

**User Type:** Business owner managing their services on MAIS

**Journey Phases:**

1. Onboarding (platform admin creates account)
2. Initial setup (first login, dashboard, branding)
3. Service configuration (packages, add-ons, photos, segments, availability)
4. Payment setup (Stripe Connect onboarding)
5. Ongoing operations (booking management, customer service)
6. Growth & analytics (⚠️ basic metrics only)

**Key Features:**

- ✅ Complete branding customization (logo, 4 colors, 8 fonts)
- ✅ Full package management (CRUD, 5 photos per package)
- ✅ Segment-based catalog organization (Sprint 9)
- ✅ Add-on management (package-linked or global)
- ✅ Availability control (blackout dates)
- ✅ Booking management (view, filter, search)
- ✅ Stripe Connect integration (direct payments + commission)
- ⚠️ Email template customization (file-sink only)
- ❌ AI agent proposals (not implemented)
- ❌ Advanced analytics (basic metrics only)

**Implementation Status:** ✅ 95% Complete

**Technical Proficiency Required:** Low to medium (visual dashboards)

**Primary Interface:** Admin dashboard UI (`/tenant/dashboard`)

**When to Read:**

- Understanding tenant admin capabilities
- Planning new tenant-facing features
- Debugging tenant dashboard issues
- Explaining platform features to prospects
- Designing UI improvements for tenant experience

---

### 5. CUSTOMER_JOURNEY.md (End User)

**User Type:** Individual booking a service through tenant's catalog

**Journey Stages:**

1. Discovery (homepage, segments, widget embedding)
2. Browse catalog (package cards, photo galleries)
3. Package selection (detailed view, add-ons preview)
4. Date selection (interactive calendar, batch availability)
5. Add-ons & details (customization, live pricing)
6. Checkout (Stripe session creation with commission)
7. Payment (Stripe Checkout with Connect)
8. Webhook processing (payment confirmation, booking creation)
9. Email confirmation (async event-driven)
10. Success page (polling, booking details)

**Key Features:**

- ✅ Tenant-scoped catalog (multi-tenant isolation)
- ✅ Segment-based organization (Sprint 9)
- ✅ Real-time availability (pessimistic locking)
- ✅ Add-on selection with live pricing
- ✅ Stripe Checkout (PCI-compliant)
- ✅ Commission calculation (server-side, per-tenant rates)
- ✅ Double-booking prevention (three-layer defense)
- ✅ Email confirmations (Postmark)
- ✅ Mobile-responsive design (Sprint 8)
- ✅ Embeddable widget support

**Implementation Status:** ✅ 100% Complete

**Technical Proficiency Required:** None (consumer-facing UI)

**Primary Interface:** Public catalog UI, booking widget

**Business Impact:** PRIMARY revenue generation flow (100% commission dependency)

**When to Read:**

- Understanding the core business flow
- Debugging booking or payment issues
- Optimizing conversion funnel
- Planning mobile UI improvements
- Understanding double-booking prevention
- Troubleshooting Stripe webhook failures

---

## User Type Quick Reference

### Who Can Do What?

| Action                   | Founder            | Prospect | Tenant          | Customer              |
| ------------------------ | ------------------ | -------- | --------------- | --------------------- |
| **Create Tenants**       | ✅ Yes             | ❌ No    | ❌ No           | ❌ No                 |
| **Login to Dashboard**   | ✅ Platform admin  | ❌ No    | ✅ Tenant admin | ❌ No                 |
| **Manage Packages**      | ✅ All tenants     | ❌ No    | ✅ Own tenant   | ❌ No (view only)     |
| **Upload Photos**        | ⚠️ Via admin       | ❌ No    | ✅ Yes          | ❌ No                 |
| **Set Availability**     | ⚠️ Via admin       | ❌ No    | ✅ Yes          | ❌ No                 |
| **Book Services**        | ✅ Via admin       | ❌ No    | ⚠️ Limited      | ✅ Primary flow       |
| **View Bookings**        | ✅ All tenants     | ❌ No    | ✅ Own tenant   | ❌ No (view own only) |
| **Receive Payments**     | ❌ No (commission) | ❌ No    | ✅ Via Stripe   | ❌ No                 |
| **Access Database**      | ✅ Direct (Prisma) | ❌ No    | ⚠️ API only     | ⚠️ API only           |
| **Run Migrations**       | ✅ Yes             | ❌ No    | ❌ No           | ❌ No                 |
| **Generate API Keys**    | ✅ For tenants     | ❌ No    | ❌ No           | ❌ No                 |
| **Setup Stripe Connect** | ✅ For tenants     | ❌ No    | ✅ Self-onboard | ❌ No                 |
| **See Platform Metrics** | ✅ System-wide     | ❌ No    | ⚠️ Own metrics  | ❌ No                 |

---

## Common Use Cases

### Use Case 1: "I want to understand the complete platform"

**Read in this order:**

1. **[COMPLETE_USER_FLOW_ANALYSIS.md](./COMPLETE_USER_FLOW_ANALYSIS.md)** - 30-minute overview
2. **[CUSTOMER_JOURNEY.md](./CUSTOMER_JOURNEY.md)** - Understand the core business flow
3. **[TENANT_JOURNEY.md](./TENANT_JOURNEY.md)** - See how tenants manage their business
4. Skim **[FOUNDER_JOURNEY.md](./FOUNDER_JOURNEY.md)** and **[POTENTIAL_TENANT_JOURNEY.md](./POTENTIAL_TENANT_JOURNEY.md)** for context

---

### Use Case 2: "I need to onboard a new tenant (manually)"

**Read:**

- **[FOUNDER_JOURNEY.md](./FOUNDER_JOURNEY.md)** → Phase 2: Tenant Onboarding
  - Specific section: "Creating Tenants via CLI" (lines 200-350)
  - Checklist: Lines 400-450

**Quick Commands:**

```bash
# Create tenant with Stripe Connect
cd server
npm run create-tenant-with-stripe

# Or basic tenant creation
npm run create-tenant
```

---

### Use Case 3: "Why isn't there a signup form for prospects?"

**Read:**

- **[POTENTIAL_TENANT_JOURNEY.md](./POTENTIAL_TENANT_JOURNEY.md)** → Stage 3: Application
  - Critical Gaps section (lines 150-250)
- **[COMPLETE_USER_FLOW_ANALYSIS.md](./COMPLETE_USER_FLOW_ANALYSIS.md)** → Gap 1: Self-Service Tenant Signup
  - Recommendation and roadmap (lines 800-900)

**TL;DR:** Platform was built for manual onboarding first (prove booking flow works), then scale. Self-service signup is Sprint 11 priority.

---

### Use Case 4: "Customer reports they can't book a date"

**Debug using:**

- **[CUSTOMER_JOURNEY.md](./CUSTOMER_JOURNEY.md)** → Stage 4: Date Selection
  - Availability checking logic (lines 400-500)
  - Common errors and fixes (lines 1200-1400)

**Common causes:**

1. Tenant set blackout date for that day
2. Another booking already confirmed (double-booking prevention)
3. Date is in the past
4. Tenant's Stripe Connect not completed

---

### Use Case 5: "Tenant says they're not getting paid"

**Debug using:**

- **[CUSTOMER_JOURNEY.md](./CUSTOMER_JOURNEY.md)** → Stage 7: Payment Flow
  - Commission split explanation (lines 600-700)
  - Stripe Connect payout timeline (lines 750-850)
- **[TENANT_JOURNEY.md](./TENANT_JOURNEY.md)** → Phase 4: Payment Setup
  - Stripe Connect onboarding verification (lines 500-600)

**Common causes:**

1. Stripe Connect onboarding not completed (check `tenant.stripeOnboardingCompleted`)
2. Payout is pending (Stripe holds for 2-7 days for new accounts)
3. Bank account not added to Stripe Connect
4. Dispute or fraud hold (check Stripe dashboard)

---

### Use Case 6: "How does multi-tenant isolation work?"

**Read:**

- **[COMPLETE_USER_FLOW_ANALYSIS.md](./COMPLETE_USER_FLOW_ANALYSIS.md)** → Multi-Tenant Architecture Flow
  - Tenant context resolution (lines 600-750)
  - Security guarantees (lines 800-900)

**Key Files to Review:**

- `/server/src/middleware/tenant.ts` - Tenant resolution middleware
- `/server/src/lib/ports.ts` - Repository interfaces (all require tenantId)

**Security Guarantee:** Every query filters by `tenantId` at database layer. No cross-tenant data access possible.

---

### Use Case 7: "Planning a new feature - which users does it affect?"

**Read:**

- **[COMPLETE_USER_FLOW_ANALYSIS.md](./COMPLETE_USER_FLOW_ANALYSIS.md)** → User Flow Comparison Matrix
  - See which user types have access to what (lines 200-350)
  - Cross-reference map shows cascade effects (lines 1000-1200)

**Example:** Adding "Package Templates"

- ✅ **Founder** can create platform-wide templates
- ✅ **Tenant** can use templates to speed up package creation
- ❌ **Customer** doesn't see templates (only final packages)
- ❌ **Prospect** not relevant (not yet a tenant)

---

## Architecture Patterns Documented

These user flow documents include detailed analysis of:

### 1. Multi-Tenant Data Isolation

- Row-level security with `tenantId` foreign keys
- Tenant middleware resolution pattern
- Repository interfaces requiring tenant context
- Cache key scoping by tenant

**Example Files:**

- `/server/src/middleware/tenant.ts`
- `/server/src/lib/ports.ts`

---

### 2. Double-Booking Prevention

- Three-layer defense:
  1. Database constraint: `@@unique([tenantId, date])`
  2. Pessimistic locking: `SELECT FOR UPDATE` in transactions
  3. Graceful error handling: Catch unique violation

**Example Files:**

- `/server/src/services/booking.service.ts`
- `/server/src/services/availability.service.ts`

---

### 3. Commission Calculation

- Server-side commission calculation (not client-side)
- Per-tenant commission rates (10-15%, default 12%)
- Always rounds UP (platform-favorable)
- Stripe Connect application fee

**Example Files:**

- `/server/src/services/commission.service.ts`
- `/server/src/adapters/stripe.adapter.ts`

---

### 4. Webhook Idempotency

- Database-backed deduplication
- Unique constraint on `eventId` prevents replay attacks
- Status tracking: `pending` → `processing` → `processed` → `failed`

**Example Files:**

- `/server/src/routes/webhooks.routes.ts`
- `/server/prisma/schema.prisma` (WebhookEvent model)

---

### 5. Event-Driven Architecture

- In-process EventEmitter for cross-service communication
- Async handlers for emails and calendar events
- Graceful degradation on handler failures

**Example Files:**

- `/server/src/lib/core/events.ts`
- `/server/src/services/notification.service.ts`

---

## Implementation Status Heatmap

| Component                  | Founder | Prospect | Tenant  | Customer     |
| -------------------------- | ------- | -------- | ------- | ------------ |
| **Authentication**         | ✅ 100% | ❌ N/A   | ✅ 100% | ❌ N/A       |
| **Dashboard UI**           | ⚠️ 30%  | ❌ 0%    | ✅ 95%  | ✅ 100%      |
| **CRUD Operations**        | ✅ 100% | ❌ N/A   | ✅ 100% | ⚠️ Read only |
| **Payment Integration**    | ✅ 100% | ❌ N/A   | ✅ 100% | ✅ 100%      |
| **Email Notifications**    | ⚠️ 50%  | ❌ 0%    | ⚠️ 70%  | ✅ 100%      |
| **Analytics**              | ⚠️ 40%  | ❌ N/A   | ⚠️ 30%  | ❌ N/A       |
| **Multi-Tenant Isolation** | ✅ 100% | ❌ N/A   | ✅ 100% | ✅ 100%      |
| **Mobile Responsive**      | ⚠️ N/A  | ✅ 100%  | ⚠️ 60%  | ✅ 100%      |

**Legend:**

- ✅ **100%** - Fully implemented, production-ready
- ⚠️ **30-70%** - Partially implemented, has gaps
- ❌ **0%** or **N/A** - Not implemented or not applicable

---

## Critical Gaps Summary

### 🔴 Critical (Blocks Growth)

1. **Self-Service Tenant Signup** (Prospect Flow)
   - Marketing promises "5-minute application"
   - NO signup form exists
   - ALL onboarding is manual via CLI
   - **Impact:** Founder bottleneck, can't scale
   - **Recommendation:** Build lead capture form + approval dashboard (Sprint 11)

2. **AI Agent System** (Marketing Mismatch)
   - Homepage emphasizes "dedicated AI strategist"
   - NONE of this backend exists
   - **Impact:** Broken promises, churn risk
   - **Recommendation:** De-emphasize AI in marketing OR build system (16+ weeks)

---

### 🟡 High Priority (Limits Features)

3. **Advanced Tenant Analytics** (Tenant Flow)
   - Only basic metrics (booking count, revenue)
   - No trends, conversion rates, or customer insights
   - **Impact:** Tenants can't optimize business
   - **Recommendation:** Build revenue dashboard (6 weeks)

4. **Multi-Admin Support** (Founder + Tenant)
   - Single platform admin account
   - Tenants can't add team members
   - **Impact:** Security risk (password sharing), scaling limit
   - **Recommendation:** RBAC for platform + tenant teams (4 weeks)

---

### 🟢 Medium Priority (Nice to Have)

5. **Referral/Affiliate Program** (Growth)
   - No viral mechanics or incentives
   - **Impact:** Slow organic growth
   - **Recommendation:** Tenant referral links + rewards (8 weeks)

6. **Platform Admin UI** (Founder Experience)
   - Minimal web UI, CLI-heavy
   - **Impact:** Platform won't scale to non-technical operators
   - **Recommendation:** Web-based tenant management (10 weeks)

---

## How to Use This Documentation

### For Developers

1. **First time understanding the platform?**
   - Start with **[COMPLETE_USER_FLOW_ANALYSIS.md](./COMPLETE_USER_FLOW_ANALYSIS.md)**
   - Then dive into **[CUSTOMER_JOURNEY.md](./CUSTOMER_JOURNEY.md)** (core business flow)

2. **Implementing a new feature?**
   - Check which user types are affected (use Comparison Matrix)
   - Read relevant user journey document for that user type
   - Follow existing patterns (multi-tenant isolation, service layer structure)

3. **Debugging an issue?**
   - Find the relevant user journey document
   - Use code references (file paths + line numbers) to navigate codebase
   - Check "Common Errors" sections in each document

---

### For Product Managers

1. **Planning Sprint 11+ roadmap?**
   - Read **[COMPLETE_USER_FLOW_ANALYSIS.md](./COMPLETE_USER_FLOW_ANALYSIS.md)** → Critical Gaps
   - Prioritize based on business impact (growth blockers first)

2. **Understanding marketing-reality alignment?**
   - Read **[POTENTIAL_TENANT_JOURNEY.md](./POTENTIAL_TENANT_JOURNEY.md)** → Marketing-Reality Mismatch
   - Current state: AI agent system is vaporware, self-service signup missing

3. **Defining success metrics?**
   - Each journey document has "Success Criteria" sections
   - Use these to build dashboard metrics

---

### For Stakeholders

1. **Evaluating platform maturity?**
   - Read **[COMPLETE_USER_FLOW_ANALYSIS.md](./COMPLETE_USER_FLOW_ANALYSIS.md)** → Implementation Status Summary
   - Current: 9.8/10 maturity, production-ready

2. **Understanding revenue model?**
   - Read **[CUSTOMER_JOURNEY.md](./CUSTOMER_JOURNEY.md)** → Payment Flow
   - Commission split: 88% tenant, 12% platform (via Stripe Connect)

3. **Assessing growth potential?**
   - Read **[POTENTIAL_TENANT_JOURNEY.md](./POTENTIAL_TENANT_JOURNEY.md)** → Critical Gaps
   - Bottleneck: Manual onboarding limits scale to 10-20 tenants

---

## Document Maintenance

### When to Update

- ✅ **After implementing new features** - Update relevant journey document
- ✅ **After each sprint** - Review gap analysis, update implementation status
- ✅ **When architecture changes** - Update all documents referencing affected code
- ✅ **When adding new user types** - Create new journey document + update synthesis

### Ownership

- **COMPLETE_USER_FLOW_ANALYSIS.md**: Product owner + lead developer
- **Individual journey docs**: Domain owners (e.g., booking team owns CUSTOMER_JOURNEY.md)

### Versioning

- Major version bump (1.0 → 2.0): Significant user flow changes (e.g., self-service signup added)
- Minor version bump (1.0 → 1.1): Feature additions or gap updates
- Patch version (1.0.0 → 1.0.1): Typos, code reference updates

---

## Related Documentation

- **[../sprints/SPRINT_10_FINAL_SUMMARY.md](../sprints/SPRINT_10_FINAL_SUMMARY.md)** - Sprint 10 completion report
- **[../deployment/PRODUCTION_DEPLOYMENT_CHECKLIST.md](../deployment/PRODUCTION_DEPLOYMENT_CHECKLIST.md)** - Production deployment guide
- **[../../ARCHITECTURE.md](../../ARCHITECTURE.md)** - System architecture overview
- **[../../DEVELOPING.md](../../DEVELOPING.md)** - Development guide
- **[../../TESTING.md](../../TESTING.md)** - Testing strategy

---

## Quick Stats

- **Total Documentation:** 257KB
- **Total Lines:** ~5,000 lines
- **Code References:** 200+ file paths with line numbers
- **User Types Covered:** 4 (Founder, Prospect, Tenant, Customer)
- **Journey Stages:** 30+ across all user types
- **Implementation Status:** 9.8/10 platform maturity

---

**Last Updated:** November 21, 2025
**Platform Version:** Sprint 10 Complete
**Next Review:** After Sprint 11 (self-service signup implementation)
