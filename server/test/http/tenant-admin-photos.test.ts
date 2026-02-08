/**
 * HTTP Integration Tests for Package Photo Upload/Delete Endpoints
 * Tests both upload and delete endpoints with security and business logic validation
 *
 * Endpoints tested:
 * - POST /v1/tenant-admin/packages/:id/photos
 * - DELETE /v1/tenant-admin/packages/:id/photos/:filename
 */

// Force local storage for tests (not Supabase) - must be before any imports
process.env.STORAGE_MODE = 'local';

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/lib/core/config';
import { buildContainer } from '../../src/di';
import fs from 'fs';
import path from 'path';
import { getTestPrisma } from '../helpers/global-prisma';

describe('Package Photo Upload/Delete Endpoints', () => {
  let app: Express;
  // Use singleton to prevent connection pool exhaustion
  const prisma = getTestPrisma();
  let testTenant1Id: string;
  let testTenant2Id: string;
  let testPackage1Id: string;
  let testPackage2Id: string;
  let testToken1: string;
  let testToken2: string;
  const uploadDir = path.join(process.cwd(), 'uploads', 'packages');
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

  // Helper function to create a test image buffer with valid JPEG magic bytes
  // This is required because the upload service now validates magic bytes for security
  const createTestImageBuffer = (sizeInBytes: number): Buffer => {
    // JPEG magic bytes: FF D8 FF E0 00 10 4A 46 49 46 00 01 01 00 00 01 00 01 00 00
    const jpegHeader = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00,
    ]);
    // Create buffer with JPEG header + padding to reach desired size
    const padding = Buffer.alloc(Math.max(0, sizeInBytes - jpegHeader.length), 0);
    return Buffer.concat([jpegHeader, padding]);
  };

  // Helper function to generate JWT token for testing
  const generateTestToken = (tenantId: string, slug: string, email: string): string => {
    return jwt.sign(
      {
        tenantId,
        slug,
        email,
        type: 'tenant',
      },
      JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '7d',
      }
    );
  };

  beforeAll(async () => {
    // Database singleton already initialized

    // Create test tenant 1
    const tenant1 = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-1' },
      update: {
        apiKeyPublic: 'pk_live_test1_0123456789abcdef',
        apiKeySecret: 'sk_live_test1_0123456789abcdef0123456789abcdef',
        email: 'admin1@test.com',
        isActive: true,
      },
      create: {
        id: 'tenant_test_1',
        slug: 'test-tenant-1',
        name: 'Test Tenant 1',
        email: 'admin1@test.com',
        apiKeyPublic: 'pk_live_test1_0123456789abcdef',
        apiKeySecret: 'sk_live_test1_0123456789abcdef0123456789abcdef',
        commissionPercent: 10.0,
        branding: {},
        isActive: true,
      },
    });
    testTenant1Id = tenant1.id;

    // Create test tenant 2
    const tenant2 = await prisma.tenant.upsert({
      where: { slug: 'test-tenant-2' },
      update: {
        apiKeyPublic: 'pk_live_test2_0123456789abcdef',
        apiKeySecret: 'sk_live_test2_0123456789abcdef0123456789abcdef',
        email: 'admin2@test.com',
        isActive: true,
      },
      create: {
        id: 'tenant_test_2',
        slug: 'test-tenant-2',
        name: 'Test Tenant 2',
        email: 'admin2@test.com',
        apiKeyPublic: 'pk_live_test2_0123456789abcdef',
        apiKeySecret: 'sk_live_test2_0123456789abcdef0123456789abcdef',
        commissionPercent: 10.0,
        branding: {},
        isActive: true,
      },
    });
    testTenant2Id = tenant2.id;

    // Create test package for tenant 1
    const package1 = await prisma.package.upsert({
      where: { id: 'pkg_test_1' },
      update: {
        tenantId: testTenant1Id,
        slug: 'test-package-1',
        name: 'Test Package 1',
        description: 'Test package for photo upload',
        basePrice: 10000,
        photos: [],
      },
      create: {
        id: 'pkg_test_1',
        tenantId: testTenant1Id,
        slug: 'test-package-1',
        name: 'Test Package 1',
        description: 'Test package for photo upload',
        basePrice: 10000,
        photos: [],
      },
    });
    testPackage1Id = package1.id;

    // Create test package for tenant 2
    const package2 = await prisma.package.upsert({
      where: { id: 'pkg_test_2' },
      update: {
        tenantId: testTenant2Id,
        slug: 'test-package-2',
        name: 'Test Package 2',
        description: 'Test package for authorization checks',
        basePrice: 10000,
        photos: [],
      },
      create: {
        id: 'pkg_test_2',
        tenantId: testTenant2Id,
        slug: 'test-package-2',
        name: 'Test Package 2',
        description: 'Test package for authorization checks',
        basePrice: 10000,
        photos: [],
      },
    });
    testPackage2Id = package2.id;

    // Generate JWT tokens
    testToken1 = generateTestToken(testTenant1Id, 'test-tenant-1', 'admin1@test.com');
    testToken2 = generateTestToken(testTenant2Id, 'test-tenant-2', 'admin2@test.com');

    // Initialize app
    const config = loadConfig();
    const startTime = Date.now();
    const container = buildContainer({ ...config, ADAPTERS_PRESET: 'real' });
    app = createApp(config, container, startTime);

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Reset package photos to empty array after each test
    await prisma.package.updateMany({
      where: { id: { in: [testPackage1Id, testPackage2Id] } },
      data: { photos: [] },
    });

    // Clean up uploaded files
    const files = fs.readdirSync(uploadDir);
    for (const file of files) {
      if (file.startsWith('package-')) {
        fs.unlinkSync(path.join(uploadDir, file));
      }
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testPackage1Id || testPackage2Id) {
      const packageIds = [testPackage1Id, testPackage2Id].filter(Boolean);
      if (packageIds.length > 0) {
        await prisma.package.deleteMany({
          where: { id: { in: packageIds } },
        });
      }
    }
    if (testTenant1Id || testTenant2Id) {
      const tenantIds = [testTenant1Id, testTenant2Id].filter(Boolean);
      if (tenantIds.length > 0) {
        await prisma.tenant.deleteMany({
          where: { id: { in: tenantIds } },
        });
      }
    }
    // No-op: singleton handles its own lifecycle
  });

  // ============================================================================
  // Upload Tests
  // ============================================================================

  describe('POST /v1/tenant-admin/packages/:id/photos', () => {
    it('should upload a valid photo to package', async () => {
      const imageBuffer = createTestImageBuffer(1024 * 500); // 500KB

      const res = await request(app)
        .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
        .set('Authorization', `Bearer ${testToken1}`)
        .attach('photo', imageBuffer, {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);

      expect(res.body).toHaveProperty('url');
      expect(res.body).toHaveProperty('filename');
      expect(res.body).toHaveProperty('size');
      expect(res.body).toHaveProperty('order');
      expect(res.body.order).toBe(0); // First photo
      expect(res.body.size).toBe(imageBuffer.length);

      // Verify file was saved
      const filePath = path.join(uploadDir, res.body.filename);
      expect(fs.existsSync(filePath)).toBe(true);

      // Verify database was updated
      const pkg = await prisma.package.findUnique({
        where: { id: testPackage1Id },
      });
      expect(pkg?.photos).toHaveLength(1);
      expect((pkg?.photos as any[])[0]).toMatchObject({
        url: res.body.url,
        filename: res.body.filename,
        size: res.body.size,
        order: 0,
      });
    });

    it('should set correct order for multiple photos', async () => {
      const imageBuffer = createTestImageBuffer(1024 * 500);

      // Upload first photo
      const res1 = await request(app)
        .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
        .set('Authorization', `Bearer ${testToken1}`)
        .attach('photo', imageBuffer, {
          filename: 'test-image-1.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);

      expect(res1.body.order).toBe(0);

      // Upload second photo
      const res2 = await request(app)
        .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
        .set('Authorization', `Bearer ${testToken1}`)
        .attach('photo', imageBuffer, {
          filename: 'test-image-2.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);

      expect(res2.body.order).toBe(1);

      // Verify database has both photos in correct order
      const pkg = await prisma.package.findUnique({
        where: { id: testPackage1Id },
      });
      expect(pkg?.photos).toHaveLength(2);
      expect((pkg?.photos as any[])[0].order).toBe(0);
      expect((pkg?.photos as any[])[1].order).toBe(1);
    });

    it('should reject file over 5MB limit', async () => {
      const largeBuffer = createTestImageBuffer(6 * 1024 * 1024); // 6MB

      const res = await request(app)
        .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
        .set('Authorization', `Bearer ${testToken1}`)
        .attach('photo', largeBuffer, {
          filename: 'large-image.jpg',
          contentType: 'image/jpeg',
        })
        .expect(413);

      expect(res.body.error).toContain('File too large');

      // Verify no file was saved
      const pkg = await prisma.package.findUnique({
        where: { id: testPackage1Id },
      });
      expect(pkg?.photos).toHaveLength(0);
    });

    it('should enforce 5-photo maximum per package', { timeout: 30000 }, async () => {
      const imageBuffer = createTestImageBuffer(1024 * 500);

      // Upload 5 photos successfully
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
          .set('Authorization', `Bearer ${testToken1}`)
          .attach('photo', imageBuffer, {
            filename: `test-image-${i}.jpg`,
            contentType: 'image/jpeg',
          })
          .expect(201);
      }

      // 6th photo should be rejected
      const res = await request(app)
        .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
        .set('Authorization', `Bearer ${testToken1}`)
        .attach('photo', imageBuffer, {
          filename: 'test-image-6.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);

      expect(res.body.error).toContain('Maximum 5 photos per package');

      // Verify database still has only 5 photos
      const pkg = await prisma.package.findUnique({
        where: { id: testPackage1Id },
      });
      expect(pkg?.photos).toHaveLength(5);
    });

    it('should return 404 for non-existent package', async () => {
      const imageBuffer = createTestImageBuffer(1024 * 500);

      const res = await request(app)
        .post('/v1/tenant-admin/packages/nonexistent-package-id/photos')
        .set('Authorization', `Bearer ${testToken1}`)
        .attach('photo', imageBuffer, {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg',
        })
        .expect(404);

      expect(res.body.error).toContain('Package not found');
    });

    it('should return 404 when package belongs to different tenant (tenant isolation)', async () => {
      const imageBuffer = createTestImageBuffer(1024 * 500);

      // Tenant 1 trying to upload to Tenant 2's package
      // Due to tenant-scoped lookup, this returns 404 (not 403)
      // This is correct - tenants should never know about other tenants' resources
      const res = await request(app)
        .post(`/v1/tenant-admin/packages/${testPackage2Id}/photos`)
        .set('Authorization', `Bearer ${testToken1}`)
        .attach('photo', imageBuffer, {
          filename: 'test-image.jpg',
          contentType: 'image/jpeg',
        })
        .expect(404);

      expect(res.body.error).toContain('Package not found');

      // Verify no file was saved
      const pkg = await prisma.package.findUnique({
        where: { id: testPackage2Id },
      });
      expect(pkg?.photos).toHaveLength(0);
    });

    it('should reject invalid file types', async () => {
      const textBuffer = Buffer.from('This is a text file, not an image');

      const res = await request(app)
        .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
        .set('Authorization', `Bearer ${testToken1}`)
        .attach('photo', textBuffer, {
          filename: 'test-file.txt',
          contentType: 'text/plain',
        })
        .expect(400);

      expect(res.body.message).toContain('Invalid file type');

      // Verify no file was saved
      const pkg = await prisma.package.findUnique({
        where: { id: testPackage1Id },
      });
      expect(pkg?.photos).toHaveLength(0);
    });

    it('should accept all valid image MIME types', async () => {
      // Each MIME type needs its own buffer with valid magic bytes
      const PNG_MAGIC = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x00,
        0x00,
        0x00,
        0x0d, // IHDR chunk length (13 bytes)
        0x49,
        0x48,
        0x44,
        0x52, // IHDR chunk type
        0x00,
        0x00,
        0x00,
        0x01, // width: 1
        0x00,
        0x00,
        0x00,
        0x01, // height: 1
        0x08,
        0x02, // bit depth: 8, color type: 2 (RGB)
        0x00,
        0x00,
        0x00, // compression, filter, interlace
        0x90,
        0x77,
        0x53,
        0xde, // CRC
      ]);
      const WEBP_MAGIC = Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x24,
        0x00,
        0x00,
        0x00, // file size (small)
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
        0x56,
        0x50,
        0x38,
        0x4c, // VP8L
        0x17,
        0x00,
        0x00,
        0x00, // chunk size
        0x2f,
        0x00,
        0x00,
        0x00, // signature
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
      ]);
      const SVG_CONTENT = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'
      );

      const validMimeTypes = [
        { ext: 'jpg', mime: 'image/jpeg', buffer: createTestImageBuffer(1024 * 500) },
        { ext: 'png', mime: 'image/png', buffer: PNG_MAGIC },
        { ext: 'webp', mime: 'image/webp', buffer: WEBP_MAGIC },
        { ext: 'svg', mime: 'image/svg+xml', buffer: SVG_CONTENT },
      ];

      for (const { ext, mime, buffer } of validMimeTypes) {
        // Reset photos before each upload
        await prisma.package.update({
          where: { id: testPackage1Id },
          data: { photos: [] },
        });

        const res = await request(app)
          .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
          .set('Authorization', `Bearer ${testToken1}`)
          .attach('photo', buffer, {
            filename: `test-image.${ext}`,
            contentType: mime,
          })
          .expect(201);

        expect(res.body.filename).toContain(ext);
      }
    });

    it('should return 400 when no file is uploaded', async () => {
      const res = await request(app)
        .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
        .set('Authorization', `Bearer ${testToken1}`)
        .expect(400);

      expect(res.body.error).toContain('No photo uploaded');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
        .field('test', 'value'); // Send form data without auth

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid JWT token', async () => {
      const res = await request(app)
        .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
        .set('Authorization', 'Bearer invalid-token-here')
        .field('test', 'value'); // Send form data with invalid auth

      expect(res.status).toBe(401);
    });
  });

  // ============================================================================
  // Delete Tests
  // ============================================================================

  describe('DELETE /v1/tenant-admin/packages/:id/photos/:filename', () => {
    let uploadedFilename: string;

    beforeAll(async () => {
      // Upload a test photo to use in delete tests
      const imageBuffer = createTestImageBuffer(1024 * 500);
      const uploadRes = await request(app)
        .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
        .set('Authorization', `Bearer ${testToken1}`)
        .attach('photo', imageBuffer, {
          filename: 'delete-test-image.jpg',
          contentType: 'image/jpeg',
        });

      uploadedFilename = uploadRes.body.filename;
    });

    it('should delete photo from package and filesystem', async () => {
      // Verify file exists before deletion
      const filePath = path.join(uploadDir, uploadedFilename);
      expect(fs.existsSync(filePath)).toBe(true);

      // Verify photo is in database
      let pkg = await prisma.package.findUnique({
        where: { id: testPackage1Id },
      });
      expect(pkg?.photos).toHaveLength(1);

      // Delete photo
      await request(app)
        .delete(`/v1/tenant-admin/packages/${testPackage1Id}/photos/${uploadedFilename}`)
        .set('Authorization', `Bearer ${testToken1}`)
        .expect(204);

      // Verify file was removed from filesystem
      expect(fs.existsSync(filePath)).toBe(false);

      // Verify photo was removed from database
      pkg = await prisma.package.findUnique({
        where: { id: testPackage1Id },
      });
      expect(pkg?.photos).toHaveLength(0);
    });

    it('should return 404 for non-existent package', async () => {
      const res = await request(app)
        .delete(`/v1/tenant-admin/packages/nonexistent-package-id/photos/${uploadedFilename}`)
        .set('Authorization', `Bearer ${testToken1}`)
        .expect(404);

      expect(res.body.error).toContain('Package not found');
    });

    it('should return 404 when package belongs to different tenant (tenant isolation)', async () => {
      // Tenant 1 trying to delete photo from Tenant 2's package
      // Due to tenant-scoped lookup, this returns 404 (not 403)
      // This is correct - tenants should never know about other tenants' resources
      const res = await request(app)
        .delete(`/v1/tenant-admin/packages/${testPackage2Id}/photos/some-filename.jpg`)
        .set('Authorization', `Bearer ${testToken1}`)
        .expect(404);

      expect(res.body.error).toContain('Package not found');
    });

    it('should return 404 when photo not in package photos array', async () => {
      const res = await request(app)
        .delete(`/v1/tenant-admin/packages/${testPackage1Id}/photos/nonexistent-photo.jpg`)
        .set('Authorization', `Bearer ${testToken1}`)
        .expect(404);

      expect(res.body.error).toContain('Photo not found in package');
    });

    it('should handle file not found gracefully', async () => {
      // Add photo to database but don't create file
      await prisma.package.update({
        where: { id: testPackage1Id },
        data: {
          photos: [
            {
              url: 'http://localhost:5000/uploads/packages/missing-file.jpg',
              filename: 'missing-file.jpg',
              size: 1024,
              order: 0,
            },
          ],
        },
      });

      // Delete should succeed even if file doesn't exist
      await request(app)
        .delete(`/v1/tenant-admin/packages/${testPackage1Id}/photos/missing-file.jpg`)
        .set('Authorization', `Bearer ${testToken1}`)
        .expect(204);

      // Verify photo was removed from database
      const pkg = await prisma.package.findUnique({
        where: { id: testPackage1Id },
      });
      expect(pkg?.photos).toHaveLength(0);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .delete(`/v1/tenant-admin/packages/${testPackage1Id}/photos/${uploadedFilename}`)
        .expect(401);
    });

    it('should return 401 with invalid JWT token', async () => {
      await request(app)
        .delete(`/v1/tenant-admin/packages/${testPackage1Id}/photos/${uploadedFilename}`)
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);
    });

    it('should update photos array atomically', async () => {
      // Upload 3 photos
      const imageBuffer = createTestImageBuffer(1024 * 500);
      const filenames: string[] = [];

      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post(`/v1/tenant-admin/packages/${testPackage1Id}/photos`)
          .set('Authorization', `Bearer ${testToken1}`)
          .attach('photo', imageBuffer, {
            filename: `multi-${i}.jpg`,
            contentType: 'image/jpeg',
          })
          .expect(201);

        filenames.push(res.body.filename);
      }

      // Verify 3 photos in database
      let pkg = await prisma.package.findUnique({
        where: { id: testPackage1Id },
      });
      expect(pkg?.photos).toHaveLength(3);

      // Delete middle photo
      await request(app)
        .delete(`/v1/tenant-admin/packages/${testPackage1Id}/photos/${filenames[1]}`)
        .set('Authorization', `Bearer ${testToken1}`)
        .expect(204);

      // Verify only 2 photos remain and correct ones
      pkg = await prisma.package.findUnique({
        where: { id: testPackage1Id },
      });
      expect(pkg?.photos).toHaveLength(2);
      const photoFilenames = (pkg?.photos as any[]).map((p) => p.filename);
      expect(photoFilenames).toContain(filenames[0]);
      expect(photoFilenames).toContain(filenames[2]);
      expect(photoFilenames).not.toContain(filenames[1]);
    });
  });
});
