---
status: deferred
priority: p2
issue_id: '7006'
tags: [code-review, architecture, consistency, pr-45]
dependencies: []
---

# 7006: Customer Agent Not Updated with New Utilities

## Problem Statement

The agent debt cleanup sprint standardized all 28 tenant-agent tools with `wrapToolExecute`, `validateParams`, `requireTenantId`, and `callMaisApiTyped`. However, the customer-agent (`server/src/agent-v2/deploy/customer/`) was not updated and still uses the old patterns: manual try/catch, raw `as` casts, no Zod validation on API responses.

**Impact:** Medium. The two agents now have divergent code quality — tenant-agent has typed contracts and standardized error handling while customer-agent has the old unsafe patterns. This increases maintenance burden and means customer-agent tools don't benefit from the safety improvements.

## Findings

### Agent: Pattern Recognition + Architecture Strategist

- **File:** `server/src/agent-v2/deploy/customer/src/tools/*.ts` (all 13 tools)
- **Evidence:** Customer agent tools still use manual try/catch, `callMaisApi` (untyped), and `params as Type` casts
- The utilities (`wrapToolExecute`, `validateParams`, etc.) are defined in `tenant/src/utils.ts` — not shared
- Cloud Run rootDir constraint prevents cross-agent imports

### Proposed Solutions

**Option A: Copy utilities to customer-agent (Recommended)**

- Duplicate `utils.ts`, `types/api-responses.ts`, `constants/shared.ts` to customer agent
- Apply same standardization pattern to all 13 customer tools
- Pros: Consistent quality across both agents, proven patterns
- Cons: Code duplication (same Cloud Run rootDir constraint)
- Effort: Large (13 tools to migrate)
- Risk: Low (proven patterns, just applying them)

**Option B: Shared npm package**

- Extract utilities into a shared package that both agents can import
- Pros: No duplication, single source of truth
- Cons: Cloud Run rootDir may prevent this; build pipeline changes needed
- Effort: Large
- Risk: Medium (deployment complexity)

**Option C: Defer to next sprint**

- Track as technical debt, address in dedicated customer-agent cleanup sprint
- Pros: No risk to current PR
- Cons: Divergence grows over time
- Effort: None now
- Risk: None now (accumulates debt)

## Recommended Action

Option C for now (don't block this PR), then Option A in a dedicated sprint. The customer-agent has fewer tools (13 vs 28) and can be migrated faster.

## Technical Details

- **Affected files:** `server/src/agent-v2/deploy/customer/src/tools/*.ts` (13 files)
- **Components:** customer-agent tools, shared utilities
- **Database:** No changes

## Acceptance Criteria

- [ ] Customer agent tools use `wrapToolExecute` for error handling
- [ ] All customer tool params validated with `validateParams` + Zod
- [ ] `callMaisApiTyped` used for all typed API calls
- [ ] `requireTenantId` used instead of manual null checks
- [ ] Parity with tenant-agent utility patterns

## Work Log

| Date       | Action                     | Learnings                                                     |
| ---------- | -------------------------- | ------------------------------------------------------------- |
| 2026-02-11 | Created from PR #45 review | Found by Pattern Recognition + Architecture Strategist agents |

## Resources

- PR #45: refactor/agent-debt-cleanup
- Customer agent: `server/src/agent-v2/deploy/customer/src/tools/`
- Tenant agent utilities: `server/src/agent-v2/deploy/tenant/src/utils.ts`
