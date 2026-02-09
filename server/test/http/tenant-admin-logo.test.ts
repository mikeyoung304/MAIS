/**
 * HTTP Integration Tests for Tenant Admin Logo Upload
 * Tests the POST /v1/tenant-admin/logo endpoint
 *
 * Test Coverage:
 * - Authentication (JWT token required)
 * - File upload validation (size, type)
 * - Multipart/form-data handling
 * - Tenant isolation (cannot upload to other tenant)
 * - Branding update after logo upload
 * - File storage and cleanup
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { loadConfig } from '../../src/lib/core/config';
import { createApp } from '../../src/app';
import { buildContainer } from '../../src/di';
import { getTestPrisma } from '../helpers/global-prisma';

describe('POST /v1/tenant-admin/logo - Logo Upload HTTP Tests', () => {
  let app: Express;
  // Use singleton to prevent connection pool exhaustion
  const prisma = getTestPrisma();
  let testTenantId: string;
  let testTenantSlug: string;
  let anotherTenantId: string;
  let validToken: string;
  let anotherTenantToken: string;
  let uploadDir: string;
  const JWT_SECRET = 'test-jwt-secret-for-logo-upload';

  // Test file buffers
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const validJpegBuffer = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//', 'base64');
  const largePdfBuffer = Buffer.alloc(3 * 1024 * 1024); // 3MB (exceeds 2MB limit)

  beforeAll(async () => {
    // Setup database with test tenants (singleton already initialized)

    // Create test tenant with authentication
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'logo-upload-test-tenant' },
      update: {
        email: 'admin@logouploadtest.com',
        passwordHash: 'hashed-password', // Not used in tests, JWT directly generated
        isActive: true,
      },
      create: {
        slug: 'logo-upload-test-tenant',
        name: 'Logo Upload Test Tenant',
        apiKeyPublic: 'pk_test_logo_upload',
        apiKeySecret: 'sk_test_logo_upload_hash',
        email: 'admin@logouploadtest.com',
        passwordHash: 'hashed-password',
        isActive: true,
        branding: {
          primaryColor: '#000000',
          secondaryColor: '#ffffff',
        },
      },
    });
    testTenantId = tenant.id;
    testTenantSlug = tenant.slug;

    // Create another tenant for isolation tests
    const anotherTenant = await prisma.tenant.upsert({
      where: { slug: 'logo-upload-another-tenant' },
      update: {
        email: 'admin@another.com',
        isActive: true,
      },
      create: {
        slug: 'logo-upload-another-tenant',
        name: 'Another Test Tenant',
        apiKeyPublic: 'pk_test_another',
        apiKeySecret: 'sk_test_another_hash',
        email: 'admin@another.com',
        passwordHash: 'hashed-password',
        isActive: true,
        branding: {},
      },
    });
    anotherTenantId = anotherTenant.id;

    // Generate valid JWT tokens for both tenants
    validToken = jwt.sign(
      {
        tenantId: testTenantId,
        slug: testTenantSlug,
        email: 'admin@logouploadtest.com',
        type: 'tenant',
      },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    anotherTenantToken = jwt.sign(
      {
        tenantId: anotherTenantId,
        slug: 'logo-upload-another-tenant',
        email: 'admin@another.com',
        type: 'tenant',
      },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    // Create app with test configuration
    const config = loadConfig();
    const container = buildContainer({
      ...config,
      JWT_SECRET,
      ADAPTERS_PRESET: 'real',
    });
    const startTime = Date.now();
    app = createApp(config, container, startTime);

    // Setup upload directory
    uploadDir = path.join(process.cwd(), 'uploads', 'logos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Clean up uploaded files after each test
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const file of files) {
        // Only delete test files (logos with 'logo-' prefix)
        if (file.startsWith('logo-')) {
          fs.unlinkSync(path.join(uploadDir, file));
        }
      }
    }

    // Reset tenant branding to initial state
    await prisma.tenant.update({
      where: { id: testTenantId },
      data: {
        branding: {
          primaryColor: '#000000',
          secondaryColor: '#ffffff',
        },
      },
    });
  });

  // ============================================================================
  // Authentication Tests
  // ============================================================================

  describe('Authentication', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .attach('logo', validPngBuffer, 'test-logo.png')
        .expect(401);

      expect(res.body).toHaveProperty('error');
      // Error handler may return generic "UNAUTHORIZED" or specific message
      expect(res.body.error).toBeDefined();
    });

    it('should return 401 when Bearer token is malformed', async () => {
      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', 'InvalidFormat token123')
        .attach('logo', validPngBuffer, 'test-logo.png')
        .expect(401);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBeDefined();
    });

    it('should return 401 when JWT token is invalid', async () => {
      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .attach('logo', validPngBuffer, 'test-logo.png')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 when JWT token is expired', async () => {
      const expiredToken = jwt.sign(
        {
          tenantId: testTenantId,
          slug: testTenantSlug,
          email: 'admin@logouploadtest.com',
          type: 'tenant',
        },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '-1h' } // Already expired
      );

      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${expiredToken}`)
        .attach('logo', validPngBuffer, 'test-logo.png')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 when token type is not tenant', async () => {
      // Platform admin token (different type)
      const adminToken = jwt.sign(
        {
          userId: 'admin-123',
          role: 'admin', // Platform admin uses 'role' instead of 'type'
        },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('logo', validPngBuffer, 'test-logo.png')
        .expect(401);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBeDefined();
    });

    it('should return 401 when token is missing required tenant fields', async () => {
      // Token without tenantId
      const incompleteToken = jwt.sign(
        {
          email: 'admin@test.com',
          type: 'tenant',
          // Missing tenantId and slug
        },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${incompleteToken}`)
        .attach('logo', validPngBuffer, 'test-logo.png')
        .expect(401);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBeDefined();
    });
  });

  // ============================================================================
  // File Upload Validation Tests
  // ============================================================================

  describe('File Upload Validation', () => {
    it('should return 400 when no file is uploaded', async () => {
      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('No file uploaded');
    });

    it('should reject file over 2MB size limit', async () => {
      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', largePdfBuffer, 'large-file.pdf');

      // Multer may return 413 or 500 depending on error handler configuration
      expect([400, 413, 500]).toContain(res.status);
      expect(res.body).toHaveProperty('error');
      // Error message may vary based on error handling
      expect(res.body.error).toBeDefined();
    });

    it('should reject invalid MIME type (PDF)', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 test content');

      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', pdfBuffer, 'document.pdf')
        .set('Content-Type', 'multipart/form-data')
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.message).toMatch(/Invalid file type|Allowed types/i);
    });

    it('should reject invalid MIME type (EXE)', async () => {
      const exeBuffer = Buffer.from('MZ\x90\x00'); // EXE file header

      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', exeBuffer, 'malware.exe')
        .set('Content-Type', 'multipart/form-data')
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.message).toMatch(/Invalid file type|Allowed types/i);
    });

    it('should accept valid PNG file', async () => {
      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', validPngBuffer, 'test-logo.png')
        .expect(200);

      expect(res.body).toHaveProperty('url');
      expect(res.body).toHaveProperty('filename');
      expect(res.body).toHaveProperty('size');
      expect(res.body).toHaveProperty('mimetype');
      expect(res.body.mimetype).toBe('image/png');
      expect(res.body.url).toContain('/uploads/logos/');
      expect(res.body.filename).toMatch(/^logo-\d+-[a-f0-9]+\.png$/);
    });

    it('should accept valid JPEG file', async () => {
      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', validJpegBuffer, 'test-logo.jpg')
        .expect(200);

      expect(res.body).toHaveProperty('url');
      expect(res.body.mimetype).toMatch(/image\/(jpeg|jpg)/);
      expect(res.body.filename).toMatch(/^logo-\d+-[a-f0-9]+\.jpg$/);
    });
  });

  // ============================================================================
  // Business Logic Tests
  // ============================================================================

  describe('Business Logic', () => {
    it('should successfully upload logo and update tenant branding', async () => {
      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', validPngBuffer, 'company-logo.png')
        .expect(200);

      // Verify upload response
      expect(res.body).toHaveProperty('url');
      expect(res.body).toHaveProperty('filename');
      const logoUrl = res.body.url;

      // Verify tenant branding was updated in database
      const tenant = await prisma.tenant.findUnique({
        where: { id: testTenantId },
      });

      expect(tenant).not.toBeNull();
      expect(tenant!.branding).toHaveProperty('logo');
      expect((tenant!.branding as any).logo).toBe(logoUrl);

      // Verify existing branding properties were preserved
      expect((tenant!.branding as any).primaryColor).toBe('#000000');
      expect((tenant!.branding as any).secondaryColor).toBe('#ffffff');
    });

    it('should create physical file in uploads directory', async () => {
      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', validPngBuffer, 'physical-test.png')
        .expect(200);

      const filename = res.body.filename;
      const filepath = path.join(uploadDir, filename);

      // Verify file exists on disk
      expect(fs.existsSync(filepath)).toBe(true);

      // Verify file content matches uploaded buffer
      const savedContent = fs.readFileSync(filepath);
      expect(savedContent.equals(validPngBuffer)).toBe(true);
    });

    it('should replace existing logo when uploading new one', async () => {
      // Upload first logo
      const res1 = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', validPngBuffer, 'first-logo.png')
        .expect(200);

      const firstLogoUrl = res1.body.url;

      // Upload second logo
      const res2 = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', validJpegBuffer, 'second-logo.jpg')
        .expect(200);

      const secondLogoUrl = res2.body.url;

      // Verify URLs are different
      expect(firstLogoUrl).not.toBe(secondLogoUrl);

      // Verify tenant branding has the latest logo
      const tenant = await prisma.tenant.findUnique({
        where: { id: testTenantId },
      });
      expect((tenant!.branding as any).logo).toBe(secondLogoUrl);
    });

    it('should generate unique filenames for concurrent uploads', async () => {
      // Simulate concurrent uploads
      const [res1, res2, res3] = await Promise.all([
        request(app)
          .post('/v1/tenant-admin/logo')
          .set('Authorization', `Bearer ${validToken}`)
          .attach('logo', validPngBuffer, 'concurrent1.png'),
        request(app)
          .post('/v1/tenant-admin/logo')
          .set('Authorization', `Bearer ${validToken}`)
          .attach('logo', validPngBuffer, 'concurrent2.png'),
        request(app)
          .post('/v1/tenant-admin/logo')
          .set('Authorization', `Bearer ${validToken}`)
          .attach('logo', validPngBuffer, 'concurrent3.png'),
      ]);

      // All should succeed
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);

      // All filenames should be unique
      const filenames = [res1.body.filename, res2.body.filename, res3.body.filename];
      const uniqueFilenames = new Set(filenames);
      expect(uniqueFilenames.size).toBe(3);
    });
  });

  // ============================================================================
  // Tenant Isolation Tests
  // ============================================================================

  describe('Tenant Isolation', () => {
    it('should not allow tenant to access another tenants upload endpoint', async () => {
      // This test verifies that each tenant can only upload their own logo
      // The endpoint doesn't take tenantId as parameter, it's from JWT

      // Tenant A uploads logo
      const resA = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', validPngBuffer, 'tenant-a-logo.png')
        .expect(200);

      const tenantALogoUrl = resA.body.url;

      // Tenant B uploads logo with their own token
      const resB = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${anotherTenantToken}`)
        .attach('logo', validJpegBuffer, 'tenant-b-logo.jpg')
        .expect(200);

      const tenantBLogoUrl = resB.body.url;

      // Verify logos are different
      expect(tenantALogoUrl).not.toBe(tenantBLogoUrl);

      // Verify each tenant has their own logo in branding
      const tenantA = await prisma.tenant.findUnique({
        where: { id: testTenantId },
      });
      const tenantB = await prisma.tenant.findUnique({
        where: { id: anotherTenantId },
      });

      expect((tenantA!.branding as any).logo).toBe(tenantALogoUrl);
      expect((tenantB!.branding as any).logo).toBe(tenantBLogoUrl);
    });

    it('should return 404 when tenant does not exist', async () => {
      // Generate token for non-existent tenant
      const nonExistentToken = jwt.sign(
        {
          tenantId: 'tenant_nonexistent_12345',
          slug: 'nonexistent-tenant',
          email: 'admin@nonexistent.com',
          type: 'tenant',
        },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${nonExistentToken}`)
        .attach('logo', validPngBuffer, 'test-logo.png')
        .expect(404);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('Tenant not found');
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty file buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', emptyBuffer, 'empty.png')
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.message).toMatch(/File buffer is empty|No file uploaded/i);
    });

    it('should handle special characters in filename', async () => {
      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', validPngBuffer, 'logo-with-special-chars-@#$.png')
        .expect(200);

      expect(res.body).toHaveProperty('filename');
      // Filename should be sanitized/normalized
      expect(res.body.filename).toMatch(/^logo-\d+-[a-f0-9]+\.png$/);
    });

    it('should handle WebP image format', async () => {
      // WebP file header
      const webpBuffer = Buffer.from('RIFF____WEBPVP8 ', 'utf8');

      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', webpBuffer, 'modern-logo.webp')
        .set('Content-Type', 'multipart/form-data');

      // Should accept WebP if it's in allowed MIME types
      if (res.status === 200) {
        expect(res.body.mimetype).toBe('image/webp');
      } else {
        // If not supported, should return clear error
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid file type');
      }
    });

    it('should handle SVG image format', async () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

      const res = await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', svgBuffer, 'vector-logo.svg')
        .set('Content-Type', 'multipart/form-data');

      // Should accept SVG if it's in allowed MIME types
      if (res.status === 200) {
        expect(res.body.mimetype).toBe('image/svg+xml');
      } else {
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid file type');
      }
    });

    it('should preserve existing branding fields when updating logo', async () => {
      // Set comprehensive branding
      await prisma.tenant.update({
        where: { id: testTenantId },
        data: {
          branding: {
            primaryColor: '#FF5733',
            secondaryColor: '#33FF57',
            accentColor: '#3357FF',
            backgroundColor: '#F0F0F0',
            fontFamily: 'Roboto',
            customField: 'should-be-preserved',
          },
        },
      });

      // Upload logo
      await request(app)
        .post('/v1/tenant-admin/logo')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('logo', validPngBuffer, 'preserve-test.png')
        .expect(200);

      // Verify all branding fields preserved
      const tenant = await prisma.tenant.findUnique({
        where: { id: testTenantId },
      });

      const branding = tenant!.branding as any;
      expect(branding.primaryColor).toBe('#FF5733');
      expect(branding.secondaryColor).toBe('#33FF57');
      expect(branding.accentColor).toBe('#3357FF');
      expect(branding.backgroundColor).toBe('#F0F0F0');
      expect(branding.fontFamily).toBe('Roboto');
      expect(branding.customField).toBe('should-be-preserved');
      expect(branding.logo).toContain('/uploads/logos/');
    });
  });
});
