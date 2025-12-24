---
status: resolved
priority: p1
issue_id: '289'
tags: [code-review, security, injection, early-access]
dependencies: []
resolved_at: 2025-12-06
resolution: 'Added ts-rest contract with Zod email validation. sanitizeEmail middleware also strips invalid emails.'
---

# Email Header Injection Vulnerability

## Problem Statement

The email regex validation doesn't prevent CRLF injection, allowing attackers to inject additional email headers (Bcc, Cc) for spam relay attacks.

**Why it matters:** Attacker can use the platform as a spam relay by injecting Bcc headers to send emails to arbitrary recipients.

## Findings

**File:** `server/src/routes/auth.routes.ts` (lines 803-807)

```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  throw new ValidationError('Invalid email format');
}
// ⚠️ No check for newline characters
```

**Attack vector:**

```
POST /v1/auth/early-access
{ "email": "attacker@evil.com\nBcc: victim@example.com" }
```

The regex passes but email contains CRLF injection.

## Proposed Solutions

### Option A: Add Newline Validation (Quick Fix)

**Pros:** Minimal change
**Cons:** Manual validation
**Effort:** Small (5 min)
**Risk:** Low

```typescript
if (
  email.includes('\n') ||
  email.includes('\r') ||
  email.includes('%0d') ||
  email.includes('%0a')
) {
  throw new ValidationError('Invalid email format');
}
```

### Option B: Use Zod Email Validation (Recommended)

**Pros:** Comprehensive validation, consistent with other endpoints
**Cons:** Slight refactor
**Effort:** Small (15 min)
**Risk:** Low

```typescript
import { z } from 'zod';

const EarlyAccessSchema = z.object({
  email: z.string().email().max(254).trim().toLowerCase(),
});

const { email } = EarlyAccessSchema.parse(req.body);
```

## Recommended Action

Implement Option B - migrate to Zod validation for consistency with other auth endpoints.

## Technical Details

**Affected files:**

- `server/src/routes/auth.routes.ts` (lines 803-807)

**OWASP Category:** A03:2021 – Injection

## Acceptance Criteria

- [x] Emails with newline characters are rejected with 400 error (sanitizeEmail returns empty string)
- [x] Emails with URL-encoded newlines (%0d, %0a) are rejected (sanitized to empty)
- [x] Unit test verifies header injection payloads are blocked (early-access.http.spec.ts)
- [x] Error message doesn't reveal injection attempt details ("Email is required")

## Work Log

| Date       | Action                   | Learnings                                        |
| ---------- | ------------------------ | ------------------------------------------------ |
| 2025-12-06 | Created from code review | Security-sentinel identified SMTP injection risk |

## Resources

- PR commit: 9548fc3
- Email Header Injection: https://owasp.org/www-community/attacks/HTTP_Response_Splitting
