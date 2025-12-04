/**
 * HTTP Contract Tests for /v1/[resource]
 *
 * TODO: Replace [resource] with your API resource (e.g., packages, bookings)
 * TODO: Update description to match your endpoint's purpose
 *
 * Note: These tests use Supertest to test HTTP endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/lib/core/config';
import { PrismaClient } from '../../src/generated/prisma';

/**
 * TODO: Update these imports:
 * - Import your service/repository if needed for test setup
 * - Import builder functions for creating test data
 */

describe('GET /v1/[resource]', () => {
  let app: Express;
  let testTenantApiKey: string;
  let prisma: PrismaClient;

  /**
   * Setup: Run once before all tests in this describe block
   *
   * Pattern: Set up test tenant and initialize app
   */
  beforeAll(async () => {
    // Initialize Prisma client
    prisma = new PrismaClient();

    // Upsert test tenant with known API key
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'test-tenant' },
      update: {
        apiKeyPublic: 'pk_test_123456789abcdef',
        apiKeySecret: 'sk_test_123456789abcdef0123456789abcdef',
        isActive: true,
      },
      create: {
        id: 'tenant_test_123',
        slug: 'test-tenant',
        name: 'Test Tenant',
        apiKeyPublic: 'pk_test_123456789abcdef',
        apiKeySecret: 'sk_test_123456789abcdef0123456789abcdef',
        commissionPercent: 10.0,
        branding: {},
        isActive: true,
      },
    });

    testTenantApiKey = tenant.apiKeyPublic;

    // TODO: Create test data if needed
    // await prisma.[resource].create({ ... });

    // Create app with mock adapters for testing
    const config = loadConfig();
    app = createApp({ ...config, ADAPTERS_PRESET: 'mock' });
  });

  /**
   * Cleanup: Run once after all tests in this describe block
   */
  afterAll(async () => {
    // TODO: Clean up test data if needed
    // await prisma.[resource].deleteMany({ where: { ... } });

    await prisma.$disconnect();
  });

  // ============================================================================
  // SUCCESSFUL REQUESTS
  // ============================================================================

  /**
   * Happy path: Get all resources
   *
   * Pattern: Test successful response with valid authentication
   */
  it('returns list of resources with correct shape', async () => {
    // Act
    const res = await request(app)
      .get('/v1/[resource]')
      .set('X-Tenant-Key', testTenantApiKey)
      .expect('Content-Type', /json/)
      .expect(200);

    // Assert: Response structure
    expect(Array.isArray(res.body)).toBe(true);

    // Assert: Item shape (if array is not empty)
    if (res.body.length > 0) {
      const item = res.body[0];
      expect(item).toHaveProperty('id');
      expect(typeof item.id).toBe('string');
      // TODO: Add assertions for your resource's specific fields
      expect(item).toHaveProperty('field1');
      expect(item).toHaveProperty('field2');
    }
  });

  /**
   * Pattern: Test filtering/query parameters
   */
  it('filters results by query parameters', async () => {
    // Act
    const res = await request(app)
      .get('/v1/[resource]?status=active')
      .set('X-Tenant-Key', testTenantApiKey)
      .expect(200);

    // Assert: All items match filter
    res.body.forEach((item: any) => {
      expect(item.status).toBe('active');
    });
  });

  /**
   * Pattern: Test pagination
   */
  it('supports pagination parameters', async () => {
    // Act
    const res = await request(app)
      .get('/v1/[resource]?limit=10&offset=0')
      .set('X-Tenant-Key', testTenantApiKey)
      .expect(200);

    // Assert: Respects limit
    expect(res.body.length).toBeLessThanOrEqual(10);
  });

  // ============================================================================
  // GET BY ID
  // ============================================================================

  describe('GET /v1/[resource]/:id', () => {
    it('returns single resource by id', async () => {
      // TODO: Create or ensure test resource exists
      const testResourceId = 'resource_123';

      // Act
      const res = await request(app)
        .get(`/v1/[resource]/${testResourceId}`)
        .set('X-Tenant-Key', testTenantApiKey)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert: Response structure
      expect(res.body).toHaveProperty('id');
      expect(res.body.id).toBe(testResourceId);
      // TODO: Add assertions for specific fields
    });

    /**
     * Error case: Resource not found
     */
    it('returns 404 for non-existent resource', async () => {
      // Act & Assert
      await request(app)
        .get('/v1/[resource]/nonexistent-id')
        .set('X-Tenant-Key', testTenantApiKey)
        .expect(404);
    });

    /**
     * Error case: Invalid ID format
     */
    it('returns 400 for invalid id format', async () => {
      // Act & Assert
      await request(app)
        .get('/v1/[resource]/invalid-format!')
        .set('X-Tenant-Key', testTenantApiKey)
        .expect(400);
    });
  });

  // ============================================================================
  // POST - CREATE RESOURCE
  // ============================================================================

  describe('POST /v1/[resource]', () => {
    /**
     * Happy path: Create new resource
     */
    it('creates a new resource successfully', async () => {
      // Arrange: Prepare request body
      const newResource = {
        // TODO: Add required fields for resource creation
        field1: 'value1',
        field2: 'value2',
        priceCents: 10000,
      };

      // Act
      const res = await request(app)
        .post('/v1/[resource]')
        .set('X-Tenant-Key', testTenantApiKey)
        .send(newResource)
        .expect('Content-Type', /json/)
        .expect(201);

      // Assert: Response contains created resource
      expect(res.body).toHaveProperty('id');
      expect(res.body.field1).toBe('value1');
      expect(res.body.field2).toBe('value2');
      expect(res.body.priceCents).toBe(10000);
    });

    /**
     * Validation: Missing required fields
     */
    it('returns 400 when required field is missing', async () => {
      // Arrange: Incomplete data
      const incompleteResource = {
        field1: 'value1',
        // Missing field2
      };

      // Act
      const res = await request(app)
        .post('/v1/[resource]')
        .set('X-Tenant-Key', testTenantApiKey)
        .send(incompleteResource)
        .expect(400);

      // Assert: Error message is descriptive
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('required');
    });

    /**
     * Validation: Invalid field values
     */
    it('returns 400 for invalid field values', async () => {
      // Arrange: Invalid data
      const invalidResource = {
        field1: 'value1',
        field2: 'value2',
        priceCents: -100, // Invalid: negative price
      };

      // Act
      const res = await request(app)
        .post('/v1/[resource]')
        .set('X-Tenant-Key', testTenantApiKey)
        .send(invalidResource)
        .expect(400);

      // Assert
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('negative');
    });

    /**
     * Constraint: Duplicate prevention
     */
    it('returns 409 for duplicate resource', async () => {
      // Arrange: Create first resource
      const resource = {
        uniqueField: 'unique-value',
        field1: 'value1',
      };

      await request(app)
        .post('/v1/[resource]')
        .set('X-Tenant-Key', testTenantApiKey)
        .send(resource)
        .expect(201);

      // Act: Try to create duplicate
      const res = await request(app)
        .post('/v1/[resource]')
        .set('X-Tenant-Key', testTenantApiKey)
        .send(resource)
        .expect(409);

      // Assert: Error indicates conflict
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('already exists');
    });
  });

  // ============================================================================
  // PATCH/PUT - UPDATE RESOURCE
  // ============================================================================

  describe('PATCH /v1/[resource]/:id', () => {
    /**
     * Happy path: Update existing resource
     */
    it('updates resource successfully', async () => {
      // TODO: Create test resource first
      const testResourceId = 'resource_to_update';

      // Arrange: Update data
      const updates = {
        field1: 'updated-value',
      };

      // Act
      const res = await request(app)
        .patch(`/v1/[resource]/${testResourceId}`)
        .set('X-Tenant-Key', testTenantApiKey)
        .send(updates)
        .expect('Content-Type', /json/)
        .expect(200);

      // Assert: Updates applied
      expect(res.body.id).toBe(testResourceId);
      expect(res.body.field1).toBe('updated-value');
    });

    /**
     * Partial update: Only update provided fields
     */
    it('performs partial update correctly', async () => {
      // TODO: Create test resource
      const testResourceId = 'resource_partial_update';

      // Act: Update only one field
      const res = await request(app)
        .patch(`/v1/[resource]/${testResourceId}`)
        .set('X-Tenant-Key', testTenantApiKey)
        .send({ field1: 'new-value' })
        .expect(200);

      // Assert: Other fields unchanged
      expect(res.body.field1).toBe('new-value');
      // TODO: Verify other fields are unchanged
    });

    /**
     * Error case: Update non-existent resource
     */
    it('returns 404 when updating non-existent resource', async () => {
      // Act & Assert
      await request(app)
        .patch('/v1/[resource]/nonexistent-id')
        .set('X-Tenant-Key', testTenantApiKey)
        .send({ field1: 'value' })
        .expect(404);
    });

    /**
     * Validation: Invalid update values
     */
    it('returns 400 for invalid update values', async () => {
      // TODO: Create test resource
      const testResourceId = 'resource_invalid_update';

      // Act
      const res = await request(app)
        .patch(`/v1/[resource]/${testResourceId}`)
        .set('X-Tenant-Key', testTenantApiKey)
        .send({ priceCents: -100 })
        .expect(400);

      // Assert
      expect(res.body).toHaveProperty('error');
    });
  });

  // ============================================================================
  // DELETE RESOURCE
  // ============================================================================

  describe('DELETE /v1/[resource]/:id', () => {
    /**
     * Happy path: Delete existing resource
     */
    it('deletes resource successfully', async () => {
      // TODO: Create test resource to delete
      const testResourceId = 'resource_to_delete';

      // Act
      await request(app)
        .delete(`/v1/[resource]/${testResourceId}`)
        .set('X-Tenant-Key', testTenantApiKey)
        .expect(204);

      // Assert: Resource is deleted
      await request(app)
        .get(`/v1/[resource]/${testResourceId}`)
        .set('X-Tenant-Key', testTenantApiKey)
        .expect(404);
    });

    /**
     * Error case: Delete non-existent resource
     */
    it('returns 404 when deleting non-existent resource', async () => {
      // Act & Assert
      await request(app)
        .delete('/v1/[resource]/nonexistent-id')
        .set('X-Tenant-Key', testTenantApiKey)
        .expect(404);
    });

    /**
     * Idempotency: Second delete returns 404
     */
    it('returns 404 on second delete attempt', async () => {
      // TODO: Create and delete resource
      const testResourceId = 'resource_double_delete';

      // First delete
      await request(app)
        .delete(`/v1/[resource]/${testResourceId}`)
        .set('X-Tenant-Key', testTenantApiKey)
        .expect(204);

      // Second delete
      await request(app)
        .delete(`/v1/[resource]/${testResourceId}`)
        .set('X-Tenant-Key', testTenantApiKey)
        .expect(404);
    });
  });

  // ============================================================================
  // AUTHENTICATION & AUTHORIZATION
  // ============================================================================

  describe('authentication', () => {
    /**
     * Auth: Missing API key
     */
    it('returns 401 when API key is missing', async () => {
      // Act & Assert
      const res = await request(app).get('/v1/[resource]').expect(401);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('authentication');
    });

    /**
     * Auth: Invalid API key
     */
    it('returns 401 for invalid API key', async () => {
      // Act & Assert
      const res = await request(app)
        .get('/v1/[resource]')
        .set('X-Tenant-Key', 'invalid_key_123')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    /**
     * Auth: Inactive tenant
     */
    it('returns 403 for inactive tenant', async () => {
      // TODO: Create inactive tenant for testing
      const inactiveTenantKey = 'pk_test_inactive';

      // Act & Assert
      await request(app).get('/v1/[resource]').set('X-Tenant-Key', inactiveTenantKey).expect(403);
    });
  });

  // ============================================================================
  // TENANT ISOLATION
  // ============================================================================

  describe('tenant isolation', () => {
    /**
     * Multi-tenancy: Each tenant sees only their data
     */
    it('returns only resources belonging to authenticated tenant', async () => {
      // TODO: Create resources for different tenants
      // TODO: Verify each tenant sees only their data

      // Act
      const res = await request(app)
        .get('/v1/[resource]')
        .set('X-Tenant-Key', testTenantApiKey)
        .expect(200);

      // Assert: All items belong to test tenant
      res.body.forEach((item: any) => {
        expect(item.tenantId).toBe('tenant_test_123');
      });
    });

    /**
     * Multi-tenancy: Cannot access other tenant's resources
     */
    it("returns 404 when accessing another tenant's resource", async () => {
      // TODO: Create resource for different tenant
      const otherTenantResourceId = 'resource_other_tenant';

      // Act & Assert
      await request(app)
        .get(`/v1/[resource]/${otherTenantResourceId}`)
        .set('X-Tenant-Key', testTenantApiKey)
        .expect(404);
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe('error handling', () => {
    /**
     * Error: Invalid route
     */
    it('returns 404 for invalid routes', async () => {
      // Act & Assert
      await request(app)
        .get('/v1/nonexistent-endpoint')
        .set('X-Tenant-Key', testTenantApiKey)
        .expect(404);
    });

    /**
     * Error: Invalid HTTP method
     */
    it('returns 405 for unsupported HTTP method', async () => {
      // Act & Assert: Try to PATCH list endpoint (if not supported)
      await request(app).patch('/v1/[resource]').set('X-Tenant-Key', testTenantApiKey).expect(405);
    });

    /**
     * Error: Malformed JSON
     */
    it('returns 400 for malformed JSON in request body', async () => {
      // Act & Assert
      const res = await request(app)
        .post('/v1/[resource]')
        .set('X-Tenant-Key', testTenantApiKey)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    /**
     * Error: Request size limits
     */
    it('returns 413 for request body too large', async () => {
      // Arrange: Create very large payload
      const largePayload = {
        field1: 'x'.repeat(10 * 1024 * 1024), // 10MB string
      };

      // Act & Assert
      await request(app)
        .post('/v1/[resource]')
        .set('X-Tenant-Key', testTenantApiKey)
        .send(largePayload)
        .expect(413);
    });
  });

  // ============================================================================
  // CONTENT NEGOTIATION
  // ============================================================================

  describe('content negotiation', () => {
    /**
     * Content-Type: JSON responses
     */
    it('returns JSON content type', async () => {
      // Act & Assert
      await request(app)
        .get('/v1/[resource]')
        .set('X-Tenant-Key', testTenantApiKey)
        .expect('Content-Type', /json/);
    });

    /**
     * Content-Type: Rejects unsupported content types
     */
    it('returns 415 for unsupported content type', async () => {
      // Act & Assert
      await request(app)
        .post('/v1/[resource]')
        .set('X-Tenant-Key', testTenantApiKey)
        .set('Content-Type', 'text/xml')
        .send('<xml>data</xml>')
        .expect(415);
    });
  });

  // ============================================================================
  // CORS & HEADERS
  // ============================================================================

  describe('CORS and headers', () => {
    /**
     * CORS: OPTIONS preflight
     */
    it('handles CORS preflight requests', async () => {
      // Act
      const res = await request(app)
        .options('/v1/[resource]')
        .set('Origin', 'https://example.com')
        .expect(204);

      // Assert: CORS headers present
      expect(res.headers['access-control-allow-origin']).toBeDefined();
      expect(res.headers['access-control-allow-methods']).toBeDefined();
    });

    /**
     * Security: Headers present
     */
    it('includes security headers in responses', async () => {
      // Act
      const res = await request(app)
        .get('/v1/[resource]')
        .set('X-Tenant-Key', testTenantApiKey)
        .expect(200);

      // Assert: Security headers
      // TODO: Adjust based on your security header configuration
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});

/**
 * ==============================================================================
 * TESTING PATTERNS REFERENCE
 * ==============================================================================
 *
 * 1. HTTP Testing with Supertest:
 *    - Use request(app) to make HTTP calls
 *    - Chain .set() for headers, .send() for body
 *    - Use .expect() for assertions
 *    - Test both success and error responses
 *
 * 2. Authentication Testing:
 *    - Test missing credentials
 *    - Test invalid credentials
 *    - Test expired/revoked credentials
 *    - Test tenant activation status
 *
 * 3. Multi-Tenancy Testing:
 *    - Verify tenant isolation
 *    - Test cross-tenant access prevention
 *    - Verify tenant-scoped operations
 *
 * 4. HTTP Status Codes:
 *    - 200: Success (GET, PATCH)
 *    - 201: Created (POST)
 *    - 204: No Content (DELETE)
 *    - 400: Bad Request (validation errors)
 *    - 401: Unauthorized (auth errors)
 *    - 403: Forbidden (permission errors)
 *    - 404: Not Found
 *    - 409: Conflict (duplicates)
 *    - 413: Payload Too Large
 *    - 415: Unsupported Media Type
 *
 * 5. Request/Response Testing:
 *    - Test request validation
 *    - Test response shape/structure
 *    - Test content types
 *    - Test headers
 *    - Test CORS
 *
 * 6. Error Testing:
 *    - Test validation errors
 *    - Test not found errors
 *    - Test constraint violations
 *    - Test malformed requests
 *    - Test server errors
 *
 * ==============================================================================
 * CUSTOMIZATION CHECKLIST
 * ==============================================================================
 *
 * [ ] Replace all [resource] placeholders
 * [ ] Update tenant setup in beforeAll
 * [ ] Create test data as needed
 * [ ] Update field names to match your resource
 * [ ] Add resource-specific validation tests
 * [ ] Add query parameter tests if applicable
 * [ ] Add pagination tests if applicable
 * [ ] Test custom endpoints
 * [ ] Verify all tests pass
 * [ ] Remove this checklist section
 *
 * ==============================================================================
 */
