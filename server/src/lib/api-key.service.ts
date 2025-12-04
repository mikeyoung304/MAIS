import crypto from 'node:crypto';

/**
 * Service for generating and validating tenant API keys
 *
 * API Key Format:
 * - Public keys: pk_live_{tenant_slug}_{random_16_chars}
 * - Secret keys: sk_live_{tenant_slug}_{random_32_chars}
 *
 * Public keys:
 * - Safe to embed in client-side JavaScript/HTML
 * - Used to identify tenant in widget embedding
 * - Read-only access to catalog, availability, booking creation
 *
 * Secret keys:
 * - Server-side only, NEVER expose to client
 * - Used for admin operations (create packages, manage settings)
 * - Stored as SHA-256 hash in database
 *
 * @example
 * // Generate keys for new tenant
 * const publicKey = apiKeyService.generatePublicKey('bellaweddings');
 * // Returns: "pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
 *
 * const secretKey = apiKeyService.generateSecretKey('bellaweddings');
 * // Returns: "sk_live_bellaweddings_a3f8c9d2e1b4f7g8h9i0j1k2l3m4n5o6"
 *
 * // Store hashed secret key
 * const hash = apiKeyService.hashSecretKey(secretKey);
 * // Save hash to database
 *
 * // Verify secret key
 * const isValid = apiKeyService.verifySecretKey(secretKey, hash);
 * // Returns: true
 */
export class ApiKeyService {
  private readonly publicKeyPrefix = 'pk_live_';
  private readonly secretKeyPrefix = 'sk_live_';
  private readonly publicKeyRandomLength = 16; // 16 hex chars (8 bytes)
  private readonly secretKeyRandomLength = 32; // 32 hex chars (16 bytes)

  /**
   * Generate public API key for tenant
   * Format: pk_live_{tenant_slug}_{random_16_chars}
   *
   * @param tenantSlug - URL-safe tenant identifier (lowercase, alphanumeric, hyphens)
   * @returns Public API key safe for client-side use
   * @throws Error if tenant slug is invalid
   *
   * @example
   * generatePublicKey('bellaweddings')
   * // Returns: "pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
   */
  generatePublicKey(tenantSlug: string): string {
    this.validateTenantSlug(tenantSlug);

    const random = crypto.randomBytes(this.publicKeyRandomLength / 2).toString('hex');

    return `${this.publicKeyPrefix}${tenantSlug}_${random}`;
  }

  /**
   * Generate secret API key for tenant (admin operations)
   * Format: sk_live_{tenant_slug}_{random_32_chars}
   *
   * SECURITY: This key allows admin operations. Store hashed in database.
   *
   * @param tenantSlug - URL-safe tenant identifier
   * @returns Secret API key (must be stored securely)
   * @throws Error if tenant slug is invalid
   *
   * @example
   * generateSecretKey('bellaweddings')
   * // Returns: "sk_live_bellaweddings_a3f8c9d2e1b4f7g8h9i0j1k2l3m4n5o6"
   */
  generateSecretKey(tenantSlug: string): string {
    this.validateTenantSlug(tenantSlug);

    const random = crypto.randomBytes(this.secretKeyRandomLength / 2).toString('hex');

    return `${this.secretKeyPrefix}${tenantSlug}_${random}`;
  }

  /**
   * Extract tenant slug from API key
   *
   * @param apiKey - Public or secret API key
   * @returns Tenant slug or null if invalid format
   *
   * @example
   * extractTenantSlug('pk_live_bellaweddings_a3f8c9d2e1b4f7g8')
   * // Returns: 'bellaweddings'
   */
  extractTenantSlug(apiKey: string): string | null {
    const publicMatch = apiKey.match(/^pk_live_([a-z0-9-]+)_[a-f0-9]{16}$/);
    if (publicMatch) return publicMatch[1];

    const secretMatch = apiKey.match(/^sk_live_([a-z0-9-]+)_[a-f0-9]{32}$/);
    if (secretMatch) return secretMatch[1];

    return null;
  }

  /**
   * Validate public API key format (does NOT check database)
   * Only validates syntax, not whether key exists or is active
   *
   * @param apiKey - API key to validate
   * @returns true if format is valid
   *
   * @example
   * isValidPublicKeyFormat('pk_live_bellaweddings_a3f8c9d2e1b4f7g8')
   * // Returns: true
   */
  isValidPublicKeyFormat(apiKey: string): boolean {
    return /^pk_live_[a-z0-9-]+_[a-f0-9]{16}$/.test(apiKey);
  }

  /**
   * Validate secret API key format (does NOT check database)
   *
   * @param apiKey - API key to validate
   * @returns true if format is valid
   */
  isValidSecretKeyFormat(apiKey: string): boolean {
    return /^sk_live_[a-z0-9-]+_[a-f0-9]{32}$/.test(apiKey);
  }

  /**
   * Hash secret key for database storage
   * Uses SHA-256 (secret keys are high-entropy, no salt needed)
   *
   * SECURITY: Always store hashed version, never plaintext
   *
   * @param secretKey - Secret API key to hash
   * @returns SHA-256 hash (hex-encoded)
   * @throws Error if secret key format is invalid
   *
   * @example
   * const hash = hashSecretKey('sk_live_bellaweddings_abc123...');
   * // Save hash to database: tenant.apiKeySecret = hash
   */
  hashSecretKey(secretKey: string): string {
    if (!this.isValidSecretKeyFormat(secretKey)) {
      throw new Error('Invalid secret key format');
    }

    return crypto.createHash('sha256').update(secretKey).digest('hex');
  }

  /**
   * Verify secret key against stored hash
   * Uses constant-time comparison to prevent timing attacks
   *
   * @param secretKey - Plaintext secret key to verify
   * @param hash - Stored hash from database
   * @returns true if secret key matches hash
   *
   * @example
   * const isValid = verifySecretKey(userProvidedKey, storedHash);
   * if (isValid) {
   *   // Allow admin operation
   * }
   */
  verifySecretKey(secretKey: string, hash: string): boolean {
    if (!this.isValidSecretKeyFormat(secretKey)) {
      return false;
    }

    const inputHash = this.hashSecretKey(secretKey);

    // Constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(hash, 'hex'));
    } catch (error) {
      // Hashes are different lengths (invalid)
      return false;
    }
  }

  /**
   * Validate tenant slug format
   * Rules:
   * - 3-50 characters
   * - Lowercase letters, numbers, hyphens only
   * - Must start with letter
   * - Cannot end with hyphen
   *
   * @param slug - Tenant slug to validate
   * @throws Error if slug is invalid
   */
  private validateTenantSlug(slug: string): void {
    if (!slug || typeof slug !== 'string') {
      throw new Error('Tenant slug is required');
    }

    if (slug.length < 3 || slug.length > 50) {
      throw new Error('Tenant slug must be 3-50 characters');
    }

    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      throw new Error(
        'Tenant slug must start with letter, contain only lowercase letters, ' +
          'numbers, and hyphens, and cannot end with hyphen'
      );
    }

    // Prevent reserved slugs
    const reserved = [
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

    if (reserved.includes(slug)) {
      throw new Error(`Tenant slug "${slug}" is reserved`);
    }
  }

  /**
   * Generate test API key pair for development/testing
   * Returns both public and secret keys
   *
   * @param tenantSlug - Tenant identifier
   * @returns Object with publicKey, secretKey, and secretKeyHash
   *
   * @example
   * const keys = generateKeyPair('testbusiness');
   * // Use keys.publicKey in client code
   * // Store keys.secretKeyHash in database
   * // Give keys.secretKey to tenant (show once, then discard)
   */
  generateKeyPair(tenantSlug: string): {
    publicKey: string;
    secretKey: string;
    secretKeyHash: string;
  } {
    const publicKey = this.generatePublicKey(tenantSlug);
    const secretKey = this.generateSecretKey(tenantSlug);
    const secretKeyHash = this.hashSecretKey(secretKey);

    return {
      publicKey,
      secretKey,
      secretKeyHash,
    };
  }
}

/**
 * Singleton instance
 */
export const apiKeyService = new ApiKeyService();
