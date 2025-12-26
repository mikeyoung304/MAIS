/**
 * Tenant Admin Controller
 * Handles tenant-scoped admin operations for packages, blackouts, bookings, and branding
 *
 * SECURITY: All methods receive tenantId from JWT token, not from request body
 * Multi-tenant isolation enforced at service layer
 */

import type { CatalogService } from '../services/catalog.service';
import type { BookingService } from '../services/booking.service';
import type { BlackoutRepository } from '../lib/ports';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type {
  CreatePackageInput,
  UpdatePackageInput,
  CreateBlackoutInput,
  BookingQueryParams,
  UpdateBrandingInput,
} from '../validation/tenant-admin.schemas';
import { NotFoundError } from '../lib/errors';

/**
 * Package response DTO
 */
interface PackageDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  photoUrl?: string;
}

/**
 * Booking response DTO with filtering
 */
interface BookingDto {
  id: string;
  packageId: string;
  coupleName: string;
  email: string;
  phone?: string;
  eventDate: string;
  addOnIds: string[];
  totalCents: number;
  status: string;
  createdAt: string;
}

/**
 * Blackout response DTO
 */
interface _BlackoutDto {
  id: string;
  date: string;
  reason?: string;
}

/**
 * Branding DTO
 */
interface BrandingDto {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  logo?: string;
}

export class TenantAdminController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly bookingService: BookingService,
    private readonly blackoutRepo: BlackoutRepository,
    private readonly tenantRepo: PrismaTenantRepository
  ) {}

  // ============================================================================
  // Package Management
  // ============================================================================

  /**
   * Get all packages for tenant
   * @param tenantId - Tenant ID from JWT token
   */
  async getPackages(tenantId: string): Promise<PackageDto[]> {
    const packages = await this.catalogService.getAllPackages(tenantId);
    return packages.map((pkg) => ({
      id: pkg.id,
      slug: pkg.slug,
      title: pkg.title,
      description: pkg.description,
      priceCents: pkg.priceCents,
      photoUrl: pkg.photoUrl,
    }));
  }

  /**
   * Create new package for tenant
   * @param tenantId - Tenant ID from JWT token
   * @param data - Package creation data
   */
  async createPackage(tenantId: string, data: CreatePackageInput): Promise<PackageDto> {
    const pkg = await this.catalogService.createPackage(tenantId, data);
    return {
      id: pkg.id,
      slug: pkg.slug,
      title: pkg.title,
      description: pkg.description,
      priceCents: pkg.priceCents,
      photoUrl: pkg.photoUrl,
    };
  }

  /**
   * Update package (verifies ownership)
   * @param tenantId - Tenant ID from JWT token
   * @param id - Package ID
   * @param data - Package update data
   */
  async updatePackage(tenantId: string, id: string, data: UpdatePackageInput): Promise<PackageDto> {
    // Service layer will verify ownership and throw NotFoundError if not owned by tenant
    const pkg = await this.catalogService.updatePackage(tenantId, id, data);
    return {
      id: pkg.id,
      slug: pkg.slug,
      title: pkg.title,
      description: pkg.description,
      priceCents: pkg.priceCents,
      photoUrl: pkg.photoUrl,
    };
  }

  /**
   * Delete package (verifies ownership)
   * @param tenantId - Tenant ID from JWT token
   * @param id - Package ID
   */
  async deletePackage(tenantId: string, id: string): Promise<void> {
    // Service layer will verify ownership and throw NotFoundError if not owned by tenant
    await this.catalogService.deletePackage(tenantId, id);
  }

  // ============================================================================
  // Blackout Management
  // ============================================================================

  /**
   * Get all blackout dates for tenant
   * @param tenantId - Tenant ID from JWT token
   */
  async getBlackouts(
    tenantId: string
  ): Promise<Array<{ id: string; date: string; reason?: string }>> {
    const _blackouts = await this.blackoutRepo.getAllBlackouts(tenantId);

    // Need to fetch full records with IDs
    // This is a workaround since getAllBlackouts doesn't return IDs
    // In production, we'd update the repository method
    const prisma = (this.blackoutRepo as any).prisma;
    const fullBlackouts = await prisma.blackoutDate.findMany({
      where: { tenantId },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        reason: true,
      },
    });

    return fullBlackouts.map((b: any) => ({
      id: b.id,
      date: b.date.toISOString().split('T')[0],
      ...(b.reason && { reason: b.reason }),
    }));
  }

  /**
   * Create blackout date for tenant
   * @param tenantId - Tenant ID from JWT token
   * @param data - Blackout creation data
   */
  async createBlackout(tenantId: string, data: CreateBlackoutInput): Promise<{ ok: true }> {
    await this.blackoutRepo.addBlackout(tenantId, data.date, data.reason);
    return { ok: true };
  }

  /**
   * Delete blackout date (verifies ownership)
   * @param tenantId - Tenant ID from JWT token
   * @param id - Blackout ID
   */
  async deleteBlackout(tenantId: string, id: string): Promise<void> {
    // Verify blackout belongs to tenant
    const blackout = await this.blackoutRepo.findBlackoutById(tenantId, id);
    if (!blackout) {
      throw new NotFoundError(`Blackout date not found`);
    }

    await this.blackoutRepo.deleteBlackout(tenantId, id);
  }

  // ============================================================================
  // Booking Management (Read-Only)
  // ============================================================================

  /**
   * Get all bookings for tenant with optional filtering
   * @param tenantId - Tenant ID from JWT token
   * @param query - Query parameters for filtering
   */
  async getBookings(tenantId: string, query: BookingQueryParams = {}): Promise<BookingDto[]> {
    let bookings = await this.bookingService.getAllBookings(tenantId);

    // Apply filters
    if (query.status) {
      bookings = bookings.filter((b) => b.status === query.status);
    }

    if (query.startDate) {
      bookings = bookings.filter((b) => b.eventDate >= query.startDate!);
    }

    if (query.endDate) {
      bookings = bookings.filter((b) => b.eventDate <= query.endDate!);
    }

    // Map to DTO
    return bookings.map((booking) => ({
      id: booking.id,
      packageId: booking.packageId,
      coupleName: booking.coupleName,
      email: booking.email,
      phone: booking.phone,
      eventDate: booking.eventDate,
      addOnIds: booking.addOnIds,
      totalCents: booking.totalCents,
      status: booking.status,
      createdAt: booking.createdAt,
    }));
  }

  // ============================================================================
  // Branding Management
  // ============================================================================

  /**
   * Get tenant branding configuration
   * @param tenantId - Tenant ID from JWT token
   */
  async getBranding(tenantId: string): Promise<BrandingDto> {
    const tenant = await this.tenantRepo.findById(tenantId);

    if (!tenant) {
      throw new NotFoundError(`Tenant not found`);
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

  /**
   * Update tenant branding configuration
   * @param tenantId - Tenant ID from JWT token
   * @param data - Branding update data
   */
  async updateBranding(tenantId: string, data: UpdateBrandingInput): Promise<BrandingDto> {
    const tenant = await this.tenantRepo.findById(tenantId);

    if (!tenant) {
      throw new NotFoundError(`Tenant not found`);
    }

    // Separate color fields from other branding fields
    const {
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
      fontFamily,
      ...otherBranding
    } = data;

    // Update color fields at database column level
    const colorUpdates: any = {};
    if (primaryColor !== undefined) colorUpdates.primaryColor = primaryColor;
    if (secondaryColor !== undefined) colorUpdates.secondaryColor = secondaryColor;
    if (accentColor !== undefined) colorUpdates.accentColor = accentColor;
    if (backgroundColor !== undefined) colorUpdates.backgroundColor = backgroundColor;

    // Update non-color fields in branding JSON
    const currentBranding = (tenant.branding as any) || {};
    const updatedBrandingJson = {
      ...currentBranding,
      ...(fontFamily !== undefined && { fontFamily }),
      ...otherBranding,
    };

    // Apply both updates
    await this.tenantRepo.update(tenantId, {
      ...colorUpdates,
      branding: updatedBrandingJson,
    });

    // Return updated branding
    const updatedTenant = await this.tenantRepo.findById(tenantId);
    const finalBranding = (updatedTenant!.branding as any) || {};

    return {
      primaryColor: updatedTenant!.primaryColor,
      secondaryColor: updatedTenant!.secondaryColor,
      accentColor: updatedTenant!.accentColor,
      backgroundColor: updatedTenant!.backgroundColor,
      fontFamily: finalBranding.fontFamily,
      logo: finalBranding.logo,
    };
  }
}
