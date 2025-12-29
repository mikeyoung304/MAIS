---
problem_id: 'TODO-450'
problem_type: false_positive
component: server/agent/tools
symptoms:
  - Agent tools use direct Prisma queries instead of service layer
  - Apparent code duplication between tools and API routes
  - Concern about business logic consistency between agent and API paths
root_cause: Misidentification of the proposal/executor pattern as "missing service layer"
resolution_type: won't_fix
resolution_status: closed
severity: N/A (not a real problem)
identified_date: 2025-12-28
closed_date: 2025-12-28
review_verdict: REJECTED (3 out of 4 reviewers)
related_files:
  - server/src/agent/tools/read-tools.ts
  - server/src/agent/tools/write-tools.ts
  - server/src/agent/proposals/proposal.service.ts
  - server/src/agent/proposals/executors/index.ts
  - plans/agent-tools-service-layer-refactor.md (archived)
tags:
  - agent-architecture
  - false-positive
  - service-layer
  - proposal-pattern
  - won't-fix
  - over-engineering
---

# TODO-450: False Positive Architecture Analysis

## Executive Summary

**Status:** REJECTED (Won't Fix)

**Decision:** Do NOT refactor agent tools to use the domain service layer.

**Key Insight:** The proposal/executor pattern IS the agent service layer. Adding domain services would fragment a well-designed architecture.

---

## Problem Details

### Problem Statement (Original TODO-450)

Agent tools in `server/src/agent/tools/` directly query the database via Prisma instead of using the existing service layer:

- All 17 read tools directly access Prisma from ToolContext
- All 19 write tools directly query Prisma for validation before creating proposals
- All executors perform database mutations via Prisma instead of calling services
- Advisory lock patterns duplicated in executors instead of reusing BookingService

### Apparent Symptoms

1. **Code Duplication:** Same validation logic in tools and services
2. **Inconsistent Behavior:** API and agent behave differently
3. **Missing Validation:** Agent bypasses service rules
4. **Harder Maintenance:** Changes require updates in multiple places
5. **Testing Gaps:** 85% service coverage vs 0% tool coverage

### Examples of "Duplication"

```typescript
// CatalogService.updatePackage() provides:
// - Slug uniqueness validation
// - Price change audit logging
// - Event emission for downstream systems
// - Cache invalidation

// upsert_package tool does none of this - it just creates a proposal
```

---

## Root Cause Analysis

### The Real Architecture: Proposal/Executor Pattern

The current design is **not broken** - it's a sophisticated two-phase execution model:

```
User Message → LLM → Tool Call → createProposal() → Preview
                                     ↓
                        (user sees what will happen)
                                     ↓
User Confirms → Executor → Prisma → Result
```

This is a **command pattern with deferred execution**, specifically designed for AI agent interactions.

### Why Direct Prisma Calls Are Correct

#### 1. Read Tools SHOULD Use Direct Queries

Direct Prisma queries in read tools are **architecturally correct** because:

- **Reads are idempotent** - No approval needed, no state change
- **LLM transparency** - Tools need raw data for reasoning; hiding behind services obscures what data is returned
- **Simplicity enables predictability** - The LLM can reason about `get_bookings` because it's transparent
- **No caching benefit** - Read-only tools don't benefit from service-layer caching

**Verdict:** Services would ADD COMPLEXITY without solving a real problem.

#### 2. Write Tools Already Have Correct Abstraction

Every write tool follows a two-phase pattern:

```typescript
// Phase 1: Tool validation (immediate LLM feedback)
async execute(context, params): Promise<AgentToolResult> {
  // 1. Tool-level validation (ownership, format)
  const existing = await prisma.package.findFirst({ where: { id, tenantId } });

  // 2. Business logic (trust tier determination)
  const trustTier = isSignificantPriceChange(...) ? 'T3' : 'T2';

  // 3. Create proposal (deferred execution)
  return createProposal(context, 'upsert_package', operation, trustTier, payload, preview);
}

// Phase 2: Executor validation (security checkpoint)
registerProposalExecutor('upsert_package', async (tenantId, payload) => {
  // Re-validate ownership (critical for security)
  const existing = await prisma.package.findFirst({ where: { id, tenantId } });

  // Execute mutation
  return await prisma.package.update({...});
});
```

**This provides:**

- Immediate feedback to LLM (transparency)
- Security enforcement at execution time (can't bypass)
- Trust-tier-gated execution (T1/T2/T3 controls)

**Adding services would:**

- Fragment validation across 3 places (tool → service → executor)
- Hide what the tool actually does from the LLM
- Violate the principle of LLM transparency

---

## Multi-Agent Review Analysis

### Review Panel

| Reviewer         | Role                   | Verdict         | Key Insight                                         |
| ---------------- | ---------------------- | --------------- | --------------------------------------------------- |
| DHH              | Architecture           | **REJECT**      | "Tools ARE the service layer"                       |
| Kieran           | TypeScript             | **CONDITIONAL** | Type improvements useful; services aren't necessary |
| Code Simplicity  | Maintainability        | **REJECT**      | "Best refactoring is no refactoring"                |
| **Agent-Native** | **Agent Architecture** | **REJECT**      | "Proposal/executor IS the agent service layer"      |

### Consensus Findings

**3 out of 4 reviewers rejected the refactor.**

**Agent-Native Architecture reviewer specifically noted:**

> "The proposal/executor pattern is not a limitation - it's the correct abstraction for agent-driven changes. Injecting domain services would violate the separation between LLM-facing logic (tools) and backend business logic (services)."

---

## What Would NOT Improve

### Comparison: Current vs Proposed Service Layer

| Concern              | Current Solution                       | Service Layer Would...             |
| -------------------- | -------------------------------------- | ---------------------------------- |
| **Tenant isolation** | `tenantId` from JWT, scoped queries    | NOT improve (same pattern)         |
| **Validation**       | Tool validates → Executor re-validates | Fragment across 3 places           |
| **Caching**          | Read tools don't need caching          | Add complexity without benefit     |
| **Audit logging**    | Executor can emit events               | NOT improve (same capability)      |
| **Code duplication** | ~2-3 lines of overlap                  | NOT solve (LLM needs transparency) |
| **LLM transparency** | High (direct queries, predictable)     | DECREASE (hidden behind services)  |

### The "Code Duplication" Problem Doesn't Exist

The perceived duplication is actually **legitimate architectural separation**:

```typescript
// API route (thin wrapper)
const packages = await catalogService.getActivePackages(tenantId);

// Agent tool (direct query)
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});
```

These are not the same thing:

- **API route** is a contract boundary (versioned, documented, with response types)
- **Agent tool** is for LLM reasoning (needs transparency, optimization for reasoning)

Adding a service layer would merge these concerns, making both worse.

---

## Why This Is a False Positive

### Root Misidentification

The TODO-450 author (correctly) identified that agent tools don't use `CatalogService`, then (incorrectly) concluded this was an architectural violation.

**The error:** Assuming all code that doesn't use services is therefore problematic.

**The reality:** Agent tools have different constraints than API routes:

1. **API routes** need validation, caching, event emission → use services
2. **Agent tools** need LLM transparency, speed, predictability → direct queries

These are **different requirements for different clients**.

### The "Architecture Violation" Framing Is Wrong

The layered architecture in CLAUDE.md applies to:

```
routes/ → services/ → adapters/ → ports.ts
```

This is for **API clients** (web, mobile).

Agent tools operate at a different layer:

```
LLM Tool Call → read/write tools → proposals → executors
```

The agent layer has its own architecture (command pattern with deferred execution), which is **correctly implemented**.

---

## Prevention Strategy

To avoid similar false positives in the future:

### Questions to Ask Before Refactoring

1. **Does this improve LLM transparency?**
   - Tools should be predictable and inspectable
   - Services would HIDE what the tool does

2. **Does this fragment the proposal/executor flow?**
   - Keep the two-phase command pattern intact
   - Services would violate separation of concerns

3. **Is this solving a REAL problem?**
   - Identify actual bugs or maintenance issues first
   - "Code duplication" that doesn't cause bugs isn't a problem

4. **Would this increase or decrease code complexity?**
   - Adding services = 3 layers of validation (tool → service → executor)
   - Current = 2 layers (tool → executor)

### The Core Issue

**Over-engineering:** The refactor was proposed as a "best practice" without identifying a concrete problem:

- No maintenance issues reported
- No bugs traced to agent-tool code
- No actual code duplication (different constraints)
- No request from team members to change the pattern

This is the classic trap: "The service layer is good, so we should use it everywhere." This ignores the context where services make sense (API clients) vs where they don't (LLM-facing tools).

---

## Tactical Improvements (Accepted)

Instead of the full refactor, adopt these lightweight improvements:

### 1. Consistent `verifyOwnership` Helper Usage

The helper exists but is underused in executors:

```typescript
// Use consistently in all executors
const package = await verifyOwnership(prisma, 'package', packageId, tenantId);
```

**Status:** Already in use, can be standardized

### 2. Zod Schemas for Payload Contracts

Add type safety between tools and executors:

```typescript
const UpsertPackagePayload = z.object({
  packageId: z.string().optional(),
  slug: z.string().optional(),
  title: z.string(),
  basePrice: z.number(),
});
```

**Status:** Can be added without major refactor

### 3. Document the Pattern

Add to CLAUDE.md that the proposal/executor pattern is the agent service layer.

**Status:** Documented in AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md

---

## Decision Summary

### Closed: Won't Fix

**Reason:** Not a real problem.

**Why:** The proposal/executor pattern is the correct architecture for agent-driven changes. Injecting domain services would:

1. Fragment validation across 3 places (tool → service → executor)
2. Hide behavior from LLM (reduce transparency)
3. Add complexity without solving real issues
4. Violate separation between LLM-facing and backend logic

### What Changes Will Happen Instead

- Document the pattern in CLAUDE.md
- Standardize `verifyOwnership` helper usage
- Add Zod schemas for payload contracts
- Continue current architecture (tools → proposals → executors)

---

## Related Files

- **Decision Document:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/agent-design/AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md`
- **Prevention Strategies:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/agent-design/AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md`
- **Original Plan (Archived):** `/Users/mikeyoung/CODING/MAIS/plans/agent-tools-service-layer-refactor.md`
- **TODO Status:** `/Users/mikeyoung/CODING/MAIS/todos/450-pending-p1-agent-tools-bypass-service-layer.md`

---

## References

### Architecture & Patterns

- `docs/solutions/best-practices/service-layer-patterns-MAIS-20251204.md` - Service layer guidelines
- `server/src/agent/tools/types.ts` - ToolContext definition
- `server/src/agent/proposals/proposal.service.ts` - Proposal state machine
- `server/src/agent/proposals/executors/index.ts` - Mutation execution

### Prevention Strategies

- `docs/solutions/PREVENTION-QUICK-REFERENCE.md` - Quick reference cheat sheet
- `docs/solutions/PREVENTION-STRATEGIES-INDEX.md` - Full index of prevention docs

---

_Documentation created: 2025-12-28_

_TODO-450: Closed as "Won't Fix"_

_This is a reference case for false positive architecture concerns._
