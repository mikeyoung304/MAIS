---
status: pending
priority: p3
issue_id: "285"
tags: [deferred, code-review, feature-gap, sms, reminders, acuity-parity]
dependencies: []
next_review: "2026-01-23"
revisit_trigger: "3 customer requests"
---

# SMS Reminders Not Implemented (Acuity Parity)

## Problem Statement

Acuity supports SMS reminders in addition to email. MAIS only has email notifications via Postmark. SMS reminders have higher engagement rates and reduce no-shows.

**Why it matters:**
- SMS open rates: 98% vs email: 20%
- Reduces no-shows by 30-50%
- Expected feature for modern scheduling
- Competitive disadvantage without it

## Findings

### Agent: architecture-strategist
- **Location:** `server/src/lib/ports.ts` (NotificationProvider interface)
- **Evidence:** Only email provider exists, no SMS interface
- **Acuity:** Up to 3 email reminders + 1 SMS reminder per appointment

## Proposed Solutions

### Option A: Twilio SMS Integration (Recommended)
**Description:** Add Twilio adapter for SMS notifications

**Interface:**
```typescript
// lib/ports.ts
interface SmsProvider {
  sendSms(to: string, body: string): Promise<{ messageId: string }>;
}

// adapters/twilio.adapter.ts
class TwilioSmsAdapter implements SmsProvider {
  async sendSms(to: string, body: string) {
    const message = await this.client.messages.create({
      to,
      from: this.fromNumber,
      body,
    });
    return { messageId: message.sid };
  }
}
```

**Schema:**
```prisma
model Booking {
  // Existing fields...
  customerPhone     String?
  smsReminderSentAt DateTime?
}

model TenantConfig {
  // Existing fields...
  smsRemindersEnabled Boolean @default(false)
  smsReminderHoursBefore Int @default(24)
}
```

**Effort:** Medium (2-3 days)
**Risk:** Low

### Option B: AWS SNS Integration
**Description:** Use AWS SNS for SMS (cheaper at scale)

**Effort:** Medium (2-3 days)
**Risk:** Low

## Recommended Action

Defer to Phase 3. Focus on core booking flow first.

## Acceptance Criteria

- [ ] SmsProvider interface defined
- [ ] Twilio adapter implemented
- [ ] Customer phone field added to booking
- [ ] SMS reminder sent 24 hours before appointment
- [ ] Tenant can enable/disable SMS
- [ ] Graceful fallback if SMS fails

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-05 | Created from Acuity comparison | Defer to Phase 3 |

## Resources

- [Twilio Node.js SDK](https://www.twilio.com/docs/libraries/node)
- [Acuity SMS Reminders](https://help.acuityscheduling.com/hc/en-us/articles/16676922487949)
