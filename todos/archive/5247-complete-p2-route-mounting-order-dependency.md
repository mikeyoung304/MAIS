---
status: pending
priority: p2
issue_id: 5247
tags: [code-review, architecture, pr-44, routing]
dependencies: []
---

# Unnecessary Route Mounting Order Dependency

## Problem Statement

The aggregator comment explains "marketing must mount before storefront" because both handle root-level routes. URL routing should NOT depend on mount order—this is a code smell indicating overlapping responsibilities.

**Why this matters:** Order-dependent routing is fragile. A developer reordering imports could break the app. Explicit URL prefixes eliminate this coupling.

**Impact:** P2 IMPORTANT - Fragile architecture, non-obvious failure mode.

## Findings

### Code Simplicity Review

**File:** `server/src/routes/internal-agent.routes.ts:44-47`

**Order-dependent comment:**

```typescript
// Mount marketing routes first (handles /generate-* endpoints)
// This must come before storefront routes to avoid conflicts
internalAgentRoutes.use(internalAgentMarketingRoutes);
internalAgentRoutes.use(internalAgentStorefrontRoutes);
```

**Why this is a code smell:**

1. Implicit coupling between two domain routers
2. Reordering lines breaks functionality
3. No type-system enforcement of correct order
4. Comment is a warning sign: "must come before"

### Architecture Review

**Root cause:** Marketing routes handle `/generate-section`, `/generate-hero-variants`, etc. Storefront routes could potentially conflict if they also handled root-level patterns.

**Better design:** Use explicit prefixes like `/marketing/*` to eliminate ambiguity.

## Proposed Solutions

### Solution 1: Mount Marketing at `/marketing` Prefix (RECOMMENDED)

**Pros:**

- Eliminates mount order dependency
- Self-documenting URLs: `/marketing/generate-section`
- Safe to reorder imports
- Matches pattern of other route groups
  **Cons:**
- Breaks existing agent tool URLs (must update 7 tools)
  **Effort:** Medium (30 minutes - update agent tools)
  **Risk:** Low - tools already use environment variable base URLs

**Implementation:**

```typescript
// internal-agent.routes.ts
internalAgentRoutes.use('/marketing', internalAgentMarketingRoutes);
internalAgentRoutes.use(internalAgentStorefrontRoutes);
// Order no longer matters!

// Agent tools update (example):
// OLD: POST /internal/generate-section
// NEW: POST /internal/marketing/generate-section
```

### Solution 2: Document Conflict Scenarios

**Pros:**

- No code changes
- Makes implicit dependency explicit
  **Cons:**
- Still fragile
- Comment won't prevent reordering
  **Effort:** Trivial (5 minutes)
  **Risk:** Medium - doesn't solve root cause

**Implementation:**

```typescript
// Mount marketing before storefront to avoid route conflicts:
// - Marketing: /generate-section, /generate-hero-variants
// - Storefront: /sections/:sectionId
// If storefront mounted first, catch-all routes could intercept marketing paths
```

### Solution 3: Keep Current Order-Dependent Design

**Pros:**

- No changes needed
  **Cons:**
- Fragile mount order requirement
- Non-obvious failure mode
- Comment is insufficient protection
  **Effort:** Zero
  **Risk:** High - accidental reordering breaks app

## Recommended Action

**Use Solution 1** - Mount marketing at `/marketing` prefix. The 30-minute effort to update 7 agent tools is worth eliminating fragile mount order coupling.

**Migration checklist:**

1. Update aggregator: `internalAgentRoutes.use('/marketing', internalAgentMarketingRoutes)`
2. Update 7 agent tools: `POST /internal/marketing/generate-section`, etc.
3. Deploy backend first, then agent
4. Add E2E test that calls marketing endpoints to catch regressions

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent.routes.ts:44-47` (add prefix)
- `server/src/agent-v2/deploy/tenant/src/tools/*.ts` (7 tools with `/generate-*` URLs)

**Endpoint changes:**

- `/internal/generate-section` → `/internal/marketing/generate-section`
- `/internal/generate-hero-variants` → `/internal/marketing/generate-hero-variants`
- `/internal/generate-package-description` → `/internal/marketing/generate-package-description`
- `/internal/generate-section-content` → `/internal/marketing/generate-section-content`
- Plus 3 more generation endpoints

**Line count impact:** +1 line (add prefix), update 7 tool URLs

**Related Pattern:** Explicit is better than implicit (Zen of Python)

## Acceptance Criteria

- [ ] Marketing routes mounted with `/marketing` prefix
- [ ] All 7 agent tools updated with new URLs
- [ ] Mount order comment deleted (no longer needed)
- [ ] Reordering test: swap mount order in aggregator, verify still works
- [ ] E2E test calls at least 2 marketing endpoints
- [ ] `npm run --workspace=server typecheck` passes
- [ ] Backend deploys before agent deploy (to avoid 404s)

## Work Log

**2026-02-09 - Initial Assessment (Code Review PR #44)**

- Code Simplicity Review identified order dependency
- Confirmed "must come before" comment is code smell
- Architecture Review verified no technical blocker to prefixing
- Assessed migration effort: 7 agent tools need URL updates

## Resources

- **PR:** https://github.com/mikeyoung304/MAIS/pull/44
- **Related Files:**
  - `internal-agent.routes.ts:44-47` (order dependency)
  - `internal-agent-marketing.routes.ts` (7 generation endpoints)
  - `server/src/agent-v2/deploy/tenant/src/tools/` (tools to update)
- **Express Routing:** https://expressjs.com/en/guide/routing.html#route-paths
