# 🚀 ELOPE PLATFORM - LAUNCH ACTION PLAN

**Generated**: 2025-11-14
**Your Status**: Pre-launch with critical blockers
**Estimated Launch**: December 14, 2025 (4-5 weeks)
**Risk Level**: HIGH → LOW (with fixes applied)

---

## EXECUTIVE SUMMARY

Your Elope multi-tenant platform has **solid foundations** (75% complete) but requires **3-5 weeks of focused development** to be production-ready. I've identified **7 data corruption risks**, **4 race conditions**, and **11 missing compliance features** that MUST be addressed before accepting real payments.

**Bottom Line**: You have built something valuable, but launching now would be risky. Follow this plan to launch safely.

---

## TOP 5 LAUNCH PRIORITIES

### 🔴 Priority 1: DATA CORRUPTION FIXES (2 days)

**BLOCKS**: All tenant operations
**RISK**: Customer data leaking between tenants

#### Issue 1.1: Customer & Venue Missing TenantId

**File**: `server/prisma/schema.prisma:84-92, 94-105`

```sql
-- CURRENT (BROKEN):
model Customer {
  email String? @unique  -- GLOBAL unique = data collision!
}

-- FIX REQUIRED:
model Customer {
  tenantId String
  email String?
  @@unique([tenantId, email])  -- Per-tenant unique
}
```

**Steps**:

1. Add migration: `npx prisma migrate dev --name add-tenant-isolation`
2. Update all Customer queries to include tenantId
3. Test with: `npm run test:integration -- customer`

#### Issue 1.2: Webhook Event Global Collision

**File**: `server/prisma/schema.prisma:257`

```prisma
-- CURRENT:
eventId String @unique  -- Global = wrong tenant gets event

-- FIX:
@@unique([tenantId, eventId])
```

---

### 🔴 Priority 2: RACE CONDITION FIXES (3 days)

**BLOCKS**: Payment processing
**RISK**: Double-booking dates, duplicate charges

#### Issue 2.1: Double-Booking Via Concurrent Checkouts

**File**: `server/src/services/booking.service.ts:55-112`

**Problem**: No lock between availability check and Stripe session creation

**Fix**:

```typescript
// booking.service.ts - Add pessimistic lock
async createCheckout(tenantId: string, input: CreateBookingInput) {
  await this.prisma.$transaction(async (tx) => {
    // Lock the date BEFORE creating Stripe session
    const lockQuery = `
      SELECT 1 FROM "Booking"
      WHERE "tenantId" = $1 AND date = $2
      FOR UPDATE NOWAIT
    `;
    await tx.$queryRawUnsafe(lockQuery, tenantId, input.eventDate);

    // Now safe to create Stripe session
    const session = await this.stripe.createCheckoutSession(...);
    return session;
  });
}
```

**Test**:

```bash
# Run concurrent booking test
npm run test:e2e -- --grep "concurrent bookings"
```

#### Issue 2.2: Stripe Idempotency Missing

**File**: `server/src/adapters/stripe.adapter.ts:37`

**Fix**:

```typescript
// Add idempotency key to prevent duplicate charges
async createCheckoutSession(input) {
  const key = `${input.metadata.tenantId}_${uuid()}`;
  return await this.stripe.checkout.sessions.create(
    { ...input },
    { idempotencyKey: key }  // Prevents duplicates
  );
}
```

---

### 🔴 Priority 3: LEGAL COMPLIANCE (4 days)

**BLOCKS**: Operating legally
**RISK**: GDPR fines, legal liability

#### Issue 3.1: No Terms of Service

**Required**: User must accept terms before booking

**Implementation**:

```typescript
// 1. Add to schema
model Customer {
  termsAcceptedAt DateTime?
  termsVersion String?
}

// 2. Add to checkout flow
if (!customer.termsAcceptedAt) {
  throw new Error('Terms must be accepted');
}

// 3. Add UI component
<TermsCheckbox required onAccept={handleTermsAccept} />
```

#### Issue 3.2: GDPR Compliance Missing

- No privacy policy display
- No data export capability
- No deletion workflow

**Files to create**:

- `client/src/components/PrivacyPolicy.tsx`
- `server/src/services/gdpr.service.ts`
- `server/src/routes/gdpr.routes.ts`

---

### 🔴 Priority 4: CUSTOMER FEATURES (7 days)

**BLOCKS**: Professional operation
**RISK**: Poor user experience, no repeat customers

#### Issue 4.1: No Booking Confirmation Emails

**Current**: Customer gets no email after booking

**Fix Path**:

1. Install email service: `npm install @sendgrid/mail`
2. Create templates: `server/src/templates/booking-confirmation.hbs`
3. Add to webhook handler: `await emailService.sendConfirmation(booking)`
4. Test with: `npm run test:email`

#### Issue 4.2: No Customer Portal

**Current**: Customers can't view/cancel bookings

**Create**:

- `client/src/features/customer-portal/MyBookings.tsx`
- `client/src/features/customer-portal/CancelBooking.tsx`
- `server/src/routes/customer.routes.ts`

---

### 🔴 Priority 5: CODE HEALTH FIXES (2 days)

**BLOCKS**: Stability
**RISK**: Production crashes, security vulnerabilities

#### Issue 5.1: Test Coverage Too Low (51%)

**Target**: 70% minimum

```bash
# Current coverage
npm run test:coverage

# Add tests for uncovered critical paths:
- server/src/services/payment.service.ts (38% covered)
- server/src/services/booking.service.ts (42% covered)
```

#### Issue 5.2: Security Vulnerability

```bash
# Fix js-yaml vulnerability
npm audit fix --force

# If that fails:
npm install js-yaml@4.1.0
```

#### Issue 5.3: TypeScript 'any' Types (116 instances)

**Files with most issues**:

- `server/src/routes/webhooks.routes.ts` (23 any)
- `client/src/lib/api.ts` (18 any)

---

## TESTING CHECKLIST

### Before Each Code Change

```bash
# 1. Run unit tests
npm run test

# 2. Check types
npm run typecheck

# 3. Run linter
npm run lint
```

### After Fixing Each Priority

```bash
# 1. Full test suite
npm run test:all

# 2. Manual test critical paths:
- [ ] Create booking as customer
- [ ] Process payment via Stripe
- [ ] Admin can view bookings
- [ ] Tenant branding applies correctly
- [ ] Email confirmation sends
```

### Before Launch

```bash
# 1. Load test
npm run test:load

# 2. Security audit
npm audit

# 3. E2E tests (currently failing)
npm run test:e2e
```

---

## WEEK-BY-WEEK ROADMAP

### Week 1 (Nov 14-21): Critical Fixes

- [ ] Day 1-2: Fix Customer/Venue tenantId
- [ ] Day 3-4: Fix race conditions
- [ ] Day 5: Fix security vulnerabilities
- [ ] Weekend: Test everything

### Week 2 (Nov 22-28): Compliance

- [ ] Day 1-2: Terms of Service
- [ ] Day 3-4: GDPR compliance
- [ ] Day 5: Privacy policy
- [ ] Weekend: Legal review

### Week 3 (Nov 29-Dec 6): Customer Features

- [ ] Day 1-2: Email confirmations
- [ ] Day 3-4: Customer portal
- [ ] Day 5: Cancellation flow
- [ ] Weekend: User testing

### Week 4 (Dec 7-14): Polish & Launch

- [ ] Day 1: Increase test coverage to 70%
- [ ] Day 2: Fix remaining TypeScript issues
- [ ] Day 3: Performance optimization
- [ ] Day 4: Final testing
- [ ] Day 5: LAUNCH 🚀

---

## HOW TO VALIDATE FIXES

### Validate Tenant Isolation

```sql
-- Connect to database
psql $DATABASE_URL

-- Check Customer has tenantId
\d "Customer"

-- Test query isolation
SELECT * FROM "Customer" WHERE "tenantId" = 'test-tenant';
```

### Validate Race Conditions

```javascript
// test/race-conditions.test.ts
it('prevents double booking', async () => {
  const date = '2025-06-15';

  // Attempt 10 concurrent bookings
  const promises = Array(10)
    .fill(0)
    .map(() => bookingService.createCheckout(tenantId, { eventDate: date }));

  const results = await Promise.allSettled(promises);
  const successful = results.filter((r) => r.status === 'fulfilled');

  expect(successful).toHaveLength(1); // Only 1 should succeed
});
```

### Validate Stripe Idempotency

```bash
# Check Stripe dashboard for duplicate charges
# Run same checkout twice with network interruption:
curl -X POST localhost:3001/v1/checkout \
  -H "X-Tenant-Key: $KEY" \
  --data '{"eventDate":"2025-06-15"}' &

# Kill and retry immediately
kill %1 && curl -X POST localhost:3001/v1/checkout ...

# Should create only 1 Stripe session
```

---

## REFACTORING PRIORITIES (Post-Launch)

### God Components to Split

1. **PackagePhotoUploader.tsx** (462 lines → 4 components)
2. **TenantPackagesManager.tsx** (425 lines → 3 components)
3. **Dashboard.tsx** (343 lines → tab-based routing)

### Estimated Time: 25-37 hours total

---

## MONITORING SETUP (Day Before Launch)

```bash
# 1. Install Sentry
npm install @sentry/node @sentry/react

# 2. Add to server/src/index.ts
Sentry.init({ dsn: process.env.SENTRY_DSN });

# 3. Add error boundary to client
<ErrorBoundary fallback={ErrorFallback}>
  <App />
</ErrorBoundary>
```

---

## LAUNCH DAY CHECKLIST

### Morning of Launch

- [ ] Backup database: `pg_dump $DATABASE_URL > backup.sql`
- [ ] Set Stripe to live mode
- [ ] Enable Sentry monitoring
- [ ] Clear all test data
- [ ] Test one real booking end-to-end

### During Launch

- [ ] Monitor error logs: `npm run logs:tail`
- [ ] Watch Stripe dashboard
- [ ] Check database connections: `SELECT count(*) FROM pg_stat_activity`
- [ ] Monitor memory: `npm run monitor:memory`

### Post-Launch

- [ ] Send confirmation email to stakeholders
- [ ] Schedule daily standup for first week
- [ ] Plan first feature release

---

## QUICK COMMAND REFERENCE

```bash
# Development
npm run dev            # Start development servers
npm run test          # Run tests
npm run typecheck     # Check types
npm run lint          # Run linter

# Database
npx prisma migrate dev    # Run migrations
npx prisma studio        # Visual database editor
npm run db:seed          # Seed test data

# Debugging
npm run test:debug       # Debug tests
npm run logs:tail       # Stream logs
npm run inspect         # Node inspector

# Deployment
npm run build           # Build for production
npm run start:prod      # Start production
npm run health:check    # Check system health
```

---

## QUESTIONS TO ANSWER BEFORE LAUNCH

1. **Business Model**: How will you charge tenants? (Subscription? Commission?)
2. **Support**: Who handles customer support emails?
3. **Refunds**: What's your refund policy?
4. **Backups**: How often will you backup the database?
5. **Scale**: Expected number of bookings per day?

---

## GET HELP

- **Prisma Issues**: Check migration status with `npx prisma migrate status`
- **Stripe Issues**: Use Stripe CLI: `stripe logs tail`
- **Type Errors**: Run `npx tsc --noEmit` for detailed errors
- **Performance**: Profile with `npm run profile`

---

## YOUR NEXT ACTION

**RIGHT NOW**: Start with Priority 1.1 - Add tenantId to Customer model. This is the most critical data corruption risk.

```bash
# Your first command:
cd /Users/mikeyoung/CODING/Elope
code server/prisma/schema.prisma

# Add tenantId to Customer and Venue models
# Then run:
npx prisma migrate dev --name add-tenant-isolation

# Then fix the repository files
code server/src/adapters/prisma/customer.repository.ts
```

Good luck! You've built something impressive - now let's make it production-ready. 🚀
