---
status: resolved
priority: p2
issue_id: '298'
tags: [code-review, security, logging, early-access]
dependencies: []
resolved_at: 2025-12-06
resolution: 'Already resolved in prior commit - all logger calls in early-access endpoint already use sanitizedEmail (lines 851, 861, 873, 883)'
---

# Unsanitized Email Logged - Log Injection Risk

## Problem Statement

The early-access endpoint logs the `normalizedEmail` (unsanitized) while only using `sanitizedEmail` for the HTML email template. This creates a log injection risk if logs are viewed in a dashboard that doesn't escape HTML.

**Why it matters:** If an attacker submits an XSS payload as an email, it would be escaped in the notification email but appear in plaintext in logs. If logs are displayed in a web-based log viewer, this could execute JavaScript.

## Findings

**File:** `server/src/routes/auth.routes.ts` (lines 832-839)

```typescript
// Line 816: Sanitization for HTML email
const sanitizedEmail = sanitizePlainText(normalizedEmail);

// Lines 832-839: Logging uses UNSANITIZED email
logger.info(
  {
    event: 'early_access_request',
    email: normalizedEmail, // NOT sanitizedEmail
  },
  'Early access email sent'
);
```

**Attack vector:**

```
POST /v1/auth/early-access
{ "email": "<script>alert(document.cookie)</script>@example.com" }
```

- Email template: `&lt;script&gt;...` (escaped, safe)
- Log output: `<script>alert(document.cookie)</script>@example.com` (raw, unsafe)

## Proposed Solutions

### Option A: Sanitize Before Logging (Recommended)

**Pros:** Simple one-line fix
**Cons:** None
**Effort:** Small (5 min)
**Risk:** Low

```typescript
logger.info(
  {
    event: 'early_access_request',
    email: sanitizedEmail, // Use sanitized version
  },
  'Early access email sent'
);
```

### Option B: Log Email Hash Instead

**Pros:** Privacy-friendly, no injection risk
**Cons:** Harder to debug specific requests
**Effort:** Small (10 min)
**Risk:** Low

```typescript
import crypto from 'node:crypto';

logger.info(
  {
    event: 'early_access_request',
    emailHash: crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 12),
  },
  'Early access email sent'
);
```

## Recommended Action

Implement Option A - use `sanitizedEmail` in log output.

## Technical Details

**Affected files:**

- `server/src/routes/auth.routes.ts` (lines 832-839)

**OWASP Category:** A03:2021 – Injection (Log Injection)

## Acceptance Criteria

- [x] Log output uses sanitized email
- [x] XSS payloads in email are escaped in logs
- [x] Existing logging functionality preserved
- [ ] Unit test verifies log sanitization (optional - deferred)

## Work Log

| Date       | Action                   | Learnings                                       |
| ---------- | ------------------------ | ----------------------------------------------- |
| 2025-12-06 | Created from code review | Security-sentinel identified log injection risk |

## Resources

- Commit: b787c49
- OWASP Log Injection: https://owasp.org/www-community/attacks/Log_Injection
