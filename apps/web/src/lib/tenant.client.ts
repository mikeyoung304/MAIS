/**
 * Tenant Client-Safe Utilities
 *
 * This file contains only client-safe exports from the tenant module.
 * Use this in client components ('use client') to avoid importing
 * server-only code that uses API_URL or React's cache().
 *
 * For server components and API routes, import from '@/lib/tenant' instead.
 */

import type { PageName, PagesConfig, Section, SegmentDto, TenantPublicDto } from '@macon/contracts';

// Re-export types that are safe for client use
export type { TenantPublicDto, PageName, PagesConfig, Section };

/**
 * Custom error for tenant not found
 */
export class TenantNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Tenant not found: ${identifier}`);
    this.name = 'TenantNotFoundError';
  }
}

/**
 * Custom error for API failures
 */
export class TenantApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'TenantApiError';
  }
}

/**
 * Custom error for invalid domain format
 */
export class InvalidDomainError extends Error {
  constructor(reason: string) {
    super(`Invalid domain: ${reason}`);
    this.name = 'InvalidDomainError';
  }
}

/**
 * Domain validation pattern
 *
 * Matches valid domain names with:
 * - Alphanumeric first character
 * - Alphanumeric characters and hyphens in labels
 * - TLD of 2+ characters
 * - Supports subdomains
 */
const DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)*\.[a-zA-Z]{2,}$/;

/**
 * Validate and sanitize domain parameter
 *
 * Validates domain format for security and returns sanitized value.
 * Use this before calling getTenantByDomain to provide clear error messages.
 *
 * @param domain - Domain string to validate
 * @returns Sanitized domain string (lowercase, trimmed)
 * @throws InvalidDomainError if domain is invalid
 *
 * @example
 * const domain = validateDomain(searchParams.domain);
 * const tenant = await getTenantByDomain(domain);
 */
export function validateDomain(domain: string | undefined): string {
  if (!domain || typeof domain !== 'string') {
    throw new InvalidDomainError('Domain parameter is required');
  }

  const sanitized = domain.trim().toLowerCase();

  if (sanitized.length === 0) {
    throw new InvalidDomainError('Domain cannot be empty');
  }

  if (sanitized.length > 253) {
    throw new InvalidDomainError('Domain too long (max 253 characters)');
  }

  if (!DOMAIN_PATTERN.test(sanitized)) {
    throw new InvalidDomainError('Invalid domain format');
  }

  return sanitized;
}

/**
 * Type for tier data (bookable pricing offering)
 * Note: Backend returns `isActive`, frontend uses `active` as alias
 */
export interface TierData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  priceCents: number;
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'CUSTOM';
  active?: boolean; // Legacy field
  isActive?: boolean; // New field from backend
  segmentId: string | null;
  bookingType?: 'DATE' | 'APPOINTMENT';
  photoUrl?: string | null;
  addOns?: Array<{
    id: string;
    title: string;
    description: string | null;
    priceCents: number;
  }>;
  // Per-person scaling pricing
  maxGuests?: number | null;
  displayPriceCents?: number | null;
  scalingRules?: {
    components: Array<{
      name: string;
      includedGuests: number;
      perPersonCents: number;
      maxGuests?: number;
    }>;
  } | null;
}

/**
 * Segment data as returned by the API
 * Includes hero information for storefront display
 *
 * Aliased from @macon/contracts SegmentDto for backward compatibility
 */
export type SegmentData = SegmentDto;

/**
 * Type for the complete tenant storefront data
 * Combines tenant info, tiers, and segments
 */
export interface TenantStorefrontData {
  tenant: TenantPublicDto;
  tiers: TierData[];
  segments: SegmentData[];
}

// ============================================================================
// CLIENT-SAFE API FUNCTIONS
// ============================================================================
// These functions are designed for use in 'use client' components.
// They use NEXT_PUBLIC_API_URL directly instead of importing from config.ts
// to avoid pulling server-only modules into the client bundle.

/**
 * Get the API URL for client-side calls
 * Uses NEXT_PUBLIC_API_URL which is available in both server and client contexts
 */
function getClientApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

/**
 * Fetch unavailable dates for booking (client-safe version)
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Array of unavailable date strings
 */
export async function getUnavailableDates(
  apiKeyPublic: string,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const url = `${getClientApiUrl()}/v1/availability/unavailable?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    // Note: No 'next' options since this is client-safe
  });

  if (!response.ok) {
    // Return empty array on error - booking flow can still continue
    // and will validate date on submit
    return [];
  }

  const data = await response.json();
  return data.dates || [];
}

/**
 * Check availability for a specific date (client-safe version)
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param date - Date in YYYY-MM-DD format
 * @returns Whether the date is available
 */
export async function checkDateAvailability(apiKeyPublic: string, date: string): Promise<boolean> {
  const url = `${getClientApiUrl()}/v1/availability?date=${encodeURIComponent(date)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    cache: 'no-store', // Always check fresh availability
  });

  if (!response.ok) {
    // Fail closed - if we can't verify, assume unavailable
    return false;
  }

  const data = await response.json();
  return data.available === true;
}

/**
 * Create a date booking and get checkout URL (client-safe version)
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param bookingData - Booking details
 * @returns Checkout URL or error
 */
export async function createDateBooking(
  apiKeyPublic: string,
  bookingData: {
    tierId: string;
    date: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    notes?: string;
    guestCount?: number;
  }
): Promise<{ checkoutUrl: string } | { error: string; status: number }> {
  const url = `${getClientApiUrl()}/v1/public/bookings/date`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    body: JSON.stringify(bookingData),
    cache: 'no-store',
  });

  const data = await response.json();

  if (response.status === 409) {
    return { error: 'Date is already booked', status: 409 };
  }

  if (!response.ok) {
    return { error: data.error || 'Failed to create booking', status: response.status };
  }

  return { checkoutUrl: data.checkoutUrl };
}
