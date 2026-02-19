/**
 * Tenant API Service
 *
 * SSR-safe functions for fetching tenant data from the Express API.
 * These functions are for SERVER COMPONENTS ONLY.
 *
 * For client components, import from '@/lib/tenant.client' instead.
 * This prevents Turbopack HMR issues with the API_URL import.
 */

import { cache } from 'react';
import type { TenantPublicDto } from '@macon/contracts';
import { API_URL } from '@/lib/config';

// Import error classes and types for local use
import {
  TenantNotFoundError,
  TenantApiError,
  type TierData,
  type TenantStorefrontData,
} from './tenant.client';

// Re-export client-safe utilities for server component convenience
// Client components should import directly from '@/lib/tenant.client'
export {
  validateDomain,
  TenantNotFoundError,
  TenantApiError,
  InvalidDomainError,
  type TierData,
  type SegmentData,
  type TenantStorefrontData,
} from './tenant.client';

/**
 * Fetch tenant public data by slug
 *
 * Used by /t/[slug] routes for tenant landing pages.
 * SSR-safe - works on server and client.
 * Wrapped with React's cache() to deduplicate calls within the same request.
 *
 * @param slug - Tenant slug (e.g., "jane-photography")
 * @returns TenantPublicDto with branding and landing page config
 * @throws TenantNotFoundError if tenant doesn't exist
 * @throws TenantApiError for other API failures
 */
export const getTenantBySlug = cache(async (slug: string): Promise<TenantPublicDto> => {
  const url = `${API_URL}/v1/public/tenants/${encodeURIComponent(slug)}`;

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
    throw new TenantApiError(`Failed to fetch tenant: ${errorBody}`, response.status);
  }

  return response.json();
});

/**
 * Fetch tenant public data by custom domain
 *
 * Used by middleware rewrite for custom domain resolution.
 * Looks up tenant by their configured custom domain.
 * Wrapped with React's cache() to deduplicate calls within the same request.
 *
 * @param domain - Custom domain (e.g., "janephotography.com")
 * @returns TenantPublicDto with branding and landing page config
 * @throws TenantNotFoundError if no tenant has this domain
 * @throws TenantApiError for other API failures
 */
export const getTenantByDomain = cache(async (domain: string): Promise<TenantPublicDto> => {
  // TODO: Implement domain lookup endpoint in Express API
  // For now, we'll use a fallback approach - search by domain
  // The backend endpoint would be: GET /v1/public/tenants/by-domain/:domain
  const url = `${API_URL}/v1/public/tenants/by-domain/${encodeURIComponent(domain)}`;

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
    throw new TenantApiError(`Failed to fetch tenant by domain: ${errorBody}`, response.status);
  }

  return response.json();
});

/**
 * Fetch tenant tiers for storefront display
 *
 * Requires X-Tenant-Key header for multi-tenant context.
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param bypassCache - If true, skip ISR cache (for preview mode)
 * @returns Array of tier DTOs
 */
export async function getTenantTiers(apiKeyPublic: string, bypassCache = false) {
  const url = `${API_URL}/v1/tiers`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    // P0-FIX: Preview mode needs fresh data to show agent-created tiers immediately
    ...(bypassCache ? { cache: 'no-store' as const } : { next: { revalidate: 60 } }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new TenantApiError(`Failed to fetch tiers: ${errorBody}`, response.status);
  }

  // API returns paginated shape { items, total, hasMore } — unwrap to plain array
  const data = await response.json();
  return Array.isArray(data) ? data : (data?.items ?? []);
}

/**
 * Fetch tenant segments for storefront display
 *
 * Segments are customer types (e.g., "Families", "Corporate", "Personal").
 * Used for tier filtering on landing page.
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param bypassCache - If true, skip ISR cache (for preview mode)
 * @returns Array of segment DTOs
 */
export async function getTenantSegments(apiKeyPublic: string, bypassCache = false) {
  const url = `${API_URL}/v1/segments`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    // P0-FIX: Preview mode needs fresh data to show agent-created segments immediately
    ...(bypassCache ? { cache: 'no-store' as const } : { next: { revalidate: 60 } }),
  });

  if (!response.ok) {
    // Segments are optional, return empty array on failure
    return [];
  }

  // API returns paginated shape { items, total, hasMore } — unwrap to plain array
  const data = await response.json();
  return Array.isArray(data) ? data : (data?.items ?? []);
}

/**
 * Fetch all storefront data for a tenant in parallel
 *
 * Optimized for SSR - fetches tenant, tiers, and segments concurrently.
 * Wrapped with React's cache() to deduplicate calls within the same request.
 * This prevents duplicate API calls when both generateMetadata() and page
 * component call this function during the same render.
 *
 * @param slug - Tenant slug
 * @returns Complete storefront data
 */
export const getTenantStorefrontData = cache(
  async (slug: string): Promise<TenantStorefrontData> => {
    // First fetch tenant to get API key
    const tenant = await getTenantBySlug(slug);

    // Then fetch tiers and segments in parallel
    const [tiers, segments] = await Promise.all([
      getTenantTiers(tenant.apiKeyPublic),
      getTenantSegments(tenant.apiKeyPublic),
    ]);

    return { tenant, tiers, segments };
  }
);

/**
 * Fetch tenant data for preview mode (with draft config)
 *
 * Used when preview token is provided to fetch draft landing page config
 * instead of published config. This enables the preview panel to show
 * draft changes without flashing published content.
 *
 * SECURITY:
 * - Token is validated server-side before draft data is returned
 * - Token must match the tenant slug
 * - ISR cache is bypassed (no-store) to prevent cache poisoning
 *
 * @param slug - Tenant slug
 * @param previewToken - Valid preview JWT token
 * @returns Tenant public data with draft landing page config
 * @throws TenantApiError if token is invalid or expired
 */
export async function getTenantPreviewData(
  slug: string,
  previewToken: string
): Promise<TenantPublicDto> {
  const url = `${API_URL}/v1/public/tenants/${encodeURIComponent(slug)}/preview?token=${encodeURIComponent(previewToken)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    // CRITICAL: No caching for preview data to prevent ISR cache poisoning
    cache: 'no-store',
  });

  if (response.status === 401) {
    const body = await response.json();
    throw new TenantApiError(body.error || 'Invalid or expired preview token', 401);
  }

  if (response.status === 404) {
    throw new TenantNotFoundError(slug);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new TenantApiError(`Failed to fetch preview data: ${errorBody}`, response.status);
  }

  return response.json();
}

/**
 * Fetch storefront data with preview support
 *
 * If previewToken is provided, fetches draft content via preview endpoint.
 * Otherwise, fetches normal published content.
 *
 * This is the main entry point for page components that need to support
 * both preview mode and normal mode.
 *
 * @param slug - Tenant slug
 * @param previewToken - Optional preview token for draft mode
 * @returns Complete storefront data (with draft or published config)
 */
export async function getTenantStorefrontDataWithPreview(
  slug: string,
  previewToken?: string | null
): Promise<TenantStorefrontData> {
  if (previewToken) {
    // Preview mode: fetch draft data
    const tenant = await getTenantPreviewData(slug, previewToken);

    // P0-FIX: Bypass ISR cache in preview mode so agent-created tiers/segments appear immediately
    // Previously, this used cached functions which caused 60-second delays for showing new data.
    // See: MAIS Investigation Report - "Onboarding Service Updates Not Persisting"
    const [tiers, segments] = await Promise.all([
      getTenantTiers(tenant.apiKeyPublic, true), // bypassCache=true for preview
      getTenantSegments(tenant.apiKeyPublic, true), // bypassCache=true for preview
    ]);

    return { tenant, tiers, segments };
  }

  // Normal mode: use cached function
  return getTenantStorefrontData(slug);
}

/**
 * Fetch a single tier by slug
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param tierSlug - Tier slug
 * @returns Tier data or null if not found
 */
export async function getTenantTierBySlug(
  apiKeyPublic: string,
  tierSlug: string
): Promise<TierData | null> {
  const url = `${API_URL}/v1/tiers/${encodeURIComponent(tierSlug)}`;

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
    throw new TenantApiError(`Failed to fetch tier: ${errorBody}`, response.status);
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
  const url = `${API_URL}/v1/availability/unavailable?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

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
export async function checkDateAvailability(apiKeyPublic: string, date: string): Promise<boolean> {
  const url = `${API_URL}/v1/availability?date=${encodeURIComponent(date)}`;

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
    tierId: string;
    date: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    notes?: string;
  }
): Promise<{ checkoutUrl: string } | { error: string; status: number }> {
  const url = `${API_URL}/v1/public/bookings/date`;

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
 * Project data for customer view
 */
export interface ProjectViewData {
  project: {
    id: string;
    status: string;
    createdAt: string;
  };
  booking: {
    eventDate: string;
    serviceName: string;
    customerName: string;
  };
  pendingRequests: Array<{
    id: string;
    type: string;
    createdAt: string;
  }>;
  hasPendingRequests: boolean;
  tenant: {
    name: string;
    branding: Record<string, unknown> | null;
  };
}

/**
 * Fetch project details for customer view
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param projectId - Project ID
 * @param auth - Authentication: either email (legacy) or access token (preferred)
 * @returns Project view data or null if not found
 */
export async function getProjectById(
  apiKeyPublic: string,
  projectId: string,
  auth?: { email?: string; token?: string }
): Promise<ProjectViewData | null> {
  const params = new URLSearchParams();
  if (auth?.email) params.set('email', auth.email);
  if (auth?.token) params.set('token', auth.token);
  const queryString = params.toString();
  const url = `${API_URL}/v1/public/projects/${encodeURIComponent(projectId)}${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    cache: 'no-store', // Always fetch fresh project data
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response.json();
}

/**
 * Fetch project details for authenticated tenant view
 *
 * Used when a tenant is logged in and viewing their own project.
 * Requires backend authentication token from session.
 *
 * @param backendToken - JWT token from authenticated tenant session
 * @param projectId - Project ID
 * @returns Project view data or null if not found/not authorized
 */
export async function getProjectByIdForTenant(
  backendToken: string,
  projectId: string
): Promise<ProjectViewData | null> {
  const url = `${API_URL}/v1/tenant-admin/projects/${encodeURIComponent(projectId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${backendToken}`,
    },
    cache: 'no-store', // Always fetch fresh project data
  });

  if (response.status === 404 || response.status === 401) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  // The tenant-admin endpoint returns more detailed data
  // Map it to ProjectViewData format for consistency
  const data = await response.json();

  // The tenant-admin endpoint returns a different structure
  // Normalize to ProjectViewData format
  return {
    project: {
      id: data.id,
      status: data.status,
      createdAt: data.createdAt,
    },
    booking: {
      eventDate: data.booking?.date || data.booking?.startTime || data.createdAt,
      serviceName: data.booking?.tier?.name || 'Service',
      customerName: data.booking?.customer?.name || data.customerName || 'Customer',
    },
    pendingRequests: (data.requests || [])
      .filter((r: { status: string }) => r.status === 'PENDING')
      .map((r: { id: string; type: string; createdAt: string }) => ({
        id: r.id,
        type: r.type,
        createdAt: r.createdAt,
      })),
    hasPendingRequests: (data.requests || []).some(
      (r: { status: string }) => r.status === 'PENDING'
    ),
    tenant: {
      name: data.tenant?.name || '',
      branding: data.tenant?.branding || null,
    },
  };
}

/**
 * Project timeline event
 */
export interface ProjectTimelineEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/**
 * Fetch project timeline for customer view
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param projectId - Project ID
 * @param token - Access token for authentication
 * @returns Timeline events or empty array
 */
export async function getProjectTimeline(
  apiKeyPublic: string,
  projectId: string,
  token?: string
): Promise<ProjectTimelineEvent[]> {
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  const queryString = params.toString();
  const url = `${API_URL}/v1/public/projects/${encodeURIComponent(projectId)}/timeline${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.events || [];
}

/**
 * Fetch project ID by booking ID
 *
 * Used by success page to link customers to their Project Hub.
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param bookingId - Booking ID (from Stripe session metadata)
 * @returns Project data or null if not found
 */
export async function getProjectByBookingId(
  apiKeyPublic: string,
  bookingId: string
): Promise<{ projectId: string; status: string; createdAt: string; accessToken: string } | null> {
  const url = `${API_URL}/v1/public/projects/by-booking/${encodeURIComponent(bookingId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    cache: 'no-store', // Always fetch fresh - project may have just been created
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response.json();
}

/**
 * Fetch project ID by Stripe session ID
 *
 * Used by success page to link customers to their Project Hub.
 * Stripe redirects with session_id, not booking_id, so we need this lookup.
 * Chains: sessionId → Payment.processorId → Booking → Project
 *
 * @param apiKeyPublic - Tenant's public API key
 * @param sessionId - Stripe checkout session ID (cs_test_xxx or cs_live_xxx)
 * @returns Project data with access token, or null if not found (webhook pending)
 */
export async function getProjectBySessionId(
  apiKeyPublic: string,
  sessionId: string
): Promise<{ projectId: string; status: string; createdAt: string; accessToken: string } | null> {
  const url = `${API_URL}/v1/public/projects/by-session/${encodeURIComponent(sessionId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Tenant-Key': apiKeyPublic,
    },
    cache: 'no-store', // Always fetch fresh - webhook may have just processed
  });

  if (response.status === 404) {
    // Payment/project not found - webhook may still be processing
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response.json();
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
  tierId: string;
  addOnIds: string[];
  totalCents: number;
  status: string;
} | null> {
  const url = `${API_URL}/v1/bookings/${encodeURIComponent(bookingId)}`;

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
