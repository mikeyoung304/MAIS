/**
 * Tenant API Service
 *
 * SSR-safe functions for fetching tenant data from the Express API.
 * These functions work in both Server and Client components.
 */

import { TenantPublicDto } from '@macon/contracts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
 * Fetch tenant public data by slug
 *
 * Used by /t/[slug] routes for tenant landing pages.
 * SSR-safe - works on server and client.
 *
 * @param slug - Tenant slug (e.g., "jane-photography")
 * @returns TenantPublicDto with branding and landing page config
 * @throws TenantNotFoundError if tenant doesn't exist
 * @throws TenantApiError for other API failures
 */
export async function getTenantBySlug(slug: string): Promise<TenantPublicDto> {
  const url = `${API_BASE_URL}/v1/public/tenants/${encodeURIComponent(slug)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    // Revalidate every 60 seconds for ISR
    next: { revalidate: 60 },
  });

  if (response.status === 404) {
    throw new TenantNotFoundError(slug);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new TenantApiError(
      `Failed to fetch tenant: ${errorBody}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Fetch tenant public data by custom domain
 *
 * Used by middleware rewrite for custom domain resolution.
 * Looks up tenant by their configured custom domain.
 *
 * @param domain - Custom domain (e.g., "janephotography.com")
 * @returns TenantPublicDto with branding and landing page config
 * @throws TenantNotFoundError if no tenant has this domain
 * @throws TenantApiError for other API failures
 */
export async function getTenantByDomain(domain: string): Promise<TenantPublicDto> {
  // TODO: Implement domain lookup endpoint in Express API
  // For now, we'll use a fallback approach - search by domain
  // The backend endpoint would be: GET /v1/public/tenants/by-domain/:domain
  const url = `${API_BASE_URL}/v1/public/tenants/by-domain/${encodeURIComponent(domain)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    next: { revalidate: 60 },
  });

  if (response.status === 404) {
    throw new TenantNotFoundError(domain);
  }

  if (!response.ok) {
    // Fall back to default behavior if endpoint doesn't exist yet
    if (response.status === 501 || response.status === 405) {
      throw new TenantNotFoundError(domain);
    }
    const errorBody = await response.text();
    throw new TenantApiError(
      `Failed to fetch tenant by domain: ${errorBody}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Fetch tenant packages for storefront display
 *
 * Requires X-Tenant-Key header for multi-tenant context.
 *
 * @param apiKeyPublic - Tenant's public API key
 * @returns Array of package DTOs
 */
export async function getTenantPackages(apiKeyPublic: string) {
  const url = `${API_BASE_URL}/v1/packages`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new TenantApiError(
      `Failed to fetch packages: ${errorBody}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Fetch tenant segments for storefront display
 *
 * Segments are customer types (e.g., "Families", "Corporate", "Personal").
 * Used for tier/package filtering on landing page.
 *
 * @param apiKeyPublic - Tenant's public API key
 * @returns Array of segment DTOs
 */
export async function getTenantSegments(apiKeyPublic: string) {
  const url = `${API_BASE_URL}/v1/segments`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    // Segments are optional, return empty array on failure
    return [];
  }

  return response.json();
}

/**
 * Type for package data
 */
export interface PackageData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  priceCents: number;
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'CUSTOM';
  active: boolean;
  segmentId: string | null;
  bookingType?: 'DATE' | 'APPOINTMENT';
  photoUrl?: string | null;
  addOns?: Array<{
    id: string;
    title: string;
    description: string | null;
    priceCents: number;
  }>;
}

/**
 * Type for the complete tenant storefront data
 * Combines tenant info, packages, and segments
 */
export interface TenantStorefrontData {
  tenant: TenantPublicDto;
  packages: PackageData[];
  segments: Array<{
    id: string;
    name: string;
    description: string | null;
    displayOrder: number;
  }>;
}

/**
 * Fetch all storefront data for a tenant in parallel
 *
 * Optimized for SSR - fetches tenant, packages, and segments concurrently.
 *
 * @param slug - Tenant slug
 * @returns Complete storefront data
 */
export async function getTenantStorefrontData(slug: string): Promise<TenantStorefrontData> {
  // First fetch tenant to get API key
  const tenant = await getTenantBySlug(slug);

  // Then fetch packages and segments in parallel
  const [packages, segments] = await Promise.all([
    getTenantPackages(tenant.apiKeyPublic),
    getTenantSegments(tenant.apiKeyPublic),
  ]);

  return { tenant, packages, segments };
}

/**
 * Fetch a single package by slug
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param packageSlug - Package slug
 * @returns Package data or null if not found
 */
export async function getTenantPackageBySlug(
  apiKeyPublic: string,
  packageSlug: string
): Promise<PackageData | null> {
  const url = `${API_BASE_URL}/v1/packages/slug/${encodeURIComponent(packageSlug)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    next: { revalidate: 60 },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new TenantApiError(
      `Failed to fetch package: ${errorBody}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Fetch unavailable dates for booking
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
  const url = `${API_BASE_URL}/v1/availability/unavailable-dates?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    // Short cache since availability can change frequently
    next: { revalidate: 30 },
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
 * Check availability for a specific date
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param date - Date in YYYY-MM-DD format
 * @returns Whether the date is available
 */
export async function checkDateAvailability(
  apiKeyPublic: string,
  date: string
): Promise<boolean> {
  const url = `${API_BASE_URL}/v1/availability?date=${encodeURIComponent(date)}`;

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
 * Create a date booking and get checkout URL
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param bookingData - Booking details
 * @returns Checkout URL or error
 */
export async function createDateBooking(
  apiKeyPublic: string,
  bookingData: {
    packageId: string;
    date: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    notes?: string;
  }
): Promise<{ checkoutUrl: string } | { error: string; status: number }> {
  const url = `${API_BASE_URL}/v1/bookings/date`;

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

/**
 * Fetch booking details by ID
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param bookingId - Booking ID
 * @returns Booking data or null if not found
 */
export async function getBookingById(
  apiKeyPublic: string,
  bookingId: string
): Promise<{
  id: string;
  coupleName: string;
  email: string;
  eventDate: string;
  packageId: string;
  addOnIds: string[];
  totalCents: number;
  status: string;
} | null> {
  const url = `${API_BASE_URL}/v1/bookings/${encodeURIComponent(bookingId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response.json();
}
