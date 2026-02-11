/**
 * DiscoveryService Unit Tests
 *
 * Tests the service layer for tenant discovery fact management, bootstrap,
 * greeting state, onboarding completion, and reveal marking.
 * All dependencies are mocked — no real DB or HTTP calls.
 *
 * @see discovery.service.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DiscoveryService,
  TenantNotFoundError,
  ServiceUnavailableError,
} from './discovery.service';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockTenantRepo(overrides: Record<string, unknown> = {}) {
  return {
    findById: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

function createMockContextBuilder(overrides: Record<string, unknown> = {}) {
  return {
    getBootstrapData: vi.fn(),
    ...overrides,
  };
}

function createMockResearchService(overrides: Record<string, unknown> = {}) {
  return {
    triggerAsync: vi.fn(),
    ...overrides,
  };
}

function createMockCatalogService(overrides: Record<string, unknown> = {}) {
  return {
    getAllPackages: vi.fn(),
    ...overrides,
  };
}

/** Minimal tenant object matching PrismaTenantRepository return shape */
function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    name: 'Test Studio',
    tier: 'FREE',
    onboardingPhase: 'NOT_STARTED',
    onboardingCompletedAt: null,
    revealCompletedAt: null,
    branding: {},
    ...overrides,
  };
}

// ============================================================================
// storeFact
// ============================================================================

describe('DiscoveryService', () => {
  let tenantRepo: ReturnType<typeof createMockTenantRepo>;
  let contextBuilder: ReturnType<typeof createMockContextBuilder>;
  let researchService: ReturnType<typeof createMockResearchService>;
  let catalogService: ReturnType<typeof createMockCatalogService>;
  let service: DiscoveryService;

  beforeEach(() => {
    tenantRepo = createMockTenantRepo();
    contextBuilder = createMockContextBuilder();
    researchService = createMockResearchService();
    catalogService = createMockCatalogService();
    service = new DiscoveryService(
      tenantRepo as never,
      contextBuilder as never,
      researchService as never,
      catalogService as never
    );
  });

  describe('storeFact', () => {
    it('stores a fact and returns updated state', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());

      const result = await service.storeFact('tenant-1', 'businessType', 'Photography');

      expect(result.stored).toBe(true);
      expect(result.key).toBe('businessType');
      expect(result.value).toBe('Photography');
      expect(result.knownFactKeys).toContain('businessType');
      expect(result.totalFactsKnown).toBe(1);
    });

    it('throws TenantNotFoundError for missing tenant', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(service.storeFact('nonexistent', 'businessType', 'x')).rejects.toThrow(
        TenantNotFoundError
      );
    });

    it('triggers research when businessType + location are both known', async () => {
      tenantRepo.findById.mockResolvedValue(
        makeTenant({
          branding: { discoveryFacts: { businessType: 'Photography' } },
        })
      );

      await service.storeFact('tenant-1', 'location', 'Austin, TX');

      expect(researchService.triggerAsync).toHaveBeenCalledWith(
        'tenant-1',
        'Photography',
        'Austin, TX'
      );
    });

    it('does NOT re-trigger research if already triggered', async () => {
      tenantRepo.findById.mockResolvedValue(
        makeTenant({
          branding: {
            discoveryFacts: {
              businessType: 'Photography',
              location: 'NYC',
              _researchTriggered: true,
            },
          },
        })
      );

      await service.storeFact('tenant-1', 'targetMarket', 'Weddings');

      expect(researchService.triggerAsync).not.toHaveBeenCalled();
    });

    it('filters _-prefixed metadata keys from knownFactKeys', async () => {
      tenantRepo.findById.mockResolvedValue(
        makeTenant({
          branding: {
            discoveryFacts: {
              businessType: 'Photography',
              _researchTriggered: true,
            },
          },
        })
      );

      const result = await service.storeFact('tenant-1', 'location', 'Denver');

      expect(result.knownFactKeys).not.toContain('_researchTriggered');
      expect(result.knownFactKeys).toContain('businessType');
      expect(result.knownFactKeys).toContain('location');
    });

    it('advances phase and persists in single DB write', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());

      await service.storeFact('tenant-1', 'businessType', 'Photography');

      // Should have called update once (merged branding + phase)
      expect(tenantRepo.update).toHaveBeenCalledTimes(1);
      const updateCall = tenantRepo.update.mock.calls[0];
      expect(updateCall[0]).toBe('tenant-1');
      expect(updateCall[1].branding).toBeDefined();
    });

    it('never moves phase backward (monotonic advancement)', async () => {
      // Tenant already in SERVICES phase
      tenantRepo.findById.mockResolvedValue(
        makeTenant({
          onboardingPhase: 'SERVICES',
          branding: {
            discoveryFacts: { businessType: 'Photography', location: 'NYC', servicesOffered: 'y' },
          },
        })
      );

      const result = await service.storeFact('tenant-1', 'businessName', 'Acme');

      // businessName alone would suggest DISCOVERY, but we should never go backward
      expect(result.phaseAdvanced).toBe(false);
    });
  });

  // ============================================================================
  // getDiscoveryFacts
  // ============================================================================

  describe('getDiscoveryFacts', () => {
    it('returns stored facts for a tenant', async () => {
      tenantRepo.findById.mockResolvedValue(
        makeTenant({
          branding: {
            discoveryFacts: { businessType: 'Photography', location: 'Denver' },
          },
        })
      );

      const result = await service.getDiscoveryFacts('tenant-1');

      expect(result.success).toBe(true);
      expect(result.factCount).toBe(2);
      expect(result.facts.businessType).toBe('Photography');
      expect(result.facts.location).toBe('Denver');
    });

    it('filters _-prefixed metadata keys', async () => {
      tenantRepo.findById.mockResolvedValue(
        makeTenant({
          branding: {
            discoveryFacts: {
              businessType: 'Photography',
              _researchTriggered: true,
              _internal: 'hidden',
            },
          },
        })
      );

      const result = await service.getDiscoveryFacts('tenant-1');

      expect(result.factCount).toBe(1);
      expect(result.factKeys).toEqual(['businessType']);
      expect(result.facts._researchTriggered).toBeUndefined();
      expect(result.facts._internal).toBeUndefined();
    });

    it('returns empty facts for tenant with no discoveryFacts', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant({ branding: {} }));

      const result = await service.getDiscoveryFacts('tenant-1');

      expect(result.factCount).toBe(0);
      expect(result.message).toBe('No facts stored yet.');
    });

    it('throws TenantNotFoundError for missing tenant', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(service.getDiscoveryFacts('nonexistent')).rejects.toThrow(TenantNotFoundError);
    });
  });

  // ============================================================================
  // getBootstrap
  // ============================================================================

  describe('getBootstrap', () => {
    it('returns bootstrap data with context builder discovery facts', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());
      contextBuilder.getBootstrapData.mockResolvedValue({
        discoveryFacts: { businessType: 'Photography' },
      });

      const result = await service.getBootstrap('tenant-1');

      expect(result.tenantId).toBe('tenant-1');
      expect(result.businessName).toBe('Test Studio');
      expect(result.discoveryData).toEqual({ businessType: 'Photography' });
      expect(result.hasBeenGreeted).toBe(false);
    });

    it('returns cached data on second call', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());
      contextBuilder.getBootstrapData.mockResolvedValue({ discoveryFacts: null });

      await service.getBootstrap('tenant-1');
      await service.getBootstrap('tenant-1');

      // Only one DB call — second should be cached
      expect(tenantRepo.findById).toHaveBeenCalledTimes(1);
    });

    it('cache invalidation forces fresh fetch', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());
      contextBuilder.getBootstrapData.mockResolvedValue({ discoveryFacts: null });

      await service.getBootstrap('tenant-1');
      service.invalidateBootstrapCache('tenant-1');
      await service.getBootstrap('tenant-1');

      expect(tenantRepo.findById).toHaveBeenCalledTimes(2);
    });

    it('throws TenantNotFoundError for missing tenant', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(service.getBootstrap('nonexistent')).rejects.toThrow(TenantNotFoundError);
    });

    it('throws ServiceUnavailableError when contextBuilder is undefined', async () => {
      const svc = new DiscoveryService(tenantRepo as never, undefined, researchService as never);
      tenantRepo.findById.mockResolvedValue(makeTenant());

      await expect(svc.getBootstrap('tenant-1')).rejects.toThrow(ServiceUnavailableError);
    });

    it('reports onboardingDone for COMPLETED phase', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant({ onboardingPhase: 'COMPLETED' }));
      contextBuilder.getBootstrapData.mockResolvedValue({ discoveryFacts: null });

      const result = await service.getBootstrap('tenant-1');

      expect(result.onboardingDone).toBe(true);
    });
  });

  // ============================================================================
  // markSessionGreeted / hasSessionBeenGreeted
  // ============================================================================

  describe('markSessionGreeted', () => {
    it('marks session as greeted', () => {
      expect(service.hasSessionBeenGreeted('t1', 'session-1')).toBe(false);

      service.markSessionGreeted('t1', 'session-1');

      expect(service.hasSessionBeenGreeted('t1', 'session-1')).toBe(true);
    });

    it('isolates between different sessions', () => {
      service.markSessionGreeted('t1', 'session-1');

      expect(service.hasSessionBeenGreeted('t1', 'session-1')).toBe(true);
      expect(service.hasSessionBeenGreeted('t1', 'session-2')).toBe(false);
    });

    it('isolates between different tenants', () => {
      service.markSessionGreeted('t1', 'session-1');

      expect(service.hasSessionBeenGreeted('t1', 'session-1')).toBe(true);
      expect(service.hasSessionBeenGreeted('t2', 'session-1')).toBe(false);
    });
  });

  // ============================================================================
  // completeOnboarding
  // ============================================================================

  describe('completeOnboarding', () => {
    it('completes onboarding when packages exist', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant({ onboardingPhase: 'MARKETING' }));
      catalogService.getAllPackages.mockResolvedValue([{ id: 'pkg-1' }]);

      const result = await service.completeOnboarding('tenant-1', {
        publishedUrl: 'https://example.com',
      });

      expect(result.status).toBe('completed');
      if (result.status === 'completed') {
        expect(result.completedAt).toBeInstanceOf(Date);
        expect(result.publishedUrl).toBe('https://example.com');
      }
      expect(tenantRepo.update).toHaveBeenCalledWith('tenant-1', {
        onboardingPhase: 'COMPLETED',
        onboardingCompletedAt: expect.any(Date),
      });
    });

    it('returns already_complete for idempotent calls', async () => {
      const completedAt = new Date('2026-01-01');
      tenantRepo.findById.mockResolvedValue(
        makeTenant({
          onboardingPhase: 'COMPLETED',
          onboardingCompletedAt: completedAt,
        })
      );

      const result = await service.completeOnboarding('tenant-1');

      expect(result.status).toBe('already_complete');
      if (result.status === 'already_complete') {
        expect(result.completedAt).toEqual(completedAt);
      }
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('returns no_packages when no packages exist', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());
      catalogService.getAllPackages.mockResolvedValue([]);

      const result = await service.completeOnboarding('tenant-1');

      expect(result.status).toBe('no_packages');
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('throws TenantNotFoundError for missing tenant', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(service.completeOnboarding('nonexistent')).rejects.toThrow(TenantNotFoundError);
    });

    it('throws ServiceUnavailableError when catalogService is undefined', async () => {
      const svc = new DiscoveryService(
        tenantRepo as never,
        contextBuilder as never,
        researchService as never,
        undefined
      );
      tenantRepo.findById.mockResolvedValue(makeTenant());

      await expect(svc.completeOnboarding('tenant-1')).rejects.toThrow(ServiceUnavailableError);
    });
  });

  // ============================================================================
  // markRevealCompleted
  // ============================================================================

  describe('markRevealCompleted', () => {
    it('marks reveal as completed for fresh tenant', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());

      const result = await service.markRevealCompleted('tenant-1');

      expect(result.status).toBe('completed');
      expect(tenantRepo.update).toHaveBeenCalledWith('tenant-1', {
        revealCompletedAt: expect.any(Date),
      });
    });

    it('returns already_completed for idempotent calls', async () => {
      tenantRepo.findById.mockResolvedValue(
        makeTenant({ revealCompletedAt: new Date('2026-01-01') })
      );

      const result = await service.markRevealCompleted('tenant-1');

      expect(result.status).toBe('already_completed');
      expect(tenantRepo.update).not.toHaveBeenCalled();
    });

    it('throws TenantNotFoundError for missing tenant', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(service.markRevealCompleted('nonexistent')).rejects.toThrow(TenantNotFoundError);
    });
  });
});
