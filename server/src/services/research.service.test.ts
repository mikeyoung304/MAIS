/**
 * ResearchService Unit Tests
 *
 * Tests the service layer for background research triggers, result storage,
 * and the _researchTriggered flag lifecycle.
 * Uses mocked tenantRepo and fetch — no real DB or HTTP calls.
 *
 * @see research.service.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResearchService, ResearchTenantNotFoundError } from './research.service';

// Mock the cloudRunAuth module to avoid real GCP auth
vi.mock('./cloud-run-auth.service', () => ({
  cloudRunAuth: {
    getIdentityToken: vi.fn().mockResolvedValue(null),
  },
}));

// ============================================================================
// Mock Factories
// ============================================================================

function createMockTenantRepo() {
  return {
    findById: vi.fn(),
    update: vi.fn(),
  };
}

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    name: 'Test Studio',
    branding: {},
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ResearchService', () => {
  let tenantRepo: ReturnType<typeof createMockTenantRepo>;
  let service: ResearchService;
  let invalidateCache: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tenantRepo = createMockTenantRepo();
    invalidateCache = vi.fn();
    service = new ResearchService(tenantRepo as never, 'https://research.test.com');
    service.setBootstrapCacheInvalidator(invalidateCache);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // triggerAsync
  // ==========================================================================

  describe('triggerAsync', () => {
    it('fires fetch when researchAgentUrl is configured', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ competitors: [], pricing: [] }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      // Tenant data for store + verify cycles
      tenantRepo.findById.mockResolvedValue(makeTenant());

      service.triggerAsync('tenant-1', 'Photography', 'Austin');

      // Wait for the fire-and-forget async to settle
      await vi.waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          'https://research.test.com/research',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Photography'),
          })
        );
      });
    });

    it('skips when researchAgentUrl is not configured', () => {
      const noUrlService = new ResearchService(tenantRepo as never, undefined);
      vi.stubGlobal('fetch', vi.fn());

      noUrlService.triggerAsync('tenant-1', 'Photography', 'Austin');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('stores research data on success and invalidates cache', async () => {
      const researchData = { competitors: ['Acme'] };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(researchData),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      // First findById for storeResearchData read-modify-write
      // Second findById for post-write verification
      tenantRepo.findById
        .mockResolvedValueOnce(makeTenant())
        .mockResolvedValueOnce(makeTenant({ branding: { researchData } }));

      service.triggerAsync('tenant-1', 'Photography', 'Austin');

      await vi.waitFor(() => {
        expect(invalidateCache).toHaveBeenCalledWith('tenant-1');
      });

      expect(tenantRepo.update).toHaveBeenCalledWith('tenant-1', {
        branding: { researchData },
      });
    });

    it('clears _researchTriggered flag on HTTP failure', async () => {
      const mockResponse = { ok: false, status: 500 };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      // For clearResearchTriggeredFlag: tenant with the flag set
      tenantRepo.findById.mockResolvedValue(
        makeTenant({
          branding: {
            discoveryFacts: { businessType: 'Photography', _researchTriggered: true },
          },
        })
      );

      // After clear + verify, flag should be gone
      tenantRepo.findById
        .mockResolvedValueOnce(
          makeTenant({
            branding: {
              discoveryFacts: { businessType: 'Photography', _researchTriggered: true },
            },
          })
        )
        .mockResolvedValueOnce(
          makeTenant({
            branding: { discoveryFacts: { businessType: 'Photography' } },
          })
        );

      service.triggerAsync('tenant-1', 'Photography', 'Austin');

      await vi.waitFor(() => {
        expect(tenantRepo.update).toHaveBeenCalled();
      });
    });

    it('clears _researchTriggered flag on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      tenantRepo.findById
        .mockResolvedValueOnce(
          makeTenant({
            branding: {
              discoveryFacts: { businessType: 'Photography', _researchTriggered: true },
            },
          })
        )
        .mockResolvedValueOnce(
          makeTenant({
            branding: { discoveryFacts: { businessType: 'Photography' } },
          })
        );

      service.triggerAsync('tenant-1', 'Photography', 'Austin');

      await vi.waitFor(() => {
        expect(tenantRepo.update).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // getPrecomputedResults
  // ==========================================================================

  describe('getPrecomputedResults', () => {
    it('returns research data when present', async () => {
      tenantRepo.findById.mockResolvedValue(
        makeTenant({
          branding: { researchData: { competitors: ['Acme'] } },
        })
      );

      const result = await service.getPrecomputedResults('tenant-1');

      expect(result.success).toBe(true);
      expect(result.hasData).toBe(true);
      expect(result.researchData).toEqual({ competitors: ['Acme'] });
    });

    it('returns null when no research data', async () => {
      tenantRepo.findById.mockResolvedValue(makeTenant());

      const result = await service.getPrecomputedResults('tenant-1');

      expect(result.success).toBe(true);
      expect(result.hasData).toBe(false);
      expect(result.researchData).toBeNull();
    });

    it('throws ResearchTenantNotFoundError for missing tenant', async () => {
      tenantRepo.findById.mockResolvedValue(null);

      await expect(service.getPrecomputedResults('nonexistent')).rejects.toThrow(
        ResearchTenantNotFoundError
      );
    });
  });

  // ==========================================================================
  // setBootstrapCacheInvalidator
  // ==========================================================================

  describe('setBootstrapCacheInvalidator', () => {
    it('setter wires up the callback', async () => {
      const cb = vi.fn();
      const svc = new ResearchService(tenantRepo as never, 'https://research.test.com');
      svc.setBootstrapCacheInvalidator(cb);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      tenantRepo.findById
        .mockResolvedValueOnce(makeTenant())
        .mockResolvedValueOnce(makeTenant({ branding: { researchData: {} } }));

      svc.triggerAsync('tenant-1', 'Photography', 'Austin');

      await vi.waitFor(() => {
        expect(cb).toHaveBeenCalledWith('tenant-1');
      });
    });
  });

  // ==========================================================================
  // Constructor: researchAgentUrl injection
  // ==========================================================================

  describe('constructor', () => {
    it('accepts researchAgentUrl as param instead of process.env', async () => {
      const svc = new ResearchService(tenantRepo as never, 'https://custom-url.com');

      // Verify by triggering — should use custom URL
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));
      tenantRepo.findById
        .mockResolvedValueOnce(makeTenant())
        .mockResolvedValueOnce(makeTenant({ branding: { researchData: {} } }));

      svc.triggerAsync('tenant-1', 'Test', 'NYC');

      // triggerAsync is fire-and-forget — wait for the async IIFE
      await vi.waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('https://custom-url.com/research', expect.anything());
      });
    });

    it('accepts undefined url and skips research', () => {
      const svc = new ResearchService(tenantRepo as never, undefined);
      vi.stubGlobal('fetch', vi.fn());

      svc.triggerAsync('tenant-1', 'Test', 'NYC');

      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
