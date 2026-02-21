/**
 * BackgroundBuildService Unit Tests (Phase 4 — Onboarding Redesign)
 *
 * Tests the public API surface of BackgroundBuildService:
 * 1. triggerBuild — happy path: sets QUEUED, calls setImmediate
 * 2. triggerBuild — idempotency: duplicate key returns { triggered: false }
 * 3. getBuildStatus — correct shape for every build state
 * 4. getBuildStatus — stuck build detection (11081)
 * 5. retryBuild — only works from FAILED or stuck states
 * 6. retryBuild — max retry enforcement (11075)
 * 7. deriveSectionStatus — all status -> section-status mappings (via getBuildStatus)
 * 8. generateFallbackContent — valid content shape for HERO, ABOUT, SERVICES
 *    (tested through executeBuild by forcing LLM mock to throw, then verifying
 *    sectionContent.addSection is called with the expected shape)
 *
 * Concurrency / advisory-lock is tested at the mock level
 * (prisma.$transaction wrapping pg_try_advisory_xact_lock).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tenant } from '../../generated/prisma/client';
import { Prisma } from '../../generated/prisma/client';

// ---------------------------------------------------------------------------
// Mock logger — must be declared before importing the module under test
// ---------------------------------------------------------------------------
vi.mock('../../lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock vertex-client so LLM is never called in unit tests.
// By default the mock throws, which drives the fallback-content path.
// ---------------------------------------------------------------------------
vi.mock('../../llm/vertex-client', () => ({
  getVertexClient: vi.fn(() => {
    throw new Error('LLM not available in unit tests');
  }),
  DEFAULT_MODEL: 'gemini-pro',
}));

import { BackgroundBuildService, BUILD_STATUS } from '../background-build.service';
import type { BuildStatusResponse } from '../background-build.service';

// ---------------------------------------------------------------------------
// Helper: build a minimal Tenant-like object for mock returns
// ---------------------------------------------------------------------------
function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'tenant_abc123',
    slug: 'test-tenant',
    name: 'Test Tenant',
    apiKeyPublic: 'pk_live_test_abc',
    apiKeySecret: 'sk_live_test_abc',
    commissionPercent: 0,
    branding: {
      discoveryFacts: {
        businessName: 'Acme Photography',
        businessType: 'photographer',
        location: 'San Francisco',
        servicesOffered: 'portrait, event, product photography',
        uniqueValue: 'Candid storytelling with a documentary approach.',
        approach: 'Low-key, no posing. I follow the light.',
      },
    },
    stripeAccountId: null,
    stripeOnboarded: false,
    secrets: null,
    isActive: true,
    email: 'owner@acme.com',
    passwordHash: null,
    emailVerified: true,
    passwordResetToken: null,
    passwordResetExpires: null,
    trialEndsAt: null,
    subscriptionStatus: 'NONE',
    stripeCustomerId: null,
    tier: 'FREE',
    aiMessagesUsed: 0,
    aiMessagesResetAt: null,
    onboardingStatus: 'BUILDING',
    onboardingCompletedAt: null,
    revealCompletedAt: null,
    buildStatus: null,
    buildError: null,
    buildIdempotencyKey: null,
    buildSectionResults: null,
    buildStartedAt: null,
    buildRetryCount: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as unknown as Tenant;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeTenantRepo(tenantOverrides: Partial<Tenant> = {}) {
  return {
    findById: vi.fn().mockResolvedValue(makeTenant(tenantOverrides)),
    update: vi.fn().mockResolvedValue(makeTenant(tenantOverrides)),
  };
}

function makeSectionContent() {
  return {
    addSection: vi.fn().mockResolvedValue({
      success: true,
      hasDraft: true,
      visibility: 'draft' as const,
      message: 'Section added',
      sectionId: 'section_1',
      blockType: 'HERO',
    }),
  };
}

function makeDiscoveryService(
  overrides: Partial<{ success: boolean; factCount: number; facts: Record<string, unknown> }> = {}
) {
  return {
    getDiscoveryFacts: vi.fn().mockResolvedValue({
      success: true,
      factCount: 3,
      factKeys: ['businessName', 'businessType', 'location'],
      message: 'ok',
      facts: {
        businessName: 'Acme Photography',
        businessType: 'photographer',
        location: 'San Francisco',
      },
      ...overrides,
    }),
  };
}

function makePrisma() {
  // The service uses prisma.$transaction() with pg_try_advisory_xact_lock inside.
  // The callback receives a transaction client (tx) that also has $queryRaw.
  const txClient = {
    $queryRaw: vi.fn().mockResolvedValue([{ pg_try_advisory_xact_lock: true }]),
  };

  return {
    $transaction: vi.fn(async (callback: (tx: typeof txClient) => Promise<void>) => {
      await callback(txClient);
    }),
    // Exposed for tests to override advisory lock behavior
    _txClient: txClient,
  };
}

// Convenience: build a default service with all mocks in place
function buildService(
  tenantOverrides: Partial<Tenant> = {},
  discoveryOverrides: Parameters<typeof makeDiscoveryService>[0] = {}
) {
  const tenantRepo = makeTenantRepo(tenantOverrides);
  const sectionContent = makeSectionContent();
  const discoveryService = makeDiscoveryService(discoveryOverrides);
  const prisma = makePrisma();

  const service = new BackgroundBuildService(
    tenantRepo as any,
    sectionContent as any,
    discoveryService as any,
    prisma as any
  );

  return { service, tenantRepo, sectionContent, discoveryService, prisma };
}

// ---------------------------------------------------------------------------
// Helpers for async setImmediate flush
// ---------------------------------------------------------------------------

/** Flush pending setImmediate callbacks so executeBuild runs synchronously in tests. */
async function flushSetImmediate(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

// ===========================================================================
// Tests: BackgroundBuildService
// ===========================================================================

describe('BackgroundBuildService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // triggerBuild
  // =========================================================================

  describe('triggerBuild', () => {
    it('sets buildStatus to QUEUED with buildStartedAt and returns { triggered: true }', async () => {
      const { service, tenantRepo } = buildService();

      const result = await service.triggerBuild('tenant_abc123');

      expect(result).toEqual({ triggered: true });
      expect(tenantRepo.update).toHaveBeenCalledWith('tenant_abc123', {
        buildStatus: BUILD_STATUS.QUEUED,
        buildError: null,
        buildIdempotencyKey: null,
        buildStartedAt: expect.any(Date),
        buildSectionResults: Prisma.DbNull,
      });
    });

    it('stores idempotency key when provided', async () => {
      const { service, tenantRepo } = buildService();

      await service.triggerBuild('tenant_abc123', 'idem-key-42');

      expect(tenantRepo.update).toHaveBeenCalledWith('tenant_abc123', {
        buildStatus: BUILD_STATUS.QUEUED,
        buildError: null,
        buildIdempotencyKey: 'idem-key-42',
        buildStartedAt: expect.any(Date),
        buildSectionResults: Prisma.DbNull,
      });
    });

    it('invokes setImmediate to fire-and-forget the pipeline', async () => {
      const setImmediateSpy = vi.spyOn(global, 'setImmediate');
      const { service } = buildService();

      await service.triggerBuild('tenant_abc123');

      expect(setImmediateSpy).toHaveBeenCalledOnce();
      setImmediateSpy.mockRestore();
    });

    it('returns immediately without waiting for the build pipeline', async () => {
      const { service, sectionContent } = buildService();
      // addSection is async — if triggerBuild awaited the pipeline, it would be called before returning
      const result = await service.triggerBuild('tenant_abc123');

      // At this point the setImmediate callback has NOT yet run
      expect(result).toEqual({ triggered: true });
      expect(sectionContent.addSection).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // triggerBuild — idempotency
  // =========================================================================

  describe('triggerBuild with duplicate idempotency key', () => {
    it('returns { triggered: false } when buildIdempotencyKey matches', async () => {
      const { service, tenantRepo } = buildService({
        buildIdempotencyKey: 'idem-key-42',
      });

      const result = await service.triggerBuild('tenant_abc123', 'idem-key-42');

      expect(result).toEqual({ triggered: false });
      // update should NOT be called — duplicate was detected
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('triggers a new build when idempotency key differs', async () => {
      const { service, tenantRepo } = buildService({
        buildIdempotencyKey: 'old-key',
      });

      const result = await service.triggerBuild('tenant_abc123', 'new-key');

      expect(result).toEqual({ triggered: true });
      expect(tenantRepo.update).toHaveBeenCalled();
    });

    it('triggers without idempotency check when key is omitted', async () => {
      // Even if tenant has a stored key, omitting the key in the call skips the check
      const { service, tenantRepo } = buildService({
        buildIdempotencyKey: 'some-old-key',
      });

      const result = await service.triggerBuild('tenant_abc123');

      expect(result).toEqual({ triggered: true });
      // findById should NOT have been called (no key to check)
      expect(tenantRepo.findById).not.toHaveBeenCalledBefore(tenantRepo.update as any);
      expect(tenantRepo.update).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // getBuildStatus
  // =========================================================================

  describe('getBuildStatus', () => {
    it('returns null status shape when tenant is not found', async () => {
      const { service, tenantRepo } = buildService();
      tenantRepo.findById.mockResolvedValue(null);

      const result = await service.getBuildStatus('tenant_abc123');

      expect(result).toEqual<BuildStatusResponse>({
        buildStatus: null,
        buildError: null,
        sections: { hero: 'pending', about: 'pending', services: 'pending' },
      });
    });

    it('returns QUEUED status with all sections pending', async () => {
      const { service } = buildService({ buildStatus: BUILD_STATUS.QUEUED, buildError: null });

      const result = await service.getBuildStatus('tenant_abc123');

      expect(result).toEqual<BuildStatusResponse>({
        buildStatus: BUILD_STATUS.QUEUED,
        buildError: null,
        sections: { hero: 'pending', about: 'pending', services: 'pending' },
      });
    });

    it('returns GENERATING_HERO status', async () => {
      const { service } = buildService({ buildStatus: BUILD_STATUS.GENERATING_HERO });

      const result = await service.getBuildStatus('tenant_abc123');

      expect(result.buildStatus).toBe(BUILD_STATUS.GENERATING_HERO);
      expect(result.sections).toEqual({
        hero: 'generating',
        about: 'pending',
        services: 'pending',
      });
    });

    it('returns GENERATING_ABOUT status with hero complete', async () => {
      const { service } = buildService({ buildStatus: BUILD_STATUS.GENERATING_ABOUT });

      const result = await service.getBuildStatus('tenant_abc123');

      expect(result.buildStatus).toBe(BUILD_STATUS.GENERATING_ABOUT);
      expect(result.sections).toEqual({
        hero: 'complete',
        about: 'generating',
        services: 'pending',
      });
    });

    it('returns GENERATING_SERVICES status with hero and about complete', async () => {
      const { service } = buildService({ buildStatus: BUILD_STATUS.GENERATING_SERVICES });

      const result = await service.getBuildStatus('tenant_abc123');

      expect(result.buildStatus).toBe(BUILD_STATUS.GENERATING_SERVICES);
      expect(result.sections).toEqual({
        hero: 'complete',
        about: 'complete',
        services: 'generating',
      });
    });

    it('returns COMPLETE status with all sections complete', async () => {
      const { service } = buildService({ buildStatus: BUILD_STATUS.COMPLETE, buildError: null });

      const result = await service.getBuildStatus('tenant_abc123');

      expect(result).toEqual<BuildStatusResponse>({
        buildStatus: BUILD_STATUS.COMPLETE,
        buildError: null,
        sections: { hero: 'complete', about: 'complete', services: 'complete' },
      });
    });

    it('returns FAILED status with all sections failed and error message', async () => {
      const { service } = buildService({
        buildStatus: BUILD_STATUS.FAILED,
        buildError: 'Build failed. Please try again.',
      });

      const result = await service.getBuildStatus('tenant_abc123');

      expect(result).toEqual<BuildStatusResponse>({
        buildStatus: BUILD_STATUS.FAILED,
        buildError: 'Build failed. Please try again.',
        sections: { hero: 'failed', about: 'failed', services: 'failed' },
      });
    });

    it('returns all-pending for null buildStatus (not yet started)', async () => {
      const { service } = buildService({ buildStatus: null });

      const result = await service.getBuildStatus('tenant_abc123');

      expect(result.sections).toEqual({ hero: 'pending', about: 'pending', services: 'pending' });
    });

    it('returns all-pending for unknown buildStatus values', async () => {
      const { service } = buildService({ buildStatus: 'UNKNOWN_FUTURE_STATE' });

      const result = await service.getBuildStatus('tenant_abc123');

      expect(result.sections).toEqual({ hero: 'pending', about: 'pending', services: 'pending' });
    });

    it('auto-fails a stuck build that exceeds timeout (11081)', async () => {
      // Build started 5 minutes ago — well past the STUCK_BUILD_TIMEOUT_MS (4 min)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const { service, tenantRepo } = buildService({
        buildStatus: BUILD_STATUS.GENERATING_HERO,
        buildStartedAt: fiveMinAgo,
      });

      const result = await service.getBuildStatus('tenant_abc123');

      expect(result.buildStatus).toBe(BUILD_STATUS.FAILED);
      expect(result.buildError).toBe('Build timed out. Please try again.');
      // Should have called setBuildFailed
      expect(tenantRepo.update).toHaveBeenCalledWith('tenant_abc123', {
        buildStatus: BUILD_STATUS.FAILED,
        buildError: 'Build timed out. Please try again.',
      });
    });

    it('does NOT auto-fail builds within the timeout window', async () => {
      // Build started 1 minute ago — well within the timeout
      const oneMinAgo = new Date(Date.now() - 60 * 1000);
      const { service, tenantRepo } = buildService({
        buildStatus: BUILD_STATUS.GENERATING_HERO,
        buildStartedAt: oneMinAgo,
      });

      const result = await service.getBuildStatus('tenant_abc123');

      expect(result.buildStatus).toBe(BUILD_STATUS.GENERATING_HERO);
      // update should NOT have been called for stuck detection
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('does NOT auto-fail COMPLETE or FAILED builds regardless of time', async () => {
      const longAgo = new Date(Date.now() - 10 * 60 * 1000);

      // Test COMPLETE
      const { service: completeService, tenantRepo: completeRepo } = buildService({
        buildStatus: BUILD_STATUS.COMPLETE,
        buildStartedAt: longAgo,
      });
      const completeResult = await completeService.getBuildStatus('tenant_abc123');
      expect(completeResult.buildStatus).toBe(BUILD_STATUS.COMPLETE);
      expect(completeRepo.update).not.toHaveBeenCalled();

      // Test FAILED
      const { service: failedService, tenantRepo: failedRepo } = buildService({
        buildStatus: BUILD_STATUS.FAILED,
        buildStartedAt: longAgo,
      });
      const failedResult = await failedService.getBuildStatus('tenant_abc123');
      expect(failedResult.buildStatus).toBe(BUILD_STATUS.FAILED);
      expect(failedRepo.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // retryBuild
  // =========================================================================

  describe('retryBuild', () => {
    it('triggers a new build when current status is FAILED', async () => {
      const { service, tenantRepo } = buildService({ buildStatus: BUILD_STATUS.FAILED });

      const result = await service.retryBuild('tenant_abc123');

      expect(result).toEqual({ triggered: true });
      // First call: increment buildRetryCount
      expect(tenantRepo.update).toHaveBeenCalledWith('tenant_abc123', {
        buildRetryCount: 1,
      });
      // Second call: triggerBuild sets QUEUED
      expect(tenantRepo.update).toHaveBeenCalledWith('tenant_abc123', {
        buildStatus: BUILD_STATUS.QUEUED,
        buildError: null,
        buildIdempotencyKey: null,
        buildStartedAt: expect.any(Date),
        buildSectionResults: Prisma.DbNull,
      });
    });

    it('returns error when status is QUEUED and not stuck', async () => {
      const { service, tenantRepo } = buildService({
        buildStatus: BUILD_STATUS.QUEUED,
        buildStartedAt: new Date(), // just started
      });

      const result = await service.retryBuild('tenant_abc123');

      expect(result).toEqual({
        triggered: false,
        error: 'Build is not in a retryable state.',
      });
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('returns error when status is COMPLETE', async () => {
      const { service, tenantRepo } = buildService({ buildStatus: BUILD_STATUS.COMPLETE });

      const result = await service.retryBuild('tenant_abc123');

      expect(result).toEqual({
        triggered: false,
        error: 'Build is not in a retryable state.',
      });
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('returns error when status is GENERATING_HERO and not stuck', async () => {
      const { service, tenantRepo } = buildService({
        buildStatus: BUILD_STATUS.GENERATING_HERO,
        buildStartedAt: new Date(), // just started
      });

      const result = await service.retryBuild('tenant_abc123');

      expect(result).toEqual({
        triggered: false,
        error: 'Build is not in a retryable state.',
      });
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('returns error when tenant is not found', async () => {
      const { service, tenantRepo } = buildService();
      tenantRepo.findById.mockResolvedValue(null);

      const result = await service.retryBuild('tenant_abc123');

      expect(result).toEqual({
        triggered: false,
        error: 'Tenant not found',
      });
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('does NOT include an idempotency key when re-triggering', async () => {
      const { service, tenantRepo } = buildService({ buildStatus: BUILD_STATUS.FAILED });

      await service.retryBuild('tenant_abc123');

      // The triggerBuild call should have null idempotencyKey
      expect(tenantRepo.update).toHaveBeenCalledWith('tenant_abc123', {
        buildStatus: BUILD_STATUS.QUEUED,
        buildError: null,
        buildIdempotencyKey: null,
        buildStartedAt: expect.any(Date),
        buildSectionResults: Prisma.DbNull,
      });
    });

    it('allows retry from stuck QUEUED state (11081)', async () => {
      // Build started 5 minutes ago — past STUCK_BUILD_TIMEOUT_MS (4 min)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const { service, tenantRepo } = buildService({
        buildStatus: BUILD_STATUS.QUEUED,
        buildStartedAt: fiveMinAgo,
      });

      const result = await service.retryBuild('tenant_abc123');

      expect(result).toEqual({ triggered: true });
      expect(tenantRepo.update).toHaveBeenCalledWith('tenant_abc123', {
        buildRetryCount: 1,
      });
    });

    it('allows retry from stuck GENERATING state (11081)', async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const { service } = buildService({
        buildStatus: BUILD_STATUS.GENERATING_ABOUT,
        buildStartedAt: fiveMinAgo,
      });

      const result = await service.retryBuild('tenant_abc123');

      expect(result).toEqual({ triggered: true });
    });

    it('rejects retry when max retries exceeded (11075)', async () => {
      const { service, tenantRepo } = buildService({
        buildStatus: BUILD_STATUS.FAILED,
        buildRetryCount: 5, // MAX_BUILD_RETRIES
      });

      const result = await service.retryBuild('tenant_abc123');

      expect(result).toEqual({
        triggered: false,
        error: 'Maximum build retries exceeded. Please contact support.',
      });
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('increments buildRetryCount before re-triggering', async () => {
      const { service, tenantRepo } = buildService({
        buildStatus: BUILD_STATUS.FAILED,
        buildRetryCount: 2,
      });

      await service.retryBuild('tenant_abc123');

      // First update call should increment retry count
      const firstCall = tenantRepo.update.mock.calls[0];
      expect(firstCall[1]).toEqual({ buildRetryCount: 3 });
    });
  });

  // =========================================================================
  // deriveSectionStatus — exhaustive mapping via getBuildStatus
  // =========================================================================

  describe('deriveSectionStatus (via getBuildStatus)', () => {
    const STATUS_SECTION_MAP: Array<[string | null, Record<string, string>]> = [
      [null, { hero: 'pending', about: 'pending', services: 'pending' }],
      [BUILD_STATUS.QUEUED, { hero: 'pending', about: 'pending', services: 'pending' }],
      [BUILD_STATUS.GENERATING_HERO, { hero: 'generating', about: 'pending', services: 'pending' }],
      [
        BUILD_STATUS.GENERATING_ABOUT,
        { hero: 'complete', about: 'generating', services: 'pending' },
      ],
      [
        BUILD_STATUS.GENERATING_SERVICES,
        { hero: 'complete', about: 'complete', services: 'generating' },
      ],
      [BUILD_STATUS.COMPLETE, { hero: 'complete', about: 'complete', services: 'complete' }],
      [BUILD_STATUS.FAILED, { hero: 'failed', about: 'failed', services: 'failed' }],
    ];

    it.each(STATUS_SECTION_MAP)(
      'buildStatus=%s -> sections=%o',
      async (buildStatus, expectedSections) => {
        const { service } = buildService({ buildStatus: buildStatus as string | null });

        const result = await service.getBuildStatus('tenant_abc123');

        expect(result.sections).toEqual(expectedSections);
      }
    );
  });

  // =========================================================================
  // generateFallbackContent — via executeBuild (LLM throws -> fallback used)
  // =========================================================================

  describe('generateFallbackContent (LLM unavailable path)', () => {
    // The vi.mock at the top makes vertex-client throw, so executeBuild always
    // takes the fallback path. We flush setImmediate to run the pipeline.

    it('produces valid HERO section content with expected fields', async () => {
      const { service, sectionContent } = buildService(
        { buildStatus: null },
        {
          facts: {
            businessName: 'Acme Photography',
            businessType: 'photographer',
            location: 'San Francisco',
          },
        }
      );

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      // Give async operations inside executeBuild time to settle
      await new Promise((r) => setTimeout(r, 0));

      const heroCalls = (sectionContent.addSection as ReturnType<typeof vi.fn>).mock.calls.filter(
        (args: unknown[]) => args[2] === 'HERO'
      );

      expect(heroCalls.length).toBeGreaterThanOrEqual(1);
      const [, , , heroContent] = heroCalls[0] as [string, string, string, Record<string, unknown>];

      // Fallback HERO must contain: headline, subheadline, ctaText, alignment, visible
      expect(typeof heroContent.headline).toBe('string');
      expect(typeof heroContent.subheadline).toBe('string');
      expect(typeof heroContent.ctaText).toBe('string');
      expect(heroContent.visible).toBe(true);
    });

    it('produces valid ABOUT section content with expected fields', async () => {
      const { service, sectionContent } = buildService(
        { buildStatus: null },
        {
          facts: {
            businessName: 'Acme Photography',
            uniqueValue: 'Candid storytelling.',
            approach: 'Documentary style, no posing.',
            location: 'San Francisco',
          },
        }
      );

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 0));

      const aboutCalls = (sectionContent.addSection as ReturnType<typeof vi.fn>).mock.calls.filter(
        (args: unknown[]) => args[2] === 'ABOUT'
      );

      expect(aboutCalls.length).toBeGreaterThanOrEqual(1);
      const [, , , aboutContent] = aboutCalls[0] as [
        string,
        string,
        string,
        Record<string, unknown>,
      ];

      expect(typeof aboutContent.title).toBe('string');
      expect(typeof aboutContent.body).toBe('string');
      expect(aboutContent.visible).toBe(true);
      // Body should include unique value and approach
      expect(aboutContent.body).toContain('Candid storytelling.');
    });

    it('produces valid SERVICES section content with expected fields', async () => {
      const { service, sectionContent } = buildService(
        { buildStatus: null },
        {
          facts: {
            businessName: 'Acme Photography',
            servicesOffered: 'portrait, event, product photography',
          },
        }
      );

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 0));

      const servicesCalls = (
        sectionContent.addSection as ReturnType<typeof vi.fn>
      ).mock.calls.filter((args: unknown[]) => args[2] === 'SERVICES');

      expect(servicesCalls.length).toBeGreaterThanOrEqual(1);
      const [, , , servicesContent] = servicesCalls[0] as [
        string,
        string,
        string,
        Record<string, unknown>,
      ];

      expect(typeof servicesContent.title).toBe('string');
      expect(typeof servicesContent.subtitle).toBe('string');
      expect(servicesContent.layout).toBe('cards');
      expect(servicesContent.showPricing).toBe(true);
      expect(servicesContent.visible).toBe(true);
    });

    it('truncates long servicesOffered at 200 chars with ellipsis', async () => {
      const longServices = 'a'.repeat(250);
      const { service, sectionContent } = buildService(
        { buildStatus: null },
        { facts: { servicesOffered: longServices } }
      );

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 0));

      const servicesCalls = (
        sectionContent.addSection as ReturnType<typeof vi.fn>
      ).mock.calls.filter((args: unknown[]) => args[2] === 'SERVICES');
      expect(servicesCalls.length).toBeGreaterThanOrEqual(1);
      const [, , , servicesContent] = servicesCalls[0] as [
        string,
        string,
        string,
        Record<string, unknown>,
      ];

      expect(String(servicesContent.subtitle).length).toBeLessThanOrEqual(200);
      expect(String(servicesContent.subtitle).endsWith('...')).toBe(true);
    });

    it('uses "Your Business" as fallback headline when businessName is absent', async () => {
      const { service, sectionContent } = buildService(
        { buildStatus: null },
        { facts: {} } // No businessName
      );

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 0));

      const heroCalls = (sectionContent.addSection as ReturnType<typeof vi.fn>).mock.calls.filter(
        (args: unknown[]) => args[2] === 'HERO'
      );
      if (heroCalls.length > 0) {
        const [, , , heroContent] = heroCalls[0] as [
          string,
          string,
          string,
          Record<string, unknown>,
        ];
        expect(heroContent.headline).toBe('Your Business');
      }
    });

    it('calls addSection for all three MVP sections in order', async () => {
      const { service, sectionContent } = buildService(
        { buildStatus: null },
        {
          facts: {
            businessName: 'Studio X',
            businessType: 'photographer',
          },
        }
      );

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 0));

      const sectionTypes = (sectionContent.addSection as ReturnType<typeof vi.fn>).mock.calls.map(
        (args: unknown[]) => args[2]
      );

      expect(sectionTypes).toContain('HERO');
      expect(sectionTypes).toContain('ABOUT');
      expect(sectionTypes).toContain('SERVICES');
      // Verify sequential order
      const heroIdx = sectionTypes.indexOf('HERO');
      const aboutIdx = sectionTypes.indexOf('ABOUT');
      const servicesIdx = sectionTypes.indexOf('SERVICES');
      expect(heroIdx).toBeLessThan(aboutIdx);
      expect(aboutIdx).toBeLessThan(servicesIdx);
    });
  });

  // =========================================================================
  // executeBuild side effects — status transitions
  // =========================================================================

  describe('executeBuild — build pipeline status transitions', () => {
    it('advances to COMPLETE and sets onboardingStatus=SETUP when all sections succeed', async () => {
      const { service, tenantRepo } = buildService(
        { buildStatus: null },
        {
          facts: { businessName: 'Studio X', businessType: 'photographer' },
        }
      );

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 0));

      const completeCalls = tenantRepo.update.mock.calls.filter(
        (args: unknown[]) =>
          (args[1] as Record<string, unknown>).buildStatus === BUILD_STATUS.COMPLETE
      );
      expect(completeCalls.length).toBeGreaterThanOrEqual(1);

      const finalUpdatePayload = completeCalls[completeCalls.length - 1][1] as Record<
        string,
        unknown
      >;
      expect(finalUpdatePayload.onboardingStatus).toBe('SETUP');
    });

    it('sets FAILED status when no discovery facts exist', async () => {
      const { service, tenantRepo } = buildService(
        { buildStatus: null },
        { success: true, factCount: 0, facts: {} }
      );

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 0));

      const failedCalls = tenantRepo.update.mock.calls.filter(
        (args: unknown[]) =>
          (args[1] as Record<string, unknown>).buildStatus === BUILD_STATUS.FAILED
      );
      expect(failedCalls.length).toBeGreaterThanOrEqual(1);

      const failPayload = failedCalls[0][1] as Record<string, unknown>;
      expect(typeof failPayload.buildError).toBe('string');
      expect(String(failPayload.buildError)).toContain('No discovery facts found');
    });

    it('sets FAILED when discovery service returns success=false', async () => {
      const { service, tenantRepo } = buildService(
        { buildStatus: null },
        { success: false, factCount: 0, facts: {} }
      );

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 0));

      const failedCalls = tenantRepo.update.mock.calls.filter(
        (args: unknown[]) =>
          (args[1] as Record<string, unknown>).buildStatus === BUILD_STATUS.FAILED
      );
      expect(failedCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('moves through GENERATING_HERO -> GENERATING_ABOUT -> GENERATING_SERVICES status updates', async () => {
      const { service, tenantRepo } = buildService(
        { buildStatus: null },
        {
          facts: { businessName: 'Studio X', businessType: 'photographer' },
        }
      );

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 0));

      const statusSequence = tenantRepo.update.mock.calls.map(
        (args: unknown[]) => (args[1] as Record<string, unknown>).buildStatus
      );

      expect(statusSequence).toContain(BUILD_STATUS.GENERATING_HERO);
      expect(statusSequence).toContain(BUILD_STATUS.GENERATING_ABOUT);
      expect(statusSequence).toContain(BUILD_STATUS.GENERATING_SERVICES);
    });

    it('does not advance to COMPLETE when advisory lock cannot be acquired', async () => {
      const { service, tenantRepo, prisma } = buildService({ buildStatus: null });
      // Make the lock fail inside the transaction
      prisma._txClient.$queryRaw.mockResolvedValueOnce([{ pg_try_advisory_xact_lock: false }]);

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 0));

      // Only QUEUED update should have been called (triggerBuild), no further status changes
      const buildStatusUpdates = tenantRepo.update.mock.calls.filter((args: unknown[]) => {
        const payload = args[1] as Record<string, unknown>;
        return payload.buildStatus && payload.buildStatus !== BUILD_STATUS.QUEUED;
      });
      expect(buildStatusUpdates).toHaveLength(0);
    });

    it('persists per-section results during build (11077)', async () => {
      const { service, tenantRepo } = buildService(
        { buildStatus: null },
        {
          facts: { businessName: 'Studio X', businessType: 'photographer' },
        }
      );

      await service.triggerBuild('tenant_abc123');
      await flushSetImmediate();
      await new Promise((r) => setTimeout(r, 0));

      // Find calls that set buildSectionResults (excluding the DbNull reset in triggerBuild)
      const sectionResultCalls = tenantRepo.update.mock.calls.filter(
        (args: unknown[]) =>
          (args[1] as Record<string, unknown>).buildSectionResults !== undefined &&
          (args[1] as Record<string, unknown>).buildSectionResults !== Prisma.DbNull
      );
      // Should have at least 3 incremental updates (one per section) plus the final update
      expect(sectionResultCalls.length).toBeGreaterThanOrEqual(3);
    });
  });

  // =========================================================================
  // Build route integration (service boundary) — build-status + retry
  // =========================================================================

  describe('route-level integration: GET /build-status via service', () => {
    it('getBuildStatus returns the correct shape when polled mid-build (GENERATING_ABOUT)', async () => {
      const { service } = buildService({
        buildStatus: BUILD_STATUS.GENERATING_ABOUT,
        buildError: null,
      });

      const status = await service.getBuildStatus('tenant_abc123');

      expect(status).toMatchObject({
        buildStatus: BUILD_STATUS.GENERATING_ABOUT,
        buildError: null,
        sections: {
          hero: 'complete',
          about: 'generating',
          services: 'pending',
        },
      });
    });
  });

  describe('route-level integration: POST /build/retry via service', () => {
    it('retry from FAILED re-queues and returns triggered=true', async () => {
      const { service } = buildService({ buildStatus: BUILD_STATUS.FAILED });

      const result = await service.retryBuild('tenant_abc123');

      expect(result).toEqual({ triggered: true });
    });

    it('retry from non-FAILED and non-stuck returns triggered=false with error', async () => {
      for (const status of [
        BUILD_STATUS.QUEUED,
        BUILD_STATUS.GENERATING_HERO,
        BUILD_STATUS.GENERATING_ABOUT,
        BUILD_STATUS.GENERATING_SERVICES,
        BUILD_STATUS.COMPLETE,
      ]) {
        const { service } = buildService({
          buildStatus: status,
          buildStartedAt: new Date(), // recently started, not stuck
        });
        const result = await service.retryBuild('tenant_abc123');
        expect(result.triggered).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });
});
