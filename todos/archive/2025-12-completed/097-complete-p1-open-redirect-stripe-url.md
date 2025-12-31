---
status: complete
priority: p1
issue_id: '097'
tags: [code-review, security, ui-redesign]
dependencies: []
---

# Open Redirect Vulnerability via Unvalidated Stripe URL

## Problem Statement

The StripeConnectCard component redirects users to Stripe URLs without validating that they originate from Stripe's domain. An attacker who compromises the backend or performs a MITM attack could inject a malicious URL, leading to phishing attacks.

**Why it matters:** This is a security vulnerability that could expose users to credential theft via phishing.

## Findings

### From security-sentinel agent:

**File:** `client/src/features/tenant-admin/TenantDashboard/StripeConnectCard.tsx`
**Lines:** 130, 152

```typescript
// Line 130 - Direct redirect without validation
window.location.href = result.body.url;

// Line 152 - Opens in new tab without validation
window.open(result.body.url, '_blank');
```

**Attack Scenario:**

1. Attacker compromises backend API or performs response manipulation
2. Backend returns malicious URL in `result.body.url`
3. User is redirected to attacker-controlled phishing site

## Proposed Solutions

### Solution 1: URL Validation Helper (Recommended)

**Pros:** Simple, focused fix
**Cons:** Requires maintenance if Stripe changes domains
**Effort:** Small (30 min)
**Risk:** Low

```typescript
const validateStripeUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.stripe.com') || parsed.hostname === 'stripe.com';
  } catch {
    return false;
  }
};

// Before redirect
if (result.status === 200 && result.body?.url) {
  if (!validateStripeUrl(result.body.url)) {
    setError('Invalid redirect URL from server');
    return;
  }
  window.location.href = result.body.url;
}
```

### Solution 2: Backend-Only Validation

**Pros:** Single source of truth
**Cons:** Doesn't protect against MITM
**Effort:** Medium
**Risk:** Medium

Add validation on the server side before returning URLs.

## Recommended Action

Implement Solution 1 - client-side URL validation as defense-in-depth.

## Technical Details

**Affected files:**

- `client/src/features/tenant-admin/TenantDashboard/StripeConnectCard.tsx`

**Components affected:**

- StripeConnectCard

## Acceptance Criteria

- [ ] Stripe URLs are validated before redirect
- [ ] Non-Stripe URLs are rejected with user-friendly error
- [ ] Unit test covers validation logic
- [ ] Manual test confirms redirect works for valid Stripe URLs

## Work Log

| Date       | Action                   | Learnings                         |
| ---------- | ------------------------ | --------------------------------- |
| 2025-11-30 | Created from code review | Security vulnerability identified |

## Resources

- PR: UI redesign uncommitted changes
- OWASP Open Redirect: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/04-Testing_for_Client-side_URL_Redirect
