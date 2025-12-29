---
module: MAIS
date: 2025-12-28
problem_type: prevention_strategy
component: agent/architecture
issues_prevented: [TODO-450]
severity: P0
tags: [agent-architecture, service-layer, refactoring-prevention, decision-framework]
---

# Agent Architecture Evaluation Prevention Strategies

Comprehensive guidance to prevent unnecessary refactors and over-engineering in agent tool architecture based on the multi-agent review of TODO-450.

## Executive Summary

**The Problem:** A well-intentioned TODO proposed adding domain services to agent tools, claiming "missing service layer."

**The Review Outcome:** Four expert reviewers unanimously rejected the proposal because the **proposal/executor pattern already IS the agent service layer.**

**This Document Prevents:** Future proposals to add layers, abstract patterns, or refactor working architecture without understanding the design intent.

---

## Section 1: Decision Framework for Agent Architecture Changes

### When to Propose Agent Architecture Changes

Ask these questions IN ORDER before proposing any refactor:

#### Question 1: Is There a Real Problem?

**Ask:** "What is broken or missing in the current design?"

**Red Flags that indicate NO real problem:**

- "This is inconsistent with REST API patterns" → Agent patterns ≠ REST patterns
- "I don't see a service layer" → Proposal/executor pattern IS the service layer
- "This code looks duplicated" → Code duplication ≠ architectural problem if serving different purposes
- "We should follow established patterns" → Agent patterns are established (T1/T2/T3 trust tiers)

**Green Flags that indicate a REAL problem:**

- "Bookings in tool A and tool B produce different results" → Genuine inconsistency
- "The executor doesn't have information the tool validation had" → Security gap
- "We keep fixing the same bug in 5 different tools" → DRY violation with real impact
- "Performance is degrading with proposal count" → Quantifiable issue

**Example Check:**

```
TODO: "Add services to agent tools for consistency"
  ❌ NO real problem identified

TODO: "Bookings returned by get_bookings don't match executor output format"
  ✅ REAL problem - different serialization logic
```

#### Question 2: Does the Proposal Improve LLM Transparency?

**Ask:** "Will this change make the tool's behavior more or less predictable for the LLM?"

The fundamental difference between agent tools and HTTP services:

- **HTTP services:** Can be opaque; they abstract away implementation details
- **Agent tools:** Must be transparent; the LLM reasons about what they return

**Red Flags (opacity increases):**

- Hiding queries behind service methods → LLM can't reason about what data is returned
- Adding computed fields → LLM can't distinguish between raw DB data and business logic
- Wrapping repositories in facades → Tool behavior becomes less inspectable

**Green Flags (transparency maintained or improved):**

- Adding explicit type signatures → LLM sees exact fields returned
- Clearer naming of what data is included → LLM understands scope
- Better documentation of limits/pagination → LLM knows constraints

**Example Check:**

```typescript
// Red flag: Hides what's being queried
const bookings = await bookingService.getActiveBookings(tenantId);
// LLM wonders: "Are canceled bookings included? What's 'active'?"

// Green flag: Transparent about what's returned
const bookings = await prisma.booking.findMany({
  where: { tenantId, status: { not: 'CANCELED' } },
  take: 50,
});
// LLM sees: exactly 50 non-canceled bookings
```

#### Question 3: Does This Preserve the Proposal/Executor Pattern?

**Ask:** "Does this refactor maintain the two-phase execution model?"

The proposal/executor pattern is NOT just implementation detail—it's fundamental to agent safety:

```
Phase 1 (Tool): Quick response to LLM for decision-making
   ↓
Phase 2 (Executor): Slower, more-careful execution with re-validation
```

Breaking this pattern = removing a safety mechanism.

**Red Flags (pattern fragmented):**

- Moving validation to a shared service → Breaks executor re-validation layer
- Tools calling services that apply mutations → Defeats deferred execution
- Shared state between proposal and execution → Timing bugs emerge

**Green Flags (pattern preserved):**

- Tool phase still returns proposal without executing → Deferred execution intact
- Executor still has access to original proposal state → Can re-validate
- Tools and executors can call same validation helpers → Shared helpers ≠ shared state

**Example Check:**

```typescript
// Red flag: Service applies change in tool phase
async execute() {
  const updated = await priceService.updatePrice(id, newPrice);  // ← Executed here!
  return createProposal(...);
}

// Green flag: Helper validates, tool creates proposal, executor executes
async execute() {
  await verifyOwnership(prisma, 'package', id, tenantId);  // ← Validation only
  return createProposal(..., { id, newPrice });  // ← Deferred
}
```

---

## Section 2: Red Flags for Over-Engineering

### Pattern 1: Cargo-Cult Architecture

**What it looks like:**

> "Other projects use a service layer, so we should too."

**Why it's wrong in agent context:**

- Domain services are optimized for HTTP/REST request-response cycles
- Agent tools operate in LLM conversation context (different semantics)
- What works for HTTP doesn't automatically work for agents

**How to identify:**

- Proposal references "standard patterns" but doesn't explain why they apply to agents
- Compares agent tools to REST API routes (different concerns!)
- Suggests adopting patterns from microservices/REST projects

**Counter-argument template:**

> "Agent tools need different optimization criteria than REST APIs. REST prioritizes data consistency and reusability across endpoints. Agent tools prioritize LLM transparency and safety via proposal/executor pattern. Applying HTTP patterns would optimize for the wrong goals."

### Pattern 2: Misidentifying Code Duplication as Architectural Problem

**What it looks like:**

> "Tools and API routes both fetch packages. We should extract a common service."

**Why it's wrong:**

- Code used in different contexts serves different purposes
  - API route: Serialize for HTTP, apply role-based filtering, cache aggressively
  - Agent tool: Return transparent data for LLM reasoning, paginate for token budget
- These are not the same "fetch packages"

**Legitimate vs. Illegitimate Duplication:**

```typescript
// ✅ LEGITIMATE duplication (different concerns, different context)
// API route (server/src/routes/packages.routes.ts)
const packages = await prisma.package.findMany({
  where: { tenantId },
});
// Returns to HTTP client - can apply role-based filtering, caching

// Agent tool (server/src/agent/tools/read-tools.ts)
const packages = await prisma.package.findMany({
  where: { tenantId },
  take: 50, // Bounded for LLM token budget
});
// Returns to LLM - must be transparent, simple, predictable

// ❌ ILLEGITIMATE duplication (same concern, different implementations)
// Tool 1: Get active packages
status: 'ACTIVE';

// Tool 2: Get available packages (means same thing, different filter)
status: 'AVAILABLE'; // Not defined! Falls back to both active and inactive

// ^ This IS a real bug needing fixing
```

**How to identify legitimate duplication:**

- Is the result used in different ways? (LLM vs. HTTP client) → Legitimate
- Does the data need different processing? (Pagination for LLM vs. full response) → Legitimate
- Would sharing logic complicate both use cases? → Legitimate (keep duplication)
- Does the duplicated code have different bugs? (inconsistent filters) → Illegitimate (consolidate)

### Pattern 3: Confusing "Consistency" with "Consolidation"

**What it looks like:**

> "All data access should go through services for consistency."

**Why it's wrong:**

- Consistency of _implementation_ ≠ Consistency of _behavior_
- Direct Prisma in tools CAN be consistent (same data returned) without using services
- Services add indirection; indirection adds complexity; complexity ≠ consistency

**When "consistency" IS a valid concern:**

```typescript
// BAD: Inconsistent behavior
tool A: Includes canceled bookings in "total"
tool B: Excludes canceled bookings in "total"
// ^ This is real inconsistency (different semantics)

// GOOD: Different approaches to same data
tool A: Uses Prisma query
tool B: Uses service method
// ^ Not inconsistency if both return same data with same semantics
```

**Red flag phrases:**

- "All data access should use the same pattern" → Probably cargo-cult
- "Services make code consistent" → Confusing consistency with abstraction
- "Best practices say..." → On agent tools? Probably doesn't apply

### Pattern 4: "Perceived Missing Layer" Syndrome

**What it looks like:**

```
"I see: Tool → Prisma
I expect: Tool → Service → Prisma
Therefore: Service layer is missing!"
```

**Why it's wrong:**

- You're comparing to REST architecture, not agent architecture
- The missing layer is actually: Tool → Proposal → Executor → Prisma
- The deferred execution layer IS a service layer (command pattern)

**Diagnostic test:**

Ask: "What would the service layer do?"

- If answer is "hide Prisma implementation" → Not needed (transparency is goal)
- If answer is "add caching" → Not needed (tools shouldn't cache)
- If answer is "add validation" → Already split between tool + executor
- If answer is "enforce business rules" → Already in executor phase

If all answers are "already done," the layer isn't missing, it's just shaped differently.

---

## Section 3: Signs the Current Pattern Is Working

### Indicator 1: Tool Outputs Are Predictable to the LLM

If the LLM can reason accurately about what `get_bookings` returns, the architecture is working.

**Tests:**

- Agent uses correct tools to answer questions
- Agent predictions about data match actual results
- Agent doesn't ask for clarification unnecessarily

**What breaks this:**

- Adding services that change output shape silently
- Hiding business logic in service layer (LLM can't reason about it)
- Applying different filters in different tools for "consistency"

### Indicator 2: Two-Phase Execution Provides Safety

The executor can re-validate because the proposal contains everything needed.

**Tests:**

- Executor can detect unauthorized mutations
- Executor can apply trust-tier-based gates
- Executor can reject bad proposals even if tool validation passed

**What breaks this:**

- Moving validation to tools permanently (skips executor check)
- Services that apply state changes in tool phase (defeats proposal deferment)
- Losing proposal context when executing (can't re-validate)

### Indicator 3: Extending Is Additive, Not Multiplicative

New tools are added without forcing changes to existing tools.

**Tests:**

- New booking tool doesn't require updating package tool
- New write tool doesn't require refactoring read tools
- Extension happens by adding files, not modifying existing ones

**What breaks this:**

- "We need to update all services to add tenant filtering" → Service layer creating coupling
- "Every tool needs to use this new utility" → Accidental architecture growing
- "Can't add new tool without changing core pattern" → Pattern not robust

### Indicator 4: DRY at the Right Level

Code is reused where it should be, duplicated where it shouldn't be.

**Tests:**

- Date range filtering is shared (buildDateRange helper)
- Error handling is centralized (handleToolError utility)
- Tenant scoping is consistent (same WHERE clause pattern)
- Tools are different (not copy-paste identical)

**What breaks this:**

- Identical logic across tools → Needs extraction (but NOT a service)
- Business logic in different tools → Real DRY violation
- Divergent error handling → Needs standardization
- Copy-paste tools → Duplication with intent difference

---

## Section 4: When Services WOULD Be Appropriate

### Scenario 1: Complex Business Logic Needed in Multiple Contexts

**Example that WOULD need a service:**

```
HTTP API needs: "Create booking with conflict detection"
Agent tool needs: "Create booking with conflict detection"
Admin UI needs: "Create booking with conflict detection"
```

These three need identical business logic (what it means to detect conflicts).

**Solution:** Extract to service

```typescript
class BookingService {
  async detectConflict(date, tenantId): Promise<boolean> {
    return (await this.checkExisting(date, tenantId)) ||
           (await this.checkBlackout(date, tenantId));
  }
}

// HTTP route uses it
router.post('/bookings', async (req) => {
  if (await bookingService.detectConflict(date, tenantId)) {
    return { status: 409, error: 'Date booked' };
  }
});

// Agent tool uses it
async execute() {
  const hasConflict = await bookingService.detectConflict(date, tenantId);
  return createProposal(...);
}
```

**Key difference:** Business rule is identical across contexts. Service provides single source of truth.

### Scenario 2: Complex Transformation Logic Reused

**Example that WOULD need a service:**

```
Multiple tools need to calculate "revenue by status by week"
```

This is complex aggregation that multiple features depend on.

**Solution:** Extract to service

```typescript
class RevenueService {
  async getByStatusByWeek(tenantId, year): Promise<RevenueMatrix> {
    // Complex grouping/aggregation logic
  }
}

// Dashboard tool
const revenue = await revenueService.getByStatusByWeek(tenantId, 2025);

// Reporting API
const revenue = await revenueService.getByStatusByWeek(tenantId, 2025);
```

### Scenario 3: Cross-Cutting Concern (Audit, Rate-Limiting, Encryption)

**Example that WOULD need a service:**

```
Every write operation must be audited
Every read operation must be rate-limited
All secrets must be encrypted
```

These cut across multiple features and need centralization.

**Solution:** Middleware, decorators, or wrapper services

```typescript
async executeWithAudit(action, tenantId, payload) {
  const result = await execute(action, tenantId, payload);
  await auditLog.write(tenantId, action, payload, result);
  return result;
}
```

### What NOT to Extract to Services

❌ **Single-purpose queries** (get_packages)

- Service would just wrap Prisma call
- Adds indirection without benefit
- Reduces LLM transparency

❌ **Deferred execution logic** (create proposal)

- Proposal/executor pattern IS the service
- Wrapping it in another service creates double abstraction

❌ **Tool-specific validation** (checking ownership)

- Validation appropriate at tool level (fast feedback to LLM)
- Re-validated at executor level (security)
- Service layer would confuse responsibility

❌ **Presentation formatting** (date formatting, price formatting)

- Different contexts need different formats
  - Agent tool: ISO-8601, cents
  - API response: user locale, dollars
  - CSV export: ISO-8601, cents with commas
- Shared service would force compromises

---

## Section 5: Decision Framework (Flowchart)

### Should We Refactor Agent Tools?

```
START: "I want to add [FEATURE/CHANGE] to agent tools"
  │
  ├─ Is this a bug fix? (Tool produces wrong data/behavior)
  │  │
  │  ├─ YES → Fix the bug (don't refactor)
  │  │
  │  └─ NO → Continue
  │
  ├─ Is this code duplication? (Same logic in 2+ places)
  │  │
  │  ├─ NO → Continue
  │  │
  │  └─ YES → Is it the same concern?
  │    │
  │    ├─ NO (LLM vs. HTTP) → Legitimate duplication, don't refactor
  │    │
  │    └─ YES → Can you extract WITHOUT violating transparency?
  │      │
  │      ├─ NO → Live with duplication
  │      │
  │      └─ YES → Extract helper (not service)
  │          Continue to validation
  │
  ├─ Are you trying to add a layer? (Service, facade, adapter)
  │  │
  │  ├─ YES → STOP - Does this improve transparency?
  │  │  │
  │  │  ├─ NO → Reject proposal
  │  │  │
  │  │  └─ YES → Does this preserve proposal/executor?
  │  │    │
  │  │    ├─ NO → Reject proposal
  │  │    │
  │  │    └─ YES → Proceed cautiously (rare)
  │  │
  │  └─ NO → Continue
  │
  ├─ Are you rearranging existing code? (Refactoring, reorganizing)
  │  │
  │  ├─ YES → Is the new structure simpler?
  │  │  │
  │  │  ├─ NO → Reject ("best refactoring is no refactoring")
  │  │  │
  │  │  └─ YES → Proceed with care
  │  │
  │  └─ NO → Continue
  │
  └─ You're probably adding a new tool. Proceed with caution.
     Use read-tools.ts and write-tools.ts as template.
```

### Specific Questions by Change Type

**If proposing: "Add a service layer"**

- What would the service do that proposal/executor doesn't?
- Would it make tools more or less transparent?
- Would it break re-validation in executor?
- → Usually: Reject

**If proposing: "Extract shared logic"**

- Is it the same concern (business rule) or different contexts?
- Does extraction reduce duplication without adding indirection?
- Can it be a helper function instead of service?
- → Usually: Extract helper, not service

**If proposing: "Consolidate duplicate tools"**

- Are the tools actually identical or just similar?
- Do they return different data or process differently?
- Could consolidation break tool transparency?
- → Usually: Accept if genuinely duplicate, reject if just similar

**If proposing: "Apply REST patterns to agent tools"**

- Why would an agent pattern benefit from REST thinking?
- Does REST prioritization apply to LLM transparency?
- Are you optimizing for the right concerns?
- → Usually: Reject

---

## Section 6: Code Review Checklist

### When Reviewing Agent Architecture Proposals

#### Checklist for PR/Issue Authors

Before proposing a change, verify:

- [ ] I've identified a specific problem (not just "this looks wrong")
- [ ] This problem affects real behavior (not just code style)
- [ ] The proposal solves this problem without breaking safety
- [ ] The proposal preserves LLM transparency
- [ ] The proposal preserves proposal/executor pattern
- [ ] I've considered if this is legitimate duplication
- [ ] I haven't confused "consistency" with "consolidation"
- [ ] I've reviewed the agent architecture decision docs

#### Checklist for Reviewers

When reviewing agent tool changes:

- [ ] Does this improve LLM transparency? (Can LLM better reason about tool?)
- [ ] Does this preserve proposal/executor pattern? (Can executor still re-validate?)
- [ ] Does this fix a real bug? (Or just rearranging code?)
- [ ] Is this legitimate code reuse? (Same concern across contexts?)
- [ ] Does this increase or decrease coupling?
- [ ] Would REST developers understand why agent pattern differs?

---

## Section 7: Common Objections and Responses

### Objection 1: "But We Have Duplicate Code"

**Objection:** "The package query appears in both tools and routes. That's DRY violation."

**Response:**

```
Different contexts = different concerns:

API Route returns:
- Full package data
- Serialized to JSON
- Filtered by user role
- Cached for 10 minutes

Agent Tool returns:
- Subset of fields (LLM-relevant)
- Paginated (50 item limit)
- Raw Prisma data
- Fresh data (no caching)

These aren't the same "fetch packages." Consolidating them would force
compromises (e.g., add role filtering to agent, lose pagination in API).

Code duplication here is GOOD - it means each context is optimized for
its own needs.
```

### Objection 2: "Services Make Code Testable"

**Objection:** "If we don't have services, how do we unit test business logic?"

**Response:**

```
Current testability is excellent:

✅ Tools are testable (mock Prisma context)
✅ Executors are testable (mock Prisma context)
✅ Proposal validation is testable (check state machine)
✅ Helpers are testable (unit tests for buildDateRange, formatPrice, etc.)

Services would NOT improve testability - they'd just add another layer
to test. We'd test:
1. Tool calls service
2. Service calls Prisma
3. Executor calls service

Instead of just:
1. Tool calls Prisma
2. Executor calls Prisma

More layers = more tests, not better tests.
```

### Objection 3: "Microservices Use Services Everywhere"

**Objection:** "Every microservice project I've worked on uses service layers."

**Response:**

```
Microservices optimize for:
- Polyglot architectures (Java service, Node service, Go service)
- Team ownership (team owns package service, separate team owns booking)
- API contract enforcement (service defines what data is available)
- Business logic encapsulation (hide implementation details)

Agent tools optimize for:
- LLM reasoning (transparency about what data is returned)
- Safety gates (proposal/executor pattern controls execution)
- Simplicity (LLM can predict behavior)
- Speed (direct Prisma queries are fastest feedback)

These are DIFFERENT optimization criteria. Adopting microservice patterns
would optimize for the WRONG goals.

It's like asking: "Why doesn't your car have a transmission like a truck?"
Because they optimize for different things.
```

### Objection 4: "We Should Prevent Future Mistakes"

**Objection:** "What if someone adds a tool that bypasses validations?"

**Response:**

```
Prevention doesn't come from services - it comes from:

1. Code review (we catch this in PR review)
2. Tests (tools + executors tested separately)
3. Documentation (what we're writing now)
4. Type safety (Zod schemas, TypeScript)

Services DON'T prevent mistakes:
- Service code can have bugs just like tool code
- Service layer adds complexity (MORE bugs, not fewer)
- Reviewers might trust service layer (false security)

BETTER prevention:
- Checklist in PR template (mention proposal/executor pattern)
- Tests that verify executor re-validates
- Clear docs (this document)
- Type-safe payload contracts
```

---

## Section 8: Implementation Guidelines

### How to Document Architecture Decisions

When documenting agent architecture patterns:

1. **State the pattern clearly**

   ```
   The proposal/executor pattern is the agent service layer.
   It provides deferred execution for safety.
   ```

2. **Explain why it's different from REST**

   ```
   Unlike REST services (which hide implementation),
   agent tools must be transparent (for LLM reasoning).
   ```

3. **Show the two-phase flow**

   ```
   Phase 1 (Tool): Returns proposal to LLM
   Phase 2 (Executor): Re-validates and executes
   ```

4. **List what's NOT needed**

   ```
   - Services (pattern already serves that role)
   - Caching (tools return fresh data)
   - Middleware (validation happens in two phases)
   ```

5. **Provide examples**
   ```
   This is correct:    Tool → Proposal → Executor → Prisma
   This is wrong:      Tool → Service → Prisma
   This is overkill:   Tool → Service → Repository → Prisma
   ```

### How to Add New Tools

When adding tools, follow this template:

```typescript
// server/src/agent/tools/read-tools.ts OR write-tools.ts

// 1. Define what the tool does (comment)
// 2. Query data directly (via Prisma)
// 3. For writes: Create proposal (deferred execution)
// 4. Return tool result

// Example:
export const getTenantAnalyticsTool = {
  name: 'get_tenant_analytics',
  description: 'Fetch analytics for business dashboard',
  inputSchema: {
    /* ... */
  },
  async execute(input, { tenantId, prisma }) {
    try {
      // Direct Prisma query (OK for read tools)
      const data = await prisma.booking.aggregate({
        where: { tenantId },
        // ...
      });

      return { success: true, data };
    } catch (error) {
      return handleToolError(error, 'get_tenant_analytics', tenantId);
    }
  },
};
```

Note: No service layer. Direct Prisma is correct.

---

## Section 9: Quick Reference

### Red Flag Phrases and Responses

| Phrase                           | What It Usually Means                | Appropriate Response                           |
| -------------------------------- | ------------------------------------ | ---------------------------------------------- |
| "Missing service layer"          | Comparing to REST architecture       | Agent patterns ≠ REST patterns                 |
| "This code is duplicated"        | Different contexts, same logic       | Legitimate duplication if different concerns   |
| "All data access should..."      | Trying to enforce consistency        | Consistency ≠ consolidation                    |
| "We need to refactor for..."     | Vague architectural goal             | What's the specific problem?                   |
| "Best practices say..."          | Following microservice patterns      | Not applicable to agent tools                  |
| "This will be more maintainable" | Avoiding specific maintenance burden | What burden? How much will this actually help? |
| "Services are testable"          | Confusing layers with testing        | Tools + executors are already testable         |

### Decision Decision Tree (TL;DR)

```
Proposing agent change?

1. Is there a bug? → Fix it
2. Is code duplicated?
   - Same concern? → Extract helper
   - Different concerns? → Keep duplication
3. Adding a layer? → Reject (ask about transparency)
4. Rearranging code? → Only if simpler (rarely)
5. Adding new tool? → Use existing patterns

Still unsure? → Read the agent architecture decision
```

---

## References

### Related Documents

- **AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md** - Why proposal/executor IS the service layer
- **AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md** - Preventing 7 critical tool issues (unbounded queries, type safety, etc.)
- **CLAUDE.md** - Agent architecture section (agent-native patterns)

### Related Issues

- TODO-450 (closed): "Add service layer to agent tools" → Won't fix
- Issues 451-457: Specific tool improvements (unbounded queries, duplicate tools, etc.)

### Key Reviewers

- **Architecture Strategist (DHH):** "Tools ARE the service layer"
- **Agent-Native Design:** "Proposal/executor IS the agent service layer"
- **Code Simplicity:** "Best refactoring is no refactoring"

---

## Appendix: Multi-Agent Review Summary

**Date:** 2025-12-28
**Proposal:** Add domain service layer to agent tools
**Reviewers:** 4 expert agents

### Review Results

| Reviewer                | Verdict     | Key Quote                                                         |
| ----------------------- | ----------- | ----------------------------------------------------------------- |
| Architecture Strategist | REJECT      | "Tools are already service-layered via proposal/executor pattern" |
| TypeScript Specialist   | CONDITIONAL | "Type improvements useful, services aren't necessary"             |
| Code Simplicity         | REJECT      | "The best refactoring is no refactoring"                          |
| Agent-Native Design     | REJECT      | "Proposal/executor pattern IS the service layer for agents"       |

### Consensus

All four reviewers agreed: Don't refactor. Proposal/executor pattern is already well-designed for agent interactions.

---

**Document Status:** Ready for reference
**Last Updated:** 2025-12-28
**Next Review:** When new agent architecture change is proposed
