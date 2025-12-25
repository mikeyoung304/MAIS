# MAIS MVP Roadmap: Current State to Launch

## Executive Summary

**Current State:** MAIS is 85-90% complete for MVP launch
**Time to MVP:** 4-6 weeks of focused work
**Primary Gaps:** Tenant onboarding friction, analytics, and a few broken endpoints

---

## Part 1: Where We Are Now

### What's Working (Production Ready)

| Feature                      | Status       | Notes                                 |
| ---------------------------- | ------------ | ------------------------------------- |
| Multi-tenant data isolation  | ✅ 100%      | All queries scoped by tenantId        |
| Customer booking flow        | ✅ 95%       | Browse → Select → Pay → Confirm       |
| Stripe payments + commission | ✅ 100%      | Stripe Connect with platform fees     |
| Package management           | ✅ 90%       | CRUD, photos, pricing, add-ons        |
| Segment/tier system          | ✅ 100%      | Multiple customer journeys per tenant |
| Tenant branding              | ✅ 80%       | Colors, logo, fonts                   |
| Embeddable widget            | ✅ 100%      | iframe with PostMessage API           |
| Blackout dates               | ✅ 100%      | Unavailability management             |
| Platform admin dashboard     | ✅ 70%       | Tenant CRUD, basic metrics            |
| Test coverage                | ✅ 752 tests | 100% pass rate                        |

### What's Partially Built

| Feature                  | Status | Gap                                  |
| ------------------------ | ------ | ------------------------------------ |
| Tenant admin dashboard   | 60%    | Missing analytics, settings          |
| Email notifications      | 70%    | Templates exist, no customization UI |
| Storefront customization | 40%    | Only colors/logo, no layout control  |

### What's Missing (MVP Blockers)

| Feature                          | Priority | Effort  |
| -------------------------------- | -------- | ------- |
| Tenant self-service onboarding   | HIGH     | 2 weeks |
| Revenue/booking analytics        | HIGH     | 1 week  |
| Stripe Connect tenant onboarding | HIGH     | 1 week  |
| Settings page (password change)  | MEDIUM   | 3 days  |
| Post-booking email sequences     | MEDIUM   | 1 week  |

---

## Part 2: MVP Definition

### MVP Target User

**Club Member (Tenant):** Solo service provider (photographer, wellness coach, event planner) who needs:

- Professional booking page
- Payment processing with automatic commission split
- Basic business insights

### MVP Must-Haves

1. **Tenant can sign up and go live in < 30 minutes**
   - Self-service signup (not manual platform admin creation)
   - Stripe Connect onboarding flow
   - Guided first package creation

2. **Tenant can see how their business is doing**
   - Revenue this month
   - Booking count and trends
   - Top performing packages

3. **Customer can book and pay seamlessly**
   - Already working ✅

4. **Platform can collect commission automatically**
   - Already working ✅

### MVP Nice-to-Haves (Post-Launch)

- Custom domains
- Email template customization
- Customer reviews/ratings
- Refund processing UI
- Multi-user tenant accounts

---

## Part 3: Phased Implementation Plan

### Phase 1: Foundation Fixes (Week 1)

**Goal:** Fix broken things, stabilize for launch

| Task                                           | Effort  | Owner      |
| ---------------------------------------------- | ------- | ---------- |
| Fix package photo upload endpoint (404 errors) | 4 hours | Backend    |
| Fix webhook race condition tests               | 4 hours | Backend    |
| Verify Stripe Connect flow works end-to-end    | 4 hours | Full-stack |
| Run full E2E test suite, fix failures          | 8 hours | QA         |

**Deliverable:** All 752 tests passing, no broken endpoints

---

### Phase 2: Tenant Onboarding (Week 2-3)

**Goal:** Tenant can sign up and go live without platform admin help

#### 2A: Self-Service Signup

**New Pages:**

- `/signup` - Tenant registration form
- `/onboarding` - Guided setup wizard

**New Endpoints:**

```typescript
POST /v1/tenants/signup
{
  email: string,
  password: string,
  businessName: string,
  slug: string
}
// Returns: { tenantId, apiKeys, redirectUrl }
```

**Database:** No schema changes (Tenant model already complete)

**UI Flow:**

1. Enter email, password, business name
2. Auto-generate slug from business name
3. Create tenant with default 10% commission
4. Generate API keys
5. Redirect to onboarding wizard

#### 2B: Stripe Connect Onboarding

**New Component:** `StripeConnectSetup.tsx`

**Flow:**

1. Show "Connect your bank account" card in onboarding
2. Create Stripe Connect account via API
3. Redirect to Stripe's hosted onboarding
4. Handle return URL, update `stripeOnboarded` flag
5. Show success state

**Endpoints:**

```typescript
POST / v1 / tenant - admin / stripe / connect;
// Returns: { accountId, onboardingUrl }

GET / v1 / tenant - admin / stripe / status;
// Returns: { connected: boolean, accountId?: string }
```

#### 2C: Guided First Package

**New Component:** `OnboardingWizard.tsx`

**Steps:**

1. ✅ Account created
2. ⏳ Add your first package (simplified form)
3. ⏳ Connect Stripe (or skip for now)
4. ⏳ Preview your booking page
5. 🎉 You're live!

**Deliverable:** New tenant can sign up → create package → accept payments in < 30 minutes

---

### Phase 3: Tenant Analytics (Week 4)

**Goal:** Tenant can see business performance

#### 3A: Dashboard Metrics

**New Component:** `TenantMetrics.tsx`

**Metrics to show:**

- Revenue this month (sum of confirmed bookings)
- Revenue vs last month (% change)
- Booking count this month
- Conversion rate (if tracking views)
- Top 3 packages by revenue

**New Endpoint:**

```typescript
GET /v1/tenant-admin/analytics/summary
{
  revenue: { current: number, previous: number, change: number },
  bookings: { current: number, previous: number, change: number },
  topPackages: [{ name, revenue, bookings }]
}
```

#### 3B: Booking List Enhancements

**Add to existing TenantBookingList:**

- Date range filter (this week, this month, custom)
- Status filter (pending, confirmed, cancelled)
- Export to CSV button

**New Endpoint:**

```typescript
GET /v1/tenant-admin/bookings/export?format=csv&startDate=&endDate=
// Returns: CSV file download
```

**Deliverable:** Tenant dashboard shows revenue, bookings, trends

---

### Phase 4: Polish & Launch Prep (Week 5-6)

**Goal:** Production-ready deployment

#### 4A: Settings Page

**New Page:** `/tenant/settings`

**Features:**

- Change password
- View API keys (masked, with copy button)
- Update business name
- Deactivate account (with confirmation)

#### 4B: Email Improvements

**Tasks:**

- Create branded email templates (booking confirmation, reminder)
- Add tenant logo to email header
- Test email delivery in production

#### 4C: Production Checklist

| Task                             | Status |
| -------------------------------- | ------ |
| Environment variables configured | ⏳     |
| Database migrations applied      | ⏳     |
| Stripe webhooks configured       | ⏳     |
| SSL certificates                 | ⏳     |
| Error monitoring (Sentry)        | ⏳     |
| Uptime monitoring                | ⏳     |
| Backup strategy                  | ⏳     |
| Rate limiting tuned              | ⏳     |

**Deliverable:** Production deployment with monitoring

---

## Part 4: Technical Specifications

### New Database Models

None required - existing schema supports all MVP features.

### New API Endpoints Summary

| Endpoint                             | Method  | Purpose                          |
| ------------------------------------ | ------- | -------------------------------- |
| `/v1/tenants/signup`                 | POST    | Self-service tenant registration |
| `/v1/tenant-admin/stripe/connect`    | POST    | Initiate Stripe Connect          |
| `/v1/tenant-admin/stripe/status`     | GET     | Check Stripe connection          |
| `/v1/tenant-admin/analytics/summary` | GET     | Dashboard metrics                |
| `/v1/tenant-admin/bookings/export`   | GET     | CSV export                       |
| `/v1/tenant-admin/settings`          | GET/PUT | Account settings                 |
| `/v1/tenant-admin/password`          | PUT     | Change password                  |

### New Frontend Pages

| Route              | Component          | Purpose             |
| ------------------ | ------------------ | ------------------- |
| `/signup`          | `SignupPage`       | Tenant registration |
| `/onboarding`      | `OnboardingWizard` | Guided setup        |
| `/tenant/settings` | `TenantSettings`   | Account management  |

### File Structure

```
client/src/
├── pages/
│   ├── signup/
│   │   └── index.tsx          # New: Signup form
│   └── onboarding/
│       └── index.tsx          # New: Setup wizard
├── features/
│   └── tenant-admin/
│       ├── Analytics/
│       │   └── TenantMetrics.tsx    # New
│       ├── Settings/
│       │   └── index.tsx            # New
│       └── StripeConnect/
│           └── StripeConnectSetup.tsx  # New

server/src/
├── routes/
│   ├── tenant-signup.routes.ts      # New
│   └── tenant-analytics.routes.ts   # New
├── services/
│   └── analytics.service.ts         # New
```

---

## Part 5: Success Criteria

### MVP Launch Criteria

- [ ] New tenant can sign up without platform admin help
- [ ] Tenant can create package and accept payment within 30 minutes
- [ ] Tenant can see revenue and booking metrics
- [ ] Customer booking flow works end-to-end
- [ ] Platform collects commission on all transactions
- [ ] All critical paths have E2E test coverage
- [ ] Error monitoring in place

### Post-Launch Metrics (First 30 Days)

| Metric                                   | Target  |
| ---------------------------------------- | ------- |
| Tenant signups                           | 10+     |
| Tenant activation rate (created package) | >70%    |
| Bookings processed                       | 50+     |
| Stripe Connect completion                | >80%    |
| Support tickets                          | <5/week |

---

## Part 6: Risk Mitigation

| Risk                               | Likelihood | Mitigation                                    |
| ---------------------------------- | ---------- | --------------------------------------------- |
| Stripe Connect complexity          | Medium     | Use Stripe's hosted onboarding, not custom UI |
| Tenant confusion during onboarding | Medium     | Simple 5-step wizard with progress indicator  |
| Payment failures                   | Low        | Existing webhook handling is robust           |
| Scale issues                       | Low        | Current architecture handles 1000s of tenants |

---

## Part 7: Timeline Summary

| Week   | Focus               | Deliverable                          |
| ------ | ------------------- | ------------------------------------ |
| Week 1 | Foundation Fixes    | All tests passing, endpoints working |
| Week 2 | Tenant Signup       | Self-service registration            |
| Week 3 | Stripe + Onboarding | Complete onboarding wizard           |
| Week 4 | Analytics           | Dashboard metrics                    |
| Week 5 | Settings + Polish   | Settings page, email templates       |
| Week 6 | Launch Prep         | Production deployment                |

**Total: 6 weeks to MVP launch**

---

## Appendix: Current File References

| Feature          | Key Files                                                |
| ---------------- | -------------------------------------------------------- |
| Tenant Model     | `server/prisma/schema.prisma:45-89`                      |
| Booking Service  | `server/src/services/booking.service.ts`                 |
| Stripe Adapter   | `server/src/adapters/stripe.adapter.ts`                  |
| Tenant Dashboard | `client/src/features/tenant-admin/TenantDashboard/`      |
| Package Form     | `client/src/features/tenant-admin/packages/PackageForm/` |
| Booking Flow     | `client/src/features/booking/`                           |
| API Contracts    | `packages/contracts/src/api.v1.ts`                       |

---

_Plan created: November 25, 2025_
_Target MVP Launch: January 2026_
