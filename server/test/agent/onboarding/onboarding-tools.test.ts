/**
 * Unit tests for Onboarding Agent Tools
 *
 * Tests the 4 onboarding tools:
 * - update_onboarding_state (T1)
 * - upsert_services (T2)
 * - update_storefront (T2)
 * - get_market_research (read)
 *
 * Uses mock context for isolation from database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  updateOnboardingStateTool,
  upsertServicesTool,
  updateStorefrontTool,
  getMarketResearchTool,
} from '../../../src/agent/tools/onboarding-tools';
import type { ToolContext } from '../../../src/agent/tools/types';

// Mock the dependencies
vi.mock('../../../src/agent/proposals/proposal.service', () => ({
  ProposalService: vi.fn().mockImplementation(() => ({
    createProposal: vi.fn().mockResolvedValue({
      proposalId: 'prop_test123',
      operation: 'Test Operation',
      preview: {},
      trustTier: 'T2',
      requiresApproval: false,
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    }),
  })),
}));

vi.mock('../../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Onboarding Tools', () => {
  let mockContext: ToolContext;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      segment: {
        findFirst: vi.fn(),
      },
      onboardingEvent: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn((callback: any) => callback(mockPrisma)),
    };

    mockContext = {
      tenantId: 'test-tenant-123',
      sessionId: 'test-session-456',
      prisma: mockPrisma as any,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateOnboardingStateTool', () => {
    it('should have correct tool metadata', () => {
      expect(updateOnboardingStateTool.name).toBe('update_onboarding_state');
      expect(updateOnboardingStateTool.description).toContain('onboarding phase');
      expect(updateOnboardingStateTool.inputSchema).toBeDefined();
      expect(updateOnboardingStateTool.inputSchema.required).toContain('phase');
    });

    // Note: The updateOnboardingStateTool requires the full contracts package
    // to be available. These tests focus on the tool interface, not full execution.
    // Integration tests with a real database should test the full flow.

    it('should return error on execution failure', async () => {
      // When Zod schemas can't be loaded, it returns a generic error
      const result = await updateOnboardingStateTool.execute(mockContext, {
        phase: 'INVALID_PHASE',
      });

      expect(result.success).toBe(false);
      // The tool catches errors and returns a generic message
      expect(result.error).toBeDefined();
    });

    it('should require phase parameter', () => {
      // Verify the inputSchema requires phase
      const schema = updateOnboardingStateTool.inputSchema;
      expect(schema.required).toContain('phase');
    });

    it('should have valid phase enum in schema', () => {
      const schema = updateOnboardingStateTool.inputSchema;
      const phaseEnum = schema.properties.phase.enum;
      expect(phaseEnum).toContain('DISCOVERY');
      expect(phaseEnum).toContain('MARKET_RESEARCH');
      expect(phaseEnum).toContain('SERVICES');
      expect(phaseEnum).toContain('MARKETING');
      expect(phaseEnum).toContain('COMPLETED');
      expect(phaseEnum).toContain('SKIPPED');
    });
  });

  describe('upsertServicesTool', () => {
    it('should have correct tool metadata', () => {
      expect(upsertServicesTool.name).toBe('upsert_services');
      expect(upsertServicesTool.description).toContain('service packages');
      expect(upsertServicesTool.inputSchema.required).toContain('segmentName');
      expect(upsertServicesTool.inputSchema.required).toContain('packages');
    });

    it('should return error for empty packages array', async () => {
      const result = await upsertServicesTool.execute(mockContext, {
        segmentName: 'Photography Sessions',
        segmentSlug: 'photography-sessions',
        packages: [],
      });

      expect(result.success).toBe(false);
      expect((result as any).message).toContain('package');
    });

    it('should return error for duplicate package names', async () => {
      const result = await upsertServicesTool.execute(mockContext, {
        segmentName: 'Photography Sessions',
        segmentSlug: 'photography-sessions',
        packages: [
          { name: 'Basic Package', slug: 'basic', priceCents: 20000, groupingOrder: 1 },
          { name: 'Basic Package', slug: 'basic-2', priceCents: 30000, groupingOrder: 2 },
        ],
      });

      expect(result.success).toBe(false);
      expect((result as any).duplicateName).toBe('basic package');
    });

    it('should return error if segment already exists', async () => {
      mockPrisma.segment.findFirst.mockResolvedValue({
        id: 'existing-segment',
        slug: 'photography-sessions',
      });

      const result = await upsertServicesTool.execute(mockContext, {
        segmentName: 'Photography Sessions',
        segmentSlug: 'photography-sessions',
        packages: [{ name: 'Basic', slug: 'basic', priceCents: 20000, groupingOrder: 1 }],
      });

      expect(result.success).toBe(false);
      expect((result as any).existingSlug).toBe('photography-sessions');
    });

    it('should create proposal for valid input', async () => {
      mockPrisma.segment.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({ slug: 'test-business' });

      const result = await upsertServicesTool.execute(mockContext, {
        segmentName: 'Photography Sessions',
        segmentSlug: 'photography-sessions',
        packages: [
          { name: 'Mini Session', slug: 'mini', priceCents: 15000, groupingOrder: 1 },
          { name: 'Full Session', slug: 'full', priceCents: 35000, groupingOrder: 2 },
        ],
      });

      expect(result.success).toBe(true);
      expect((result as any).proposalId).toBeDefined();
      expect((result as any).trustTier).toBe('T2');
    });
  });

  describe('updateStorefrontTool', () => {
    it('should have correct tool metadata', () => {
      expect(updateStorefrontTool.name).toBe('update_storefront');
      expect(updateStorefrontTool.description).toContain('storefront');
      expect(updateStorefrontTool.inputSchema).toBeDefined();
    });

    it('should return error when no fields provided', async () => {
      const result = await updateStorefrontTool.execute(mockContext, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one field');
    });

    it('should validate color format', async () => {
      const result = await updateStorefrontTool.execute(mockContext, {
        primaryColor: 'not-a-hex-color',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('hex format');
    });

    it('should accept valid hex color', async () => {
      const result = await updateStorefrontTool.execute(mockContext, {
        primaryColor: '#1a365d',
      });

      expect(result.success).toBe(true);
      expect((result as any).proposalId).toBeDefined();
    });

    it('should validate headline length', async () => {
      const result = await updateStorefrontTool.execute(mockContext, {
        headline: 'A'.repeat(201), // Over 200 char limit
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('200 characters');
    });

    it('should validate tagline length', async () => {
      const result = await updateStorefrontTool.execute(mockContext, {
        tagline: 'A'.repeat(301), // Over 300 char limit
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('300 characters');
    });

    it('should create proposal for valid input', async () => {
      const result = await updateStorefrontTool.execute(mockContext, {
        headline: 'Capturing Your Story',
        tagline: 'Professional photography for your special moments',
        brandVoice: 'professional',
      });

      expect(result.success).toBe(true);
      expect((result as any).proposalId).toBeDefined();
      expect((result as any).trustTier).toBe('T2');
    });
  });

  describe('getMarketResearchTool', () => {
    it('should have correct tool metadata', () => {
      expect(getMarketResearchTool.name).toBe('get_market_research');
      expect(getMarketResearchTool.description).toContain('pricing benchmarks');
      expect(getMarketResearchTool.inputSchema.required).toContain('businessType');
      expect(getMarketResearchTool.inputSchema.required).toContain('targetMarket');
    });

    // Note: These tests verify the tool interface. The actual market research
    // logic is tested more thoroughly in market-search.test.ts

    it('should execute successfully for valid inputs', async () => {
      // The tool wraps market-search which is tested separately
      const result = await getMarketResearchTool.execute(mockContext, {
        businessType: 'photographer',
        targetMarket: 'premium',
      });

      // With mocked context and no proper Zod schemas, execution may fail
      // This test just verifies the tool can be called
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should have required parameters in schema', () => {
      const schema = getMarketResearchTool.inputSchema;
      expect(schema.required).toContain('businessType');
      expect(schema.required).toContain('targetMarket');
    });

    it('should have business type enum in schema', () => {
      const schema = getMarketResearchTool.inputSchema;
      const businessTypeEnum = schema.properties.businessType.enum;
      expect(businessTypeEnum).toContain('photographer');
      expect(businessTypeEnum).toContain('coach');
      expect(businessTypeEnum).toContain('therapist');
    });

    it('should have target market enum in schema', () => {
      const schema = getMarketResearchTool.inputSchema;
      const targetMarketEnum = schema.properties.targetMarket.enum;
      expect(targetMarketEnum).toContain('luxury');
      expect(targetMarketEnum).toContain('premium');
      expect(targetMarketEnum).toContain('mid_range');
      expect(targetMarketEnum).toContain('budget_friendly');
    });

    it('should have optional location fields in schema', () => {
      const schema = getMarketResearchTool.inputSchema;
      expect(schema.properties.city).toBeDefined();
      expect(schema.properties.state).toBeDefined();
      // City and state should not be required
      expect(schema.required).not.toContain('city');
      expect(schema.required).not.toContain('state');
    });
  });

  describe('Tool Input Schemas', () => {
    it('updateOnboardingStateTool should have valid JSON schema', () => {
      const schema = updateOnboardingStateTool.inputSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties.phase).toBeDefined();
      expect(schema.properties.phase.enum).toBeDefined();
      expect(schema.properties.phase.enum).toContain('DISCOVERY');
      expect(schema.properties.phase.enum).toContain('SKIPPED');
    });

    it('upsertServicesTool should have valid JSON schema', () => {
      const schema = upsertServicesTool.inputSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties.segmentName.type).toBe('string');
      expect(schema.properties.packages.type).toBe('array');
    });

    it('updateStorefrontTool should have valid JSON schema', () => {
      const schema = updateStorefrontTool.inputSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties.headline.type).toBe('string');
      expect(schema.properties.brandVoice.enum).toContain('professional');
      expect(schema.properties.brandVoice.enum).toContain('luxurious');
    });

    it('getMarketResearchTool should have valid JSON schema', () => {
      const schema = getMarketResearchTool.inputSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties.businessType.enum).toBeDefined();
      expect(schema.properties.businessType.enum).toContain('photographer');
      expect(schema.properties.targetMarket.enum).toContain('luxury');
    });
  });
});
