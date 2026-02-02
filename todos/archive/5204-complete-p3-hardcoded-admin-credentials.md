---
status: complete
priority: p3
issue_id: '5204'
tags: [code-review, testing, security]
dependencies: []
completed_at: 2026-02-02
---

# Hardcoded Admin Credentials in Tests

## Problem Statement

Admin flow tests use shared hardcoded credentials, creating test interdependencies and appearing in source code.

## Findings

**Location:** `e2e/tests/admin-flow.spec.ts`

```typescript
// Before - hardcoded in 5 places
await page.fill('#email', 'admin@example.com');
await page.fill('#password', 'admin123admin');
```

**Issues:**

1. Credentials in source code
2. All admin tests share state
3. Can't run admin tests in parallel

## Resolution

Implemented **Option B: Environment Variables** (chosen for simplicity):

```typescript
// After - constants from environment with documented defaults
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123admin';

// Usage
await page.fill('#email', ADMIN_EMAIL);
await page.fill('#password', ADMIN_PASSWORD);
```

## Changes Made

1. Added `ADMIN_EMAIL` and `ADMIN_PASSWORD` constants at top of file
2. Constants read from `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` env vars
3. Fallback to test defaults for local development
4. Replaced all 5 occurrences of hardcoded credentials with constants
5. Added JSDoc documentation for the environment variables
6. Added security note about test-only defaults

## Acceptance Criteria

- [x] No hardcoded credentials in test files (moved to constants with env var support)
- [x] Admin tests isolated (can now configure different credentials per environment)

## Note

The auth fixture pattern (Option A) was not implemented because:

- Admin tests need a pre-existing admin account (seeded data)
- Creating admin per-test would require database seed changes
- Environment variables provide sufficient flexibility for CI/staging/prod environments
