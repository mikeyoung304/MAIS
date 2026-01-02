/**
 * Tenant Isolation Tests for Agent Evaluation
 *
 * Validates that the evaluation pipeline enforces strict multi-tenant isolation:
 * 1. Traces from other tenants are NOT returned
 * 2. Cross-tenant trace submission is rejected
 * 3. tenantId parameter is required
 *
 * NOTE: These tests require the ConversationTrace table to exist.
 * The table is created by migration and may not exist in all test databases.
 * Tests will be skipped (with clear visibility) if the table doesn't exist.
 *
 * @see plans/agent-eval-remediation-plan.md Phase 2.4
 * @see docs/solutions/patterns/mais-critical-patterns.md
 */

import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { setupIntegrationTest, createMultiTenantSetup } from '../helpers/integration-setup';
import { createEvalPipeline } from '../../src/agent/evals/pipeline';
import { createMockEvaluator } from '../helpers/mock-evaluator';
import { TraceNotFoundError } from '../../src/lib/errors/agent-eval-errors';

describe('Tenant Isolation - EvalPipeline', () => {
  const { prisma, cleanup } = setupIntegrationTest();
  const { tenantA, tenantB, cleanupTenants } = createMultiTenantSetup(prisma, 'eval-isolation');
  let tableExists = false;

  /**
   * Helper to conditionally run tests based on table existence.
   * Issue 607: Replaces silent `if (!tableExists) return;` guards with visible skipIf pattern.
   *
   * This provides clear test output:
   * - Table exists: "✓ should NOT return traces from other tenants"
   * - Table missing: "↓ should NOT return traces from other tenants [skipped: ConversationTrace table not found]"
   */
  const itIfTableExists = it.skipIf(() => !tableExists);

  beforeAll(async () => {
    // Check if ConversationTrace table exists
    try {
      await prisma.$queryRaw`SELECT 1 FROM "ConversationTrace" LIMIT 1`;
      tableExists = true;
    } catch {
      // Table doesn't exist - tests will be skipped with clear visibility
      tableExists = false;
      console.log(
        '⚠️  ConversationTrace table not found - skipping tenant isolation tests. Run migrations to enable these tests.'
      );
    }
  });

  beforeEach(async () => {
    if (!tableExists) return;

    await cleanupTenants();
    await tenantA.create();
    await tenantB.create();

    // Clean up any leftover test traces
    await prisma.conversationTrace.deleteMany({
      where: {
        tenantId: { in: [tenantA.id, tenantB.id] },
      },
    });
  });

  afterAll(async () => {
    if (tableExists) {
      await cleanupTenants();
    }
    await cleanup();
  });

  describe('getUnevaluatedTraces', () => {
    itIfTableExists('should NOT return traces from other tenants', async () => {
      // Setup: Create traces for both tenants
      const trace1 = await prisma.conversationTrace.create({
        data: {
          tenantId: tenantA.id,
          sessionId: `session-a-${Date.now()}`,
          agentType: 'customer',
          startedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
          messages: [],
          toolCalls: [],
        },
      });

      const trace2 = await prisma.conversationTrace.create({
        data: {
          tenantId: tenantB.id,
          sessionId: `session-b-${Date.now()}`,
          agentType: 'customer',
          startedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
          messages: [],
          toolCalls: [],
        },
      });

      // Act: Get traces for tenant A only
      const mockEvaluator = createMockEvaluator();
      const pipeline = createEvalPipeline(prisma, mockEvaluator);
      const traces = await pipeline.getUnevaluatedTraces(tenantA.id, 100);

      // Assert: Only tenant A's trace returned
      expect(traces).toContain(trace1.id);
      expect(traces).not.toContain(trace2.id);

      // Verify tenant B can only see their own trace
      const tracesB = await pipeline.getUnevaluatedTraces(tenantB.id, 100);
      expect(tracesB).toContain(trace2.id);
      expect(tracesB).not.toContain(trace1.id);
    });

    itIfTableExists('should return empty array when no traces exist for tenant', async () => {
      const mockEvaluator = createMockEvaluator();
      const pipeline = createEvalPipeline(prisma, mockEvaluator);

      // No traces created for tenantA
      const traces = await pipeline.getUnevaluatedTraces(tenantA.id, 100);

      expect(traces).toEqual([]);
    });
  });

  describe('submit', () => {
    itIfTableExists('should reject submission of trace from another tenant', async () => {
      // Setup: Create trace for tenant A
      const trace = await prisma.conversationTrace.create({
        data: {
          tenantId: tenantA.id,
          sessionId: `session-cross-tenant-${Date.now()}`,
          agentType: 'customer',
          startedAt: new Date(),
          messages: [],
          toolCalls: [],
        },
      });

      // Act & Assert: tenant B cannot submit tenant A's trace
      const mockEvaluator = createMockEvaluator();
      const pipeline = createEvalPipeline(prisma, mockEvaluator);

      await expect(pipeline.submit(tenantB.id, trace.id)).rejects.toThrow(TraceNotFoundError);
    });

    itIfTableExists('should allow submission of own tenant trace', async () => {
      // Setup: Create trace for tenant A
      const trace = await prisma.conversationTrace.create({
        data: {
          tenantId: tenantA.id,
          sessionId: `session-own-${Date.now()}`,
          agentType: 'customer',
          startedAt: new Date(),
          messages: [],
          toolCalls: [],
        },
      });

      // Act: tenant A can submit their own trace
      const mockEvaluator = createMockEvaluator();
      const pipeline = createEvalPipeline(prisma, mockEvaluator, {
        samplingRate: 1.0, // Always evaluate
        asyncProcessing: false, // Wait for result
      });

      // Should not throw
      await expect(pipeline.submit(tenantA.id, trace.id)).resolves.not.toThrow();

      // Verify evaluation was attempted
      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });
  });

  describe('tenantId validation', () => {
    itIfTableExists('should require tenantId for getUnevaluatedTraces', async () => {
      const mockEvaluator = createMockEvaluator();
      const pipeline = createEvalPipeline(prisma, mockEvaluator);

      // @ts-expect-error - Testing runtime validation
      await expect(pipeline.getUnevaluatedTraces(undefined, 100)).rejects.toThrow(
        'tenantId is required'
      );

      // @ts-expect-error - Testing runtime validation
      await expect(pipeline.getUnevaluatedTraces('', 100)).rejects.toThrow('tenantId is required');

      // @ts-expect-error - Testing runtime validation
      await expect(pipeline.getUnevaluatedTraces(null, 100)).rejects.toThrow(
        'tenantId is required'
      );
    });

    itIfTableExists('should require tenantId for submit', async () => {
      const mockEvaluator = createMockEvaluator();
      const pipeline = createEvalPipeline(prisma, mockEvaluator);

      // @ts-expect-error - Testing runtime validation
      await expect(pipeline.submit(undefined, 'trace-id')).rejects.toThrow('tenantId is required');

      // @ts-expect-error - Testing runtime validation
      await expect(pipeline.submit('', 'trace-id')).rejects.toThrow('tenantId is required');
    });
  });

  describe('processBatch', () => {
    itIfTableExists('should only process traces belonging to the specified tenant', async () => {
      // Setup: Create traces for both tenants
      const traceA1 = await prisma.conversationTrace.create({
        data: {
          tenantId: tenantA.id,
          sessionId: `session-batch-a1-${Date.now()}`,
          agentType: 'customer',
          startedAt: new Date(),
          messages: [],
          toolCalls: [],
        },
      });

      const traceA2 = await prisma.conversationTrace.create({
        data: {
          tenantId: tenantA.id,
          sessionId: `session-batch-a2-${Date.now()}`,
          agentType: 'customer',
          startedAt: new Date(),
          messages: [],
          toolCalls: [],
        },
      });

      const traceB1 = await prisma.conversationTrace.create({
        data: {
          tenantId: tenantB.id,
          sessionId: `session-batch-b1-${Date.now()}`,
          agentType: 'customer',
          startedAt: new Date(),
          messages: [],
          toolCalls: [],
        },
      });

      // Act: Process batch for tenant A including tenant B's trace ID (malicious attempt)
      const mockEvaluator = createMockEvaluator();
      const pipeline = createEvalPipeline(prisma, mockEvaluator, {
        samplingRate: 1.0,
        asyncProcessing: false,
      });

      // Try to process tenant A traces + tenant B trace (should fail for B's trace)
      await pipeline.processBatch(tenantA.id, [traceA1.id, traceA2.id, traceB1.id]);

      // Wait for any pending
      await pipeline.waitForPending();

      // Assert: Only tenant A's traces were evaluated
      // mockEvaluator.evaluate should have been called twice (for A1 and A2)
      expect(mockEvaluator.evaluate).toHaveBeenCalledTimes(2);

      // Verify traceB1 was NOT evaluated (check evalScore in database)
      const traceB1Updated = await prisma.conversationTrace.findUnique({
        where: { id: traceB1.id },
        select: { evalScore: true },
      });
      expect(traceB1Updated?.evalScore).toBeNull();
    });
  });
});
