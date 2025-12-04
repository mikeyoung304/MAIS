# Service Tests - Quick Reference

This directory contains unit tests for critical Elope server services.

## Test Files

| File                             | Tests | Service              | Description                                     |
| -------------------------------- | ----- | -------------------- | ----------------------------------------------- |
| `commission.service.spec.ts`     | 12    | CommissionService    | Commission calculation, booking totals, refunds |
| `idempotency.service.spec.ts`    | 10    | IdempotencyService   | Key generation, deduplication, race conditions  |
| `stripe-connect.service.spec.ts` | 6     | StripeConnectService | Account creation, onboarding, management        |

**Total**: 28 tests

## Running Tests

### Run All Service Tests

```bash
npm test -- test/services/
```

### Run Individual Test Files

```bash
# Commission tests (12 tests)
npm test -- test/services/commission.service.spec.ts

# Idempotency tests (10 tests)
npm test -- test/services/idempotency.service.spec.ts

# Stripe Connect tests (6 tests)
npm test -- test/services/stripe-connect.service.spec.ts
```

### Run with Coverage

```bash
npm test -- --coverage test/services/
```

### Run in Watch Mode

```bash
npm test -- --watch test/services/commission.service.spec.ts
```

## Environment Setup

These tests require the following environment variables:

```bash
# Stripe API Key (test mode)
STRIPE_SECRET_KEY=sk_test_...

# Encryption key for secrets (generate with: openssl rand -hex 32)
TENANT_SECRETS_ENCRYPTION_KEY=your_64_char_hex_key

# Test database (optional for unit tests, required for integration)
DATABASE_URL_TEST=postgresql://localhost:5432/elope_test
```

## Test Structure

All tests follow the **Arrange-Act-Assert** pattern:

```typescript
it('should calculate commission with standard rate', async () => {
  // Arrange: Set up mocks and test data
  mockPrisma.tenant.findUnique.mockResolvedValue({
    id: 'tenant_123',
    commissionPercent: 12.0,
  });

  // Act: Execute the method under test
  const result = await service.calculateCommission('tenant_123', 50000);

  // Assert: Verify the result
  expect(result.amount).toBe(6000);
  expect(result.percent).toBe(12.0);
});
```

## Mocking Strategy

### Prisma Client

```typescript
mockPrisma = {
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  // ... other models
};
```

### Stripe SDK

```typescript
mockStripe = {
  accounts: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  // ... other resources
};
```

### Encryption Service

```typescript
vi.mock('../../src/lib/encryption.service', () => ({
  encryptionService: {
    encryptStripeSecret: vi.fn(),
    decryptStripeSecret: vi.fn(),
  },
}));
```

## Test Coverage

### CommissionService (12 tests)

- ✅ Basic calculation with standard rates
- ✅ Tenant lookup and commission retrieval
- ✅ Rounding behavior (always rounds up)
- ✅ Stripe min/max enforcement (0.5% - 50%)
- ✅ Booking total calculation with add-ons
- ✅ Add-on validation and security
- ✅ Refund commission calculation

### IdempotencyService (10 tests)

- ✅ Deterministic SHA-256 key generation
- ✅ Duplicate key detection
- ✅ Race condition handling (P2002 errors)
- ✅ Response caching and retrieval
- ✅ TTL and expiration handling
- ✅ Timestamp rounding for checkout keys

### StripeConnectService (6 tests)

- ✅ Express account creation
- ✅ Duplicate account prevention
- ✅ Onboarding link generation
- ✅ Account status tracking
- ✅ Account deletion and cleanup

## Troubleshooting

### Tests Fail with "STRIPE_SECRET_KEY is required"

Set the environment variable:

```bash
export STRIPE_SECRET_KEY=sk_test_your_key_here
```

### Tests Fail with "TENANT_SECRETS_ENCRYPTION_KEY is required"

Generate and set the encryption key:

```bash
export TENANT_SECRETS_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### Prisma Client Not Found

Generate Prisma Client:

```bash
npm run prisma:generate
```

### Watch Mode Not Working

Install vitest:

```bash
npm install -D vitest
```

## Related Documentation

- [WAVE1_SUBAGENT_1C_REPORT.md](../../../WAVE1_SUBAGENT_1C_REPORT.md) - Full test plan
- [PHASE1_P0_TESTS_IMPLEMENTATION_REPORT.md](../../../PHASE1_P0_TESTS_IMPLEMENTATION_REPORT.md) - Implementation report
- [Test Helpers](../helpers/README.md) - Shared test utilities

## Next Steps

After verifying these tests pass:

1. **Phase 2 Tests**: StripePaymentAdapter (8 tests)
2. **Integration Tests**: Real database testing
3. **E2E Tests**: Full checkout flow testing

---

**Last Updated**: November 15, 2025
**Status**: ✅ Ready for testing
