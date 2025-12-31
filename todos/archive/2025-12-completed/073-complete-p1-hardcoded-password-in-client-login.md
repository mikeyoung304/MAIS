---
status: complete
priority: p1
issue_id: '073'
tags: [security, code-review, client, credential-exposure]
dependencies: []
---

# P1: Hardcoded Password in Client Login Component

## Problem Statement

The client-side Login component contains a hardcoded password (`@Nupples8`) that is embedded in the compiled JavaScript bundle sent to browsers. This password was removed from the server seed file but **still exists in the client code**.

**Why it matters:**

- Anyone can view the production site source code and extract these credentials
- Allows unauthorized access to the `mike@maconheadshots.com` account
- CWE-798: Use of Hard-coded Credentials
- OWASP A01:2021 – Broken Access Control

## Findings

**Location:** `client/src/pages/Login.tsx:26-27`

```typescript
const { values, handleChange } = useForm({
  email: 'mike@maconheadshots.com',
  password: '@Nupples8', // HARDCODED PASSWORD IN CLIENT BUNDLE
});
```

**Attack Vector:**

1. Attacker views source code of production site (CTRL+U or DevTools)
2. Searches for "password" in bundled JavaScript
3. Finds `@Nupples8` in plaintext
4. Uses `mike@maconheadshots.com / @Nupples8` to log in

**Verification:**

```bash
npm run build --workspace=client
grep -r "@Nupples8" client/dist/  # Should return NOTHING after fix
```

## Proposed Solutions

### Solution A: Environment-specific auto-fill (Recommended)

**Pros:** Maintains dev convenience, secure in production
**Cons:** Requires env var setup
**Effort:** Small (15 min)
**Risk:** Low

```typescript
const isDev = import.meta.env.DEV && window.location.hostname === 'localhost';

const { values, handleChange } = useForm({
  email: isDev ? 'mike@maconheadshots.com' : '',
  password: isDev ? import.meta.env.VITE_DEV_PASSWORD || '' : '',
});
```

### Solution B: Remove auto-fill entirely

**Pros:** Simplest, most secure
**Cons:** Loses dev convenience
**Effort:** Small (5 min)
**Risk:** None

```typescript
const { values, handleChange } = useForm({
  email: '',
  password: '',
});
```

### Solution C: Use browser password manager

**Pros:** Leverages existing browser features
**Cons:** Requires initial manual entry
**Effort:** Small (5 min)
**Risk:** None

Remove hardcoded values and rely on Chrome/Firefox password autofill.

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `client/src/pages/Login.tsx`

**Components:**

- Login form
- useForm hook

**Database Changes:** None

## Acceptance Criteria

- [ ] No hardcoded passwords in client source code
- [ ] `grep -r "@Nupples8" client/` returns no results
- [ ] `grep -r "@Nupples8" client/dist/` returns no results after build
- [ ] Login form works correctly in development
- [ ] Login form works correctly in production

## Work Log

| Date       | Action                   | Learnings                                                                     |
| ---------- | ------------------------ | ----------------------------------------------------------------------------- |
| 2025-11-29 | Created from code review | Found during seed system review - password removed from server but not client |

## Resources

- **Code Review:** Seed system refactoring review
- **OWASP:** https://owasp.org/Top10/A01_2021-Broken_Access_Control/
- **CWE-798:** https://cwe.mitre.org/data/definitions/798.html
