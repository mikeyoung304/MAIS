# 🤖 AUTOMATED FIX DEPLOYMENT PLAN

**Start Time**: 2025-11-14 11:05 AM
**Estimated Completion**: 6-8 hours
**Files to Modify**: ~80
**New Files to Create**: ~50
**Your Involvement**: Review only

---

## PHASE 1: CRITICAL DATA CORRUPTION FIXES (30 minutes)

**Status**: 🟢 STARTING NOW

### Subagent 1A: Schema Fixes

```
Task: Fix Customer, Venue, WebhookEvent models
Files:
- server/prisma/schema.prisma
- Create migration: add_tenant_isolation.sql
Actions:
- Add tenantId to Customer, Venue
- Fix WebhookEvent composite unique
- Add missing indexes
```

### Subagent 1B: Repository Updates

```
Task: Update all database queries for tenant isolation
Files:
- server/src/adapters/prisma/customer.repository.ts
- server/src/adapters/prisma/venue.repository.ts
- server/src/adapters/prisma/webhook.repository.ts
- server/src/services/booking.service.ts
Actions:
- Add tenantId to all queries
- Fix findUnique → findFirst with tenantId
- Update upsert operations
```

---

## PHASE 2: RACE CONDITION & PAYMENT SAFETY (1 hour)

**Status**: ⏸️ PENDING

### Subagent 2A: Stripe Idempotency

```
Task: Add idempotency keys to all Stripe operations
Files:
- server/src/adapters/stripe.adapter.ts
- server/src/services/payment.service.ts
Actions:
- Add idempotency key generation
- Store keys for retry detection
- Add to checkout, refund, transfer operations
```

### Subagent 2B: Booking Locking

```
Task: Implement pessimistic locking for bookings
Files:
- server/src/services/booking.service.ts
- server/src/adapters/prisma/booking.repository.ts
Actions:
- Add FOR UPDATE locks on date checking
- Wrap in transactions
- Add retry logic with backoff
```

### Subagent 2C: Webhook State Machine

```
Task: Fix webhook duplicate processing
Files:
- server/src/routes/webhooks.routes.ts
- server/src/adapters/prisma/webhook.repository.ts
Actions:
- Implement state machine (PENDING → PROCESSING → COMPLETED)
- Atomic state transitions
- Add orphan detection
```

---

## PHASE 3: CODE HEALTH & TYPE SAFETY (2 hours)

**Status**: ⏸️ PENDING

### Subagent 3A: TypeScript Fixes

```
Task: Remove all 116 'any' types
Files:
- server/src/routes/webhooks.routes.ts (23 any)
- client/src/lib/api.ts (18 any)
- server/src/services/*.ts
Actions:
- Define proper interfaces
- Add type guards
- Fix type assertions
```

### Subagent 3B: God Component Refactoring

```
Task: Split components > 300 lines
Files:
- client/src/components/PackagePhotoUploader.tsx (462 → 4 files)
- client/src/features/tenant-admin/TenantPackagesManager.tsx (425 → 3 files)
- client/src/features/admin/Dashboard.tsx (343 → 4 files)
Actions:
- Extract hooks
- Create sub-components
- Move API calls to services
```

### Subagent 3C: Security & Dependencies

```
Task: Fix vulnerabilities and update packages
Commands:
- npm audit fix --force
- Update js-yaml to 4.1.0
- Update critical packages
```

---

## PHASE 4: CUSTOMER FEATURES (2 hours)

**Status**: ⏸️ PENDING

### Subagent 4A: Email Service

```
Task: Create email service with templates
New Files:
- server/src/services/email.service.ts
- server/src/templates/booking-confirmation.hbs
- server/src/templates/cancellation.hbs
- server/src/templates/reminder.hbs
Actions:
- Integrate SendGrid/Resend
- Create template engine
- Add to booking flow
```

### Subagent 4B: Customer Portal

```
Task: Build customer booking portal
New Files:
- client/src/features/customer/CustomerPortal.tsx
- client/src/features/customer/MyBookings.tsx
- client/src/features/customer/BookingDetails.tsx
- client/src/features/customer/CancelBooking.tsx
- server/src/routes/customer.routes.ts
Actions:
- List bookings
- View details
- Cancel/refund flow
- Email preferences
```

### Subagent 4C: Cancellation System

```
Task: Implement cancellation workflow
Files:
- server/src/services/cancellation.service.ts
- server/src/services/refund.service.ts
Actions:
- Calculate refund amount
- Process Stripe refund
- Update booking status
- Send confirmation email
```

---

## PHASE 5: COMPLIANCE & LEGAL (1 hour)

**Status**: ⏸️ PENDING

### Subagent 5A: Terms & Privacy

```
Task: Add legal acceptance flow
New Files:
- client/src/components/TermsOfService.tsx
- client/src/components/PrivacyPolicy.tsx
- client/src/components/LegalCheckbox.tsx
- server/src/routes/legal.routes.ts
Actions:
- Display terms/privacy
- Track acceptance
- Version management
- Audit trail
```

### Subagent 5B: GDPR Compliance

```
Task: Implement data rights
New Files:
- server/src/services/gdpr.service.ts
- server/src/routes/gdpr.routes.ts
- client/src/features/privacy/DataExport.tsx
- client/src/features/privacy/DataDeletion.tsx
Actions:
- Export user data (JSON/CSV)
- Delete user data
- Consent tracking
- Data retention policy
```

### Subagent 5C: Error Tracking

```
Task: Add Sentry integration
Files:
- server/src/index.ts
- client/src/main.tsx
- Add error boundaries
Actions:
- Initialize Sentry
- Add context
- User feedback
- Performance monitoring
```

---

## PHASE 6: TESTING & COVERAGE (2 hours)

**Status**: ⏸️ PENDING

### Subagent 6A: Unit Tests

```
Task: Increase coverage from 51% to 70%
New Files:
- server/test/services/payment.service.test.ts
- server/test/services/booking.service.test.ts
- server/test/services/commission.service.test.ts
- server/test/race-conditions.test.ts
Actions:
- Test critical paths
- Test edge cases
- Mock external services
```

### Subagent 6B: Integration Tests

```
Task: Add integration tests
New Files:
- server/test/integration/booking-flow.test.ts
- server/test/integration/payment-flow.test.ts
- server/test/integration/tenant-isolation.test.ts
Actions:
- Test full workflows
- Test tenant isolation
- Test webhooks
```

### Subagent 6C: E2E Test Fixes

```
Task: Fix failing E2E tests
Files:
- e2e/tests/*.spec.ts
- e2e/playwright.config.ts
Actions:
- Fix server startup
- Fix test data
- Add retries
- Improve selectors
```

---

## 🚀 BEGINNING PHASE 1 NOW...

Starting with the most critical data corruption fixes. Will update progress as each subagent completes.
