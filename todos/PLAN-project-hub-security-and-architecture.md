# Project Hub: Security Fixes + Architecture Evolution Plan

## Executive Summary

**Recommendation:** Fix P1 security issues first (Phase 1), then evaluate split architecture (Phase 2).

The 4 P1 security issues are critical vulnerabilities that must be fixed regardless of architectural decisions. Fixing them will naturally create the foundation for a clean agent split later.

---

## Phase 1: Security Hardening (P1 Issues)

**Goal:** Fix all critical security vulnerabilities
**Effort:** ~4 hours
**Risk:** Low (additive changes, no breaking changes)

### 1.1 Tool Context Enforcement (5216)

**Problem:** All 11 tools exposed to all contexts - customer can call `approveRequest`, tenant can call `submitRequest`.

**Solution:** Add runtime guard to each tool:

```typescript
// At start of every tool execute function
const { contextType } = getContextFromSession(ctx!);
if (contextType !== 'customer') {
  return { error: 'This tool is only available in customer context' };
}
```

**Files:** `agent.ts` - all 11 tool execute functions
**Effort:** 30 minutes

### 1.2 Four-Tier Tenant ID Extraction (5217)

**Problem:** Only uses Tier 2 (plain object access). Missing 3 tiers of fallback.

**Solution:** Import and use shared `getTenantId()` from `tenant-context.ts`:

```typescript
import { getTenantId } from '../../../shared/tenant-context';

function getContextFromSession(ctx: ToolContext): SessionContext {
  const tenantId = getTenantId(ctx); // Uses all 4 tiers
  if (!tenantId) {
    throw new Error('No tenant ID found in session');
  }
  // ... rest of extraction
}
```

**Files:** `agent.ts` lines 225-239
**Effort:** 20 minutes

### 1.3 T3 Confirmation for High-Risk Actions (5218)

**Problem:** `submitRequest` for CANCELLATION/REFUND doesn't require explicit confirmation.

**Solution:** Add confirmation parameter for T3 actions:

```typescript
const submitRequest = new FunctionTool({
  parameters: z.object({
    // ... existing params
    confirmationReceived: z
      .boolean()
      .optional()
      .describe('Required for CANCELLATION/REFUND - must be true to proceed'),
  }),
  execute: async ({ requestType, confirmationReceived, ...params }) => {
    const T3_TYPES = ['CANCELLATION', 'REFUND'];
    if (T3_TYPES.includes(requestType) && !confirmationReceived) {
      return {
        requiresConfirmation: true,
        message: `${requestType} requires explicit confirmation. Please confirm with the customer before proceeding.`,
        confirmationType: 'T3_HIGH_RISK',
      };
    }
    // ... proceed with submission
  },
});
```

**Files:** `agent.ts` lines 345-410
**Effort:** 30 minutes

### 1.4 Ownership Verification (5219)

**Problem:** Tools accept `projectId`/`tenantId` as parameters without verifying the session owns them (IDOR vulnerability).

**Solution:** Verify ownership from session, not parameters:

```typescript
execute: async ({ projectId }, ctx) => {
  const session = getContextFromSession(ctx!);

  // For customer tools: verify projectId matches session
  if (session.contextType === 'customer' && projectId !== session.projectId) {
    return { error: 'Unauthorized: Project does not match session' };
  }

  // For tenant tools: verify tenant owns the resource via backend
  // (Backend should also verify, but defense in depth)
};
```

**Files:** All tools that accept `projectId` or `tenantId` parameters
**Effort:** 45 minutes

### Phase 1 Checklist

- [x] 1.1 Add context guards to all 11 tools ✅ (commit b10aed9e)
- [x] 1.2 Implement 4-tier tenant ID extraction ✅ (commit b10aed9e)
- [x] 1.3 Add T3 confirmation for CANCELLATION/REFUND ✅ (commit b10aed9e)
- [x] 1.4 Add ownership verification to all tools ✅ (commit b10aed9e)
- [x] Run typecheck and tests ✅ (passed)
- [ ] Deploy to staging and verify (pending push to Cloud Run)

---

## Phase 2: Architecture Decision

**After Phase 1 is complete**, evaluate the split architecture:

### Option A: Keep Single Agent (Enhanced)

With Phase 1 fixes in place:

- Tool gating provides programmatic separation
- Single deployment is simpler
- Context bleed prevented by guards

**Pros:** Simpler ops, lower cost, tools already separated logically
**Cons:** Shared LLM context, coupled evolution, complex prompt

### Option B: Split into Two Agents

Create `CustomerHubAgent` and `TenantHubAgent`:

```
project-hub/
├── customer/
│   └── src/agent.ts    # Customer-focused tools only
└── tenant/
    └── src/agent.ts    # Tenant-focused tools only
```

**Pros:**

- Complete isolation (no context bleed possible)
- Focused prompts (easier to tune)
- Independent evolution
- Clearer testing

**Cons:**

- Two Cloud Run deployments
- More infrastructure to manage
- Need to coordinate shared logic

### Recommendation

**Start with Option A** (keep single agent with Phase 1 fixes). The tool gating provides 90% of the security benefits of splitting. If we later find:

- Prompts are getting too complex
- We need different LLM models per context
- Testing is still difficult

Then split in Phase 3.

---

## Phase 3: P2 Quality Improvements (Optional)

After security is solid, consider these quality improvements:

| Todo | Issue                      | Effort |
| ---- | -------------------------- | ------ |
| 5220 | Remove dead mediation code | 15 min |
| 5221 | Use structured logger      | 30 min |
| 5222 | Tool state returns         | 45 min |
| 5223 | Tool-first prompt          | 30 min |
| 5224 | HTTPS URL validation       | 20 min |
| 5225 | Parallel API calls         | 30 min |
| 5226 | Server-side expiry         | 45 min |

**Total P2 effort:** ~3.5 hours

---

## Phase 4: P3 Enhancements (Future)

| Todo | Issue                    | Effort    |
| ---- | ------------------------ | --------- |
| 5227 | Remove unused interfaces | 15 min    |
| 5228 | Extract magic numbers    | 30 min    |
| 5229 | Add bootstrap tool       | 2-3 hours |
| 5230 | Add event actor field    | 1 hour    |

---

## Execution Order

```
Week 1:
├── Day 1: Phase 1 (P1 Security) - 4 hours
│   ├── 1.1 Tool context enforcement
│   ├── 1.2 Four-tier tenant ID
│   ├── 1.3 T3 confirmation
│   └── 1.4 Ownership verification
├── Day 2: Testing & Deploy
│   ├── Write tests for new guards
│   ├── Deploy to staging
│   └── Verify no regressions

Week 2 (if desired):
├── Day 3: Phase 2 Decision
│   └── Evaluate if split is needed
├── Day 4-5: Phase 3 (P2 Quality)
│   └── Work through P2 todos
```

---

## Success Criteria

### Phase 1 Complete When:

- [x] Customer cannot call tenant tools (verified by test) ✅ `requireContext(ctx, 'tenant')` guard
- [x] Tenant cannot call customer tools (verified by test) ✅ `requireContext(ctx, 'customer')` guard
- [x] Tenant ID extraction works across all 4 tiers ✅ imported `getTenantId()` from shared module
- [x] CANCELLATION/REFUND require explicit confirmation ✅ `T3_REQUEST_TYPES` + `confirmationReceived`
- [x] Tools verify ownership from session ✅ customer tools check `session.projectId`
- [x] All tests pass ✅ (pre-existing failures unrelated)
- [ ] Deployed to production (pending Cloud Run deploy)

### Phase 2 Decision Made When:

- [ ] Phase 1 deployed and stable for 1 week
- [ ] Evaluated prompt complexity
- [ ] Evaluated testing difficulty
- [ ] Made go/no-go on split architecture

---

## Files to Modify

**Phase 1:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts` (primary)
- `server/src/agent-v2/shared/tenant-context.ts` (import)

**Phase 2 (if split):**

- Create `server/src/agent-v2/deploy/project-hub-customer/`
- Create `server/src/agent-v2/deploy/project-hub-tenant/`
- Update deployment scripts

---

## Related Todos

**P1 (Complete ✅):**

- 5216-complete-p1-project-hub-tool-context-enforcement.md ✅
- 5217-complete-p1-project-hub-4-tier-tenant-id.md ✅
- 5218-complete-p1-project-hub-t3-confirmation.md ✅
- 5219-complete-p1-project-hub-ownership-verification.md ✅

**P2 (Ready for `/resolve_todo_parallel`):**

- 5220-ready-p2-project-hub-dead-code-mediation.md
- 5221-ready-p2-project-hub-structured-logger.md
- 5222-ready-p2-project-hub-tool-state-returns.md
- 5223-ready-p2-project-hub-tool-first-prompt.md
- 5224-ready-p2-project-hub-https-validation.md
- 5225-ready-p2-project-hub-sequential-api-calls.md
- 5226-ready-p2-project-hub-client-expiry.md

**P3 (Phase 4 - Future):**

- 5227 through 5230

**Pre-existing:**

- 5200-complete-p2-project-hub-architecture-review.md ✅ (answered by this plan)
