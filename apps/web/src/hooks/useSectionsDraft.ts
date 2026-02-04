/**
 * useSectionsDraft - TanStack Query hook for section-based draft data
 *
 * Phase 5.2 Migration: This hook fetches draft sections from the new
 * /v1/tenant-admin/sections/draft endpoint which reads from the
 * SectionContent table instead of the legacy landingPageConfig JSON.
 *
 * Key features:
 * - Fetches sections directly from SectionContent table
 * - Transforms section data to PagesConfig format for backward compatibility
 * - Provides section-level access for auto-scroll functionality
 * - Maintains the same interface as useDraftConfig for easy migration
 *
 * @see server/src/routes/tenant-admin.routes.ts - sections/draft endpoint
 * @see server/src/services/section-content.service.ts - data source
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_PAGES_CONFIG,
  type PagesConfig,
  type Section,
  SECTION_TYPES,
} from '@macon/contracts';
import { logger } from '@/lib/logger';
import { useMemo, useCallback } from 'react';
import { getQueryClient } from '@/lib/query-client';

// ============================================
// TYPES
// ============================================

/**
 * Section entity as returned from the API
 */
export interface SectionEntity {
  id: string;
  tenantId: string;
  segmentId: string | null;
  blockType: string;
  type: string; // Frontend-friendly lowercase type (hero, about, etc.)
  pageName: string;
  content: Record<string, unknown>;
  order: number;
  isDraft: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * API response from /v1/tenant-admin/sections/draft
 */
interface SectionsDraftResponse {
  success: boolean;
  hasDraft: boolean;
  draftUpdatedAt: string | null;
  sections: SectionEntity[];
}

/**
 * Draft configuration data structure (backward compatible with useDraftConfig)
 */
interface DraftConfigData {
  pages: PagesConfig;
  hasDraft: boolean;
  draftUpdatedAt?: string;
  version: number;
  /** Raw sections for direct access (scroll-to-section, etc.) */
  sections: SectionEntity[];
}

/**
 * Return type for useSectionsDraft hook
 */
export interface UseSectionsDraftResult {
  /** Current pages configuration (transformed from sections) */
  config: PagesConfig;
  /** Raw section entities for direct access */
  sections: SectionEntity[];
  /** Whether there's an unpublished draft */
  hasDraft: boolean;
  /** Optimistic locking version (always 0 for now - not per-section tracked) */
  version: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch draft config */
  refetch: () => Promise<void>;
  /** Publish all draft sections */
  publishDraft: () => Promise<void>;
  /** Discard all draft sections */
  discardDraft: () => Promise<void>;
  /** Whether publish is in progress */
  isPublishing: boolean;
  /** Whether discard is in progress */
  isDiscarding: boolean;
  /** Invalidate the cache (call after agent tools modify sections) */
  invalidate: () => void;
  /** Find a section by ID */
  findSectionById: (sectionId: string) => SectionEntity | undefined;
  /** Find sections by type (e.g., 'hero', 'about') */
  findSectionsByType: (type: string) => SectionEntity[];
}

// ============================================
// QUERY KEY
// ============================================

const SECTIONS_DRAFT_QUERY_KEY = ['sections-draft'] as const;

// ============================================
// TRANSFORMATION: Sections → PagesConfig
// ============================================

/**
 * Valid section types from contracts - used for runtime validation
 */
const VALID_SECTION_TYPES = new Set(SECTION_TYPES);

/**
 * Type guard to validate section type at runtime
 */
function isValidSectionType(type: string): type is Section['type'] {
  return VALID_SECTION_TYPES.has(type as Section['type']);
}

/**
 * Transform flat section entities into nested PagesConfig structure
 *
 * This maintains backward compatibility with components that expect
 * the legacy pages.home.sections[] format.
 *
 * Includes:
 * - Type validation: Skips sections with invalid types (logs warning)
 * - Error boundary: Returns default config on transformation failure
 */
function transformSectionsToPagesConfig(sections: SectionEntity[]): PagesConfig {
  try {
    // Start with defaults (all pages disabled except home)
    const pages: PagesConfig = {
      home: { enabled: true as const, sections: [] },
      about: { enabled: false, sections: [] },
      services: { enabled: false, sections: [] },
      faq: { enabled: false, sections: [] },
      contact: { enabled: false, sections: [] },
      gallery: { enabled: false, sections: [] },
      testimonials: { enabled: false, sections: [] },
    };

    // Group sections by page and sort by order
    const sectionsByPage = new Map<string, SectionEntity[]>();

    for (const section of sections) {
      // Validate section type before processing
      if (!isValidSectionType(section.type)) {
        logger.warn('[useSectionsDraft] Skipping section with invalid type', {
          sectionId: section.id,
          invalidType: section.type,
          validTypes: Array.from(VALID_SECTION_TYPES),
        });
        continue;
      }

      const pageName = section.pageName || 'home';
      const existing = sectionsByPage.get(pageName) || [];
      existing.push(section);
      sectionsByPage.set(pageName, existing);
    }

    // Transform each page's sections
    for (const [pageName, pageSections] of sectionsByPage) {
      // Sort by order
      pageSections.sort((a, b) => a.order - b.order);

      // Transform to Section format (type already validated above)
      const transformedSections: Section[] = pageSections.map((section) => ({
        id: section.id,
        type: section.type as Section['type'],
        ...section.content,
      })) as Section[];

      // Update the page in config
      if (pageName in pages) {
        const pageKey = pageName as keyof PagesConfig;
        if (pageKey === 'home') {
          pages.home = {
            enabled: true as const,
            sections: transformedSections,
          };
        } else {
          pages[pageKey] = {
            enabled: transformedSections.length > 0,
            sections: transformedSections,
          };
        }
      }
    }

    return pages;
  } catch (error) {
    // Error boundary: Log and return defaults instead of crashing
    logger.error('[useSectionsDraft] Transformation failed, using defaults', {
      error: error instanceof Error ? error.message : String(error),
      sectionCount: sections.length,
    });
    return DEFAULT_PAGES_CONFIG;
  }
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useSectionsDraft(): UseSectionsDraftResult {
  const queryClient = useQueryClient();

  // Fetch draft sections from new endpoint
  const query = useQuery({
    queryKey: SECTIONS_DRAFT_QUERY_KEY,
    queryFn: async (): Promise<DraftConfigData> => {
      logger.debug('[useSectionsDraft] Fetching draft sections');

      try {
        // Call the new sections/draft endpoint
        const response = await fetch('/api/tenant-admin/sections/draft', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 200) {
          const body: SectionsDraftResponse = await response.json();

          // Transform sections to PagesConfig format
          const pages = transformSectionsToPagesConfig(body.sections);

          return {
            pages,
            hasDraft: body.hasDraft,
            draftUpdatedAt: body.draftUpdatedAt ?? undefined,
            version: 0, // Not tracked per-section yet
            sections: body.sections,
          };
        }

        // 404 means no sections yet - use defaults
        if (response.status === 404) {
          logger.debug('[useSectionsDraft] No sections found, using defaults');
          return {
            pages: DEFAULT_PAGES_CONFIG,
            hasDraft: false,
            version: 0,
            sections: [],
          };
        }

        // Auth errors - throw to show error state
        if (response.status === 401 || response.status === 403) {
          logger.error('[useSectionsDraft] Authentication error', { status: response.status });
          throw new Error('Session expired. Please refresh the page to log in again.');
        }

        // Service unavailable (503) - endpoint not wired up
        if (response.status === 503) {
          logger.error('[useSectionsDraft] Service unavailable', { status: response.status });
          throw new Error('Section content service not available. Please try again later.');
        }

        // Server errors - throw to show error state
        if (response.status >= 500) {
          logger.error('[useSectionsDraft] Server error', { status: response.status });
          throw new Error(`Server error (${response.status}). Please try again later.`);
        }

        // Other unexpected errors
        logger.warn('[useSectionsDraft] Unexpected response status', { status: response.status });
        throw new Error(`Failed to load draft sections (${response.status})`);
      } catch (error) {
        logger.error('[useSectionsDraft] Failed to fetch draft sections', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }
    },
    staleTime: 0, // Real-time updates: agent tools modify sections, refetch immediately
    gcTime: 5 * 60_000, // 5 minutes garbage collection
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    retry: 1, // Only retry once
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      logger.info('[useSectionsDraft] Publishing all sections');
      const response = await fetch('/api/tenant-admin/sections/publish', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmed: true }),
      });

      const body = await response.json();

      if (response.status !== 200 || !body.success) {
        throw new Error(body.error || body.message || 'Failed to publish sections');
      }

      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: SECTIONS_DRAFT_QUERY_KEY,
        refetchType: 'active',
      });
      logger.info('[useSectionsDraft] All sections published successfully');
    },
    onError: (error) => {
      logger.error('[useSectionsDraft] Publish failed', { error });
    },
  });

  // Discard mutation
  const discardMutation = useMutation({
    mutationFn: async () => {
      logger.info('[useSectionsDraft] Discarding all draft sections');
      const response = await fetch('/api/tenant-admin/sections/discard', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmed: true }),
      });

      const body = await response.json();

      if (response.status !== 200 || !body.success) {
        throw new Error(body.error || body.message || 'Failed to discard sections');
      }

      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: SECTIONS_DRAFT_QUERY_KEY,
        refetchType: 'active',
      });
      logger.info('[useSectionsDraft] All draft sections discarded successfully');
    },
    onError: (error) => {
      logger.error('[useSectionsDraft] Discard failed', { error });
    },
  });

  // Invalidate cache (for external callers like agent tool handlers)
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: SECTIONS_DRAFT_QUERY_KEY });
  }, [queryClient]);

  // Refetch wrapper
  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  // Publish wrapper
  const publishDraft = useCallback(async () => {
    await publishMutation.mutateAsync();
  }, [publishMutation]);

  // Discard wrapper
  const discardDraft = useCallback(async () => {
    await discardMutation.mutateAsync();
  }, [discardMutation]);

  // Section lookup helpers
  const sections = useMemo(() => query.data?.sections ?? [], [query.data?.sections]);

  const findSectionById = useCallback(
    (sectionId: string) => sections.find((s) => s.id === sectionId),
    [sections]
  );

  const findSectionsByType = useCallback(
    (type: string) => sections.filter((s) => s.type === type.toLowerCase()),
    [sections]
  );

  return {
    config: query.data?.pages ?? DEFAULT_PAGES_CONFIG,
    sections,
    hasDraft: query.data?.hasDraft ?? false,
    version: query.data?.version ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
    publishDraft,
    discardDraft,
    isPublishing: publishMutation.isPending,
    isDiscarding: discardMutation.isPending,
    invalidate,
    findSectionById,
    findSectionsByType,
  };
}

// ============================================
// EXTERNAL ACCESS FOR AGENT TOOLS
// ============================================

/**
 * Invalidate sections draft from outside React
 * Call this after agent tools modify sections
 *
 * Uses the browser-singleton QueryClient from lib/query-client.ts
 * This approach is HMR-safe and SSR-safe.
 *
 * @example
 * // In agent response handler:
 * if (response.toolResults?.some(t => t.toolName.includes('section'))) {
 *   invalidateSectionsDraft();
 * }
 */
export const invalidateSectionsDraft = (): void => {
  // Only run in browser (not during SSR)
  if (typeof window === 'undefined') {
    logger.debug('[useSectionsDraft] Skipping invalidation during SSR');
    return;
  }

  const queryClient = getQueryClient();
  queryClient.invalidateQueries({
    queryKey: SECTIONS_DRAFT_QUERY_KEY,
    refetchType: 'active',
  });
  logger.debug('[useSectionsDraft] Externally invalidated sections draft');
};

/**
 * @deprecated Use invalidateSectionsDraft() instead.
 * This no-op function is kept for backward compatibility during migration.
 */
export const setSectionsQueryClientRef = (_client: unknown): void => {
  // No-op: Now using getQueryClient() singleton instead
};

/**
 * Get the query key for sections draft
 * Useful for components that need to interact with the cache directly
 */
export const getSectionsDraftQueryKey = (): readonly ['sections-draft'] => {
  return SECTIONS_DRAFT_QUERY_KEY;
};
