# CI/CD Enhancement Specification

> **Purpose**: Detailed specification for GitHub Actions workflow improvements
> **Created**: 2025-12-26
> **Related**: `plans/MAIS-quality-remediation-plan.md`

## Current State Analysis

### Existing Jobs (9 total)
| Job | Status | Notes |
|-----|--------|-------|
| docs-validation | Working | Keep as-is |
| pattern-validation | Working | Keep as-is |
| lint | Needs Update | Baseline outdated (305 → 195) |
| typecheck | Working | Keep as-is |
| security-audit | Working | Enhance with weekly schedule |
| unit-tests | Working | Add coverage enforcement |
| integration-tests | Working | Keep as-is |
| migration-validation | Working | Keep as-is |
| e2e-tests | Working | Add accessibility |
| build | Needs Update | Add Turborepo |

### Build Performance
- Current cold build: ~4m 30s
- Target with Turborepo: <30s (warm cache)

---

## Required Changes

### 1. Update ESLint Baseline (Immediate)

**File**: `.github/workflows/main-pipeline.yml`
**Line**: 98

```yaml
# BEFORE
BASELINE=305

# AFTER
BASELINE=195
```

**Rationale**: Current error count is 195, baseline should match to detect regressions.

---

### 2. Add Turborepo Integration (P0-5)

**File**: `.github/workflows/main-pipeline.yml`

**Add after line 9** (concurrency block):
```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

**Replace build job** (lines 558-599):
```yaml
  build:
    name: Build Validation (Turborepo)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [lint, typecheck]

    steps:
      - name: Checkout repository
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

      - name: Build with Turborepo (cached)
        run: npx turbo run build --cache-dir=".turbo"
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}

      - name: Cache Turborepo
        uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}
          restore-keys: |
            turbo-

      - name: Upload build artifacts (PR only)
        if: github.event_name == 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts-${{ github.run_id }}
          path: |
            ./server/dist/
            ./client/dist/
            ./packages/*/dist/
            ./apps/web/.next/
          retention-days: 7
```

**Required Setup**:
1. Create Vercel account (for remote cache)
2. Add `TURBO_TOKEN` to GitHub secrets
3. Add `TURBO_TEAM` to GitHub variables

---

### 3. Add Frontend Component Tests Job (P0-2)

**Add new job after unit-tests**:
```yaml
  # Job: Frontend Component Tests
  frontend-tests:
    name: Frontend Component Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Next.js component tests
        run: npm run --workspace=apps/web test -- --coverage
        env:
          NODE_ENV: test

      - name: Run legacy client tests
        run: npm run --workspace=client test -- --coverage
        env:
          NODE_ENV: test

      - name: Upload frontend coverage
        uses: actions/upload-artifact@v4
        with:
          name: frontend-coverage-${{ github.run_id }}
          path: |
            ./apps/web/coverage/
            ./client/coverage/
          retention-days: 7

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./apps/web/coverage/lcov.info,./client/coverage/lcov.info
          flags: frontend
          name: frontend-tests-${{ github.run_id }}
          fail_ci_if_error: false
        env:
          CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

**Update pipeline-complete job** to include frontend-tests in needs array.

---

### 4. Add Accessibility Tests Job (P1-4)

**Add new job after e2e-tests**:
```yaml
  # Job: Accessibility Tests (axe-core)
  accessibility-tests:
    name: Accessibility Tests (WCAG 2.1 AA)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: [build]

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: mais_a11y_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Build packages
        run: npx turbo run build

      - name: Generate Prisma Client
        run: npm run --workspace=server prisma:generate

      - name: Run Prisma migrations
        run: npx prisma migrate deploy --schema=./server/prisma/schema.prisma
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_a11y_test
          DIRECT_URL: postgresql://postgres:postgres@localhost:5432/mais_a11y_test

      - name: Start API server
        run: npm run --workspace=server dev:mock &
        env:
          NODE_ENV: development
          ADAPTERS_PRESET: mock
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_a11y_test
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          BOOKING_TOKEN_SECRET: ${{ secrets.BOOKING_TOKEN_SECRET }}
          TENANT_SECRETS_ENCRYPTION_KEY: ${{ secrets.TENANT_SECRETS_ENCRYPTION_KEY }}

      - name: Wait for API server
        run: npx wait-on http://localhost:3001/health --timeout 60000

      - name: Seed test tenant
        run: npm run --workspace=server db:seed:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mais_a11y_test

      - name: Run accessibility tests
        run: npm run test:e2e -- --grep "@accessibility"
        env:
          CI: true

      - name: Upload accessibility report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: accessibility-report-${{ github.run_id }}
          path: test-results/axe-core-reports/
          retention-days: 30
```

---

### 5. Add Performance Budget Job (P1-5)

**Add new job**:
```yaml
  # Job: Performance Budget Validation
  performance-tests:
    name: Performance Budgets
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [build]
    if: github.event_name == 'pull_request'

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Next.js with bundle analysis
        run: npm run --workspace=apps/web build
        env:
          ANALYZE: true

      - name: Check bundle size
        run: |
          # Check main bundle size (max 300KB)
          MAIN_SIZE=$(du -k apps/web/.next/static/chunks/main-*.js | cut -f1)
          if [ "$MAIN_SIZE" -gt 300 ]; then
            echo "::error::Main bundle ($MAIN_SIZE KB) exceeds 300KB budget"
            exit 1
          fi
          echo "Main bundle: $MAIN_SIZE KB (budget: 300KB)"

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v11
        with:
          configPath: ./lighthouserc.json
          uploadArtifacts: true
          temporaryPublicStorage: true
        continue-on-error: true
```

---

### 6. Enhance Security Scanning (P1-6)

**Create new file**: `.github/workflows/security-scan.yml`
```yaml
name: Security Scan

on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2am UTC
  pull_request:
    paths:
      - '**/package.json'
      - '**/package-lock.json'
  workflow_dispatch:

jobs:
  snyk-scan:
    name: Snyk Vulnerability Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=upgradable

      - name: Upload Snyk report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: snyk-report-${{ github.run_id }}
          path: snyk-report.json
          retention-days: 30

  npm-audit:
    name: NPM Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit (production deps)
        run: npm audit --omit=dev --audit-level=high

      - name: Run npm audit (all deps)
        run: npm audit --audit-level=critical
        continue-on-error: true

  dependency-review:
    name: Dependency Review
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Dependency Review
        uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high
          deny-licenses: GPL-3.0, AGPL-3.0
```

---

### 7. Add Coverage Enforcement (P0-4, P2-1, P3-1)

**Update unit-tests job** to enforce thresholds:
```yaml
      - name: Verify coverage thresholds
        run: |
          # Extract coverage from report
          LINES=$(grep -A4 'Lines' ./server/coverage/coverage-summary.json | grep pct | head -1 | grep -oP '\d+\.\d+')
          THRESHOLD=50  # Phase 1: 50%, Phase 2: 65%, Phase 3: 80%

          if (( $(echo "$LINES < $THRESHOLD" | bc -l) )); then
            echo "::error::Line coverage ($LINES%) is below threshold ($THRESHOLD%)"
            exit 1
          fi
          echo "Line coverage: $LINES% (threshold: $THRESHOLD%)"
```

---

## Implementation Order

### Immediate (Before Phase 0)
1. Update ESLint baseline (305 → 195)
2. Create `turbo.json` configuration file
3. Add `TURBO_TOKEN` to GitHub secrets

### Phase 0 (Week 1-2)
4. Replace build job with Turborepo version
5. Add frontend-tests job
6. Update pipeline-complete needs array

### Phase 1 (Week 3-4)
7. Add accessibility-tests job
8. Add performance-tests job
9. Create security-scan.yml workflow
10. Add coverage threshold enforcement

### Phase 2 (Week 5-6)
11. Update coverage threshold to 65%
12. Add mutation testing job (optional)

### Phase 3 (Week 7-8)
13. Update coverage threshold to 80%
14. Add bundle size budgets
15. Add Lighthouse CI

---

## Required Secrets/Variables

| Name | Type | Purpose |
|------|------|---------|
| `TURBO_TOKEN` | Secret | Vercel remote cache authentication |
| `TURBO_TEAM` | Variable | Vercel team name |
| `SNYK_TOKEN` | Secret | Snyk vulnerability scanning |
| `CODECOV_TOKEN` | Secret | Coverage reporting (existing) |

---

## Expected Results

### Build Time Improvement
| Scenario | Before | After |
|----------|--------|-------|
| Cold build | 4m 30s | 4m 30s |
| Warm build (cache hit) | 4m 30s | <30s |
| PR with no code changes | 4m 30s | <15s |

### Quality Gate Coverage
| Check | Before | After |
|-------|--------|-------|
| Unit tests | Yes | Yes |
| Integration tests | Yes | Yes |
| E2E tests | Yes | Yes |
| Frontend tests | No | **Yes** |
| Accessibility tests | No | **Yes** |
| Performance budgets | No | **Yes** |
| Security scan (weekly) | Partial | **Full** |
| Coverage enforcement | No | **Yes** |
| Bundle size | No | **Yes** |
