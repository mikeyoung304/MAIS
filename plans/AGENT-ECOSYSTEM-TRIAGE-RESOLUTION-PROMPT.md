# Agent Ecosystem: Triage Resolution Prompt

**Copy this entire file and paste it into a new Claude Code session.**

---

## Context

You are resolving code review findings for the MAIS Agent Ecosystem. Three expert reviewers (DHH, Kieran, Simplicity) have triaged 20 todos. Quality is the only concern.

### What Was Done

- ✅ Phase 3-4: Built BaseOrchestrator + specialized subclasses + 54 tests
- ✅ Code review with 8 parallel agents
- ✅ Created 20 todo files (5 P1, 15 P2)
- ✅ Expert triage by DHH, Kieran, Simplicity Reviewer

### Verification Status

- TypeScript compiles cleanly: `npm run typecheck` ✅
- All 281 agent tests pass: `npm test -- test/agent` ✅

---

## Triage Results: What To Do

### 🔴 DO NOW (Priority Order)

| #   | Todo     | Action                                 | Effort | Why                                      |
| --- | -------- | -------------------------------------- | ------ | ---------------------------------------- |
| 1   | **#524** | Wire routes to new orchestrators       | 1 hour | Enables all guardrails                   |
| 2   | **#526** | Delete legacy orchestrators            | 30 min | Removes 2000 lines (blocked by #524)     |
| 3   | **#523** | Fix `as unknown as AgentTool[]`        | 5 min  | Type CUSTOMER_TOOLS properly             |
| 4   | **#529** | Add IP rate limiting                   | 15 min | `express-rate-limit` on public endpoints |
| 5   | **#541** | Add `trustTier` to AgentTool interface | 20 min | Prevent silent T1 defaults               |

### 🟡 DO SOON (After Core Fixes)

| #   | Todo     | Action                                 | Effort |
| --- | -------- | -------------------------------------- | ------ |
| 6   | **#532** | Add Zod validation for OnboardingPhase | 15 min |
| 7   | **#537** | Fix broad T2 rejection patterns        | 30 min |
| 8   | **#539** | Fix shared circuit breaker state       | 15 min |
| 9   | **#530** | Add composite index on AgentSession    | 5 min  |

### 🗑️ DELETE THESE TODOS (Not Worth Fixing)

```bash
# Delete these todo files - reviewers agreed they're non-issues:
rm todos/522-pending-p1-branded-types-unused.md
rm todos/528-pending-p2-pattern-set-inconsistency.md
rm todos/531-pending-p2-dynamic-imports-hot-path.md
rm todos/533-pending-p2-inconsistent-error-normalization.md
rm todos/534-pending-p2-config-explosion.md
rm todos/538-pending-p2-feature-envy-admin-orchestrator.md
```

### ⏸️ DEFER THESE (Wait for Evidence)

| Todo | Reason                                                |
| ---- | ----------------------------------------------------- |
| #525 | Rate limiter persistence - add Redis when scaling     |
| #527 | Injection detection - authenticated users are trusted |
| #535 | Customer action parity - product feature request      |
| #536 | Circuit breaker bypass - product decision             |
| #540 | Anthropic DI - only if tests actually need it         |

---

## Implementation Guide

### Step 1: Wire New Orchestrators (#524)

**Files to update:**

1. `server/src/routes/agent.routes.ts` (line ~43)
   - Replace: `new AgentOrchestrator(prisma)`
   - With: `new AdminOrchestrator(prisma)` or `new OnboardingOrchestrator(prisma)`

2. `server/src/routes/public-customer-chat.routes.ts` (line ~29)
   - Replace: `new CustomerOrchestrator(prisma)`
   - With: `new CustomerChatOrchestrator(prisma)`

**Imports to add:**

```typescript
import {
  AdminOrchestrator,
  OnboardingOrchestrator,
  CustomerChatOrchestrator,
} from '../agent/orchestrator';
```

### Step 2: Delete Legacy Orchestrators (#526)

After #524 is verified working:

```bash
# Delete legacy files (after confirming routes work)
rm server/src/agent/orchestrator/orchestrator.ts
rm server/src/agent/customer/customer-orchestrator.ts

# Update exports
# Edit server/src/agent/orchestrator/index.ts - remove legacy exports
```

### Step 3: Fix Type Assertion (#523)

In `server/src/agent/customer/customer-tools.ts`:

```typescript
// Change CUSTOMER_TOOLS type definition to:
export const CUSTOMER_TOOLS: AgentTool[] = [
  // ... tools
];
```

Then in `customer-chat-orchestrator.ts:90`:

```typescript
// Remove the double assertion
protected getTools(): AgentTool[] {
  return CUSTOMER_TOOLS; // Now properly typed
}
```

### Step 4: Add IP Rate Limiting (#529)

```bash
npm install --workspace=server express-rate-limit
```

In `server/src/routes/public-customer-chat.routes.ts`:

```typescript
import rateLimit from 'express-rate-limit';

const publicChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window per IP
  message: { error: 'Too many requests, please try again later' },
});

// Apply to public chat routes
router.use('/chat', publicChatLimiter);
```

### Step 5: Add trustTier to AgentTool (#541)

In `server/src/agent/tools/types.ts`:

```typescript
export interface AgentTool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (context: ToolContext, input: unknown) => Promise<ToolResult>;
  trustTier: 'T1' | 'T2' | 'T3'; // ADD THIS - required
}
```

Then update all tool definitions to include explicit `trustTier`.

---

## Key Files Reference

```
# Routes to update
server/src/routes/agent.routes.ts
server/src/routes/public-customer-chat.routes.ts

# Legacy files to delete (after migration)
server/src/agent/orchestrator/orchestrator.ts      # 1340 lines
server/src/agent/customer/customer-orchestrator.ts # 698 lines

# Files to fix type issues
server/src/agent/customer/customer-tools.ts
server/src/agent/orchestrator/customer-chat-orchestrator.ts
server/src/agent/tools/types.ts

# Todos location
todos/522-541-*.md
```

---

## Verification Steps

After each fix:

```bash
# 1. TypeScript check
npm run typecheck

# 2. Run agent tests
npm test -- test/agent

# 3. Run full test suite
npm test
```

---

## Your Task

```bash
# 1. Delete non-issue todos first (cleans up scope)
rm todos/522-pending-p1-branded-types-unused.md
rm todos/528-pending-p2-pattern-set-inconsistency.md
rm todos/531-pending-p2-dynamic-imports-hot-path.md
rm todos/533-pending-p2-inconsistent-error-normalization.md
rm todos/534-pending-p2-config-explosion.md
rm todos/538-pending-p2-feature-envy-admin-orchestrator.md

# 2. Fix priority items in order
# #524 → #526 → #523 → #529 → #541

# 3. Verify after each fix
npm run typecheck && npm test -- test/agent

# 4. Then fix "do soon" items
# #532 → #537 → #539 → #530

# 5. Mark deferred todos
# Rename files: pending → deferred

# 6. Continue to Phase 5 (metrics)
# See: plans/AGENT-ECOSYSTEM-PHASE-5-WORK-PROMPT.md
```

---

## Success Criteria

- [ ] Routes use new orchestrators (BaseOrchestrator subclasses)
- [ ] Legacy orchestrators deleted (~2000 lines removed)
- [ ] No `as unknown as` double assertions
- [ ] IP rate limiting on public endpoints
- [ ] `trustTier` required on AgentTool interface
- [ ] TypeScript compiles cleanly
- [ ] All tests pass

---

**Start with: Delete the 6 non-issue todo files, then fix #524 (route migration)**
