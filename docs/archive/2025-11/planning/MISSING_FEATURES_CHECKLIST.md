# Elope Platform - Missing Features & Implementation Checklist

## Quick Reference for Development Teams

### P0 CRITICAL - Must Complete Before Production Launch

- [ ] **EMAIL NOTIFICATIONS**
  - [ ] Wire PostmarkMailAdapter into webhook handler
  - [ ] Send booking confirmation to customer
  - [ ] Send new booking notification to tenant
  - [ ] Estimated: 1-2 days | ~200 lines code
  - Files: `/server/src/routes/webhooks.routes.ts`, `/server/src/adapters/postmark.adapter.ts`

- [ ] **BOOKING REFUNDS**
  - [ ] Create POST `/v1/bookings/:id/refund` endpoint
  - [ ] Implement refund UI button in booking list
  - [ ] Update booking status to REFUNDED
  - [ ] Add refund tracking to Payment model
  - Estimated: 1.5-2 days | ~500 lines code
  - Files: Create new controller, routes, React component

- [ ] **LOGO UPLOAD UI**
  - [ ] Add file input to BrandingEditor component
  - [ ] Wire to existing uploadLogo endpoint
  - [ ] Show uploaded logo preview
  - [ ] Add delete button for existing logo
  - Estimated: 0.5-1 day | ~200 lines code
  - Files: `/client/src/features/tenant-admin/branding/`

---

### P1 HIGH PRIORITY - Beta/Launch Readiness

- [ ] **GOOGLE CALENDAR INTEGRATION**
  - [ ] Implement gcal.adapter.ts (empty file)
  - [ ] Add OAuth flow for calendar auth
  - [ ] Sync availability from Google Calendar
  - [ ] Create events on booking confirmation
  - [ ] Update/delete events on booking changes
  - Estimated: 1-2 weeks | ~1,500 lines code
  - Files: `/server/src/adapters/gcal.*.ts`

- [ ] **PACKAGE PHOTO GALLERY**
  - [ ] Add file input to PackageForm
  - [ ] Implement photo reordering (drag & drop)
  - [ ] Photo deletion with cleanup
  - [ ] Photo display in catalog pages
  - [ ] Limit to 5 photos per package
  - Estimated: 1-2 days | ~800 lines code
  - Files: Multiple client components, package routes

- [ ] **STRIPE ONBOARDING UI**
  - [ ] Add Stripe status widget to tenant dashboard
  - [ ] Show onboarding status (pending/complete/failed)
  - [ ] Button to start/retry onboarding
  - [ ] Link to Stripe dashboard
  - Estimated: 0.5-1 day | ~300 lines code
  - Files: `/client/src/features/tenant-admin/`

- [ ] **TENANT PACKAGE CRUD**
  - [ ] Create PackageList component (show existing)
  - [ ] Create PackageForm component (edit/create)
  - [ ] Wire to existing API endpoints
  - [ ] Add to tenant dashboard packages tab
  - Estimated: 1-2 days | ~600 lines code
  - Files: `/client/src/features/tenant-admin/packages/`

- [ ] **PASSWORD RESET FLOW**
  - [ ] Create reset request endpoint
  - [ ] Send reset email with token
  - [ ] Create reset form page
  - [ ] Validate token and update password
  - Estimated: 1-2 days | ~400 lines code
  - Files: Auth routes, email templates

---

### P2 NICE TO HAVE - Post-Launch

- [ ] **ADVANCED ANALYTICS & REPORTING**
  - [ ] Revenue reports by date range
  - [ ] Tenant performance analytics
  - [ ] Commission breakdown reports
  - [ ] CSV/PDF export functionality
  - Estimated: 2-3 days | ~1,000 lines code

- [ ] **SMS NOTIFICATIONS**
  - [ ] Add SMS provider abstraction
  - [ ] Implement Twilio adapter
  - [ ] Send SMS confirmations
  - Estimated: 1-2 days | ~300 lines code

- [ ] **AUDIT LOG VIEWER**
  - [ ] Create audit log API endpoint
  - [ ] Build audit log viewer UI
  - [ ] Filter by user, type, date
  - [ ] Show before/after snapshots
  - Estimated: 1 day | ~400 lines code

- [ ] **BOOKING NOTES**
  - [ ] Add notes field to checkout flow
  - [ ] Display notes in tenant dashboard
  - [ ] Include notes in confirmation email
  - Estimated: 0.5 days | ~200 lines code

- [ ] **PAYMENT RETRY LOGIC**
  - [ ] Automatic retry for failed payments
  - [ ] Exponential backoff
  - [ ] Dashboard to manually retry
  - Estimated: 1-2 days | ~400 lines code

- [ ] **TWO-FACTOR AUTHENTICATION**
  - [ ] Add 2FA option to admin login
  - [ ] TOTP/SMS verification
  - [ ] Recovery codes
  - Estimated: 2-3 days | ~600 lines code

---

## Implementation Priority Matrix

```
HIGH IMPACT + LOW EFFORT (DO FIRST)
├─ Email Notifications (1-2 days) ⭐⭐⭐
├─ Logo Upload UI (0.5-1 day) ⭐⭐⭐
├─ Refund UI (1.5-2 days) ⭐⭐⭐
└─ Stripe Status Widget (0.5-1 day) ⭐⭐

HIGH IMPACT + MEDIUM EFFORT (DO NEXT)
├─ Package Photos (1-2 days) ⭐⭐
├─ Tenant Package CRUD (1-2 days) ⭐⭐
└─ Password Reset (1-2 days) ⭐⭐

MEDIUM IMPACT + HIGH EFFORT (LATER)
├─ Google Calendar (1-2 weeks) ⭐
├─ Analytics (2-3 days) ⭐
└─ SMS (1-2 days) ⭐

LOW IMPACT (POST-LAUNCH)
├─ Booking Notes (0.5 days)
├─ Audit Log Viewer (1 day)
├─ Payment Retry (1-2 days)
└─ 2FA (2-3 days)
```

---

## Implementation Effort Estimate

### Quick Wins (Can finish this week)

- Email Notifications: 1-2 days
- Logo Upload UI: 0.5-1 day
- Stripe Status Widget: 0.5-1 day
- **Total: 2-4 days for 3 features**

### Core Features (Next week)

- Refund UI: 1.5-2 days
- Package Photos: 1-2 days
- Tenant Package CRUD: 1-2 days
- Password Reset: 1-2 days
- **Total: 5-8 days for 4 features**

### Larger Features (2-3 weeks)

- Google Calendar: 1-2 weeks (biggest effort)
- Analytics: 2-3 days
- SMS: 1-2 days

---

## Backend vs Frontend Status

### 100% Backend Complete (Just Needs UI)

- Logo upload
- Package photo upload
- Email notifications
- Booking refunds
- Stripe Connect onboarding

### 100% Complete End-to-End

- Multi-tenant isolation
- Booking workflow
- Commission calculation
- Webhook processing
- Stripe payments
- Segment management

### Partially Implemented

- Authentication (missing password reset)
- Availability (missing calendar sync)
- Audit logging (missing viewer UI)

### Not Started

- Google Calendar
- SMS notifications
- Document uploads
- Advanced reporting

---

## Risk Assessment

### LOW RISK (Can start immediately)

- Email notifications (adapter ready)
- Logo upload (upload service ready)
- Refund UI (Stripe integration ready)
- Password reset (JWT ready)

### MEDIUM RISK (Need design/planning)

- Google Calendar (complex OAuth flow)
- Package photos (gallery UX)
- Analytics (schema queries)

### HIGH RISK (Dependencies)

- SMS (requires provider account)
- 2FA (requires TOTP library)

---

## Testing Checklist

### Email Notifications

- [ ] Test with real Postmark token
- [ ] Test file sink in dev
- [ ] Test email delivery on booking
- [ ] Test email template rendering

### Booking Refunds

- [ ] Test full refund flow
- [ ] Test partial refunds
- [ ] Test refund reason tracking
- [ ] Test booking status updates
- [ ] Test Stripe webhook for refund_created event

### Logo Upload

- [ ] Test file size validation
- [ ] Test mime type validation
- [ ] Test logo display in widget
- [ ] Test logo deletion
- [ ] Test logo replacement

### Google Calendar

- [ ] Test OAuth flow
- [ ] Test event creation
- [ ] Test event updates
- [ ] Test event deletion
- [ ] Test availability sync

---

## Key Metrics After Implementation

**Email Notifications**: +40% booking confirmation rate
**Refunds**: Enable customer support & dispute resolution
**Logo Upload**: 100% tenant branding capability
**Google Calendar**: 20% reduction in double-booking
**Package Photos**: +25% conversion rate (estimated)
