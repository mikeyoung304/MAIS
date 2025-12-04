# Common Test Patterns Reference

Visual reference for common testing patterns in the Elope project.

## Table of Contents

- [Test Structure Patterns](#test-structure-patterns)
- [Data Setup Patterns](#data-setup-patterns)
- [Assertion Patterns](#assertion-patterns)
- [Error Testing Patterns](#error-testing-patterns)
- [Multi-Tenancy Patterns](#multi-tenancy-patterns)
- [Async Patterns](#async-patterns)
- [HTTP Testing Patterns](#http-testing-patterns)
- [Webhook Patterns](#webhook-patterns)

---

## Test Structure Patterns

### Basic Test Structure

```typescript
describe('ComponentName', () => {
  // 1. Declare dependencies
  let component: Component;
  let dependency: FakeDependency;

  // 2. Setup before each test
  beforeEach(() => {
    dependency = new FakeDependency();
    component = new Component(dependency);
  });

  // 3. Group related tests
  describe('methodName', () => {
    // 4. Individual test cases
    it('does something specific', async () => {
      // Arrange
      const input = 'test-data';

      // Act
      const result = await component.method(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Nested Describe Blocks

```typescript
describe('BookingService', () => {
  describe('create operations', () => {
    describe('createBooking', () => {
      it('creates booking successfully');
      it('validates required fields');
    });

    describe('createWithAddons', () => {
      it('creates booking with addons');
    });
  });

  describe('read operations', () => {
    describe('getBooking', () => {
      it('returns booking when found');
      it('throws NotFoundError when missing');
    });
  });
});
```

---

## Data Setup Patterns

### Using Builder Functions

```typescript
// Pattern: Builder with defaults
const booking = buildBooking();
// Result: Fully populated booking with sensible defaults

// Pattern: Builder with overrides
const booking = buildBooking({
  id: 'custom_id',
  eventDate: '2025-06-15',
  coupleName: 'Custom Name',
});
// Result: Booking with custom values, other fields use defaults

// Pattern: Multiple entities
const package1 = buildPackage({ slug: 'basic' });
const package2 = buildPackage({ slug: 'premium' });
const addon1 = buildAddOn({ packageId: package1.id });
const addon2 = buildAddOn({ packageId: package1.id });
```

### Repository Test Data Setup

```typescript
// Pattern: Pre-populate repository
beforeEach(() => {
  repository = new FakeBookingRepository();

  // Add test data
  repository.addBooking(buildBooking({ id: 'existing_1' }));
  repository.addBooking(buildBooking({ id: 'existing_2' }));
});

// Pattern: Setup in test
it('finds existing booking', async () => {
  // Arrange
  const booking = buildBooking({ id: 'test_booking' });
  await repository.create('test-tenant', booking);

  // Act
  const found = await repository.findById('test-tenant', 'test_booking');

  // Assert
  expect(found).not.toBeNull();
});
```

### HTTP Test Data Setup

```typescript
// Pattern: Database setup in beforeAll
beforeAll(async () => {
  prisma = new PrismaClient();

  // Create test tenant
  await prisma.tenant.upsert({
    where: { slug: 'test-tenant' },
    update: { apiKeyPublic: 'pk_test_123' },
    create: {
      id: 'tenant_test',
      slug: 'test-tenant',
      name: 'Test Tenant',
      apiKeyPublic: 'pk_test_123',
      apiKeySecret: 'sk_test_123',
      commissionPercent: 10.0,
      branding: {},
      isActive: true,
    },
  });

  // Create test data
  await prisma.package.create({
    data: {
      id: 'pkg_test',
      slug: 'test-package',
      title: 'Test Package',
      priceCents: 100000,
    },
  });
});
```

---

## Assertion Patterns

### Basic Assertions

```typescript
// Pattern: Exact equality
expect(result.id).toBe('booking_123');
expect(result.priceCents).toBe(100000);
expect(result.status).toBe('PAID');

// Pattern: Truthy/Falsy
expect(result).toBeDefined();
expect(result).not.toBeNull();
expect(result).toBeTruthy();

// Pattern: Object properties
expect(result).toHaveProperty('id');
expect(result).toHaveProperty('eventDate');
expect(result).toHaveProperty('coupleName', 'John & Jane');

// Pattern: Object matching
expect(result).toMatchObject({
  eventDate: '2025-06-15',
  coupleName: 'John & Jane',
  status: 'PAID',
});
```

### Array Assertions

```typescript
// Pattern: Array length
expect(results).toHaveLength(3);
expect(results.length).toBe(3);

// Pattern: Array contents
expect(results).toContain(booking1);
expect(results.some((b) => b.id === 'booking_1')).toBe(true);

// Pattern: Array is empty
expect(results).toHaveLength(0);
expect(results).toEqual([]);

// Pattern: Every item matches
results.forEach((booking) => {
  expect(booking.status).toBe('PAID');
  expect(booking.tenantId).toBe('test-tenant');
});
```

### Complex Assertions

```typescript
// Pattern: Partial object matching
expect(result).toEqual(
  expect.objectContaining({
    id: expect.any(String),
    eventDate: '2025-06-15',
    createdAt: expect.any(String),
  })
);

// Pattern: Array of objects
expect(results).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ id: 'booking_1' }),
    expect.objectContaining({ id: 'booking_2' }),
  ])
);

// Pattern: Nested object
expect(result.metadata).toEqual({
  packageTitle: 'Basic Package',
  addOns: expect.arrayContaining(['addon_1']),
});
```

---

## Error Testing Patterns

### Basic Error Testing

```typescript
// Pattern: Error type only
await expect(service.getById('test-tenant', 'nonexistent')).rejects.toThrow(NotFoundError);

// Pattern: Error type and message
await expect(service.getById('test-tenant', 'nonexistent')).rejects.toThrow(NotFoundError);

await expect(service.getById('test-tenant', 'nonexistent')).rejects.toThrow(
  'Entity with id "nonexistent" not found'
);

// Pattern: Error message substring
await expect(service.create('test-tenant', invalidData)).rejects.toThrow('required');
```

### Validation Error Testing

```typescript
// Pattern: Multiple validation tests
describe('validation', () => {
  it('throws ValidationError for missing field', async () => {
    await expect(
      service.create('test-tenant', {
        /* missing required field */
      })
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for invalid format', async () => {
    await expect(service.create('test-tenant', { field: 'invalid-format' })).rejects.toThrow(
      ValidationError
    );
  });

  it('throws ValidationError for negative price', async () => {
    await expect(service.create('test-tenant', { priceCents: -100 })).rejects.toThrow(
      'priceCents must be non-negative'
    );
  });
});
```

### Try-Catch Error Testing

```typescript
// Pattern: Capture error for detailed assertions
it('throws error with details', async () => {
  try {
    await service.create('test-tenant', invalidData);
    fail('Expected error to be thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain('invalid');
    expect(error.statusCode).toBe(400);
  }
});
```

---

## Multi-Tenancy Patterns

### Service Multi-Tenancy

```typescript
// Pattern: Always pass tenantId first
it('respects tenant isolation', async () => {
  // Arrange: Create data for different tenants
  await service.create('tenant-1', buildBooking({ id: 'booking_1' }));
  await service.create('tenant-2', buildBooking({ id: 'booking_2' }));

  // Act: Query for tenant-1
  const tenant1Bookings = await service.getAll('tenant-1');

  // Assert: Only tenant-1 data returned
  expect(tenant1Bookings.some((b) => b.id === 'booking_1')).toBe(true);
  expect(tenant1Bookings.some((b) => b.id === 'booking_2')).toBe(false);
});
```

### Repository Multi-Tenancy

```typescript
// Pattern: Tenant-scoped queries
it('queries are tenant-scoped', async () => {
  // Arrange: Same ID, different tenants
  await repository.create('tenant-1', buildBooking({ id: 'same_id' }));
  await repository.create('tenant-2', buildBooking({ id: 'same_id' }));

  // Act: Query each tenant
  const tenant1Result = await repository.findById('tenant-1', 'same_id');
  const tenant2Result = await repository.findById('tenant-2', 'same_id');

  // Assert: Each tenant gets their own data
  expect(tenant1Result).not.toBeNull();
  expect(tenant2Result).not.toBeNull();
  expect(tenant1Result).not.toBe(tenant2Result);
});
```

### HTTP Multi-Tenancy

```typescript
// Pattern: Tenant authentication
it('authenticates via tenant API key', async () => {
  const res = await request(app)
    .get('/v1/bookings')
    .set('X-Tenant-Key', testTenantApiKey)
    .expect(200);

  // All results belong to authenticated tenant
  res.body.forEach((booking) => {
    expect(booking.tenantId).toBe('tenant_test');
  });
});

// Pattern: Cross-tenant access prevention
it('prevents access to other tenant data', async () => {
  // Create booking for different tenant
  await createBookingForTenant('other-tenant', 'booking_123');

  // Try to access with wrong tenant key
  await request(app)
    .get('/v1/bookings/booking_123')
    .set('X-Tenant-Key', testTenantApiKey)
    .expect(404); // Not found (not "403 Forbidden" - security through obscurity)
});
```

---

## Async Patterns

### Basic Async/Await

```typescript
// Pattern: Standard async test
it('handles async operation', async () => {
  const result = await service.asyncMethod('test-tenant', 'id');
  expect(result).toBeDefined();
});

// Pattern: Multiple async operations
it('handles multiple async operations', async () => {
  const result1 = await service.method1('test-tenant');
  const result2 = await service.method2('test-tenant', result1.id);
  const result3 = await service.method3('test-tenant', result2.id);

  expect(result3).toBeDefined();
});
```

### Parallel Async Operations

```typescript
// Pattern: Promise.all for independent operations
it('executes operations in parallel', async () => {
  const [booking1, booking2, booking3] = await Promise.all([
    service.create('test-tenant', data1),
    service.create('test-tenant', data2),
    service.create('test-tenant', data3),
  ]);

  expect(booking1).toBeDefined();
  expect(booking2).toBeDefined();
  expect(booking3).toBeDefined();
});
```

### Concurrent Operations with Error Handling

```typescript
// Pattern: Promise.allSettled for concurrent ops with possible failures
it('handles some failures in concurrent operations', async () => {
  const results = await Promise.allSettled([
    repository.create('test-tenant', booking1), // Will succeed
    repository.create('test-tenant', booking2), // Will succeed
    repository.create('test-tenant', booking1), // Will fail (duplicate)
  ]);

  const successes = results.filter((r) => r.status === 'fulfilled');
  const failures = results.filter((r) => r.status === 'rejected');

  expect(successes.length).toBe(2);
  expect(failures.length).toBe(1);

  // Check failure type
  if (failures[0].status === 'rejected') {
    expect(failures[0].reason).toBeInstanceOf(ConflictError);
  }
});
```

### Async Timeouts

```typescript
// Pattern: Test with timeout
it('completes within timeout', async () => {
  const result = await service.longOperation('test-tenant');
  expect(result).toBeDefined();
}, 10000); // 10 second timeout

// Pattern: Test timeout behavior
it('throws timeout error for slow operation', async () => {
  await expect(service.operationWithTimeout('test-tenant', { timeout: 100 })).rejects.toThrow(
    'Operation timed out'
  );
});
```

---

## HTTP Testing Patterns

### GET Requests

```typescript
// Pattern: Basic GET
it('gets list of resources', async () => {
  const res = await request(app)
    .get('/v1/bookings')
    .set('X-Tenant-Key', testTenantApiKey)
    .expect(200);

  expect(Array.isArray(res.body)).toBe(true);
});

// Pattern: GET with query parameters
it('filters by query parameters', async () => {
  const res = await request(app)
    .get('/v1/bookings?status=PAID&limit=10')
    .set('X-Tenant-Key', testTenantApiKey)
    .expect(200);

  res.body.forEach((booking) => {
    expect(booking.status).toBe('PAID');
  });
  expect(res.body.length).toBeLessThanOrEqual(10);
});

// Pattern: GET by ID
it('gets single resource by id', async () => {
  const res = await request(app)
    .get('/v1/bookings/booking_123')
    .set('X-Tenant-Key', testTenantApiKey)
    .expect(200);

  expect(res.body.id).toBe('booking_123');
});
```

### POST Requests

```typescript
// Pattern: Create resource
it('creates new resource', async () => {
  const newBooking = {
    eventDate: '2025-06-15',
    coupleName: 'John & Jane',
    email: 'couple@example.com',
    packageId: 'pkg_123',
  };

  const res = await request(app)
    .post('/v1/bookings')
    .set('X-Tenant-Key', testTenantApiKey)
    .set('Content-Type', 'application/json')
    .send(newBooking)
    .expect(201);

  expect(res.body).toHaveProperty('id');
  expect(res.body.eventDate).toBe('2025-06-15');
});

// Pattern: Validation error
it('returns 400 for invalid data', async () => {
  const invalidBooking = {
    eventDate: 'invalid-date',
    // missing required fields
  };

  const res = await request(app)
    .post('/v1/bookings')
    .set('X-Tenant-Key', testTenantApiKey)
    .send(invalidBooking)
    .expect(400);

  expect(res.body).toHaveProperty('error');
});
```

### PATCH/PUT Requests

```typescript
// Pattern: Update resource
it('updates existing resource', async () => {
  const updates = {
    coupleName: 'Updated Name',
  };

  const res = await request(app)
    .patch('/v1/bookings/booking_123')
    .set('X-Tenant-Key', testTenantApiKey)
    .send(updates)
    .expect(200);

  expect(res.body.coupleName).toBe('Updated Name');
});

// Pattern: Update non-existent
it('returns 404 for non-existent resource', async () => {
  await request(app)
    .patch('/v1/bookings/nonexistent')
    .set('X-Tenant-Key', testTenantApiKey)
    .send({ coupleName: 'Name' })
    .expect(404);
});
```

### DELETE Requests

```typescript
// Pattern: Delete resource
it('deletes resource', async () => {
  await request(app)
    .delete('/v1/bookings/booking_123')
    .set('X-Tenant-Key', testTenantApiKey)
    .expect(204);

  // Verify deletion
  await request(app)
    .get('/v1/bookings/booking_123')
    .set('X-Tenant-Key', testTenantApiKey)
    .expect(404);
});
```

### Authentication Testing

```typescript
// Pattern: Missing auth
it('returns 401 without API key', async () => {
  await request(app).get('/v1/bookings').expect(401);
});

// Pattern: Invalid auth
it('returns 401 for invalid API key', async () => {
  await request(app).get('/v1/bookings').set('X-Tenant-Key', 'invalid_key').expect(401);
});

// Pattern: Inactive tenant
it('returns 403 for inactive tenant', async () => {
  await request(app).get('/v1/bookings').set('X-Tenant-Key', inactiveTenantApiKey).expect(403);
});
```

---

## Webhook Patterns

### Webhook Event Mocking

```typescript
// Pattern: Mock webhook event
it('processes webhook event', async () => {
  // Arrange: Create mock webhook event
  const webhookEvent: Stripe.Event = {
    id: 'evt_123',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_123',
        metadata: {
          tenantId: 'test-tenant',
          packageId: 'pkg_123',
          eventDate: '2025-06-15',
        },
        amount_total: 100000,
      } as Stripe.CheckoutSession,
    },
    api_version: '2023-10-16',
    created: Date.now(),
    livemode: false,
    pending_webhooks: 0,
    request: null,
  };

  // Mock webhook verification
  paymentProvider.verifyWebhook = async () => webhookEvent;

  // Act
  await controller.handleWebhook(JSON.stringify(webhookEvent), 'signature');

  // Assert
  expect(webhookRepo.events[0]?.status).toBe('PROCESSED');
});
```

### Idempotency Testing

```typescript
// Pattern: Duplicate webhook handling
it('handles duplicate webhooks idempotently', async () => {
  const event = createMockWebhookEvent('evt_dup_123');
  const rawBody = JSON.stringify(event);

  // Process first time
  await controller.handleWebhook(rawBody, 'signature');
  const entitiesAfterFirst = await repository.findAll('test-tenant');
  expect(entitiesAfterFirst.length).toBe(1);

  // Process again (duplicate)
  await controller.handleWebhook(rawBody, 'signature');
  const entitiesAfterSecond = await repository.findAll('test-tenant');

  // Assert: Still only one entity
  expect(entitiesAfterSecond.length).toBe(1);

  // Assert: Webhook recorded only once
  expect(webhookRepo.events.length).toBe(1);
});
```

### Webhook Validation

```typescript
// Pattern: Invalid signature
it('rejects invalid webhook signature', async () => {
  paymentProvider.verifyWebhook = async () => {
    throw new Error('Invalid signature');
  };

  await expect(controller.handleWebhook('payload', 'bad_signature')).rejects.toThrow(
    WebhookValidationError
  );
});

// Pattern: Missing metadata
it('rejects webhook with missing metadata', async () => {
  const invalidEvent = createMockWebhookEvent('evt_invalid', {
    metadata: {
      tenantId: 'test-tenant',
      // Missing required fields
    },
  });

  paymentProvider.verifyWebhook = async () => invalidEvent;

  await expect(controller.handleWebhook(JSON.stringify(invalidEvent), 'sig')).rejects.toThrow(
    WebhookValidationError
  );
});
```

### Webhook Error Handling

```typescript
// Pattern: Processing failure
it('marks webhook as failed on error', async () => {
  const event = createMockWebhookEvent('evt_fail');

  // Mock service to fail
  service.processWebhook = async () => {
    throw new Error('Processing failed');
  };

  paymentProvider.verifyWebhook = async () => event;

  // Act & Assert
  await expect(controller.handleWebhook(JSON.stringify(event), 'sig')).rejects.toThrow();

  // Assert: Webhook marked as failed
  expect(webhookRepo.events[0]?.status).toBe('FAILED');
  expect(webhookRepo.events[0]?.lastError).toContain('Processing failed');
});
```

---

## Summary

This patterns guide provides visual examples of common testing patterns in the Elope project. Use these patterns as references when writing your tests.

**Key Takeaways:**

- Always use the AAA pattern (Arrange-Act-Assert)
- Pass tenantId as first parameter for multi-tenancy
- Use builder functions for test data
- Test both happy and error paths
- Use async/await for all async operations
- Test tenant isolation in all tests
- Use descriptive test names
- Keep tests isolated and independent

For complete templates with full examples, see:

- [service.test.template.ts](./service.test.template.ts)
- [repository.test.template.ts](./repository.test.template.ts)
- [controller.test.template.ts](./controller.test.template.ts)
- [webhook.test.template.ts](./webhook.test.template.ts)
- [README.md](./README.md) - Full documentation
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Quick reference card
