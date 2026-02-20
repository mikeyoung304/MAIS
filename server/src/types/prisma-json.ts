/**
 * Type definitions for Prisma JSON fields
 *
 * Prisma stores JSON columns as JsonValue type which requires casting to structured types.
 * This file provides proper TypeScript types for all JSON fields in the schema.
 *
 * Usage:
 * ```typescript
 * import type { BrandingConfig, PackagePhoto } from '../types/prisma-json';
 *
 * // Instead of: const branding = tenant.branding as any;
 * const branding = tenant.branding as BrandingConfig | null;
 * ```
 */

/**
 * Branding configuration stored in Tenant.branding JSON field
 *
 * Used by:
 * - Tenant model (branding column)
 * - Branding API endpoints
 * - Widget customization
 */
export interface BrandingConfig {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logo?: string;
}

/**
 * Package photo metadata stored in Package.photos JSON array
 *
 * Used by:
 * - Package model (photos column)
 * - Photo upload endpoints
 * - Package display in catalog
 *
 * @property url - Public URL to the uploaded photo
 * @property filename - Original filename
 * @property size - File size in bytes
 * @property order - Display order (0-indexed)
 */
export interface PackagePhoto {
  url: string;
  filename: string;
  size: number;
  order: number;
}

/**
 * Audit log metadata stored in ConfigChangeLog.metadata JSON field
 *
 * Used by:
 * - ConfigChangeLog model (metadata column)
 * - Audit logging service
 * - Compliance reporting
 *
 * Contains contextual information about the change event:
 * - IP address, user agent (for manual changes)
 * - Automation metadata (for scheduled/automated changes)
 * - Batch operation tracking
 */
export interface AuditMetadata {
  /** Client IP address (for manual changes) */
  ip?: string;

  /** User agent string (for manual changes) */
  userAgent?: string;

  /** Type of automation (e.g., 'scheduled', 'integration', 'batch') */
  automationType?: string;

  /** Schedule ID (for scheduled changes) */
  scheduleId?: string;

  /** Timestamp when automation was triggered */
  triggeredAt?: string;

  /** Batch operation ID (for bulk changes) */
  batchId?: string;

  /** Additional custom metadata */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Add-on IDs stored in Booking.addOnIds JSON array
 *
 * Used by:
 * - Booking model (addOnIds column)
 * - Booking creation/update
 * - Price calculation
 */
export type BookingAddOnIds = string[];

/**
 * Encrypted data structure (from encryption service)
 */
export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * Google Calendar OAuth token set stored encrypted in TenantSecrets.googleCalendar
 *
 * The entire token object is JSON-serialized then encrypted with EncryptionService
 * before being stored in the Tenant.secrets JSON column.
 *
 * @property accessToken  - Short-lived OAuth 2.0 access token
 * @property refreshToken - Long-lived refresh token (never expires unless revoked)
 * @property expiresAt    - Unix timestamp in ms when accessToken expires
 * @property scope        - Space-separated OAuth scopes granted
 * @property tokenType    - Always "Bearer" for Google OAuth 2.0
 */
export interface GoogleCalendarOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
  scope: string;
  tokenType: string;
}

/**
 * Encrypted secrets stored in Tenant.secrets JSON field
 *
 * Used by:
 * - Tenant model (secrets column)
 * - Stripe Connect integration
 * - Google Calendar OAuth integration
 * - Encrypted API keys and credentials
 *
 * @property stripe         - Encrypted Stripe restricted key
 * @property googleCalendar - Encrypted GoogleCalendarOAuthTokens JSON blob
 */
export interface TenantSecrets {
  stripe?: EncryptedData;
  googleCalendar?: EncryptedData;
  [key: string]: EncryptedData | undefined;
}

/**
 * Type helper for Prisma JSON fields
 *
 * Prisma represents JSON columns as `JsonValue | null`, so we wrap our
 * structured types with this helper to indicate they can be null.
 *
 * Usage:
 * ```typescript
 * function getBranding(tenant: Tenant): BrandingConfig {
 *   const branding: PrismaJson<BrandingConfig> = tenant.branding;
 *   return branding ?? {}; // Provide default if null
 * }
 * ```
 */
export type PrismaJson<T> = T | null;
