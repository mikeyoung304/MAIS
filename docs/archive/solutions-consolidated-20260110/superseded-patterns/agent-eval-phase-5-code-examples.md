# Agent Eval Phase 5: Copy-Paste Code Examples

**Structured code snippets for P2-612 through P3-616 patterns** | Use these as templates

---

## P2-612: Zod Validation Example

### Full Schema Definition

```typescript
import { z } from 'zod';

// Define the schema with all constraints
export const ReviewSubmissionSchema = z.object({
  reviewedBy: z
    .string()
    .min(1, 'Reviewer identifier is required')
    .max(100, 'Reviewer identifier must be 100 characters or less'),

  notes: z.string().max(2000, 'Notes must be 2000 characters or less'),

  correctEvalScore: z
    .number()
    .min(0, 'Score must be at least 0')
    .max(10, 'Score must be at most 10')
    .optional(),

  actionTaken: z.enum([
    'none',
    'approve',
    'reject',
    'escalate',
    'prompt_updated',
    'bug_filed',
    'retrain',
  ]),
});

// Infer TypeScript type from schema
export type ReviewSubmission = z.infer<typeof ReviewSubmissionSchema>;
```

### Usage in Service Method

```typescript
async submitReview(
  tenantId: string,
  traceId: string,
  review: ReviewSubmission
): Promise<void> {
  // Validate input FIRST (stops invalid data early)
  const validated = ReviewSubmissionSchema.parse(review);

  // Now use validated fields (type-safe, guaranteed constraints met)
  await this.prisma.$transaction(async (tx) => {
    const updated = await tx.conversationTrace.updateMany({
      where: { id: traceId, tenantId },
      data: {
        reviewStatus: 'reviewed',
        reviewedAt: new Date(),
        reviewedBy: validated.reviewedBy, // Max 100 chars guaranteed
        reviewNotes: validated.notes,      // Max 2000 chars guaranteed
        ...(validated.correctEvalScore !== undefined && {
          evalScore: validated.correctEvalScore, // 0-10 guaranteed
        }),
      },
    });

    if (updated.count === 0) {
      throw new Error('Trace not found or access denied');
    }

    // Log action only if not 'none'
    if (validated.actionTaken !== 'none') {
      await tx.reviewAction.create({
        data: {
          tenantId,
          traceId,
          action: validated.actionTaken,
          notes: validated.notes,
          correctedScore: validated.correctEvalScore,
          performedBy: validated.reviewedBy,
        },
      });
    }
  });
}
```

### Error Handling

```typescript
import { ZodError } from 'zod';

async submitReview(
  tenantId: string,
  traceId: string,
  review: unknown // Accept unknown input
): Promise<void> {
  try {
    // Validate with error handling
    const validated = ReviewSubmissionSchema.parse(review);

    // Process validated data...

  } catch (error) {
    if (error instanceof ZodError) {
      // Extract first error for user feedback
      const firstIssue = error.issues[0];
      throw new ValidationError(
        `${firstIssue.path.join('.')}: ${firstIssue.message}`
      );
    }
    throw error; // Unknown error, propagate
  }
}
```

---

## P2-613: Test Coverage Structure

### PII Redaction Tests

```typescript
import { describe, it, expect } from 'vitest';
import {
  redactPII,
  redactMessages,
  redactToolCalls,
  redactObjectPII,
  redactMessagesForPreview,
} from '../../src/lib/pii-redactor';

describe('PII Redactor', () => {
  describe('redactPII', () => {
    it('should redact email addresses', () => {
      const text = 'Contact me at john.doe@example.com for details';
      expect(redactPII(text)).toBe('Contact me at [EMAIL] for details');
    });

    it('should redact multiple emails in same text', () => {
      const text = 'Email alice@test.com or bob@company.org';
      expect(redactPII(text)).toBe('Email [EMAIL] or [EMAIL]');
    });

    it('should redact phone numbers', () => {
      const text = 'Call me at 555-123-4567';
      expect(redactPII(text)).toBe('Call me at [PHONE]');
    });

    it('should redact credit card numbers', () => {
      const text = 'Card: 1234-5678-9012-3456';
      expect(redactPII(text)).toBe('Card: [CARD]');
    });

    it('should redact SSN', () => {
      const text = 'SSN: 123-45-6789';
      expect(redactPII(text)).toBe('SSN: [SSN]');
    });

    it('should redact addresses', () => {
      const text = 'I live at 123 Main Street';
      expect(redactPII(text)).toBe('I live at [ADDRESS]');
    });
  });

  describe('redactMessages', () => {
    it('should redact content in message array', () => {
      const messages = [
        { role: 'user', content: 'My email is test@example.com' },
        { role: 'assistant', content: 'I got your email' },
      ];

      const result = redactMessages(messages);

      expect(result[0].content).toBe('My email is [EMAIL]');
      expect(result[1].content).toBe('I got your email');
    });

    it('should preserve message properties', () => {
      const messages = [{ role: 'user', content: 'test@example.com', timestamp: '2024-01-01' }];

      const result = redactMessages(messages);

      expect(result[0].role).toBe('user');
      expect(result[0].timestamp).toBe('2024-01-01');
    });

    it('should handle empty array', () => {
      expect(redactMessages([])).toEqual([]);
    });
  });

  describe('redactToolCalls', () => {
    it('should redact sensitive keys in input', () => {
      const toolCalls = [
        {
          toolName: 'send_email',
          input: { email: 'test@example.com', subject: 'Hello' },
          output: { success: true },
        },
      ];

      const result = redactToolCalls(toolCalls);
      expect(result[0].input.email).toBe('[REDACTED_EMAIL]');
    });

    it('should redact sensitive keys in output', () => {
      const toolCalls = [
        {
          toolName: 'lookup_customer',
          input: { id: '123' },
          output: { phone: '555-123-4567', name: 'John' },
        },
      ];

      const result = redactToolCalls(toolCalls);
      expect(result[0].output.phone).toBe('[REDACTED_PHONE]');
    });

    it('should handle nested objects', () => {
      const toolCalls = [
        {
          toolName: 'complex_tool',
          input: {
            customer: { email: 'nested@test.com', name: 'Test' },
          },
          output: { ok: true },
        },
      ];

      const result = redactToolCalls(toolCalls);
      expect((result[0].input.customer as any).email).toBe('[REDACTED_EMAIL]');
    });
  });

  describe('redactMessagesForPreview', () => {
    it('should redact and truncate to default length', () => {
      const longContent = 'test@example.com ' + 'a'.repeat(600);
      const messages = [{ role: 'user', content: longContent }];

      const result = redactMessagesForPreview(messages);

      expect(result[0].content).toContain('[EMAIL]');
      expect(result[0].content.length).toBe(500);
    });

    it('should use custom maxLength', () => {
      const messages = [{ role: 'user', content: 'Hello there my friend!' }];
      const result = redactMessagesForPreview(messages, 10);

      expect(result[0].content).toBe('Hello ther');
    });

    it('should preserve role field', () => {
      const messages = [
        { role: 'user', content: 'test', extra: 'data' },
        { role: 'assistant', content: 'response', extra: 'info' },
      ];

      const result = redactMessagesForPreview(messages);

      expect(result[0]).toEqual({ role: 'user', content: 'test' });
      expect(result[1]).toEqual({ role: 'assistant', content: 'response' });
    });
  });
});
```

### Pipeline Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '../../src/generated/prisma';
import { EvalPipeline } from '../../src/agent/evals/pipeline';
import { ConversationEvaluator } from '../../src/agent/evals/evaluator';

describe('EvalPipeline', () => {
  let mockPrisma: DeepMockProxy<PrismaClient>;
  let mockEvaluator: { evaluate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Prisma client
    mockPrisma = mockDeep<PrismaClient>();

    // Create mock evaluator
    mockEvaluator = {
      evaluate: vi.fn().mockResolvedValue({
        dimensions: [],
        overallScore: 7,
        overallConfidence: 0.9,
        summary: 'Good conversation',
        flagged: false,
        flagReason: null,
      }),
    };
  });

  describe('submit', () => {
    it('should require tenantId', async () => {
      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator
      );

      await expect(pipeline.submit('', 'trace-1')).rejects.toThrow('tenantId is required');
    });

    it('should skip already evaluated traces', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
        evalScore: 8.5, // Already evaluated
      } as any);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator
      );

      await pipeline.submit('tenant-1', 'trace-1');

      // Should not call evaluator
      expect(mockEvaluator.evaluate).not.toHaveBeenCalled();
    });

    it('should throw when trace not found', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue(null);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator
      );

      await expect(pipeline.submit('tenant-1', 'trace-999')).rejects.toThrow('Trace not found');
    });
  });

  describe('shouldEvaluate logic', () => {
    it('should always evaluate flagged traces', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
        flagged: true,
        taskCompleted: true,
        evalScore: null,
        messages: [],
        toolCalls: [],
        agentType: 'customer',
      } as any);
      mockPrisma.conversationTrace.update.mockResolvedValue({} as any);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        { samplingRate: 0, evaluateFlagged: true, asyncProcessing: false }
      );

      await pipeline.submit('tenant-1', 'trace-1');

      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });

    it('should always evaluate failed tasks', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
        flagged: false,
        taskCompleted: false, // Failed task
        evalScore: null,
        messages: [],
        toolCalls: [],
        agentType: 'customer',
      } as any);
      mockPrisma.conversationTrace.update.mockResolvedValue({} as any);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        { samplingRate: 0, evaluateFailedTasks: true, asyncProcessing: false }
      );

      await pipeline.submit('tenant-1', 'trace-1');

      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });

    it('should skip evaluation when not sampled', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
        flagged: false,
        taskCompleted: true,
        evalScore: null,
        messages: [],
        toolCalls: [],
        agentType: 'customer',
      } as any);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        {
          samplingRate: 0,
          evaluateFlagged: false,
          evaluateFailedTasks: false,
          asyncProcessing: false,
        }
      );

      await pipeline.submit('tenant-1', 'trace-1');

      expect(mockEvaluator.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('processBatch', () => {
    it('should process traces in batches', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        id: 'trace-1',
        tenantId: 'tenant-1',
        flagged: true,
        taskCompleted: true,
        evalScore: null,
        messages: [],
        toolCalls: [],
        agentType: 'customer',
      } as any);
      mockPrisma.conversationTrace.update.mockResolvedValue({} as any);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator,
        { batchSize: 2, asyncProcessing: false }
      );

      await pipeline.processBatch('tenant-1', ['trace-1', 'trace-2', 'trace-3']);

      // Each trace should be fetched
      expect(mockPrisma.conversationTrace.findFirst).toHaveBeenCalledTimes(3);
    });
  });

  describe('getUnevaluatedTraces', () => {
    it('should require tenantId', async () => {
      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator
      );

      await expect(pipeline.getUnevaluatedTraces('')).rejects.toThrow('tenantId is required');
    });

    it('should return trace IDs for tenant', async () => {
      mockPrisma.conversationTrace.findMany.mockResolvedValue([
        { id: 'trace-1' },
        { id: 'trace-2' },
      ] as any);

      const pipeline = new EvalPipeline(
        mockPrisma,
        mockEvaluator as unknown as ConversationEvaluator
      );

      const result = await pipeline.getUnevaluatedTraces('tenant-1', 50);

      expect(result).toEqual(['trace-1', 'trace-2']);
      expect(mockPrisma.conversationTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            evalScore: null,
          }),
        })
      );
    });
  });
});
```

---

## P2-614: Lazy Config Example

### Before (Broken)

```typescript
// ❌ WRONG: Evaluated at import time
const DEFAULT_CONFIG: PipelineConfig = {
  samplingRate: 0.1,
  evaluateFlagged: true,
  evaluateFailedTasks: true,
  batchSize: 10,
  asyncProcessing: true,
};

// In constructor:
constructor(..., config: Partial<PipelineConfig> = {}) {
  // DEFAULT_CONFIG already captured (evaluated at import)
  this.config = { ...DEFAULT_CONFIG, ...config };
}
```

### After (Fixed)

```typescript
// ✅ RIGHT: Evaluated at call time via factory
function getDefaultConfig(): PipelineConfig {
  return {
    samplingRate: 0.1,
    evaluateFlagged: true,
    evaluateFailedTasks: true,
    batchSize: 10,
    asyncProcessing: true,
  };
}

// In constructor:
constructor(..., config: Partial<PipelineConfig> = {}) {
  // getDefaultConfig() called here (runtime, not import time)
  this.config = { ...getDefaultConfig(), ...config };
}
```

### Same Pattern for Evaluator

```typescript
// Before: Broken
export function createEvaluator(): ConversationEvaluator {
  const modelName = process.env.EVAL_MODEL || 'claude-3-5-sonnet-20241022';
  // ❌ WRONG: ENV might not be set yet
  return new ConversationEvaluator(modelName, process.env.ANTHROPIC_API_KEY!);
}

// After: Fixed
export function createEvaluator(): ConversationEvaluator {
  // ✅ RIGHT: Read ENV when factory is called
  const modelName = process.env.EVAL_MODEL || 'claude-3-5-sonnet-20241022';
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  return new ConversationEvaluator(modelName, apiKey);
}
```

---

## P3-615: Mock Helper Example

### Complete Helper

```typescript
// File: test/helpers/mock-prisma.ts

import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '../../src/generated/prisma';

/**
 * Create a type-safe Prisma mock with $transaction pre-configured.
 *
 * @returns DeepMockProxy<PrismaClient> - Fully mocked Prisma client
 */
export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  const mock = mockDeep<PrismaClient>();

  // Pre-configure $transaction to execute callback with the mock
  // This is the pattern used in MAIS for transaction logic
  mock.$transaction.mockImplementation(async (callback) => {
    if (typeof callback === 'function') {
      // Pass mock as the transaction client parameter
      return callback(mock as unknown as Parameters<typeof callback>[0]);
    }
    // For array-based transactions, return empty array
    return [];
  });

  return mock;
}

// Re-export type for convenience
export type { DeepMockProxy } from 'vitest-mock-extended';
```

### Usage Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockPrisma } from '../helpers/mock-prisma';
import { ReviewQueue } from '../../src/agent/feedback/review-queue';

describe('ReviewQueue with Transaction', () => {
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma(); // ✅ Setup with $transaction ready
  });

  it('should submit review in transaction', async () => {
    // Mock the updateMany call
    mockPrisma.conversationTrace.updateMany.mockResolvedValue({
      count: 1,
    });

    // Mock the create call (called within transaction)
    mockPrisma.reviewAction.create.mockResolvedValue({
      id: 'action-1',
      tenantId: 'tenant-1',
      traceId: 'trace-1',
      action: 'approve',
      notes: 'Good',
      correctedScore: undefined,
      performedBy: 'reviewer-1',
      createdAt: new Date(),
    } as any);

    const queue = new ReviewQueue(mockPrisma);

    // This uses $transaction, which is pre-configured
    await queue.submitReview('tenant-1', 'trace-1', {
      reviewedBy: 'reviewer-1',
      notes: 'Good',
      actionTaken: 'approve',
    });

    // Verify calls happened
    expect(mockPrisma.conversationTrace.updateMany).toHaveBeenCalled();
    expect(mockPrisma.reviewAction.create).toHaveBeenCalled();
  });
});
```

---

## P3-616: Database Index Example

### Schema Addition

```typescript
// File: server/prisma/schema.prisma

model AgentProposal {
  id              String             @id @default(cuid())
  tenantId        String
  sessionId       String
  customerId      String?
  toolName        String
  operation       String
  trustTier       AgentTrustTier
  payload         Json
  preview         Json
  status          AgentProposalStatus @default(PENDING)
  requiresApproval Boolean           @default(true)
  expiresAt       DateTime
  confirmedAt     DateTime?
  executedAt      DateTime?
  result          Json?
  error           String?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  tenant          Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer        Customer?          @relation(fields: [customerId], references: [id], onDelete: SetNull)

  // Existing indexes
  @@index([tenantId, sessionId])
  @@index([tenantId, status])
  @@index([expiresAt])
  @@index([status, expiresAt]) // P1 fix

  // ✅ NEW: Index for orphan recovery queries
  @@index([status, updatedAt])

  @@index([tenantId])
  @@index([customerId])
}
```

### Query Using Index

```typescript
// File: server/src/jobs/cleanup.ts

import type { PrismaClient } from '../generated/prisma';
import { logger } from '../lib/core/logger';

/**
 * Clean up orphaned proposals (stuck in FAILED or CONFIRMED > 30 days)
 * Uses index on (status, updatedAt) for efficient retrieval
 */
export async function cleanupOrphanProposals(
  prisma: PrismaClient,
  tenantId: string
): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // ✅ This query is indexed via @@index([status, updatedAt])
  // Performance: O(log n) for index + O(k) for k results (not O(n) full scan)
  const orphanedProposals = await prisma.agentProposal.findMany({
    where: {
      tenantId,
      status: { in: ['FAILED', 'CONFIRMED'] },
      updatedAt: { lt: thirtyDaysAgo },
    },
    select: { id: true },
  });

  if (orphanedProposals.length === 0) {
    logger.debug({ tenantId }, 'No orphaned proposals found');
    return;
  }

  // Delete orphaned proposals
  await prisma.agentProposal.deleteMany({
    where: {
      tenantId,
      id: { in: orphanedProposals.map((p) => p.id) },
    },
  });

  logger.info({ tenantId, count: orphanedProposals.length }, 'Cleaned up orphaned proposals');
}
```

### Migration

```bash
# Create migration with index
cd server
npm exec prisma migrate dev --name "add_agent_proposal_orphan_index"

# This generates:
# migration YYYYMMDDHHMMSS_add_agent_proposal_orphan_index
#   ...
#   CREATE INDEX "AgentProposal_status_updatedAt_idx" ON "AgentProposal"("status", "updatedAt");
```

---

## All Patterns Together

```typescript
// File: server/src/agent/feedback/review-queue.ts
import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma';

// 1. P2-612: Zod validation
export const ReviewSubmissionSchema = z.object({
  reviewedBy: z.string().min(1).max(100),
  notes: z.string().max(2000),
  correctEvalScore: z.number().min(0).max(10).optional(),
  actionTaken: z.enum(['none', 'approve', 'reject', 'escalate']),
});

export type ReviewSubmission = z.infer<typeof ReviewSubmissionSchema>;

export class ReviewQueue {
  constructor(private readonly prisma: PrismaClient) {}

  async submitReview(
    tenantId: string,
    traceId: string,
    review: ReviewSubmission // Type from Zod
  ): Promise<void> {
    // Validate before use (P2-612)
    const validated = ReviewSubmissionSchema.parse(review);

    // Use in transaction (works with P3-615 mock)
    await this.prisma.$transaction(async (tx) => {
      await tx.conversationTrace.updateMany({
        where: { id: traceId, tenantId },
        data: {
          reviewedBy: validated.reviewedBy,
          reviewNotes: validated.notes,
          ...(validated.correctEvalScore !== undefined && {
            evalScore: validated.correctEvalScore,
          }),
        },
      });

      if (validated.actionTaken !== 'none') {
        await tx.reviewAction.create({
          data: {
            tenantId,
            traceId,
            action: validated.actionTaken,
            notes: validated.notes,
            correctedScore: validated.correctEvalScore,
            performedBy: validated.reviewedBy,
          },
        });
      }
    });
  }
}
```

```typescript
// File: server/test/agent-eval/review-queue.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockPrisma } from '../helpers/mock-prisma'; // P3-615
import { ReviewQueue, ReviewSubmissionSchema } from '../../src/agent/feedback/review-queue'; // P2-612

describe('ReviewQueue (All Patterns)', () => {
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma(); // P3-615: Centralized mock
  });

  it('should validate input with Zod', async () => {
    const queue = new ReviewQueue(mockPrisma);

    // Valid input passes
    const validReview = {
      reviewedBy: 'reviewer-1',
      notes: 'Good response',
      actionTaken: 'approve' as const,
    };
    expect(() => ReviewSubmissionSchema.parse(validReview)).not.toThrow();

    // Invalid input fails
    expect(() =>
      ReviewSubmissionSchema.parse({
        reviewedBy: 'a'.repeat(101), // Too long
        notes: 'ok',
        actionTaken: 'approve',
      })
    ).toThrow('must be 100 characters or less');
  });

  it('should submit review with mock transaction', async () => {
    mockPrisma.conversationTrace.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.reviewAction.create.mockResolvedValue({} as any);

    const queue = new ReviewQueue(mockPrisma);

    // P2-612: Type-safe input
    const review = {
      reviewedBy: 'reviewer-1',
      notes: 'Good response',
      correctEvalScore: 8,
      actionTaken: 'approve' as const,
    };

    // P3-615: $transaction works in test
    await queue.submitReview('tenant-1', 'trace-1', review);

    expect(mockPrisma.conversationTrace.updateMany).toHaveBeenCalled();
    expect(mockPrisma.reviewAction.create).toHaveBeenCalled();
  });
});

// P2-613: Test coverage for PII, pipeline, etc. (see separate section)
```

---

## Summary Table

| Pattern         | File                        | Key Benefit                       |
| --------------- | --------------------------- | --------------------------------- |
| P2-612 (Zod)    | review-queue.ts             | Input validation + type inference |
| P2-613 (Tests)  | pipeline.test.ts            | 68 tests for PII + pipeline       |
| P2-614 (Config) | evaluator.ts, pipeline.ts   | ENV read at runtime, not import   |
| P3-615 (Mock)   | test/helpers/mock-prisma.ts | $transaction pre-configured       |
| P3-616 (Index)  | schema.prisma               | O(log n) query performance        |

All patterns follow MAIS conventions:

- Tenant isolation (tenantId checks)
- Type safety (Zod, TypeScript strict)
- Security validation (input parsing)
- Test coverage (70%+ target)
