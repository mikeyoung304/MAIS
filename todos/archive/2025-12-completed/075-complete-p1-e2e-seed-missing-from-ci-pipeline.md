---
status: complete
priority: p1
issue_id: '075'
tags: [ci-cd, code-review, e2e-tests, deployment]
dependencies: []
resolution: 'Already fixed - E2E seed step exists at main-pipeline.yml:409-413'
completed_date: '2025-11-30'
---

# P1: E2E Seed Missing from CI/CD Pipeline

## Problem Statement

The CI/CD pipeline runs E2E tests but **does not seed the E2E test tenant** before running tests. Tests assume the `mais-e2e` tenant exists but it won't exist in a fresh CI database.

**Why it matters:**

- E2E tests will fail with 401/403 errors in CI
- Tests pass locally (dev DB has seed) but fail in CI
- Deployment pipeline blocked by failing E2E tests
- False confidence in test suite

## Findings

**Location:** `.github/workflows/main-pipeline.yml` (E2E Tests job)

```yaml
# Current state - NO seed command
- name: Start API server in mock mode (background)
  env:
    ADAPTERS_PRESET: mock
    # Missing: npm run db:seed:e2e

- name: Run E2E tests
  run: npm run test:e2e
  # Tests expect tenant 'mais-e2e' but it doesn't exist!
```

**Evidence:** E2E tests use fixed API key:

```typescript
// e2e.ts exports
const E2E_PUBLIC_KEY = 'pk_live_mais-e2e_0000000000000000';
```

Tests expect this tenant to exist for authentication.

## Proposed Solutions

### Solution A: Add E2E seed to pipeline (Recommended)

**Pros:** Simple, explicit, matches local dev flow
**Cons:** Adds ~5 seconds to pipeline
**Effort:** Small (15 min)
**Risk:** Low

```yaml
- name: Setup test database
  run: |
    cd server
    npx prisma migrate deploy
    npm run db:seed:e2e
  env:
    DATABASE_URL: ${{ secrets.CI_DATABASE_URL }}

- name: Run E2E tests
  run: npm run test:e2e
```

### Solution B: Auto-seed in test setup

**Pros:** Self-contained, no CI changes
**Cons:** Slower tests, seed runs multiple times
**Effort:** Medium (30 min)
**Risk:** Low

```typescript
// e2e/global-setup.ts
import { seedE2E } from '../server/prisma/seeds/e2e';

export default async function globalSetup() {
  await seedE2E(prisma);
}
```

### Solution C: Use beforeAll in test fixtures

**Pros:** Per-file isolation possible
**Cons:** More complex, potential race conditions
**Effort:** Medium (45 min)
**Risk:** Medium

```typescript
// e2e/fixtures/tenant.ts
test.beforeAll(async () => {
  await seedE2E(prisma);
});
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `.github/workflows/main-pipeline.yml`

**Components:**

- E2E test job
- Database setup step

**Database Changes:** None (seed creates E2E tenant)

## Acceptance Criteria

- [ ] E2E tests pass in CI pipeline
- [ ] `mais-e2e` tenant exists before tests run
- [ ] Pipeline logs show seed execution
- [ ] No manual intervention required for CI

## Work Log

| Date       | Action                   | Learnings                                             |
| ---------- | ------------------------ | ----------------------------------------------------- |
| 2025-11-29 | Created from code review | Local dev masks CI issues due to persistent seed data |

## Resources

- **Code Review:** Seed system refactoring review
- **Pipeline:** `.github/workflows/main-pipeline.yml`
- **Seed:** `server/prisma/seeds/e2e.ts`
