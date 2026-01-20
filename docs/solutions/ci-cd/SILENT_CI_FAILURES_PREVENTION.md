# Silent CI Failures Prevention

**Problem ID:** CI-SILENT-001
**Discovered:** 2026-01-20
**Severity:** HIGH - Code merges but doesn't deploy

## The Problem

Code was merged to `main` but didn't deploy to production for days. The storefront headline fix appeared to be live but wasn't.

## Root Cause

The CI/CD pipeline had `continue-on-error: true` on critical test paths:

```yaml
# deploy-production.yml
- name: Run integration tests
  run: npm run test:integration
  continue-on-error: true # ← SILENT FAILURE

- name: Run E2E tests
  run: npm run test:e2e
  continue-on-error: true # ← SILENT FAILURE
```

**What happened:**

1. Tests failed (integration tests needed DATABASE_URL)
2. CI showed "green" because failures were ignored
3. Render blocked deployment anyway (but we didn't know why)
4. Fix sat undeployed while we thought it was live

## The Fix

**Remove `continue-on-error: true` from critical paths:**

```yaml
# CORRECT - Tests must pass or pipeline fails
- name: Run integration tests
  run: npm run test:integration
  # No continue-on-error - failure blocks deployment

- name: Run E2E tests
  run: npm run test:e2e
  # No continue-on-error - failure blocks deployment
```

**Keep `continue-on-error: true` ONLY for informational steps:**

- Coverage upload (nice to have, not critical)
- Notifications (shouldn't block deploy)
- Security scans with optional tokens (skip if not configured)

## When to Use `continue-on-error`

| Use Case               | continue-on-error? | Why                    |
| ---------------------- | ------------------ | ---------------------- |
| Unit tests             | ❌ NO              | Must pass to ship      |
| Integration tests      | ❌ NO              | Must pass to ship      |
| E2E tests              | ❌ NO              | Must pass to ship      |
| Lint (if enforced)     | ❌ NO              | Must pass to ship      |
| Coverage upload        | ✅ YES             | Informational only     |
| Slack notification     | ✅ YES             | Shouldn't block deploy |
| Optional security scan | ✅ YES             | May not have token     |

## How Tests Should Handle Missing Dependencies

Instead of `continue-on-error`, make tests **skip gracefully**:

```typescript
// CORRECT - Skip when DATABASE_URL not available
const hasDatabaseUrl = !!process.env.DATABASE_URL;

describe.runIf(hasDatabaseUrl)('Integration Tests', () => {
  // Tests only run when database is available
  // Otherwise skipped with clear message
});
```

This way:

- Tests pass when dependencies available ✅
- Tests skip (not fail) when dependencies missing ✅
- CI fails if tests actually fail ✅
- No silent failures ✅

## Prevention Checklist

Before adding `continue-on-error: true`, ask:

- [ ] Is this step truly optional? (Coverage, notifications)
- [ ] Would a failure here indicate a real problem?
- [ ] Can the step skip gracefully instead?
- [ ] Am I using continue-on-error to hide tech debt?

If the answer to #2 is "yes" - **don't use continue-on-error**.

## Related

- **CLAUDE.md Pitfall:** #58 (Silent CI failures via continue-on-error)
- **Plan:** `plans/fix-enterprise-stability-synthesized.md` Phase 2
- **Workflow:** `.github/workflows/deploy-production.yml`
- **PR:** #29 (Enterprise Stability Foundation)

## Search Keywords

`continue-on-error`, `silent failure`, `CI green but broken`, `tests ignored`, `deployment blocked`
