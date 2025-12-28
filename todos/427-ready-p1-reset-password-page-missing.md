---
status: ready
priority: p1
issue_id: '427'
tags: [frontend, auth, user-flow, nextjs]
dependencies: []
---

# Missing /reset-password Page Breaks Password Reset Flow

## Problem Statement

The password reset flow is incomplete. The `/forgot-password` page exists and sends reset emails, but there is NO `/reset-password` page to handle the token and allow users to set a new password. Users who click the reset link in their email receive a 404 error.

## Severity: P1 - HIGH

Blocking user authentication workflow. Users locked out of accounts cannot recover access.

## Findings

- Exists: `apps/web/src/app/forgot-password/page.tsx` (195 lines, fully functional)
- Missing: `apps/web/src/app/reset-password/` directory (no files)
- Backend expects: `/reset-password?token=xxx` (auth.routes.ts:533)
- Backend endpoint ready: `POST /v1/auth/reset-password` (accepts token + newPassword)

## Current Flow (Broken)

1. User visits `/forgot-password` ✅
2. User submits email, API sends reset email with token ✅
3. Email contains link to `/reset-password?token=xxx`
4. User clicks link → **404 error** ❌

## Proposed Solution

Create the following files:

### `apps/web/src/app/reset-password/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  // ... render form with password inputs, validation, success state
}
```

### `apps/web/src/app/reset-password/error.tsx`

Standard error boundary component.

### `apps/web/src/app/reset-password/loading.tsx`

Loading skeleton during Suspense.

## Technical Details

- **Files to Create**:
  - `apps/web/src/app/reset-password/page.tsx`
  - `apps/web/src/app/reset-password/error.tsx`
  - `apps/web/src/app/reset-password/loading.tsx`
- **Backend Endpoint**: Already exists (`POST /v1/auth/reset-password`)
- **Validation**: Token required, password min 8 chars, confirmation match

## Acceptance Criteria

- [ ] `/reset-password?token=xxx` renders password reset form
- [ ] Form validates: password strength, confirmation match
- [ ] Invalid/expired token shows error message
- [ ] Successful reset redirects to login with success message
- [ ] Error boundary handles API errors gracefully
- [ ] Loading state displays while checking token

## Review Sources

- Security Sentinel: P2 - HIGH priority
- Architecture Strategist: P1 (MEDIUM) - Create Reset Password Page
- Code Quality Reviewer: Missing page - blocking user workflow
- Pattern Recognition Specialist: P0 (Critical) - Missing /reset-password page

## Notes

Source: Parallel code review session on 2025-12-26
Confirmed by 4/8 review agents
Day 2 of MVP sprint noted backend complete but frontend page missing
