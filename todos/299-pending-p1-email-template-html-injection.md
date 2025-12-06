---
status: pending
priority: p1
issue_id: "299"
tags: [code-review, security, xss, email-template, early-access]
dependencies: []
---

# Email Template HTML Injection Risk

## Problem Statement

The early-access notification email template constructs HTML using string interpolation without proper escaping. While `sanitizePlainText` is used for the email address, it only escapes basic characters and may not cover all HTML injection vectors.

**Why it matters:** An attacker could craft a malicious email address that bypasses `sanitizePlainText` and injects HTML/JavaScript into the notification email sent to administrators.

## Findings

**File:** `server/src/routes/auth.routes.ts` (lines ~838-872)

```typescript
const sanitizedEmail = sanitizePlainText(normalizedEmail);
// ...
const htmlBody = `
<html>
<head>...</head>
<body>
  <p>Email: ${sanitizedEmail}</p>  // Potentially unsafe interpolation
</body>
</html>
`;
```

**Current `sanitizePlainText` implementation:**
The function escapes `<`, `>`, `&`, `"`, `'` characters. However:
1. HTML entity encoding may be incomplete for edge cases
2. No validation that result is safe for HTML context
3. Defense-in-depth suggests using a dedicated HTML escaping library

**Attack vectors to verify:**
- Unicode homoglyphs: `admin@maсon.com` (Cyrillic 'с')
- HTML entities: `&lt;script&gt;` pre-encoded
- Null byte injection: `admin%00<script>@example.com`

## Proposed Solutions

### Option A: Use Dedicated HTML Escaping Library (Recommended)
**Pros:** Battle-tested, covers edge cases
**Cons:** Additional dependency
**Effort:** Small (15 min)
**Risk:** Low

```typescript
import { escape as escapeHtml } from 'lodash';
// or
import he from 'he';

const htmlSafeEmail = he.encode(normalizedEmail);
const htmlBody = `<p>Email: ${htmlSafeEmail}</p>`;
```

### Option B: Use Text-Only Email Template
**Pros:** Eliminates HTML injection entirely
**Cons:** Less visually appealing notification
**Effort:** Small (10 min)
**Risk:** Low

```typescript
// Send plain text only
await postmarkProvider.sendEmail({
  to: config.EARLY_ACCESS_NOTIFICATION_EMAIL,
  subject: 'New Early Access Request',
  textBody: `New early access request from: ${normalizedEmail}`,
  // No htmlBody
});
```

### Option C: Verify and Strengthen sanitizePlainText
**Pros:** No new dependencies
**Cons:** May miss edge cases, requires security review
**Effort:** Medium (30 min)
**Risk:** Medium

## Recommended Action

Implement Option A - use a dedicated HTML escaping library like `he` or `lodash.escape`.

## Technical Details

**Affected files:**
- `server/src/routes/auth.routes.ts` (email template construction)
- `server/src/lib/sanitize.ts` (verify sanitizePlainText coverage)

**OWASP Category:** A03:2021 – Injection (HTML Injection / XSS)

## Acceptance Criteria

- [ ] Email template uses proper HTML escaping
- [ ] Attack vectors verified safe (unicode, entities, null bytes)
- [ ] Existing tests pass
- [ ] Security test added for HTML injection

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-06 | Created from code review | Security-sentinel identified HTML injection risk in email template |

## Resources

- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- `he` library: https://github.com/mathiasbynens/he
