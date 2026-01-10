/**
 * Preview Token Tests
 *
 * Tests for the preview token generation and validation system
 * used for draft content preview in iframes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { generatePreviewToken, validatePreviewToken } from '../../src/lib/preview-tokens';

// Mock the config module
vi.mock('../../src/lib/core/config', () => ({
  loadConfig: () => ({
    JWT_SECRET: 'test-jwt-secret-for-preview-tokens',
  }),
}));

// Mock the logger
vi.mock('../../src/lib/core/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Preview Tokens', () => {
  const testTenantId = 'tenant_test_123';
  const testSlug = 'jane-photography';

  describe('generatePreviewToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generatePreviewToken(testTenantId, testSlug);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should include tenantId and slug in payload', () => {
      const token = generatePreviewToken(testTenantId, testSlug);

      // Decode without verifying to check payload
      const decoded = jwt.decode(token) as {
        tenantId: string;
        slug: string;
        type: string;
      };

      expect(decoded.tenantId).toBe(testTenantId);
      expect(decoded.slug).toBe(testSlug);
      expect(decoded.type).toBe('preview');
    });

    it('should use default expiry of 10 minutes', () => {
      const token = generatePreviewToken(testTenantId, testSlug);

      const decoded = jwt.decode(token) as { exp: number; iat: number };
      const expiryDuration = decoded.exp - decoded.iat;

      // 10 minutes = 600 seconds
      expect(expiryDuration).toBe(600);
    });

    it('should allow custom expiry time', () => {
      const customExpiryMinutes = 5;
      const token = generatePreviewToken(testTenantId, testSlug, customExpiryMinutes);

      const decoded = jwt.decode(token) as { exp: number; iat: number };
      const expiryDuration = decoded.exp - decoded.iat;

      // 5 minutes = 300 seconds
      expect(expiryDuration).toBe(300);
    });
  });

  describe('validatePreviewToken', () => {
    it('should validate a valid token', () => {
      const token = generatePreviewToken(testTenantId, testSlug);
      const result = validatePreviewToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.tenantId).toBe(testTenantId);
        expect(result.payload.slug).toBe(testSlug);
        expect(result.payload.type).toBe('preview');
      }
    });

    it('should validate token with expected slug', () => {
      const token = generatePreviewToken(testTenantId, testSlug);
      const result = validatePreviewToken(token, testSlug);

      expect(result.valid).toBe(true);
    });

    it('should reject token with wrong slug', () => {
      const token = generatePreviewToken(testTenantId, testSlug);
      const result = validatePreviewToken(token, 'different-slug');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('tenant_mismatch');
        expect(result.message).toContain('does not match');
      }
    });

    it('should reject expired token', async () => {
      // Generate token with 0 minute expiry (immediate expiration)
      // This is a bit tricky - we'll create a token that's already expired
      const expiredToken = jwt.sign(
        { tenantId: testTenantId, slug: testSlug, type: 'preview' },
        'test-jwt-secret-for-preview-tokens',
        { algorithm: 'HS256', expiresIn: '-1s' }
      );

      const result = validatePreviewToken(expiredToken);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('expired');
        expect(result.message).toContain('expired');
      }
    });

    it('should reject token with invalid signature', () => {
      // Create token with different secret
      const badToken = jwt.sign(
        { tenantId: testTenantId, slug: testSlug, type: 'preview' },
        'wrong-secret',
        { algorithm: 'HS256' }
      );

      const result = validatePreviewToken(badToken);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('invalid');
      }
    });

    it('should reject token with wrong type', () => {
      // Create token with different type
      const wrongTypeToken = jwt.sign(
        { tenantId: testTenantId, slug: testSlug, type: 'auth' },
        'test-jwt-secret-for-preview-tokens',
        { algorithm: 'HS256' }
      );

      const result = validatePreviewToken(wrongTypeToken);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('wrong_type');
        expect(result.message).toContain('Invalid token type');
      }
    });

    it('should reject malformed token', () => {
      const result = validatePreviewToken('not-a-valid-jwt');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('invalid');
      }
    });

    it('should reject token missing required fields', () => {
      // Create token missing tenantId
      const incompleteToken = jwt.sign(
        { slug: testSlug, type: 'preview' },
        'test-jwt-secret-for-preview-tokens',
        { algorithm: 'HS256' }
      );

      const result = validatePreviewToken(incompleteToken);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('malformed');
        expect(result.message).toContain('missing required fields');
      }
    });
  });
});
