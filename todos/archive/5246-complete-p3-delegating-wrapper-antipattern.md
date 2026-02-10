---
status: pending
priority: p3
issue_id: 5246
tags: [code-review, maintenance, pr-44, opus-verified]
dependencies: []
---

# Verbose Endpoint Counting Claims in Aggregator

## Problem Statement

The aggregator header comment claims "41 endpoints across 5 domain files" with detailed per-file breakdown. When a developer adds or removes an endpoint, they must update 3 places: the endpoint itself, the domain file comment, and the aggregator comment.

**Why this matters:** Manual endpoint counting creates maintenance burden and risks becoming stale. The aggregator's role is to mount routers, not document their contents.

**Opus Verification (2026-02-10):** Downgraded P2 → P3. Comment drift is cosmetic. The actual aggregator header is clean and accurate. Simplifying is a nice-to-have.

**Impact:** P3 NICE-TO-HAVE - Cosmetic comment maintenance.

## Findings

### Code Simplicity Review

**File:** `server/src/routes/internal-agent.routes.ts:16-22`

**Verbose header:**

```typescript
/**
 * Internal Agent API Aggregator
 *
 * Mounts 5 domain-specific route modules:
 * - Discovery & Bootstrap: 9 endpoints
 * - Marketing & Generation: 7 endpoints
 * - Storefront Management: 16 endpoints
 * - Session Management: 5 endpoints
 * - Health & Diagnostics: 4 endpoints
 *
 * Total: 41 endpoints
 */
```

**Why this is a problem:**

1. Each domain file already documents its own endpoint count
2. If marketing.routes.ts adds an endpoint, 3 comments need updating
3. The "41 endpoints" number provides no actionable value
4. Aggregator's responsibility is routing, not documentation

## Proposed Solutions

### Solution 1: Delete Endpoint Counts (RECOMMENDED)

**Pros:**

- Eliminates maintenance burden
- Each domain file remains self-documenting
- Aggregator focuses on its single responsibility
  **Cons:** None
  **Effort:** Trivial (2 minutes)
  **Risk:** Zero

**Implementation:**

```typescript
/**
 * Internal Agent API Aggregator
 *
 * Mounts domain-specific route modules for agent tool implementations.
 * Each domain file documents its own endpoints.
 */
export const internalAgentRoutes = Router();
```

### Solution 2: Automated Comment Generation

**Pros:**

- Counts stay accurate
  **Cons:**
- Requires build-time script
- Over-engineering for minimal value
- Still couples aggregator to domain details
  **Effort:** Medium (1 hour)
  **Risk:** Low

### Solution 3: Keep Current Counts (Current State)

**Pros:**

- No changes needed
  **Cons:**
- Will become stale on next endpoint addition
- Triple-update requirement slows development
  **Effort:** Zero
  **Risk:** High - documentation drift

## Recommended Action

**Use Solution 1** - Delete endpoint counts. The aggregator should mount routers, not inventory their contents. Each domain file already has accurate documentation at the top.

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent.routes.ts:16-22` (simplify header)

**Line count impact:** -6 lines (remove detailed breakdown)

**Related Pattern:** Single Responsibility Principle - aggregator routes, domain files document

## Acceptance Criteria

- [ ] Aggregator header comment simplified to 1-2 sentences
- [ ] Removed: per-domain endpoint counts
- [ ] Removed: total endpoint count
- [ ] Kept: high-level description of aggregator role
- [ ] Each domain file still documents its own endpoints
- [ ] `npm run --workspace=server typecheck` passes

## Work Log

**2026-02-09 - Initial Assessment (Code Review PR #44)**

- Code Simplicity Review identified verbose counting
- Confirmed each domain file already self-documents
- Verified aggregator role is routing, not documentation
- Assessed triple-update burden on future changes

## Resources

- **PR:** https://github.com/mikeyoung304/MAIS/pull/44
- **Related Files:**
  - `internal-agent.routes.ts:16-22` (verbose counts)
  - All 5 domain files (already self-document)
- **SRP:** https://en.wikipedia.org/wiki/Single-responsibility_principle
