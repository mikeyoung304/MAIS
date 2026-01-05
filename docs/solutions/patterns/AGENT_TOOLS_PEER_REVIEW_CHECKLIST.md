# Agent Tools Code Review Checklist

**Quick reference for reviewers of new agent write tools.**

Use this before approving PRs that add new tools to the agent system.

---

## Pre-Review Setup

```bash
# Run automated reviewers first
npm run workflow -- review --focus "agent-tools"

# Check for circular dependencies
npx madge --circular server/src/

# Run tests
npm test -- agent
```

---

## Multi-Tenant Isolation (SECURITY)

Critical: Must pass all checks or REJECT PR

### Mutation Operations Check

For every `prisma.X.delete()`, `update()`, `deleteMany()`, `updateMany()`:

```typescript
// BAD - Missing tenantId
await prisma.service.delete({ where: { id } })

// GOOD - Includes tenantId
await prisma.service.deleteMany({ where: { id, tenantId } })
```

### Checklist

```
MUTATIONS
---------
[ ] All delete/update operations include tenantId in where clause
[ ] Using deleteMany/updateMany (not singular delete/update)
[ ] Count check after mutation (verify operation succeeded)
[ ] No assumption that prior check is sufficient

QUERIES
-------
[ ] All findFirst/findMany include tenantId in where
[ ] Using select() to limit exposed fields (not returning full record)
[ ] No global queries (all filtered by tenantId)

TRANSACTIONS
-----------
[ ] Check-then-act patterns are in same transaction
[ ] Mutations happen after checks (temporal order matters)
[ ] No operations outside transaction that could race
```

### Test Verification

```bash
# Search code for potential issues
grep -r "\.delete(" server/src/agent/executors/
grep -r "\.update(" server/src/agent/executors/

# Each should have tenantId in where clause
```

**If any fail: Request changes before approval**

---

## Executor Registry (ARCHITECTURE)

Critical: Server won't start without this

### Checklist

```
TOOL DEFINITION
---------------
[ ] Tool name is in REQUIRED_EXECUTOR_TOOLS array
[ ] Listed with comment grouping (e.g., "// Booking management")
[ ] Matches exact name in registerProposalExecutor() call

REGISTRATION
------------
[ ] registerProposalExecutor('tool_name', ...) is called
[ ] Called in appropriate module (e.g., registerBookingLinkExecutors)
[ ] Function is exported and called at startup

STARTUP VALIDATION
------------------
[ ] validateExecutorRegistry() is called during server init
[ ] Test exists that calls validateExecutorRegistry()
[ ] Server would fail to start if executor missing (not graceful)
```

### Verification Commands

```bash
# Find tool definition
grep -n "const.*REQUIRED_EXECUTOR_TOOLS" server/src/agent/proposals/executor-registry.ts
# Tool should be in this list

# Find executor registration
grep -rn "registerProposalExecutor('tool_name'" server/src/
# Should find exactly one registration

# Verify startup validation
grep -rn "validateExecutorRegistry()" server/src/
# Should be called in initialization
```

**If any missing: Request changes before approval**

---

## Code Duplication (MAINTAINABILITY)

Medium priority: Request changes if >10 lines duplicate

### Look For

```typescript
// PATTERN 1: Duplicate function (getTenantInfo, getTenant, etc.)
// In tools: async function getTenantInfo(...) { ... }
// In executors: async function getTenantInfo(...) { ... }
// ACTION: Extract to server/src/agent/utils/

// PATTERN 2: Duplicate proposal creation
// In tool1: proposalService.createProposal({...})
// In tool2: proposalService.createProposal({...})
// ACTION: Extract to createProposal() helper

// PATTERN 3: Duplicate error handling
// ACTION: Look for handleToolError() usage instead
```

### Checklist

```
DUPLICATION SEARCH
------------------
[ ] grep for function names: getTenant, getTenantInfo, etc.
[ ] Check multiple files have similar queries
[ ] Look for >5 line blocks identical in multiple places

EXTRACTION
----------
[ ] Duplicated functions extracted to server/src/agent/utils/
[ ] All consumers updated to import from shared location
[ ] Original duplicates deleted (not just commented)

SHARED UTILITIES
----------------
[ ] Utility exported from single location
[ ] Used by all consumers
[ ] Tested in isolation
```

### Impact Assessment

| Lines Duplicate | Action |
|-----------------|--------|
| <5 | Comment-fix (acceptable, minor impact) |
| 5-10 | Request extraction |
| >10 | REJECT - must extract |

**For SQL queries:** Always extract if same query runs multiple times per operation.

---

## Race Conditions (DATA INTEGRITY)

Critical: Must fix before approval

### Pattern Detection

Look for check-then-act without atomicity:

```typescript
// BAD - Race condition window
const existing = await prisma.booking.count({ where: { serviceId } });
if (existing > 0) throw new Error(...);
// RACE WINDOW - Another process could create booking here
await prisma.service.delete({ where: { id: serviceId } });

// GOOD - Atomic with transaction + lock
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${id} FOR UPDATE`;
  const existing = await tx.booking.count({ where: { serviceId } });
  if (existing > 0) throw new Error(...);
  await tx.service.delete({ where: { id: serviceId } });
});
```

### Checklist

```
TRANSACTION PATTERNS
--------------------
[ ] All delete operations with dependent checks in transaction
[ ] All update operations with version/state checks in transaction
[ ] Row lock (FOR UPDATE) used for check-then-act
[ ] Advisory locks used for cross-table coordination (if applicable)

SEQUENCE VERIFICATION
---------------------
[ ] Await statements in correct order
[ ] No operations outside transaction that could race
[ ] Error messages explain why operation failed (e.g., "pending bookings")

TESTING
-------
[ ] Integration test exists (even if can't test race directly)
[ ] Comment explains lock strategy
[ ] Test would fail if lock removed
```

### Check Points

```bash
# Find transactions
grep -rn "\$transaction" server/src/agent/executors/

# Verify FOR UPDATE lock present
grep -A 5 "\$transaction" server/src/agent/executors/ | grep -i "for update"

# Each transaction should have lock for check-then-act patterns
```

**If check-then-act without lock: Request changes before approval**

---

## Error Handling (USER EXPERIENCE)

Medium priority: Nice to have, but important for UX

### Checklist

```
ERROR TYPES
-----------
[ ] Domain-specific errors thrown (not generic Error)
[ ] Error types: ValidationError, ResourceNotFoundError, etc.
[ ] Error messages are user-friendly (no stack traces)

TENANT SAFETY
-------------
[ ] Errors don't leak cross-tenant data
[ ] "Service not found" doesn't indicate "belongs to another tenant"
[ ] No database details in error messages

LOGGING
-------
[ ] Errors logged at appropriate level (info/warn/error)
[ ] Sensitive data sanitized in logs (no API keys, full payloads)
[ ] Error context includes tenantId (for debugging)
```

### Example

```typescript
// BAD - Leaks information
if (!service) {
  logger.error(`Service ${serviceId} belongs to tenant ${otherTenantId}`);
  throw new Error('Service is owned by another tenant');
}

// GOOD - Generic to user, detailed in logs
if (!service) {
  logger.warn({ tenantId, serviceId }, 'Service not found or access denied');
  throw new ResourceNotFoundError('Service', serviceId);
}
```

---

## Trust Tier Verification (ARCHITECTURE)

Check that tool trust tier matches implementation:

```typescript
// T1: Read-only (no database writes)
trustTier: 'T1'
// Should ONLY: SELECT queries
// Should NOT: INSERT, UPDATE, DELETE

// T2: Soft-confirm (creates proposal, user approves)
trustTier: 'T2'
// Should: Go through proposal system
// Should: Validate tenantId before creating proposal

// T3: User-confirm (displays proposal to user for explicit approval)
trustTier: 'T3'
// Like T2 but with additional user confirmation step
```

### Checklist

```
T1 TOOLS (READ-ONLY)
--------------------
[ ] No prisma.X.create/update/delete calls
[ ] Only SELECT queries via find/count/etc
[ ] Return results directly (no proposal system)

T2 TOOLS (SOFT-CONFIRM)
-----------------------
[ ] Calls proposalService.createProposal()
[ ] Executor registered in executor-registry
[ ] Executor validates tenantId before mutations
[ ] Error response if tool execution fails

T3 TOOLS (USER-CONFIRM)
-----------------------
[ ] Like T2 but requires explicit user approval
[ ] Proposal displayed to user (currently rare)
```

---

## Code Organization (PATTERNS)

Good patterns to look for:

```
DIRECTORY STRUCTURE
-------------------
[ ] Tools in server/src/agent/tools/
[ ] Executors in server/src/agent/executors/
[ ] Shared utilities in server/src/agent/utils/
[ ] Tests co-located with code (_tests/ subdirectory)

NAMING CONVENTIONS
------------------
[ ] Tool name matches export: export const toolNameTool = { name: 'tool_name' }
[ ] Executor uses same name: registerProposalExecutor('tool_name', ...)
[ ] Utility files named descriptively: tenant-info.ts, retry.ts, etc.

MODULARITY
----------
[ ] Tool file handles tool logic (invokeInput, description, schema)
[ ] Executor file handles database operations
[ ] Utils file handles shared operations
[ ] No cross-imports (tool doesn't import executor directly)
```

---

## Quick Decision Tree

```
START: New write tool added

1. Is tool name in REQUIRED_EXECUTOR_TOOLS?
   NO → Request: Add to executor-registry.ts
   YES → Continue

2. Is executor registered (registerProposalExecutor called)?
   NO → Request: Add registration to executors/index.ts
   YES → Continue

3. Do mutations include tenantId in where clause?
   NO → REJECT: Security violation (defense-in-depth)
   YES → Continue

4. Are check-then-act patterns in transactions with locks?
   NO → Request: Wrap in $transaction with FOR UPDATE
   YES → Continue

5. Is shared logic extracted (getTenantInfo, etc)?
   NO → Request: Extract to agent/utils/
   YES → Continue

6. Are error messages user-friendly and don't leak data?
   NO → Request: Improve error handling
   YES → Continue

7. Do tests verify tenant isolation?
   NO → Request: Add cross-tenant test
   YES → APPROVE
```

---

## Common Issues Found

### Issue 1: Missing tenantId in Where Clause
**Pattern:** `where: { id }` instead of `where: { id, tenantId }`
**Fix Time:** 5 minutes
**Security Impact:** CRITICAL (cross-tenant data access)
**Action:** Request changes, block merge

### Issue 2: Tool Not in REQUIRED_EXECUTOR_TOOLS
**Pattern:** New tool registered but not in validation list
**Fix Time:** 2 minutes
**Impact:** Server doesn't validate executor at startup
**Action:** Request changes, block merge

### Issue 3: Duplicate getTenantInfo Function
**Pattern:** Same function in two files
**Fix Time:** 10 minutes
**Performance Impact:** N+1 query (2x database queries)
**Action:** Request extraction, request changes

### Issue 4: TOCTOU Race Condition
**Pattern:** Count check followed by delete (separate operations)
**Fix Time:** 15 minutes
**Data Integrity Impact:** CRITICAL (orphaned records)
**Action:** Request transaction + lock, block merge

### Issue 5: Generic Error Messages
**Pattern:** `throw new Error('Something went wrong')`
**Fix Time:** 5 minutes
**UX Impact:** Users don't know what failed
**Action:** Request domain-specific errors

---

## During Code Review

### If Multiple Issues Found

```
BLOCKING (must fix before merge):
- Missing tenantId in mutations
- Tool not in REQUIRED_EXECUTOR_TOOLS
- Executor not registered
- TOCTOU race conditions
- Cross-tenant data exposure

NON-BLOCKING (request changes for next PR):
- Code duplication (>10 lines)
- Generic error messages
- Missing test coverage
- Documentation gaps
```

### Response Template

```markdown
# Code Review: [Tool Name]

## Blocking Issues

### 1. Missing tenantId in mutations (Security)
Lines 127-129: `where: { id }` should be `where: { id, tenantId }`

REQUEST CHANGES

## Non-Blocking

### 1. Duplicate getTenantInfo function
Consider extracting to server/src/agent/utils/tenant-info.ts

SUGGESTION (future PR)
```

### Approval Template

```markdown
# Approved: [Tool Name]

Verified:
- [x] All mutations include tenantId in where clause
- [x] Tool in REQUIRED_EXECUTOR_TOOLS
- [x] Executor registered in registerBookingLinkExecutors()
- [x] TOCTOU race conditions prevented with row locks
- [x] Cross-tenant tests included
- [x] Error messages don't leak data

Ready to merge.
```

---

## Running Full Verification

Before approving, run this checklist:

```bash
# 1. Run automated reviewers
npm run workflow -- review --focus "agent-tools"

# 2. Check for circular deps (executor registry prevents these)
npx madge --circular server/src/agent/

# 3. Run tests specific to agent
npm test -- agent

# 4. Run type checking
npm run typecheck

# 5. Manual grep for common issues
grep -rn "\.delete(" server/src/agent/executors/ | grep -v tenantId
# Should return nothing (all should have tenantId)

grep -n "REQUIRED_EXECUTOR_TOOLS" server/src/agent/proposals/executor-registry.ts
# New tool should be listed here

# 6. Verify startup validation
grep -rn "validateExecutorRegistry()" server/src/
# Should see it's called during initialization
```

If all pass, approve. If any fail, request changes.

---

## Resources

- Full Prevention Strategies: `docs/solutions/patterns/BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md`
- ADR-013: Advisory locks pattern
- executor-registry.ts: Startup validation implementation
- booking-link-executors.ts: Reference implementation

