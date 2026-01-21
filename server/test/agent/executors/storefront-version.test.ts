/**
 * Unit tests for Storefront Optimistic Locking (#620)
 *
 * Tests the version checking functionality in storefront executors:
 * - Version increment on successful save
 * - CONCURRENT_MODIFICATION detection when version mismatch
 * - Version reset to 0 on publish/discard
 *
 * Uses mock Prisma client with $transaction support.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerStorefrontExecutors } from '../../../src/agent/executors/storefront-executors';
import {
  getProposalExecutor,
  registerProposalExecutor,
} from '../../../src/agent/proposals/executor-registry';
import { ValidationError, ConcurrentModificationError } from '../../../src/agent/errors';
import { DEFAULT_PAGES_CONFIG } from '@macon/contracts';

// Mock the logger
vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Type-safe mock function type
type MockFn = ReturnType<typeof vi.fn>;

// Type for proposal executor function
type ProposalExecutorFn = (
  tenantId: string,
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

// Mock the executor-registry to track registrations
const mockExecutors = new Map<string, ProposalExecutorFn>();

vi.mock('../../../src/agent/proposals/executor-registry', () => ({
  registerProposalExecutor: vi.fn((name: string, executor: ProposalExecutorFn) => {
    mockExecutors.set(name, executor);
  }),
  getProposalExecutor: vi.fn((name: string) => mockExecutors.get(name)),
}));

// Mock getDraftConfigWithSlug
vi.mock('../../../src/agent/tools/utils', () => ({
  getDraftConfigWithSlug: vi.fn(),
}));

// Mock advisory locks
vi.mock('../../../src/lib/advisory-locks', () => ({
  hashTenantStorefront: vi.fn().mockReturnValue(123456789),
}));

// Mock landing-page-utils
vi.mock('../../../src/lib/landing-page-utils', () => ({
  createPublishedWrapper: vi.fn((draft) => ({
    published: draft,
    publishedAt: new Date().toISOString(),
  })),
  countSectionsInConfig: vi.fn(() => ({ totalSections: 5, pageCount: 3 })),
}));

import { getDraftConfigWithSlug } from '../../../src/agent/tools/utils';

// Mock transaction type
type MockTransaction = {
  tenant: {
    findUnique: MockFn;
    update: MockFn;
    updateMany: MockFn;
  };
  $executeRaw: MockFn;
};

type MockPrismaClient = {
  tenant: {
    findUnique: MockFn;
    update: MockFn;
    updateMany: MockFn;
  };
  $transaction: MockFn;
};

describe('Storefront Version Checking (#620)', () => {
  let mockPrisma: MockPrismaClient;
  let mockTx: MockTransaction;
  const tenantId = 'tenant-test-123';

  beforeEach(() => {
    // Clear mock executor registry
    mockExecutors.clear();
    vi.clearAllMocks();

    // Setup transaction mock
    mockTx = {
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $executeRaw: vi.fn(), // For advisory locks
    };

    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (callback) => {
        return await callback(mockTx);
      }),
    };

    // Register executors
    registerStorefrontExecutors(
      mockPrisma as unknown as import('../../../src/generated/prisma/client').PrismaClient
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('update_page_section executor', () => {
    it('should increment version on successful save', async () => {
      // Setup: Mock getDraftConfigWithSlug to return version 5
      (getDraftConfigWithSlug as MockFn).mockResolvedValue({
        pages: structuredClone(DEFAULT_PAGES_CONFIG),
        hasDraft: false,
        slug: 'test-tenant',
        rawDraftConfig: null,
        rawLiveConfig: null,
        version: 5,
      });

      // Mock updateMany to return 1 row updated (version matched)
      mockTx.tenant.updateMany.mockResolvedValue({ count: 1 });

      const executor = getProposalExecutor('update_page_section');
      expect(executor).toBeDefined();

      const result = await executor!(tenantId, {
        pageName: 'home',
        sectionIndex: -1, // Append
        sectionData: {
          type: 'hero',
          id: 'home-hero-1',
          headline: 'Test Headline',
          subheadline: 'Test Subheadline',
        },
      });

      // Verify version was incremented
      expect(result.success).toBe(true);
      expect(result.version).toBe(6);

      // Verify updateMany was called with correct version in WHERE clause
      expect(mockTx.tenant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: tenantId,
            landingPageConfigDraftVersion: 5,
          }),
          data: expect.objectContaining({
            landingPageConfigDraftVersion: 6,
          }),
        })
      );
    });

    it('should throw ConcurrentModificationError when version mismatch', async () => {
      // Setup: Mock getDraftConfigWithSlug to return version 5
      (getDraftConfigWithSlug as MockFn).mockResolvedValue({
        pages: structuredClone(DEFAULT_PAGES_CONFIG),
        hasDraft: false,
        slug: 'test-tenant',
        rawDraftConfig: null,
        rawLiveConfig: null,
        version: 5,
      });

      // Mock updateMany to return 0 rows (version mismatch - another tab updated)
      mockTx.tenant.updateMany.mockResolvedValue({ count: 0 });

      // Mock findUnique to return current version (higher than expected)
      mockTx.tenant.findUnique.mockResolvedValue({
        landingPageConfigDraftVersion: 8,
      });

      const executor = getProposalExecutor('update_page_section');
      expect(executor).toBeDefined();

      // Should throw ConcurrentModificationError
      await expect(
        executor!(tenantId, {
          pageName: 'home',
          sectionIndex: -1,
          sectionData: {
            type: 'hero',
            id: 'home-hero-1',
            headline: 'Test Headline',
            subheadline: 'Test Subheadline',
          },
        })
      ).rejects.toThrow(ConcurrentModificationError);
    });
  });

  describe('publish_draft executor', () => {
    it('should reset version to 0 on publish', async () => {
      // Setup: Mock tenant with existing draft
      mockTx.tenant.findUnique.mockResolvedValue({
        landingPageConfigDraft: { pages: DEFAULT_PAGES_CONFIG },
        slug: 'test-tenant',
      });

      mockTx.tenant.update.mockResolvedValue({});

      const executor = getProposalExecutor('publish_draft');
      expect(executor).toBeDefined();

      const result = await executor!(tenantId, {});

      expect(result.success).toBe(true);
      expect(result.version).toBe(0);

      // Verify update included version reset
      expect(mockTx.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            landingPageConfigDraftVersion: 0,
          }),
        })
      );
    });
  });

  describe('discard_draft executor', () => {
    it('should reset version to 0 on discard', async () => {
      // Setup: Mock tenant with existing draft
      mockTx.tenant.findUnique.mockResolvedValue({
        landingPageConfigDraft: { pages: DEFAULT_PAGES_CONFIG },
        slug: 'test-tenant',
      });

      mockTx.tenant.update.mockResolvedValue({});

      const executor = getProposalExecutor('discard_draft');
      expect(executor).toBeDefined();

      const result = await executor!(tenantId, {});

      expect(result.success).toBe(true);
      expect(result.version).toBe(0);

      // Verify update included version reset
      expect(mockTx.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            landingPageConfigDraftVersion: 0,
          }),
        })
      );
    });
  });
});
