# Test Isolation: CI/CD Configuration Best Practices

## Overview

This guide provides CI/CD configuration patterns that prevent test isolation issues at the pipeline level. The MAIS project implements these patterns in `.github/workflows/main-pipeline.yml`.

---

## Pattern 1: Test Execution Order

### Problem

Running all test types together causes connection conflicts. Different test types have different requirements.

### Solution

Separate tests into distinct jobs with explicit dependencies:

```
Unit Tests (parallel)
    ↓
Integration Tests (sequential)
    ↓
E2E Tests (sequential)
    ↓
Build Validation
```

### Implementation

```yaml
jobs:
  # Job 1: Unit Tests (no database, run parallel)
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npm run --workspace=server prisma:generate

      - name: Run unit tests with coverage
        run: npm run test:unit -- --coverage
        env:
          NODE_ENV: test
          JWT_SECRET: ${{ secrets.JWT_SECRET }}

  # Job 2: Integration Tests (database, sequential with limits)
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    # Optional: depends_on: [unit-tests] to force order

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: mais_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Prisma migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_test

      - name: Run integration tests
        run: npm run test:integration -- --coverage
        env:
          DATABASE_URL_TEST: postgresql://postgres:postgres@localhost:5432/mais_test?connection_limit=10&pool_timeout=20

  # Job 3: Summary (only runs if all tests pass)
  pipeline-complete:
    name: Pipeline Complete
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, e2e-tests]
    if: always()

    steps:
      - name: Check all jobs status
        run: |
          if [ "${{ needs.unit-tests.result }}" != "success" ]; then
            echo "❌ Unit tests failed"
            exit 1
          fi
          if [ "${{ needs.integration-tests.result }}" != "success" ]; then
            echo "❌ Integration tests failed"
            exit 1
          fi
          if [ "${{ needs.e2e-tests.result }}" != "success" ]; then
            echo "❌ E2E tests failed"
            exit 1
          fi
          echo "✅ All pipeline checks passed!"
```

**Why this matters:**

- Each job runs independently (fresh environment)
- No connection pool conflicts between jobs
- Clear visibility into what failed and why
- Parallel jobs run together, sequential jobs wait
- Failed job doesn't block other jobs from reporting results

---

## Pattern 2: Database Service Configuration

### Problem

Tests start before database is ready, causing "connection refused" errors.

### Solution

Use health checks to ensure database readiness:

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mais_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
      # Total wait: 5 retries × 10s interval = 50s max
```

**Health check details:**

- `--health-cmd pg_isready` - Checks if PostgreSQL accepts connections
- `--health-interval 10s` - Check every 10 seconds
- `--health-timeout 5s` - Allow 5 seconds for check to complete
- `--health-retries 5` - Retry up to 5 times (50 seconds total)

GitHub Actions automatically waits for health checks to pass before running steps.

---

## Pattern 3: Database Migrations Before Tests

### Problem

Tests fail with "table doesn't exist" if migrations haven't run.

### Solution

Always apply migrations as separate step before tests:

```yaml
- name: Run Prisma migrations
  run: npx prisma migrate deploy --schema=./server/prisma/schema.prisma
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_test?connection_limit=10&pool_timeout=20
    DIRECT_URL: postgresql://postgres:postgres@localhost:5432/mais_test?connection_limit=10&pool_timeout=20

- name: Apply manual SQL migrations
  run: |
    for file in server/prisma/migrations/[0-9][0-9]_*.sql; do
      if [ -f "$file" ]; then
        filename=$(basename "$file")
        # Skip destructive legacy migrations
        if [ "$filename" = "00_supabase_reset.sql" ]; then
          echo "Skipping destructive migration: $file"
          continue
        fi
        echo "Applying: $file"
        PGPASSWORD=postgres psql -h localhost -U postgres -d mais_test -f "$file"
      fi
    done

# NOW run tests (database is ready)
- name: Run integration tests
  run: npm run test:integration -- --coverage
```

**Why separate migrations:**

- Clear visibility into migration success/failure
- Tests only run after DB is fully initialized
- Can debug migration issues independently

---

## Pattern 4: Connection Pool Configuration

### Problem

Default connection limits cause exhaustion with parallel test workers.

### Solution

Apply connection pool limits to all database URLs:

```yaml
# ✅ CORRECT: Includes connection limits
DATABASE_URL: postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20

# ✗ WRONG: No connection limits (will exhaust pool)
DATABASE_URL: postgresql://user:pass@host:5432/db
```

**Parameter guidance:**

| Parameter          | Value | Why                                                 |
| ------------------ | ----- | --------------------------------------------------- |
| `connection_limit` | 10    | Low enough to prevent exhaustion with 10 test files |
| `pool_timeout`     | 20    | High enough for sequential cleanup                  |

**Environment-specific settings:**

```yaml
# Development
DATABASE_URL_TEST: postgresql://localhost:5432/db?connection_limit=10&pool_timeout=20

# CI Integration Tests
- name: Run integration tests
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test?connection_limit=10&pool_timeout=20

# CI E2E Tests
- name: Run E2E tests
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/e2e?connection_limit=10&pool_timeout=20
```

---

## Pattern 5: Environment Variable Secrets

### Problem

Hardcoding secrets in workflow files exposes them in git history.

### Solution

Use GitHub Secrets for all sensitive values:

```yaml
- name: Run tests
  env:
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    BOOKING_TOKEN_SECRET: ${{ secrets.BOOKING_TOKEN_SECRET }}
    TENANT_SECRETS_ENCRYPTION_KEY: ${{ secrets.TENANT_SECRETS_ENCRYPTION_KEY }}
    STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
    STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
```

**Setup steps:**

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret (get values from `.env`)
4. Reference in workflow as `${{ secrets.SECRET_NAME }}`

**Non-secret environment variables** (safe to hardcode):

```yaml
env:
  NODE_ENV: test
  ADAPTERS_PRESET: mock
  API_PORT: 3001
  CORS_ORIGIN: http://localhost:5173
```

---

## Pattern 6: Artifact Collection for Debugging

### Problem

When tests fail, there's no information to debug the issue.

### Solution

Collect test artifacts on failure:

```yaml
# Collect coverage reports
- name: Upload integration test coverage
  if: always() # Run even if tests fail
  uses: actions/upload-artifact@v4
  with:
    name: integration-test-coverage-${{ github.run_id }}
    path: ./server/coverage/
    retention-days: 7

# Collect Playwright reports
- name: Upload Playwright report on failure
  if: failure() # Only if tests fail
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report-${{ github.run_id }}
    path: playwright-report/
    retention-days: 7

# Collect test results
- name: Upload test results on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: test-results-${{ github.run_id }}
    path: test-results/
    retention-days: 7
```

**Artifact retrieval:**

1. Go to GitHub workflow run
2. Scroll to "Artifacts" section
3. Download coverage, reports, or test results
4. Analyze to understand failure root cause

---

## Pattern 7: Conditional Job Execution

### Problem

Running all jobs on all branches wastes CI resources (e.g., security scans on every branch).

### Solution

Use conditionals for expensive jobs:

```yaml
# Only run security scan on PRs
security-audit:
  name: Security Audit
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request' # PR-only

  steps:
    - name: Run npm audit
      run: npm audit --audit-level=high

# Only run migration validation on PRs
migration-validation:
  name: Database Migration Validation
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request' # PR-only

  steps:
    - name: Validate migrations
      run: npx prisma validate
```

**Common conditions:**

```yaml
if: github.event_name == 'pull_request'      # PR-only
if: github.ref == 'refs/heads/main'          # Main branch only
if: github.ref == 'refs/heads/production'    # Production branch only
if: contains(github.ref, 'release/')         # Release tags only
if: always()                                  # Always run (even if previous failed)
if: failure()                                 # Only if previous step failed
if: success()                                 # Only if previous step succeeded
```

---

## Pattern 8: PR Comments for Visibility

### Problem

Developers don't get feedback until they check the Actions tab.

### Solution

Post comments on PR with test results:

```yaml
# Comment on PR if tests pass
- name: Comment PR with success
  if: success() && github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: '✅ **All pipeline checks passed!**\n\n- Unit tests: ✓\n- Integration tests: ✓\n- E2E tests: ✓'
      })

# Comment on PR if tests fail
- name: Comment PR on failure
  if: failure() && github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: '❌ **Pipeline checks failed**\n\nPlease fix issues and re-run.\n\nSee [workflow logs](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}) for details.'
      })
```

---

## Pattern 9: Timeout Configuration

### Problem

Slow tests cause timeouts, stopping pipeline prematurely.

### Solution

Set appropriate timeouts per job:

```yaml
jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10 # 10 min (typically 1-2 min)

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15 # 15 min (typically 5-10 min)

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20 # 20 min (typically 10-15 min)

  pipeline-complete:
    name: Pipeline Complete
    runs-on: ubuntu-latest
    timeout-minutes: 5 # Quick summary job

steps:
  - name: Long-running step
    run: npm run long-build
    timeout-minutes: 5 # Step-level timeout
```

**Timeout recommendations:**

- Unit tests: 5-10 minutes (typically < 2 min)
- Integration tests: 10-20 minutes (typically 5-10 min)
- E2E tests: 15-30 minutes (typically 10-20 min)
- Build: 5-10 minutes (typically 2-5 min)

---

## Pattern 10: Concurrency Control

### Problem

Multiple runs of same workflow (e.g., multiple PRs) waste CI resources and cause noise.

### Solution

Use concurrency to cancel in-progress runs:

```yaml
name: Main CI/CD Pipeline

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

# Cancel previous runs on same branch when new commit is pushed
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**How it works:**

1. Push commit to branch
2. Workflow 1 starts (unit tests)
3. Push another commit to same branch
4. Workflow 1 is cancelled
5. Workflow 2 starts fresh (saves resources)

---

## Complete Example: MAIS Configuration

See actual implementation in `.github/workflows/main-pipeline.yml`:

Key highlights:

- 9 distinct jobs with clear dependencies
- PostgreSQL service container with health checks
- Connection limits on all database URLs: `connection_limit=10&pool_timeout=20`
- Migrations before tests (separate step)
- Artifact collection on failure
- PR comments for visibility
- Appropriate timeouts per job
- Concurrency control to cancel redundant runs

---

## Validation Checklist

```
CI/CD Configuration Validation:
  ☐ Unit tests run in parallel (faster)
  ☐ Integration tests run serially or with pool limits
  ☐ E2E tests run after integration tests
  ☐ Database service has health checks
  ☐ Migrations run before tests
  ☐ CONNECTION_LIMIT=10 on all database URLs
  ☐ All secrets use ${{ secrets.NAME }}
  ☐ Job timeouts are appropriate
  ☐ Artifacts collected on failure
  ☐ PR comments provide feedback
  ☐ Concurrency control prevents duplicate runs

Test in CI:
  ☐ Push to branch, watch workflow run
  ☐ Expected: All jobs pass
  ☐ Expected: PR comment appears
  ☐ Expected: Total time < 10 minutes
  ☐ If timeout: Increase timeout-minutes
  ☐ If connection error: Check connection_limit parameter
  ☐ If migration error: Check migration order
```

---

## Troubleshooting CI Failures

### Connection Pool Exhaustion in CI

**Symptom:**

```
Error: Too many database connections opened
FATAL: remaining connection slots reserved for roles with the SUPERUSER attribute
```

**Fix:**

1. Check DATABASE_URL includes `?connection_limit=10&pool_timeout=20`
2. Ensure integration tests don't run in parallel with unit tests
3. Verify all test files use `setupCompleteIntegrationTest()`

### Timeout in Integration Tests

**Symptom:**

```
Error: The operation timed out
```

**Fix:**

1. Increase `timeout-minutes` (current: 15, try: 20)
2. Reduce number of parallel test workers
3. Check for long-running database queries (add indexes?)

### Migration Failures

**Symptom:**

```
Error: Foreign key violation
Error: Table doesn't exist
```

**Fix:**

1. Check migrations are in correct order
2. Verify manual SQL migrations are applied
3. Check for schema drift between code and database

### Flaky Tests

**Symptom:**

```
Test passes in local run, fails in CI
Or fails intermittently in CI runs
```

**Fix:**

1. Check DATABASE_URL_TEST has connection limits
2. Ensure cleanup is complete (afterEach calls ctx.cleanup())
3. Use `.sequential()` for timing-sensitive tests
4. Review test for race conditions

---

## Related Documentation

- `.github/workflows/main-pipeline.yml` - Complete MAIS CI/CD implementation
- `.github/workflows/WORKFLOWS_README.md` - GitHub Actions documentation
- `docs/deployment/CI_CD_QUICK_REFERENCE.md` - Quick reference guide
- `TEST_ISOLATION_PREVENTION_STRATEGIES.md` - Detailed prevention strategies
