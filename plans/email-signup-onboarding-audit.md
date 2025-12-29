# Email Configuration Verification & Signup Notification

## Summary

Verify production email delivery works and add admin notification for tenant signups.

**Original Question:** "Is the system production-ready for users to begin signing up?"

**Answer:** Yes, with one verification and one small addition.

---

## Current State

| Feature                    | Status   | Notes                                   |
| -------------------------- | -------- | --------------------------------------- |
| Early access form          | COMPLETE | 12 E2E tests passing                    |
| Early access notifications | COMPLETE | Admin + user emails implemented         |
| Signup flow                | COMPLETE | Creates tenant + default data           |
| Dashboard                  | COMPLETE | Quick actions, Stripe card, trial cards |
| Stripe Connect             | COMPLETE | Full onboarding flow                    |
| Trial system               | COMPLETE | 14-day trial with countdown             |
| **Email delivery**         | VERIFY   | Check Postmark token in production      |
| **Signup notification**    | MISSING  | Admin not notified of new tenants       |

---

## Action Items

### 1. Verify Production Email Config (15 min)

**Goal:** Confirm emails actually send in production

**Steps:**

1. Check Render dashboard for these env vars:
   - `POSTMARK_SERVER_TOKEN` - Required for real emails
   - `POSTMARK_FROM_EMAIL` - Sender address (must be verified in Postmark)
   - `EARLY_ACCESS_NOTIFICATION_EMAIL` - Defaults to `mike@maconheadshots.com`

2. Submit test early access request on production site

3. Confirm both emails arrive:
   - User confirmation ("You're in.")
   - Admin notification ("Early Access: {email}")

**If emails go to file-sink:** Token not set, fix in Render dashboard.

---

### 2. Add Tenant Signup Admin Notification (1-2 hours)

**Goal:** Admin receives email when someone signs up

**Files to modify:**

| File                               | Change                                 |
| ---------------------------------- | -------------------------------------- |
| `server/src/lib/core/config.ts:45` | Add `ADMIN_NOTIFICATION_EMAIL` config  |
| `server/src/routes/auth.routes.ts` | Add notification after tenant creation |
| `server/.env.example`              | Document new env var                   |

**Implementation:**

```typescript
// server/src/lib/core/config.ts
ADMIN_NOTIFICATION_EMAIL: z.string().email().optional().default('mike@maconheadshots.com'),

// server/src/routes/auth.routes.ts (after successful tenant creation)
// IMPORTANT: Wrap in try/catch - notification failure should NOT fail signup
if (mailProvider) {
  try {
    await mailProvider.sendEmail({
      to: config.ADMIN_NOTIFICATION_EMAIL,
      subject: `New Signup: ${businessName}`,
      html: `... inline HTML template matching early access style ...`
    });
    logger.info({ tenantId, email }, 'Tenant signup notification sent');
  } catch (notificationError) {
    logger.warn({ tenantId, error: notificationError }, 'Failed to send signup notification');
    // Continue - signup succeeded, notification is best-effort
  }
}
```

**Tests to add:**

- Unit test: Verify `mailProvider.sendEmail` called with correct params after signup
- Integration test: Verify email sent (or file-sink written) on successful signup

---

### 3. Production Test (5 min)

After deploying:

1. Create test tenant on production
2. Verify admin receives notification email
3. Verify user lands on functional dashboard

---

## Acceptance Criteria

- [ ] `POSTMARK_SERVER_TOKEN` verified set in production
- [ ] Early access test email received by admin
- [x] Tenant signup notification implemented (commit 0927833)
- [x] Signup notification has try/catch (doesn't break signup)
- [x] Test added for signup notification (9 tests pass)
- [ ] Admin receives notification for test signup

---

## Key Files Reference

| File                                              | Purpose                                       |
| ------------------------------------------------- | --------------------------------------------- |
| `server/src/routes/auth.routes.ts:913-955`        | Early access notification (copy this pattern) |
| `server/src/lib/core/config.ts:45`                | Add config here                               |
| `server/src/adapters/postmark.adapter.ts:117-130` | File-sink fallback logic                      |

---

## Deferred (Future Backlog)

These items were identified but deferred per reviewer feedback:

- Onboarding checklist component (dashboard already has contextual guidance)
- Welcome email for signups (users land on dashboard, that's enough)
- Early access to signup conversion tracking (Mike emails manually, that works)

Create separate backlog items when actual user feedback indicates need.

---

## Reviewer Sign-off

| Reviewer   | Verdict              | Key Feedback                                                 |
| ---------- | -------------------- | ------------------------------------------------------------ |
| DHH        | APPROVE WITH CHANGES | "Ship what works. 15 min verify, 1 hour notification, done." |
| Kieran     | APPROVE WITH CHANGES | "Add try/catch, add tests, follow existing patterns."        |
| Simplicity | APPROVE WITH CHANGES | "Only 3 action items needed. Cut everything else."           |
