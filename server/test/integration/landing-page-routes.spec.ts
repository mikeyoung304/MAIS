/**
 * Integration tests for Landing Page Admin Routes
 *
 * Tests the draft system endpoints used by Build Mode:
 * - GET /draft - Fetch draft config
 * - PUT /draft - Save draft (autosave)
 * - POST /publish - Publish draft to live
 * - DELETE /draft - Discard draft
 *
 * @see todos/628-pending-p2-missing-integration-tests.md
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';
import { LandingPageService } from '../../src/services/landing-page.service';
import { PrismaTenantRepository } from '../../src/adapters/prisma/tenant.repository';
import { NotFoundError, ValidationError } from '../../src/lib/errors';
import type { LandingPageConfig, PagesConfig } from '@macon/contracts';
import {
  VALID_MOCK_PAGES_CONFIG,
  VALID_MOCK_LANDING_PAGE_CONFIG,
} from '../helpers/mock-landing-page-config';

describe.sequential('Landing Page Admin Routes Integration Tests', () => {
  const ctx = setupCompleteIntegrationTest('landing-page-routes');
  let tenantRepo: PrismaTenantRepository;
  let service: LandingPageService;

  beforeAll(async () => {
    tenantRepo = new PrismaTenantRepository(ctx.prisma);
    service = new LandingPageService(tenantRepo);
  });

  afterEach(async () => {
    await ctx.tenants.cleanupTenants();
    ctx.cache.flush();
    ctx.cache.resetStats();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  // ============================================================================
  // GET /draft - Fetch Draft Configuration
  // ============================================================================

  describe('getDraft (GET /draft)', () => {
    it('should return draft wrapper with null draft when tenant has no config', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const result = await service.getDraft(tenant.id);

      expect(result).toBeDefined();
      expect(result.draft).toBeNull();
      expect(result.published).toBeNull();
    });

    it('should return draft when tenant has draft config', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Save a draft first
      const draftConfig: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };
      await service.saveDraft(tenant.id, draftConfig);

      const result = await service.getDraft(tenant.id);

      expect(result.draft).not.toBeNull();
      expect(result.draft?.pages).toEqual(VALID_MOCK_PAGES_CONFIG);
      expect(result.draftUpdatedAt).not.toBeNull();
    });

    it('should throw NotFoundError for non-existent tenant', async () => {
      await expect(service.getDraft('non-existent-tenant-id')).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================================
  // PUT /draft - Save Draft Configuration
  // ============================================================================

  describe('saveDraft (PUT /draft)', () => {
    it('should save valid draft config', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      const draftConfig: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };

      const result = await service.saveDraft(tenant.id, draftConfig);

      expect(result.success).toBe(true);
      expect(result.draftUpdatedAt).toBeDefined();
      expect(new Date(result.draftUpdatedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should create draft if none exists', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Verify no draft exists
      const before = await service.getDraft(tenant.id);
      expect(before.draft).toBeNull();

      // Save draft
      const draftConfig: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };
      await service.saveDraft(tenant.id, draftConfig);

      // Verify draft now exists
      const after = await service.getDraft(tenant.id);
      expect(after.draft).not.toBeNull();
    });

    it('should update existing draft', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Save initial draft
      const initialConfig: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };
      await service.saveDraft(tenant.id, initialConfig);

      // Modify and save again
      const modifiedPages = {
        ...VALID_MOCK_PAGES_CONFIG,
        home: {
          ...VALID_MOCK_PAGES_CONFIG.home,
          enabled: false,
        },
      };
      const modifiedConfig: LandingPageConfig = {
        pages: modifiedPages as PagesConfig,
      };
      await service.saveDraft(tenant.id, modifiedConfig);

      // Verify draft was updated
      const result = await service.getDraft(tenant.id);
      expect(result.draft?.pages?.home?.enabled).toBe(false);
    });

    it('should throw NotFoundError for non-existent tenant', async () => {
      const draftConfig: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };

      await expect(service.saveDraft('non-existent-tenant-id', draftConfig)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============================================================================
  // POST /publish - Publish Draft to Live
  // ============================================================================

  describe('publish (POST /publish)', () => {
    it('should copy draft to live config', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Save draft
      const draftConfig: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };
      await service.saveDraft(tenant.id, draftConfig);

      // Publish
      const result = await service.publish(tenant.id);

      expect(result.success).toBe(true);
      expect(result.publishedAt).toBeDefined();
    });

    it('should clear draft after publish', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Save draft
      const draftConfig: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };
      await service.saveDraft(tenant.id, draftConfig);

      // Verify draft exists
      const before = await service.getDraft(tenant.id);
      expect(before.draft).not.toBeNull();

      // Publish
      await service.publish(tenant.id);

      // Verify draft is cleared
      const after = await service.getDraft(tenant.id);
      expect(after.draft).toBeNull();
      expect(after.published).not.toBeNull();
    });

    it('should throw ValidationError if no draft to publish', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // No draft exists - should fail
      await expect(service.publish(tenant.id)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent tenant', async () => {
      await expect(service.publish('non-existent-tenant-id')).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================================
  // DELETE /draft - Discard Draft
  // ============================================================================

  describe('discardDraft (DELETE /draft)', () => {
    it('should clear draft config', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Save draft
      const draftConfig: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };
      await service.saveDraft(tenant.id, draftConfig);

      // Verify draft exists
      const before = await service.getDraft(tenant.id);
      expect(before.draft).not.toBeNull();

      // Discard
      await service.discardDraft(tenant.id);

      // Verify draft is cleared
      const after = await service.getDraft(tenant.id);
      expect(after.draft).toBeNull();
    });

    it('should preserve live config when discarding draft', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Create live config by saving and publishing
      const liveConfig: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };
      await service.saveDraft(tenant.id, liveConfig);
      await service.publish(tenant.id);

      // Save a different draft
      const modifiedPages = {
        ...VALID_MOCK_PAGES_CONFIG,
        home: {
          ...VALID_MOCK_PAGES_CONFIG.home,
          enabled: false,
        },
      };
      const draftConfig: LandingPageConfig = {
        pages: modifiedPages as PagesConfig,
      };
      await service.saveDraft(tenant.id, draftConfig);

      // Discard draft
      await service.discardDraft(tenant.id);

      // Published config should still be original
      const result = await service.getDraft(tenant.id);
      expect(result.published?.pages?.home?.enabled).toBe(true);
      expect(result.draft).toBeNull();
    });

    it('should not fail if no draft exists (idempotent)', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // No draft exists - should not throw
      await expect(service.discardDraft(tenant.id)).resolves.not.toThrow();
    });

    it('should throw NotFoundError for non-existent tenant', async () => {
      await expect(service.discardDraft('non-existent-tenant-id')).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================================
  // Multi-Tenant Isolation
  // ============================================================================

  describe('Multi-tenant isolation', () => {
    it('should isolate draft configs between tenants', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      // Save draft for tenant A
      const draftA: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };
      await service.saveDraft(tenantA.id, draftA);

      // Tenant B should have no draft
      const resultB = await service.getDraft(tenantB.id);
      expect(resultB.draft).toBeNull();

      // Tenant A should have draft
      const resultA = await service.getDraft(tenantA.id);
      expect(resultA.draft).not.toBeNull();
    });

    it('should not allow one tenant to access another tenant config', async () => {
      const tenantA = await ctx.tenants.tenantA.create();
      const tenantB = await ctx.tenants.tenantB.create();

      // Save and publish for tenant A
      const configA: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };
      await service.saveDraft(tenantA.id, configA);
      await service.publish(tenantA.id);

      // Tenant B's config should be independent (null)
      const resultB = await service.getDraft(tenantB.id);
      expect(resultB.published).toBeNull();
    });
  });

  // ============================================================================
  // Draft Workflow Integration
  // ============================================================================

  describe('Full draft workflow', () => {
    it('should support complete edit → preview → publish workflow', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Step 1: Start with no config
      const initial = await service.getDraft(tenant.id);
      expect(initial.draft).toBeNull();

      // Step 2: Save draft (simulating Build Mode autosave)
      const draftConfig: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };
      await service.saveDraft(tenant.id, draftConfig);

      // Step 3: Verify draft exists for preview
      const preview = await service.getDraft(tenant.id);
      expect(preview.draft).not.toBeNull();
      expect(preview.draftUpdatedAt).not.toBeNull();

      // Step 4: Publish
      await service.publish(tenant.id);

      // Step 5: Verify published and draft cleared
      const final = await service.getDraft(tenant.id);
      expect(final.draft).toBeNull();
      expect(final.published).not.toBeNull();
      expect(final.published?.pages).toEqual(VALID_MOCK_PAGES_CONFIG);
    });

    it('should support discard workflow', async () => {
      const tenant = await ctx.tenants.tenantA.create();

      // Establish live config
      const liveConfig: LandingPageConfig = {
        pages: VALID_MOCK_PAGES_CONFIG,
      };
      await service.saveDraft(tenant.id, liveConfig);
      await service.publish(tenant.id);

      // Make draft changes
      const modifiedPages = {
        ...VALID_MOCK_PAGES_CONFIG,
        about: {
          ...VALID_MOCK_PAGES_CONFIG.about,
          enabled: false,
        },
      };
      const draftConfig: LandingPageConfig = {
        pages: modifiedPages as PagesConfig,
      };
      await service.saveDraft(tenant.id, draftConfig);

      // Discard draft
      await service.discardDraft(tenant.id);

      // Published config should be unchanged
      const result = await service.getDraft(tenant.id);
      expect(result.published?.pages?.about?.enabled).toBe(true);
      expect(result.draft).toBeNull();
    });
  });
});
