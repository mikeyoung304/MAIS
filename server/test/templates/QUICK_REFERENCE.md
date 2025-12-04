# Test Templates Quick Reference

## Quick Copy Commands

```bash
# Service Test
cp server/test/templates/service.test.template.ts server/test/my-service.spec.ts

# Repository Test
cp server/test/templates/repository.test.template.ts server/test/repositories/my-repository.spec.ts

# HTTP Controller Test
cp server/test/templates/controller.test.template.ts server/test/http/my-endpoint.test.ts

# Webhook Test
cp server/test/templates/webhook.test.template.ts server/test/controllers/my-webhook.spec.ts
```

## Template Selection Guide

| What are you testing?           | Use this template             | Location                 |
| ------------------------------- | ----------------------------- | ------------------------ |
| Business logic in service layer | `service.test.template.ts`    | 566 lines, comprehensive |
| Data access / queries           | `repository.test.template.ts` | 649 lines, concurrency   |
| HTTP endpoints / REST API       | `controller.test.template.ts` | 702 lines, HTTP testing  |
| Webhook handlers                | `webhook.test.template.ts`    | 818 lines, idempotency   |

## Placeholders to Replace

### Service Template

- `[ServiceName]` → Your service name (e.g., `Booking`)
- `[service-name]` → Filename (e.g., `booking`)
- `[Repository]` → Repository name (e.g., `Booking`)
- `[Entity]` → Entity builder (e.g., `Booking`)

### Repository Template

- `[RepositoryName]` → Repository name (e.g., `Booking`)
- `[Entity]` → Entity builder (e.g., `Booking`)
- `[DomainError]` → Error type (e.g., `BookingConflictError`)

### Controller Template

- `[resource]` → API resource path (e.g., `bookings`)

### Webhook Template

- `[WebhookName]` → Webhook type (e.g., `Stripe`)
- `[webhook-name]` → Filename (e.g., `stripe-webhook`)
- `[ExternalSDK]` → SDK type (e.g., `Stripe`)
- `[EventType]` → Event name (e.g., `CheckoutSession`)

## Essential Patterns

### Multi-Tenancy (ALWAYS)

```typescript
// ALWAYS pass tenantId as first parameter
await service.getAll('test-tenant');
await repository.findAll('test-tenant');
```

### AAA Pattern

```typescript
it('does something', async () => {
  // Arrange: Setup
  const data = {
    /* ... */
  };

  // Act: Execute
  const result = await service.method('test-tenant', data);

  // Assert: Verify
  expect(result.field).toBe('expected');
});
```

### Builder Pattern

```typescript
// Use builders for test data
const booking = buildBooking({ id: 'test_1', eventDate: '2025-06-15' });
const package = buildPackage({ slug: 'basic', priceCents: 100000 });
const addon = buildAddOn({ packageId: 'pkg_1', priceCents: 5000 });
```

### Error Testing

```typescript
// Test error type and message
await expect(service.method('test-tenant', 'bad-id')).rejects.toThrow(NotFoundError);

await expect(service.method('test-tenant', 'bad-id')).rejects.toThrow(
  'Entity with id "bad-id" not found'
);
```

### Concurrency Testing

```typescript
// Use Promise.allSettled for concurrent ops
const results = await Promise.allSettled([
  repository.create('test-tenant', entity1),
  repository.create('test-tenant', entity2),
]);

const successes = results.filter((r) => r.status === 'fulfilled');
const failures = results.filter((r) => r.status === 'rejected');
```

### HTTP Testing

```typescript
// Supertest chaining
const res = await request(app)
  .post('/v1/resource')
  .set('X-Tenant-Key', testTenantApiKey)
  .send(data)
  .expect(201);

expect(res.body).toHaveProperty('id');
```

## Common Imports

```typescript
// Vitest
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Supertest (HTTP tests)
import request from 'supertest';
import type { Express } from 'express';

// Errors
import { NotFoundError, ValidationError, ConflictError } from '../src/lib/errors';

// Fakes and Builders
import {
  FakeBookingRepository,
  FakeCatalogRepository,
  FakeWebhookRepository,
  FakeEventEmitter,
  buildBooking,
  buildPackage,
  buildAddOn,
} from './helpers/fakes';

// Services
import { BookingService } from '../src/services/booking.service';

// App (HTTP tests)
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/lib/core/config';
```

## Test Structure Template

```typescript
describe('ComponentName', () => {
  let component: Component;
  let dependency: FakeDependency;

  beforeEach(() => {
    dependency = new FakeDependency();
    component = new Component(dependency);
  });

  describe('methodName', () => {
    it('handles happy path', async () => {
      // Test happy path
    });

    it('validates input', async () => {
      // Test validation
    });

    it('handles errors', async () => {
      // Test error cases
    });

    it('respects tenant isolation', async () => {
      // Test multi-tenancy
    });
  });
});
```

## Test Coverage Goals

- Services: 90%+
- Repositories: 85%+
- Controllers: 80%+
- Webhooks: 95%+

```bash
# Check coverage
npm test -- --coverage
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific file
npm test -- booking.spec.ts

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage

# Run only integration tests
npm test -- repositories/
```

## Troubleshooting Quick Fixes

| Problem                | Solution                                                                |
| ---------------------- | ----------------------------------------------------------------------- |
| "tenantId is required" | Pass tenantId as first param: `service.method('test-tenant', ...)`      |
| Tests interfere        | Use `beforeEach` not `beforeAll`                                        |
| Async timeout          | Add `await` or increase timeout: `it('test', async () => {...}, 10000)` |
| Mock not called        | Verify you're testing mocked instance, use `vi.fn()`                    |
| HTTP 404               | Check route, method, tenant key, path                                   |

## File Locations

- Templates: `/Users/mikeyoung/CODING/Elope/server/test/templates/`
- Fakes: `/Users/mikeyoung/CODING/Elope/server/test/helpers/fakes.ts`
- Errors: `/Users/mikeyoung/CODING/Elope/server/src/lib/core/errors.ts`
- Examples:
  - Service: `server/test/catalog.service.spec.ts`
  - Repository: `server/test/repositories/booking-concurrency.spec.ts`
  - HTTP: `server/test/http/packages.test.ts`
  - Webhook: `server/test/controllers/webhooks.controller.spec.ts`

## Template Features at a Glance

### service.test.template.ts

- ✓ CRUD operations
- ✓ Validation patterns
- ✓ Error handling
- ✓ Multi-tenancy
- ✓ Async operations
- ✓ Dependency mocking

### repository.test.template.ts

- ✓ CRUD operations
- ✓ Concurrency tests
- ✓ Query methods
- ✓ Tenant isolation
- ✓ Data consistency
- ✓ Edge cases

### controller.test.template.ts

- ✓ HTTP methods (GET/POST/PATCH/DELETE)
- ✓ Authentication
- ✓ Authorization
- ✓ Status codes
- ✓ Validation
- ✓ CORS
- ✓ Tenant isolation

### webhook.test.template.ts

- ✓ Signature verification
- ✓ Idempotency
- ✓ Event validation
- ✓ Error handling
- ✓ Duplicate detection
- ✓ Event routing
- ✓ Webhook recording

---

**For full documentation, see:** [README.md](./README.md)
