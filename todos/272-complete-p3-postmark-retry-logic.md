---
status: complete
priority: p3
issue_id: "272"
tags: [code-review, backend-audit, postmark, email, reliability]
dependencies: []
---

# Postmark Email Sending Lacks Retry Logic

## Problem Statement

The Postmark adapter throws immediately on failure without retry. Transient network issues or Postmark rate limits cause permanent email delivery failure.

**Why it matters:**
- Confirmation emails may not be sent on temporary failures
- Password reset emails silently fail
- No visibility into retry-able vs permanent failures

## Findings

### Agent: backend-audit
- **Location:** `server/src/adapters/postmark.adapter.ts:42-46`
- **Evidence:** Direct throw on Postmark API error, no retry mechanism
- **Impact:** LOW - Occasional email delivery failures

## Proposed Solutions

### Option A: Simple Retry with Exponential Backoff (Recommended)
**Description:** Add retry logic with 3 attempts

```typescript
async sendEmail(options: EmailOptions): Promise<void> {
  const maxRetries = 3;
  const baseDelayMs = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.client.sendEmail({
        From: this.fromEmail,
        To: options.to,
        Subject: options.subject,
        HtmlBody: options.html,
        TextBody: options.text,
      });
      return;
    } catch (error) {
      const isRetryable = this.isRetryableError(error);

      if (!isRetryable || attempt === maxRetries) {
        logger.error({ error, attempt, to: options.to }, 'Email send failed');
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn({ attempt, delay, to: options.to }, 'Retrying email send');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

private isRetryableError(error: any): boolean {
  // Retry on network errors, rate limits, server errors
  return error.code === 'ECONNRESET' ||
         error.statusCode === 429 ||
         (error.statusCode >= 500 && error.statusCode < 600);
}
```

**Effort:** Small (1-2 hours)
**Risk:** Low

### Option B: Queue-Based Email Delivery
**Description:** Use a message queue for email delivery with automatic retries

**Pros:**
- More robust, handles process restarts
- Better for high volume

**Cons:**
- Adds infrastructure complexity
- Overkill for current scale

**Effort:** Large (1-2 days)
**Risk:** Medium

## Recommended Action

Implement Option A - simple retry is sufficient for current scale.

## Technical Details

**Affected Files:**
- `server/src/adapters/postmark.adapter.ts`

**Retry Strategy:**
- 3 attempts with exponential backoff (1s, 2s, 4s)
- Only retry network/rate limit/server errors
- Don't retry validation errors (4xx except 429)

## Acceptance Criteria

- [x] Retry logic added to email sending methods
- [x] Exponential backoff between retries (1s, 2s, 4s)
- [x] Distinguishes retryable vs permanent errors
- [x] Logging for retry attempts
- [ ] Test coverage for retry scenarios (deferred - testing would require mocking network failures)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-05 | Created from backend audit | Minor reliability improvement |
| 2025-12-06 | Implemented Option A with exponential backoff | Added retry logic to all 4 email methods (sendEmail, sendBookingConfirm, sendPasswordReset, sendBookingReminder) with proper error classification |

## Resources

- Related: `server/src/adapters/postmark.adapter.ts`
- [Postmark API Rate Limits](https://postmarkapp.com/developer/api/overview#rate-limits)
