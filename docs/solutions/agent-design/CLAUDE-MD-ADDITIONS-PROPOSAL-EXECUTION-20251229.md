# Recommended CLAUDE.md Additions

**From:** Chatbot Proposal Execution Prevention Strategies (2025-12-29)
**Issues Fixed:** Circular dependencies, T2 execution missing, proposal passthrough, field mapping

---

## Additions to "Common Pitfalls" Section

Add these items to the existing "Common Pitfalls" list in CLAUDE.md:

```markdown
11. **Circular dependencies in agent modules:** Use `npx madge --circular server/src/` before adding imports. Shared state (registries, maps) goes in dedicated modules, not routes.
12. **T2 proposal confirms but never executes:** State transitions MUST have side effects. After CONFIRMED, always call the registered executor.
13. **Proposal not in API response:** When tools return `requiresApproval: true`, verify proposal object propagates to final response.
14. **Field name mismatches in DTOs:** Use canonical names from contracts package. Executor should accept both old and new field names for backward compatibility.
```

---

## Additions to "Prevention Strategies" Section

Add to the bullet list of prevention strategy links:

```markdown
- **[chatbot-proposal-execution](docs/solutions/agent-design/CHATBOT-PROPOSAL-EXECUTION-PREVENTION-STRATEGIES-MAIS-20251229.md)** - Circular dependencies, T2 execution, proposal passthrough, field mapping
```

---

## Additions to "Customer Chatbot" Architecture Section

Update the existing "Customer Chatbot (AI Agent System)" section to add:

```markdown
**Executor Registry:**

The executor registry is extracted to avoid circular dependencies:

- `server/src/agent/proposals/executor-registry.ts` - Centralized registry (NOT in routes)
- `server/src/agent/executors/index.ts` - Registers all executors at startup
- `server/src/agent/orchestrator/orchestrator.ts` - Calls executors after T2 soft-confirm

**State Machine:**
```

Tool → PENDING → (T2: soft-confirm / T3: user-confirm) → CONFIRMED → Executor → EXECUTED
↘ on error → FAILED

```

**Key Rule:** Every state transition to CONFIRMED must trigger executor invocation.
```

---

## ESLint Configuration Addition

Add to `.eslintrc.json` or `.eslintrc.js`:

```json
{
  "rules": {
    "import/no-cycle": ["error", { "maxDepth": 5 }]
  }
}
```

Requires: `npm install -D eslint-plugin-import`

---

## Startup Validation Addition

Add to `server/src/index.ts` or `server/src/di.ts`:

```typescript
import { getRegisteredExecutors } from './agent/proposals/executor-registry';

const REQUIRED_EXECUTORS = ['upsert_package', 'delete_package', 'book_service'];

export function validateExecutorRegistration(): void {
  const registered = getRegisteredExecutors();
  const missing = REQUIRED_EXECUTORS.filter((t) => !registered.includes(t));

  if (missing.length > 0) {
    throw new Error(`Missing proposal executors at startup: ${missing.join(', ')}`);
  }

  logger.info({ executors: registered }, 'All proposal executors registered');
}
```

---

## Test Template Addition

Add to `server/test/templates/proposal-lifecycle.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerProposalExecutor,
  getProposalExecutor,
} from '../../src/agent/proposals/executor-registry';

describe('Proposal Lifecycle Template', () => {
  const tenantId = 'test-tenant';
  const mockExecutor = vi.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    vi.clearAllMocks();
    registerProposalExecutor('test_tool', mockExecutor);
  });

  it('should register and retrieve executor', () => {
    expect(getProposalExecutor('test_tool')).toBe(mockExecutor);
  });

  it('should execute with tenantId isolation', async () => {
    const executor = getProposalExecutor('test_tool')!;
    await executor(tenantId, { field: 'value' });

    expect(mockExecutor).toHaveBeenCalledWith(tenantId, { field: 'value' });
  });

  it('should handle executor errors gracefully', async () => {
    const failingExecutor = vi.fn().mockRejectedValue(new Error('DB error'));
    registerProposalExecutor('failing_tool', failingExecutor);

    const executor = getProposalExecutor('failing_tool')!;
    await expect(executor(tenantId, {})).rejects.toThrow('DB error');
  });
});
```

---

## Quick Reference for CLAUDE.md

Add to "Quick Start Checklist":

```markdown
When working on agent/chatbot features:

6. Check for circular deps: `npx madge --circular server/src/`
7. Verify executor registered for tool
8. Test full proposal lifecycle (create → confirm → execute)
```

---

**Status:** Ready for integration into CLAUDE.md
**Priority:** High (prevents P1 issues)
