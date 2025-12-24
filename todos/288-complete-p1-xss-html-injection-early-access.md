---
status: resolved
priority: p1
issue_id: '288'
tags: [code-review, security, xss, early-access]
dependencies: []
resolved_at: 2025-12-06
resolution: 'Added sanitizePlainText() call in auth.routes.ts before injecting email into HTML template'
---

# XSS via HTML Injection in Early Access Email

## Problem Statement

The early access email notification embeds user-provided email directly into HTML without sanitization, allowing XSS attacks.

**Why it matters:** Attacker can inject malicious HTML/JavaScript that executes in the admin's email client, potentially stealing session cookies or spoofing content.

## Findings

**File:** `server/src/routes/auth.routes.ts` (lines 817-827)

```typescript
html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2c5f4e;">New Early Access Request</h2>
    <p>Someone wants early access to MaconAI!</p>
    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Email:</strong> ${normalizedEmail}</p>  // ⚠️ UNSANITIZED
      <p style="margin: 8px 0 0;"><strong>Time:</strong> ${new Date().toISOString()}</p>
    </div>
  </div>
`,
```

**Attack vector:**

```
POST /v1/auth/early-access
{ "email": "<img src=x onerror=alert(document.cookie)>@example.com" }
```

This passes email regex validation but injects malicious HTML.

## Proposed Solutions

### Option A: HTML Escape Function (Recommended)

**Pros:** Simple, no dependencies
**Cons:** Must remember to use everywhere
**Effort:** Small (15 min)
**Risk:** Low

```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

html: `<p><strong>Email:</strong> ${escapeHtml(normalizedEmail)}</p>`;
```

### Option B: Use html-escaper Package

**Pros:** Battle-tested library
**Cons:** Adds dependency
**Effort:** Small (10 min)
**Risk:** Low

```typescript
import { escape } from 'html-escaper';
html: `<p><strong>Email:</strong> ${escape(normalizedEmail)}</p>`;
```

## Recommended Action

Implement Option A - add escapeHtml utility function to avoid new dependency.

## Technical Details

**Affected files:**

- `server/src/routes/auth.routes.ts` (lines 817-827)

**OWASP Category:** A03:2021 – Injection

## Acceptance Criteria

- [x] Email containing `<script>` tags is escaped in notification
- [x] Email containing HTML entities displays correctly
- [x] Unit test verifies XSS payloads are sanitized (early-access.http.spec.ts)
- [x] No new npm dependencies added (used existing sanitizePlainText)

## Work Log

| Date       | Action                   | Learnings                                   |
| ---------- | ------------------------ | ------------------------------------------- |
| 2025-12-06 | Created from code review | Security-sentinel agent identified XSS risk |

## Resources

- PR commit: 9548fc3
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
