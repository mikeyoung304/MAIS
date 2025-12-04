# Original 6-Week Plan vs. Ruthless 2-Week MVP

## Side-by-Side Comparison

### Original Roadmap (6 Weeks)

```
Week 1: Fix broken tests/endpoints
  ├─ Fix package photo upload (4h)
  ├─ Fix webhook race condition (4h)
  ├─ Verify Stripe Connect (4h)
  └─ Run E2E tests (8h)
  └─ Total: 20 hours

Week 2: Self-service signup
  ├─ New signup page (/signup)
  ├─ POST /v1/tenants/signup endpoint
  └─ Total: 8 hours

Week 3: Stripe Connect + 5-step onboarding wizard
  ├─ StripeConnectSetup.tsx component
  ├─ Guided onboarding (5 steps!)
  ├─ Preview your booking page
  └─ Total: 12 hours

Week 4: Analytics dashboard
  ├─ Revenue (this month, vs last)
  ├─ Bookings (count, trends)
  ├─ Top packages
  ├─ TenantMetrics component
  └─ Total: 12 hours

Week 5: Settings page, email templates
  ├─ Password change
  ├─ API key management
  ├─ Email template customization
  └─ Total: 10 hours

Week 6: Production deployment
  ├─ Environment setup
  ├─ Monitoring
  ├─ Runbooks
  └─ Total: 8 hours

TOTAL: 70 hours (~2 months)
```

### Ruthless 2-Week MVP

```
Week 1: Test Stabilization + Verification (5 days)
  ├─ Day 1-2: Fix webhook race condition tests ONLY (3-4h)
  │           Skip photo upload tests (not blocking)
  │           Skip webhook HTTP tests (endpoint works)
  │
  ├─ Day 3-4: E2E verification (4h)
  │           Little Bit Farm: book + pay
  │           Stripe: webhook fires, commission calculates
  │
  ├─ Setup Supabase Storage (3h)
  │ (images must persist in production)
  │
  └─ Day 5: Buffer + docs (2h)
  └─ Total: 12-14 hours

Week 2: Self-Service + Deploy (3 days)
  ├─ Day 1-2: Signup endpoint + form (3h)
  │           POST /v1/tenants/signup
  │           client/src/pages/Signup.tsx
  │           Zero complexity, just form → submit → redirect
  │
  ├─ Day 3: Polish + deploy (2h)
  │          Verify flow, deploy, celebrate
  │
  └─ Total: 5-6 hours

TOTAL: 17-20 hours (2-3 days of actual work)
```

---

## What Gets Cut

| Feature                | Original | Ruthless | Reason                                       |
| ---------------------- | -------- | -------- | -------------------------------------------- |
| **5-step wizard**      | 12h      | 0h       | Over-engineered. Replace with 3-screen form. |
| **Analytics**          | 12h      | Defer    | Stripe dashboard sufficient. Add week 3.     |
| **Settings page**      | 10h      | Defer    | Password changes rare. Nice-to-have.         |
| **Email templates**    | Included | Defer    | File-sink works. Add Postmark week 2.        |
| **Segment UI**         | Included | Cut      | Backend done. Launch without.                |
| **Photo upload fix**   | 4h       | Skip     | Not blocking customer bookings. Fix week 2.  |
| **Webhook HTTP tests** | 12h      | Skip     | Endpoint works. Tests are nice-to-have.      |
| **Custom domains**     | Planned  | Cut      | Everyone uses maconaisolutions.com/{slug}    |
| **White-label**        | Planned  | Cut      | Future, not MVP.                             |

**Hours saved: 50 hours (over 70% reduction)**

---

## What Gets KEPT

| Feature                    | Status       | Effort |
| -------------------------- | ------------ | ------ |
| **Booking form**           | ✅ 95% done  | 0h     |
| **Stripe payment**         | ✅ 100% done | 0h     |
| **Commission auto-split**  | ✅ 100% done | 0h     |
| **Multi-tenant isolation** | ✅ 95% done  | 0h     |
| **Tenant signup**          | ❌ 0% done   | 2h     |
| **Signup form**            | ❌ 0% done   | 1h     |
| **Admin dashboard**        | ✅ 100% done | 0h     |
| **Package CRUD**           | ✅ 100% done | 0h     |

---

## The Critical Difference

### Original Plan Assumes:

- MVP = Complete product
- Every feature must be polished
- 5-step onboarding with previews
- Analytics dashboard with trends
- Settings page with API key management
- Email templates customized per tenant

### Ruthless Plan Assumes:

- MVP = Working revenue loop
- Minimum viable is minimum
- 3-field signup form
- Stripe dashboard is analytics
- Password reset only if asked
- Generic booking confirmation email

---

## Timeline Visualization

```
ORIGINAL 6-WEEK PLAN:
|---|---|---|---|---|---|
Weeks 1-6, all sequential, all full-featured

RUTHLESS 2-WEEK PLAN:
|-----|-----|
Week 1: Test + Verify (5 days)
Week 2: Signup + Deploy (3 days)
DONE ✅

Parallel work (user responsibility):
- Get photos ready
- Setup Stripe account
- DNS/domain if needed
```

---

## Risk Comparison

### Original Plan Risks

- Scope creep (5-step wizard is complex)
- Analytics adds database queries (perf impact?)
- Settings page adds security surface
- 6 weeks = 6 chances to discover new blockers
- Easy to get stuck on perfection

### Ruthless Plan Risks

- Photo upload tests still broken (low risk: low-priority feature)
- No analytics on day 1 (low risk: Stripe dashboard exists)
- No email delivery (low risk: file-sink works for testing)
- First tenant has minimal onboarding (acceptable: Stripe Connect is hosted flow)

**Risk level: LOWER** (fewer moving parts)

---

## Post-Launch Roadmap (Phase 1)

Once MVP ships, here's what gets added quickly:

```
Week 3 (Post-Launch):
  - Fix photo upload tests
  - Add simple analytics (revenue card)
  - Wire up Postmark email
  - Segment navigation UI

Week 4 (Post-Launch):
  - Settings page
  - Email template customization
  - Advanced analytics

Week 5+ (Future):
  - Custom domains
  - Multi-user accounts
  - White-label
  - Add-ons UI
```

---

## Cost-Benefit Analysis

### Original Plan

- **Cost:** 70 hours engineering time
- **Benefit:** Feature-complete platform
- **Risk:** High scope, perfect product
- **Time to customer:** 6 weeks

### Ruthless Plan

- **Cost:** 17-20 hours engineering time
- **Benefit:** Working revenue loop
- **Risk:** Low scope, minimalist product
- **Time to customer:** 2 weeks
- **Post-launch cost:** 40 hours to reach feature parity

**Total effort is similar, but ruthless plan ships working product 4 weeks earlier.**

---

## Decision Matrix

Use this to evaluate any feature for MVP:

```
Does this feature:

1. Directly enable a customer to book? YES → KEEP
   - Booking form ✅
   - Stripe checkout ✅
   - Confirmation page ✅

2. Directly enable a tenant to accept payments? YES → KEEP
   - Stripe Connect ✅
   - Package CRUD ✅
   - Commission calculation ✅

3. Directly enable a tenant to sign up? YES → KEEP
   - Signup form ✅
   - Signup endpoint ✅

4. Enable the platform to take commission? YES → KEEP
   - Webhook processing ✅
   - Commission calculation ✅

5. Nice-to-have but not critical? → DEFER
   - Analytics ⏸️
   - Settings page ⏸️
   - Email templates ⏸️

6. Can be faked / worked around? → SKIP
   - Photo upload tests (endpoint exists) ⏩
   - Webhook HTTP tests (endpoint works) ⏩
   - Custom domains (use path-based) ⏩
```

---

## The Actual Timeline

```
TODAY (Nov 25):
  ├─ Read this document ✅
  └─ Decide: Go ruthless or stay safe?

IF RUTHLESS:

Week 1 (Mon-Fri):
  ├─ Mon-Tue: Fix webhook tests (3-4h) + E2E verify (4h)
  ├─ Wed-Thu: Supabase Storage setup (3h)
  └─ Fri: Buffer + docs (2h)
  📊 Output: Tests passing, one booking verified, images persistent

Week 2 (Mon-Fri):
  ├─ Mon-Tue: Signup endpoint + form (3h)
  │           POST /v1/tenants/signup endpoint (2h)
  │           client/src/pages/Signup.tsx (1h)
  │
  ├─ Wed-Thu: Wire it all together + test (4h)
  │
  └─ Fri: Deploy + announce (2h)
  🚀 Output: Live platform, first tenant can sign up

Week 3 (Day 1):
  ✅ First customer books and pays

TOTAL: 17-20 engineering hours = 2-3 focused business days
```

---

## Your Decision

### Option A: Safe Path (6 weeks)

- Build everything in the original plan
- Polish before shipping
- Lower risk of bugs
- Longer time to revenue
- More engineering time

### Option B: Ruthless Path (2 weeks)

- Build only what's critical
- Ship with known gaps
- Higher MVP quality, lower product polish
- Shorter time to revenue
- Less engineering time
- Can iterate faster based on real feedback

**Recommendation: Option B**

Why? Because first customer feedback > second-guessing features.

---

_This analysis is tied to real code review of your codebase._
_File paths are accurate as of Nov 25, 2025._
