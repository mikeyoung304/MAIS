import crypto from 'node:crypto';
import { getConfig } from './core/config';

/**
 * Encryption service for tenant secrets (Stripe keys, API secrets, etc.)
 * Uses AES-256-GCM for authenticated encryption
 *
 * SECURITY:
 * - Master encryption key MUST be stored in environment variable
 * - Key must be 64-character hex string (32 bytes)
 * - Generate with: openssl rand -hex 32
 * - Rotate keys regularly (see SECRETS_ROTATION.md)
 *
 * @example
 * const encrypted = encryptionService.encrypt('sensitive-data');
 * // Returns: { ciphertext: '...', iv: '...', authTag: '...' }
 *
 * const decrypted = encryptionService.decrypt(encrypted);
 * // Returns: 'sensitive-data'
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const masterKey = getConfig().TENANT_SECRETS_ENCRYPTION_KEY;

    if (!masterKey) {
      throw new Error(
        'TENANT_SECRETS_ENCRYPTION_KEY environment variable is required. ' +
          'Generate with: openssl rand -hex 32'
      );
    }

    if (masterKey.length !== 64) {
      throw new Error(
        'TENANT_SECRETS_ENCRYPTION_KEY must be 64-character hex string (32 bytes). ' +
          'Generate with: openssl rand -hex 32'
      );
    }

    // Validate hex format
    if (!/^[0-9a-f]{64}$/i.test(masterKey)) {
      throw new Error(
        'TENANT_SECRETS_ENCRYPTION_KEY must be a valid hex string. ' +
          'Generate with: openssl rand -hex 32'
      );
    }

    this.key = Buffer.from(masterKey, 'hex');
  }

  /**
   * Encrypt a plaintext secret
   *
   * @param plaintext - The secret to encrypt
   * @returns Object with ciphertext, iv, and authTag (all hex-encoded)
   * @throws Error if encryption fails
   */
  encrypt(plaintext: string): EncryptedData {
    // Generate random initialization vector (IV)
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    // Encrypt
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    // Get authentication tag (ensures data hasn't been tampered)
    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt an encrypted secret
   *
   * @param encrypted - Object with ciphertext, iv, and authTag
   * @returns Decrypted plaintext
   * @throws Error if authentication fails (data tampered) or decryption fails
   */
  decrypt(encrypted: EncryptedData): string {
    // Create decipher
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(encrypted.iv, 'hex')
    );

    // Set authentication tag
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

    // Decrypt
    let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  /**
   * Encrypt Stripe Connect secret key for database storage
   * Validates that the key has the correct format before encryption
   *
   * @param stripeSecretKey - Stripe secret key (sk_test_* or sk_live_*)
   * @returns Encrypted data
   * @throws Error if key format is invalid
   */
  encryptStripeSecret(stripeSecretKey: string): EncryptedData {
    if (!this.isValidStripeSecretKey(stripeSecretKey)) {
      throw new Error('Invalid Stripe secret key format. Expected sk_test_* or sk_live_*');
    }
    return this.encrypt(stripeSecretKey);
  }

  /**
   * Decrypt Stripe Connect secret key from database
   * Validates decrypted value has correct format
   *
   * @param encrypted - Encrypted Stripe secret key
   * @returns Decrypted Stripe secret key
   * @throws Error if decrypted value is not a valid Stripe key
   */
  decryptStripeSecret(encrypted: EncryptedData): string {
    const decrypted = this.decrypt(encrypted);

    if (!this.isValidStripeSecretKey(decrypted)) {
      throw new Error('Decrypted value is not a valid Stripe secret key. Data may be corrupted.');
    }

    return decrypted;
  }

  /**
   * Validate Stripe secret key format
   *
   * @param key - String to validate
   * @returns true if valid Stripe secret key format
   */
  private isValidStripeSecretKey(key: string): boolean {
    return /^sk_(test|live)_[a-zA-Z0-9]{24,}$/.test(key);
  }

  /**
   * Encrypt any JSON-serializable object
   * Useful for storing structured secrets (e.g., multiple API keys)
   *
   * @param data - Object to encrypt
   * @returns Encrypted data
   */
  encryptObject<T>(data: T): EncryptedData {
    const json = JSON.stringify(data);
    return this.encrypt(json);
  }

  /**
   * Decrypt JSON object
   *
   * @param encrypted - Encrypted data
   * @returns Decrypted and parsed object
   * @throws Error if JSON parsing fails
   */
  decryptObject<T>(encrypted: EncryptedData): T {
    const json = this.decrypt(encrypted);
    try {
      return JSON.parse(json) as T;
    } catch (error) {
      throw new Error('Failed to parse decrypted data as JSON. Data may be corrupted.');
    }
  }

  /**
   * Compare plaintext with encrypted data (constant-time)
   * Useful for password verification without decrypting
   *
   * @param plaintext - Plaintext to compare
   * @param encrypted - Encrypted data to compare against
   * @returns true if plaintext matches encrypted data
   */
  verify(plaintext: string, encrypted: EncryptedData): boolean {
    try {
      const decrypted = this.decrypt(encrypted);

      // Constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(Buffer.from(plaintext, 'utf8'), Buffer.from(decrypted, 'utf8'));
    } catch (error) {
      return false;
    }
  }
}

/**
 * Encrypted data structure
 * All fields are hex-encoded strings for easy JSON serialization
 */
export interface EncryptedData {
  /** Encrypted data (hex-encoded) */
  ciphertext: string;
  /** Initialization vector (hex-encoded) */
  iv: string;
  /** Authentication tag for AES-GCM (hex-encoded) */
  authTag: string;
}

/**
 * Singleton instance
 * Initialized once with environment variable
 */
export const encryptionService = new EncryptionService();
