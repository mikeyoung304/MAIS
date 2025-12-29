---
module: MAIS
date: 2025-12-28
problem_type: architecture_decision
component: server/agent/tools
symptoms:
  - Agent tools use direct Prisma queries instead of service layer
  - Apparent code duplication between tools and API routes
  - Concern about business logic consistency
root_cause: Misidentification of the proposal/executor pattern as "missing service layer"
resolution_type: won't_fix
severity: N/A (not a problem)
related_files:
  - server/src/agent/tools/read-tools.ts
  - server/src/agent/tools/write-tools.ts
  - server/src/agent/proposals/proposal.service.ts
  - server/src/agent/proposals/executors/index.ts
tags: [agent-architecture, service-layer, proposal-pattern, won't-fix]
---

# Agent Tools Architecture Decision: Keep Current Design

## Summary

**Decision:** Do NOT refactor agent tools to use the domain service layer.

**Reason:** The proposal/executor pattern already IS the agent service layer. Adding domain services would fragment a well-designed architecture.

## Original Concern (TODO-450)

> Agent tools in `server/src/agent/tools/` directly query the database via Prisma instead of using the existing service layer. This bypasses validation, caching, and business logic.

## Why This Is NOT a Problem

### 1. The Proposal/Executor Pattern IS the Agent Service Layer

The current architecture follows a command pattern with deferred execution:

```
User Message → LLM → Tool Call → createProposal() → Preview
                                      ↓
User Confirms → Executor → Prisma → Result
```

This is not "tools calling Prisma directly" - it's a sophisticated two-phase execution model designed specifically for AI agent interactions.

### 2. Read Tools SHOULD Use Direct Queries

Direct Prisma queries in read tools are **correct** because:

- **Reads are idempotent** - No approval needed, no state change
- **LLM transparency** - Tools need raw data for reasoning; hiding behind services obscures what data is returned
- **Simplicity enables predictability** - The LLM can reason about `get_bookings` because it's transparent

### 3. Write Tools Already Have the Right Abstraction

Every write tool follows this pattern:

```typescript
async execute(context, params): Promise<AgentToolResult> {
  // 1. Tool-level validation (ownership, format)
  const existing = await prisma.package.findFirst({ where: { id, tenantId } });

  // 2. Business logic (trust tier determination)
  const trustTier = isSignificantPriceChange(...) ? 'T3' : 'T2';

  // 3. Create proposal (deferred execution)
  return createProposal(context, 'upsert_package', operation, trustTier, payload, preview);
}
```

The executor then re-validates and executes:

```typescript
registerProposalExecutor('upsert_package', async (tenantId, payload) => {
  // Re-validate ownership (security checkpoint)
  const existing = await prisma.package.findFirst({ where: { id, tenantId } });

  // Execute mutation
  return await prisma.package.update({...});
});
```

This two-phase pattern provides:

- Immediate feedback to the LLM (tool validation)
- Security enforcement at execution time (executor validation)
- Trust-tier-gated execution (T1/T2/T3)

### 4. What Services Would NOT Add

| Concern          | Current Solution                       | Service Layer Would...         |
| ---------------- | -------------------------------------- | ------------------------------ |
| Tenant isolation | tenantId from JWT, scoped queries      | Not improve (same pattern)     |
| Validation       | Tool validates → Executor re-validates | Fragment across 3 places       |
| Caching          | Read tools don't need caching          | Add complexity without benefit |
| Audit logging    | Executor can emit events               | Same capability                |

## Multi-Agent Review Consensus

Four reviewers analyzed this refactor:

| Reviewer            | Verdict     | Key Insight                                    |
| ------------------- | ----------- | ---------------------------------------------- |
| DHH (Architecture)  | REJECT      | "Tools ARE the service layer"                  |
| Kieran (TypeScript) | CONDITIONAL | Type improvements useful, services aren't      |
| Code Simplicity     | REJECT      | "Best refactoring is no refactoring"           |
| **Agent-Native**    | **REJECT**  | "Proposal/executor IS the agent service layer" |

## Tactical Improvements (Accepted)

Instead of the full refactor, adopt these improvements:

### 1. Consistent `verifyOwnership` Helper Usage

The helper exists but is underused in executors:

```typescript
// Use consistently in all executors
const package = await verifyOwnership(prisma, 'package', packageId, tenantId);
```

### 2. Zod Schemas for Payload Contracts

Add type safety between tools and executors:

```typescript
const UpsertPackagePayload = z.object({
  packageId: z.string().optional(),
  slug: z.string().optional(),
  title: z.string(),
  basePrice: z.number(),
  // ...
});
```

### 3. Document the Pattern

Add to CLAUDE.md that the proposal/executor pattern is the agent service layer.

## Prevention Strategy

When evaluating future agent architecture changes, ask:

1. **Does this improve LLM transparency?** Tools should be predictable and inspectable.
2. **Does this fragment the proposal/executor flow?** Keep the command pattern intact.
3. **Is this solving a real problem?** Identify actual bugs or duplication before refactoring.

## Files Involved

- `server/src/agent/tools/types.ts` - ToolContext definition
- `server/src/agent/tools/read-tools.ts` - 16 read tools (keep as-is)
- `server/src/agent/tools/write-tools.ts` - 18 write tools (keep as-is)
- `server/src/agent/proposals/proposal.service.ts` - Proposal state machine
- `server/src/agent/proposals/executors/index.ts` - Mutation execution

## References

- Original plan: `plans/agent-tools-service-layer-refactor.md` (archived)
- Service layer patterns: `docs/solutions/best-practices/service-layer-patterns-MAIS-20251204.md`
- Agent-native architecture skill: `~/.claude/plugins/.../agent-native-architecture`

---

_Decision documented: 2025-12-28_
_TODO-450: Closed as "Won't Fix"_
