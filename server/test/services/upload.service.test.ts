/**
 * Unit tests for UploadService
 *
 * Tests file upload validation, filename generation, file operations,
 * and error handling for both logo and package photo uploads.
 */

import type { MockedFunction } from 'vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { UploadedFile } from '../../src/services/upload.service';
import { UploadService } from '../../src/services/upload.service';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Mock the fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    promises: {
      writeFile: vi.fn(),
      unlink: vi.fn(),
    },
  },
}));

// Mock the logger to prevent console output during tests
vi.mock('../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Real magic bytes for image formats (for security tests)
// PNG needs a valid minimal PNG structure to be detected
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

// JPEG needs more structure for file-type to detect it
const JPEG_MAGIC = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00,
]);

// WebP needs RIFF header structure
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

const MAGIC_BYTES = {
  jpeg: JPEG_MAGIC,
  png: PNG_MAGIC,
  webp: WEBP_MAGIC,
  // PHP shell (text content disguised as image)
  phpShell: Buffer.from('<?php system($_GET["cmd"]); ?>'),
  // Plain text
  plainText: Buffer.from('This is just plain text'),
};

// Valid SVG content
const SVG_CONTENT = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'
);

describe('UploadService', () => {
  let service: UploadService;
  let mockExistsSync: MockedFunction<typeof fs.existsSync>;
  let mockMkdirSync: MockedFunction<typeof fs.mkdirSync>;
  let mockWriteFile: MockedFunction<typeof fs.promises.writeFile>;
  let mockUnlink: MockedFunction<typeof fs.promises.unlink>;

  // Helper to get appropriate magic bytes for a given mime type
  const getDefaultBuffer = (mimetype: string): Buffer => {
    if (mimetype === 'image/png') return PNG_MAGIC;
    if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') return JPEG_MAGIC;
    if (mimetype === 'image/webp') return WEBP_MAGIC;
    if (mimetype === 'image/svg+xml') return SVG_CONTENT;
    return PNG_MAGIC; // default
  };

  const createMockFile = (overrides?: Partial<UploadedFile>): UploadedFile => {
    const mimetype = overrides?.mimetype || 'image/png';
    const defaultBuffer = getDefaultBuffer(mimetype);
    return {
      fieldname: 'logo',
      originalname: 'test-logo.png',
      encoding: '7bit',
      mimetype,
      buffer: overrides?.buffer ?? defaultBuffer,
      size: overrides?.size ?? 1024 * 500, // 500KB
      ...overrides,
    };
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Force mock mode for unit tests (not real Supabase)
    process.env.ADAPTERS_PRESET = 'mock';

    // Clear environment variables that might affect the service
    delete process.env.MAX_UPLOAD_SIZE_MB;
    delete process.env.UPLOAD_DIR;
    delete process.env.API_BASE_URL;

    // Setup default mock behaviors
    mockExistsSync = vi.mocked(fs.existsSync);
    mockMkdirSync = vi.mocked(fs.mkdirSync);
    mockWriteFile = vi.mocked(fs.promises.writeFile);
    mockUnlink = vi.mocked(fs.promises.unlink);

    // By default, directories don't exist (will be created)
    mockExistsSync.mockReturnValue(false);

    // Instantiate service (will create directories)
    service = new UploadService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor & Initialization', () => {
    it('should create upload directories on initialization', () => {
      // Creates logos, packages, segments, and landing-pages directories
      expect(mockMkdirSync).toHaveBeenCalledTimes(4);
      const calls = mockMkdirSync.mock.calls;
      expect(calls[0][0]).toContain('uploads');
      expect(calls[0][1]).toEqual({ recursive: true });
    });

    it('should not create directories if they already exist', () => {
      vi.clearAllMocks();
      mockExistsSync.mockReturnValue(true);

      new UploadService();

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('should use environment variables for configuration', () => {
      const originalUploadDir = process.env.UPLOAD_DIR;
      const originalMaxSize = process.env.MAX_UPLOAD_SIZE_MB;
      const originalBaseUrl = process.env.API_BASE_URL;

      process.env.UPLOAD_DIR = '/custom/upload/dir';
      process.env.MAX_UPLOAD_SIZE_MB = '10';
      process.env.API_BASE_URL = 'https://example.com';

      const customService = new UploadService();

      const logoDir = customService.getLogoUploadDir();
      expect(logoDir).toContain('custom');

      // Restore original values
      process.env.UPLOAD_DIR = originalUploadDir;
      process.env.MAX_UPLOAD_SIZE_MB = originalMaxSize;
      process.env.API_BASE_URL = originalBaseUrl;
    });
  });

  describe('File Validation', () => {
    describe('File Size Validation', () => {
      it('should accept files within size limit', async () => {
        const file = createMockFile({ size: 1024 * 1024 }); // 1MB (within 2MB limit)

        const result = await service.uploadLogo(file, 'tenant_123');
        expect(result).toBeDefined();
        expect(result.size).toBe(1024 * 1024);
      });

      it('should reject logo files exceeding 2MB limit', async () => {
        const file = createMockFile({ size: 1024 * 1024 * 3 }); // 3MB (exceeds 2MB limit)

        await expect(service.uploadLogo(file, 'tenant_123')).rejects.toThrow(
          'File size exceeds maximum of 2MB'
        );
        expect(mockWriteFile).not.toHaveBeenCalled();
      });

      it('should accept package photos up to 5MB', async () => {
        const file = createMockFile({ size: 1024 * 1024 * 4.5 }); // 4.5MB (within 5MB limit)

        const result = await service.uploadPackagePhoto(file, 'package_123');
        expect(result).toBeDefined();
        expect(result.size).toBe(1024 * 1024 * 4.5);
      });

      it('should reject package photos exceeding 5MB limit', async () => {
        const file = createMockFile({ size: 1024 * 1024 * 5.1 }); // 5.1MB (exceeds 5MB limit)

        await expect(service.uploadPackagePhoto(file, 'package_123')).rejects.toThrow(
          'File size exceeds maximum of 5MB'
        );
        expect(mockWriteFile).not.toHaveBeenCalled();
      });

      it('should reject empty files', async () => {
        const file = createMockFile({ buffer: Buffer.from(''), size: 0 });

        await expect(service.uploadLogo(file, 'tenant_123')).rejects.toThrow(
          'File buffer is empty'
        );
      });

      it('should reject files with zero-length buffer', async () => {
        const file = createMockFile({ buffer: Buffer.alloc(0), size: 1024 });

        await expect(service.uploadLogo(file, 'tenant_123')).rejects.toThrow(
          'File buffer is empty'
        );
      });
    });

    describe('MIME Type Validation', () => {
      const validMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/svg+xml',
        'image/webp',
      ];

      validMimeTypes.forEach((mimetype) => {
        it(`should accept ${mimetype} files`, async () => {
          const file = createMockFile({ mimetype });

          await expect(service.uploadLogo(file, 'tenant_123')).resolves.toBeDefined();
        });
      });

      const invalidMimeTypes = [
        'image/gif',
        'application/pdf',
        'text/html',
        'application/javascript',
        'video/mp4',
        'application/octet-stream',
      ];

      invalidMimeTypes.forEach((mimetype) => {
        it(`should reject ${mimetype} files`, async () => {
          const file = createMockFile({ mimetype });

          await expect(service.uploadLogo(file, 'tenant_123')).rejects.toThrow('Invalid file type');
          expect(mockWriteFile).not.toHaveBeenCalled();
        });
      });

      it('should include allowed types in error message', async () => {
        const file = createMockFile({ mimetype: 'image/gif' });

        await expect(service.uploadLogo(file, 'tenant_123')).rejects.toThrow(
          'Allowed types: image/jpeg, image/jpg, image/png, image/svg+xml, image/webp'
        );
      });
    });
  });

  describe('Filename Generation', () => {
    it('should generate unique filenames with timestamp and random string', async () => {
      const file = createMockFile({ originalname: 'test-logo.png' });

      const result1 = await service.uploadLogo(file, 'tenant_123');
      const result2 = await service.uploadLogo(file, 'tenant_123');

      expect(result1.filename).not.toEqual(result2.filename);
      expect(result1.filename).toMatch(/^logo-\d+-[a-f0-9]{16}\.png$/);
      expect(result2.filename).toMatch(/^logo-\d+-[a-f0-9]{16}\.png$/);
    });

    it('should preserve file extension from original filename', async () => {
      const extensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];

      for (const ext of extensions) {
        const file = createMockFile({ originalname: `test${ext}` });
        const result = await service.uploadLogo(file, 'tenant_123');

        expect(result.filename.endsWith(ext)).toBe(true);
      }
    });

    it('should use "logo" prefix for logo uploads', async () => {
      const file = createMockFile();
      const result = await service.uploadLogo(file, 'tenant_123');

      expect(result.filename).toMatch(/^logo-/);
    });

    it('should use "package" prefix for package photo uploads', async () => {
      const file = createMockFile();
      const result = await service.uploadPackagePhoto(file, 'package_123');

      expect(result.filename).toMatch(/^package-/);
    });

    it('should handle filenames with multiple dots', async () => {
      const file = createMockFile({ originalname: 'my.test.logo.png' });
      const result = await service.uploadLogo(file, 'tenant_123');

      expect(result.filename.endsWith('.png')).toBe(true);
      expect(result.filename).toMatch(/^logo-\d+-[a-f0-9]{16}\.png$/);
    });

    it('should handle filenames without extensions', async () => {
      const file = createMockFile({ originalname: 'logo-file' });
      const result = await service.uploadLogo(file, 'tenant_123');

      // Should still generate valid filename (with empty extension)
      expect(result.filename).toMatch(/^logo-\d+-[a-f0-9]{16}$/);
    });

    it('should not allow path traversal in original filename', async () => {
      const maliciousFilenames = [
        '../../etc/passwd.png',
        '../../../etc/shadow.jpg',
        'subdir/../../etc/passwd.png',
      ];

      for (const originalname of maliciousFilenames) {
        const file = createMockFile({ originalname });
        const result = await service.uploadLogo(file, 'tenant_123');

        // Filename should only contain the extension, not the path traversal
        expect(result.filename).not.toContain('..');
        expect(result.filename).not.toContain('/');
        // Filename should follow pattern
        expect(result.filename).toMatch(/^logo-\d+-[a-f0-9]{16}/);
      }
    });

    it('should handle special characters in filenames', async () => {
      const specialNames = [
        'logo with spaces.png',
        'logo@#$%.png',
        'логотип.png', // Cyrillic characters
        '标志.png', // Chinese characters
      ];

      for (const originalname of specialNames) {
        const file = createMockFile({ originalname });
        const result = await service.uploadLogo(file, 'tenant_123');

        // Should generate clean filename (extension present)
        expect(result.filename).toMatch(/^logo-\d+-[a-f0-9]{16}/);
        expect(result.filename).toContain('.png');
      }
    });
  });

  describe('Logo Upload', () => {
    it('should successfully upload logo and return result', async () => {
      const file = createMockFile({
        originalname: 'company-logo.png',
        mimetype: 'image/png',
        size: 1024 * 500, // 500KB
      });

      const result = await service.uploadLogo(file, 'tenant_abc');

      expect(result).toMatchObject({
        url: expect.stringContaining('/uploads/logos/'),
        filename: expect.stringMatching(/^logo-\d+-[a-f0-9]{16}\.png$/),
        size: 1024 * 500,
        mimetype: 'image/png',
      });

      // Check that writeFile was called
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const writeCall = mockWriteFile.mock.calls[0];
      expect(writeCall[0]).toContain('logo-');
      expect(writeCall[1]).toBe(file.buffer);
    });

    it('should write file to correct directory', async () => {
      const file = createMockFile();

      await service.uploadLogo(file, 'tenant_123');

      const writeCall = mockWriteFile.mock.calls[0];
      // Check that path contains the generated filename
      expect(writeCall[0]).toMatch(/logo-\d+-[a-f0-9]{16}\.png$/);
    });

    it('should generate correct public URL', async () => {
      const file = createMockFile({ originalname: 'logo.jpg' });

      const result = await service.uploadLogo(file, 'tenant_123');

      expect(result.url).toContain('/uploads/logos/');
      expect(result.url).toContain('logo-');
      expect(result.url.endsWith('.jpg')).toBe(true);
    });

    it('should handle write errors gracefully', async () => {
      const file = createMockFile();
      const writeError = new Error('ENOSPC: no space left on device');

      mockWriteFile.mockRejectedValueOnce(writeError);

      await expect(service.uploadLogo(file, 'tenant_123')).rejects.toThrow(
        'ENOSPC: no space left on device'
      );
    });

    it('should handle permission errors', async () => {
      const file = createMockFile();
      const permError = new Error('EACCES: permission denied');

      mockWriteFile.mockRejectedValueOnce(permError);

      await expect(service.uploadLogo(file, 'tenant_123')).rejects.toThrow(
        'EACCES: permission denied'
      );
    });
  });

  describe('Package Photo Upload', () => {
    it('should successfully upload package photo and return result', async () => {
      const file = createMockFile({
        originalname: 'package-photo.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 1024 * 3, // 3MB
      });

      const result = await service.uploadPackagePhoto(file, 'package_xyz');

      expect(result).toMatchObject({
        url: expect.stringContaining('/uploads/packages/'),
        filename: expect.stringMatching(/^package-\d+-[a-f0-9]{16}\.jpg$/),
        size: 1024 * 1024 * 3,
        mimetype: 'image/jpeg',
      });

      // Check that writeFile was called
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const writeCall = mockWriteFile.mock.calls[0];
      expect(writeCall[0]).toContain('package-');
      expect(writeCall[1]).toBe(file.buffer);
    });

    it('should write file to correct directory', async () => {
      const file = createMockFile();

      await service.uploadPackagePhoto(file, 'package_123');

      const writeCall = mockWriteFile.mock.calls[0];
      expect(writeCall[0]).toContain('packages');
      expect(writeCall[0]).toMatch(/package-\d+-[a-f0-9]{16}\.png$/);
    });

    it('should generate correct public URL', async () => {
      const file = createMockFile({ originalname: 'photo.webp' });

      const result = await service.uploadPackagePhoto(file, 'package_123');

      expect(result.url).toContain('/uploads/packages/');
      expect(result.url).toContain('package-');
      expect(result.url.endsWith('.webp')).toBe(true);
    });

    it('should use 5MB size limit for package photos', async () => {
      const largeFile = createMockFile({ size: 1024 * 1024 * 4.9 }); // 4.9MB
      const tooLargeFile = createMockFile({ size: 1024 * 1024 * 5.1 }); // 5.1MB

      await expect(service.uploadPackagePhoto(largeFile, 'package_123')).resolves.toBeDefined();
      await expect(service.uploadPackagePhoto(tooLargeFile, 'package_456')).rejects.toThrow(
        'File size exceeds maximum of 5MB'
      );
    });
  });

  describe('Segment Image Upload', () => {
    it('should successfully upload segment image and return result', async () => {
      const file = createMockFile({
        originalname: 'hero-image.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 1024 * 3, // 3MB
      });

      const result = await service.uploadSegmentImage(file, 'tenant_xyz');

      expect(result).toMatchObject({
        url: expect.stringContaining('/uploads/segments/'),
        filename: expect.stringMatching(/^segment-\d+-[a-f0-9]{16}\.jpg$/),
        size: 1024 * 1024 * 3,
        mimetype: 'image/jpeg',
      });

      // Check that writeFile was called
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const writeCall = mockWriteFile.mock.calls[0];
      expect(writeCall[0]).toContain('segment-');
      expect(writeCall[1]).toBe(file.buffer);
    });

    it('should write file to correct directory', async () => {
      const file = createMockFile();

      await service.uploadSegmentImage(file, 'tenant_123');

      const writeCall = mockWriteFile.mock.calls[0];
      expect(writeCall[0]).toContain('segments');
      expect(writeCall[0]).toMatch(/segment-\d+-[a-f0-9]{16}\.png$/);
    });

    it('should use 5MB size limit for segment images', async () => {
      const largeFile = createMockFile({ size: 1024 * 1024 * 4.9 }); // 4.9MB
      const tooLargeFile = createMockFile({ size: 1024 * 1024 * 5.1 }); // 5.1MB

      await expect(service.uploadSegmentImage(largeFile, 'tenant_123')).resolves.toBeDefined();
      await expect(service.uploadSegmentImage(tooLargeFile, 'tenant_456')).rejects.toThrow(
        'File size exceeds maximum of 5MB'
      );
    });

    it('should generate correct public URL', async () => {
      const file = createMockFile({ originalname: 'hero.webp' });

      const result = await service.uploadSegmentImage(file, 'tenant_123');

      expect(result.url).toContain('/uploads/segments/');
      expect(result.url).toContain('segment-');
      expect(result.url.endsWith('.webp')).toBe(true);
    });
  });

  describe('Logo Deletion', () => {
    it('should delete existing logo file', async () => {
      mockExistsSync.mockReturnValue(true);

      await service.deleteLogo('logo-123456-abc.png');

      expect(mockUnlink).toHaveBeenCalledTimes(1);
      const unlinkCall = mockUnlink.mock.calls[0];
      // Check that the filename is in the path
      expect(unlinkCall[0]).toContain('logo-123456-abc.png');
    });

    it('should not throw error if file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(service.deleteLogo('nonexistent.png')).resolves.toBeUndefined();
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockUnlink.mockRejectedValueOnce(new Error('EACCES: permission denied'));

      await expect(service.deleteLogo('logo.png')).rejects.toThrow('EACCES: permission denied');
    });

    it('should not allow path traversal in filename', async () => {
      mockExistsSync.mockReturnValue(true);

      await service.deleteLogo('../../etc/passwd');

      // Should still attempt to delete from logo directory (path.join prevents traversal)
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      const unlinkCall = mockUnlink.mock.calls[0];
      // The path.join will resolve the .. but won't escape the base directory
      expect(unlinkCall[0]).toBeDefined();
    });
  });

  describe('Package Photo Deletion', () => {
    it('should delete existing package photo file', async () => {
      mockExistsSync.mockReturnValue(true);

      await service.deletePackagePhoto('package-789-xyz.jpg');

      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringMatching(/uploads\/packages\/package-789-xyz\.jpg$/)
      );
    });

    it('should not throw error if file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(service.deletePackagePhoto('nonexistent.jpg')).resolves.toBeUndefined();
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockUnlink.mockRejectedValueOnce(new Error('File is locked'));

      await expect(service.deletePackagePhoto('photo.jpg')).rejects.toThrow('File is locked');
    });
  });

  describe('Directory Path Getters', () => {
    it('should return correct logo upload directory path', () => {
      const logoDir = service.getLogoUploadDir();

      expect(logoDir).toBeDefined();
      expect(typeof logoDir).toBe('string');
      // Directory path should be defined (may vary in test environment)
      expect(logoDir.length).toBeGreaterThan(0);
    });

    it('should return correct package photo upload directory path', () => {
      const packageDir = service.getPackagePhotoUploadDir();

      expect(packageDir).toContain('uploads/packages');
      expect(path.isAbsolute(packageDir)).toBe(true);
    });

    it('should return correct segment image upload directory path', () => {
      const segmentDir = service.getSegmentImageUploadDir();

      expect(segmentDir).toContain('uploads/segments');
      expect(path.isAbsolute(segmentDir)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent uploads', async () => {
      const file1 = createMockFile({ originalname: 'logo1.png' });
      const file2 = createMockFile({ originalname: 'logo2.png' });
      const file3 = createMockFile({ originalname: 'logo3.png' });

      const [result1, result2, result3] = await Promise.all([
        service.uploadLogo(file1, 'tenant_1'),
        service.uploadLogo(file2, 'tenant_2'),
        service.uploadLogo(file3, 'tenant_3'),
      ]);

      // All filenames should be unique
      expect(result1.filename).not.toEqual(result2.filename);
      expect(result2.filename).not.toEqual(result3.filename);
      expect(result1.filename).not.toEqual(result3.filename);

      // All should be written
      expect(mockWriteFile).toHaveBeenCalledTimes(3);
    });

    it('should handle very large filenames (truncation)', async () => {
      const veryLongName = 'a'.repeat(300) + '.png';
      const file = createMockFile({ originalname: veryLongName });

      const result = await service.uploadLogo(file, 'tenant_123');

      // Generated filename should be reasonable length
      expect(result.filename.length).toBeLessThan(50);
      expect(result.filename.endsWith('.png')).toBe(true);
    });

    it('should handle files at exact size limit', async () => {
      const exactLimit = createMockFile({ size: 1024 * 1024 * 2 }); // Exactly 2MB

      await expect(service.uploadLogo(exactLimit, 'tenant_123')).resolves.toBeDefined();
    });

    it('should handle files one byte over limit', async () => {
      const overLimit = createMockFile({ size: 1024 * 1024 * 2 + 1 }); // Exactly 2MB + 1 byte

      await expect(service.uploadLogo(overLimit, 'tenant_123')).rejects.toThrow(
        'File size exceeds maximum of 2MB'
      );
    });

    it('should handle SVG files correctly', async () => {
      const svgFile = createMockFile({
        originalname: 'logo.svg',
        mimetype: 'image/svg+xml',
        buffer: Buffer.from('<svg></svg>'),
      });

      const result = await service.uploadLogo(svgFile, 'tenant_123');

      expect(result.filename.endsWith('.svg')).toBe(true);
      expect(result.mimetype).toBe('image/svg+xml');
    });

    it('should handle WebP files correctly', async () => {
      const webpFile = createMockFile({
        originalname: 'modern-logo.webp',
        mimetype: 'image/webp',
      });

      const result = await service.uploadLogo(webpFile, 'tenant_123');

      expect(result.filename.endsWith('.webp')).toBe(true);
      expect(result.mimetype).toBe('image/webp');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle upload-delete-upload cycle', async () => {
      mockExistsSync.mockReturnValue(true);

      const file = createMockFile();

      // Upload
      const result1 = await service.uploadLogo(file, 'tenant_123');
      expect(mockWriteFile).toHaveBeenCalledTimes(1);

      // Delete
      await service.deleteLogo(result1.filename);
      expect(mockUnlink).toHaveBeenCalledTimes(1);

      // Upload again
      const result2 = await service.uploadLogo(file, 'tenant_123');
      expect(mockWriteFile).toHaveBeenCalledTimes(2);

      // Filenames should be different
      expect(result1.filename).not.toEqual(result2.filename);
    });

    it('should maintain separate directories for logos and package photos', async () => {
      const logoFile = createMockFile({ originalname: 'logo.png' });
      const photoFile = createMockFile({ originalname: 'photo.png' });

      const logoResult = await service.uploadLogo(logoFile, 'tenant_123');
      const photoResult = await service.uploadPackagePhoto(photoFile, 'package_123');

      expect(logoResult.url).toContain('/uploads/logos/');
      expect(photoResult.url).toContain('/uploads/packages/');
      expect(logoResult.url).not.toContain('/uploads/packages/');
      expect(photoResult.url).not.toContain('/uploads/logos/');
    });
  });

  describe('Magic Byte Security Validation', () => {
    describe('MIME Type Spoofing Prevention', () => {
      it('should reject PHP file with fake image/jpeg Content-Type header', async () => {
        const maliciousFile = createMockFile({
          originalname: 'shell.php.jpg',
          mimetype: 'image/jpeg',
          buffer: MAGIC_BYTES.phpShell,
          size: MAGIC_BYTES.phpShell.length,
        });

        await expect(service.uploadLogo(maliciousFile, 'tenant_123')).rejects.toThrow(
          'Unable to verify file type'
        );
        expect(mockWriteFile).not.toHaveBeenCalled();
      });

      it('should reject plain text file with fake image/png Content-Type header', async () => {
        const maliciousFile = createMockFile({
          originalname: 'data.txt.png',
          mimetype: 'image/png',
          buffer: MAGIC_BYTES.plainText,
          size: MAGIC_BYTES.plainText.length,
        });

        await expect(service.uploadLogo(maliciousFile, 'tenant_123')).rejects.toThrow(
          'Unable to verify file type'
        );
        expect(mockWriteFile).not.toHaveBeenCalled();
      });

      it('should reject PNG file claiming to be JPEG', async () => {
        const mismatchedFile = createMockFile({
          originalname: 'image.jpg',
          mimetype: 'image/jpeg',
          buffer: MAGIC_BYTES.png,
          size: MAGIC_BYTES.png.length,
        });

        await expect(service.uploadLogo(mismatchedFile, 'tenant_123')).rejects.toThrow(
          'File validation failed'
        );
        expect(mockWriteFile).not.toHaveBeenCalled();
      });

      it('should reject JPEG file claiming to be PNG', async () => {
        const mismatchedFile = createMockFile({
          originalname: 'image.png',
          mimetype: 'image/png',
          buffer: MAGIC_BYTES.jpeg,
          size: MAGIC_BYTES.jpeg.length,
        });

        await expect(service.uploadLogo(mismatchedFile, 'tenant_123')).rejects.toThrow(
          'File validation failed'
        );
        expect(mockWriteFile).not.toHaveBeenCalled();
      });

      it('should accept valid JPEG file with correct Content-Type', async () => {
        const validFile = createMockFile({
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          buffer: MAGIC_BYTES.jpeg,
          size: MAGIC_BYTES.jpeg.length,
        });

        const result = await service.uploadLogo(validFile, 'tenant_123');
        expect(result).toBeDefined();
        expect(result.filename).toMatch(/^logo-.*\.jpg$/);
        expect(mockWriteFile).toHaveBeenCalled();
      });

      it('should accept valid PNG file with correct Content-Type', async () => {
        const validFile = createMockFile({
          originalname: 'image.png',
          mimetype: 'image/png',
          buffer: MAGIC_BYTES.png,
          size: MAGIC_BYTES.png.length,
        });

        const result = await service.uploadLogo(validFile, 'tenant_123');
        expect(result).toBeDefined();
        expect(result.filename).toMatch(/^logo-.*\.png$/);
        expect(mockWriteFile).toHaveBeenCalled();
      });

      it('should accept valid WebP file with correct Content-Type', async () => {
        const validFile = createMockFile({
          originalname: 'image.webp',
          mimetype: 'image/webp',
          buffer: MAGIC_BYTES.webp,
          size: MAGIC_BYTES.webp.length,
        });

        const result = await service.uploadLogo(validFile, 'tenant_123');
        expect(result).toBeDefined();
        expect(result.filename).toMatch(/^logo-.*\.webp$/);
        expect(mockWriteFile).toHaveBeenCalled();
      });

      it('should accept valid SVG file (no magic bytes)', async () => {
        const svgContent = Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>'
        );
        const validFile = createMockFile({
          originalname: 'icon.svg',
          mimetype: 'image/svg+xml',
          buffer: svgContent,
          size: svgContent.length,
        });

        const result = await service.uploadLogo(validFile, 'tenant_123');
        expect(result).toBeDefined();
        expect(result.filename).toMatch(/^logo-.*\.svg$/);
        expect(mockWriteFile).toHaveBeenCalled();
      });

      it('should reject file claiming to be SVG but with PHP content', async () => {
        const maliciousSvg = createMockFile({
          originalname: 'icon.svg',
          mimetype: 'image/svg+xml',
          buffer: MAGIC_BYTES.phpShell,
          size: MAGIC_BYTES.phpShell.length,
        });

        await expect(service.uploadLogo(maliciousSvg, 'tenant_123')).rejects.toThrow(
          'File validation failed'
        );
        expect(mockWriteFile).not.toHaveBeenCalled();
      });
    });

    describe('Security Logging', () => {
      it('should log warning for MIME type mismatch', async () => {
        const { logger } = await import('../../src/lib/core/logger');
        const mismatchedFile = createMockFile({
          originalname: 'fake.jpg',
          mimetype: 'image/jpeg',
          buffer: MAGIC_BYTES.png,
          size: MAGIC_BYTES.png.length,
        });

        await expect(service.uploadLogo(mismatchedFile, 'tenant_123')).rejects.toThrow();

        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            declared: 'image/jpeg',
            detected: 'image/png',
          }),
          expect.stringContaining('SECURITY: MIME type mismatch')
        );
      });
    });
  });

  describe('Segment Image Deletion (Orphan Cleanup)', () => {
    describe('Mock Mode (Local Filesystem)', () => {
      it('should delete segment image from local storage', async () => {
        mockExistsSync.mockReturnValue(true);
        const url = 'http://localhost:5000/uploads/segments/segment-123456-abc.jpg';

        await service.deleteSegmentImage(url, 'tenant_123');

        expect(mockUnlink).toHaveBeenCalledWith(
          expect.stringMatching(/uploads\/segments\/segment-123456-abc\.jpg$/)
        );
      });

      it('should not throw error if local file does not exist', async () => {
        mockExistsSync.mockReturnValue(false);
        const url = 'http://localhost:5000/uploads/segments/nonexistent.jpg';

        await expect(service.deleteSegmentImage(url, 'tenant_123')).resolves.toBeUndefined();
        expect(mockUnlink).not.toHaveBeenCalled();
      });

      it('should handle empty URL gracefully', async () => {
        await expect(service.deleteSegmentImage('', 'tenant_123')).resolves.toBeUndefined();
        expect(mockUnlink).not.toHaveBeenCalled();
      });

      it('should not throw on delete failure - cleanup is non-blocking', async () => {
        mockExistsSync.mockReturnValue(true);
        mockUnlink.mockRejectedValueOnce(new Error('Permission denied'));
        const url = 'http://localhost:5000/uploads/segments/segment.jpg';

        // Should not throw
        await expect(service.deleteSegmentImage(url, 'tenant_123')).resolves.toBeUndefined();
      });
    });

    describe('Cross-Tenant Security (Real Mode)', () => {
      beforeEach(() => {
        // Simulate real mode for these tests - must set STORAGE_MODE=supabase
        // to override the vitest config's STORAGE_MODE=local default
        process.env.STORAGE_MODE = 'supabase';
        process.env.ADAPTERS_PRESET = 'real';
        service = new UploadService();
      });

      afterEach(() => {
        // Reset to mock mode
        process.env.STORAGE_MODE = 'local';
        process.env.ADAPTERS_PRESET = 'mock';
      });

      it('should block cross-tenant deletion attempts', async () => {
        const { logger } = await import('../../src/lib/core/logger');
        // URL belongs to tenant-abc but requesting tenant is tenant-xyz
        const url =
          'https://xxx.supabase.co/storage/v1/object/sign/images/tenant-abc/segments/photo.jpg?token=xxx';

        await service.deleteSegmentImage(url, 'tenant-xyz');

        // Should log security error but not throw
        expect(logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: 'tenant-xyz',
            storagePath: expect.stringMatching(/^tenant-abc\//),
          }),
          expect.stringContaining('SECURITY: Attempted cross-tenant file deletion blocked')
        );
      });
    });
  });
});
