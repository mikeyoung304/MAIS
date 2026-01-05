/**
 * Unit tests for Storefront Build Mode Executors
 *
 * Tests focus on:
 * - Payload validation (Zod schemas)
 * - Draft operations (save, publish, discard)
 * - Section manipulation (add, update, remove, reorder)
 * - Tenant isolation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '../../../src/generated/prisma';
import { DEFAULT_PAGES_CONFIG } from '@macon/contracts';

// Mock dependencies
vi.mock('../../../src/agent/proposals/executor-registry', () => ({
  registerProposalExecutor: vi.fn(),
}));

vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Storefront Executors', () => {
  let mockPrisma: {
    tenant: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  let registeredExecutors: Map<string, (tenantId: string, payload: unknown) => Promise<unknown>>;

  beforeEach(async () => {
    registeredExecutors = new Map();

    // Capture executor registrations
    const { registerProposalExecutor } = await import(
      '../../../src/agent/proposals/executor-registry'
    );
    vi.mocked(registerProposalExecutor).mockImplementation((name, fn) => {
      registeredExecutors.set(name, fn);
    });

    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    // Import and register executors
    const { registerStorefrontExecutors } = await import(
      '../../../src/agent/executors/storefront-executors'
    );
    registerStorefrontExecutors(mockPrisma as unknown as PrismaClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Executor Registration', () => {
    it('should register all 7 executors', () => {
      expect(registeredExecutors.size).toBe(7);
    });

    it('should register expected executors', () => {
      expect(registeredExecutors.has('update_page_section')).toBe(true);
      expect(registeredExecutors.has('remove_page_section')).toBe(true);
      expect(registeredExecutors.has('reorder_page_sections')).toBe(true);
      expect(registeredExecutors.has('toggle_page_enabled')).toBe(true);
      expect(registeredExecutors.has('update_storefront_branding')).toBe(true);
      expect(registeredExecutors.has('publish_draft')).toBe(true);
      expect(registeredExecutors.has('discard_draft')).toBe(true);
    });
  });

  describe('update_page_section executor', () => {
    it('should throw ValidationError for invalid payload', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      await expect(
        executor('tenant-123', {
          pageName: 'invalid_page',
          sectionIndex: 0,
          sectionData: {},
        })
      ).rejects.toThrow();
    });

    it('should add new section when sectionIndex is -1', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {
        pageName: 'home',
        sectionIndex: -1, // Append
        sectionData: {
          type: 'text',
          headline: 'New Section',
          content: 'Some content',
        },
      });

      expect(result).toHaveProperty('action', 'added');
      expect(mockPrisma.tenant.update).toHaveBeenCalled();
    });

    it('should update existing section', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {
        pageName: 'home',
        sectionIndex: 0,
        sectionData: {
          type: 'hero',
          headline: 'Updated Headline',
          subheadline: 'Updated subheadline',
        },
      });

      expect(result).toHaveProperty('action', 'updated');
    });
  });

  describe('remove_page_section executor', () => {
    it('should throw for invalid section index', async () => {
      const executor = registeredExecutors.get('remove_page_section')!;

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      await expect(
        executor('tenant-123', {
          pageName: 'home',
          sectionIndex: 999, // Out of bounds
        })
      ).rejects.toThrow('out of bounds');
    });

    it('should remove section at specified index', async () => {
      const executor = registeredExecutors.get('remove_page_section')!;

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {
        pageName: 'home',
        sectionIndex: 0,
      });

      expect(result).toHaveProperty('action', 'removed');
      expect(mockPrisma.tenant.update).toHaveBeenCalled();
    });
  });

  describe('reorder_page_sections executor', () => {
    it('should throw for invalid indices', async () => {
      const executor = registeredExecutors.get('reorder_page_sections')!;

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      await expect(
        executor('tenant-123', {
          pageName: 'home',
          fromIndex: 0,
          toIndex: 999, // Out of bounds
        })
      ).rejects.toThrow('Invalid indices');
    });

    it('should reorder sections correctly', async () => {
      const executor = registeredExecutors.get('reorder_page_sections')!;

      // Create a config with multiple sections
      const configWithSections = {
        ...DEFAULT_PAGES_CONFIG,
        home: {
          ...DEFAULT_PAGES_CONFIG.home,
          sections: [
            { type: 'hero' as const, headline: 'First', subheadline: '' },
            { type: 'text' as const, headline: 'Second', content: '' },
            { type: 'cta' as const, headline: 'Third', subheadline: '', ctaText: '', ctaLink: '' },
          ],
        },
      };

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: configWithSections },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {
        pageName: 'home',
        fromIndex: 0,
        toIndex: 2,
      });

      expect(result).toHaveProperty('action', 'reordered');
      expect(result).toHaveProperty('movedSectionType', 'hero');
    });
  });

  describe('toggle_page_enabled executor', () => {
    it('should throw when trying to disable home page', async () => {
      const executor = registeredExecutors.get('toggle_page_enabled')!;

      await expect(
        executor('tenant-123', {
          pageName: 'home',
          enabled: false,
        })
      ).rejects.toThrow('cannot be disabled');
    });

    it('should toggle page enabled state', async () => {
      const executor = registeredExecutors.get('toggle_page_enabled')!;

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {
        pageName: 'about',
        enabled: false,
      });

      expect(result).toHaveProperty('action', 'disabled');
    });
  });

  describe('publish_draft executor', () => {
    it('should throw when no draft exists', async () => {
      const executor = registeredExecutors.get('publish_draft')!;

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null, // No draft
      });

      await expect(executor('tenant-123', {})).rejects.toThrow('No draft');
    });

    it('should publish draft to live and clear draft', async () => {
      const executor = registeredExecutors.get('publish_draft')!;

      const draftConfig = {
        pages: {
          ...DEFAULT_PAGES_CONFIG,
          home: {
            ...DEFAULT_PAGES_CONFIG.home,
            sections: [{ type: 'hero' as const, headline: 'Draft Headline', subheadline: '' }],
          },
        },
      };

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: draftConfig,
      });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {});

      expect(result).toHaveProperty('action', 'published');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            landingPageConfig: draftConfig,
            landingPageConfigDraft: null,
          }),
        })
      );
    });
  });

  describe('discard_draft executor', () => {
    it('should throw when no draft exists', async () => {
      const executor = registeredExecutors.get('discard_draft')!;

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      await expect(executor('tenant-123', {})).rejects.toThrow('No draft');
    });

    it('should clear draft without affecting live', async () => {
      const executor = registeredExecutors.get('discard_draft')!;

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: { pages: DEFAULT_PAGES_CONFIG },
      });

      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await executor('tenant-123', {});

      expect(result).toHaveProperty('action', 'discarded');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            landingPageConfigDraft: null,
          },
        })
      );
    });
  });

  describe('Tenant isolation', () => {
    it('should throw ResourceNotFoundError for missing tenant', async () => {
      const executor = registeredExecutors.get('update_page_section')!;

      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        executor('nonexistent-tenant', {
          pageName: 'home',
          sectionIndex: 0,
          sectionData: { type: 'hero', headline: 'Test', subheadline: '' },
        })
      ).rejects.toThrow('Tenant not found');
    });

    it('should use correct tenantId in all queries', async () => {
      const executor = registeredExecutors.get('toggle_page_enabled')!;

      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-123',
          landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-tenant',
        });

      mockPrisma.tenant.update.mockResolvedValue({});

      await executor('tenant-123', {
        pageName: 'about',
        enabled: true,
      });

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-123' },
        })
      );

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-123' },
        })
      );
    });
  });
});
