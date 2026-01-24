# Refactor: Split base-orchestrator.ts (Todo 561) — Revised

**Created:** 2025-01-01
**Revised:** 2025-01-01 (incorporated reviewer feedback)
**Priority:** P1 (conditional — validate pain first)
**Estimated Effort:** 2-3 hours (minimal extraction) or 30 min (region comments only)
**Type:** Refactoring

---

## Reviewer Feedback Summary

| Reviewer                | Verdict                  | Key Feedback                                                         |
| ----------------------- | ------------------------ | -------------------------------------------------------------------- |
| **DHH**                 | APPROVE_WITH_SUGGESTIONS | "Extract when it hurts. Validate pain first. Start with one module." |
| **Kieran (TypeScript)** | APPROVE_WITH_SUGGESTIONS | "Fix DI violations, strengthen types, inject ProposalService"        |
| **Simplicity Reviewer** | REQUEST_CHANGES          | "Hooks pattern is overkill. Consider //#region comments instead."    |

### Changes from Original Plan

| Original                        | Revised                                                |
| ------------------------------- | ------------------------------------------------------ |
| Extract all 3 modules at once   | **Extract SessionManager only**, evaluate after 1 week |
| Hooks pattern for ToolProcessor | **Pass dependencies directly** (AuditService, Cache)   |
| 4 new config interfaces         | **Use existing OrchestratorConfig**                    |
| 6 hours estimated               | **2-3 hours** (or 30 min for region comments)          |
| Skip pain validation            | **Validate pain first** with git analysis              |

---

## Phase 0: Validate the Pain (30 min)

**Before any extraction, answer these questions:**

```bash
# 1. How often does this file change?
git log --oneline --since="2024-06-01" -- server/src/agent/orchestrator/base-orchestrator.ts | wc -l

# 2. View what changed in each commit
git log --stat --since="2024-06-01" -- server/src/agent/orchestrator/base-orchestrator.ts

# 3. Do changes span multiple responsibilities?
git log -p --since="2024-06-01" -- server/src/agent/orchestrator/base-orchestrator.ts | head -500
```

### Decision Matrix

| Finding                                     | Action                                          |
| ------------------------------------------- | ----------------------------------------------- |
| < 5 changes in 6 months, localized          | **Option A: Region comments only**              |
| 5-15 changes, some cross-responsibility     | **Option B: Extract SessionManager only**       |
| > 15 changes, frequent cross-responsibility | **Option C: Full extraction (not recommended)** |

---

## Option A: Region Comments Only (30 min)

**If pain is minimal, add organization without extraction:**

```typescript
// base-orchestrator.ts

//#region Imports and Types (lines 1-220)
import Anthropic from '@anthropic-ai/sdk';
// ... existing imports and interfaces
//#endregion

//#region Abstract Methods (lines 310-375)
protected abstract getTools(): AgentTool[];
protected abstract buildSystemPrompt(context: PromptContext): Promise<string>;
abstract getConfig(): OrchestratorConfig;
//#endregion

//#region Session Management (lines 416-504)
async getOrCreateSession(tenantId: string): Promise<SessionState> { }
async getSession(tenantId: string, sessionId: string): Promise<SessionState | null> { }
//#endregion

//#region Chat Processing (lines 513-733)
async chat(tenantId: string, requestedSessionId: string, userMessage: string): Promise<ChatResponse> { }
//#endregion

//#region Proposal Execution (lines 742-858)
protected async executeConfirmedProposals(...): Promise<void> { }
//#endregion

//#region Tool Processing (lines 887-1151)
protected async processResponse(...): Promise<ProcessedResponse> { }
//#endregion

//#region Session Updates (lines 1156-1199)
protected async updateSession(...): Promise<void> { }
//#endregion

//#region Circuit Breaker Cleanup (lines 1226-1263)
private cleanupOldCircuitBreakers(): void { }
//#endregion
```

**Benefits:**

- Zero risk (no code changes)
- All editors support region folding
- Immediate navigability improvement
- 30 minutes, not 6 hours

**If this solves the problem, close todo 561 as "resolved with regions".**

---

## Option B: Minimal Extraction — SessionManager Only (2-3 hours)

**If pain is real, extract the lowest-coupling module first.**

### Why SessionManager First?

| Module             | Coupling | Dependencies                                | Extraction Risk |
| ------------------ | -------- | ------------------------------------------- | --------------- |
| **SessionManager** | Low      | Prisma only                                 | Low             |
| ProposalExecutor   | Medium   | executor-registry, ProposalService          | Medium          |
| ToolProcessor      | High     | Anthropic, rateLimiter, auditService, cache | High            |

SessionManager is self-contained CRUD with no external service dependencies.

### Resulting Structure

```
server/src/agent/orchestrator/
├── base-orchestrator.ts      # ~1100 lines (down from 1265)
├── session-manager.ts        # NEW: ~120 lines
├── admin-orchestrator.ts     # Unchanged
├── customer-chat-orchestrator.ts  # Unchanged
└── onboarding-orchestrator.ts     # Unchanged
```

**Note:** No `types/` directory needed. Types stay in `base-orchestrator.ts`.

---

### Implementation: session-manager.ts

```typescript
import type { PrismaClient, Prisma } from '../../generated/prisma';
import { logger } from '../../lib/core/logger';
import type { OrchestratorConfig } from './types';

// Types remain in base-orchestrator.ts, import them
import type { SessionState, ChatMessage, ToolResultEntry } from './base-orchestrator';

/**
 * Parse messages from database JSON to ChatMessage[]
 * Moved from base-orchestrator.ts (was exported for testing)
 */
export function parseChatMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter((msg): msg is ChatMessage => {
    return (
      typeof msg === 'object' &&
      msg !== null &&
      'role' in msg &&
      'content' in msg &&
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof msg.content === 'string'
    );
  });
}

/**
 * SessionManager - Handles session CRUD operations
 *
 * Extracted from BaseOrchestrator to improve testability.
 * Uses OrchestratorConfig directly (no separate config interface).
 */
export class SessionManager {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sessionType: 'ADMIN' | 'CUSTOMER' | null,
    private readonly ttlMs: number,
    private readonly agentType: string,
    private readonly maxHistoryMessages: number
  ) {}

  /**
   * Factory method using OrchestratorConfig
   * Avoids creating separate SessionManagerConfig interface
   */
  static fromConfig(
    prisma: PrismaClient,
    config: OrchestratorConfig,
    sessionType: 'ADMIN' | 'CUSTOMER' | null,
    ttlMs: number
  ): SessionManager {
    return new SessionManager(
      prisma,
      sessionType,
      ttlMs,
      config.agentType,
      config.maxHistoryMessages
    );
  }

  /**
   * Get or create session for a tenant
   */
  async getOrCreateSession(tenantId: string): Promise<SessionState> {
    const whereClause: Prisma.AgentSessionWhereInput = {
      tenantId,
      updatedAt: { gt: new Date(Date.now() - this.ttlMs) },
    };

    if (this.sessionType !== null) {
      whereClause.sessionType = this.sessionType;
    }

    const existingSession = await this.prisma.agentSession.findFirst({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
    });

    if (existingSession) {
      return {
        sessionId: existingSession.id,
        tenantId,
        messages: parseChatMessages(existingSession.messages),
        createdAt: existingSession.createdAt,
        updatedAt: existingSession.updatedAt,
      };
    }

    // Create new session
    const createData: Prisma.AgentSessionCreateInput = {
      tenant: { connect: { id: tenantId } },
      messages: [],
    };

    if (this.sessionType !== null) {
      createData.sessionType = this.sessionType;
    }

    const newSession = await this.prisma.agentSession.create({
      data: createData,
    });

    logger.info(
      { tenantId, sessionId: newSession.id, agentType: this.agentType },
      'New agent session created'
    );

    return {
      sessionId: newSession.id,
      tenantId,
      messages: [],
      createdAt: newSession.createdAt,
      updatedAt: newSession.updatedAt,
    };
  }

  /**
   * Get existing session by ID
   */
  async getSession(tenantId: string, sessionId: string): Promise<SessionState | null> {
    const whereClause: Prisma.AgentSessionWhereInput = {
      id: sessionId,
      tenantId, // CRITICAL: Tenant isolation
    };

    if (this.sessionType !== null) {
      whereClause.sessionType = this.sessionType;
    }

    const session = await this.prisma.agentSession.findFirst({
      where: whereClause,
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      tenantId,
      messages: parseChatMessages(session.messages),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Update session with new messages
   */
  async updateSession(
    sessionId: string,
    existingMessages: ChatMessage[],
    userMessage: string,
    assistantMessage: string,
    toolResults: ToolResultEntry[] | undefined
  ): Promise<void> {
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
    };

    const messageContent =
      assistantMessage || (toolResults && toolResults.length > 0 ? '[Tools executed]' : 'Done.');

    const newAssistantMessage: ChatMessage = {
      role: 'assistant',
      content: messageContent,
      toolUses: toolResults?.map((r) => ({
        toolName: r.toolName,
        input: r.input || {},
        result: r.result,
      })),
    };

    const updatedMessages = [...existingMessages, newUserMessage, newAssistantMessage].slice(
      -this.maxHistoryMessages
    );

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        messages: updatedMessages as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
  }
}
```

### Integration in BaseOrchestrator

```typescript
// base-orchestrator.ts

import { SessionManager, parseChatMessages } from './session-manager';

export abstract class BaseOrchestrator {
  // ... existing fields
  protected readonly sessionManager: SessionManager;

  constructor(
    protected readonly prisma: PrismaClient,
    cache: ContextCache = defaultContextCache
  ) {
    // ... existing initialization

    // Initialize SessionManager using factory
    const config = this.getConfig();
    this.sessionManager = SessionManager.fromConfig(
      prisma,
      config,
      this.getSessionType(),
      this.getSessionTtlMs()
    );
  }

  // Delegate to SessionManager (maintain backward compatibility)
  async getOrCreateSession(tenantId: string): Promise<SessionState> {
    return this.sessionManager.getOrCreateSession(tenantId);
  }

  async getSession(tenantId: string, sessionId: string): Promise<SessionState | null> {
    return this.sessionManager.getSession(tenantId, sessionId);
  }

  // In chat() method - use sessionManager
  async chat(
    tenantId: string,
    requestedSessionId: string,
    userMessage: string
  ): Promise<ChatResponse> {
    // ... existing code

    let session = await this.sessionManager.getSession(tenantId, requestedSessionId);
    if (!session) {
      session = await this.sessionManager.getOrCreateSession(tenantId);
    }

    // ... rest of chat() unchanged

    // At end, use sessionManager for update
    await this.sessionManager.updateSession(
      session.sessionId,
      session.messages,
      userMessage,
      finalMessage,
      toolResults
    );
  }

  // Remove these methods from BaseOrchestrator (now in SessionManager):
  // - getOrCreateSession (delegated)
  // - getSession (delegated)
  // - updateSession (delegated)
  // Keep parseChatMessages as re-export for test compatibility
}

// Re-export for backward compatibility with tests
export { parseChatMessages } from './session-manager';
```

---

## TypeScript Fixes (Per Kieran's Review)

### Fix 1: trustTier Type (P1)

```typescript
// In orchestrator.types.ts or base-orchestrator.ts
export interface ProposalInfo {
  proposalId: string;
  operation: string;
  preview: Record<string, unknown>;
  trustTier: 'T1' | 'T2' | 'T3'; // Changed from string
  requiresApproval: boolean;
}
```

### Fix 2: TenantSessionData Index Signature (P1)

**Option A: Remove index signature (breaking change)**

```typescript
// Base tenant data only
export interface TenantSessionData {
  id: string;
  name: string;
  email: string | null;
  onboardingPhase: string | null;
}

// Subclasses use intersection types for extensions
type CustomerTenantData = TenantSessionData & {
  packages: Array<{ name: string; basePrice: number }>;
};
```

**Option B: Keep for backward compatibility (defer)**

```typescript
// Keep as-is, document the trade-off
export interface TenantSessionData {
  id: string;
  name: string;
  email: string | null;
  onboardingPhase: string | null;
  /** @deprecated Avoid index access, use explicit fields */
  [key: string]: unknown;
}
```

**Recommendation:** Option B (defer) — this is a P1 not P0, address in separate PR.

### Fix 3: Missing Import (P2)

```typescript
// session-manager.ts needs ToolResultEntry
import type { ToolResultEntry } from './base-orchestrator';
// Or after extraction:
import type { ToolResultEntry } from '../types/orchestrator.types';
```

---

## What We're NOT Doing (Reviewer Guidance)

### No Hooks Pattern

**Original plan had:**

```typescript
// ToolProcessorHooks with 4 optional callbacks
export interface ToolProcessorHooks {
  onProposalCreated?: (...) => Promise<void>;
  onToolRead?: (...) => Promise<void>;
  onToolError?: (...) => Promise<void>;
  onCacheInvalidation?: (...) => void;
}
```

**Why removed:** "Observer pattern where there's only ever ONE observer" — Simplicity Reviewer

**If we later extract ToolProcessor, use direct dependencies:**

```typescript
// Direct injection, not hooks
class ToolProcessor {
  constructor(
    private readonly anthropic: Anthropic,
    private readonly rateLimiter: ToolRateLimiter,
    private readonly auditService: AuditService, // Direct
    private readonly cache: ContextCache, // Direct
    private readonly config: ToolProcessorConfig
  ) {}
}
```

### No Separate Config Interfaces

**Original plan had:**

- `SessionManagerConfig` (4 fields)
- `ProposalExecutorConfig` (2 fields)
- `ToolProcessorConfig` (6 fields)

**Why removed:** "Configuration explosion" — DHH

**Use existing OrchestratorConfig and let classes read what they need.**

### No types/ Directory

**Original plan created:**

```
types/
├── session.types.ts
└── orchestrator.types.ts
```

**Why removed:** Types are small, keep them in `base-orchestrator.ts` unless/until we extract more modules.

---

## Acceptance Criteria

### Option A (Region Comments)

- [ ] All 7 sections have `//#region` markers
- [ ] Regions are collapsible in VS Code
- [ ] No code changes, only comments
- [ ] Close todo 561 as "resolved with regions"

### Option B (SessionManager Extraction)

- [ ] `session-manager.ts` created (~120 lines)
- [ ] BaseOrchestrator delegates to SessionManager
- [ ] `parseChatMessages` exported from session-manager.ts
- [ ] All 1,730 tests pass
- [ ] No circular dependencies
- [ ] TypeScript compiles
- [ ] Evaluate in 1 week before deciding on further extraction

---

## Implementation Steps (Option B)

### Step 1: Create session-manager.ts (45 min)

```bash
# Create the file
touch server/src/agent/orchestrator/session-manager.ts

# Run tests after creation
npm test -- test/agent/orchestrator/base-orchestrator.test.ts
```

### Step 2: Update BaseOrchestrator (30 min)

- Add `sessionManager` field
- Initialize in constructor using factory
- Delegate `getOrCreateSession`, `getSession`, `updateSession`
- Re-export `parseChatMessages` for test compatibility

### Step 3: Create SessionManager Tests (45 min)

```typescript
// server/test/agent/orchestrator/session-manager.test.ts
describe('SessionManager', () => {
  describe('getOrCreateSession', () => {
    it('should create new session when none exists', async () => {});
    it('should return existing session within TTL', async () => {});
    it('should filter by sessionType when specified', async () => {});
  });

  describe('getSession', () => {
    it('should enforce tenant isolation', async () => {});
    it('should return null for non-existent session', async () => {});
  });

  describe('updateSession', () => {
    it('should append messages and respect maxHistory', async () => {});
  });
});
```

### Step 4: Verify & Cleanup (30 min)

```bash
# Full test suite
npm test

# Check for circular deps
npx madge --circular server/src/agent/

# Typecheck
npm run typecheck

# Check line counts
wc -l server/src/agent/orchestrator/*.ts
```

---

## One Week Evaluation

After living with SessionManager for 1 week, answer:

1. **Did extraction help?** Is session logic easier to test/understand?
2. **Any issues?** Did delegation cause confusion or bugs?
3. **Worth continuing?** Should we extract ProposalExecutor next?

**If yes to all:** Plan ProposalExecutor extraction (without hooks pattern)
**If mixed:** Keep SessionManager, stop extraction
**If no:** Consider reverting (low risk, small change)

---

## Commands

```bash
# Validate pain (Phase 0)
git log --oneline --since="2024-06-01" -- server/src/agent/orchestrator/base-orchestrator.ts | wc -l

# Run tests
npm test -- test/agent/orchestrator/

# Check circular deps
npx madge --circular server/src/agent/

# Typecheck
npm run typecheck

# Check file line counts
wc -l server/src/agent/orchestrator/*.ts
```

---

## References

### Reviewer Feedback

- DHH: "Extract when it hurts. Start with one module."
- Kieran: "Inject ProposalService, fix trustTier type"
- Simplicity: "Hooks pattern is overkill. Consider regions."

### Internal References

- Todo file: `todos/561-pending-p3-base-orchestrator-too-large.md`
- Base orchestrator: `server/src/agent/orchestrator/base-orchestrator.ts`

### Patterns Used

- Factory method (`SessionManager.fromConfig()`)
- Delegation (BaseOrchestrator delegates to SessionManager)
- Re-export for backward compatibility
