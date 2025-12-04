# Coverage Quick Start Guide

## Quick Commands

```bash
# Run unit tests with coverage (fast, recommended for dev)
npm run test:coverage:unit

# Run all tests with coverage (includes integration tests)
npm run test:coverage

# Open HTML coverage report in browser
npm run test:coverage:report
```

## From Root Directory

```bash
# From /Users/mikeyoung/CODING/Elope
npm run test:coverage:unit
npm run test:coverage
npm run test:coverage:report
```

## Current Coverage Baseline

**As of 2025-11-14:**

- Lines: 42.35% → Target: 80%
- Branches: 77.45% → Target: 75% ✓
- Functions: 36.94% → Target: 80%
- Statements: 42.35% → Target: 80%

## Coverage Reports

Reports are generated in multiple formats:

- **HTML:** `server/coverage/index.html` (interactive browser report)
- **LCOV:** `server/coverage/lcov.info` (for CI/CD)
- **JSON:** `server/coverage/coverage-final.json` (machine-readable)
- **Terminal:** Displayed after test run

## Coverage Thresholds

Configured in `server/vitest.config.ts`:

- Lines: 40% (current baseline)
- Branches: 75% (passing)
- Functions: 35% (current baseline)
- Statements: 40% (current baseline)

Tests will fail if coverage drops below these thresholds.

## What's Excluded

- Test files (_.spec.ts, _.test.ts)
- Test directories (test/\*\*)
- Build artifacts (dist/, coverage/)
- Config files (\*.config.ts)
- Scripts (scripts/\*\*)
- Prisma schema (prisma/\*\*)
- Type definitions (\*.d.ts)
- Index files (index.ts)

## Priority Coverage Gaps

1. **Adapters (7.83%)** - Stripe, Google Cal, Resend
2. **Repositories (10.46%)** - Prisma repositories
3. **Controllers (2.99%)** - Request handlers
4. **Routes (31.75%)** - HTTP endpoints
5. **Services (36.2%)** - Commission, Product, OAuth

## Quick Workflow

1. Make code changes
2. Run coverage: `npm run test:coverage:unit`
3. Check report: `npm run test:coverage:report`
4. Identify uncovered lines (shown in red)
5. Add tests for uncovered code
6. Re-run coverage to verify

## See Also

- Full documentation: `server/test/README.md` (Code Coverage section)
- Vitest config: `server/vitest.config.ts`
- Coverage exclusions: `server/.coveragerc`
