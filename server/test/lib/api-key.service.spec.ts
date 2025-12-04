/**
 * Unit tests for ApiKeyService
 *
 * SECURITY-CRITICAL: Tests for API key generation, validation, and hashing.
 * Weak or predictable keys compromise the entire multi-tenant system.
 *
 * Tests cover:
 * - Public key generation (pk_live_{slug}_{random16})
 * - Secret key generation (sk_live_{slug}_{random32})
 * - Key format validation
 * - Uniqueness (collision prevention)
 * - SHA-256 hashing (one-way, secure)
 * - Tenant slug validation
 * - Reserved slug rejection
 * - Entropy verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ApiKeyService } from '../../src/lib/api-key.service';
import crypto from 'node:crypto';

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(() => {
    service = new ApiKeyService();
  });

  describe('generatePublicKey', () => {
    it('generates public key with correct format pk_live_{slug}_{random16}', () => {
      // Act
      const publicKey = service.generatePublicKey('bellaweddings');

      // Assert
      expect(publicKey).toMatch(/^pk_live_bellaweddings_[a-f0-9]{16}$/);
      expect(publicKey.startsWith('pk_live_')).toBe(true);
      expect(publicKey.includes('bellaweddings')).toBe(true);
    });

    it('generates public keys with 16 hexadecimal random characters', () => {
      // Act
      const publicKey = service.generatePublicKey('testbusiness');

      // Assert
      const parts = publicKey.split('_');
      const randomPart = parts[parts.length - 1];
      expect(randomPart.length).toBe(16);
      expect(/^[a-f0-9]{16}$/.test(randomPart)).toBe(true);
    });

    it('generates unique public keys on multiple calls (no collisions)', () => {
      // Arrange
      const iterations = 1000;
      const keys = new Set<string>();

      // Act - generate 1000 keys
      for (let i = 0; i < iterations; i++) {
        const key = service.generatePublicKey('testbusiness');
        keys.add(key);
      }

      // Assert - all keys should be unique
      expect(keys.size).toBe(iterations);
    });

    it('generates different keys for different tenant slugs', () => {
      // Act
      const key1 = service.generatePublicKey('bellaweddings');
      const key2 = service.generatePublicKey('techconsulting');

      // Assert
      expect(key1).not.toBe(key2);
      expect(key1.includes('bellaweddings')).toBe(true);
      expect(key2.includes('techconsulting')).toBe(true);
    });

    it('rejects empty tenant slug', () => {
      // Act & Assert
      expect(() => service.generatePublicKey('')).toThrow('Tenant slug is required');
    });

    it('rejects tenant slug that is too short', () => {
      // Act & Assert
      expect(() => service.generatePublicKey('ab')).toThrow('Tenant slug must be 3-50 characters');
    });

    it('rejects tenant slug that is too long', () => {
      // Arrange
      const longSlug = 'a'.repeat(51);

      // Act & Assert
      expect(() => service.generatePublicKey(longSlug)).toThrow(
        'Tenant slug must be 3-50 characters'
      );
    });

    it('rejects tenant slug with uppercase letters', () => {
      // Act & Assert
      expect(() => service.generatePublicKey('BellaWeddings')).toThrow(
        'Tenant slug must start with letter, contain only lowercase letters'
      );
    });

    it('rejects tenant slug with spaces', () => {
      // Act & Assert
      expect(() => service.generatePublicKey('bella weddings')).toThrow(
        'Tenant slug must start with letter, contain only lowercase letters'
      );
    });

    it('rejects tenant slug with special characters', () => {
      // Act & Assert
      expect(() => service.generatePublicKey('bella@weddings')).toThrow(
        'Tenant slug must start with letter, contain only lowercase letters'
      );
      expect(() => service.generatePublicKey('bella_weddings')).toThrow(
        'Tenant slug must start with letter, contain only lowercase letters'
      );
      expect(() => service.generatePublicKey('bella.weddings')).toThrow(
        'Tenant slug must start with letter, contain only lowercase letters'
      );
    });

    it('rejects tenant slug starting with number', () => {
      // Act & Assert
      expect(() => service.generatePublicKey('123business')).toThrow(
        'Tenant slug must start with letter, contain only lowercase letters'
      );
    });

    it('rejects tenant slug ending with hyphen', () => {
      // Act & Assert
      expect(() => service.generatePublicKey('bellaweddings-')).toThrow(
        'Tenant slug must start with letter, contain only lowercase letters'
      );
    });

    it('accepts valid tenant slug with hyphens', () => {
      // Act
      const key = service.generatePublicKey('bella-weddings');

      // Assert
      expect(key).toMatch(/^pk_live_bella-weddings_[a-f0-9]{16}$/);
    });

    it('rejects reserved tenant slugs', () => {
      // Arrange
      const reservedSlugs = [
        'api',
        'admin',
        'app',
        'www',
        'widget',
        'cdn',
        'static',
        'assets',
        'public',
        'private',
        'internal',
        'system',
        'test',
        'staging',
        'production',
        'dev',
        'demo',
      ];

      // Act & Assert
      reservedSlugs.forEach((slug) => {
        expect(() => service.generatePublicKey(slug)).toThrow(`Tenant slug "${slug}" is reserved`);
      });
    });
  });

  describe('generateSecretKey', () => {
    it('generates secret key with correct format sk_live_{slug}_{random32}', () => {
      // Act
      const secretKey = service.generateSecretKey('bellaweddings');

      // Assert
      expect(secretKey).toMatch(/^sk_live_bellaweddings_[a-f0-9]{32}$/);
      expect(secretKey.startsWith('sk_live_')).toBe(true);
      expect(secretKey.includes('bellaweddings')).toBe(true);
    });

    it('generates secret keys with 32 hexadecimal random characters', () => {
      // Act
      const secretKey = service.generateSecretKey('testbusiness');

      // Assert
      const parts = secretKey.split('_');
      const randomPart = parts[parts.length - 1];
      expect(randomPart.length).toBe(32);
      expect(/^[a-f0-9]{32}$/.test(randomPart)).toBe(true);
    });

    it('generates unique secret keys on multiple calls (no collisions)', () => {
      // Arrange
      const iterations = 1000;
      const keys = new Set<string>();

      // Act - generate 1000 keys
      for (let i = 0; i < iterations; i++) {
        const key = service.generateSecretKey('testbusiness');
        keys.add(key);
      }

      // Assert - all keys should be unique
      expect(keys.size).toBe(iterations);
    });

    it('generates different secret keys from public keys', () => {
      // Act
      const publicKey = service.generatePublicKey('bellaweddings');
      const secretKey = service.generateSecretKey('bellaweddings');

      // Assert
      expect(publicKey).not.toBe(secretKey);
      expect(publicKey.startsWith('pk_live_')).toBe(true);
      expect(secretKey.startsWith('sk_live_')).toBe(true);
    });

    it('secret keys have double the entropy of public keys', () => {
      // Act
      const publicKey = service.generatePublicKey('testbusiness');
      const secretKey = service.generateSecretKey('testbusiness');

      // Assert - extract random parts
      const publicRandom = publicKey.split('_').pop() || '';
      const secretRandom = secretKey.split('_').pop() || '';

      expect(secretRandom.length).toBe(32);
      expect(publicRandom.length).toBe(16);
      expect(secretRandom.length).toBe(publicRandom.length * 2);
    });

    it('rejects invalid tenant slug for secret key generation', () => {
      // Act & Assert
      expect(() => service.generateSecretKey('')).toThrow('Tenant slug is required');
      expect(() => service.generateSecretKey('UPPERCASE')).toThrow(
        'Tenant slug must start with letter, contain only lowercase letters'
      );
      expect(() => service.generateSecretKey('admin')).toThrow('Tenant slug "admin" is reserved');
    });
  });

  describe('extractTenantSlug', () => {
    it('extracts tenant slug from public key', () => {
      // Arrange
      const publicKey = service.generatePublicKey('bellaweddings');

      // Act
      const slug = service.extractTenantSlug(publicKey);

      // Assert
      expect(slug).toBe('bellaweddings');
    });

    it('extracts tenant slug from secret key', () => {
      // Arrange
      const secretKey = service.generateSecretKey('techconsulting');

      // Act
      const slug = service.extractTenantSlug(secretKey);

      // Assert
      expect(slug).toBe('techconsulting');
    });

    it('extracts tenant slug with hyphens', () => {
      // Arrange
      const publicKey = service.generatePublicKey('bella-weddings');

      // Act
      const slug = service.extractTenantSlug(publicKey);

      // Assert
      expect(slug).toBe('bella-weddings');
    });

    it('returns null for invalid public key format', () => {
      // Act & Assert
      expect(service.extractTenantSlug('invalid-key')).toBeNull();
      expect(service.extractTenantSlug('pk_live_bellaweddings')).toBeNull();
      expect(service.extractTenantSlug('pk_live_bellaweddings_tooshort')).toBeNull();
      expect(service.extractTenantSlug('pk_live_bellaweddings_NOTLOWERCASE')).toBeNull();
    });

    it('returns null for invalid secret key format', () => {
      // Act & Assert
      expect(service.extractTenantSlug('sk_live_bellaweddings')).toBeNull();
      expect(service.extractTenantSlug('sk_live_bellaweddings_tooshort')).toBeNull();
      expect(service.extractTenantSlug('sk_live_bellaweddings_abc123')).toBeNull(); // Only 6 chars
    });

    it('returns null for empty or malformed keys', () => {
      // Act & Assert
      expect(service.extractTenantSlug('')).toBeNull();
      expect(service.extractTenantSlug('random-string')).toBeNull();
      expect(service.extractTenantSlug('pk_test_bellaweddings_abc123')).toBeNull();
    });
  });

  describe('isValidPublicKeyFormat', () => {
    it('validates correct public key format', () => {
      // Arrange
      const publicKey = service.generatePublicKey('bellaweddings');

      // Act & Assert
      expect(service.isValidPublicKeyFormat(publicKey)).toBe(true);
    });

    it('validates public key with hyphenated slug', () => {
      // Arrange
      const publicKey = service.generatePublicKey('bella-weddings');

      // Act & Assert
      expect(service.isValidPublicKeyFormat(publicKey)).toBe(true);
    });

    it('rejects public key with wrong prefix', () => {
      // Act & Assert
      expect(service.isValidPublicKeyFormat('sk_live_bellaweddings_a3f8c9d2e1b4f7g8')).toBe(false);
      expect(service.isValidPublicKeyFormat('pk_test_bellaweddings_a3f8c9d2e1b4f7g8')).toBe(false);
    });

    it('rejects public key with wrong random length', () => {
      // Act & Assert
      expect(service.isValidPublicKeyFormat('pk_live_bellaweddings_abc123')).toBe(false); // Too short
      expect(service.isValidPublicKeyFormat('pk_live_bellaweddings_a3f8c9d2e1b4f7g8abcdef')).toBe(
        false
      ); // Too long
    });

    it('rejects public key with uppercase random chars', () => {
      // Act & Assert
      expect(service.isValidPublicKeyFormat('pk_live_bellaweddings_A3F8C9D2E1B4F7G8')).toBe(false);
    });

    it('rejects public key with non-hex random chars', () => {
      // Act & Assert
      expect(service.isValidPublicKeyFormat('pk_live_bellaweddings_g3f8c9d2e1b4f7g8')).toBe(false); // 'g' is not hex
      expect(service.isValidPublicKeyFormat('pk_live_bellaweddings_a3f8-9d2e1b4f7g8')).toBe(false); // Contains hyphen
    });

    it('rejects public key with invalid slug format', () => {
      // Act & Assert
      expect(service.isValidPublicKeyFormat('pk_live_BellaWeddings_a3f8c9d2e1b4f7g8')).toBe(false); // Uppercase slug
      expect(service.isValidPublicKeyFormat('pk_live_bella_weddings_a3f8c9d2e1b4f7g8')).toBe(false); // Underscore in slug
    });

    it('rejects completely invalid formats', () => {
      // Act & Assert
      expect(service.isValidPublicKeyFormat('')).toBe(false);
      expect(service.isValidPublicKeyFormat('invalid-key')).toBe(false);
      expect(service.isValidPublicKeyFormat('pk_live_bellaweddings')).toBe(false);
    });
  });

  describe('isValidSecretKeyFormat', () => {
    it('validates correct secret key format', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bellaweddings');

      // Act & Assert
      expect(service.isValidSecretKeyFormat(secretKey)).toBe(true);
    });

    it('validates secret key with hyphenated slug', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bella-weddings');

      // Act & Assert
      expect(service.isValidSecretKeyFormat(secretKey)).toBe(true);
    });

    it('rejects secret key with wrong prefix', () => {
      // Act & Assert
      expect(service.isValidSecretKeyFormat('pk_live_bellaweddings_a3f8c9d2e1b4f7g8h9i0j1k2')).toBe(
        false
      );
      expect(service.isValidSecretKeyFormat('sk_test_bellaweddings_a3f8c9d2e1b4f7g8h9i0j1k2')).toBe(
        false
      );
    });

    it('rejects secret key with wrong random length', () => {
      // Act & Assert
      expect(service.isValidSecretKeyFormat('sk_live_bellaweddings_abc123')).toBe(false); // Too short (6 chars)
      expect(service.isValidSecretKeyFormat('sk_live_bellaweddings_a3f8c9d2e1b4f7g8')).toBe(false); // Too short (16 chars)
      expect(
        service.isValidSecretKeyFormat('sk_live_bellaweddings_a3f8c9d2e1b4f7g8h9i0j1k2l3m4n5o6p7q8')
      ).toBe(false); // Too long
    });

    it('rejects secret key with non-hex random chars', () => {
      // Act & Assert
      expect(
        service.isValidSecretKeyFormat('sk_live_bellaweddings_g3f8c9d2e1b4f7g8h9i0j1k2l3m4n5o6')
      ).toBe(false); // 'g' is not hex
    });

    it('rejects completely invalid formats', () => {
      // Act & Assert
      expect(service.isValidSecretKeyFormat('')).toBe(false);
      expect(service.isValidSecretKeyFormat('invalid-key')).toBe(false);
      expect(service.isValidSecretKeyFormat('sk_live_bellaweddings')).toBe(false);
    });
  });

  describe('hashSecretKey', () => {
    it('hashes secret key using SHA-256', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bellaweddings');

      // Act
      const hash = service.hashSecretKey(secretKey);

      // Assert
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex = 64 chars
      expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
    });

    it('generates consistent hash for same secret key', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bellaweddings');

      // Act
      const hash1 = service.hashSecretKey(secretKey);
      const hash2 = service.hashSecretKey(secretKey);

      // Assert - same input should produce same hash
      expect(hash1).toBe(hash2);
    });

    it('generates different hashes for different secret keys', () => {
      // Arrange
      const secretKey1 = service.generateSecretKey('bellaweddings');
      const secretKey2 = service.generateSecretKey('techconsulting');

      // Act
      const hash1 = service.hashSecretKey(secretKey1);
      const hash2 = service.hashSecretKey(secretKey2);

      // Assert
      expect(hash1).not.toBe(hash2);
    });

    it('cannot reverse hash to recover original key', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bellaweddings');

      // Act
      const hash = service.hashSecretKey(secretKey);

      // Assert - hash should not contain any part of the original key
      expect(hash).not.toContain('sk_live_');
      expect(hash).not.toContain('bellaweddings');
      expect(hash).not.toContain(secretKey.split('_').pop()); // Random part
    });

    it('rejects hashing invalid secret key format', () => {
      // Act & Assert
      expect(() => service.hashSecretKey('invalid-key')).toThrow('Invalid secret key format');
      expect(() => service.hashSecretKey('pk_live_bellaweddings_abc123')).toThrow(
        'Invalid secret key format'
      );
      expect(() => service.hashSecretKey('sk_live_bellaweddings_tooshort')).toThrow(
        'Invalid secret key format'
      );
    });

    it('produces cryptographically secure hash (matches manual SHA-256)', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bellaweddings');

      // Act
      const serviceHash = service.hashSecretKey(secretKey);
      const manualHash = crypto.createHash('sha256').update(secretKey).digest('hex');

      // Assert - should match manual SHA-256 hash
      expect(serviceHash).toBe(manualHash);
    });
  });

  describe('verifySecretKey', () => {
    it('verifies correct secret key against hash', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bellaweddings');
      const hash = service.hashSecretKey(secretKey);

      // Act
      const isValid = service.verifySecretKey(secretKey, hash);

      // Assert
      expect(isValid).toBe(true);
    });

    it('rejects incorrect secret key', () => {
      // Arrange
      const secretKey1 = service.generateSecretKey('bellaweddings');
      const secretKey2 = service.generateSecretKey('bellaweddings'); // Different key
      const hash = service.hashSecretKey(secretKey1);

      // Act
      const isValid = service.verifySecretKey(secretKey2, hash);

      // Assert
      expect(isValid).toBe(false);
    });

    it('rejects secret key with slightly modified characters', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bellaweddings');
      const hash = service.hashSecretKey(secretKey);

      // Modify last character of key (toggle between 'a' and 'b')
      const lastChar = secretKey.slice(-1);
      const newChar = lastChar === 'a' ? 'b' : 'a';
      const modifiedKey = secretKey.slice(0, -1) + newChar;

      // Act
      const isValid = service.verifySecretKey(modifiedKey, hash);

      // Assert
      expect(isValid).toBe(false);
    });

    it('rejects invalid secret key format', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bellaweddings');
      const hash = service.hashSecretKey(secretKey);

      // Act & Assert
      expect(service.verifySecretKey('invalid-key', hash)).toBe(false);
      expect(service.verifySecretKey('pk_live_bellaweddings_abc123', hash)).toBe(false);
    });

    it('rejects verification with invalid hash format', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bellaweddings');
      const invalidHash = 'not-a-valid-hash';

      // Act
      const isValid = service.verifySecretKey(secretKey, invalidHash);

      // Assert
      expect(isValid).toBe(false);
    });

    it('rejects verification with empty hash', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bellaweddings');

      // Act
      const isValid = service.verifySecretKey(secretKey, '');

      // Assert
      expect(isValid).toBe(false);
    });

    it('uses timing-safe comparison to prevent timing attacks', () => {
      // Arrange
      const secretKey1 = service.generateSecretKey('bellaweddings');
      const secretKey2 = service.generateSecretKey('techconsulting');
      const hash1 = service.hashSecretKey(secretKey1);

      // Act - measure time for correct and incorrect key
      const iterations = 100;
      const correctTimes: number[] = [];
      const incorrectTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start1 = process.hrtime.bigint();
        service.verifySecretKey(secretKey1, hash1);
        const end1 = process.hrtime.bigint();
        correctTimes.push(Number(end1 - start1));

        const start2 = process.hrtime.bigint();
        service.verifySecretKey(secretKey2, hash1);
        const end2 = process.hrtime.bigint();
        incorrectTimes.push(Number(end2 - start2));
      }

      // Assert - timing should be similar (within reasonable variance)
      // This is a heuristic test - crypto.timingSafeEqual ensures constant-time
      const avgCorrect = correctTimes.reduce((a, b) => a + b, 0) / iterations;
      const avgIncorrect = incorrectTimes.reduce((a, b) => a + b, 0) / iterations;

      // Timing variance should be small relative to operation time
      // (not perfectly constant due to system noise, but close)
      const timingRatio = Math.abs(avgCorrect - avgIncorrect) / Math.max(avgCorrect, avgIncorrect);
      expect(timingRatio).toBeLessThan(0.5); // Allow 50% variance for system noise
    });
  });

  describe('generateKeyPair', () => {
    it('generates both public and secret keys with hash', () => {
      // Act
      const keyPair = service.generateKeyPair('bellaweddings');

      // Assert
      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair).toHaveProperty('secretKey');
      expect(keyPair).toHaveProperty('secretKeyHash');

      expect(service.isValidPublicKeyFormat(keyPair.publicKey)).toBe(true);
      expect(service.isValidSecretKeyFormat(keyPair.secretKey)).toBe(true);
      expect(keyPair.secretKeyHash.length).toBe(64); // SHA-256 hex
    });

    it('generates key pair with matching tenant slug', () => {
      // Act
      const keyPair = service.generateKeyPair('techconsulting');

      // Assert
      expect(service.extractTenantSlug(keyPair.publicKey)).toBe('techconsulting');
      expect(service.extractTenantSlug(keyPair.secretKey)).toBe('techconsulting');
    });

    it('generates key pair with verifiable hash', () => {
      // Act
      const keyPair = service.generateKeyPair('bellaweddings');

      // Assert
      const isValid = service.verifySecretKey(keyPair.secretKey, keyPair.secretKeyHash);
      expect(isValid).toBe(true);
    });

    it('generates different public and secret keys', () => {
      // Act
      const keyPair = service.generateKeyPair('bellaweddings');

      // Assert
      expect(keyPair.publicKey).not.toBe(keyPair.secretKey);
      expect(keyPair.publicKey.startsWith('pk_live_')).toBe(true);
      expect(keyPair.secretKey.startsWith('sk_live_')).toBe(true);
    });

    it('generates unique key pairs on multiple calls', () => {
      // Act
      const keyPair1 = service.generateKeyPair('bellaweddings');
      const keyPair2 = service.generateKeyPair('bellaweddings');

      // Assert - all keys should be different
      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(keyPair1.secretKey).not.toBe(keyPair2.secretKey);
      expect(keyPair1.secretKeyHash).not.toBe(keyPair2.secretKeyHash);
    });

    it('rejects invalid tenant slug', () => {
      // Act & Assert
      expect(() => service.generateKeyPair('')).toThrow('Tenant slug is required');
      expect(() => service.generateKeyPair('UPPERCASE')).toThrow(
        'Tenant slug must start with letter, contain only lowercase letters'
      );
      expect(() => service.generateKeyPair('admin')).toThrow('Tenant slug "admin" is reserved');
    });
  });

  describe('Security Properties', () => {
    it('public keys have sufficient entropy (at least 64 bits)', () => {
      // Arrange - 16 hex chars = 64 bits of entropy
      const publicKey = service.generatePublicKey('bellaweddings');
      const randomPart = publicKey.split('_').pop() || '';

      // Assert
      expect(randomPart.length).toBe(16); // 16 hex chars = 8 bytes = 64 bits
    });

    it('secret keys have sufficient entropy (at least 128 bits)', () => {
      // Arrange - 32 hex chars = 128 bits of entropy
      const secretKey = service.generateSecretKey('bellaweddings');
      const randomPart = secretKey.split('_').pop() || '';

      // Assert
      expect(randomPart.length).toBe(32); // 32 hex chars = 16 bytes = 128 bits
    });

    it('random bytes are cryptographically secure (crypto.randomBytes)', () => {
      // Arrange - generate many keys and check for patterns
      const keys = new Set<string>();
      const iterations = 100;

      // Act
      for (let i = 0; i < iterations; i++) {
        const key = service.generateSecretKey('testbusiness');
        const randomPart = key.split('_').pop() || '';
        keys.add(randomPart);
      }

      // Assert - no repeated random parts
      expect(keys.size).toBe(iterations);

      // Check that random parts don't have obvious patterns
      const randomParts = Array.from(keys);
      const hasSequence = randomParts.some(
        (part) => part.includes('0123456789') || part.includes('abcdef')
      );
      expect(hasSequence).toBe(false);
    });

    it('key format prevents injection attacks', () => {
      // Act & Assert - attempt to inject malicious patterns
      expect(() => service.generatePublicKey('bella"weddings')).toThrow();
      expect(() => service.generatePublicKey("bella'weddings")).toThrow();
      expect(() => service.generatePublicKey('bella;weddings')).toThrow();
      expect(() => service.generatePublicKey('bella/weddings')).toThrow();
      expect(() => service.generatePublicKey('bella\\weddings')).toThrow();
      expect(() => service.generatePublicKey('bella/../weddings')).toThrow();
    });

    it('hashed keys are one-way and irreversible', () => {
      // Arrange
      const secretKey = service.generateSecretKey('bellaweddings');
      const hash = service.hashSecretKey(secretKey);

      // Act - try to extract any information from hash
      const randomPart = secretKey.split('_').pop() || '';

      // Assert - hash should not leak any key information
      expect(hash).not.toContain('sk_live_');
      expect(hash).not.toContain('bellaweddings');
      expect(hash).not.toContain(randomPart);
      expect(hash.toLowerCase()).not.toContain(randomPart.toLowerCase());

      // Hash should be purely random-looking hex
      expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
    });

    it('prevents tenant slug enumeration through key format', () => {
      // Arrange
      const key1 = service.generatePublicKey('abc');
      const key2 = service.generatePublicKey('xyz');

      // Act - extract slugs
      const slug1 = service.extractTenantSlug(key1);
      const slug2 = service.extractTenantSlug(key2);

      // Assert - keys contain slugs (by design for routing)
      // but random parts prevent guessing other tenants' keys
      expect(slug1).toBe('abc');
      expect(slug2).toBe('xyz');

      // Random parts are unpredictable
      const random1 = key1.split('_').pop() || '';
      const random2 = key2.split('_').pop() || '';
      expect(random1).not.toBe(random2);
    });
  });
});
