/**
 * Sections API Client
 *
 * Typed fetch functions for section content operations.
 * Used by storefront pages and Build Mode for section CRUD.
 *
 * SERVER COMPONENTS: Use the cached functions (getPublishedSections, etc.)
 * CLIENT COMPONENTS: Use the non-cached versions or React Query hooks
 *
 * @see server/src/services/section-content.service.ts
 * @see docs/plans/2026-02-02-refactor-section-content-migration-plan.md Phase 4
 */

import { cache } from 'react';
import type {
  SectionContentDto,
  SectionsListResponse,
  PageStructureResponse,
  SectionContentResponse,
} from '@macon/contracts';
import { API_URL } from '@/lib/config';

// ============================================================================
// Error Classes
// ============================================================================

export class SectionsNotFoundError extends Error {
  constructor(public readonly slug: string) {
    super(`No sections found for tenant: ${slug}`);
    this.name = 'SectionsNotFoundError';
  }
}

export class SectionsApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'SectionsApiError';
  }
}

// ============================================================================
// Server-Side Functions (with React cache)
// ============================================================================

/**
 * Fetch published sections for a tenant's public storefront.
 *
 * Used by /t/[slug] page for SSR rendering.
 * Wrapped with React's cache() to deduplicate calls within the same request.
 *
 * @param slug - Tenant slug (e.g., "jane-photography")
 * @returns Array of published SectionContentDto
 * @throws SectionsNotFoundError if tenant doesn't exist
 * @throws SectionsApiError for other API failures
 */
export const getPublishedSections = cache(async (slug: string): Promise<SectionContentDto[]> => {
  const url = `${API_URL}/v1/public/tenants/${encodeURIComponent(slug)}/sections`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    // ISR: Revalidate every 60 seconds
    next: { revalidate: 60 },
  });

  if (response.status === 404) {
    throw new SectionsNotFoundError(slug);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new SectionsApiError(`Failed to fetch sections: ${errorBody}`, response.status);
  }

  const data: SectionsListResponse = await response.json();
  return data.sections;
});

/**
 * Fetch preview sections (drafts) for a tenant.
 *
 * Used by preview mode with token authentication.
 * No caching - drafts should always be fresh.
 *
 * @param slug - Tenant slug
 * @param token - Preview authentication token
 * @returns Array of SectionContentDto (drafts take priority)
 */
export const getPreviewSections = cache(
  async (slug: string, token: string): Promise<SectionContentDto[]> => {
    const url = `${API_URL}/v1/public/tenants/${encodeURIComponent(slug)}/sections/preview?token=${encodeURIComponent(token)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      // No caching for preview
      cache: 'no-store',
    });

    if (response.status === 401) {
      throw new SectionsApiError('Invalid or expired preview token', 401);
    }

    if (response.status === 404) {
      throw new SectionsNotFoundError(slug);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new SectionsApiError(`Failed to fetch preview sections: ${errorBody}`, response.status);
    }

    const data: SectionsListResponse = await response.json();
    return data.sections;
  }
);

// ============================================================================
// Client-Side Functions (for React Query or direct use)
// ============================================================================

/**
 * Fetch page structure with section summaries.
 * For Build Mode to understand what sections exist without full content.
 *
 * @param tenantId - Tenant ID (not slug - for authenticated routes)
 * @param authToken - JWT auth token
 */
export async function fetchPageStructure(
  tenantId: string,
  authToken: string
): Promise<PageStructureResponse> {
  const url = `${API_URL}/internal/agent/storefront/structure`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ tenantId }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new SectionsApiError(`Failed to fetch page structure: ${errorBody}`, response.status);
  }

  return response.json();
}

/**
 * Fetch full content for a specific section.
 *
 * @param tenantId - Tenant ID
 * @param sectionId - Section ID
 * @param authToken - JWT auth token
 */
export async function fetchSectionContent(
  tenantId: string,
  sectionId: string,
  authToken: string
): Promise<SectionContentResponse> {
  const url = `${API_URL}/internal/agent/storefront/section`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ tenantId, sectionId }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new SectionsApiError(`Failed to fetch section content: ${errorBody}`, response.status);
  }

  return response.json();
}

/**
 * Update section content (creates draft).
 *
 * Server expects a flat payload: { tenantId, sectionId, headline?, subheadline?, content?, ... }
 * Updates are spread flat — NOT nested under an "updates" key.
 *
 * @param tenantId - Tenant ID
 * @param sectionId - Section ID
 * @param updates - Partial content updates (headline, subheadline, content, ctaText, backgroundImageUrl, imageUrl)
 * @param authToken - JWT auth token
 */
export async function updateSection(
  tenantId: string,
  sectionId: string,
  updates: Record<string, unknown>,
  authToken: string
): Promise<{ success: boolean; message: string; hasDraft: boolean }> {
  const url = `${API_URL}/internal/agent/storefront/update-section`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ tenantId, sectionId, ...updates }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new SectionsApiError(`Failed to update section: ${errorBody}`, response.status);
  }

  return response.json();
}

/**
 * Publish a single section.
 *
 * @param tenantId - Tenant ID
 * @param sectionId - Section ID to publish
 * @param authToken - JWT auth token
 */
export async function publishSection(
  tenantId: string,
  sectionId: string,
  authToken: string
): Promise<{ success: boolean; message: string; hasDraft: boolean; publishedAt?: string }> {
  const url = `${API_URL}/internal/agent/storefront/publish-section`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ tenantId, sectionId, confirmationReceived: true }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new SectionsApiError(`Failed to publish section: ${errorBody}`, response.status);
  }

  return response.json();
}

/**
 * Discard changes to a single section.
 *
 * @param tenantId - Tenant ID
 * @param sectionId - Section ID to discard
 * @param authToken - JWT auth token
 */
export async function discardSection(
  tenantId: string,
  sectionId: string,
  authToken: string
): Promise<{ success: boolean; message: string; hasDraft: boolean }> {
  const url = `${API_URL}/internal/agent/storefront/discard-section`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ tenantId, sectionId, confirmationReceived: true }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new SectionsApiError(`Failed to discard section: ${errorBody}`, response.status);
  }

  return response.json();
}

/**
 * Publish all draft sections.
 *
 * @param tenantId - Tenant ID
 * @param authToken - JWT auth token
 */
export async function publishAllSections(
  tenantId: string,
  authToken: string
): Promise<{ success: boolean; message: string; hasDraft: boolean; publishedCount?: number }> {
  const url = `${API_URL}/internal/agent/storefront/publish`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ tenantId, confirmationReceived: true }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new SectionsApiError(`Failed to publish all sections: ${errorBody}`, response.status);
  }

  return response.json();
}

/**
 * Discard all draft sections.
 *
 * @param tenantId - Tenant ID
 * @param authToken - JWT auth token
 */
export async function discardAllSections(
  tenantId: string,
  authToken: string
): Promise<{ success: boolean; message: string; hasDraft: boolean; discardedCount?: number }> {
  const url = `${API_URL}/internal/agent/storefront/discard`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ tenantId, confirmationReceived: true }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new SectionsApiError(`Failed to discard all sections: ${errorBody}`, response.status);
  }

  return response.json();
}
