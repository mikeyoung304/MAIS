/**
 * Tenant HTTP controller
 * Handles public tenant-specific endpoints (branding configuration)
 */

import type { TenantBrandingDto } from '@macon/contracts';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';

export class TenantController {
  constructor(private readonly tenantRepository: PrismaTenantRepository) {}

  /**
   * Get tenant branding configuration
   * Returns branding settings for widget customization
   *
   * @param tenantId - Tenant ID from middleware
   * @returns Branding configuration object
   */
  async getBranding(tenantId: string): Promise<TenantBrandingDto> {
    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Colors come from dedicated database columns
    // fontFamily and logo still come from branding JSON
    const branding = (tenant.branding as any) || {};

    return {
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      backgroundColor: tenant.backgroundColor,
      fontFamily: branding.fontFamily,
      logo: branding.logo,
    };
  }
}
