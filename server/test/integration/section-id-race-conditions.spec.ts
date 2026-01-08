/**
 * Integration tests for section ID race condition prevention
 * Tests concurrent update_page_section operations to verify TOCTOU fix
 *
 * P1-659 FIX: Verifies advisory locks prevent duplicate section IDs
 * when concurrent requests check for ID uniqueness.
 *
 * Setup: Requires test database
 * Run: npm run test:integration -- section-id-race
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';
import { registerStorefrontExecutors } from '../../src/agent/executors/storefront-executors';
import {
  getProposalExecutor,
  clearAllExecutors,
} from '../../src/agent/proposals/executor-registry';
import { DEFAULT_PAGES_CONFIG, type LandingPageConfig, type PagesConfig } from '@macon/contracts';

describe.sequential('Section ID Race Conditions - Integration Tests', () => {
  const ctx = setupCompleteIntegrationTest('section-id-race');
  let testTenantId: string;

  beforeEach(async () => {
    // Setup tenant
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    testTenantId = ctx.tenants.tenantA.id;

    // Clear and re-register executors to ensure fresh state
    clearAllExecutors();
    registerStorefrontExecutors(ctx.prisma);

    // Initialize tenant with draft config
    await ctx.prisma.tenant.update({
      where: { id: testTenantId },
      data: {
        landingPageConfigDraft: {
          pages: DEFAULT_PAGES_CONFIG,
        },
      },
    });
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  describe('Concurrent Section Update Prevention', () => {
    it('should prevent duplicate section IDs when concurrent requests arrive', async () => {
      // Arrange: Get executor
      const updateExecutor = getProposalExecutor('update_page_section');
      if (!updateExecutor) {
        throw new Error('update_page_section executor not registered');
      }

      // Use valid section ID format: {page}-{type}-{qualifier}
      // Note: Using a consistent ID on different pages simulates the race condition
      const uniqueQualifier = `${Date.now() % 10000}`; // Unique qualifier suffix
      const sharedId = `home-text-${uniqueQualifier}` as const; // Valid format

      // Create two payloads that try to create sections with the same ID
      const payload1 = {
        pageName: 'home',
        sectionIndex: -1, // Append new section
        sectionData: {
          type: 'text',
          id: sharedId,
          content: 'First concurrent request',
        },
      };

      const payload2 = {
        pageName: 'about',
        sectionIndex: -1, // Append new section
        sectionData: {
          type: 'text',
          id: sharedId, // Same ID - should conflict across pages
          content: 'Second concurrent request',
        },
      };

      // Act: Fire two update requests concurrently with the same section ID
      const results = await Promise.allSettled([
        updateExecutor(testTenantId, payload1),
        updateExecutor(testTenantId, payload2),
      ]);

      // Assert: One succeeds, one fails
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // The failed one should mention duplicate ID
      const rejection = failed[0] as PromiseRejectedResult;
      expect(rejection.reason.message).toContain('already exists');

      // Verify only one section with this ID exists in the draft
      const tenant = await ctx.prisma.tenant.findUnique({
        where: { id: testTenantId },
        select: { landingPageConfigDraft: true },
      });

      const draft = tenant?.landingPageConfigDraft as unknown as LandingPageConfig;
      const allSections = Object.values(draft.pages as PagesConfig).flatMap((p) => p.sections);
      const matchingSections = allSections.filter(
        (s) => 'id' in s && (s as { id: string }).id === sharedId
      );

      expect(matchingSections).toHaveLength(1);
    });

    it('should handle high-concurrency section creation (5 simultaneous)', async () => {
      // Arrange: Get executor
      const updateExecutor = getProposalExecutor('update_page_section');
      if (!updateExecutor) {
        throw new Error('update_page_section executor not registered');
      }

      // Use valid section ID format: {page}-{type}-{qualifier}
      const uniqueQualifier = `${Date.now() % 10000}`;
      const sharedId = `home-text-${uniqueQualifier}` as const;
      const pages = ['home', 'about', 'services', 'faq', 'contact'];

      // Create 5 payloads that try to create sections with the same ID on different pages
      const payloads = pages.map((pageName, i) => ({
        pageName,
        sectionIndex: -1,
        sectionData: {
          type: 'text',
          id: sharedId, // Same ID for all - should conflict
          content: `Request ${i + 1}`,
        },
      }));

      // Act: Fire all requests concurrently
      const results = await Promise.allSettled(
        payloads.map((payload) => updateExecutor(testTenantId, payload))
      );

      // Assert: Only one should succeed
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(4);

      // All failures should mention duplicate ID
      failed.forEach((result) => {
        const rejection = result as PromiseRejectedResult;
        expect(rejection.reason.message).toContain('already exists');
      });

      // Verify only one section with this ID exists
      const tenant = await ctx.prisma.tenant.findUnique({
        where: { id: testTenantId },
        select: { landingPageConfigDraft: true },
      });

      const draft = tenant?.landingPageConfigDraft as unknown as LandingPageConfig;
      const allSections = Object.values(draft.pages as PagesConfig).flatMap((p) => p.sections);
      const matchingSections = allSections.filter(
        (s) => 'id' in s && (s as { id: string }).id === sharedId
      );

      expect(matchingSections).toHaveLength(1);
    });

    it('should allow concurrent updates with different section IDs', async () => {
      // Arrange: Get executor
      const updateExecutor = getProposalExecutor('update_page_section');
      if (!updateExecutor) {
        throw new Error('update_page_section executor not registered');
      }

      // Use valid section ID format: {page}-{type}-{qualifier}
      const baseQualifier = Date.now() % 10000;

      // Create payloads with UNIQUE IDs - each section has a different ID
      const payloads = [
        {
          pageName: 'home',
          sectionIndex: -1,
          sectionData: {
            type: 'text',
            id: `home-text-${baseQualifier}`,
            content: 'Section 1',
          },
        },
        {
          pageName: 'about',
          sectionIndex: -1,
          sectionData: {
            type: 'text',
            id: `about-text-${baseQualifier}`,
            content: 'Section 2',
          },
        },
        {
          pageName: 'services',
          sectionIndex: -1,
          sectionData: {
            type: 'text',
            id: `services-text-${baseQualifier}`,
            content: 'Section 3',
          },
        },
      ];

      // Act: Fire all requests concurrently
      // Note: With advisory locks, concurrent updates are serialized per tenant
      // but should all succeed since they have different IDs
      const results = await Promise.allSettled(
        payloads.map((payload) => updateExecutor(testTenantId, payload))
      );

      // Assert: All should succeed since IDs are unique
      const succeeded = results.filter((r) => r.status === 'fulfilled');

      expect(succeeded).toHaveLength(3);

      // Verify all three sections exist
      const tenant = await ctx.prisma.tenant.findUnique({
        where: { id: testTenantId },
        select: { landingPageConfigDraft: true },
      });

      const draft = tenant?.landingPageConfigDraft as unknown as LandingPageConfig;
      const allSections = Object.values(draft.pages as PagesConfig).flatMap((p) => p.sections);
      const matchingSections = allSections.filter(
        (s) => 'id' in s && (s as { id: string }).id.includes(`-text-${baseQualifier}`)
      );

      expect(matchingSections).toHaveLength(3);
    });
  });

  describe('Transaction Isolation', () => {
    it('should isolate concurrent updates between different tenants', async () => {
      // Create second tenant
      await ctx.tenants.tenantB.create();
      const tenantBId = ctx.tenants.tenantB.id;

      // Initialize tenant B with draft config
      await ctx.prisma.tenant.update({
        where: { id: tenantBId },
        data: {
          landingPageConfigDraft: {
            pages: DEFAULT_PAGES_CONFIG,
          },
        },
      });

      // Arrange: Get executor
      const updateExecutor = getProposalExecutor('update_page_section');
      if (!updateExecutor) {
        throw new Error('update_page_section executor not registered');
      }

      // Use valid section ID format: {page}-{type}-{qualifier}
      const uniqueQualifier = `${Date.now() % 10000}`;
      const sharedId = `home-text-${uniqueQualifier}` as const;

      // Same ID used by both tenants (should be allowed - IDs are tenant-scoped)
      const payloadA = {
        pageName: 'home',
        sectionIndex: -1,
        sectionData: {
          type: 'text',
          id: sharedId,
          content: 'Tenant A section',
        },
      };

      const payloadB = {
        pageName: 'home',
        sectionIndex: -1,
        sectionData: {
          type: 'text',
          id: sharedId, // Same ID, different tenant - should be allowed
          content: 'Tenant B section',
        },
      };

      // Act: Fire concurrent updates for both tenants
      const results = await Promise.allSettled([
        updateExecutor(testTenantId, payloadA),
        updateExecutor(tenantBId, payloadB),
      ]);

      // Assert: Both should succeed (different tenants have separate namespaces)
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      expect(succeeded).toHaveLength(2);

      // Verify each tenant has exactly one section with the ID
      const [tenantA, tenantB] = await Promise.all([
        ctx.prisma.tenant.findUnique({
          where: { id: testTenantId },
          select: { landingPageConfigDraft: true },
        }),
        ctx.prisma.tenant.findUnique({
          where: { id: tenantBId },
          select: { landingPageConfigDraft: true },
        }),
      ]);

      const draftA = tenantA?.landingPageConfigDraft as unknown as LandingPageConfig;
      const draftB = tenantB?.landingPageConfigDraft as unknown as LandingPageConfig;

      const sectionsA = Object.values(draftA.pages as PagesConfig).flatMap((p) => p.sections);
      const sectionsB = Object.values(draftB.pages as PagesConfig).flatMap((p) => p.sections);

      const matchA = sectionsA.filter((s) => 'id' in s && (s as { id: string }).id === sharedId);
      const matchB = sectionsB.filter((s) => 'id' in s && (s as { id: string }).id === sharedId);

      expect(matchA).toHaveLength(1);
      expect(matchB).toHaveLength(1);
    });
  });

  describe('Lock Contention Performance', () => {
    it('should complete concurrent updates within acceptable latency', async () => {
      // Arrange: Get executor
      const updateExecutor = getProposalExecutor('update_page_section');
      if (!updateExecutor) {
        throw new Error('update_page_section executor not registered');
      }

      // Use valid section ID format: {page}-{type}-{qualifier}
      const baseQualifier = Date.now() % 10000;

      // Create 3 unique payloads with valid section IDs
      const payloads = Array.from({ length: 3 }, (_, i) => ({
        pageName: 'home',
        sectionIndex: -1,
        sectionData: {
          type: 'text',
          id: `home-text-${baseQualifier + i}`,
          content: `Latency test section ${i}`,
        },
      }));

      // Act: Measure time for concurrent execution
      const startTime = Date.now();
      await Promise.allSettled(payloads.map((payload) => updateExecutor(testTenantId, payload)));
      const elapsed = Date.now() - startTime;

      // Assert: Should complete within acceptable time (< 3000ms)
      // Advisory locks add some latency due to serialization, but should be reasonable
      expect(elapsed).toBeLessThan(3000);
    });
  });
});
