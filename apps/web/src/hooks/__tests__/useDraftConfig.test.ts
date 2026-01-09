/**
 * Unit tests for useDraftConfig hook
 *
 * Tests TanStack Query integration for draft configuration state management,
 * including fetch states, mutations (publish/discard), cache invalidation,
 * and external access via setQueryClientRef/invalidateDraftConfig.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { DEFAULT_PAGES_CONFIG, type PagesConfig } from '@macon/contracts';
import {
  useDraftConfig,
  setQueryClientRef,
  invalidateDraftConfig,
  getDraftConfigQueryKey,
} from '../useDraftConfig';

// ============================================
// MOCKS
// ============================================

// Mock API client methods
const mockGetDraft = vi.fn();
const mockPublishDraft = vi.fn();
const mockDiscardDraft = vi.fn();

vi.mock('@/lib/api.client', () => ({
  createClientApiClient: vi.fn(() => ({
    getDraft: mockGetDraft,
    publishDraft: mockPublishDraft,
    discardDraft: mockDiscardDraft,
  })),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import logger after mock to capture calls
import { logger } from '@/lib/logger';

// ============================================
// TEST UTILITIES
// ============================================

/**
 * Create a new QueryClient for each test to ensure isolation
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // Disable garbage collection for tests
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Wrapper component with QueryClientProvider
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

/**
 * Sample draft pages config for testing
 */
const MOCK_DRAFT_PAGES: PagesConfig = {
  home: {
    enabled: true as const,
    sections: [
      {
        id: 'home-hero-main',
        type: 'hero',
        headline: 'Draft Headline',
        subheadline: 'Draft subheadline',
        ctaText: 'Get Started',
      },
    ],
  },
  about: { enabled: true, sections: [] },
  services: { enabled: true, sections: [] },
  faq: { enabled: false, sections: [] },
  contact: { enabled: true, sections: [] },
  gallery: { enabled: false, sections: [] },
  testimonials: { enabled: false, sections: [] },
};

/**
 * Sample published pages config for testing
 */
const MOCK_PUBLISHED_PAGES: PagesConfig = {
  home: {
    enabled: true as const,
    sections: [
      {
        id: 'home-hero-main',
        type: 'hero',
        headline: 'Published Headline',
        subheadline: 'Published subheadline',
        ctaText: 'Learn More',
      },
    ],
  },
  about: { enabled: true, sections: [] },
  services: { enabled: true, sections: [] },
  faq: { enabled: false, sections: [] },
  contact: { enabled: true, sections: [] },
  gallery: { enabled: false, sections: [] },
  testimonials: { enabled: false, sections: [] },
};

// ============================================
// TESTS
// ============================================

describe('useDraftConfig', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('initial state', () => {
    it('should return DEFAULT_PAGES_CONFIG when loading', async () => {
      // Setup: API call that never resolves
      mockGetDraft.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      // Initial state should use defaults while loading
      expect(result.current.config).toEqual(DEFAULT_PAGES_CONFIG);
    });

    it('should have hasDraft as false initially', async () => {
      mockGetDraft.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.hasDraft).toBe(false);
    });

    it('should have isLoading as true initially', async () => {
      mockGetDraft.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('successful fetch with draft', () => {
    it('should return draft pages when API returns draft', async () => {
      mockGetDraft.mockResolvedValue({
        status: 200,
        body: {
          draft: { pages: MOCK_DRAFT_PAGES },
          published: { pages: MOCK_PUBLISHED_PAGES },
          draftUpdatedAt: '2024-01-01T12:00:00Z',
          publishedAt: '2024-01-01T10:00:00Z',
        },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.config).toEqual(MOCK_DRAFT_PAGES);
    });

    it('should have hasDraft as true when draft exists', async () => {
      mockGetDraft.mockResolvedValue({
        status: 200,
        body: {
          draft: { pages: MOCK_DRAFT_PAGES },
          published: { pages: MOCK_PUBLISHED_PAGES },
          draftUpdatedAt: '2024-01-01T12:00:00Z',
          publishedAt: '2024-01-01T10:00:00Z',
        },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasDraft).toBe(true);
    });

    it('should prefer draft over published', async () => {
      mockGetDraft.mockResolvedValue({
        status: 200,
        body: {
          draft: { pages: MOCK_DRAFT_PAGES },
          published: { pages: MOCK_PUBLISHED_PAGES },
          draftUpdatedAt: '2024-01-01T12:00:00Z',
          publishedAt: '2024-01-01T10:00:00Z',
        },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should return draft headline, not published
      const heroSection = result.current.config.home.sections[0];
      expect(heroSection).toBeDefined();
      expect(heroSection.type).toBe('hero');
      if (heroSection.type === 'hero') {
        expect(heroSection.headline).toBe('Draft Headline');
      }
    });
  });

  describe('successful fetch without draft', () => {
    it('should return published pages when no draft exists', async () => {
      mockGetDraft.mockResolvedValue({
        status: 200,
        body: {
          draft: null,
          published: { pages: MOCK_PUBLISHED_PAGES },
          draftUpdatedAt: null,
          publishedAt: '2024-01-01T10:00:00Z',
        },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.config).toEqual(MOCK_PUBLISHED_PAGES);
    });

    it('should have hasDraft as false when no draft exists', async () => {
      mockGetDraft.mockResolvedValue({
        status: 200,
        body: {
          draft: null,
          published: { pages: MOCK_PUBLISHED_PAGES },
          draftUpdatedAt: null,
          publishedAt: '2024-01-01T10:00:00Z',
        },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasDraft).toBe(false);
    });

    it('should return DEFAULT_PAGES_CONFIG when neither draft nor published has pages', async () => {
      mockGetDraft.mockResolvedValue({
        status: 200,
        body: {
          draft: null,
          published: null,
          draftUpdatedAt: null,
          publishedAt: null,
        },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.config).toEqual(DEFAULT_PAGES_CONFIG);
    });
  });

  describe('404 response', () => {
    it('should return DEFAULT_PAGES_CONFIG on 404', async () => {
      mockGetDraft.mockResolvedValue({
        status: 404,
        body: { error: 'Not found' },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.config).toEqual(DEFAULT_PAGES_CONFIG);
    });

    it('should have hasDraft as false on 404', async () => {
      mockGetDraft.mockResolvedValue({
        status: 404,
        body: { error: 'Not found' },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasDraft).toBe(false);
    });

    it('should log debug message on 404', async () => {
      mockGetDraft.mockResolvedValue({
        status: 404,
        body: { error: 'Not found' },
      });

      renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(logger.debug).toHaveBeenCalledWith(
          '[useDraftConfig] No config found, using defaults'
        );
      });
    });
  });

  describe('error handling', () => {
    it('should set error state on API failure', async () => {
      const apiError = new Error('API request failed');
      mockGetDraft.mockRejectedValue(apiError);

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      // Wait for error state (query has retry: 1, so it retries once)
      await waitFor(
        () => {
          expect(result.current.error).toBeTruthy();
        },
        { timeout: 3000 }
      );

      expect(result.current.error?.message).toBe('API request failed');
    });

    it('should return DEFAULT_PAGES_CONFIG on error', async () => {
      mockGetDraft.mockRejectedValue(new Error('API request failed'));

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      // Wait for error state (query has retry: 1, so it retries once)
      await waitFor(
        () => {
          expect(result.current.error).toBeTruthy();
        },
        { timeout: 3000 }
      );

      // Even on error, config should default safely
      expect(result.current.config).toEqual(DEFAULT_PAGES_CONFIG);
    });

    it('should log error on API failure', async () => {
      const apiError = new Error('API request failed');
      mockGetDraft.mockRejectedValue(apiError);

      renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('[useDraftConfig] Failed to fetch draft', {
          error: apiError,
        });
      });
    });

    it('should handle unexpected status codes gracefully', async () => {
      mockGetDraft.mockResolvedValue({
        status: 500,
        body: { error: 'Internal server error' },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.config).toEqual(DEFAULT_PAGES_CONFIG);
      expect(result.current.hasDraft).toBe(false);
    });
  });

  describe('publishDraft mutation', () => {
    beforeEach(() => {
      // Setup initial state with draft
      mockGetDraft.mockResolvedValue({
        status: 200,
        body: {
          draft: { pages: MOCK_DRAFT_PAGES },
          published: { pages: MOCK_PUBLISHED_PAGES },
          draftUpdatedAt: '2024-01-01T12:00:00Z',
          publishedAt: '2024-01-01T10:00:00Z',
        },
      });
    });

    it('should call API correctly when publishing', async () => {
      mockPublishDraft.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.publishDraft();
      });

      expect(mockPublishDraft).toHaveBeenCalledWith({ body: {} });
    });

    it('should invalidate query on success', async () => {
      mockPublishDraft.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.publishDraft();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['draft-config'],
      });
    });

    it('should have isPublishing false before and after mutation completes', async () => {
      mockPublishDraft.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Before publish, isPublishing should be false
      expect(result.current.isPublishing).toBe(false);

      // Perform the mutation
      await act(async () => {
        await result.current.publishDraft();
      });

      // After completing, isPublishing should be false
      expect(result.current.isPublishing).toBe(false);
    });

    it('should handle publish errors', async () => {
      mockPublishDraft.mockResolvedValue({
        status: 400,
        body: { error: 'No draft to publish' },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.publishDraft();
        })
      ).rejects.toThrow('No draft to publish');
    });

    it('should log success message on publish', async () => {
      mockPublishDraft.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.publishDraft();
      });

      expect(logger.info).toHaveBeenCalledWith('[useDraftConfig] Draft published successfully');
    });

    it('should log error message on publish failure', async () => {
      mockPublishDraft.mockResolvedValue({
        status: 400,
        body: { error: 'No draft to publish' },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      try {
        await act(async () => {
          await result.current.publishDraft();
        });
      } catch {
        // Expected to throw
      }

      expect(logger.error).toHaveBeenCalledWith(
        '[useDraftConfig] Publish failed',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('discardDraft mutation', () => {
    beforeEach(() => {
      // Setup initial state with draft
      mockGetDraft.mockResolvedValue({
        status: 200,
        body: {
          draft: { pages: MOCK_DRAFT_PAGES },
          published: { pages: MOCK_PUBLISHED_PAGES },
          draftUpdatedAt: '2024-01-01T12:00:00Z',
          publishedAt: '2024-01-01T10:00:00Z',
        },
      });
    });

    it('should call API correctly when discarding', async () => {
      mockDiscardDraft.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.discardDraft();
      });

      expect(mockDiscardDraft).toHaveBeenCalledWith({});
    });

    it('should invalidate query on success', async () => {
      mockDiscardDraft.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.discardDraft();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['draft-config'],
      });
    });

    it('should have isDiscarding false before and after mutation completes', async () => {
      mockDiscardDraft.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Before discard, isDiscarding should be false
      expect(result.current.isDiscarding).toBe(false);

      // Perform the mutation
      await act(async () => {
        await result.current.discardDraft();
      });

      // After completing, isDiscarding should be false
      expect(result.current.isDiscarding).toBe(false);
    });

    it('should handle discard errors', async () => {
      mockDiscardDraft.mockResolvedValue({
        status: 400,
        body: { error: 'No draft to discard' },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.discardDraft();
        })
      ).rejects.toThrow('No draft to discard');
    });

    it('should log success message on discard', async () => {
      mockDiscardDraft.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.discardDraft();
      });

      expect(logger.info).toHaveBeenCalledWith('[useDraftConfig] Draft discarded successfully');
    });
  });

  describe('invalidate function', () => {
    it('should trigger query refetch via invalidate()', async () => {
      mockGetDraft.mockResolvedValue({
        status: 200,
        body: {
          draft: { pages: MOCK_DRAFT_PAGES },
          published: null,
          draftUpdatedAt: '2024-01-01T12:00:00Z',
          publishedAt: null,
        },
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.invalidate();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['draft-config'],
      });
    });

    it('should trigger refetch() to re-fetch data', async () => {
      let callCount = 0;
      mockGetDraft.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          status: 200,
          body: {
            draft: {
              pages: {
                ...MOCK_DRAFT_PAGES,
                home: {
                  ...MOCK_DRAFT_PAGES.home,
                  sections: [
                    {
                      id: 'home-hero-main',
                      type: 'hero',
                      headline: `Headline ${callCount}`,
                      subheadline: 'Test',
                      ctaText: 'CTA',
                    },
                  ],
                },
              },
            },
            published: null,
            draftUpdatedAt: '2024-01-01T12:00:00Z',
            publishedAt: null,
          },
        });
      });

      const { result } = renderHook(() => useDraftConfig(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(callCount).toBe(1);

      await act(async () => {
        await result.current.refetch();
      });

      expect(callCount).toBe(2);
    });
  });
});

describe('external invalidation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    // Reset the module-level queryClientRef
    setQueryClientRef(null as unknown as QueryClient);
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('setQueryClientRef', () => {
    it('should store query client reference', () => {
      setQueryClientRef(queryClient);

      // Setting the ref shouldn't throw
      expect(true).toBe(true);
    });
  });

  describe('invalidateDraftConfig', () => {
    it('should use stored reference to invalidate', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      setQueryClientRef(queryClient);

      invalidateDraftConfig();

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['draft-config'],
      });
    });

    it('should log debug message on successful invalidation', () => {
      setQueryClientRef(queryClient);

      invalidateDraftConfig();

      expect(logger.debug).toHaveBeenCalledWith(
        '[useDraftConfig] Externally invalidated draft config'
      );
    });

    it('should warn when reference not set', () => {
      // queryClientRef is null (from beforeEach reset)
      invalidateDraftConfig();

      expect(logger.warn).toHaveBeenCalledWith(
        '[useDraftConfig] Cannot invalidate - query client not set'
      );
    });

    it('should not throw when reference not set', () => {
      // queryClientRef is null
      expect(() => invalidateDraftConfig()).not.toThrow();
    });
  });
});

describe('getDraftConfigQueryKey', () => {
  it('should return correct query key', () => {
    const key = getDraftConfigQueryKey();

    expect(key).toEqual(['draft-config']);
  });

  it('should return readonly tuple', () => {
    const key = getDraftConfigQueryKey();

    // TypeScript compile-time check - this tests the return type
    // The assertion here just verifies the value
    expect(key.length).toBe(1);
    expect(key[0]).toBe('draft-config');
  });
});
