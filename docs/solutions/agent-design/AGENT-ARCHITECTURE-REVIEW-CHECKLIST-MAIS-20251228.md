---
module: MAIS
date: 2025-12-28
problem_type: quick_reference
component: agent/architecture
tags: [agent-architecture, code-review, decision-framework, quick-reference]
---

# Agent Architecture Review Checklist

Quick reference for reviewing agent architecture changes and preventing unnecessary refactors.

## Pre-Review: Author Checklist

Before proposing any agent architecture change, verify:

- [ ] **Is this fixing a real bug?**
  - Not just: "This looks inconsistent"
  - Real bug: "Tool A and Tool B return different data for same query"

- [ ] **Have I identified the specific problem?**
  - Not: "We need a service layer"
  - Specific: "Conflict detection logic is duplicated in 3 places"

- [ ] **Does this improve LLM transparency?**
  - Would the LLM better understand what the tool returns?
  - Or would it add layers that obscure behavior?

- [ ] **Does this preserve proposal/executor pattern?**
  - Tool phase still returns proposal without executing?
  - Executor can still re-validate before executing?

- [ ] **Is this legitimate code reuse or artifact removal?**
  - Same concern across contexts? (bugfix)
  - Different concerns? (keep duplication)

- [ ] **Have I checked the decision documents?**
  - Read: AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md
  - Read: AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md

## Review Checklist: For Code Reviewers

When reviewing agent tool PRs, check:

### Safety and Pattern Integrity

- [ ] **Proposal/executor pattern preserved**
  - Tools return proposals (not execute)
  - Executors can re-validate
  - Two-phase flow intact

- [ ] **Tenant isolation enforced**
  - All queries include tenantId filter
  - No data leakage between tenants

- [ ] **LLM transparency maintained**
  - Tool behavior is inspectable
  - Data returned is predictable
  - Hidden logic is minimized

### Code Quality

- [ ] **No new service layers added**
  - Unless solves ONE of these:
    - Complex business logic reused across 3+ contexts
    - Cross-cutting concerns (audit, rate-limit, encryption)
    - NOT: Wrapping Prisma for consistency

- [ ] **DRY violations are actual duplications**
  - Same logic in different tools → Extract helper
  - Similar logic for different concerns → Keep separate
  - Not cargo-culted patterns

- [ ] **Naming is clear and consistent**
  - Read tools: `get_*`
  - Write tools: `add_*`, `update_*`, `remove_*`
  - Check tools: `check_*` or `is_*`
  - Refresh: `refresh_*`

### Performance and Scalability

- [ ] **All read tools have pagination limits**
  - `take: Math.min(limit || 50, 100)` or similar
  - No unbounded queries

- [ ] **Independent queries run in parallel**
  - `Promise.all()` for parallel operations
  - Not: `await query1; await query2;`

- [ ] **Indexes support new queries**
  - New WHERE clauses have composite indexes
  - Index order: tenantId first, then other filters

### Error Handling

- [ ] **Uses `handleToolError` utility**
  - Not custom error messages per tool
  - Consistent error codes

- [ ] **Appropriate error codes used**
  - VALIDATION_ERROR, NOT_FOUND_ERROR, EXECUTION_ERROR, DATABASE_ERROR

### Type Safety

- [ ] **Enums validated with type guards**
  - Not: `status as BookingStatus`
  - Yes: `validateBookingStatus(status)`

- [ ] **Input validated with Zod**
  - Tool input parameters type-checked
  - Not: accepting `any`

- [ ] **No unsafe `as any` casts**
  - Except for dynamic model access (explicitly commented)

## Red Flags to Reject

### REJECT: Adding Services for "Consistency"

```
Proposed: "Add BookingService for all booking logic"
Concern: "This would hide LLM transparency"
Decision: REJECT
```

This pattern confuses consistency of interface with consistency of behavior.
Tools should be transparent even if implementations differ.

### REJECT: Wrapping Prisma in Facades

```
Proposed: "Create PackageRepository interface"
Concern: "Adds indirection without benefit. LLM can't inspect interface."
Decision: REJECT unless solving real reuse problem
```

Direct Prisma queries are correct for agent tools.

### REJECT: Applying REST Patterns

```
Proposed: "Adopt REST-style middleware for validation"
Concern: "REST patterns optimize for different goals (data consistency)
         Agent patterns optimize for LLM transparency"
Decision: REJECT
```

Agent and REST are different optimization targets.

### REJECT: Consolidating Different Tools

```
Proposed: "Merge get_bookings and check_availability into get_booking_info"
Concern: "Tools have different purposes; consolidation reduces transparency"
Decision: REJECT unless truly redundant
```

Similar tools can coexist if serving different purposes.

### REJECT: Without Problem Statement

```
Proposed: "Refactor agent tools to follow best practices"
Concern: "What specific problem are we solving?"
Decision: REJECT without clear problem
```

Refactoring without identified problem is cargo-culting.

## Green Flags to Accept

### ACCEPT: Fixing Bugs

```
Proposed: "Fix: get_bookings and get_active_bookings return different statuses"
Concern: "None - this is fixing inconsistent behavior"
Decision: ACCEPT
```

Bug fixes are always welcome.

### ACCEPT: Extracting Helpers

```
Proposed: "Extract buildDateRange() helper used in 5 tools"
Concern: "None - helper reduces duplication without adding layers"
Decision: ACCEPT
```

Helper functions are correct extraction point.

### ACCEPT: Adding Bounds to Queries

```
Proposed: "Add take: 50 limit to get_packages"
Concern: "None - improves LLM transparency and performance"
Decision: ACCEPT
```

Pagination helps both LLM and performance.

### ACCEPT: Improving Type Safety

```
Proposed: "Add Zod validation for tool inputs"
Concern: "None - improves safety and clarity"
Decision: ACCEPT
```

Type safety improvements are always good.

### ACCEPT: Performance Optimizations

```
Proposed: "Use Promise.all() in check_availability"
Concern: "None - preserves pattern, improves speed"
Decision: ACCEPT
```

Performance improvements that don't change semantics are fine.

## Decision Tree (One-Pager)

```
AGENT ARCHITECTURE CHANGE PROPOSED?

1. Is there a specific bug?
   ├─ YES → Fix it
   └─ NO → Go to 2

2. Is legitimate code duplication?
   ├─ YES (same concern, different places) → Extract helper
   └─ NO → Go to 3

3. Proposing new layer/service?
   ├─ YES → Would this improve LLM transparency?
   │  ├─ NO → REJECT (adds indirection without benefit)
   │  └─ YES → Would this break proposal/executor?
   │    ├─ YES → REJECT (breaks safety pattern)
   │    └─ NO → ACCEPT (rare - usually still reject)
   └─ NO → Go to 4

4. Rearranging existing code?
   ├─ YES → Would this simplify?
   │  ├─ NO → REJECT ("best refactoring is no refactoring")
   │  └─ YES → ACCEPT (proceed carefully)
   └─ NO → Adding new tool? → Check tool template

UNSURE? → Defer to architecture decision docs
```

## Questions to Ask Author

### For Any Proposal

1. **What is the specific problem?**
   - Not: "This needs refactoring"
   - Needed: "Tool A behavior inconsistent with Tool B"

2. **Why can't we solve this without refactoring?**
   - Extract helper instead?
   - Fix bug in tool instead?
   - Document difference instead?

3. **How does this affect LLM transparency?**
   - Will LLM better understand the tool's output?
   - Or will behavior become less predictable?

4. **How does this affect safety?**
   - Does proposal/executor pattern still work?
   - Can executor still re-validate?

### For Service/Layer Proposals

5. **What would this service do?**
   - Specific method names and behaviors
   - How different from proposal/executor?

6. **Is this logic reused in 3+ places?**
   - Same concern (business rule) across contexts
   - If not, it's not reused enough

7. **Why is this better than a helper function?**
   - Services add complexity
   - Helpers are simpler
   - How much complexity is justified?

8. **How does this serve the LLM?**
   - LLM can't inspect behind a service
   - Transparency is more important than abstraction

## Templates

### Good Issue Description

```markdown
## Problem

Tool A: `get_bookings` filters by `status IN (CONFIRMED, PAID)`
Tool B: `get_customer_bookings` filters by `status NOT IN (CANCELED)`

Result: Same customer, two different booking lists

## Solution

Consolidate to consistent status filtering:

- Both use: `status NOT IN (CANCELED, REFUNDED)`

## Testing

- [ ] Test that both tools return same bookings
- [ ] Verify LLM can reason about status filtering
```

### Rejected Proposal Description

```markdown
## Proposed: Add BookingService

## Rejection Reason

The proposal/executor pattern already serves as the agent service layer.
Adding a service layer would:

- Reduce LLM transparency (hidden logic)
- Add unnecessary indirection
- Not improve testability (tools are testable as-is)

## Better Approach

If consolidating booking logic:

- Use helper functions for shared validation
- Keep tool queries transparent (direct Prisma)
- Keep executor logic separate (re-validation)
```

## Before and After Examples

### Example 1: Extract Helper (Accept)

```typescript
// BEFORE: Duplicated date range logic in 5 tools
if (input.fromDate) {
  where.createdAt = { gte: new Date(input.fromDate) };
}
if (input.toDate) {
  where.createdAt = { ...where.createdAt, lte: new Date(input.toDate) };
}

// AFTER: Use helper
const dateRange = buildDateRange(input.fromDate, input.toDate);
```

**Decision:** ACCEPT - Helper reduces duplication without adding layers

---

### Example 2: Don't Wrap in Service (Reject)

```typescript
// PROPOSED: Add service
class BookingService {
  async getBookings(tenantId: string) {
    return prisma.booking.findMany({ where: { tenantId } });
  }
}

// REJECTED: Service adds indirection without benefit
// Tool is already transparent. Service hides nothing.

// BETTER: Keep direct Prisma in tool
const bookings = await prisma.booking.findMany({
  where: { tenantId },
  take: 50,
});
```

**Decision:** REJECT - Service adds indirection without improving transparency

---

### Example 3: Fix Bug (Accept)

```typescript
// PROBLEM: Inconsistent business logic
// Tool A: Check both booking + blackout date
// Tool B: Check only booking

// FIX: Consolidate to consistent check
// Both tools: Check booking AND blackout

// Or: Extract to helper if reused
const isAvailable = !booking && !blackout;
```

**Decision:** ACCEPT - Fixing real inconsistency

---

## Key Takeaways

1. **Proposal/executor pattern IS the agent service layer** - don't add another
2. **Agent tools ≠ REST APIs** - different optimization criteria
3. **LLM transparency > abstraction** - keep tools simple and inspectable
4. **Extract helpers, not services** - consolidate shared logic without adding layers
5. **Fix bugs, don't refactor** - identify real problems before proposing changes
6. **Code duplication can be legitimate** - different contexts = different concerns

---

**Last Updated:** 2025-12-28
**Quick Reference For:** Reviewers and proposal authors
**Full Reference:** AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md
