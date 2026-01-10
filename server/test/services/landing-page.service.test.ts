/**
 * Landing Page Service Tests
 *
 * Tests the unified LandingPageService that handles both draft systems:
 * 1. Visual Editor (wrapper format in landingPageConfig)
 * 2. Build Mode (separate landingPageConfigDraft column)
 *
 * @see todos/704-ready-p2-landing-page-service-abstraction.md
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { LandingPageService } from '../../src/services/landing-page.service';
import { PrismaTenantRepository } from '../../src/adapters/prisma/tenant.repository';
import { NotFoundError } from '../../src/lib/errors';
import { getTestPrisma } from '../helpers/global-prisma';
import { DEFAULT_PAGES_CONFIG, type PagesConfig } from '@macon/contracts';

const prisma = getTestPrisma();

/**
 * VALID mock config for tests that need schema-compliant data.
 *
 * WHY THIS EXISTS:
 * DEFAULT_PAGES_CONFIG contains intentionally long placeholder strings
 * (e.g., "[Your Transformation Headline - what change do you create?]")
 * designed for user guidance, NOT schema compliance.
 *
 * When these go through Zod validation in LandingPageService methods,
 * they fail max length constraints (e.g., headline max 60 chars).
 *
 * This test config uses short, valid content that passes validation.
 */
const VALID_MOCK_PAGES_CONFIG: PagesConfig = {
  home: {
    enabled: true as const,
    sections: [
      { id: 'home-hero-main', type: 'hero', headline: 'Welcome', ctaText: 'Book' },
      { id: 'home-text-about', type: 'text', headline: 'About', content: 'About us.' },
    ],
  },
  about: { enabled: false, sections: [] },
  services: { enabled: false, sections: [] },
  faq: { enabled: false, sections: [] },
  contact: { enabled: false, sections: [] },
  gallery: { enabled: false, sections: [] },
  testimonials: { enabled: false, sections: [] },
};

// Track test slugs for cleanup
const testSlugs: string[] = [];

const generateTestSlug = () => {
  const slug = `lp-service-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  testSlugs.push(slug);
  return slug;
};

afterAll(async () => {
  // Cleanup test tenants
  if (testSlugs.length > 0) {
    await prisma.tenant.deleteMany({
      where: { slug: { in: testSlugs } },
    });
  }
});

describe('LandingPageService', () => {
  let service: LandingPageService;
  let tenantRepo: PrismaTenantRepository;

  beforeAll(() => {
    tenantRepo = new PrismaTenantRepository(prisma);
    service = new LandingPageService(tenantRepo);
  });

  describe('Build Mode Methods', () => {
    let testTenantId: string;
    let testSlug: string;

    beforeEach(async () => {
      // Create a fresh test tenant for each test
      testSlug = generateTestSlug();
      const tenant = await prisma.tenant.create({
        data: {
          slug: testSlug,
          name: 'Landing Page Test Tenant',
          apiKeyPublic: `pk_live_${testSlug}_${Date.now()}`,
          apiKeySecret: 'sk_hashed_secret',
        },
      });
      testTenantId = tenant.id;
    });

    afterEach(async () => {
      // Cleanup test tenant
      await prisma.tenant
        .delete({
          where: { id: testTenantId },
        })
        .catch(() => {});
    });

    describe('getBuildModeDraft', () => {
      it('should return defaults when no config exists', async () => {
        const result = await service.getBuildModeDraft(testTenantId);

        expect(result.hasDraft).toBe(false);
        expect(result.pages).toEqual(DEFAULT_PAGES_CONFIG);
      });

      it('should return draft config when draft exists', async () => {
        // Use VALID_MOCK_PAGES_CONFIG - invalid schema causes hasDraft to be false
        const draftConfig = {
          pages: structuredClone(VALID_MOCK_PAGES_CONFIG),
        };

        await prisma.tenant.update({
          where: { id: testTenantId },
          data: { landingPageConfigDraft: draftConfig },
        });

        const result = await service.getBuildModeDraft(testTenantId);

        expect(result.hasDraft).toBe(true);
        expect(result.pages.home).toBeDefined();
      });

      it('should fall back to live config when no draft exists', async () => {
        const liveConfig = {
          pages: {
            home: {
              enabled: true,
              title: 'Live Home',
              sections: [],
            },
          },
        };

        await prisma.tenant.update({
          where: { id: testTenantId },
          data: { landingPageConfig: liveConfig },
        });

        const result = await service.getBuildModeDraft(testTenantId);

        expect(result.hasDraft).toBe(false);
        expect(result.pages.home).toBeDefined();
      });

      it('should throw NotFoundError for non-existent tenant', async () => {
        await expect(service.getBuildModeDraft('non-existent-tenant-id')).rejects.toThrow(
          NotFoundError
        );
      });
    });

    describe('getBuildModeDraftWithSlug', () => {
      it('should return slug along with draft config', async () => {
        const result = await service.getBuildModeDraftWithSlug(testTenantId);

        expect(result.slug).toBe(testSlug);
        expect(result.hasDraft).toBe(false);
        expect(result.rawDraftConfig).toBeNull();
        expect(result.rawLiveConfig).toBeNull();
      });

      it('should return raw configs for discovery tools', async () => {
        const draftConfig = { pages: {} };
        const liveConfig = { pages: {} };

        await prisma.tenant.update({
          where: { id: testTenantId },
          data: {
            landingPageConfigDraft: draftConfig,
            landingPageConfig: liveConfig,
          },
        });

        const result = await service.getBuildModeDraftWithSlug(testTenantId);

        expect(result.rawDraftConfig).toEqual(draftConfig);
        expect(result.rawLiveConfig).toEqual(liveConfig);
      });
    });

    describe('saveBuildModeDraft', () => {
      it('should save draft to landingPageConfigDraft column', async () => {
        const config = {
          pages: {
            home: {
              enabled: true,
              title: 'New Draft',
              sections: [],
            },
          },
        };

        await service.saveBuildModeDraft(testTenantId, config);

        const tenant = await prisma.tenant.findUnique({
          where: { id: testTenantId },
          select: { landingPageConfigDraft: true },
        });

        expect(tenant?.landingPageConfigDraft).toBeDefined();
      });

      it('should sanitize content before saving', async () => {
        const configWithXSS = {
          pages: {
            home: {
              enabled: true,
              title: '<script>alert("xss")</script>Safe Title',
              sections: [],
            },
          },
        };

        await service.saveBuildModeDraft(testTenantId, configWithXSS);

        const tenant = await prisma.tenant.findUnique({
          where: { id: testTenantId },
          select: { landingPageConfigDraft: true },
        });

        // Should be sanitized (script tags removed)
        const savedConfig = tenant?.landingPageConfigDraft as any;
        expect(savedConfig?.pages?.home?.title).not.toContain('<script>');
      });
    });

    describe('publishBuildModeDraft', () => {
      it('should copy draft to wrapper format in landingPageConfig', async () => {
        const draftConfig = {
          pages: {
            home: {
              enabled: true,
              title: 'Draft to Publish',
              sections: [{ type: 'hero', content: { title: 'Hero' } }],
            },
          },
        };

        await prisma.tenant.update({
          where: { id: testTenantId },
          data: { landingPageConfigDraft: draftConfig },
        });

        const result = await service.publishBuildModeDraft(testTenantId);

        expect(result.action).toBe('published');
        expect(result.pageCount).toBeGreaterThan(0);
        expect(result.previewUrl).toBe(`/t/${testSlug}`);

        // Verify wrapper format
        const tenant = await prisma.tenant.findUnique({
          where: { id: testTenantId },
          select: { landingPageConfig: true, landingPageConfigDraft: true },
        });

        expect(tenant?.landingPageConfigDraft).toBeNull();
        const wrapper = tenant?.landingPageConfig as any;
        expect(wrapper?.published).toEqual(draftConfig);
        expect(wrapper?.publishedAt).toBeDefined();
        expect(wrapper?.draft).toBeNull();
      });

      it('should throw error when no draft exists', async () => {
        await expect(service.publishBuildModeDraft(testTenantId)).rejects.toThrow(
          'No draft changes to publish.'
        );
      });
    });

    describe('discardBuildModeDraft', () => {
      it('should clear landingPageConfigDraft without affecting live config', async () => {
        const draftConfig = { pages: {} };
        const liveConfig = {
          published: { pages: {} },
          publishedAt: new Date().toISOString(),
          draft: null,
          draftUpdatedAt: null,
        };

        await prisma.tenant.update({
          where: { id: testTenantId },
          data: {
            landingPageConfigDraft: draftConfig,
            landingPageConfig: liveConfig,
          },
        });

        const result = await service.discardBuildModeDraft(testTenantId);

        expect(result.action).toBe('discarded');

        const tenant = await prisma.tenant.findUnique({
          where: { id: testTenantId },
          select: { landingPageConfig: true, landingPageConfigDraft: true },
        });

        expect(tenant?.landingPageConfigDraft).toBeNull();
        expect(tenant?.landingPageConfig).toEqual(liveConfig);
      });

      it('should throw error when no draft exists', async () => {
        await expect(service.discardBuildModeDraft(testTenantId)).rejects.toThrow(
          'No draft changes to discard.'
        );
      });
    });

    describe('getPublished', () => {
      it('should return null when no config exists', async () => {
        const result = await service.getPublished(testTenantId);
        expect(result).toBeNull();
      });

      it('should extract published config from wrapper format', async () => {
        // Use VALID_MOCK_PAGES_CONFIG - DEFAULT_PAGES_CONFIG has placeholder text
        // that exceeds schema max lengths, causing validation to fail
        const publishedConfig = {
          pages: structuredClone(VALID_MOCK_PAGES_CONFIG),
        };

        await prisma.tenant.update({
          where: { id: testTenantId },
          data: {
            landingPageConfig: {
              published: publishedConfig,
              publishedAt: new Date().toISOString(),
              draft: null,
              draftUpdatedAt: null,
            },
          },
        });

        const result = await service.getPublished(testTenantId);

        expect(result).toBeDefined();
        expect(result?.pages?.home?.enabled).toBe(true);
        // Verify sections are preserved
        expect(result?.pages?.home?.sections?.length).toBeGreaterThan(0);
      });

      it('should handle legacy direct config format', async () => {
        // Use VALID_MOCK_PAGES_CONFIG - DEFAULT_PAGES_CONFIG has placeholder text
        // that exceeds schema max lengths, causing validation to fail
        const legacyConfig = {
          pages: structuredClone(VALID_MOCK_PAGES_CONFIG),
        };

        await prisma.tenant.update({
          where: { id: testTenantId },
          data: { landingPageConfig: legacyConfig },
        });

        const result = await service.getPublished(testTenantId);

        expect(result).toBeDefined();
        expect(result?.pages?.home?.enabled).toBe(true);
        // Verify sections are preserved
        expect(result?.pages?.home?.sections?.length).toBeGreaterThan(0);
      });
    });

    describe('getTenantSlug', () => {
      it('should return tenant slug', async () => {
        const result = await service.getTenantSlug(testTenantId);
        expect(result).toBe(testSlug);
      });

      it('should return null for non-existent tenant', async () => {
        const result = await service.getTenantSlug('non-existent-id');
        expect(result).toBeNull();
      });
    });
  });
});
