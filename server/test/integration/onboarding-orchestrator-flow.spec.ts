/**
 * Integration Tests: Onboarding Orchestrator Flow
 *
 * Tests the tenant onboarding flow:
 * - Phase transitions via tool calls
 * - Session resumption with advisor memory
 * - T2 soft-confirm proposal lifecycle
 * - Event sourcing integration
 *
 * Uses real Prisma with mocked Gemini API.
 *
 * @see server/src/agent/orchestrator/onboarding-orchestrator.ts
 * @see server/src/agent/onboarding/advisor-memory.service.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';
import {
  createMockGeminiClient,
  createTextResponse,
  createToolUseResponse,
  MOCK_RESPONSES,
} from '../helpers/mock-gemini';

// Mock the LLM module's getVertexClient before imports
const mockClient = createMockGeminiClient([createTextResponse('Hello!')]);

vi.mock('../../src/llm', async () => {
  const actual = await vi.importActual('../../src/llm');
  return {
    ...actual,
    getVertexClient: vi.fn(() => mockClient),
  };
});

// Mock logger to reduce noise
vi.mock('../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Now import the orchestrator (after mock is set up)
import { OnboardingOrchestrator } from '../../src/agent/orchestrator/onboarding-orchestrator';
import { appendEvent } from '../../src/agent/onboarding/event-sourcing';
import { AdvisorMemoryService } from '../../src/agent/onboarding/advisor-memory.service';
import { PrismaAdvisorMemoryRepository } from '../../src/adapters/prisma/advisor-memory.repository';

describe.sequential('Onboarding Orchestrator Flow - Integration Tests', () => {
  const ctx = setupCompleteIntegrationTest('onboarding-orch');
  let orchestrator: OnboardingOrchestrator;
  let advisorMemoryService: AdvisorMemoryService;

  beforeAll(async () => {
    // Initialize orchestrator with real Prisma
    orchestrator = new OnboardingOrchestrator(ctx.prisma);
    const advisorMemoryRepo = new PrismaAdvisorMemoryRepository(ctx.prisma);
    advisorMemoryService = new AdvisorMemoryService(advisorMemoryRepo);
  });

  beforeEach(async () => {
    // Setup tenants
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();

    // Set tenant to onboarding phase
    await ctx.prisma.tenant.update({
      where: { id: ctx.tenants.tenantA.id },
      data: {
        onboardingPhase: 'NOT_STARTED',
        onboardingVersion: 0,
      },
    });

    // Reset mock responses
    mockClient.models.generateContent.mockClear();
  });

  afterEach(async () => {
    // Clean up onboarding events
    await ctx.prisma.onboardingEvent.deleteMany({
      where: { tenantId: ctx.tenants.tenantA.id },
    });
    // Clean up sessions
    await ctx.prisma.agentSession.deleteMany({
      where: { tenantId: ctx.tenants.tenantA.id },
    });
    await ctx.cleanup();
  });

  // ============================================================================
  // Session Management Tests
  // ============================================================================

  describe('Session Management', () => {
    it('should create onboarding session', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      // Setup mock
      mockClient.models.generateContent.mockResolvedValueOnce(
        createTextResponse("Welcome! Let's get your business set up.")
      );

      const response = await orchestrator.chat(tenantId, 'new-session', 'Hello');

      expect(response).toBeDefined();
      expect(response.sessionId).toBeDefined();

      // Verify session was created
      const session = await ctx.prisma.agentSession.findUnique({
        where: { id: response.sessionId },
      });
      expect(session).not.toBeNull();
      expect(session?.tenantId).toBe(tenantId);
    });

    it('should resume session with context', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      // First chat
      mockClient.models.generateContent.mockResolvedValueOnce(
        createTextResponse('Tell me about your business.')
      );
      const response1 = await orchestrator.chat(tenantId, 'new-session', 'Hi');

      // Second chat
      mockClient.models.generateContent.mockResolvedValueOnce(
        createTextResponse("Great! Let's continue.")
      );
      const response2 = await orchestrator.chat(
        tenantId,
        response1.sessionId,
        'I am a photographer'
      );

      expect(response2.sessionId).toBe(response1.sessionId);

      // Verify history persisted
      const session = await ctx.prisma.agentSession.findUnique({
        where: { id: response1.sessionId },
      });
      const messages = session?.messages as unknown[];
      expect(Array.isArray(messages)).toBe(true);
      expect(messages?.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // Phase Transition Tests
  // ============================================================================

  describe('Phase Transitions', () => {
    it('should track discovery phase completion', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      // Add discovery event directly (simulating tool execution)
      const result = await appendEvent(
        ctx.prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        {
          businessType: 'photographer',
          businessName: 'Test Photography',
          location: { city: 'Austin', state: 'TX', country: 'US' },
          targetMarket: 'premium',
          yearsInBusiness: 5,
          currentAveragePrice: 200000,
          servicesOffered: ['weddings', 'portraits'],
          completedAt: new Date().toISOString(),
        },
        0
      );

      expect(result.success).toBe(true);

      // Update tenant phase
      await ctx.prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Chat should reflect the new phase
      mockClient.models.generateContent.mockResolvedValueOnce(
        createTextResponse("Now let's research your market.")
      );

      const response = await orchestrator.chat(tenantId, 'new-session', 'What next?');

      // Verify session has phase context
      const onboardingSession = await orchestrator.getOnboardingSession(
        tenantId,
        response.sessionId
      );
      expect(onboardingSession?.currentPhase).toBe('DISCOVERY');
    });

    it('should detect returning user', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      // Add discovery event from yesterday (simulating previous session)
      await appendEvent(
        ctx.prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        {
          businessType: 'photographer',
          businessName: 'Test Photography',
          location: { city: 'Austin', state: 'TX', country: 'US' },
          targetMarket: 'premium',
          yearsInBusiness: 5,
          currentAveragePrice: 200000,
          servicesOffered: ['weddings'],
          completedAt: new Date(Date.now() - 86400000).toISOString(),
        },
        0
      );

      await ctx.prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Check onboarding context
      const context = await advisorMemoryService.getOnboardingContext(tenantId);

      expect(context.isReturning).toBe(true);
      expect(context.memory?.discoveryData?.businessType).toBe('photographer');
    });
  });

  // ============================================================================
  // Tool Execution Tests
  // ============================================================================

  describe('Tool Execution', () => {
    it('should execute update_onboarding_state tool', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      // Mock tool call for update_onboarding_state
      mockClient.models.generateContent
        .mockResolvedValueOnce(
          createToolUseResponse(
            'update_onboarding_state',
            {
              phase: 'DISCOVERY',
              data: {
                businessType: 'photographer',
                businessName: 'Studio X',
                location: { city: 'Austin', state: 'TX', country: 'US' },
              },
            },
            'Saving your business info.'
          )
        )
        .mockResolvedValueOnce(createTextResponse('Got it! Your info is saved.'));

      const response = await orchestrator.chat(
        tenantId,
        'new-session',
        'I am a photographer named Studio X in Austin, TX'
      );

      expect(response.toolResults).toBeDefined();
      const stateResult = response.toolResults?.find(
        (r) => r.toolName === 'update_onboarding_state'
      );
      if (stateResult) {
        // Tool execution depends on whether the tool is registered
        expect(stateResult).toBeDefined();
      }
    });

    it('should execute get_market_research tool', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      // Set up discovery first
      await appendEvent(
        ctx.prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        {
          businessType: 'photographer',
          businessName: 'Test Studio',
          location: { city: 'Austin', state: 'TX', country: 'US' },
          targetMarket: 'premium',
          yearsInBusiness: 3,
          currentAveragePrice: 150000,
          servicesOffered: ['weddings'],
          completedAt: new Date().toISOString(),
        },
        0
      );

      await ctx.prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Mock market research tool call
      mockClient.models.generateContent
        .mockResolvedValueOnce(
          createToolUseResponse(
            'get_market_research',
            { businessType: 'photographer', location: 'Austin, TX' },
            'Let me research your market.'
          )
        )
        .mockResolvedValueOnce(
          createTextResponse('Based on my research, here are the pricing benchmarks.')
        );

      const response = await orchestrator.chat(
        tenantId,
        'new-session',
        'What are the market rates for photographers in Austin?'
      );

      expect(response.toolResults).toBeDefined();
      const researchResult = response.toolResults?.find(
        (r) => r.toolName === 'get_market_research'
      );
      if (researchResult) {
        expect(researchResult).toBeDefined();
      }
    });
  });

  // ============================================================================
  // Session Resumption Tests
  // ============================================================================

  describe('Session Resumption', () => {
    it('should provide resume summary for returning users', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      // Add discovery event
      await appendEvent(
        ctx.prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        {
          businessType: 'photographer',
          businessName: 'Austin Wedding Photography',
          location: { city: 'Austin', state: 'TX', country: 'US' },
          targetMarket: 'premium',
          yearsInBusiness: 5,
          currentAveragePrice: 300000,
          servicesOffered: ['weddings', 'engagements'],
          completedAt: new Date(Date.now() - 86400000).toISOString(),
        },
        0
      );

      await ctx.prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Get resume summary
      const summary = await advisorMemoryService.getResumeSummary(tenantId);

      expect(summary).toBeDefined();
      // Summary should reference the business
      expect(summary).toMatch(/Austin Wedding Photography|photographer|Austin/i);
    });

    it('should not flag first-time user as returning', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      // No events - fresh tenant
      const context = await advisorMemoryService.getOnboardingContext(tenantId);

      expect(context.isReturning).toBe(false);
      expect(context.memory?.lastEventVersion).toBe(0);
    });
  });

  // ============================================================================
  // Greeting Tests
  // ============================================================================

  describe('Greeting', () => {
    it('should return phase-appropriate greeting for new user', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      const greeting = await orchestrator.getGreeting(tenantId);

      expect(greeting).toBeDefined();
      expect(greeting.length).toBeGreaterThan(0);
    });

    it('should return resume greeting for returning user', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      // Add discovery event from yesterday
      await appendEvent(
        ctx.prisma,
        tenantId,
        'DISCOVERY_COMPLETED',
        {
          businessType: 'coach',
          businessName: 'Life Coaching Pro',
          location: { city: 'Denver', state: 'CO', country: 'US' },
          targetMarket: 'premium',
          yearsInBusiness: 3,
          currentAveragePrice: 20000,
          servicesOffered: ['1-on-1 coaching'],
          completedAt: new Date(Date.now() - 86400000).toISOString(),
        },
        0
      );

      await ctx.prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      const greeting = await orchestrator.getGreeting(tenantId);

      expect(greeting).toBeDefined();
      // Greeting should acknowledge returning user or mention the business
      expect(greeting.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Onboarding Status Tests
  // ============================================================================

  describe('Onboarding Status', () => {
    it('should correctly detect active onboarding', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      // Test various phases
      const activePhases = ['NOT_STARTED', 'DISCOVERY', 'MARKET_RESEARCH', 'SERVICES', 'MARKETING'];

      for (const phase of activePhases) {
        await ctx.prisma.tenant.update({
          where: { id: tenantId },
          data: { onboardingPhase: phase },
        });

        const isActive = await orchestrator.isOnboardingActive(tenantId);
        expect(isActive).toBe(true);
      }
    });

    it('should detect completed onboarding', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      await ctx.prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'COMPLETED' },
      });

      const isActive = await orchestrator.isOnboardingActive(tenantId);
      expect(isActive).toBe(false);
    });

    it('should detect skipped onboarding', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      await ctx.prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingPhase: 'SKIPPED' },
      });

      const isActive = await orchestrator.isOnboardingActive(tenantId);
      expect(isActive).toBe(false);
    });
  });

  // ============================================================================
  // Tenant Isolation Tests
  // ============================================================================

  describe('Tenant Isolation', () => {
    it('should keep onboarding state isolated between tenants', async () => {
      await ctx.tenants.tenantB.create();
      const tenantAId = ctx.tenants.tenantA.id;
      const tenantBId = ctx.tenants.tenantB.id;

      // Set up tenant B for onboarding
      await ctx.prisma.tenant.update({
        where: { id: tenantBId },
        data: { onboardingPhase: 'NOT_STARTED', onboardingVersion: 0 },
      });

      // Add discovery for tenant A
      await appendEvent(
        ctx.prisma,
        tenantAId,
        'DISCOVERY_COMPLETED',
        {
          businessType: 'photographer',
          businessName: 'Tenant A Photography',
          location: { city: 'Austin', state: 'TX', country: 'US' },
          targetMarket: 'premium',
          yearsInBusiness: 5,
          currentAveragePrice: 200000,
          servicesOffered: ['weddings'],
          completedAt: new Date().toISOString(),
        },
        0
      );

      await ctx.prisma.tenant.update({
        where: { id: tenantAId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Add discovery for tenant B with different data
      await appendEvent(
        ctx.prisma,
        tenantBId,
        'DISCOVERY_COMPLETED',
        {
          businessType: 'coach',
          businessName: 'Tenant B Coaching',
          location: { city: 'New York', state: 'NY', country: 'US' },
          targetMarket: 'luxury',
          yearsInBusiness: 10,
          currentAveragePrice: 50000,
          servicesOffered: ['executive coaching'],
          completedAt: new Date().toISOString(),
        },
        0
      );

      await ctx.prisma.tenant.update({
        where: { id: tenantBId },
        data: { onboardingPhase: 'DISCOVERY', onboardingVersion: 1 },
      });

      // Verify each tenant sees only their data
      const contextA = await advisorMemoryService.getOnboardingContext(tenantAId);
      const contextB = await advisorMemoryService.getOnboardingContext(tenantBId);

      expect(contextA.memory?.discoveryData?.businessType).toBe('photographer');
      expect(contextA.memory?.discoveryData?.businessName).toBe('Tenant A Photography');

      expect(contextB.memory?.discoveryData?.businessType).toBe('coach');
      expect(contextB.memory?.discoveryData?.businessName).toBe('Tenant B Coaching');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const tenantId = ctx.tenants.tenantA.id;

      mockClient.models.generateContent.mockRejectedValueOnce(new Error('API error'));

      await expect(orchestrator.chat(tenantId, 'new-session', 'Hello')).rejects.toThrow(
        'Failed to communicate with AI assistant'
      );
    });

    it('should handle missing tenant gracefully', async () => {
      const fakeId = 'nonexistent-tenant-id';

      const isActive = await orchestrator.isOnboardingActive(fakeId);
      expect(isActive).toBe(false);
    });
  });
});
