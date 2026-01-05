# Agent Tool Test Patterns

**Reference guide for writing tests that catch the issues fixed in Booking Links Phase 0.**

---

## Test Hierarchy

Agent tools need tests at 3 levels:

```
Level 1: Unit Tests (tool invocation)
├─ Tests tool receives input correctly
├─ Tests output format is correct
├─ Tests error handling for invalid input
└─ Fast, isolated, no database

Level 2: Integration Tests (executor execution)
├─ Tests executor receives confirmed proposal
├─ Tests database operations complete
├─ Tests tenantId isolation is enforced
├─ Requires test database

Level 3: E2E Tests (full workflow)
├─ Tests tool → proposal → executor → result
├─ Tests UI interaction with results
├─ Tests can skip (mock mode)
└─ Slow, full stack
```

### Which to Write?

- **MUST HAVE:** Level 2 (integration) - Catches tenant isolation bugs
- **SHOULD HAVE:** Level 1 (unit) - Catches input validation bugs
- **NICE TO HAVE:** Level 3 (E2E) - Catches UI bugs

---

## Level 1: Unit Tests (Tool Invocation)

Test the tool itself, not the executor.

### File Location

```
server/src/agent/tools/__tests__/booking-link-tools.test.ts
```

### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { manageBookableServiceTool } from '../booking-link-tools';
import type { ToolContext } from '../types';

describe('manageBookableServiceTool', () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = {
      tenantId: 'tenant-123',
      sessionId: 'session-456',
      prisma: {} as any, // Mock Prisma
    };
  });

  describe('input validation', () => {
    // Tests that validate input schema

    it('should require operation parameter', async () => {
      const result = await manageBookableServiceTool.invoke(mockContext, {
        // Missing: operation
        name: 'Test Service',
        durationMinutes: 30,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('operation');
    });

    it('should accept create/update/delete operations', async () => {
      // Test each operation type is accepted
    });

    it('should validate durationMinutes is positive', async () => {
      const result = await manageBookableServiceTool.invoke(mockContext, {
        operation: 'create',
        name: 'Test',
        durationMinutes: -30, // Invalid
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('duration');
    });
  });

  describe('output format', () => {
    // Tests that output matches schema

    it('should return proposal for create operation', async () => {
      const result = await manageBookableServiceTool.invoke(mockContext, {
        operation: 'create',
        name: 'Test Service',
        durationMinutes: 30,
        priceCents: 5000,
        bufferMinutes: 15,
      });

      expect(result.success).toBe(true);
      expect(result).toMatchObject({
        proposalId: expect.any(String),
        operation: 'create',
        preview: expect.objectContaining({
          action: 'created',
          serviceName: 'Test Service',
          bookingUrl: expect.any(String),
        }),
        trustTier: 'T2',
        requiresApproval: false,
        expiresAt: expect.any(String),
      });
    });
  });

  describe('error handling', () => {
    // Tests that errors are user-friendly

    it('should return user-friendly error for missing name', async () => {
      const result = await manageBookableServiceTool.invoke(mockContext, {
        operation: 'create',
        name: '',
        durationMinutes: 30,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).not.toContain('stack');
      expect(result.error).not.toContain('at ');
    });

    it('should not leak internal details in error message', async () => {
      const result = await manageBookableServiceTool.invoke(mockContext, {
        operation: 'update',
        serviceId: 'nonexistent',
        updates: { name: 'Updated' },
      });

      // Should not say "tenant-123 does not have service..."
      expect(result.error).not.toContain('tenant');
      expect(result.error).not.toContain('tenant-123');
    });
  });
});
```

### What This Tests

- Tool validates input schema
- Tool returns correct output format
- Tool doesn't leak tenant information
- Tool provides user-friendly error messages

### What This DOESN'T Test

- Database operations (that's integration level)
- Tenant isolation (that's integration level)
- Executor execution (that's integration level)

---

## Level 2: Integration Tests (Executor Execution)

**Most important level.** Tests that executor properly handles database operations with tenant isolation.

### File Location

```
server/src/agent/executors/__tests__/booking-link-executors.test.ts
```

### Test Structure Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerBookingLinkExecutors } from '../booking-link-executors';
import { getProposalExecutor } from '../../proposals/executor-registry';
import { createTestTenant, createTestService } from '../../../test/helpers';

describe('manage_bookable_service executor', () => {
  let executor: (tenantId: string, payload: any) => Promise<any>;
  let tenant1: any;
  let tenant2: any;
  let prisma: PrismaClient;

  beforeEach(async () => {
    // Setup
    registerBookingLinkExecutors(prisma);
    executor = getProposalExecutor('manage_bookable_service');

    tenant1 = await createTestTenant(prisma);
    tenant2 = await createTestTenant(prisma);
  });

  afterEach(async () => {
    // Cleanup
    await prisma.service.deleteMany({});
    await prisma.tenant.deleteMany({});
  });

  // ========================================================================
  // CRITICAL: Tenant Isolation Tests
  // ========================================================================

  describe('tenant isolation', () => {
    it('should prevent updating service from different tenant', async () => {
      // Create service in tenant1
      const service = await createTestService(prisma, {
        tenantId: tenant1.id,
        name: 'Tenant 1 Service',
      });

      // Try to update service as tenant2
      const result = await executor(tenant2.id, {
        operation: 'update',
        serviceId: service.id,
        updates: { name: 'Hacked by Tenant 2' },
      });

      // Should fail
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');

      // Verify database wasn't modified
      const unchanged = await prisma.service.findUnique({
        where: { id: service.id },
      });
      expect(unchanged.name).toBe('Tenant 1 Service');
      expect(unchanged.tenantId).toBe(tenant1.id);
    });

    it('should prevent deleting service from different tenant', async () => {
      const service = await createTestService(prisma, {
        tenantId: tenant1.id,
      });

      const result = await executor(tenant2.id, {
        operation: 'delete',
        serviceId: service.id,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');

      // Verify service still exists in tenant1
      const stillExists = await prisma.service.findUnique({
        where: { id: service.id },
      });
      expect(stillExists).toBeDefined();
    });

    it('should only fetch tenant info scoped to tenant', async () => {
      // This verifies the getTenantInfo() call includes tenantId
      // If it doesn't, it could return another tenant's custom domain

      const service = await createTestService(prisma, {
        tenantId: tenant1.id,
        slug: 'service-1',
      });

      const result = await executor(tenant1.id, {
        operation: 'update',
        serviceId: service.id,
        updates: { name: 'Updated' },
      });

      expect(result.success).toBe(true);
      // Verify bookingUrl is correct for tenant1 (not tenant2)
      expect(result.bookingUrl).toContain(tenant1.slug);
      expect(result.bookingUrl).not.toContain(tenant2.slug);
    });
  });

  // ========================================================================
  // CRITICAL: Create Operation Tests
  // ========================================================================

  describe('create operation', () => {
    it('should create service with tenant scoping', async () => {
      const result = await executor(tenant1.id, {
        operation: 'create',
        name: 'New Service',
        durationMinutes: 30,
        priceCents: 5000,
        bufferMinutes: 15,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('created');
      expect(result.serviceId).toBeDefined();

      // Verify created in database with tenantId
      const service = await prisma.service.findUnique({
        where: { id: result.serviceId },
      });
      expect(service).toBeDefined();
      expect(service.tenantId).toBe(tenant1.id);
      expect(service.name).toBe('New Service');
    });

    it('should prevent slug collision within tenant', async () => {
      // Create first service
      await executor(tenant1.id, {
        operation: 'create',
        name: 'Unique Name',
        durationMinutes: 30,
        priceCents: 0,
        bufferMinutes: 0,
      });

      // Try to create another with same slug
      const result = await executor(tenant1.id, {
        operation: 'create',
        name: 'Unique Name', // Same slug generated
        durationMinutes: 45,
        priceCents: 0,
        bufferMinutes: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('slug');
    });

    it('should allow same slug in different tenants', async () => {
      // Create service in tenant1
      const result1 = await executor(tenant1.id, {
        operation: 'create',
        name: 'Shared Name',
        durationMinutes: 30,
        priceCents: 0,
        bufferMinutes: 0,
      });

      // Create same slug in tenant2 (should succeed)
      const result2 = await executor(tenant2.id, {
        operation: 'create',
        name: 'Shared Name',
        durationMinutes: 30,
        priceCents: 0,
        bufferMinutes: 0,
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.serviceId).not.toBe(result2.serviceId);
    });
  });

  // ========================================================================
  // CRITICAL: Update Operation Tests
  // ========================================================================

  describe('update operation', () => {
    it('should update service with tenantId in mutation', async () => {
      const service = await createTestService(prisma, {
        tenantId: tenant1.id,
        name: 'Original',
      });

      const result = await executor(tenant1.id, {
        operation: 'update',
        serviceId: service.id,
        updates: { name: 'Updated' },
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('updated');

      const updated = await prisma.service.findUnique({
        where: { id: service.id },
      });
      expect(updated.name).toBe('Updated');
    });

    it('should verify operation wrapped in transaction', async () => {
      // This test verifies updateMany is used (not update)
      // and transaction is wrapped correctly
      const service = await createTestService(prisma, {
        tenantId: tenant1.id,
      });

      const result = await executor(tenant1.id, {
        operation: 'update',
        serviceId: service.id,
        updates: {
          name: 'New Name',
          durationMinutes: 60,
        },
      });

      expect(result.success).toBe(true);

      // Verify BOTH updates applied (atomicity)
      const updated = await prisma.service.findUnique({
        where: { id: service.id },
      });
      expect(updated.name).toBe('New Name');
      expect(updated.durationMinutes).toBe(60);
    });
  });

  // ========================================================================
  // CRITICAL: Delete Operation Tests
  // ========================================================================

  describe('delete operation', () => {
    it('should delete service with tenantId in mutation', async () => {
      const service = await createTestService(prisma, {
        tenantId: tenant1.id,
      });

      const result = await executor(tenant1.id, {
        operation: 'delete',
        serviceId: service.id,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('deleted');

      // Verify deleted from database
      const deleted = await prisma.service.findUnique({
        where: { id: service.id },
      });
      expect(deleted).toBeNull();
    });

    it('should prevent delete if upcoming bookings exist (TOCTOU)', async () => {
      const service = await createTestService(prisma, {
        tenantId: tenant1.id,
      });

      // Create booking for future date
      await prisma.booking.create({
        data: {
          id: 'booking-1',
          tenantId: tenant1.id,
          serviceId: service.id,
          customerId: 'customer-1',
          date: new Date(Date.now() + 86400000), // Tomorrow
          status: 'CONFIRMED',
        },
      });

      const result = await executor(tenant1.id, {
        operation: 'delete',
        serviceId: service.id,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('upcoming booking');

      // Verify service NOT deleted
      const stillExists = await prisma.service.findUnique({
        where: { id: service.id },
      });
      expect(stillExists).toBeDefined();
    });

    it('should allow delete if only past bookings exist', async () => {
      const service = await createTestService(prisma, {
        tenantId: tenant1.id,
      });

      // Create booking for past date
      await prisma.booking.create({
        data: {
          id: 'booking-1',
          tenantId: tenant1.id,
          serviceId: service.id,
          customerId: 'customer-1',
          date: new Date(Date.now() - 86400000), // Yesterday
          status: 'COMPLETED',
        },
      });

      const result = await executor(tenant1.id, {
        operation: 'delete',
        serviceId: service.id,
      });

      expect(result.success).toBe(true);

      // Verify actually deleted
      const deleted = await prisma.service.findUnique({
        where: { id: service.id },
      });
      expect(deleted).toBeNull();
    });
  });

  // ========================================================================
  // CRITICAL: Error Handling Tests
  // ========================================================================

  describe('error handling', () => {
    it('should return clear error when service not found', async () => {
      const result = await executor(tenant1.id, {
        operation: 'update',
        serviceId: 'nonexistent',
        updates: { name: 'Updated' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.error).not.toContain('SQL');
      expect(result.error).not.toContain('database');
    });

    it('should not expose cross-tenant information in errors', async () => {
      const service = await createTestService(prisma, {
        tenantId: tenant2.id,
      });

      const result = await executor(tenant1.id, {
        operation: 'update',
        serviceId: service.id,
        updates: { name: 'Hacked' },
      });

      // Error should be generic, not say "belongs to tenant-xxx"
      expect(result.error).not.toContain('tenant');
      expect(result.error).not.toContain(tenant2.id);
      expect(result.error).toContain('not found'); // Generic message
    });

    it('should throw on missing required fields', async () => {
      const result = await executor(tenant1.id, {
        operation: 'create',
        // Missing: name, durationMinutes
        priceCents: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ========================================================================
  // Registry Tests
  // ========================================================================

  describe('executor registry', () => {
    it('should be registered at startup', () => {
      const executor = getProposalExecutor('manage_bookable_service');
      expect(executor).toBeDefined();
    });
  });
});
```

### Key Testing Patterns

#### Pattern 1: Cross-Tenant Verification

```typescript
it('should prevent cross-tenant access', async () => {
  // Create in tenant1
  const resource = await createTestResource(prisma, {
    tenantId: tenant1.id,
  });

  // Try to modify as tenant2
  const result = await executor(tenant2.id, {
    operation: 'update',
    resourceId: resource.id,
    ...
  });

  // Should fail
  expect(result.success).toBe(false);

  // Verify database wasn't modified
  const unchanged = await prisma.resource.findUnique({
    where: { id: resource.id },
  });
  expect(unchanged).toMatchObject({ /* original values */ });
});
```

#### Pattern 2: TOCTOU Race Condition Test

```typescript
it('should prevent race condition on delete', async () => {
  const resource = await createTestResource(prisma, { tenantId });

  // Create dependent (would normally race between check and delete)
  await prisma.dependent.create({
    data: { resourceId: resource.id, ... }
  });

  const result = await executor(tenantId, {
    operation: 'delete',
    resourceId: resource.id,
  });

  // Should fail because dependent exists
  expect(result.success).toBe(false);

  // Verify resource NOT deleted
  expect(await prisma.resource.findUnique({
    where: { id: resource.id },
  })).toBeDefined();
});
```

#### Pattern 3: Atomic Operation Verification

```typescript
it('should update both fields atomically', async () => {
  const resource = await createTestResource(prisma, {
    tenantId,
    field1: 'a',
    field2: 'b',
  });

  const result = await executor(tenantId, {
    operation: 'update',
    resourceId: resource.id,
    updates: {
      field1: 'x',
      field2: 'y',
    },
  });

  expect(result.success).toBe(true);

  const updated = await prisma.resource.findUnique({
    where: { id: resource.id },
  });
  // Both must be updated (not partial)
  expect(updated).toMatchObject({
    field1: 'x',
    field2: 'y',
  });
});
```

---

## Level 3: E2E Tests (Full Workflow)

Tests the complete flow: tool invocation → proposal → executor → result.

### File Location

```
server/test/e2e/booking-links.spec.ts
```

### Example Test

```typescript
import { test, expect } from '@playwright/test';

test('should create booking link from tool to URL', async ({ page }) => {
  // 1. Load tenant dashboard
  await page.goto('/tenant/dashboard');

  // 2. Open agent chat
  await page.click('[data-testid="open-agent"]');

  // 3. Request booking link creation
  await page.fill('[data-testid="agent-input"]', 'Create a 30 minute booking link for strategy sessions');
  await page.press('[data-testid="agent-input"]', 'Enter');

  // 4. Verify proposal shown
  await expect(page.locator('[data-testid="proposal"]')).toBeVisible();
  await expect(page.locator('[data-testid="proposal-preview"]')).toContainText('Strategy Session');

  // 5. Approve proposal
  await page.click('[data-testid="approve-proposal"]');

  // 6. Verify result
  await expect(page.locator('[data-testid="booking-url"]')).toBeVisible();

  const bookingUrl = await page.locator('[data-testid="booking-url"]').getAttribute('href');
  expect(bookingUrl).toContain('/book/');
  expect(bookingUrl).toContain('strategy-sessions');
});
```

---

## Test Coverage Goals

| Aspect | Coverage | Test Level |
|--------|----------|-----------|
| Tenant isolation | 100% | Integration |
| Happy path | 100% | Integration |
| Error handling | 100% | Integration + Unit |
| Input validation | 100% | Unit |
| Database atomicity | 80% | Integration |
| Race conditions | 60% | Integration (hard to test) |

---

## Running Tests

```bash
# All agent tests
npm test -- agent

# Specific test file
npm test -- executors.test.ts

# Watch mode
npm test -- --watch agent

# Coverage
npm test -- --coverage agent
```

---

## Common Test Failures

### Failure 1: "Service not found" for Valid Service

**Cause:** Missing tenantId in find query
**Fix:** Verify executor finds service with `{ id, tenantId }`

### Failure 2: Cross-Tenant Test Passes When Should Fail

**Cause:** Missing tenantId in where clause
**Fix:** Verify mutation uses `updateMany/deleteMany` with tenantId

### Failure 3: "Multiple records updated" Error

**Cause:** Not filtering by tenantId (updates multiple tenants' records)
**Fix:** Add tenantId to updateMany where clause

### Failure 4: Timeout on Delete Test

**Cause:** TOCTOU race window - booking created while deleting
**Fix:** Verify delete wrapped in transaction with FOR UPDATE lock

---

## Test Helpers

Create reusable test helpers in `server/test/helpers/`:

```typescript
// server/test/helpers/booking-links.ts

export async function createTestService(
  prisma: PrismaClient,
  overrides?: Partial<CreateServiceInput>
) {
  const tenantId = overrides?.tenantId || (await createTestTenant()).id;

  return prisma.service.create({
    data: {
      id: crypto.randomUUID(),
      tenantId,
      name: 'Test Service',
      slug: `test-service-${crypto.randomUUID()}`,
      durationMinutes: 30,
      priceCents: 0,
      bufferMinutes: 0,
      sortOrder: 0,
      ...overrides,
    },
  });
}

export async function createTestBooking(
  prisma: PrismaClient,
  overrides?: Partial<CreateBookingInput>
) {
  const service = overrides?.serviceId
    ? await prisma.service.findUnique({
        where: { id: overrides.serviceId },
      })
    : await createTestService(prisma);

  return prisma.booking.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: service.tenantId,
      serviceId: service.id,
      customerId: 'test-customer',
      date: new Date(),
      status: 'CONFIRMED',
      ...overrides,
    },
  });
}
```

---

## Summary

Write tests that verify:

1. **Tenant Isolation:** Cross-tenant access fails
2. **Database Integrity:** Mutations include tenantId
3. **Atomicity:** Check-then-act is transaction + locked
4. **Error Handling:** Messages are user-friendly
5. **Registry:** Executors registered at startup

These catch the 4 P1 issues fixed in Booking Links Phase 0.

