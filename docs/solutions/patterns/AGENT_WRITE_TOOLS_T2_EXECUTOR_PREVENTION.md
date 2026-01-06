# Agent Write Tools - T2 Soft Confirm + Executor Registry Prevention

**Status:** Complete Prevention Pattern
**Severity:** P2 (Agent Architecture & Security)
**Last Updated:** 2026-01-05
**Related:** P2 Fix #644, Circular Dependency Pattern

## Problem Statement

Write tools (T2 - soft confirm) fail to execute because executors aren't registered in executor-registry.ts:

```typescript
// ❌ WRONG - Tool defined but executor not registered
export const deletePackagePhotoTool = {
  name: 'delete_package_photo',
  trustTier: 'T2',
  // Tool returns proposal...
};

// ❌ WRONG - Executor defined but not registered
export async function deletePackagePhotoExecutor(tenantId, payload) {
  // Does the work...
}

// Result: Tool soft-confirms, proposal stores in DB, but never executes (orphaned)
```

**Consequences:**

- T2 proposals confirm but never execute (user sees "done" but nothing happens)
- Orphaned proposal records in database
- Silent failures (no error message, just stalled operation)
- Circular dependency issues between routes → orchestrator → executors

## Prevention Strategies

### 1. T2 Tool Lifecycle & Executor Registration

**Understanding T2 tools:**

```
Step 1: Tool returns proposal (T2)
  └─ { success: true, requiresApproval: true, proposal: {...} }

Step 2: Orchestrator shows proposal to user
  └─ "Execute this action? [Confirm] [Cancel]"

Step 3: User confirms
  └─ Orchestrator calls getProposalExecutor('tool_name')
  └─ Should return executor function

Step 4: Executor runs
  └─ Actually modifies database/storage
  └─ Returns result

Step 5: Proposal marked EXECUTED
  └─ User sees success message

❌ FAILURE: Step 3 executor not found
  └─ Proposal stuck in CONFIRMED state
  └─ Never transitions to EXECUTED
```

**CRITICAL: Executor must be registered BEFORE orchestrator calls it.**

### 2. Executor Registry Pattern (Avoids Circular Dependencies)

**Problem: Circular dependencies**

```
Before fix:
routes/agent.ts → orchestrator.ts → need getProposalExecutor()
                                  └─ Only available in executors/index.ts
orchestrators/index.ts → executors/index.ts (unidirectional is OK)
but executors/index.ts also exports to routes (creates cycle)

Solution: Extract registry to separate module
└─ Both orchestrator and routes import from executor-registry.ts
└─ No circular dependency
```

**Correct structure:**

```typescript
// server/src/agent/proposals/executor-registry.ts

import { logger } from '../../lib/core/logger';

export type ProposalExecutor = (
  tenantId: string,
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

// Central registry
const proposalExecutors = new Map<string, ProposalExecutor>();

export function registerProposalExecutor(toolName: string, executor: ProposalExecutor): void {
  logger.debug({ toolName }, 'Registering executor');
  proposalExecutors.set(toolName, executor);
}

export function getProposalExecutor(toolName: string): ProposalExecutor | undefined {
  return proposalExecutors.get(toolName);
}

// Validation at startup
const REQUIRED_EXECUTOR_TOOLS = [
  'upsert_package',
  'delete_package',
  'delete_package_photo', // ← Example
  'manage_working_hours',
  // ... all T2+ tools
] as const;

export function validateExecutorRegistry(): void {
  const missing = REQUIRED_EXECUTOR_TOOLS.filter((toolName) => !proposalExecutors.has(toolName));

  if (missing.length > 0) {
    throw new Error(
      `Missing executors for tools: ${missing.join(', ')}\n` +
        `Check server/src/agent/executors/index.ts - registerAllExecutors() may not be called.`
    );
  }

  logger.info({ count: REQUIRED_EXECUTOR_TOOLS.length }, 'Executor registry validated');
}
```

### 3. Complete T2 Tool + Executor Implementation

**Tool definition:**

```typescript
// server/src/agent/tools/write-tools.ts

export const deletePackagePhotoTool: AgentTool = {
  trustTier: 'T2', // Soft confirm - user sees proposal
  name: 'delete_package_photo',
  description: 'Delete a photo from a package',
  inputSchema: {
    type: 'object',
    properties: {
      packageId: {
        type: 'string',
        description: 'Package ID',
      },
      filename: {
        type: 'string',
        description: 'Photo filename',
      },
    },
    required: ['packageId', 'filename'],
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, input, prisma } = context;

    try {
      // Validate package ownership
      const pkg = await prisma.package.findFirst({
        where: {
          id: input.packageId as string,
          tenantId,
        },
      });

      if (!pkg) {
        return { success: false, error: 'Package not found' };
      }

      // Return proposal (NOT executing yet)
      return {
        success: true,
        requiresApproval: true, // ← Key field for T2
        proposal: {
          action: 'delete_package_photo',
          packageId: input.packageId,
          filename: input.filename,
          description: `Delete photo from "${pkg.name}"`,
        },
      };
    } catch (error) {
      return { success: false, error: 'Failed to prepare deletion' };
    }
  },
};
```

**Executor function:**

```typescript
// server/src/agent/executors/package-executors.ts

import { registerProposalExecutor } from '../proposals/executor-registry';
import { logger } from '../../lib/core/logger';

export async function deletePackagePhotoExecutor(
  tenantId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { packageId, filename } = payload;

  if (typeof packageId !== 'string' || typeof filename !== 'string') {
    throw new Error('Invalid payload: packageId and filename required');
  }

  try {
    // Defense-in-depth: Verify ownership again
    const pkg = await prisma.package.findFirst({
      where: {
        id: packageId,
        tenantId,
      },
    });

    if (!pkg) {
      throw new Error('Package not found or access denied');
    }

    // Delete from storage
    await uploadService.deleteFile(tenantId, `packages/${packageId}/${filename}`);

    // Update package photos array
    const photos = (pkg.photos || []).filter((p: string) => p !== filename);
    await prisma.package.update({
      where: { id: packageId },
      data: { photos },
    });

    // Invalidate cache
    const cacheKey = `tenant:${tenantId}:packages:${packageId}`;
    await cacheService.invalidate(cacheKey);

    logger.info({ tenantId, packageId, filename }, 'Photo deleted successfully');

    return {
      success: true,
      message: `Photo deleted: ${filename}`,
    };
  } catch (error) {
    logger.error({ error: sanitizeError(error), tenantId, packageId }, 'Photo deletion failed');
    throw error;
  }
}

// Register with executor registry
registerProposalExecutor('delete_package_photo', deletePackagePhotoExecutor);
```

**Registration in index:**

```typescript
// server/src/agent/executors/index.ts

import { deletePackagePhotoExecutor } from './package-executors';
import { registerProposalExecutor } from '../proposals/executor-registry';

/**
 * Register all proposal executors
 * Called during server initialization
 * Must be called BEFORE agent orchestrator uses getProposalExecutor()
 */
export function registerAllExecutors(): void {
  // Package executors
  registerProposalExecutor('upsert_package', upsertPackageExecutor);
  registerProposalExecutor('delete_package', deletePackageExecutor);
  registerProposalExecutor('delete_package_photo', deletePackagePhotoExecutor); // ← Example

  // Booking executors
  registerProposalExecutor('create_booking', createBookingExecutor);
  // ... other executors ...

  logger.info('All proposal executors registered');
}
```

**Validate at startup:**

```typescript
// server/src/index.ts (main server entry)

import { validateExecutorRegistry } from './agent/proposals/executor-registry';
import { registerAllExecutors } from './agent/executors';

async function startServer() {
  // Register executors FIRST
  registerAllExecutors();

  // Validate registry SECOND (before accepting requests)
  validateExecutorRegistry();

  // Now start accepting requests
  // Orchestrator can safely call getProposalExecutor()
}
```

### 4. Code Review Checklist

**When adding write tools (T2+):**

```markdown
Write Tool Implementation Checklist

Tool Definition
├─ [ ] Tool defined in write-tools.ts
├─ [ ] Tool has trustTier: 'T2' (or higher)
├─ [ ] Tool returns proposal object:
│ ├─ action: matching tool name
│ ├─ description: user-facing text
│ └─ ...all needed for executor
├─ [ ] inputSchema complete
└─ [ ] tenantId validated in tool

Executor Implementation
├─ [ ] Executor function created
├─ [ ] Executor file: server/src/agent/executors/\*-executors.ts
├─ [ ] Executor validates tenantId (defense-in-depth)
├─ [ ] Executor performs actual work
├─ [ ] Error handling with try/catch
├─ [ ] Cache invalidation after changes
├─ [ ] Returns success/failure result
└─ [ ] Uses sanitizeError() in logger

Registration
├─ [ ] registerProposalExecutor() called at end of executor file
├─ [ ] Executor registered in registerAllExecutors()
├─ [ ] Tool name added to REQUIRED_EXECUTOR_TOOLS
├─ [ ] Server startup will validate (validateExecutorRegistry())
└─ [ ] Build/test passes with validation

Testing
├─ [ ] Integration test: tool → proposal created
├─ [ ] Integration test: executor registered
├─ [ ] E2E test: full flow (user confirms → executes)
├─ [ ] Test orphaned proposals don't occur
└─ [ ] Validate executor-registry catches missing executor
```

### 5. Detecting Missing Executors

**Validation script:**

```typescript
// scripts/validate-executor-registry.ts

import { glob } from 'glob';
import { readFileSync } from 'fs';

async function validateRegistry() {
  // Find all tools
  const toolFiles = await glob('server/src/agent/tools/*.ts');
  const tools = new Set<string>();

  for (const file of toolFiles) {
    const content = readFileSync(file, 'utf-8');
    const matches = content.match(/name: ['"]([^'"]+)['"]/g);
    matches?.forEach((m) => {
      const toolName = m.match(/['"]([^'"]+)['"]/)?.[1];
      if (toolName) tools.add(toolName);
    });
  }

  // Find all registered executors
  const executorRegistry = readFileSync('server/src/agent/proposals/executor-registry.ts', 'utf-8');
  const registered = new Set<string>();

  executorRegistry.match(/registerProposalExecutor\(['"]([^'"]+)['"]/g)?.forEach((m) => {
    const name = m.match(/['"]([^'"]+)['"]/)?.[1];
    if (name) registered.add(name);
  });

  // Find REQUIRED_EXECUTOR_TOOLS
  const requiredMatch = executorRegistry.match(/REQUIRED_EXECUTOR_TOOLS = \[([\s\S]*?)\]/);
  const required = new Set<string>();

  if (requiredMatch) {
    const requiredList = requiredMatch[1];
    requiredList.match(/['"]([^'"]+)['"]/g)?.forEach((m) => {
      const name = m.match(/['"]([^'"]+)['"]/)?.[1];
      if (name) required.add(name);
    });
  }

  // Check for missing executors
  const missing: string[] = [];

  for (const toolName of required) {
    if (!registered.has(toolName)) {
      missing.push(toolName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing executors:');
    missing.forEach((t) => console.error(`  - ${t}`));
    process.exit(1);
  }

  console.log(`✓ All ${required.size} required executors registered`);
}

validateRegistry();
```

**Add to build script:**

```json
{
  "scripts": {
    "validate:executors": "npx ts-node scripts/validate-executor-registry.ts",
    "build": "npm run validate:executors && npm run typecheck && npm run build:server"
  }
}
```

### 6. Catching Orphaned Proposals

**Database query to find stuck proposals:**

```sql
-- Find proposals stuck in CONFIRMED state
SELECT
  id,
  tenantId,
  action,
  state,
  createdAt,
  updatedAt,
  CURRENT_TIMESTAMP - updatedAt as time_since_update
FROM "Proposal"
WHERE state = 'CONFIRMED'
  AND CURRENT_TIMESTAMP - updatedAt > interval '5 minutes'
ORDER BY updatedAt DESC;

-- If this returns results, executors aren't being called!
```

**Quick check after deployment:**

```bash
# After deploying new write tool, check for orphaned proposals
npm run db:query -- "SELECT COUNT(*) FROM \"Proposal\" WHERE state = 'CONFIRMED' AND \"createdAt\" > NOW() - interval '1 hour'"

# Should be 0 (or very low)
```

### 7. Testing T2 Tool Flow

**Integration test:**

```typescript
test('delete_package_photo: tool creates proposal, executor executes', async () => {
  const { tenantId, packageId, filename } = await setupTestData();

  // Step 1: Tool returns proposal
  const toolResult = await deletePackagePhotoTool.execute({
    tenantId,
    input: { packageId, filename },
    prisma,
  });

  expect(toolResult.success).toBe(true);
  expect(toolResult.requiresApproval).toBe(true);
  expect(toolResult.proposal?.action).toBe('delete_package_photo');

  // Step 2: Executor is registered
  const executor = getProposalExecutor('delete_package_photo');
  expect(executor).toBeDefined();

  // Step 3: Executor runs successfully
  const execResult = await executor!(tenantId, toolResult.proposal!);
  expect(execResult.success).toBe(true);

  // Step 4: Verify side effects (photo actually deleted)
  const updatedPkg = await prisma.package.findUnique({
    where: { id: packageId },
  });
  expect(updatedPkg?.photos).not.toContain(filename);
});
```

## Related Files

**Source implementations:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent/tools/write-tools.ts` - Write tool examples
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/executors/` - Executor implementations
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/proposals/executor-registry.ts` - Registry (central hub)

**Circular dependency solution:**

- `docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md` - Detailed explanation

**Related prevention:**

- `docs/solutions/patterns/AGENT_TOOLS_ACTION_PARITY_PREVENTION.md` - Action parity for T1+T2 tools

## Key Takeaways

1. **T2 = Soft Confirm** - Tool shows proposal, user confirms, executor runs
2. **Executor registry is separate module** - Avoids circular dependencies
3. **Validation at startup** - Server fails if executor missing (catch early)
4. **Defense-in-depth** - Executor validates tenantId again (not just tool)
5. **Cache invalidation after writes** - Keep data consistent

## FAQ

**Q: What if I forgot to register an executor?**
A: Server startup fails with clear error message. Fix it before deploying.

**Q: Can I skip executor for T2 tools?**
A: No. T2 tools REQUIRE executors. Use T1 (read-only) if you can't implement executor.

**Q: What's the difference between tool and executor?**
A: Tool = UI interface (proposal creation). Executor = backend work (actual changes).

**Q: Why two separate steps (tool + executor)?**
A: So user can review and confirm before irreversible changes happen.

**Q: What if executor fails after user confirms?**
A: Error bubbles up to user. Proposal marked FAILED. User can retry or undo.

**Q: Can tool and executor be the same function?**
A: No. Tool must return quickly (for proposal). Executor does heavy lifting (can be slow).
