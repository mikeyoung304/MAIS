/**
 * Tenant Default Configuration
 *
 * Shared constants for tenant provisioning and onboarding.
 * Used to ensure consistency when creating new tenants.
 *
 * @see TenantProvisioningService - Atomic tenant creation
 * @see TenantOnboardingService - Post-signup default data
 */

/**
 * Default segment configuration for new tenants
 * Every tenant starts with a "General" segment to organize their packages
 */
export const DEFAULT_SEGMENT = {
  name: 'General',
  slug: 'general',
  heroTitle: 'Our Services',
  description: 'Your main service offerings',
} as const;

/**
 * Default pricing tier configurations
 * Guides users toward a 3-tier pricing structure (Good/Better/Best pattern)
 *
 * All prices start at 0 - tenants customize their own pricing
 */
export const DEFAULT_PACKAGE_TIERS = {
  BASIC: {
    slug: 'basic-package',
    name: 'Basic Package',
    description: 'Your starter option - perfect for budget-conscious clients',
    basePrice: 0,
    groupingOrder: 1,
  },
  STANDARD: {
    slug: 'standard-package',
    name: 'Standard Package',
    description: 'Our most popular option - great value for most clients',
    basePrice: 0,
    groupingOrder: 2,
  },
  PREMIUM: {
    slug: 'premium-package',
    name: 'Premium Package',
    description: 'The full experience - for clients who want the best',
    basePrice: 0,
    groupingOrder: 3,
  },
} as const;

/** Type for accessing package tier keys */
export type PackageTierKey = keyof typeof DEFAULT_PACKAGE_TIERS;

/** Type for a single package tier configuration */
export type PackageTierConfig = (typeof DEFAULT_PACKAGE_TIERS)[PackageTierKey];
