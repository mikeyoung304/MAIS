/**
 * Shared type definitions for tenant admin pages
 *
 * This file consolidates duplicate Tenant interfaces that were previously
 * defined in multiple files (page.tsx, TenantsList.tsx, [id]/page.tsx, EditTenantForm.tsx).
 */

/**
 * Base Tenant type used in the tenants list view
 * Contains core fields needed for displaying tenant cards
 */
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  email: string;
  createdAt: string;
  stripeConnected: boolean;
  packageCount: number;
}

/**
 * Extended Tenant type used in the tenant detail/edit view
 * Includes additional fields for management and stats display
 */
export interface TenantDetail extends Tenant {
  apiKeyPublic: string;
  commissionPercent: number;
  isActive: boolean;
  bookingCount: number;
  updatedAt: string;
}

/**
 * Subset of TenantDetail fields needed for the edit form
 * Used to define the minimum props required by EditTenantForm
 */
export interface TenantEditFormData {
  id: string;
  slug: string;
  name: string;
  email: string;
  commissionPercent: number;
  isActive: boolean;
}
