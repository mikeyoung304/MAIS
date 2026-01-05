/**
 * Tenant Info Utility
 *
 * Shared utility for fetching tenant information needed for URL building
 * and timezone operations. Extracted to avoid duplication between tools
 * and executors.
 *
 * @see booking-link-tools.ts - Uses this for URL previews
 * @see booking-link-executors.ts - Uses this for URL building after execution
 */

import type { PrismaClient } from '../../generated/prisma';

/**
 * Tenant info result with optional fields based on query options
 */
export interface TenantInfo {
  slug: string;
  customDomain?: string;
  timezone?: string;
}

/**
 * Options for getTenantInfo query
 */
export interface GetTenantInfoOptions {
  /** Include timezone in the result (default: false) */
  includeTimezone?: boolean;
}

/**
 * Get tenant info for URL building and other operations.
 *
 * Fetches the tenant's slug and optionally their verified primary custom domain
 * and timezone. Used by both agent tools (for previews) and executors (for
 * final URL generation).
 *
 * @param prisma - Prisma client instance
 * @param tenantId - The tenant ID to look up
 * @param options - Query options (e.g., includeTimezone)
 * @returns Tenant info or null if tenant not found
 *
 * @example
 * // Basic usage (URL building only)
 * const info = await getTenantInfo(prisma, tenantId);
 * const url = buildBookingUrl(info.slug, serviceSlug, info.customDomain);
 *
 * @example
 * // With timezone (for availability display)
 * const info = await getTenantInfo(prisma, tenantId, { includeTimezone: true });
 * console.log(`Times shown in ${info.timezone}`);
 */
export async function getTenantInfo(
  prisma: PrismaClient,
  tenantId: string,
  options?: GetTenantInfoOptions
): Promise<TenantInfo | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      slug: true,
      timezone: true, // Phase 1: Now stored in database
      domains: {
        where: { verified: true, isPrimary: true },
        select: { domain: true },
        take: 1,
      },
    },
  });

  if (!tenant) return null;

  // Build result object
  const result: TenantInfo = {
    slug: tenant.slug,
    customDomain: tenant.domains[0]?.domain,
  };

  // Add timezone if requested (Phase 1: Now fetched from tenant record)
  if (options?.includeTimezone) {
    result.timezone = tenant.timezone;
  }

  return result;
}
