# Elope Test Templates

Comprehensive test templates for the Elope project. These templates provide standardized patterns for writing unit, integration, and HTTP tests with proper multi-tenancy support.

## Table of Contents

- [Overview](#overview)
- [Available Templates](#available-templates)
- [Quick Start](#quick-start)
- [Template Usage](#template-usage)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

The Elope project uses a consistent testing architecture:

- **Vitest** for test running and assertions
- **Supertest** for HTTP endpoint testing
- **Fake repositories** for isolation and speed
- **Builder functions** for test data creation
- **Multi-tenancy** as a first-class concern

All templates follow the **AAA pattern** (Arrange-Act-Assert) and include comprehensive examples of common test scenarios.

---

## Available Templates

### 1. Service Test Template

**File:** `service.test.template.ts`

**Use for:** Testing service layer business logic

**Features:**

- CRUD operation tests
- Validation testing
- Error handling
- Multi-tenancy patterns
- Async operation testing
- Dependency interaction tests

**When to use:**

- Testing business logic
- Testing service methods that orchestrate repositories
- Testing validation rules
- Testing complex calculations or transformations

---

### 2. Repository Test Template

**File:** `repository.test.template.ts`

**Use for:** Testing data access layer

**Features:**

- CRUD operation tests
- Data persistence verification
- Concurrency and race condition tests
- Query method tests
- Constraint validation
- Tenant isolation tests

**When to use:**

- Testing repository implementations
- Testing data access patterns
- Testing query methods
- Testing concurrent operations
- Testing database constraints

---

### 3. Controller/HTTP Test Template

**File:** `controller.test.template.ts`

**Use for:** Testing HTTP endpoints

**Features:**

- Request/response testing
- Authentication tests
- Authorization tests
- Validation tests
- Status code tests
- Content negotiation
- CORS testing
- Tenant isolation

**When to use:**

- Testing REST API endpoints
- Testing HTTP contracts
- Testing authentication/authorization
- Testing request validation
- Testing API responses

---

### 4. Webhook Test Template

**File:** `webhook.test.template.ts`

**Use for:** Testing webhook handlers

**Features:**

- Webhook signature verification
- Idempotency testing
- Event validation
- Error handling
- Webhook recording
- Duplicate detection
- Event type routing

**When to use:**

- Testing Stripe webhooks
- Testing external service webhooks
- Testing event processing
- Testing webhook security

---

## Quick Start

### Step 1: Choose Your Template

Select the appropriate template based on what you're testing:

```bash
# Service layer test
cp server/test/templates/service.test.template.ts server/test/my-service.spec.ts

# Repository test
cp server/test/templates/repository.test.template.ts server/test/repositories/my-repository.spec.ts

# HTTP endpoint test
cp server/test/templates/controller.test.template.ts server/test/http/my-endpoint.test.ts

# Webhook handler test
cp server/test/templates/webhook.test.template.ts server/test/controllers/my-webhook.spec.ts
```

### Step 2: Find and Replace Placeholders

Each template uses placeholders that you need to replace:

**Common placeholders:**

- `[ServiceName]` - Your service class name (e.g., BookingService)
- `[RepositoryName]` - Your repository name (e.g., Booking, Catalog)
- `[Entity]` - Your entity type (e.g., Booking, Package)
- `[resource]` - Your API resource path (e.g., bookings, packages)
- `[WebhookName]` - Your webhook type (e.g., Stripe, PayPal)

**Pro tip:** Use your editor's find/replace with case sensitivity:

1. Find: `[ServiceName]` → Replace: `Booking`
2. Find: `[service-name]` → Replace: `booking`
3. Find: `[Repository]` → Replace: `Booking`
4. Find: `[Entity]` → Replace: `Booking`

### Step 3: Update Imports

Replace placeholder imports with your actual files:

```typescript
// Before
import { [ServiceName]Service } from '../src/services/[service-name].service';

// After
import { BookingService } from '../src/services/booking.service';
```

### Step 4: Customize Test Data

Update builder functions and test data to match your entity:

```typescript
// Before
const entity = build[Entity]({ id: 'entity_1', field: 'value' });

// After
const booking = buildBooking({
  id: 'booking_1',
  eventDate: '2025-06-15',
  coupleName: 'John & Jane',
});
```

### Step 5: Remove TODO Comments

Each template includes TODO comments to guide you. Remove them once addressed:

```typescript
// TODO: Add your service-specific dependencies
// TODO: Customize test data to match your entity structure
```

### Step 6: Run Tests

```bash
# Run your new test file
npm test -- my-service.spec.ts

# Run in watch mode
npm test -- --watch my-service.spec.ts
```

---

## Template Usage

### Service Test Template

#### Example: Testing a BookingService

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BookingService } from '../src/services/booking.service';
import { NotFoundError, ValidationError } from '../src/lib/errors';
import { FakeBookingRepository, buildBooking } from './helpers/fakes';

describe('BookingService', () => {
  let service: BookingService;
  let repository: FakeBookingRepository;

  beforeEach(() => {
    repository = new FakeBookingRepository();
    service = new BookingService(repository);
  });

  describe('createBooking', () => {
    it('creates a new booking successfully', async () => {
      // Arrange
      const data = {
        eventDate: '2025-06-15',
        coupleName: 'John & Jane',
        email: 'couple@example.com',
        packageId: 'pkg_123',
      };

      // Act
      const result = await service.createBooking('test-tenant', data);

      // Assert
      expect(result.eventDate).toBe('2025-06-15');
      expect(result.coupleName).toBe('John & Jane');
      expect(result.id).toBeDefined();
    });

    it('throws ValidationError when date is in the past', async () => {
      // Arrange
      const data = {
        eventDate: '2020-01-01', // Past date
        coupleName: 'John & Jane',
        email: 'couple@example.com',
        packageId: 'pkg_123',
      };

      // Act & Assert
      await expect(service.createBooking('test-tenant', data)).rejects.toThrow(ValidationError);
    });
  });
});
```

---

### Repository Test Template

#### Example: Testing a BookingRepository

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeBookingRepository, buildBooking } from '../helpers/fakes';
import { BookingConflictError } from '../../src/lib/errors';

describe('BookingRepository', () => {
  let repository: FakeBookingRepository;

  beforeEach(() => {
    repository = new FakeBookingRepository();
  });

  describe('create', () => {
    it('prevents duplicate bookings for same date', async () => {
      // Arrange
      const booking1 = buildBooking({ id: 'booking_1', eventDate: '2025-06-15' });
      await repository.create('test-tenant', booking1);

      // Act & Assert
      const booking2 = buildBooking({ id: 'booking_2', eventDate: '2025-06-15' });
      await expect(repository.create('test-tenant', booking2)).rejects.toThrow(
        BookingConflictError
      );
    });
  });

  describe('concurrency', () => {
    it('handles concurrent creates correctly', async () => {
      // Arrange
      const date = '2025-06-15';
      const booking1 = buildBooking({ id: 'booking_1', eventDate: date });
      const booking2 = buildBooking({ id: 'booking_2', eventDate: date });

      // Act: Concurrent creation
      const results = await Promise.allSettled([
        repository.create('test-tenant', booking1),
        repository.create('test-tenant', booking2),
      ]);

      // Assert: Only one succeeds
      const successes = results.filter((r) => r.status === 'fulfilled');
      expect(successes.length).toBe(1);
    });
  });
});
```

---

### Controller/HTTP Test Template

#### Example: Testing GET /v1/bookings

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/lib/core/config';

describe('GET /v1/bookings', () => {
  let app: Express;
  let testTenantApiKey: string;

  beforeAll(async () => {
    // Setup test tenant
    testTenantApiKey = 'pk_test_123456789abcdef';

    const config = loadConfig();
    app = createApp({ ...config, ADAPTERS_PRESET: 'mock' });
  });

  it('returns list of bookings', async () => {
    const res = await request(app)
      .get('/v1/bookings')
      .set('X-Tenant-Key', testTenantApiKey)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 401 when API key is missing', async () => {
    await request(app).get('/v1/bookings').expect(401);
  });
});
```

---

### Webhook Test Template

#### Example: Testing Stripe Checkout Webhook

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { StripeWebhookController } from '../../src/controllers/stripe-webhook.controller';
import { FakePaymentProvider, FakeWebhookRepository } from '../helpers/fakes';
import type Stripe from 'stripe';

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;
  let webhookRepo: FakeWebhookRepository;
  let paymentProvider: FakePaymentProvider;

  beforeEach(() => {
    webhookRepo = new FakeWebhookRepository();
    paymentProvider = new FakePaymentProvider();
    controller = new StripeWebhookController(paymentProvider, webhookRepo);
  });

  it('processes checkout.session.completed webhook', async () => {
    // Arrange
    const event: Stripe.Event = {
      id: 'evt_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          metadata: {
            tenantId: 'test-tenant',
            packageId: 'pkg_123',
            eventDate: '2025-06-15',
          },
        } as Stripe.CheckoutSession,
      },
    };

    paymentProvider.verifyWebhook = async () => event;
    const rawBody = JSON.stringify(event);

    // Act
    await controller.handleStripeWebhook(rawBody, 'signature');

    // Assert
    expect(webhookRepo.events.length).toBe(1);
    expect(webhookRepo.events[0]?.status).toBe('PROCESSED');
  });
});
```

---

## Common Patterns

### Multi-Tenancy Pattern

**Always pass tenantId as the first parameter:**

```typescript
// Service methods
await service.getBookings('test-tenant');
await service.createBooking('test-tenant', data);

// Repository methods
await repository.findAll('test-tenant');
await repository.create('test-tenant', entity);
```

**Test tenant isolation:**

```typescript
it('only returns data for specified tenant', async () => {
  // Arrange: Create data for different tenants
  await repository.create('tenant-1', buildEntity({ id: 'entity_1' }));
  await repository.create('tenant-2', buildEntity({ id: 'entity_2' }));

  // Act: Query for tenant-1
  const result = await service.getAll('tenant-1');

  // Assert: Only tenant-1 data returned
  expect(result.some((e) => e.id === 'entity_1')).toBe(true);
  expect(result.some((e) => e.id === 'entity_2')).toBe(false);
});
```

---

### Builder Pattern

**Use builder functions for test data:**

```typescript
// Good: Using builder with overrides
const booking = buildBooking({
  id: 'booking_123',
  eventDate: '2025-06-15',
  coupleName: 'Custom Name',
});

// Avoid: Creating objects manually
const booking = {
  id: 'booking_123',
  eventDate: '2025-06-15',
  coupleName: 'Custom Name',
  packageId: 'pkg_123',
  email: 'test@example.com',
  addOnIds: [],
  totalCents: 100000,
  status: 'PAID',
  createdAt: new Date().toISOString(),
  // ... many more fields
};
```

**Builder functions provide:**

- Sensible defaults
- Type safety
- Less boilerplate
- Easy customization

---

### AAA Pattern (Arrange-Act-Assert)

**Structure every test with clear sections:**

```typescript
it('creates a booking successfully', async () => {
  // Arrange: Set up test data and conditions
  const data = {
    eventDate: '2025-06-15',
    coupleName: 'John & Jane',
    email: 'couple@example.com',
  };

  // Act: Execute the code under test
  const result = await service.createBooking('test-tenant', data);

  // Assert: Verify the results
  expect(result.eventDate).toBe('2025-06-15');
  expect(result.coupleName).toBe('John & Jane');
  expect(result.id).toBeDefined();
});
```

---

### Error Testing Pattern

**Test both error type and message:**

```typescript
it('throws NotFoundError when entity not found', async () => {
  // Act & Assert: Verify error type
  await expect(service.getById('test-tenant', 'nonexistent')).rejects.toThrow(NotFoundError);

  // Assert: Verify error message
  await expect(service.getById('test-tenant', 'nonexistent')).rejects.toThrow(
    'Entity with id "nonexistent" not found'
  );
});
```

---

### Async Testing Pattern

**Always use async/await:**

```typescript
// Good: async/await
it('processes async operation', async () => {
  const result = await service.processAsync('test-tenant', 'id');
  expect(result).toBeDefined();
});

// Avoid: Callback-based
it('processes async operation', (done) => {
  service.processAsync('test-tenant', 'id').then((result) => {
    expect(result).toBeDefined();
    done();
  });
});
```

---

### Concurrency Testing Pattern

**Use Promise.allSettled for concurrent operations:**

```typescript
it('handles concurrent operations correctly', async () => {
  // Arrange
  const operations = [
    repository.create('test-tenant', entity1),
    repository.create('test-tenant', entity2),
    repository.create('test-tenant', entity3),
  ];

  // Act
  const results = await Promise.allSettled(operations);

  // Assert
  const successes = results.filter((r) => r.status === 'fulfilled');
  const failures = results.filter((r) => r.status === 'rejected');

  expect(successes.length).toBe(2);
  expect(failures.length).toBe(1);
});
```

---

### HTTP Testing Pattern

**Use Supertest's chainable API:**

```typescript
it('returns correct response', async () => {
  const res = await request(app)
    .post('/v1/bookings')
    .set('X-Tenant-Key', testTenantApiKey)
    .set('Content-Type', 'application/json')
    .send({ eventDate: '2025-06-15' })
    .expect('Content-Type', /json/)
    .expect(201);

  expect(res.body).toHaveProperty('id');
  expect(res.body.eventDate).toBe('2025-06-15');
});
```

---

### Mocking Dependencies Pattern

**Use Vitest's vi.fn() for mocking:**

```typescript
it('calls dependency correctly', async () => {
  // Arrange: Create mock
  const emailService = {
    sendEmail: vi.fn().mockResolvedValue(undefined),
  };

  const service = new BookingService(repository, emailService);

  // Act
  await service.createBooking('test-tenant', data);

  // Assert: Verify mock was called
  expect(emailService.sendEmail).toHaveBeenCalledWith({
    to: 'couple@example.com',
    subject: 'Booking Confirmation',
    html: expect.any(String),
  });
  expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
});
```

---

## Troubleshooting

### Issue: Tests fail with "tenantId is required"

**Solution:** Ensure you're passing tenantId as the first parameter to all service and repository methods:

```typescript
// Wrong
const result = await service.getBookings();

// Correct
const result = await service.getBookings('test-tenant');
```

---

### Issue: Tests interfere with each other

**Solution:** Use `beforeEach` to reset state, not `beforeAll`:

```typescript
// Good: Fresh state per test
beforeEach(() => {
  repository = new FakeBookingRepository();
  service = new BookingService(repository);
});

// Avoid: Shared state
beforeAll(() => {
  repository = new FakeBookingRepository();
  service = new BookingService(repository);
});
```

---

### Issue: Async tests timing out

**Solution:**

1. Ensure you're using `async/await`
2. Check that promises are properly awaited
3. Increase timeout if needed:

```typescript
it('performs long operation', async () => {
  // ... test code
}, 10000); // 10 second timeout
```

---

### Issue: Mock not being called

**Solution:** Verify you're testing the mocked instance, not the original:

```typescript
// Create mock
const mockService = {
  method: vi.fn().mockResolvedValue('result'),
};

// Use the mock
const controller = new Controller(mockService);

// Test the mock
await controller.action();
expect(mockService.method).toHaveBeenCalled();
```

---

### Issue: HTTP tests return 404

**Solution:**

1. Verify route is registered in app
2. Check HTTP method matches (GET, POST, etc.)
3. Verify tenant API key is set
4. Check path is correct

```typescript
// Verify all parts
await request(app)
  .get('/v1/bookings') // Correct path
  .set('X-Tenant-Key', testTenantApiKey) // Required header
  .expect(200); // Expected status
```

---

### Issue: Fake repository not working as expected

**Solution:** Check that you're using the correct fake repository and that it's properly initialized:

```typescript
// Ensure fake is imported
import { FakeBookingRepository } from './helpers/fakes';

// Initialize fresh instance
beforeEach(() => {
  repository = new FakeBookingRepository();
});

// Clear between tests if needed
afterEach(() => {
  repository.clear();
});
```

---

## Best Practices

### 1. Test Naming

**Use descriptive test names that explain behavior:**

```typescript
// Good
it('throws ValidationError when price is negative');
it('creates booking successfully with valid data');
it('returns 404 when resource not found');

// Avoid
it('test 1');
it('should work');
it('handles error');
```

---

### 2. Test Organization

**Group related tests with describe blocks:**

```typescript
describe('BookingService', () => {
  describe('createBooking', () => {
    it('creates booking successfully');
    it('validates required fields');
    it('prevents duplicate bookings');
  });

  describe('updateBooking', () => {
    it('updates booking successfully');
    it('throws NotFoundError for missing booking');
  });
});
```

---

### 3. Test Independence

**Each test should be independent:**

```typescript
// Good: Self-contained test
it('creates booking', async () => {
  const data = {
    /* test data */
  };
  const result = await service.create('test-tenant', data);
  expect(result).toBeDefined();
});

// Avoid: Depends on previous test
let sharedBooking;
it('creates booking', async () => {
  sharedBooking = await service.create('test-tenant', data);
});
it('updates booking', async () => {
  await service.update('test-tenant', sharedBooking.id, updates);
});
```

---

### 4. Assertion Clarity

**Make assertions specific and clear:**

```typescript
// Good: Specific assertions
expect(result.eventDate).toBe('2025-06-15');
expect(result.coupleName).toBe('John & Jane');
expect(result.totalCents).toBe(100000);

// Avoid: Vague assertions
expect(result).toBeTruthy();
expect(result).toBeDefined();
```

---

### 5. Edge Case Testing

**Test edge cases and boundary conditions:**

```typescript
describe('edge cases', () => {
  it('handles empty string fields');
  it('handles very large numbers');
  it('handles special characters');
  it('handles maximum length strings');
  it('handles minimum/maximum date values');
});
```

---

### 6. Error Path Testing

**Test error paths as thoroughly as happy paths:**

```typescript
describe('createBooking', () => {
  // Happy path
  it('creates booking successfully');

  // Error paths
  it('throws ValidationError for missing fields');
  it('throws ValidationError for invalid date');
  it('throws ConflictError for duplicate booking');
  it('throws NotFoundError for invalid package');
});
```

---

### 7. Comment When Necessary

**Add comments for complex or non-obvious test logic:**

```typescript
it('handles complex business rule', async () => {
  // This test verifies that when a booking is created within 48 hours
  // of the event date, an express processing fee is automatically added
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await service.create('test-tenant', {
    eventDate: tomorrow.toISOString(),
    // ... other fields
  });

  // Express fee should be added
  expect(result.fees).toContain('EXPRESS_PROCESSING');
});
```

---

### 8. Avoid Test Duplication

**Use helper functions for repeated test setup:**

```typescript
// Helper function
async function createTestBooking(overrides = {}) {
  const booking = buildBooking({
    eventDate: '2025-06-15',
    coupleName: 'John & Jane',
    ...overrides,
  });
  return await repository.create('test-tenant', booking);
}

// Use in tests
it('finds booking by id', async () => {
  const booking = await createTestBooking();
  const found = await repository.findById('test-tenant', booking.id);
  expect(found).not.toBeNull();
});
```

---

### 9. Clean Up Resources

**Clean up test data when using real databases:**

```typescript
afterEach(async () => {
  // Clean up test data
  await prisma.booking.deleteMany({
    where: { tenantId: 'test-tenant' },
  });
});

afterAll(async () => {
  // Disconnect database
  await prisma.$disconnect();
});
```

---

### 10. Test Coverage Goals

**Aim for these coverage targets:**

- **Services:** 90%+ coverage
- **Repositories:** 85%+ coverage
- **Controllers:** 80%+ coverage
- **Webhooks:** 95%+ coverage (critical path)

**Run coverage:**

```bash
npm test -- --coverage
```

---

## Additional Resources

### Project-Specific Files

- **Existing Tests:** `/Users/mikeyoung/CODING/Elope/server/test/`
- **Fake Repositories:** `/Users/mikeyoung/CODING/Elope/server/test/helpers/fakes.ts`
- **Builder Functions:** `/Users/mikeyoung/CODING/Elope/server/test/helpers/fakes.ts`
- **Error Types:** `/Users/mikeyoung/CODING/Elope/server/src/lib/core/errors.ts`

### Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

### Getting Help

If you encounter issues or have questions:

1. Check existing test files for examples
2. Review this README's troubleshooting section
3. Consult the project's test documentation
4. Ask the team for guidance

---

## Summary

**Key Takeaways:**

1. **Choose the right template** for your test type
2. **Replace placeholders** with your actual code
3. **Follow the AAA pattern** (Arrange-Act-Assert)
4. **Test multi-tenancy** in all tests
5. **Use builder functions** for test data
6. **Test error paths** as thoroughly as happy paths
7. **Keep tests isolated** and independent
8. **Write descriptive test names**
9. **Mock dependencies** appropriately
10. **Maintain high test coverage**

Happy testing! 🎯
