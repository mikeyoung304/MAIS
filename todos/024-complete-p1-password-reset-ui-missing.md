---
status: complete
priority: p1
issue_id: "024"
tags: [code-review, feature-incomplete, authentication, ux]
dependencies: []
---

# Password Reset UI Completely Missing

## Problem Statement

Backend routes for password reset exist (`POST /v1/auth/forgot-password` and `POST /v1/auth/reset-password`) but there is NO frontend UI. Users who lose their password have no self-service recovery path.

**Why this matters:** Users cannot recover access to their accounts, leading to support burden and potential customer churn.

## Findings

### Backend Status: Complete

**Location:** `server/src/routes/tenant-auth.routes.ts`
- `POST /v1/auth/forgot-password` - Accepts email, sends reset link via Postmark
- `POST /v1/auth/reset-password` - Accepts token and new password

### Frontend Status: Missing

**Expected but NOT found:**
- `/forgot-password` page - No component exists
- `/reset-password/:token` page - No component exists
- "Forgot Password?" link on Login page - Not present

**Files checked:**
- `client/src/pages/` - No forgot-password or reset-password pages
- `client/src/features/auth/` - No password reset components
- `client/src/App.tsx` - No routes for password reset

### Impact

- Users locked out of accounts permanently
- Support requests for manual password resets
- Poor user experience compared to competitors
- Backend infrastructure going unused

## Proposed Solutions

### Option A: Create Complete Password Reset Flow (Required)
**Effort:** Medium | **Risk:** Low

Create two new pages:

**1. ForgotPasswordPage.tsx**
```typescript
// /forgot-password route
- Email input field with validation
- Submit button to trigger forgot-password API
- Success message: "Check your email for reset link"
- Error handling for invalid/unknown email
- Link back to login page
```

**2. ResetPasswordPage.tsx**
```typescript
// /reset-password/:token route
- Parse token from URL params
- New password field with strength indicator
- Confirm password field
- Submit to reset-password API
- Success: Redirect to login with message
- Error: Token expired/invalid message with retry option
```

**3. Update Login.tsx**
- Add "Forgot Password?" link below login form

## Recommended Action

Implement complete password reset flow with proper validation and user feedback.

## Technical Details

**Files to Create:**
- `client/src/pages/ForgotPasswordPage.tsx`
- `client/src/pages/ResetPasswordPage.tsx`

**Files to Update:**
- `client/src/App.tsx` - Add routes
- `client/src/features/auth/TenantLogin.tsx` - Add forgot password link

**API Integration:**
```typescript
// ForgotPasswordPage
const response = await fetch('/v1/auth/forgot-password', {
  method: 'POST',
  body: JSON.stringify({ email }),
});

// ResetPasswordPage
const response = await fetch('/v1/auth/reset-password', {
  method: 'POST',
  body: JSON.stringify({ token, password }),
});
```

## Acceptance Criteria

- [ ] `/forgot-password` page renders with email input
- [ ] Submitting valid email shows success message
- [ ] `/reset-password/:token` page renders with password fields
- [ ] Valid token allows password change
- [ ] Expired token shows error with retry option
- [ ] Login page has "Forgot Password?" link
- [ ] Form validation prevents empty submissions
- [ ] E2E test for complete password reset flow

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during comprehensive code review |
| 2025-12-01 | Complete | Already implemented: ForgotPasswordPage.tsx (210 lines), ResetPasswordPage.tsx (279 lines), routes in router.tsx (lines 137-144), "Forgot password?" link in Login.tsx (lines 189-196). Full validation, API integration, success/error states. |

## Resources

- Backend implementation: `server/src/routes/tenant-auth.routes.ts`
- Postmark email template already configured
- Feature Completeness analysis identified as P1 blocker
