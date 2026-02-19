/**
 * Tenant Repository Port — Tenant data access for multi-tenant operations
 */

/**
 * Tenant entity for repository operations
 * Subset of Prisma Tenant model for port interface
 */
export interface TenantEntity {
  id: string;
  slug: string;
  name: string;
  apiKeyPublic: string;
  stripeAccountId: string | null;
  stripeOnboarded: boolean;
  commissionPercent: number;
  depositPercent: number | null;
  balanceDueDays: number | null;
  isActive: boolean;
}

/**
 * Tenant Repository Port
 *
 * Core interface for tenant data access. Used by:
 * - CheckoutSessionFactory (findById for Stripe routing)
 * - WeddingDepositService (findById for deposit config)
 * - CommissionService (findById for commission rates)
 *
 * SECURITY: All methods enforce tenant isolation internally.
 *
 * @example
 * ```typescript
 * // In services
 * constructor(private readonly tenantRepo: ITenantRepository) {}
 *
 * // Usage
 * const tenant = await this.tenantRepo.findById(tenantId);
 * ```
 */
export interface ITenantRepository {
  /**
   * Find tenant by ID
   * @param id - Tenant CUID
   * @returns Tenant or null if not found
   */
  findById(id: string): Promise<TenantEntity | null>;

  /**
   * Find tenant by slug
   * @param slug - URL-safe tenant identifier
   * @returns Tenant or null if not found
   */
  findBySlug(slug: string): Promise<TenantEntity | null>;

  /**
   * Find tenant by public API key
   * @param apiKey - Public API key (pk_live_*)
   * @returns Tenant or null if not found
   */
  findByApiKey(apiKey: string): Promise<TenantEntity | null>;
}
