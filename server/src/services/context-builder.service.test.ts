/**
 * ContextBuilderService Unit Tests
 *
 * Regression tests for the Agent-First architecture.
 * Critical: Verifies that seeded facts become forbiddenSlots,
 * preventing the agent from re-asking known questions.
 *
 * @see docs/architecture/AGENT_FIRST_ARCHITECTURE_SPEC.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextBuilderService, type KnownFacts } from './context-builder.service';
import type { PrismaClient } from '../generated/prisma/client';
import type { SectionContentService } from './section-content.service';

// =============================================================================
// MOCKS
// =============================================================================

const createMockPrisma = () =>
  ({
    tenant: {
      findUnique: vi.fn(),
    },
    package: {
      count: vi.fn().mockResolvedValue(0),
    },
  }) as unknown as PrismaClient;

const createMockSectionContentService = (overrides: Partial<SectionContentService> = {}) =>
  ({
    hasDraft: vi.fn().mockResolvedValue(false),
    hasPublished: vi.fn().mockResolvedValue(false),
    getPageStructure: vi.fn().mockResolvedValue({ pages: [] }),
    ...overrides,
  }) as unknown as SectionContentService;

// =============================================================================
// TEST DATA
// =============================================================================

const TENANT_ID = 'tenant_test_123';

// Phase 5.2 Section Content Migration: landingPageConfig columns removed
// Storefront state is now derived from SectionContentService
const createMockTenant = (discoveryFacts: KnownFacts = {}) => ({
  id: TENANT_ID,
  name: 'Test Photography', // Note: field is 'name' not 'businessName'
  slug: 'test-photo',
  branding: {
    discoveryFacts,
    voice: { tone: 'warm' },
  },
  onboardingCompletedAt: null,
  onboardingPhase: 'NOT_STARTED',
});

// =============================================================================
// TESTS
// =============================================================================

describe('ContextBuilderService', () => {
  let contextBuilder: ContextBuilderService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockSectionContentService: ReturnType<typeof createMockSectionContentService>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSectionContentService = createMockSectionContentService();
    contextBuilder = new ContextBuilderService(mockPrisma, mockSectionContentService);
    vi.clearAllMocks();
  });

  describe('getBootstrapData', () => {
    /**
     * P0 REGRESSION TEST: Seeded facts become forbiddenSlots
     *
     * This is the critical test that prevents the agent from asking
     * "What do you do?" when we already know the business type.
     *
     * If this test fails, Phase 1 is broken and the agent will
     * re-ask known questions despite having stored facts.
     */
    it('should include seeded fact keys in forbiddenSlots', async () => {
      // Arrange: Tenant has businessType and location stored
      const discoveryFacts: KnownFacts = {
        businessType: 'photographer',
        location: 'San Francisco, CA',
      };
      const mockTenant = createMockTenant(discoveryFacts);
      (mockPrisma.tenant.findUnique as any).mockResolvedValue(mockTenant);

      // Act
      const bootstrap = await contextBuilder.getBootstrapData(TENANT_ID);

      // Assert: forbiddenSlots contains both seeded fact keys
      expect(bootstrap.forbiddenSlots).toContain('businessType');
      expect(bootstrap.forbiddenSlots).toContain('location');
      expect(bootstrap.forbiddenSlots).toHaveLength(2);
    });

    it('should return empty forbiddenSlots when no facts are stored', async () => {
      // Arrange: Fresh tenant with no discovery facts
      const mockTenant = createMockTenant({});
      (mockPrisma.tenant.findUnique as any).mockResolvedValue(mockTenant);

      // Act
      const bootstrap = await contextBuilder.getBootstrapData(TENANT_ID);

      // Assert
      expect(bootstrap.forbiddenSlots).toEqual([]);
    });

    it('should exclude undefined and null fact values from forbiddenSlots', async () => {
      // Arrange: Tenant has some facts, some undefined/null
      const discoveryFacts: KnownFacts = {
        businessType: 'coach',
        location: undefined,
        targetAudience: null as unknown as string, // Explicitly null
        specializations: ['life coaching', 'career'],
      };
      const mockTenant = createMockTenant(discoveryFacts);
      (mockPrisma.tenant.findUnique as any).mockResolvedValue(mockTenant);

      // Act
      const bootstrap = await contextBuilder.getBootstrapData(TENANT_ID);

      // Assert: Only non-null/undefined values become forbidden
      expect(bootstrap.forbiddenSlots).toContain('businessType');
      expect(bootstrap.forbiddenSlots).toContain('specializations');
      expect(bootstrap.forbiddenSlots).not.toContain('location');
      expect(bootstrap.forbiddenSlots).not.toContain('targetAudience');
    });

    it('should include all known facts in discoveryFacts', async () => {
      // Arrange
      const discoveryFacts: KnownFacts = {
        businessType: 'therapist',
        dreamClient: 'Working professionals seeking work-life balance',
        testimonial: 'Life-changing experience',
      };
      const mockTenant = createMockTenant(discoveryFacts);
      (mockPrisma.tenant.findUnique as any).mockResolvedValue(mockTenant);

      // Act
      const bootstrap = await contextBuilder.getBootstrapData(TENANT_ID);

      // Assert
      expect(bootstrap.discoveryFacts).toEqual(discoveryFacts);
    });

    it('should compute correct storefront state flags', async () => {
      // Arrange: Tenant with published and draft content via SectionContentService
      const mockTenant = createMockTenant({ businessType: 'wedding_planner' });
      (mockPrisma.tenant.findUnique as any).mockResolvedValue(mockTenant);

      // Phase 5.2: Mock SectionContentService to return draft/published state
      (mockSectionContentService.hasDraft as any).mockResolvedValue(true);
      (mockSectionContentService.hasPublished as any).mockResolvedValue(true);

      // Act
      const bootstrap = await contextBuilder.getBootstrapData(TENANT_ID);

      // Assert
      expect(bootstrap.storefrontState.hasPublished).toBe(true);
      expect(bootstrap.storefrontState.hasDraft).toBe(true);
    });

    it('should throw when tenant not found', async () => {
      // Arrange
      (mockPrisma.tenant.findUnique as any).mockResolvedValue(null);

      // Act & Assert
      await expect(contextBuilder.getBootstrapData('nonexistent_tenant')).rejects.toThrow(
        'Tenant not found: nonexistent_tenant'
      );
    });

    it('should handle empty branding object gracefully', async () => {
      // Arrange: Tenant with null/empty branding
      const mockTenant = {
        ...createMockTenant(),
        branding: null,
      };
      (mockPrisma.tenant.findUnique as any).mockResolvedValue(mockTenant);

      // Act
      const bootstrap = await contextBuilder.getBootstrapData(TENANT_ID);

      // Assert: Graceful degradation
      expect(bootstrap.forbiddenSlots).toEqual([]);
      expect(bootstrap.discoveryFacts).toEqual({});
    });
  });

  describe('build (full context)', () => {
    it('should build complete agent context with knownFacts', async () => {
      // Arrange
      const discoveryFacts: KnownFacts = {
        businessType: 'photographer',
        location: 'NYC',
        yearsInBusiness: 5,
      };
      const mockTenant = createMockTenant(discoveryFacts);
      (mockPrisma.tenant.findUnique as any).mockResolvedValue(mockTenant);

      // Act
      const context = await contextBuilder.build(TENANT_ID);

      // Assert
      expect(context.knownFacts.businessType).toBe('photographer');
      expect(context.knownFacts.location).toBe('NYC');
      expect(context.knownFacts.yearsInBusiness).toBe(5);
    });

    it('should generate forbiddenQuestions from knownFacts', async () => {
      // Arrange
      const discoveryFacts: KnownFacts = {
        businessName: 'Smith Photography',
        businessType: 'photographer',
        businessDescription: 'Capturing timeless moments',
      };
      const mockTenant = createMockTenant(discoveryFacts);
      (mockPrisma.tenant.findUnique as any).mockResolvedValue(mockTenant);

      // Act
      const context = await contextBuilder.build(TENANT_ID);

      // Assert: Forbidden questions are generated for known facts
      expect(context.forbiddenQuestions).toContain("What's your business name?");
      expect(context.forbiddenQuestions).toContain('What type of business do you have?');
      expect(context.forbiddenQuestions).toContain('What do you do?');
    });
  });

  describe('getOnboardingState', () => {
    it('should return correct onboarding state', async () => {
      // Arrange
      const mockTenant = {
        branding: {
          discoveryFacts: {
            businessType: 'coach',
            dreamClient: 'Entrepreneurs',
          },
        },
        onboardingDone: true,
        onboardingPhase: 'COMPLETED',
      };
      (mockPrisma.tenant.findUnique as any).mockResolvedValue(mockTenant);

      // Act
      const state = await contextBuilder.getOnboardingState(TENANT_ID);

      // Assert
      expect(state.isComplete).toBe(true);
      expect(state.phase).toBe('COMPLETED');
      expect(state.factCount).toBe(2);
      expect(state.discoveryFacts).toEqual({
        businessType: 'coach',
        dreamClient: 'Entrepreneurs',
      });
    });
  });
});
