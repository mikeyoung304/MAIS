# Agent Tools Prevention Strategies - Complete Index

**Master index for preventing the 4 P1 issues fixed in Booking Links Phase 0.**

All 4 critical issues have now been fixed and documented with prevention strategies to avoid repetition.

---

## The 4 P1 Issues (Now Fixed)

| ID  | Issue                                       | Status   | Fix                                                |
| --- | ------------------------------------------- | -------- | -------------------------------------------------- |
| 617 | Missing tenantId in delete/update mutations | RESOLVED | Use updateMany/deleteMany with tenantId            |
| 618 | Tools not in REQUIRED_EXECUTOR_TOOLS        | RESOLVED | Added 3 tools to startup validation                |
| 619 | Duplicate getTenantInfo function            | RESOLVED | Extracted to server/src/agent/utils/tenant-info.ts |
| 620 | TOCTOU race condition on delete             | RESOLVED | Wrapped in transaction with FOR UPDATE lock        |

**All tests passing. Ready for production.**

---

## Documentation Structure

### 1. **BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md** (Comprehensive)

Complete reference guide with:

- Problem statement for each issue
- Root cause analysis
- Prevention checklists
- Code examples and patterns
- Test patterns
- Related ADRs

**When to read:** Implementing a new agent tool from scratch

**Time investment:** 30 minutes (detailed, thorough)

**Key sections:**

- Prevention Strategy 1: Multi-Tenant Isolation Checklist
- Prevention Strategy 2: Executor Registry Validation
- Prevention Strategy 3: Code Duplication (DRY)
- Prevention Strategy 4: Race Condition Detection
- Prevention Strategy 5: Code Review Patterns
- Prevention Strategy 6: Test Patterns

### 2. **AGENT_TOOLS_PEER_REVIEW_CHECKLIST.md** (Quick Reference)

Peer reviewer's handbook with:

- Quick decision tree
- Issue patterns and fixes
- Verification commands
- Common issues found
- Blocking vs non-blocking issues
- Approval template

**When to use:** Reviewing a PR with new agent tools

**Time investment:** 10 minutes (during code review)

**Key sections:**

- Multi-Tenant Isolation (SECURITY)
- Executor Registry (ARCHITECTURE)
- Code Duplication (MAINTAINABILITY)
- Race Conditions (DATA INTEGRITY)
- Quick Decision Tree
- Running Full Verification

### 3. **AGENT_TOOL_TEST_PATTERNS.md** (Testing Reference)

Complete testing guide with:

- Test hierarchy (unit/integration/E2E)
- Level 2 integration tests (most important)
- Test structure templates
- Key testing patterns
- Common test failures
- Test helpers

**When to use:** Writing tests for new agent tools

**Time investment:** 20 minutes (reference during testing)

**Key sections:**

- Level 1: Unit Tests (Tool Invocation)
- Level 2: Integration Tests (Executor Execution)
- Level 3: E2E Tests (Full Workflow)
- Critical Testing Patterns
- Test Coverage Goals

---

## How to Use These Documents

### Scenario 1: "I'm implementing a new agent tool"

1. **Before coding:** Read **BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md** (30 min)
   - Understand the 4 prevention strategies
   - Copy the pre-implementation checklist
   - Know what code patterns to follow

2. **While coding:** Keep **AGENT_TOOLS_PEER_REVIEW_CHECKLIST.md** open
   - Use quick decision tree to verify your code
   - Run verification commands as you go
   - Self-review before submitting

3. **While testing:** Reference **AGENT_TOOL_TEST_PATTERNS.md**
   - Copy test structure templates
   - Write integration tests (most critical)
   - Verify cross-tenant isolation

### Scenario 2: "I'm reviewing a PR with new agent tools"

1. **Quick triage:** Start with **AGENT_TOOLS_PEER_REVIEW_CHECKLIST.md**
   - Read "Quick Decision Tree" (2 min)
   - Scan for blocking issues
   - Use grep commands for verification

2. **If blocking issues found:** Reference **BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md**
   - Understand root cause
   - Suggest specific code pattern
   - Point to code examples

3. **If test coverage needed:** Use **AGENT_TOOL_TEST_PATTERNS.md**
   - Show test template
   - Explain what test should verify
   - Link to reference tests

4. **Approve with template:**

   ```markdown
   # Approved: [Tool Name]

   Verified using AGENT_TOOLS_PEER_REVIEW_CHECKLIST.md:

   - [x] Multi-tenant isolation
   - [x] Executor registry
   - [x] No code duplication
   - [x] Race condition protection
   - [x] Cross-tenant tests

   Ready to merge.
   ```

### Scenario 3: "A similar bug was found and I need to fix it"

1. **Identify category:**
   - Missing tenantId → Issue 617 pattern
   - Tool not validated → Issue 618 pattern
   - Code duplication → Issue 619 pattern
   - Race condition → Issue 620 pattern

2. **Find pattern in docs:**
   - Search for issue number in documents
   - Read "Proposed Solutions" section
   - Copy code template

3. **Implement fix:**
   - Follow recommended pattern
   - Apply code example
   - Add tests using patterns

---

## Key Files (Implementation References)

### Multi-Tenant Isolation (Issue 617)

**Fixed in:** `server/src/agent/executors/booking-link-executors.ts`

```typescript
// Lines 127-141: Update with updateMany + tenantId
const result = await prisma.$transaction(async (tx) => {
  const result = await tx.service.updateMany({
    where: { id: serviceId, tenantId },
    data: updateData,
  });
  if (result.count === 0) throw new ResourceNotFoundError(...);
  return tx.service.findFirstOrThrow({ where: { id: serviceId, tenantId } });
});

// Lines 178-208: Delete with transaction + FOR UPDATE lock
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;
  // ... check + delete ...
});
```

### Executor Registry (Issue 618)

**Fixed in:** `server/src/agent/proposals/executor-registry.ts`

```typescript
// Lines 84-87: Tools added to REQUIRED_EXECUTOR_TOOLS
const REQUIRED_EXECUTOR_TOOLS = [
  // ...
  'manage_bookable_service',
  'manage_working_hours',
  'manage_date_overrides',
] as const;
```

### Code Duplication (Issue 619)

**Fixed with:** NEW FILE `server/src/agent/utils/tenant-info.ts`

```typescript
// Single source of truth for getTenantInfo
export async function getTenantInfo(
  prisma: PrismaClient,
  tenantId: string,
  options?: GetTenantInfoOptions
): Promise<TenantInfo | null> {
  // ... implementation ...
}

// Used by: tools and executors
import { getTenantInfo } from '../utils/tenant-info';
```

### Race Condition (Issue 620)

**Fixed in:** `server/src/agent/executors/booking-link-executors.ts:178-208`

```typescript
// Transaction with row lock prevents TOCTOU
await prisma.$transaction(async (tx) => {
  // Step 1: Lock service row
  await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${id} FOR UPDATE`;

  // Step 2: Check (now safe, row is locked)
  const bookings = await tx.booking.count({ where: { serviceId } });
  if (bookings > 0) throw new Error(...);

  // Step 3: Delete (atomic)
  await tx.service.deleteMany({ where: { id, tenantId } });
});
```

---

## Prevention Patterns Summary

### Pattern 1: Tenant-Scoped Mutations

```typescript
// WRONG
await prisma.service.update({ where: { id }, data })

// CORRECT
await prisma.$transaction(async (tx) => {
  const result = await tx.service.updateMany({
    where: { id, tenantId },
    data,
  });
  if (result.count === 0) throw new ResourceNotFoundError(...);
  return tx.service.findFirstOrThrow({ where: { id, tenantId } });
});
```

### Pattern 2: Executor Registry

```typescript
// File 1: executor-registry.ts
const REQUIRED_EXECUTOR_TOOLS = ['tool_name'] as const;

// File 2: booking-link-executors.ts
registerProposalExecutor('tool_name', async (tenantId, payload) => {
  // implementation
});

// File 3: server.ts
validateExecutorRegistry(); // Startup validation
```

### Pattern 3: Shared Utilities

```typescript
// Extract to: server/src/agent/utils/utility-name.ts
export async function sharedUtility(...) { /* shared */ }

// Use in tools: import from utils
// Use in executors: import from utils
// NO DUPLICATION
```

### Pattern 4: Transaction + Lock

```typescript
await prisma.$transaction(async (tx) => {
  // Lock
  await tx.$executeRaw`SELECT id FROM "Table" WHERE id = ${id} FOR UPDATE`;

  // Check (atomic now)
  const constraint = await tx.relation.count({ where: { ... } });
  if (constraint > 0) throw new Error(...);

  // Mutate (atomic)
  await tx.table.deleteMany({ where: { id, tenantId } });
});
```

---

## Quick Decision Tree

When implementing new agent tools:

```
1. New write tool?
   YES → Must add to REQUIRED_EXECUTOR_TOOLS
   NO → Can skip executor

2. Tool creates/updates/deletes?
   YES → Must include tenantId in all mutations
   NO → Still verify findFirst includes tenantId

3. Check-then-act pattern?
   YES → Must wrap in transaction with lock
   NO → Simple operation, no lock needed

4. Code duplicated elsewhere?
   YES → Extract to server/src/agent/utils/
   NO → Continue

5. All mutations tested with cross-tenant case?
   YES → Ready for review
   NO → Add integration test

6. Executor registered at startup?
   YES → All good
   NO → Add to registerBookingLinkExecutors()
```

---

## Checklist: Before Submitting PR

Use this before opening a PR with new agent tools:

```markdown
## Security

- [ ] All mutations use updateMany/deleteMany
- [ ] All where clauses include tenantId
- [ ] Cross-tenant test verifies isolation

## Architecture

- [ ] Tool in REQUIRED_EXECUTOR_TOOLS
- [ ] Executor registered in registerProposalExecutor
- [ ] validateExecutorRegistry() passes

## Data Integrity

- [ ] No TOCTOU race conditions
- [ ] Check-then-act in transactions with locks
- [ ] Error messages are user-friendly

## Maintainability

- [ ] No duplicated functions (extract to utils)
- [ ] Shared utilities used consistently
- [ ] Code organized in correct directories

## Testing

- [ ] Unit tests for tool invocation
- [ ] Integration tests for executor
- [ ] Cross-tenant isolation test
- [ ] npm test passes
- [ ] npm run typecheck passes
```

---

## Common Questions

### Q: Do I need to add my tool to REQUIRED_EXECUTOR_TOOLS?

**A:** YES, if your tool is T2 or T3 (write operations).

- T1 (read-only) tools: NO, don't need executor
- T2/T3 (write) tools: YES, must add

If you don't, server startup won't validate the executor was registered, and proposals may silently fail to execute.

### Q: Can I use a simple `delete()` instead of `deleteMany()`?

**A:** NO. Always use deleteMany/updateMany because:

1. You can include tenantId in where clause (defense-in-depth)
2. You get back count (can verify operation succeeded)
3. Consistent pattern across codebase

The `delete()` method forces you to use compound unique constraint, which is more brittle.

### Q: How do I test race conditions?

**A:** Hard to test concurrency directly. Instead:

1. Verify code is wrapped in transaction
2. Verify FOR UPDATE lock is present
3. Test the constraint check works
4. Trust PostgreSQL isolation levels

See AGENT_TOOL_TEST_PATTERNS.md for details.

### Q: Where should I put shared utilities?

**A:** `server/src/agent/utils/` directory.

Examples:

- `tenant-info.ts` - Fetch tenant slug, domain, timezone
- `retry.ts` - Exponential backoff for external APIs
- Similar utilities for your feature

### Q: Can I extract this later instead of now?

**A:** NO. Duplication found in code review will block merge.

Extract during implementation, not after. It's faster that way.

---

## References

### Architecture Decision Records (ADRs)

- **ADR-013:** Advisory locks and double-booking prevention
- **ADR-016:** Field naming conventions (title/name, priceCents/basePrice)

### Related Prevention Strategies

- **PREVENTION_STRATEGIES_INDEX.md:** Complete index of all prevention strategies
- **PREVENTION-QUICK-REFERENCE.md:** Quick reference cards
- **STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md:** TOCTOU on JSON fields, DRY tool logic, API consistency (Issues #659-666)
  - Quick reference: STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md
- **AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md:** Tools must return updated state, not just confirmation (prevents agent amnesia)

### Implementation Files

- `server/src/agent/executors/booking-link-executors.ts` - Reference implementation
- `server/src/agent/tools/booking-link-tools.ts` - Reference tool definitions
- `server/src/agent/utils/tenant-info.ts` - Reference utility extraction
- `server/src/agent/proposals/executor-registry.ts` - Startup validation

---

## Document Maintenance

**Last updated:** 2026-01-20
**Status:** Complete and ready for use
**Applies to:** All new agent tool implementations

When implementing new tools, copy the checklists and adapt them to your specific use case. Update this index if you find patterns not covered by these documents.

---

## Quick Links

| Need                  | Document                                        | Section                  |
| --------------------- | ----------------------------------------------- | ------------------------ |
| Complete guide        | BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md  | All sections             |
| Code review checklist | AGENT_TOOLS_PEER_REVIEW_CHECKLIST.md            | Full document            |
| Testing guide         | AGENT_TOOL_TEST_PATTERNS.md                     | All sections             |
| Decision tree         | AGENT_TOOLS_PEER_REVIEW_CHECKLIST.md            | Quick Decision Tree      |
| Code templates        | BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md  | Pattern templates        |
| Test templates        | AGENT_TOOL_TEST_PATTERNS.md                     | Test structure templates |
| Pre-merge checklist   | AGENT_TOOLS_PREVENTION_INDEX.md                 | Checklist section        |
| JSON field TOCTOU     | STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md | Prevention Strategy 1    |
| Tool API consistency  | STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md | Prevention Strategy 3    |
| Active memory pattern | AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md          | Full document            |
