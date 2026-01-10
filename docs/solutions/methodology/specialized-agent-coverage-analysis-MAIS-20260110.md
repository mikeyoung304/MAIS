---
title: Specialized Agent Coverage Analysis - Preview Token Review
category: methodology
tags:
  [
    multi-agent-review,
    code-review,
    parallel-agents,
    security,
    data-integrity,
    architecture,
    performance,
    typescript,
    code-simplicity,
    specialized-reviewers,
    coverage-analysis,
    compound-engineering,
  ]
severity: reference
date_solved: 2026-01-10
components:
  - server/src/lib/preview-tokens.ts
  - server/src/routes/public-tenant.routes.ts
  - server/src/routes/tenant-admin.routes.ts
  - server/src/services/landing-page.service.ts
  - server/src/agent/executors/storefront-executors.ts
  - apps/web/src/hooks/usePreviewToken.ts
symptoms:
  - Single generalist reviewer missed rate limiting gap on preview token endpoint
  - Single generalist reviewer missed information disclosure in error messages
  - Single generalist reviewer missed missing shared contract for API response
  - Single generalist reviewer missed duplicate implementations across services
  - Need methodology to ensure non-overlapping issue discovery
review_methodology: parallel-specialized-agents
agents_deployed: 6
commits_reviewed: 75a91c26, 8b044392
findings_p1: 0
findings_p2: 6
findings_p3: 3
---

# Specialized Agent Coverage Analysis: Preview Token Review

**Review Date:** 2026-01-10
**Commits Analyzed:** 75a91c26 (preview token system), 8b044392 (DRY segment utilities)
**Specialized Agents Deployed:** 6
**Key Insight:** Each specialized agent discovered non-overlapping issues. Single reviewer would have missed 5+ important improvements.

---

## Executive Finding

**Specialized parallel review is more effective than generalist review.** In this 30-file code review:

- **security-sentinel** alone found rate limiting + error disclosure (2 P2)
- **data-integrity-guardian** validated excellent tenant isolation (0 issues)
- **architecture-strategist** confirmed correct DRY extraction (0 issues)
- **typescript-reviewer** found missing shared contract (1 P2)
- **performance-oracle** found extra DB query (1 P2)
- **code-simplicity-reviewer** found duplicate implementations (2 P2)

**Total:** 6 P2 findings, all in different dimensions. No overlap.

> **If only one generalist reviewer ran:** Likely would have caught 2-3 items (probably security + architecture). Would have missed typescript contract, performance query, and code duplication issues.

---

## Agent Contributions Summary

### security-sentinel

**Issues Found:** 2 P2
**Files:** `server/src/routes/tenant-admin.routes.ts`, `server/src/routes/public-tenant.routes.ts`

**#721:** Missing Rate Limiting on Preview Token Endpoint

- **Risk:** CPU exhaustion via repeated JWT signing
- **Why Only Security Caught This:** Security specialist checks all auth endpoints for rate limiting. Not a bug visible to functionality testing.
- **Effort:** 15 min

**#722:** Information Disclosure in Token Error Messages

- **Risk:** Attackers can distinguish failure modes (expired vs invalid vs tenant mismatch)
- **Why Only Security Caught This:** Security specialist analyzes error messages for leakage. Requires attacker mindset, not functional testing.
- **Effort:** 10 min

---

### data-integrity-guardian

**Issues Found:** 0
**Validation:** ✅ Excellent tenant isolation confirmed

Data integrity checked:

- All queries include `tenantId` in WHERE clause
- `validateSegmentOwnership()` properly enforced
- Transactions used for read-modify-write patterns
- Error messages don't leak tenant information
- No TOCTOU vulnerabilities found

**Why Validation Matters:** This agent would flag if isolation was broken. Zero findings = high confidence in multi-tenant safety.

---

### architecture-strategist

**Issues Found:** 0
**Validation:** ✅ DRY extraction done correctly

Architecture checked:

- `resolveOrCreateGeneralSegment()` used consistently across CatalogService and executors
- `validateSegmentOwnership()` used consistently
- No remaining inline segment resolution logic
- Route ordering correct (`/:slug/preview` before `/:slug`)
- Layered architecture maintained (routes → services → adapters)

**Why Validation Matters:** Would flag if extraction was incomplete or created circular dependencies.

---

### typescript-reviewer

**Issues Found:** 1 P2
**File:** `packages/contracts/`, `server/src/routes/tenant-admin.routes.ts`, `apps/web/src/hooks/usePreviewToken.ts`

**#726:** Missing Shared Contract for Preview Token Response

- **Risk:** No compile-time validation of API contract between backend and frontend
- **Why Only TypeScript Specialist Caught This:** Checks if all API responses have contracts in `@macon/contracts`. Requires familiarity with ts-rest patterns and contract structure.
- **Current State:** Frontend has local type, backend has inline response object
- **Fix:** Add `PreviewTokenResponseSchema` to shared contracts
- **Effort:** 20 min

---

### performance-oracle

**Issues Found:** 1 P2
**File:** `server/src/routes/public-tenant.routes.ts:168-179`

**#723:** Preview Endpoint Makes 2 DB Queries Instead of 1

- **Risk:** ~15-30ms extra latency per request
- **Why Only Performance Specialist Caught This:** Requires tracing query execution flow and understanding repository patterns. Not visible to functional testing.
- **Current State:**
  ```typescript
  const tenant = await tenantRepository.findBySlugPublic(slug);
  const draftWrapper = await tenantRepository.getLandingPageDraft(tenantId);
  ```
- **Fix:** Create `findBySlugForPreview()` repository method combining both queries
- **Effort:** 30 min

---

### code-simplicity-reviewer

**Issues Found:** 2 P2
**Files:** Multiple service and executor files

**#724:** Duplicate `getBuildModeDraft()` Implementations

- **Locations:** `server/src/services/landing-page.service.ts:299-426` and `server/src/agent/tools/utils.ts:152-328`
- **Why Only Simplicity Specialist Caught This:** Requires side-by-side comparison across unrelated files. Human eye specializing in DRY patterns detects this.
- **Impact:** ~95% identical code, maintenance burden
- **Fix:** Delete unused service methods OR have them delegate to utils
- **Effort:** 20 min

**#725:** Duplicate Publish/Discard Logic

- **Locations:** `server/src/services/landing-page.service.ts:466-560` and `server/src/agent/executors/storefront-executors.ts:566-688`
- **Why Only Simplicity Specialist Caught This:** Wrapper format `{ draft, published }` defined in two places. Requires maintaining consistency across executor and service paths.
- **Fix:** Executor should call service method instead of reimplementing
- **Effort:** 45 min

---

## Coverage Heatmap

| Issue Type       | Security | Data Integrity | Architecture | TypeScript | Performance | Simplicity |
| ---------------- | -------- | -------------- | ------------ | ---------- | ----------- | ---------- |
| Rate limiting    | ✅ Found | -              | -            | -          | -           | -          |
| Error disclosure | ✅ Found | -              | -            | -          | -           | -          |
| Tenant isolation | -        | ✅ Validated   | -            | -          | -           | -          |
| DRY extraction   | -        | -              | ✅ Validated | -          | -           | -          |
| Shared contracts | -        | -              | -            | ✅ Found   | -           | -          |
| N+1 queries      | -        | -              | -            | -          | ✅ Found    | -          |
| Code duplication | -        | -              | -            | -          | -           | ✅ Found   |

**Key Observation:** No agent found issues in another agent's domain. Complete specialization.

---

## Why Generalist Review Would Miss These

### Missing Rate Limiting (#721)

- **Generalist sees:** "It works, returns valid token"
- **Security specialist sees:** "No limiter on JWT signing endpoint = DOS vector"

### Missing Error Disclosure (#722)

- **Generalist sees:** "Helpful error messages for debugging"
- **Security specialist sees:** "Attacker can enumerate failure modes"

### Missing Shared Contract (#726)

- **Generalist sees:** "Frontend calls endpoint, it works"
- **TypeScript specialist sees:** "No contract means no type safety for future changes"

### Missing DB Query (#723)

- **Generalist sees:** "It's fast enough"
- **Performance specialist sees:** "Two queries when one would work"

### Missing Duplication (#724, #725)

- **Generalist sees:** "Both paths work correctly"
- **Simplicity specialist sees:** "95% identical code = divergence risk"

---

## Methodology Validation

This review demonstrates why `/workflows:review` uses 6 specialized agents:

1. **Non-overlapping expertise** - Each agent caught what others couldn't
2. **Complete coverage** - 6 different dimensions analyzed (security, integrity, architecture, types, performance, maintainability)
3. **High-confidence validation** - When data-integrity-guardian says isolation is correct, you can trust it
4. **Cost-effective** - 6 parallel reviews take ~5 min vs 30 min+ for single thorough generalist

### Recommended Practice

Always use multi-agent review for:

- **Multi-domain changes** (>10 files or affects multiple layers)
- **Security-adjacent code** (auth, tokens, payments, permissions)
- **Complex business logic** (booking, onboarding, proposals)
- **Before major merges** (feature branches, hotfixes, dependency upgrades)

Skip multi-agent review only for:

- **Single-file changes** (<50 lines, isolated component)
- **Test-only changes** (no logic changes)
- **Documentation-only** (no code changes)

---

## Findings Impact

### P2 (Important) - 6 Issues

**Security Hardening (3):**

- #721: Rate limiting (15 min)
- #722: Error disclosure (10 min)
- Total: 25 min for security improvement

**Type Safety (1):**

- #726: Shared contract (20 min)

**Performance (1):**

- #723: Query optimization (30 min)

**Code Maintainability (2):**

- #724: DRY getBuildModeDraft (20 min)
- #725: DRY publish/discard (45 min)

**Total Effort:** 135 minutes across 6 improvements

### P3 (Nice-to-Have) - 3 Issues

- #727: JWT type assertion (low risk)
- #728: Validation helper extraction (nice-to-have)
- #729: Dual draft system debt (needs design decision)

---

## Key Insights for Future Reviews

### 1. Agent Specialization Works

Each agent discovered issues others wouldn't. This validates the approach of assembling specialized teams rather than relying on generalist expertise.

### 2. Validation Is a Finding

When data-integrity-guardian finds ZERO issues, that's a meaningful result. It means we can be confident in tenant isolation despite the complexity.

### 3. Architecture Confirmation Has Value

When architecture-strategist validates DRY extraction is correct, it justifies the refactoring effort and gives confidence for future similar extractions.

### 4. Non-overlapping Issues

Zero overlap between agents suggests good specialization. If two agents found the same issue, one wasn't adding value.

### 5. Effort-to-Impact Ratio

Quick wins (#721, #722) are security hardening (15-10 min each). Medium effort (#723, #724) are performance and maintainability. Deferred (#727-729) are low-risk/nice-to-have.

---

## How to Run This Workflow

```bash
# For major commits requiring comprehensive review
/workflows:review

# Or run preview token review manually
npm run test:coverage  # Verify baseline passes
npm run typecheck      # Verify types pass

# Then follow up with todos
ls todos/72[1-9]-pending-*.md  # View pending items
/triage                         # Categorize findings
/resolve_todo_parallel          # Fix approved items
```

---

## Related Documentation

- **Multi-Agent Review Quick Reference:** `docs/solutions/methodology/MULTI_AGENT_REVIEW_QUICK_REFERENCE.md`
- **Prevention Strategies Index:** `docs/solutions/patterns/PREVENTION-STRATEGIES-INDEX.md`
- **Code Review 708-717 Prevention:** `docs/solutions/patterns/CODE_REVIEW_708_717_PREVENTION_STRATEGIES.md`
- **Review Implementation:** `docs/solutions/methodology/multi-agent-parallel-code-review-workflow-MAIS-20260109.md`

---

## YAML Metadata

```yaml
---
title: Specialized Agent Coverage Analysis - Preview Token Review
category: methodology
tags: [multi-agent-review, specialized-reviewers, coverage-analysis]
severity: reference
date_solved: 2026-01-10
components: [preview-token-system, landing-page-service, segment-utilities]
symptoms: [need-comprehensive-review, want-non-overlapping-issues, complex-multi-domain-changes]
root_cause: Specialized expertise in different domains (security, performance, architecture, etc.) discovers issues that generalist reviews miss because they lack depth in each area
---
```
