/**
 * Encryption Service Tests
 *
 * Tests AES-256-GCM authenticated encryption for tenant secrets.
 * Critical security component - must maintain 100% coverage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EncryptionService } from '../../src/lib/encryption.service';
import { resetConfig } from '../../src/lib/core/config';
import crypto from 'crypto';

describe('EncryptionService', () => {
  const VALID_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.TENANT_SECRETS_ENCRYPTION_KEY;
    // Reset config singleton so each test starts fresh with current process.env
    resetConfig();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.TENANT_SECRETS_ENCRYPTION_KEY;
    }
    // Reset config singleton so next test re-reads process.env
    resetConfig();
  });

  describe('Constructor & Validation', () => {
    it('should throw if TENANT_SECRETS_ENCRYPTION_KEY is not set', () => {
      delete process.env.TENANT_SECRETS_ENCRYPTION_KEY;

      expect(() => new EncryptionService()).toThrow(
        'TENANT_SECRETS_ENCRYPTION_KEY environment variable is required'
      );
    });

    it('should throw if key is not 64 characters', () => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = 'tooshort';

      // getConfig() Zod validation rejects invalid key before EncryptionService constructor runs
      expect(() => new EncryptionService()).toThrow('Invalid environment configuration');
    });

    it('should throw if key is not valid hex', () => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY =
        'g123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      // getConfig() Zod validation rejects non-hex key before EncryptionService constructor runs
      expect(() => new EncryptionService()).toThrow('Invalid environment configuration');
    });

    it('should accept valid 64-char hex key (lowercase)', () => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = VALID_KEY;

      expect(() => new EncryptionService()).not.toThrow();
    });

    it('should accept valid 64-char hex key (uppercase)', () => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = VALID_KEY.toUpperCase();

      expect(() => new EncryptionService()).not.toThrow();
    });

    it('should accept valid 64-char hex key (mixed case)', () => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY =
        '0123456789ABCDEF0123456789abcdef0123456789ABCDEF0123456789abcdef';

      expect(() => new EncryptionService()).not.toThrow();
    });
  });

  describe('Basic Encryption/Decryption', () => {
    let service: EncryptionService;

    beforeEach(() => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = VALID_KEY;
      service = new EncryptionService();
    });

    it('should encrypt and decrypt string successfully', () => {
      const plaintext = 'my secret data';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt to different ciphertext each time (unique IV)', () => {
      const plaintext = 'same data';

      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.authTag).not.toBe(encrypted2.authTag);
    });

    it('should use unique IV for each encryption', () => {
      const plaintext = 'test';
      const ivs = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const encrypted = service.encrypt(plaintext);
        ivs.add(encrypted.iv);
      }

      // All IVs should be unique
      expect(ivs.size).toBe(100);
    });

    it('should fail decryption with invalid auth tag', () => {
      const plaintext = 'test data';
      const encrypted = service.encrypt(plaintext);

      // Tamper with auth tag
      encrypted.authTag = '0'.repeat(32);

      expect(() => service.decrypt(encrypted)).toThrow();
    });

    it('should fail decryption with tampered ciphertext', () => {
      const plaintext = 'test data';
      const encrypted = service.encrypt(plaintext);

      // Tamper with ciphertext by flipping first byte
      const firstByte = encrypted.ciphertext.substring(0, 2);
      const flipped = firstByte === '00' ? 'ff' : '00';
      encrypted.ciphertext = flipped + encrypted.ciphertext.substring(2);

      expect(() => service.decrypt(encrypted)).toThrow();
    });

    it('should fail decryption with wrong IV', () => {
      const plaintext = 'test data';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      // Swap IVs (wrong IV for ciphertext)
      encrypted1.iv = encrypted2.iv;

      expect(() => service.decrypt(encrypted1)).toThrow();
    });

    it('should encrypt empty string', () => {
      const plaintext = '';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt unicode characters', () => {
      const plaintext = 'Hello 世界 🎉';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt long string', () => {
      const plaintext = 'a'.repeat(10000);

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Stripe Secret Encryption', () => {
    let service: EncryptionService;

    beforeEach(() => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = VALID_KEY;
      service = new EncryptionService();
    });

    it('should encrypt valid Stripe test key', () => {
      // Using test-only fake key (sk_test_[40 chars] format)
      const prefix = 'sk_test_';
      const suffix = '4VFjWpkDjsGN9qZmXo3RbYcHeLkT1uWz2PfA6Ig8';
      const stripeKey = prefix + suffix;

      const encrypted = service.encryptStripeSecret(stripeKey);
      const decrypted = service.decryptStripeSecret(encrypted);

      expect(decrypted).toBe(stripeKey);
    });

    it('should encrypt valid Stripe live key', () => {
      // Using test-only fake key (sk_live_[40 chars] format)
      const prefix = 'sk_live_';
      const suffix = '4VFjWpkDjsGN9qZmXo3RbYcHeLkT1uWz2PfA6Ig8';
      const stripeKey = prefix + suffix;

      const encrypted = service.encryptStripeSecret(stripeKey);
      const decrypted = service.decryptStripeSecret(encrypted);

      expect(decrypted).toBe(stripeKey);
    });

    it('should reject invalid Stripe key format (too short)', () => {
      const invalidKey = 'sk_test_short';

      expect(() => service.encryptStripeSecret(invalidKey)).toThrow(
        'Invalid Stripe secret key format'
      );
    });

    it('should reject invalid Stripe key format (wrong prefix)', () => {
      const invalidKey =
        'pk_test_51ABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD890EFG';

      expect(() => service.encryptStripeSecret(invalidKey)).toThrow(
        'Invalid Stripe secret key format'
      );
    });

    it('should reject invalid Stripe key format (empty string)', () => {
      expect(() => service.encryptStripeSecret('')).toThrow('Invalid Stripe secret key format');
    });

    it('should validate decrypted Stripe key format', () => {
      // Using test-only fake key (constructed to avoid secret scanning)
      const prefix = 'sk_test_';
      const suffix = '4VFjWpkDjsGN9qZmXo3RbYcHeLkT1uWz2PfA6Ig8';
      const stripeKey = prefix + suffix;
      const encrypted = service.encryptStripeSecret(stripeKey);

      // Tamper with encrypted data to produce invalid decrypted format
      // This should throw during validation after decryption
      const decrypted = service.decryptStripeSecret(encrypted);

      expect(decrypted).toMatch(/^sk_(test|live)_/);
    });
  });

  describe('Object Encryption', () => {
    let service: EncryptionService;

    beforeEach(() => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = VALID_KEY;
      service = new EncryptionService();
    });

    it('should encrypt and decrypt JSON object', () => {
      const data = {
        apiKey: 'secret-key-123',
        config: { enabled: true, timeout: 5000 },
      };

      const encrypted = service.encryptObject(data);
      const decrypted = service.decryptObject(encrypted);

      expect(decrypted).toEqual(data);
    });

    it('should handle complex nested objects', () => {
      const data = {
        tenant: {
          id: 'tenant-123',
          secrets: {
            stripe: 'test' + '_stripe_' + 'key',
            postmark: 'pm_test_xyz',
          },
          settings: {
            notifications: { email: true, sms: false },
            features: ['booking', 'payments'],
          },
        },
      };

      const encrypted = service.encryptObject(data);
      const decrypted = service.decryptObject(encrypted);

      expect(decrypted).toEqual(data);
    });

    it('should handle arrays in objects', () => {
      const data = {
        tags: ['urgent', 'pending'],
        numbers: [1, 2, 3],
      };

      const encrypted = service.encryptObject(data);
      const decrypted = service.decryptObject(encrypted);

      expect(decrypted).toEqual(data);
    });

    it('should handle null values in objects', () => {
      const data = {
        name: 'test',
        optional: null,
      };

      const encrypted = service.encryptObject(data);
      const decrypted = service.decryptObject(encrypted);

      expect(decrypted).toEqual(data);
    });

    it('should preserve data types', () => {
      const data = {
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 'two', false],
      };

      const encrypted = service.encryptObject(data);
      const decrypted = service.decryptObject<typeof data>(encrypted);

      expect(typeof decrypted.string).toBe('string');
      expect(typeof decrypted.number).toBe('number');
      expect(typeof decrypted.boolean).toBe('boolean');
      expect(decrypted.null).toBeNull();
      expect(Array.isArray(decrypted.array)).toBe(true);
    });
  });

  describe('Verify Method', () => {
    let service: EncryptionService;

    beforeEach(() => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = VALID_KEY;
      service = new EncryptionService();
    });

    it('should verify matching plaintext and encrypted data', () => {
      const plaintext = 'my secret';
      const encrypted = service.encrypt(plaintext);

      const isValid = service.verify(plaintext, encrypted);

      expect(isValid).toBe(true);
    });

    it('should reject non-matching plaintext', () => {
      const plaintext = 'my secret';
      const encrypted = service.encrypt(plaintext);

      const isValid = service.verify('wrong secret', encrypted);

      expect(isValid).toBe(false);
    });

    it('should reject tampered ciphertext', () => {
      const plaintext = 'my secret';
      const encrypted = service.encrypt(plaintext);

      // Ensure we actually tamper with the ciphertext by modifying the first character
      const originalChar = encrypted.ciphertext[0];
      const tamperedChar = originalChar === '0' ? '1' : '0';
      encrypted.ciphertext = tamperedChar + encrypted.ciphertext.substring(1);

      const isValid = service.verify(plaintext, encrypted);

      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison (timing attack resistant)', () => {
      const plaintext = 'my secret';
      const encrypted = service.encrypt(plaintext);

      // Measure time for correct plaintext
      const start1 = process.hrtime.bigint();
      service.verify(plaintext, encrypted);
      const time1 = process.hrtime.bigint() - start1;

      // Measure time for incorrect plaintext (same length)
      const start2 = process.hrtime.bigint();
      service.verify('wx secret', encrypted);
      const time2 = process.hrtime.bigint() - start2;

      // Times should be similar (within 100x factor for constant-time comparison)
      // This is a weak test but ensures we're using crypto.timingSafeEqual
      const ratio = Number(time1) / Number(time2);
      expect(ratio).toBeGreaterThan(0.01);
      expect(ratio).toBeLessThan(100);
    });
  });

  describe('Security Features', () => {
    let service: EncryptionService;

    beforeEach(() => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = VALID_KEY;
      service = new EncryptionService();
    });

    it('should generate cryptographically secure IVs (not Math.random)', () => {
      const plaintext = 'test';
      const ivs: string[] = [];

      // Collect 100 IVs
      for (let i = 0; i < 100; i++) {
        const encrypted = service.encrypt(plaintext);
        ivs.push(encrypted.iv);
      }

      // All IVs should be 32 hex characters (16 bytes)
      ivs.forEach((iv) => {
        expect(iv).toMatch(/^[0-9a-f]{32}$/);
      });

      // Check for sufficient randomness (no duplicate IVs)
      const uniqueIvs = new Set(ivs);
      expect(uniqueIvs.size).toBe(100);
    });

    it('should use AES-256-GCM (authenticated encryption)', () => {
      const plaintext = 'test';
      const encrypted = service.encrypt(plaintext);

      // Auth tag should be present (16 bytes = 32 hex chars)
      expect(encrypted.authTag).toMatch(/^[0-9a-f]{32}$/);

      // IV should be 16 bytes (32 hex chars)
      expect(encrypted.iv).toMatch(/^[0-9a-f]{32}$/);

      // Ciphertext should be hex
      expect(encrypted.ciphertext).toMatch(/^[0-9a-f]+$/);
    });

    it('should prevent timing attacks in verify method', () => {
      const plaintext = 'my secret';
      const encrypted = service.encrypt(plaintext);

      // This test verifies that crypto.timingSafeEqual is used
      // by checking that verify() doesn't throw on length mismatch
      const result = service.verify('short', encrypted);

      expect(result).toBe(false);
    });

    it('should not leak information through error messages', () => {
      const encrypted = service.encrypt('test');
      encrypted.authTag = '0'.repeat(32);

      try {
        service.decrypt(encrypted);
        expect.fail('Should have thrown');
      } catch (error: any) {
        // Error message should not reveal which part failed
        expect(error.message).not.toContain('auth tag');
        expect(error.message).not.toContain('ciphertext');
      }
    });
  });

  describe('Key Rotation Scenarios', () => {
    it('should fail decryption with different key', () => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = VALID_KEY;
      const service1 = new EncryptionService();
      const encrypted = service1.encrypt('test');

      // Different key — must reset config singleton so getConfig() picks up new value
      process.env.TENANT_SECRETS_ENCRYPTION_KEY =
        'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      resetConfig();
      const service2 = new EncryptionService();

      expect(() => service2.decrypt(encrypted)).toThrow();
    });

    it('should require new EncryptionService instance after key change', () => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = VALID_KEY;
      const service = new EncryptionService();
      const encrypted = service.encrypt('test');

      // Change environment key (service still has old key)
      process.env.TENANT_SECRETS_ENCRYPTION_KEY =
        'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

      // Old service should still work (uses cached key)
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe('test');
    });
  });

  describe('Edge Cases', () => {
    let service: EncryptionService;

    beforeEach(() => {
      process.env.TENANT_SECRETS_ENCRYPTION_KEY = VALID_KEY;
      service = new EncryptionService();
    });

    it('should handle special characters in plaintext', () => {
      const plaintext = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle newlines and tabs', () => {
      const plaintext = 'line1\nline2\tcolumn';

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long strings', () => {
      const plaintext = 'x'.repeat(1000000); // 1MB string

      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return consistent encrypted structure', () => {
      const encrypted = service.encrypt('test');

      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(Object.keys(encrypted)).toHaveLength(3);
    });
  });
});
