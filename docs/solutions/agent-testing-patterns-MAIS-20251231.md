---
module: MAIS
date: 2025-12-31
problem_type: testing_guidance
component: server/src/agent
focus: Comprehensive testing patterns for agent tools and services
severity: P1
related_docs:
  - agent-implementation-prevention-phase-3-MAIS-20251231.md
  - agent-tools-quick-checklist-MAIS-20251231.md
tags: [agent, testing, vitest, type-safety, mocking, patterns]
---

# Agent Testing Patterns - Phase 3

Comprehensive testing guidance to catch Phase 3 issues before code review.

---

## Test Categories

Every agent tool needs tests in these categories:

1. **Happy Path Tests** - Normal operation with valid input
2. **Validation Tests** - Invalid input handling
3. **Optional Field Tests** - Missing optional data
4. **Type Safety Tests** - Malformed JSON, unknown types
5. **Tenant Isolation Tests** - Security and multi-tenancy
6. **Error Case Tests** - All error paths tested
7. **Integration Tests** - End-to-end with database

---

## Pattern 1: Happy Path Testing

Tests the tool succeeds with valid input.

```typescript
describe('myTool - happy path', () => {
  let context: ToolContext;
  let prisma: PrismaClient;

  beforeEach(async () => {
    prisma = await setupTestDatabase();
    // Create test tenant and data
    const tenant = await prisma.tenant.create({
      data: { id: 'test-tenant', name: 'Test Business' },
    });

    context = {
      tenantId: tenant.id,
      prisma,
      sessionId: 'test-session',
    };
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  it('should return data for valid input', async () => {
    // Setup
    const package = await prisma.package.create({
      data: {
        tenantId: context.tenantId,
        slug: 'test-package',
        name: 'Test Package',
        description: 'A test package',
        basePrice: 10000, // $100.00
        bookingType: 'DATE',
      },
    });

    // Execute
    const result = await myTool.execute(context, {
      packageId: package.id,
    });

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe(package.id);
    expect(result.data.name).toBe('Test Package');
  });

  it('should include properly formatted price', async () => {
    const package = await prisma.package.create({
      data: {
        tenantId: context.tenantId,
        slug: 'premium',
        name: 'Premium Package',
        basePrice: 50000, // $500.00
        bookingType: 'DATE',
      },
    });

    const result = await myTool.execute(context, {
      packageId: package.id,
    });

    expect(result.success).toBe(true);
    // Price should be formatted as $500.00
    expect(result.data.price).toBe('$500.00');
    expect(result.data.priceInCents).toBe(50000);
  });

  it('should order results consistently', async () => {
    // Create multiple packages
    const pkg1 = await prisma.package.create({
      data: {
        tenantId: context.tenantId,
        slug: 'a',
        name: 'Alpha',
        basePrice: 100,
        bookingType: 'DATE',
      },
    });
    const pkg2 = await prisma.package.create({
      data: {
        tenantId: context.tenantId,
        slug: 'b',
        name: 'Beta',
        basePrice: 200,
        bookingType: 'DATE',
      },
    });

    const result = await myTool.execute(context, {});

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].slug).toBe('a');
    expect(result.data[1].slug).toBe('b');
  });
});
```

---

## Pattern 2: Validation Error Testing

Tests that invalid input is caught and reported clearly.

```typescript
describe('myTool - validation', () => {
  let context: ToolContext;

  beforeEach(async () => {
    context = {
      tenantId: 'test-tenant',
      prisma: mockPrisma,
      sessionId: 'test-session',
    };
  });

  describe('email validation', () => {
    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        'not-an-email',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
        '',
      ];

      for (const email of invalidEmails) {
        const result = await myTool.execute(context, {
          customerEmail: email,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('valid email');
      }
    });

    it('should accept valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'name.surname@example.co.uk',
        'user+tag@example.com',
      ];

      for (const email of validEmails) {
        const result = await myTool.execute(context, {
          customerEmail: email,
          // ... other required params
        });

        if (result.success === false && result.error?.includes('email')) {
          throw new Error(`Valid email rejected: ${email}`);
        }
      }
    });
  });

  describe('date validation', () => {
    it('should reject past dates', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = await myTool.execute(context, {
        date: yesterday.toISOString().split('T')[0],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('past');
    });

    it('should accept future dates', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // This should not fail on date validation
      const result = await myTool.execute(context, {
        date: tomorrowStr,
        // ... other required params (might fail on other validations)
      });

      // If it fails, it should NOT be due to date
      if (!result.success && result.error?.includes('date')) {
        throw new Error('Valid future date was rejected');
      }
    });

    it('should reject invalid date formats', async () => {
      const invalidDates = [
        'not-a-date',
        '2025-13-01', // Invalid month
        '2025-01-32', // Invalid day
        '01-01-2025', // Wrong format
      ];

      for (const date of invalidDates) {
        const result = await myTool.execute(context, {
          date,
          // ... other params
        });

        expect(result.success).toBe(false);
      }
    });
  });

  describe('required field validation', () => {
    it('should reject missing required fields', async () => {
      const requiredFields = ['packageId', 'date', 'customerName', 'customerEmail'];

      for (const field of requiredFields) {
        const params = {
          packageId: 'pkg-123',
          date: '2025-01-15',
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
        };

        // Remove the field
        delete params[field];

        const result = await myTool.execute(context, params);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should reject empty string values for required fields', async () => {
      const result = await myTool.execute(context, {
        packageId: '',
        date: '2025-01-15',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      });

      expect(result.success).toBe(false);
    });
  });
});
```

---

## Pattern 3: Optional Field Testing

Tests that missing optional data doesn't crash the tool.

```typescript
describe('myTool - optional fields', () => {
  let context: ToolContext;
  let tenant: any;
  let package: any;

  beforeEach(async () => {
    // Create test data with minimal fields
    tenant = await prisma.tenant.create({
      data: {
        id: 'test-tenant',
        name: 'Test Business',
        // location is optional
        // settings is optional
      },
    });

    package = await prisma.package.create({
      data: {
        tenantId: tenant.id,
        slug: 'basic',
        name: 'Basic Package',
        description: null, // Optional field
        basePrice: 10000,
        bookingType: 'DATE',
      },
    });

    context = {
      tenantId: tenant.id,
      prisma,
      sessionId: 'test-session',
    };
  });

  it('should handle missing optional field (null)', async () => {
    const result = await myTool.execute(context, {
      packageId: package.id,
    });

    // Should not crash
    expect(result.success).toBe(true);
    // Description might be null or use a default
    expect(result.data.description).toBeDefined(); // Either null or default value
  });

  it('should handle missing optional field (undefined)', async () => {
    const result = await myTool.execute(context, {
      packageId: package.id,
      notes: undefined, // Explicitly undefined
    });

    expect(result.success).toBe(true);
  });

  it('should handle optional relation that is null', async () => {
    // Create package without segment
    const packageNoSegment = await prisma.package.create({
      data: {
        tenantId: tenant.id,
        slug: 'no-segment',
        name: 'No Segment Package',
        basePrice: 5000,
        bookingType: 'DATE',
        // segmentId is optional, not provided
      },
    });

    const result = await myTool.execute(context, {
      packageId: packageNoSegment.id,
    });

    expect(result.success).toBe(true);
    // Segment should be null or default, not crash
    expect(result.data.segment).toBeDefined();
  });

  it('should provide sensible default for missing optional field', async () => {
    const packageMinimal = await prisma.package.create({
      data: {
        tenantId: tenant.id,
        slug: 'minimal',
        name: 'Minimal Package',
        basePrice: 10000,
        bookingType: 'DATE',
        // description not provided
        // notes not provided
      },
    });

    const result = await myTool.execute(context, {
      packageId: packageMinimal.id,
    });

    expect(result.success).toBe(true);
    // Tool should provide safe defaults
    if (result.data.description === null) {
      // OK - null is acceptable for optional fields
    } else if (typeof result.data.description === 'string') {
      // OK - has a default string
      expect(result.data.description.length).toBeGreaterThan(0);
    }
  });
});
```

---

## Pattern 4: Type Safety Testing

Tests that malformed or unknown data is handled gracefully.

```typescript
describe('myTool - type safety', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = {
      tenantId: 'test-tenant',
      prisma: createMockPrisma(),
      sessionId: 'test-session',
    };
  });

  describe('JSON field parsing', () => {
    it('should handle null messages array', async () => {
      // Simulate session with null messages
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        messages: null, // Null instead of array
      });

      const result = await orchestrator.getSession(context.tenantId, 'session-123');

      // Should not crash
      expect(result).toBeDefined();
      expect(result.messages).toEqual([]); // Empty array fallback
    });

    it('should handle undefined messages array', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        messages: undefined,
      });

      const result = await orchestrator.getSession(context.tenantId, 'session-123');

      expect(result.messages).toEqual([]);
    });

    it('should filter out malformed messages', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        messages: [
          { role: 'user', content: 'Valid message' }, // Valid
          { role: 'invalid', content: 'Bad role' }, // Invalid role
          { role: 'user' }, // Missing content
          { content: 'No role' }, // Missing role
          null, // Null message
          undefined, // Undefined message
        ],
      });

      const result = await orchestrator.getSession(context.tenantId, 'session-123');

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Valid message' });
    });

    it('should handle non-array messages field', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        messages: 'not an array', // String instead of array
      });

      const result = await orchestrator.getSession(context.tenantId, 'session-123');

      expect(result.messages).toEqual([]); // Should return empty, not crash
    });

    it('should validate message content type', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        messages: [
          { role: 'user', content: 'Valid string content' },
          { role: 'user', content: 123 }, // Number instead of string
          { role: 'user', content: null }, // Null content
          { role: 'user', content: { nested: 'object' } }, // Object content
        ],
      });

      const result = await orchestrator.getSession(context.tenantId, 'session-123');

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe('Valid string content');
    });
  });

  describe('nested optional field parsing', () => {
    it('should handle null location object', async () => {
      const data = {
        businessType: 'photographer',
        location: null,
      };

      const city = data.location?.city ?? 'Unknown';
      expect(city).toBe('Unknown');
    });

    it('should handle missing city in location', async () => {
      const data = {
        businessType: 'photographer',
        location: { state: 'OR' }, // Missing city
      };

      const city = data.location?.city ?? 'Unknown';
      expect(city).toBe('Unknown');
    });
  });
});
```

---

## Pattern 5: Tenant Isolation Testing

Tests that tools respect multi-tenancy boundaries.

```typescript
describe('myTool - tenant isolation', () => {
  let prisma: PrismaClient;
  let tenant1: any;
  let tenant2: any;
  let package1: any;
  let package2: any;

  beforeEach(async () => {
    prisma = await setupTestDatabase();

    // Create two separate tenants
    tenant1 = await prisma.tenant.create({
      data: { id: 'tenant-1', name: 'Business 1' },
    });

    tenant2 = await prisma.tenant.create({
      data: { id: 'tenant-2', name: 'Business 2' },
    });

    // Create packages for each tenant
    package1 = await prisma.package.create({
      data: {
        tenantId: tenant1.id,
        slug: 'pkg-1',
        name: 'Package 1',
        basePrice: 10000,
        bookingType: 'DATE',
      },
    });

    package2 = await prisma.package.create({
      data: {
        tenantId: tenant2.id,
        slug: 'pkg-2',
        name: 'Package 2',
        basePrice: 20000,
        bookingType: 'DATE',
      },
    });
  });

  it('should not expose packages from other tenants', async () => {
    const context1 = {
      tenantId: tenant1.id,
      prisma,
      sessionId: 'session-1',
    };

    const result = await myTool.execute(context1, {});

    // Should only see packages for tenant1
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(package1.id);
    expect(result.data[0].name).toBe('Package 1');
  });

  it('should reject query if tenant mismatches', async () => {
    const context1 = {
      tenantId: tenant1.id,
      prisma,
      sessionId: 'session-1',
    };

    // Try to access tenant2's package with tenant1's context
    const result = await myTool.execute(context1, {
      packageId: package2.id,
    });

    // Should return not found or error
    expect(result.success).toBe(false);
  });

  it('should isolate bookings by tenant', async () => {
    // Create booking for tenant1
    const booking1 = await prisma.booking.create({
      data: {
        tenantId: tenant1.id,
        customerId: 'customer-1',
        packageId: package1.id,
        date: new Date('2025-02-01'),
        status: 'CONFIRMED',
      },
    });

    const context1 = {
      tenantId: tenant1.id,
      prisma,
      sessionId: 'session-1',
    };

    const context2 = {
      tenantId: tenant2.id,
      prisma,
      sessionId: 'session-2',
    };

    // Tenant1 should see their booking
    const result1 = await getBookingsForDate(context1, '2025-02-01');
    expect(result1.bookings).toHaveLength(1);

    // Tenant2 should not see tenant1's booking
    const result2 = await getBookingsForDate(context2, '2025-02-01');
    expect(result2.bookings).toHaveLength(0);
  });

  it('should not list data from other tenants', async () => {
    const context1 = {
      tenantId: tenant1.id,
      prisma,
    };

    const context2 = {
      tenantId: tenant2.id,
      prisma,
    };

    // Both tenants list packages
    const result1 = await listTool.execute(context1, {});
    const result2 = await listTool.execute(context2, {});

    // Each should only see their own data
    expect(result1.data).toHaveLength(1);
    expect(result1.data[0].id).toBe(package1.id);

    expect(result2.data).toHaveLength(1);
    expect(result2.data[0].id).toBe(package2.id);

    // They shouldn't see each other's data
    expect(result1.data.map((p: any) => p.id)).not.toContain(package2.id);
    expect(result2.data.map((p: any) => p.id)).not.toContain(package1.id);
  });
});
```

---

## Pattern 6: Error Path Testing

Tests all error scenarios and error messages.

```typescript
describe('myTool - error paths', () => {
  let context: ToolContext;
  let tenant: any;

  beforeEach(async () => {
    tenant = await prisma.tenant.create({
      data: { id: 'test-tenant', name: 'Test' },
    });

    context = {
      tenantId: tenant.id,
      prisma,
      sessionId: 'session-1',
    };
  });

  describe('database errors', () => {
    it('should handle package not found gracefully', async () => {
      const result = await myTool.execute(context, {
        packageId: 'nonexistent-package',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    it('should handle date already booked (conflict)', async () => {
      const pkg = await prisma.package.create({
        data: {
          tenantId: context.tenantId,
          slug: 'test',
          name: 'Test',
          basePrice: 10000,
          bookingType: 'DATE',
        },
      });

      const customer = await prisma.customer.create({
        data: {
          tenantId: context.tenantId,
          email: 'test@example.com',
          name: 'Test Customer',
        },
      });

      const bookDate = new Date('2025-02-15');

      // Create first booking
      await prisma.booking.create({
        data: {
          tenantId: context.tenantId,
          packageId: pkg.id,
          customerId: customer.id,
          date: bookDate,
          status: 'CONFIRMED',
        },
      });

      // Try to book same date
      const result = await bookingTool.execute(context, {
        packageId: pkg.id,
        date: '2025-02-15',
        customerName: 'Another Customer',
        customerEmail: 'another@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('no longer available');
    });
  });

  describe('error logging', () => {
    it('should log errors with proper context', async () => {
      const logSpy = jest.spyOn(logger, 'error');

      await myTool.execute(context, {
        packageId: 'nonexistent',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: context.tenantId,
        }),
        expect.any(String)
      );

      logSpy.mockRestore();
    });

    it('should not expose sensitive data in error messages', async () => {
      const result = await myTool.execute(context, {
        customerEmail: 'user@example.com',
      });

      if (!result.success) {
        // Error message should be user-friendly, not expose database details
        expect(result.error).not.toMatch(/P2002|P2025|violation|constraint/i);
      }
    });
  });
});
```

---

## Pattern 7: Integration Testing

End-to-end tests with real database and full flow.

```typescript
describe('myTool - integration', () => {
  let prisma: PrismaClient;
  let testEnv: TestEnvironment;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment();
    prisma = testEnv.prisma;
  });

  afterAll(async () => {
    await teardownTestEnvironment(testEnv);
  });

  it('should complete full booking flow', async () => {
    // 1. Setup: Create tenant with packages
    const tenant = await prisma.tenant.create({
      data: {
        id: 'integration-test',
        name: 'Integration Test Business',
      },
    });

    const pkg = await prisma.package.create({
      data: {
        tenantId: tenant.id,
        slug: 'photoshoot',
        name: 'Portrait Photoshoot',
        description: 'Professional portrait session',
        basePrice: 15000, // $150
        bookingType: 'DATE',
      },
    });

    const context: ToolContext = {
      tenantId: tenant.id,
      prisma,
      sessionId: 'integration-session-1',
    };

    // 2. Execute: Get services
    const servicesResult = await getServicesTool.execute(context, {});
    expect(servicesResult.success).toBe(true);
    expect(servicesResult.data).toHaveLength(1);

    // 3. Execute: Check availability
    const availabilityResult = await checkAvailabilityTool.execute(context, {
      packageId: pkg.id,
      startDate: '2025-02-01',
      endDate: '2025-02-28',
    });
    expect(availabilityResult.success).toBe(true);
    expect(availabilityResult.data.availableDates.length).toBeGreaterThan(0);

    // 4. Execute: Create booking
    const bookingDate = availabilityResult.data.availableDates[0];
    const bookingResult = await bookServiceTool.execute(context, {
      packageId: pkg.id,
      date: bookingDate,
      customerName: 'Jane Smith',
      customerEmail: 'jane@example.com',
    });

    expect(bookingResult.success).toBe(true);
    expect(bookingResult.proposalId).toBeDefined();

    // 5. Verify: Check that date is no longer available
    const updatedAvailability = await checkAvailabilityTool.execute(context, {
      packageId: pkg.id,
    });
    expect(updatedAvailability.data.availableDates).not.toContain(bookingDate);

    // 6. Verify: Database state
    const customer = await prisma.customer.findFirst({
      where: { tenantId: tenant.id, email: 'jane@example.com' },
    });
    expect(customer).toBeDefined();

    const proposal = await prisma.agentProposal.findUnique({
      where: { id: bookingResult.proposalId },
    });
    expect(proposal).toBeDefined();
    expect(proposal.status).toBe('PENDING');
  });

  it('should handle concurrent booking attempts', async () => {
    // Simulate multiple customers trying to book same date
    const tenant = await createTestTenant(prisma);
    const pkg = await createTestPackage(prisma, tenant.id);
    const bookDate = '2025-02-20';

    const context1 = { tenantId: tenant.id, prisma, sessionId: 'session-1' };
    const context2 = { tenantId: tenant.id, prisma, sessionId: 'session-2' };

    // Both attempt to book simultaneously
    const [result1, result2] = await Promise.all([
      bookServiceTool.execute(context1, {
        packageId: pkg.id,
        date: bookDate,
        customerName: 'Customer 1',
        customerEmail: 'customer1@example.com',
      }),
      bookServiceTool.execute(context2, {
        packageId: pkg.id,
        date: bookDate,
        customerName: 'Customer 2',
        customerEmail: 'customer2@example.com',
      }),
    ]);

    // One should succeed, one should fail
    const successes = [result1, result2].filter((r) => r.success);
    const failures = [result1, result2].filter((r) => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});
```

---

## Mock Patterns for Unit Tests

When you need to mock Prisma:

```typescript
// GOOD: Mock specific methods with type safety
const mockPrisma = {
  package: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  booking: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  customer: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
} as unknown as PrismaClient;

// Use in tests
test('should handle package not found', async () => {
  (mockPrisma.package.findUnique as jest.Mock).mockResolvedValue(null);

  const result = await myTool.execute(context, { packageId: 'nonexistent' });

  expect(result.success).toBe(false);
});
```

---

## Test Coverage Targets

Aim for these coverage levels:

| Component        | Target | Metric                 |
| ---------------- | ------ | ---------------------- |
| Tools            | 70%    | Line coverage          |
| Services         | 80%    | Line coverage          |
| Utils            | 85%    | Line coverage          |
| Happy path       | 100%   | All tools tested       |
| Error cases      | 100%   | All error paths tested |
| Tenant isolation | 100%   | Multi-tenant scenarios |

Run coverage report:

```bash
npm run test:coverage -- server/src/agent
```

---

## Pre-Test Checklist

Before running tests:

- [ ] All test files created alongside tool files
- [ ] Test database is clean and isolated
- [ ] Mock data matches schema definitions
- [ ] Error messages are specific (not generic)
- [ ] Tenant isolation tests included
- [ ] Optional field handling tested
- [ ] Type safety tests for JSON fields
- [ ] Integration tests verify full flow

---

## Debugging Failed Tests

### Test Passes Locally, Fails in CI

- Check test database isolation
- Verify test doesn't depend on execution order
- Check for race conditions in concurrent tests
- Ensure timestamps don't cause flakiness

### Tenant Isolation Test Fails

- Verify tenantId is included in WHERE clause
- Check that test creates separate tenants
- Ensure no shared global state between tests
- Verify queries don't accidentally use wildcards

### Type Safety Test Fails

- Check filter function handles all edge cases
- Verify type guards are comprehensive
- Test with actual malformed data from database
- Review JSON parsing logic

### Error Test Fails

- Check that specific error types are caught
- Verify error messages match expectations
- Ensure error context (tenantId, etc.) is logged
- Test error is not swallowed by generic handler

---

## Running Tests

```bash
# Run all agent tests
npm run test -- server/src/agent

# Run specific test file
npm run test -- server/src/agent/customer/customer-tools.test.ts

# Run with coverage
npm run test:coverage -- server/src/agent

# Watch mode (for development)
npm run test:watch -- server/src/agent

# Run tests matching pattern
npm run test -- --grep "tenant isolation"
```

---

## Version History

| Date       | Change                                       |
| ---------- | -------------------------------------------- |
| 2025-12-31 | Initial testing patterns from Phase 3 review |

**Status:** Active - Use for all Phase 3+ agent implementations
