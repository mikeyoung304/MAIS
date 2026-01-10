/**
 * Unit tests for Agent Tool Utilities
 *
 * Tests for shared utility functions used across agent tools.
 * Focus on defensive copy patterns and data isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDraftConfig, getDraftConfigWithSlug } from '../../../src/agent/tools/utils';
import { DEFAULT_PAGES_CONFIG } from '@macon/contracts';

// Mock logger to avoid test noise
vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Draft Config Utilities', () => {
  let mockPrisma: {
    tenant: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // #719: Defensive Copy Tests - structuredClone prevents shared reference issues
  // ============================================================================
  // These tests verify that when DEFAULT_PAGES_CONFIG is returned, it's a
  // defensive copy (not a direct reference). Without this, mutations by
  // callers would corrupt the global constant for all tenants.

  describe('getDraftConfig defensive copy', () => {
    it('should return independent copy when no config exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        landingPageConfig: null,
        landingPageConfigDraft: null,
      });

      const result1 = await getDraftConfig(
        mockPrisma as unknown as Parameters<typeof getDraftConfig>[0],
        'tenant-123'
      );
      const result2 = await getDraftConfig(
        mockPrisma as unknown as Parameters<typeof getDraftConfig>[0],
        'tenant-123'
      );

      // Mutate first result
      result1.pages.home.sections.push({ id: 'test-mutation', type: 'hero', headline: 'Test' });

      // Second result should NOT be affected
      expect(result2.pages.home.sections).not.toContainEqual(
        expect.objectContaining({ id: 'test-mutation' })
      );

      // Original constant should NOT be affected
      expect(DEFAULT_PAGES_CONFIG.home.sections).not.toContainEqual(
        expect.objectContaining({ id: 'test-mutation' })
      );
    });

    it('should return independent copy when draft has null pages', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        landingPageConfig: { pages: null }, // Invalid but handled
        landingPageConfigDraft: { pages: null },
      });

      const result = await getDraftConfig(
        mockPrisma as unknown as Parameters<typeof getDraftConfig>[0],
        'tenant-123'
      );

      // Mutate result
      result.pages.home.enabled = false;

      // Original constant should NOT be affected
      expect(DEFAULT_PAGES_CONFIG.home.enabled).toBe(true);
    });

    it('should return independent copy when live config is invalid', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        landingPageConfig: { invalid: 'structure' }, // Will fail Zod validation
        landingPageConfigDraft: null,
      });

      const result = await getDraftConfig(
        mockPrisma as unknown as Parameters<typeof getDraftConfig>[0],
        'tenant-123'
      );

      // Mutate result
      result.pages.about.sections.push({ id: 'mutation', type: 'text', content: 'x' });

      // Original constant should NOT be affected
      expect(DEFAULT_PAGES_CONFIG.about.sections).not.toContainEqual(
        expect.objectContaining({ id: 'mutation' })
      );
    });
  });

  describe('getDraftConfigWithSlug defensive copy', () => {
    it('should return independent copy when no config exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: null,
        landingPageConfigDraft: null,
      });

      const result1 = await getDraftConfigWithSlug(
        mockPrisma as unknown as Parameters<typeof getDraftConfigWithSlug>[0],
        'tenant-123'
      );
      const result2 = await getDraftConfigWithSlug(
        mockPrisma as unknown as Parameters<typeof getDraftConfigWithSlug>[0],
        'tenant-123'
      );

      // Mutate first result
      result1.pages.home.sections.push({ id: 'test-mutation', type: 'hero', headline: 'Test' });

      // Second result should NOT be affected
      expect(result2.pages.home.sections).not.toContainEqual(
        expect.objectContaining({ id: 'test-mutation' })
      );

      // Original constant should NOT be affected
      expect(DEFAULT_PAGES_CONFIG.home.sections).not.toContainEqual(
        expect.objectContaining({ id: 'test-mutation' })
      );
    });

    it('should return independent copy for each tenant', async () => {
      // Simulate two different tenants both getting default config
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-A',
          slug: 'tenant-a',
          landingPageConfig: null,
          landingPageConfigDraft: null,
        })
        .mockResolvedValueOnce({
          id: 'tenant-B',
          slug: 'tenant-b',
          landingPageConfig: null,
          landingPageConfigDraft: null,
        });

      const resultA = await getDraftConfigWithSlug(
        mockPrisma as unknown as Parameters<typeof getDraftConfigWithSlug>[0],
        'tenant-A'
      );
      const resultB = await getDraftConfigWithSlug(
        mockPrisma as unknown as Parameters<typeof getDraftConfigWithSlug>[0],
        'tenant-B'
      );

      // Mutate tenant A's config
      resultA.pages.home.sections = [];

      // Tenant B's config should NOT be affected
      expect(resultB.pages.home.sections.length).toBeGreaterThan(0);

      // Original constant should NOT be affected
      expect(DEFAULT_PAGES_CONFIG.home.sections.length).toBeGreaterThan(0);
    });

    it('should return independent copy when draft has no pages field', async () => {
      // LandingPageConfigSchema.pages is optional, so a draft without pages is valid.
      // We verify that DEFAULT_PAGES_CONFIG fallback returns a defensive copy.
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: null,
        // Draft exists but has no pages field (empty object is valid)
        landingPageConfigDraft: {},
      });

      const result = await getDraftConfigWithSlug(
        mockPrisma as unknown as Parameters<typeof getDraftConfigWithSlug>[0],
        'tenant-123'
      );

      // hasDraft is true because draft record exists (empty object passes validation)
      expect(result.hasDraft).toBe(true);

      // Mutate result (pages came from DEFAULT_PAGES_CONFIG fallback)
      // Disable home page (which is enabled in DEFAULT_PAGES_CONFIG)
      // NOTE: TypeScript allows this because the type doesn't enforce immutability
      (result.pages.home as { enabled: boolean }).enabled = false;

      // Original constant should NOT be affected (home is always enabled=true)
      expect(DEFAULT_PAGES_CONFIG.home.enabled).toBe(true);
    });

    it('should return independent copy when live config has null pages', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'test-tenant',
        landingPageConfig: { pages: null }, // Valid wrapper but null pages
        landingPageConfigDraft: null,
      });

      const result = await getDraftConfigWithSlug(
        mockPrisma as unknown as Parameters<typeof getDraftConfigWithSlug>[0],
        'tenant-123'
      );

      // Mutate result
      result.pages.gallery.enabled = true;

      // Original constant should NOT be affected (gallery is disabled by default)
      expect(DEFAULT_PAGES_CONFIG.gallery.enabled).toBe(false);
    });
  });

  // ============================================================================
  // Basic functionality tests
  // ============================================================================

  describe('getDraftConfig basic functionality', () => {
    it('should throw error when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        getDraftConfig(mockPrisma as unknown as Parameters<typeof getDraftConfig>[0], 'nonexistent')
      ).rejects.toThrow('Tenant not found');
    });

    it('should return hasDraft=true when draft exists', async () => {
      // Any non-null draft that passes validation counts as existing
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        landingPageConfig: null,
        // Empty object is valid (all fields optional in LandingPageConfigSchema)
        landingPageConfigDraft: {},
      });

      const result = await getDraftConfig(
        mockPrisma as unknown as Parameters<typeof getDraftConfig>[0],
        'tenant-123'
      );

      // When any draft exists (passes validation), hasDraft should be true
      expect(result.hasDraft).toBe(true);
    });

    it('should return hasDraft=false when no draft exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        landingPageConfig: { pages: DEFAULT_PAGES_CONFIG },
        landingPageConfigDraft: null,
      });

      const result = await getDraftConfig(
        mockPrisma as unknown as Parameters<typeof getDraftConfig>[0],
        'tenant-123'
      );

      expect(result.hasDraft).toBe(false);
    });
  });

  describe('getDraftConfigWithSlug basic functionality', () => {
    it('should throw error when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        getDraftConfigWithSlug(
          mockPrisma as unknown as Parameters<typeof getDraftConfigWithSlug>[0],
          'nonexistent'
        )
      ).rejects.toThrow('Tenant not found');
    });

    it('should return tenant slug', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        slug: 'my-business',
        landingPageConfig: null,
        landingPageConfigDraft: null,
      });

      const result = await getDraftConfigWithSlug(
        mockPrisma as unknown as Parameters<typeof getDraftConfigWithSlug>[0],
        'tenant-123'
      );

      expect(result.slug).toBe('my-business');
    });
  });
});
