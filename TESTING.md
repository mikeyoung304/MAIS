# Testing

## Strategy

- **Unit (domain):** pure services with fake ports (no HTTP/SDK).
- **Adapter tests:** Stripe/Postmark/GCal thin tests (mock network).
- **HTTP contract tests:** validate req/res via zod from contracts.
- **E2E:** Playwright happy path in mock mode; later one Stripe test.

## Implemented Tests

### Unit Tests

Run `npm test` to execute the full test suite covering:

- Domain services (availability, booking, catalog, identity, tenant)
- Integration tests (webhook race conditions, booking repository)
- Payment services (refund processing, deposits, checkout)
- Agent tools and multi-tenant isolation

### E2E Tests (9 scenarios)

- **Mock Booking Flow** (2 scenarios):
  - Complete booking with add-on and API availability check
  - Form validation (checkout disabled without required fields)
- **Booking Flow** (2 scenarios):
  - Complete booking journey (homepage → confirmation)
  - Form validation (checkout disabled without required fields)
- **Admin Flow** (5 scenarios):
  - Admin authentication + dashboard
  - Package CRUD operations
  - Blackout date management
  - Bookings table view
  - Logout

## Commands

```bash
# Unit tests
npm run --workspace=server test           # Run all unit tests
npm run --workspace=server test:watch     # Watch mode
npm run --workspace=server coverage       # With coverage

# E2E tests (requires both servers running)
npm run --workspace=server dev            # Terminal 1: API server
npm run test:e2e                       # Terminal 2: Run E2E tests
npm run test:e2e:ui                    # Interactive UI mode
npm run test:e2e:headed                # See browser during tests

# Full workspace validation
npm run typecheck               # TypeScript check
npm run build                       # Build all packages
```

## E2E Test Setup

The E2E test suite uses Playwright and requires:

1. **API server running on `http://localhost:3001` (mock mode)**
2. Web dev server auto-started by Playwright on `http://localhost:3000`

### Prerequisites

Before running E2E tests, ensure the API server is running in mock mode:

```bash
# Terminal 1: Start API server
cd /Users/mikeyoung/CODING/MAIS
npm run --workspace=server dev
```

### Environment Variables

The E2E tests use environment variables set in `e2e/playwright.config.ts`:

- `VITE_API_URL=http://localhost:3001` - API endpoint
- `VITE_APP_MODE=mock` - Mock mode for testing

These are automatically injected when Playwright starts the web dev server.

### Running Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Interactive UI mode (recommended for debugging)
npm run test:e2e:ui

# Headed mode (see browser during tests)
npm run test:e2e:headed
```

### Test Scenarios

**Mock Booking Flow** (2 tests):

- Complete booking with add-on and API availability verification
  - Selects first package, chooses future date, adds add-on
  - Completes mock checkout and payment
  - Verifies date becomes unavailable via direct API call
- Form validation (checkout disabled without required fields)

**Booking Flow** (2 tests):

- Complete booking journey from homepage to confirmation
- Form validation (checkout disabled without required fields)

**Admin Flow** (5 tests):

- Admin authentication and dashboard access
- Package CRUD operations
- Blackout date management
- Bookings table view
- Logout functionality

### Troubleshooting

**API Connection Issues**:

- Ensure API server is running on port 3001
- Check no port conflicts: `lsof -i :3001`
- Verify mock mode: API logs should show "🧪 Using MOCK adapters"

**Test Flakiness**:

- Tests use `waitForLoadState('networkidle')` to ensure API calls complete
- If tests timeout, increase timeout in `e2e/playwright.config.ts`
- Use `npm run test:e2e:headed` to debug visually

**CI/CD**:

- E2E tests run automatically in GitHub Actions via `.github/workflows/e2e.yml`
- API server starts in mock mode; Playwright auto-starts web server
- Tests are CI-ready with automatic retries (2 attempts)
- Playwright generates HTML reports on failure
- Screenshots/videos captured on failure and uploaded as artifacts

**Running a single test file**:

```bash
npm run test:e2e e2e/tests/booking-mock.spec.ts
```
