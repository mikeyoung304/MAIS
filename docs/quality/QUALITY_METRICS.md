# Quality Metrics Dashboard

Last updated: 2025-12-26

## Test Coverage

### Server (Backend)

| Metric | Baseline | Target | Status |
|--------|----------|--------|--------|
| Lines | 43.27% | 80% | Below target |
| Branches | 81.11% | 75% | Exceeds target |
| Functions | 46.7% | 80% | Below target |
| Statements | 43.27% | 80% | Below target |

**Thresholds configured in:** `server/vitest.config.ts`

### Test Counts

| Category | Passing | Failing | Total |
|----------|---------|---------|-------|
| Unit tests | 978 | 1 | 979 |
| Integration tests | 169 | 34 | 205 |
| **Total** | 1147 | 35 | 1184 |

**Note:** Integration test failures are due to Supabase session pooler connection limits (MaxClientsInSessionMode), not code issues.

## Code Quality

### Circular Dependencies

**Status:** None detected

```bash
npx madge --circular --extensions ts server/src
```

### TypeScript Errors

**Status:** 0 errors

```bash
npm run typecheck
```

### ESLint Warnings

**Status:** Configured and passing

```bash
npm run lint
```

## Critical Paths Requiring Coverage

Based on code audit, these areas need improved coverage:

### High Priority (Security/Data)

1. **Tenant isolation middleware** (`src/middleware/tenant.ts`) - 100% covered
2. **Auth middleware** (`src/middleware/auth.ts`) - 82.75% covered
3. **Booking service** (`src/services/booking.service.ts`) - 45.59% covered
4. **Webhook processing** (`src/routes/webhooks.routes.ts`) - 69.66% covered

### Medium Priority (Core Business)

1. **Catalog service** (`src/services/catalog.service.ts`) - 25% covered
2. **Availability service** (`src/services/availability.service.ts`) - 88.46% covered
3. **Calendar service** (`src/services/calendar.service.ts`) - 25% covered

### Lower Priority (Administrative)

1. **Tenant admin routes** - ~15-40% covered
2. **Platform admin routes** - ~28% covered

## Running Coverage Reports

```bash
# Full coverage report (unit + integration)
npm test --workspace=server -- --coverage

# Unit tests only (faster, more reliable)
npm test --workspace=server -- --exclude "test/integration/**" --coverage

# View HTML report
open server/coverage/lcov-report/index.html
```

## Next Steps

1. Add coverage CI gate when baseline improves
2. Prioritize booking service coverage (payment flow)
3. Add integration test retries for pool exhaustion
4. Consider local PostgreSQL for integration tests
